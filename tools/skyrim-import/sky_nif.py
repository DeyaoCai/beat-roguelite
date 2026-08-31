"""PyNifly nif / hkx import."""

from __future__ import annotations

import bpy


def ensure_pynifly() -> None:
    mods = bpy.context.preferences.addons.keys()
    for name in ("io_scene_nifly", "pynifly"):
        if name in mods:
            return
        try:
            bpy.ops.preferences.addon_enable(module=name)
            return
        except Exception:
            pass
    raise SystemExit(
        "PyNifly addon not found. Install io_scene_nifly.zip in this Blender, then quit and rerun."
    )


def list_import_ops() -> list[str]:
    return [n for n in dir(bpy.ops.import_scene) if "nif" in n.lower() or "hkx" in n.lower()]


def call_op(op, filepath: str, extra: dict) -> None:
    kw = {"filepath": filepath}
    try:
        rna = op.get_rna_type()
        allowed = {p.identifier for p in rna.properties if p.identifier not in {"rna_type"}}
    except Exception:
        allowed = set(extra)
    for k, v in extra.items():
        if k in allowed:
            kw[k] = v
    aliases = {
        "create_bones": "do_create_bones",
        "rename_bones": "do_rename_bones",
        "use_blender_xf": "blender_xf",
        "import_collisions": "do_import_collisions",
        "import_tris": "do_import_tris",
        "import_animations": "do_import_animations",
        "reference_skel": "reference_skel",
    }
    for src, dst in aliases.items():
        if src in extra and dst in allowed and dst not in kw:
            kw[dst] = extra[src]
    op(**kw)


def import_nif(
    path: str,
    *,
    create_bones: bool,
    apply_skinning: bool = True,
    reference_skel: str | None = None,
) -> None:
    op = getattr(bpy.ops.import_scene, "pynifly", None)
    if op is None:
        raise SystemExit(f"import_scene.pynifly missing; have: {list_import_ops()}")
    extra = {
        "create_bones": create_bones,
        "do_create_bones": create_bones,
        "rename_bones": False,
        "do_rename_bones": False,
        "rename_bones_niftools": False,
        "use_blender_xf": False,
        "blender_xf": False,
        "import_collisions": False,
        "do_import_collisions": False,
        "import_tris": False,
        "do_import_tris": False,
        "import_animations": False,
        "do_import_animations": False,
        "import_shapekeys": False,
        "mesh_only": False,
        "apply_skinning": apply_skinning,
        "do_apply_skinning": apply_skinning,
    }
    if reference_skel:
        extra["reference_skel"] = reference_skel
    call_op(op, path, extra)


def import_hkx(path: str, skeleton: str | None) -> None:
    try:
        from io_scene_nifly.hkx import anim_skyrim

        native = anim_skyrim.is_skyrim_hkx(path)
    except Exception:
        native = False
    if not native:
        print(
            "WARN: skip hkx (official SE pack; convert with hkxconv -v xml):",
            path,
        )
        return
    names = [n for n in dir(bpy.ops.import_scene) if "hkx" in n.lower()]
    if not names:
        print("WARN: no HKX importer; skip", path, "ops=", list_import_ops())
        return
    op_name = "pynifly_hkx" if "pynifly_hkx" in names else names[0]
    op = getattr(bpy.ops.import_scene, op_name)
    extra = {
        "rename_bones": False,
        "do_rename_bones": False,
        "use_blender_xf": False,
        "blender_xf": False,
    }
    if skeleton:
        extra["reference_skel"] = skeleton
    print("hkx op", op_name)
    call_op(op, path, extra)


def set_sky_texture_roots(roots: list[str]) -> None:
    import os

    addon = bpy.context.preferences.addons.get("io_scene_nifly")
    if addon is None:
        print("WARN: io_scene_nifly prefs missing; textures may not resolve")
        return
    slots = (
        "sky_texture_path_1",
        "sky_texture_path_2",
        "sky_texture_path_3",
        "sky_texture_path_4",
    )
    uniq: list[str] = []
    for raw in roots:
        p = os.path.normpath(raw) if raw else ""
        if p and os.path.isdir(p) and p not in uniq:
            uniq.append(p)
    for i, slot in enumerate(slots):
        setattr(addon.preferences, slot, uniq[i] if i < len(uniq) else "")
    if uniq:
        bpy.context.preferences.filepaths.texture_directory = uniq[0] + os.sep
    print("sky texture roots:", uniq[:4])


def discover_texture_roots(mo2: str, game_data: str, nif_paths: list[str]) -> list[str]:
    import os

    found: list[str] = []

    def add(p: str) -> None:
        n = os.path.normpath(p) if p else ""
        if n and os.path.isdir(n) and n not in found:
            found.append(n)

    for nif in nif_paths:
        cur = os.path.dirname(nif)
        for _ in range(8):
            if os.path.isdir(os.path.join(cur, "textures")):
                add(cur)
                break
            parent = os.path.dirname(cur)
            if parent == cur:
                break
            cur = parent
    if mo2 and os.path.isdir(mo2):
        try:
            names = os.listdir(mo2)
        except OSError:
            names = []
        for name in names:
            root = os.path.join(mo2, name)
            probe = os.path.join(
                root, "textures", "actors", "character", "female", "femalebody_1.dds"
            )
            if os.path.isfile(probe):
                add(root)
    add(game_data)
    return found
