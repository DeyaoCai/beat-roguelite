"""Flatten Skyrim materials to dielectric + albedo."""

from __future__ import annotations

import array
import os
import re

import bpy

_FORMID = re.compile(r"^[0-9a-f]{8}$", re.I)


def _image_stem(img) -> str:
    raw = (getattr(img, "name", None) or getattr(img, "filepath", None) or "")
    base = raw.replace("\\", "/").rsplit("/", 1)[-1].lower()
    return base.rsplit(".", 1)[0]


def _image_path(img) -> str:
    return (getattr(img, "filepath", None) or getattr(img, "name", None) or "").replace(
        "\\", "/"
    ).lower()


def _is_facetint(img) -> bool:
    """RaceMenu facetint = makeup overlay / FaceGen tintmask, not solo diffuse."""
    p = _image_path(img)
    stem = _image_stem(img)
    if "facetint" in p or "facegendata/facetint" in p:
        return True
    if _FORMID.match(stem):
        return True
    return False


def _is_albedo_image(img) -> bool:
    if _is_facetint(img):
        return False
    stem = _image_stem(img)
    return not (
        stem.endswith("_s")
        or stem.endswith("_msn")
        or stem.endswith("_sk")
        or stem.endswith("_n")
        or "_msn" in stem
    )


def _fallback_albedo_name(mat_name: str) -> str:
    n = mat_name.lower()
    if "head" in n and "hair" not in n:
        return "femalehead.dds"
    if "hand" in n:
        return "femalehands_1.dds"
    return "femalebody_1.dds"


def _load_albedo_from_roots(mat_name: str, roots: list[str]):
    rel = os.path.join(
        "textures", "actors", "character", "female", _fallback_albedo_name(mat_name)
    )
    for root in roots:
        p = os.path.join(root, rel)
        if os.path.isfile(p):
            return bpy.data.images.load(p, check_existing=True)
    return None


def _is_head_mat(name: str) -> bool:
    n = name.lower()
    return "head" in n and "hair" not in n and "band" not in n


def _is_alpha_mat(name: str) -> bool:
    n = name.lower()
    return any(k in n for k in ("eye", "brow", "mouth", "hair", "lash", "hairline"))


def _ensure_pixels(img) -> tuple[int, int, array.array]:
    w, h = img.size
    buf = array.array("f", [0.0]) * (w * h * 4)
    img.pixels.foreach_get(buf)
    return w, h, buf


