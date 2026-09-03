"""Assemble Skyrim nifs + hkx into one glb. Invoked by run.mjs via Blender --background."""

from __future__ import annotations

import os
import sys

_here = os.path.dirname(os.path.abspath(__file__))
if _here not in sys.path:
    sys.path.insert(0, _here)

import bpy

from sky_export import export_glb, write_figure_json
from sky_job import argv_job, load_job, resolve
from sky_mats import flatten_skin_materials
from sky_nif import (
    discover_texture_roots,
    ensure_pynifly,
    import_hkx,
    import_nif,
    set_sky_texture_roots,
)
from sky_scene import (
    armatures,
    bake_facegen_to_head_bone,
    drop_helpers,
    dump_scene,
    join_to_master,
    name_latest_action,
    parent_skins_to_armature,
    push_nla,
    select_armature,
)


def main() -> None:
    job_path = os.path.abspath(argv_job())
    job_dir = os.path.dirname(job_path)
    job = load_job(job_path)
    repo = os.path.abspath(os.path.join(_here, "..", ".."))
    os.chdir(repo)
    mod_root = job.get("modRoot") or ""
    if mod_root and not os.path.isabs(mod_root):
        mod_root = os.path.normpath(os.path.join(repo, mod_root))

    roots = [
        job.get("gameData") or "",
        job.get("mo2Mods") or "",
        mod_root,
        repo,
        job_dir,
    ]

    body = resolve(job_dir, roots, job.get("body") or "")
    if not body:
        raise SystemExit("body nif not found; set outfit.json body (MO2 3BA femalebody_1.nif)")

    extras = []
    for key in ("head", "hands", "feet"):
        p = resolve(job_dir, roots, job.get(key) or "")
        if p:
            extras.append(p)
    for c in job.get("clothes") or []:
        p = resolve(job_dir, roots, str(c))
        if p:
            extras.append(p)
        else:
            print("WARN: clothes missing", c)

    skel_nif = resolve(job_dir, roots, job.get("skeletonNif") or "")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    ensure_pynifly()
    tex_roots = discover_texture_roots(
        job.get("mo2Mods") or "",
        job.get("gameData") or "",
        [body, skel_nif or "", *extras],
    )
    set_sky_texture_roots(tex_roots)

    master = None
    if skel_nif:
        print("import skeleton", skel_nif)
        import_nif(skel_nif, create_bones=True, apply_skinning=True)
        master = armatures()[0] if armatures() else None
        if master:
            select_armature(master)
        else:
            print("WARN: skeleton nif produced no armature")
            dump_scene()

    print("import body", body)
    import_nif(
        body,
        create_bones=True,
        apply_skinning=True,
        reference_skel=skel_nif,
    )
    if master is None:
        master = armatures()[0] if armatures() else None
    if master is None:
        dump_scene()
        raise SystemExit(
            "no armature after body import (need apply_skinning + XPMSE skeleton_female.nif)"
        )
    select_armature(master)

    for p in extras:
        print("import", p)
        import_nif(
            p,
            create_bones=False,
            apply_skinning=True,
            reference_skel=skel_nif,
        )
        join_to_master(master)
        select_armature(master)

    parent_skins_to_armature(master)
    drop_helpers()
    # ESP/engine attach: facegeom is head-local; bake NPC Head rest from skeleton.
    baked = bake_facegen_to_head_bone(master)
    if baked:
        print("facegen baked to head bone", baked)

    skel_hkx = resolve(job_dir, roots, job.get("skeletonHkx") or "")
    gaits = job.get("gaits") or {}
    has_idle = False
    has_walk = False
    for name in ("idle", "walk", "cast"):
        p = resolve(job_dir, roots, gaits.get(name) or "")
        if not p:
            print("WARN: skip gait", name)
            continue
        if not skel_hkx:
            print("WARN: skip gait", name, "(need skeletonHkx, not nif)")
            continue
        print("hkx", name, p)
        select_armature(master)
        n_before = len(bpy.data.actions)
        import_hkx(p, skel_hkx)
        if len(bpy.data.actions) <= n_before:
            print("WARN: hkx import produced no action", name)
            continue
        name_latest_action(name)
        if name == "idle":
            has_idle = True
        elif name == "walk":
            has_walk = True

    push_nla(master)
    head_diffuse = resolve(job_dir, roots, job.get("headDiffuse") or "") or ""
    head_tint = resolve(job_dir, roots, job.get("headTint") or "") or ""
    flatten_skin_materials(
        tex_roots,
        head_diffuse=head_diffuse or None,
        head_tint=head_tint or None,
    )

    out_rel = (job.get("out") or "../co_der-resource/beat-roguelite/figures/skyrim-female/models/body.glb").replace("\\", "/")
    out = out_rel if os.path.isabs(out_rel) else os.path.normpath(os.path.join(repo, out_rel))
    export_glb(out)
    write_figure_json(
        out,
        has_idle,
        has_walk,
        pack_id=job.get("id") or "",
        caption=job.get("caption") or "",
        voices=job.get("voices") or "",
    )
    print("wrote", out)


if __name__ == "__main__":
    main()
