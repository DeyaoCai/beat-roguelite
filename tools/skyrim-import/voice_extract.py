"""Extract a small Sofia bark set from the follower BSA, convert FUZ → ogg/wav."""

from __future__ import annotations

import json
import shutil
import struct
import subprocess
import sys
from pathlib import Path

from extract_bsa import extract_one, list_bsa

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / ".cache"
SOFIA_BSA = CACHE / "mod-src" / "sofia" / "Data" / "SofiaFollower.bsa"
FUZ_DIR = CACHE / "voices-fuz"
XWM_DIR = CACHE / "voices-xwm"
OUT_DIR = ROOT / "public" / "figures" / "skyrim-female" / "voices"
CATALOG = OUT_DIR / "voices.json"
IDLE_CAP = 14


def find_ffmpeg() -> str | None:
    for cand in (
        shutil.which("ffmpeg"),
        str(CACHE / "ffmpeg" / "bin" / "ffmpeg.exe"),
    ):
        if cand and Path(cand).is_file():
            return cand
    win = Path.home() / "AppData" / "Local" / "Microsoft" / "WinGet" / "Packages"
    if win.is_dir():
        hits = sorted(win.glob("Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe"))
        if hits:
            return str(hits[-1])
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


def pick_idle(recs: list) -> list:
    seen: set[str] = set()
    out = []
    for rec in recs:
        name = Path(rec[0].replace("\\", "/")).name.lower()
        if not name.startswith("jjsofiaidledialogue") or not name.endswith(".fuz"):
            continue
        form = name.split("__")[-1].split("_")[0]
        if form in seen:
            continue
        seen.add(form)
        out.append((name, rec))
        if len(out) >= IDLE_CAP:
            break
    return out


def convert_xwm(xwm: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = find_ffmpeg()
    if ffmpeg:
        r = subprocess.run(
            [ffmpeg, "-y", "-i", str(xwm), "-c:a", "libvorbis", "-q:a", "4", str(dest)],
            capture_output=True,
            text=True,
        )
        if r.returncode != 0:
            raise SystemExit(f"ffmpeg {xwm.name}: {r.stderr[-400:]}")
        return
    wma = xwm.with_suffix(".wma")
    shutil.copyfile(xwm, wma)
    proj = Path(__file__).resolve().parent / "fuz2wav"
    wav = dest.with_suffix(".wav")
    r = subprocess.run(
        ["dotnet", "run", "--project", str(proj), "--", str(wma), str(wav)],
        capture_output=True,
    )
    if r.returncode != 0:
        err = (r.stderr or b"").decode("utf-8", "replace")[-800:]
        out = (r.stdout or b"").decode("utf-8", "replace")[-400:]
        raise SystemExit(f"fuz2wav {xwm.name}: {out}\n{err}")


def main() -> None:
    if not SOFIA_BSA.is_file():
        raise SystemExit(f"missing {SOFIA_BSA}")
    recs = list_bsa(SOFIA_BSA)
    picked = pick_idle(recs)
    if not picked:
        raise SystemExit("no Sofia idle FUZ in BSA")
    ext = ".ogg" if find_ffmpeg() else ".wav"
    files: list[str] = []
    FUZ_DIR.mkdir(parents=True, exist_ok=True)
    XWM_DIR.mkdir(parents=True, exist_ok=True)
    for i, (name, rec) in enumerate(picked, start=1):
        stem = f"idle_{i:02d}"
        fuz = FUZ_DIR / f"{stem}.fuz"
        extract_one(SOFIA_BSA, rec, fuz)
        xwm = XWM_DIR / f"{stem}.xwm"
        split_fuz(fuz, xwm)
        audio = OUT_DIR / f"{stem}{ext}"
        convert_xwm(xwm, audio)
        files.append(f"{stem}{ext}")
        print("ok", stem, name)
    lines = {
        k: list(files) for k in ("kill", "kill_elite", "kill_boss", "fever", "wave_start", "wave_clear")
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    CATALOG.write_text(json.dumps({"lines": lines}, indent=2), encoding="utf-8")
    print("wrote", CATALOG, "n", len(files))


if __name__ == "__main__":
    sys.exit(main() or 0)
