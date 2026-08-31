"""Flatten Skyrim materials to dielectric + albedo."""

from __future__ import annotations

import os

import bpy


def _image_stem(img) -> str:
    raw = (getattr(img, "name", None) or getattr(img, "filepath", None) or "")
    base = raw.replace("\\", "/").rsplit("/", 1)[-1].lower()
    return base.rsplit(".", 1)[0]


def _is_albedo_image(img) -> bool:
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
    if "head" in n:
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


def flatten_skin_materials(
    tex_roots: list[str] | None = None,
    prefer: dict | None = None,
) -> None:
    """Rebuild each material as dielectric Principled + albedo only.

    PyNifly wires Skyrim _s into KHR_materials_specular and _msn into the
    tangent normal slot; RoomEnvironment then reads the figure as chrome.
    """
    for mat in list(bpy.data.materials):
        images = []
        nt = getattr(mat, "node_tree", None)
        if nt:
            for n in nt.nodes:
                img = getattr(n, "image", None)
                if img is not None:
                    images.append(img)
        albedo = next((img for img in images if _is_albedo_image(img)), None)
        if albedo is None and images:
            albedo = images[0]
        if prefer:
            for key, p in prefer.items():
                if key in mat.name.lower() and p and os.path.isfile(p):
                    albedo = bpy.data.images.load(p, check_existing=True)
                    break
        if albedo is None and tex_roots:
            albedo = _load_albedo_from_roots(mat.name, tex_roots)

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
        if albedo is not None:
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = albedo
            tex.location = (0, 0)
            try:
                albedo.colorspace_settings.name = "sRGB"
            except Exception:
                pass
            nt.links.new(tex.outputs["Color"], prin.inputs["Base Color"])
        print("flatten", mat.name, "albedo", getattr(albedo, "name", None))
