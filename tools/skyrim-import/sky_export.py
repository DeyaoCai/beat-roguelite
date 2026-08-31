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


def write_figure_json(out_glb: str, has_idle: bool, has_walk: bool) -> None:
    pack = os.path.normpath(os.path.join(os.path.dirname(out_glb), ".."))
    fig = os.path.join(pack, "figure.json")
    rel = "models/" + os.path.basename(out_glb)
    data = {
        "id": "skyrim-female",
        "caption": "Skyrim 3BA",
        "body": rel,
        "height": 1.7,
        "gaits": {},
        "capabilities": {"wardrobe": False, "poses": False, "jiggle": False},
    }
    if has_idle:
        data["gaits"]["idle"] = rel
    if has_walk:
        data["gaits"]["walk"] = rel
    with open(fig, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