def _compose_head_makeup(skin_img, tint_img, out_path: str):
    """Bake FaceGen/RaceMenu tintmask onto femalehead.

    Tintmasks are mostly opaque mid-grey with makeup/brow detail — not an alpha card.
    Transfer relative luminance + chromatic makeup onto the skin diffuse.
    """
    sw, sh, skin = _ensure_pixels(skin_img)
    tw, th, tint = _ensure_pixels(tint_img)
    if (tw, th) != (sw, sh):
        tint_img.scale(sw, sh)
        tw, th, tint = _ensure_pixels(tint_img)

    # Neutral grey of the tintmask (FaceGen base).
    samples = []
    step = max(1, (sw * sh) // 4096)
    for i in range(0, sw * sh, step):
        o = i * 4
        samples.append((tint[o] + tint[o + 1] + tint[o + 2]) / 3.0)
    samples.sort()
    neutral = samples[len(samples) // 2] if samples else 0.87
    if neutral < 0.05:
        neutral = 0.87

    out = array.array("f", [0.0]) * (sw * sh * 4)
    for i in range(sw * sh):
        o = i * 4
        sr, sg, sb = skin[o], skin[o + 1], skin[o + 2]
        tr, tg, tb = tint[o], tint[o + 1], tint[o + 2]
        lum = (tr + tg + tb) / 3.0
        mul = max(0.15, min(1.35, lum / neutral))
        mx = max(tr, tg, tb)
        mn = min(tr, tg, tb)
        sat = (mx - mn) / (mx + 1e-6)
        # Chromatic makeup (lips / blush) — soft replace toward tint color.
        makeup = 0.0
        if sat > 0.045 and lum > 0.12:
            makeup = min(0.85, (sat - 0.045) * 5.0)
        r = sr * mul * (1.0 - makeup) + tr * makeup
        g = sg * mul * (1.0 - makeup) + tg * makeup
        b = sb * mul * (1.0 - makeup) + tb * makeup
        out[o] = min(1.0, r)
        out[o + 1] = min(1.0, g)
        out[o + 2] = min(1.0, b)
        out[o + 3] = 1.0

    name = os.path.splitext(os.path.basename(out_path))[0]
    img = bpy.data.images.new(name, sw, sh, alpha=False, float_buffer=False)
    img.pixels.foreach_set(out)
    try:
        img.colorspace_settings.name = "sRGB"
    except Exception:
        pass
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    img.filepath_raw = out_path
    img.file_format = "PNG"
    img.save()
    print(
        "head_makeup",
        out_path,
        f"neutral={neutral:.3f}",
        f"{sw}x{sh}",
    )
    return img


def flatten_skin_materials(
    tex_roots: list[str] | None = None,
    head_diffuse: str | None = None,
    head_tint: str | None = None,
    prefer: dict | None = None,
) -> None:
    """Rebuild each material as dielectric Principled + albedo only.

    - Head uses femalehead (or head_diffuse), optionally composited with head_tint.
    - Eyes / brows / mouth / hair keep alpha (CLIP).
    """
    roots = list(tex_roots or [])
    forced_head = None
    if head_diffuse and os.path.isfile(head_diffuse):
        forced_head = bpy.data.images.load(head_diffuse, check_existing=True)
        print("head_diffuse", head_diffuse)

    makeup_head = None
    if forced_head is not None and head_tint and os.path.isfile(head_tint):
        tint_img = bpy.data.images.load(head_tint, check_existing=True)
        cache_dir = os.path.join(os.path.dirname(head_diffuse), "makeup")
        stem = os.path.splitext(os.path.basename(head_tint))[0]
        out_png = os.path.join(cache_dir, f"femalehead_{stem}.png")
        makeup_head = _compose_head_makeup(forced_head, tint_img, out_png)
        print("head_tint", head_tint)

    for mat in list(bpy.data.materials):
        images = []
        nt = getattr(mat, "node_tree", None)
        if nt:
            for n in nt.nodes:
                img = getattr(n, "image", None)
                if img is not None:
                    images.append(img)

        albedo = next((img for img in images if _is_albedo_image(img)), None)
        if albedo is None:
            albedo = next((img for img in images if not _is_facetint(img)), None)

        if prefer:
            for key, p in prefer.items():
                if key == "head":
                    continue
                if key in mat.name.lower() and p and os.path.isfile(p):
                    albedo = bpy.data.images.load(p, check_existing=True)
                    break

        if albedo is None and roots:
            albedo = _load_albedo_from_roots(mat.name, roots)

        if _is_head_mat(mat.name):
            if makeup_head is not None:
                albedo = makeup_head
            elif forced_head is not None:
                albedo = forced_head
            else:
                skin = _load_albedo_from_roots(mat.name, roots)
                if skin is not None:
                    albedo = skin
                elif albedo is not None and _is_facetint(albedo):
                    albedo = None

        if hasattr(mat, "use_nodes"):
            mat.use_nodes = True
        nt = mat.node_tree
        if nt is None:
            continue
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        prin = nt.nodes.new("ShaderNodeBsdfPrincipled")
        prin.location = (200, 0)
        out.location = (480, 0)
        if "Metallic" in prin.inputs:
            prin.inputs["Metallic"].default_value = 0.0
        if "Roughness" in prin.inputs:
            prin.inputs["Roughness"].default_value = 0.62
        for spec_name in ("Specular IOR Level", "Specular"):
            if spec_name in prin.inputs:
                try:
                    prin.inputs[spec_name].default_value = 0.08
                except Exception:
                    pass
        nt.links.new(prin.outputs[0], out.inputs[0])

        alpha_card = _is_alpha_mat(mat.name) and not _is_head_mat(mat.name)
        if alpha_card:
            try:
                mat.blend_method = "CLIP"
                mat.shadow_method = "CLIP"
                mat.alpha_threshold = 0.12
            except Exception:
                pass

        if albedo is not None:
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = albedo
            tex.location = (0, 0)
            try:
                albedo.colorspace_settings.name = "sRGB"
            except Exception:
                pass
            nt.links.new(tex.outputs["Color"], prin.inputs["Base Color"])
            if alpha_card and "Alpha" in tex.outputs and "Alpha" in prin.inputs:
                nt.links.new(tex.outputs["Alpha"], prin.inputs["Alpha"])
        elif _is_head_mat(mat.name):
            # Solid skin fallback if femalehead missing from disk.
            if "Base Color" in prin.inputs:
                prin.inputs["Base Color"].default_value = (0.83, 0.66, 0.54, 1.0)

        print(
            "flatten",
            mat.name,
            "albedo",
            getattr(albedo, "name", None),
            "alpha" if alpha_card else "opaque",
        )
