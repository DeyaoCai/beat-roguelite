"""Job file: resolve outfit.json paths against game / MO2 / repo."""

from __future__ import annotations

import json
import os
import sys


def argv_job() -> str:
    if "--" in sys.argv:
        rest = sys.argv[sys.argv.index("--") + 1 :]
        if rest:
            return rest[0]
    raise SystemExit("usage: blender --background --python assemble.py -- <outfit.json>")


def load_job(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def resolve(job_dir: str, roots: list[str], rel: str) -> str | None:
    rel = (rel or "").strip().replace("\\", "/")
    if not rel or rel.startswith("_"):
        return None
    if os.path.isabs(rel) and os.path.isfile(rel):
        return os.path.normpath(rel)
    candidates = [os.path.join(job_dir, rel), os.path.join(os.getcwd(), rel)]
    for root in roots:
        if root:
            candidates.append(os.path.join(root, rel))
    for c in candidates:
        n = os.path.normpath(c)
        if os.path.isfile(n):
            return n
    return None
