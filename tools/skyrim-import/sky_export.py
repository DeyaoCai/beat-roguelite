"""glTF export + figure.json."""

from __future__ import annotations

import json
import os

import bpy


def export_glb(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    kw = dict(
        filepath=path,
        export_format="GLB",
        export_animations=True,
        export_skins=True,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
        export_apply=False,
    )
    try:
        bpy.ops.export_scene.gltf(**kw, export_animation_mode="ACTIONS")
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)


def write_figure_json(
    out_glb: str,
    has_idle: bool,
    has_walk: bool,
    pack_id: str = "",
    caption: str = "",
    voices: str = "",
) -> None:
    pack = os.path.normpath(os.path.join(os.path.dirname(out_glb), ".."))
    fig = os.path.join(pack, "figure.json")
    rel = "models/" + os.path.basename(out_glb)
    prev = {}
    if os.path.isfile(fig):
        try:
            with open(fig, encoding="utf-8") as f:
                prev = json.load(f)
        except Exception:
            prev = {}
    pid = pack_id or prev.get("id") or os.path.basename(pack)
    data = {
        "id": pid,
        "caption": caption or prev.get("caption") or pid,
        "body": rel,
        "height": prev.get("height") or 1.7,
        "gaits": {},
        "capabilities": prev.get("capabilities")
        or {"wardrobe": False, "poses": False, "jiggle": False},
    }
    if has_idle:
        data["gaits"]["idle"] = rel
    if has_walk:
        data["gaits"]["walk"] = rel
    voice = voices or prev.get("voices")
    if voice:
        data["voices"] = voice
    with open(fig, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
