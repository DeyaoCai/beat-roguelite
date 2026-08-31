"""Scene graph: armature join, helpers, NLA."""

from __future__ import annotations

import bpy


def armatures() -> list:
    return [o for o in bpy.data.objects if o.type == "ARMATURE"]


def dump_scene() -> None:
    objs = list(bpy.data.objects)
    print("scene objects:", len(objs) or "(none)")
    for o in objs:
        print(f"  {o.type:10} {o.name}")


def ensure_object_mode() -> None:
    if bpy.context.object and bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def select_armature(arm) -> None:
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    arm.hide_set(False)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm


def join_to_master(master) -> None:
    for arm in list(armatures()):
        if arm == master:
            continue
        for obj in list(bpy.data.objects):
            if obj.parent == arm:
                obj.parent = master
            for mod in obj.modifiers:
                if mod.type == "ARMATURE":
                    mod.object = master
        bpy.data.objects.remove(arm, do_unlink=True)


def parent_skins_to_armature(arm) -> None:
    """glTF requires skinned meshes to be parented to the armature they use."""
    ensure_object_mode()
    for obj in list(bpy.data.objects):
        if obj.type != "MESH":
            continue
        if not any(m.type == "ARMATURE" and m.object == arm for m in obj.modifiers):
            continue
        if obj.parent == arm:
            continue
        world = obj.matrix_world.copy()
        obj.parent = arm
        obj.matrix_world = world


def drop_helpers() -> None:
    keep = ("3ba", "femalehead", "head", "hands", "feet", "body")
    for obj in list(bpy.data.objects):
        n = obj.name.lower()
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        if obj.type == "EMPTY" and ("collision" in n or "bhk" in n or "bsx" in n):
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        if obj.type != "MESH":
            continue
        verts = len(obj.data.vertices)
        helper = (
            n == "cube"
            or n.endswith(":bbx")
            or "bbx" in n
            or "bound" in n
            or "collision" in n
            or (verts <= 32 and not any(k in n for k in keep))
        )
        if helper:
            print("drop helper mesh", obj.name, "verts", verts)
            bpy.data.objects.remove(obj, do_unlink=True)


def name_latest_action(want: str) -> None:
    if not bpy.data.actions:
        return
    act = bpy.data.actions[-1]
    act.name = want


def push_nla(arm) -> None:
    if not bpy.data.actions:
        return
    if not arm.animation_data:
        arm.animation_data_create()
    while arm.animation_data.nla_tracks:
        arm.animation_data.nla_tracks.remove(arm.animation_data.nla_tracks[0])
    for act in bpy.data.actions:
        track = arm.animation_data.nla_tracks.new()
        track.name = act.name
        track.strips.new(act.name, int(act.frame_range[0]), act)
