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


def _head_pose_bone(arm):
    for b in arm.pose.bones:
        key = b.name.replace(" ", "_").replace("[", "_").replace("]", "")
        if key in {"NPC_Head_Head", "NPC_Head__Head", "Head"}:
            return b
    for b in arm.pose.bones:
        if "Head" in b.name and "NPC" in b.name and "Magic" not in b.name and "Prey" not in b.name:
            return b
    return None


def bake_facegen_to_head_bone(arm) -> int:
    """Facegeom is authored in NPC Head local space; the game multiplies by that node.

    After PyNifly + body IBMs, facegeom sits near the origin while the 3BA body is
    already armature-space. Bake a single translation so the head neck stump meets
    the 3BA neck top (same outfit meshes the ESP would attach under NPC Head).

    PyNifly also leaves a local translation on the head NiTriShape while eyes/brows
    stay at identity — share that transform before flattening so cards stay on face.
    """
    import mathutils

    ensure_object_mode()
    pb = _head_pose_bone(arm)
    if pb is None:
        print("WARN: bake_facegen — no NPC Head bone on skeleton")
        return 0

    # Rest pose attach point from XPMSE / reference skeleton (mod-relevant data).
    head_loc = (arm.matrix_world @ pb.bone.matrix_local).to_translation()
    # Facegeom import is still Skyrim Z-up here; after glTF it becomes Y-up.
    use_z_up = abs(head_loc.z) >= abs(head_loc.y)

    def up_of(v) -> float:
        return float(v.z if use_z_up else v.y)

    body_max_up = -1e9
    for obj in bpy.data.objects:
        if obj.type != "MESH" or "3ba" not in obj.name.lower():
            continue
        bbox = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
        body_max_up = max(body_max_up, max(up_of(v) for v in bbox))
    if body_max_up < -1e8:
        print("WARN: bake_facegen — no 3BA body")
        return 0

    head_names = {
        pb.name,
        pb.name.replace(" ", "_"),
        "NPC Head [Head]",
        "NPC_Head_Head",
    }

    def is_head_weighted(obj) -> bool:
        if not obj.vertex_groups:
            return False
        vg_names = {g.name for g in obj.vertex_groups}
        if vg_names & head_names:
            return True
        return any(("Head" in n and "NPC" in n) for n in vg_names)

    # Eyes/brows/mouth are often weighted to Eye/etc bones, not NPC Head.
    def is_facegen_part(obj) -> bool:
        n = obj.name.lower()
        if any(k in n for k in ("3ba", "underwear", "armor", "boot", "glove", "hand", "foot")):
            return False
        if any(
            k in n
            for k in (
                "_xcx",
                "femalehead",
                "femaleeyes",
                "femalebrows",
                "femalemouth",
                "mouthhumanoid",
                "hairline",
                "hairfemale",
            )
        ):
            return True
        if is_head_weighted(obj) and "head" in n and "hair" not in n:
            return True
        return False

    # Collapse PyNifly per-shape object locs into verts (keeps facegeom relatives).
    # Head NiTriShape often carries an extra local translation while eyes/brows/mouth
    # stay at identity under BSFaceGenNiNode. Apply the head shape's local matrix to
    # those siblings first so they share the same attach space, then bake to verts.
    face_objs = [o for o in list(bpy.data.objects) if o.type == "MESH" and is_facegen_part(o)]

    def mesh_world_center(obj):
        """Vertex average (not bbox) — facegeom mass sits with eyes, not skull tip."""
        mat = obj.matrix_world
        acc = mathutils.Vector((0.0, 0.0, 0.0))
        verts = obj.data.vertices
        if not verts:
            return acc
        for v in verts:
            acc += mat @ v.co
        return acc / len(verts)

    head_for_xf = None
    for obj in face_objs:
        n = obj.name.lower()
        if "_xcxfemalehead" in n or n.endswith("femalehead") or n == "femalehead":
            head_for_xf = obj
            break
    if head_for_xf is not None:
        head_ml = head_for_xf.matrix_local.copy()
        head_t = head_ml.to_translation()
        if abs(head_t.x) + abs(head_t.y) + abs(head_t.z) > 1e-3:
            for obj in face_objs:
                if obj == head_for_xf:
                    continue
                t = obj.matrix_local.to_translation()
                # Only siblings left at identity — hair often has its own huge offset.
                if abs(t.x) + abs(t.y) + abs(t.z) > 1e-3:
                    continue
                obj.matrix_local = head_ml @ obj.matrix_local
                print(
                    "  facegen share head xf",
                    obj.name,
                    f"-> ({head_t.x:.2f},{head_t.y:.2f},{head_t.z:.2f})",
                )
            bpy.context.view_layer.update()

    for obj in face_objs:
        ml = obj.matrix_local.copy()
        loc = ml.to_translation()
        if abs(loc.x) + abs(loc.y) + abs(loc.z) > 1e-4:
            print(
                "  apply facegen loc",
                obj.name,
                f"({loc.x:.2f},{loc.y:.2f},{loc.z:.2f})",
            )
        # Clear channels first, then bake old local matrix into verts.
        obj.location = (0.0, 0.0, 0.0)
        obj.rotation_euler = (0.0, 0.0, 0.0)
        obj.scale = (1.0, 1.0, 1.0)
        bpy.context.view_layer.update()
        obj.data.transform(ml)
        obj.data.update()
        bpy.context.view_layer.update()

    # Prefer the main head mesh as the attach reference (not hair/eye cluster).
    head_mesh = None
    for obj in face_objs:
        if not is_head_weighted(obj):
            continue
        n = obj.name.lower()
        if "femalehead" in n or n.endswith("head") or "_xcxfemalehead" in n:
            head_mesh = obj
            break
    if head_mesh is None:
        for obj in face_objs:
            if is_head_weighted(obj) and "head" in obj.name.lower() and "hair" not in obj.name.lower():
                head_mesh = obj
                break
    if head_mesh is None:
        print("WARN: bake_facegen — no head mesh")
        return 0

    head_c = mesh_world_center(head_mesh)
    if up_of(head_c) >= body_max_up * 0.55:
        print(
            "bake_facegen skip — head already body-space",
            head_mesh.name,
            f"up={up_of(head_c):.1f}",
        )
        return 0

    def axis_rim(obj, take_high: bool):
        """Neck collar: verts near the vertical axis, lowest or highest band."""
        pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
        # Lateral distance in the plane orthogonal to up.
        def radial(p):
            if use_z_up:
                return (p.x * p.x + p.y * p.y) ** 0.5
            return (p.x * p.x + p.z * p.z) ** 0.5

        near = [p for p in pts if radial(p) < 8.0]
        if len(near) < 16:
            near = pts
        near.sort(key=up_of)
        n = max(24, len(near) // 20)
        band = near[-n:] if take_high else near[:n]
        acc = mathutils.Vector((0.0, 0.0, 0.0))
        for p in band:
            acc += p
        return acc / len(band)

    body = next((o for o in bpy.data.objects if o.type == "MESH" and o.name.lower() == "3ba"), None)
    if body is None:
        # Fallback: NPC Head bone (engine attach) if body missing.
        delta = head_loc - head_c
        print(
            f"bake_facegen head={head_mesh.name} bone={pb.name} "
            f"(no 3BA) delta=({delta.x:.1f},{delta.y:.1f},{delta.z:.1f})"
        )
    else:
        # Neck stump → body neck top (same outfit). Keeps eyes/facegen relatives.
        head_neck = axis_rim(head_mesh, False)
        body_neck = axis_rim(body, True)
        delta = body_neck - head_neck

        # Nudge forward by neck radius so the stump sits into the collar, not behind it.
        def neck_radius(obj, rim_c) -> float:
            """Median radius of the neck stump ring about rim_c (outfit mesh data)."""
            rs = []
            for v in obj.data.vertices:
                p = obj.matrix_world @ v.co
                if abs(up_of(p) - up_of(rim_c)) > 4.0:
                    continue
                if use_z_up:
                    rr = ((p.x - rim_c.x) ** 2 + (p.y - rim_c.y) ** 2) ** 0.5
                else:
                    rr = ((p.x - rim_c.x) ** 2 + (p.z - rim_c.z) ** 2) ** 0.5
                if 0.5 < rr < 10.0:
                    rs.append(rr)
            if not rs:
                return 3.5
            rs.sort()
            return float(rs[len(rs) // 2])

        radius = neck_radius(head_mesh, head_neck)
        # Skyrim Z-up: character forward is +Y; Y-up export path uses -Z.
        forward = (
            mathutils.Vector((0.0, 1.0, 0.0))
            if use_z_up
            else mathutils.Vector((0.0, 0.0, -1.0))
        )
        down = (
            mathutils.Vector((0.0, 0.0, -1.0))
            if use_z_up
            else mathutils.Vector((0.0, -1.0, 0.0))
        )
        fwd_amt = radius * 1.3
        down_amt = radius * 0.2
        delta = delta + forward * fwd_amt + down * down_amt
        print(
            f"bake_facegen head={head_mesh.name} neck→3BA "
            f"up={'Z' if use_z_up else 'Y'} "
            f"head_neck=({head_neck.x:.1f},{head_neck.y:.1f},{head_neck.z:.1f}) "
            f"body_neck=({body_neck.x:.1f},{body_neck.y:.1f},{body_neck.z:.1f}) "
            f"forward={fwd_amt:.1f} down={down_amt:.1f} "
            f"delta=({delta.x:.1f},{delta.y:.1f},{delta.z:.1f})"
        )

    n = 0
    for obj in face_objs:
        c = mesh_world_center(obj)
        if up_of(c) >= body_max_up * 0.55:
            continue
        mw = obj.matrix_world.to_3x3().inverted_safe()
        local = mw @ delta
        for v in obj.data.vertices:
            v.co += local
        obj.data.update()
        print("  baked", obj.name, f"up={up_of(c):.1f}")
        n += 1
    return n


# Back-compat alias
lift_misplaced_facegen = bake_facegen_to_head_bone


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
