"""Extract Vie / Lite / Iru combat barks from loose FUZ files."""

from __future__ import annotations

import json
import shutil
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / ".cache"
KNIGHT = CACHE / "mod-src" / "knight" / "Shinen HolySee Knight SE 1.14"
VOICE_ROOT = KNIGHT / "sound" / "Voice" / "Shingcheng Follower.esp"

SISTERS = (
    ("holysee-vie", "SCHSVieVoice"),
    ("holysee-lite", "SCHSLiteVoice"),
    ("holysee-iru", "SCHSIruVoice"),
)

BUCKETS = {
    "kill": ("_Attack_",),
    "kill_elite": ("_Attack_",),
    "kill_boss": ("_Taunt_", "_Attack_"),
    "fever": ("_Taunt_", "_Attack_"),
    "wave_start": ("_Hello_", "_NormalToCombat_", "_NormalToAlert_"),
    "wave_clear": ("_CombatToNormal_", "_SCHSBye_", "_Hello_"),
}
CAP = 8


def find_ffmpeg() -> str | None:
    for cand in (
        shutil.which("ffmpeg"),
        str(CACHE / "ffmpeg" / "bin" / "ffmpeg.exe"),
    ):
        if cand and Path(cand).is_file():
            return cand
    nested = sorted((CACHE / "ffmpeg").glob("**/ffmpeg.exe")) if (CACHE / "ffmpeg").is_dir() else []
    return str(nested[0]) if nested else None


def split_fuz(src: Path, dest_xwm: Path) -> None:
    data = src.read_bytes()
    if data[:4] != b"FUZE":
        raise SystemExit(f"not FUZE: {src}")
    lip_size = struct.unpack_from("<I", data, 8)[0]
    payload = data[12 + lip_size :]
    dest_xwm.parent.mkdir(parents=True, exist_ok=True)
    dest_xwm.write_bytes(payload)


def convert_xwm(xwm: Path, dest: Path, ffmpeg: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        [ffmpeg, "-y", "-i", str(xwm), "-c:a", "libvorbis", "-q:a", "4", str(dest)],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise SystemExit(f"ffmpeg {xwm.name}: {r.stderr[-400:]}")


def pick(files: list[Path], needles: tuple[str, ...], cap: int) -> list[Path]:
    out: list[Path] = []
    seen: set[str] = set()
    for needle in needles:
        for p in files:
            key = p.name.lower()
            if needle.lower() not in key:
                continue
            if key in seen:
                continue
            seen.add(key)
            out.append(p)
            if len(out) >= cap:
                return out
    return out


def extract_sister(pack_id: str, voice_type: str, ffmpeg: str) -> None:
    src_dir = VOICE_ROOT / voice_type
    if not src_dir.is_dir():
        raise SystemExit(f"missing {src_dir}")
    fuzs = sorted(src_dir.glob("*.fuz"))
    out_dir = ROOT / "public" / "figures" / pack_id / "voices"
    work = CACHE / "knight-voices" / pack_id
    work.mkdir(parents=True, exist_ok=True)
    converted: dict[str, str] = {}
    lines: dict[str, list[str]] = {}
    n = 0
    for kind, needles in BUCKETS.items():
        picked = pick(fuzs, needles, CAP)
        names: list[str] = []
        for src in picked:
            stem = src.stem
            if stem not in converted:
                n += 1
                xwm = work / f"{stem}.xwm"
                ogg = out_dir / f"{stem}.ogg"
                split_fuz(src, xwm)
                convert_xwm(xwm, ogg, ffmpeg)
                converted[stem] = f"{stem}.ogg"
                print("ok", pack_id, stem)
            names.append(converted[stem])
        lines[kind] = names
    out_dir.mkdir(parents=True, exist_ok=True)
    catalog = out_dir / "voices.json"
    catalog.write_text(json.dumps({"lines": lines}, indent=2), encoding="utf-8")
    print("wrote", catalog, "files", n)


def main() -> None:
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise SystemExit("need ffmpeg in tools/skyrim-import/.cache/ffmpeg")
    if not VOICE_ROOT.is_dir():
        raise SystemExit(f"missing {VOICE_ROOT}")
    for pack_id, voice_type in SISTERS:
        extract_sister(pack_id, voice_type, ffmpeg)


if __name__ == "__main__":
    sys.exit(main() or 0)
