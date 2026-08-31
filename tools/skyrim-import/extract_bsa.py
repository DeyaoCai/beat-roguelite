"""Extract named files from Skyrim SE BSA (v104/v105)."""

from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path


COMPRESSED_TOGGLE = 0x40000000
SIZE_MASK = 0x3FFFFFFF


def _u32(b: bytes, o: int) -> int:
    return struct.unpack_from("<I", b, o)[0]


def _u64(b: bytes, o: int) -> int:
    return struct.unpack_from("<Q", b, o)[0]


def list_bsa(path: Path) -> list[tuple[str, int, int, bool]]:
    data = path.read_bytes()
    if data[:4] != b"BSA\x00":
        raise SystemExit(f"not a BSA: {path}")
    version = _u32(data, 4)
    archive_flags = _u32(data, 12)
    folder_count = _u32(data, 16)
    file_count = _u32(data, 20)
    folder_name_len = _u32(data, 24)
    file_name_len = _u32(data, 28)
    has_dir_names = bool(archive_flags & 0x1)
    has_file_names = bool(archive_flags & 0x2)
    compressed_default = bool(archive_flags & 0x4)
    rec_size = 24 if version >= 105 else 16
    pos = 36
    folders: list[tuple[int, int]] = []
    for _ in range(folder_count):
        count = _u32(data, pos + 8)
        off = _u64(data, pos + 16) if version >= 105 else _u32(data, pos + 12)
        folders.append((count, off))
        pos += rec_size

    def read_folder(count: int, start: int) -> tuple[str, list[tuple[int, int]], int]:
        p = start
        if has_dir_names:
            nlen = data[p]
            p += 1
            raw = data[p : p + nlen]
            p += nlen
            name = raw.split(b"\x00", 1)[0].decode("latin1").replace("/", "\\").lower()
        else:
            name = ""
        recs: list[tuple[int, int]] = []
        for _ in range(count):
            recs.append((_u32(data, p + 8), _u32(data, p + 12)))
            p += 16
        return name, recs, p

    def is_dir_name(name: str) -> bool:
        if not name or not all(32 <= ord(c) < 127 for c in name):
            return False
        head = name.split("\\", 1)[0]
        return head in {
            "scripts",
            "seq",
            "meshes",
            "sound",
            "interface",
            "strings",
            "textures",
            "music",
        } or name.startswith(("meshes", "sound", "scripts", "textures"))

    file_recs: list[tuple[int, int, int]] = []
    dir_names: list[str] = []
    # SSE folder offsets include the filename table; TES5 offsets are absolute.
    for count, off in folders:
        tried = [off]
        if version >= 105:
            tried = [off - file_name_len, off, off + file_name_len]
        name = None
        recs = None
        fallback = None
        for start in tried:
            if start < 0 or start >= len(data):
                continue
            try:
                cand_name, cand_recs, _end = read_folder(count, start)
            except Exception:
                continue
            if is_dir_name(cand_name):
                name, recs = cand_name, cand_recs
                break
            if fallback is None:
                fallback = (cand_name, cand_recs)
        if recs is None and fallback is not None:
            name, recs = fallback
        if recs is None:
            name, recs, _ = read_folder(count, pos)
        dir_names.append(name or "")
        for size, offset in recs:
            file_recs.append((size, offset, len(dir_names) - 1))

    name_off = 36 + folder_count * rec_size + folder_name_len + file_count * 16
    if has_dir_names:
        name_off += folder_count  # length bytes
    names: list[str] = [""] * file_count
    if has_file_names:
        blob = data[name_off : name_off + file_name_len]
        if blob.count(b"\x00") < file_count // 2:
            blob = data[pos : pos + file_name_len]
        i = 0
        for part in blob.split(b"\x00"):
            if i >= file_count:
                break
            if part:
                names[i] = part.decode("latin1").lower()
                i += 1

    print(
        "bsa",
        "ver",
        version,
        "files",
        file_count,
        "recs",
        len(file_recs),
        "names",
        sum(1 for n in names if n),
        "namedirs",
        sum(1 for n in dir_names if n),
    )

    out: list[tuple[str, int, int, bool]] = []
    for i, (size, offset, di) in enumerate(file_recs):
        folder = dir_names[di] if di < len(dir_names) else ""
        name = names[i] if i < len(names) else f"file_{i}"
        rel = f"{folder}\\{name}" if folder else name
        toggled = bool(size & COMPRESSED_TOGGLE)
        compressed = (not toggled) if compressed_default else toggled
        out.append((rel.replace("/", "\\").lower(), size & SIZE_MASK, offset, compressed))
    return out


def extract_one(archive: Path, rec: tuple[str, int, int, bool], dest: Path) -> None:
    _rel, size, offset, compressed = rec
    data = archive.read_bytes()
    blob = data[offset : offset + size]
    if compressed:
        if len(blob) < 4:
            raise SystemExit(f"truncated compressed file {_rel}")
        uncomp = _u32(blob, 0)
        payload = blob[4:]
        try:
            import lz4.frame

            blob = lz4.frame.decompress(payload)
        except Exception:
            blob = zlib.decompress(payload)
        if uncomp and len(blob) != uncomp:
            print("WARN:", _rel, "uncompressed", len(blob), "expected", uncomp)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(blob)
    print("extracted", dest, "bytes", len(blob), "magic", blob[:4].hex(), "ver", _u32(blob, 0x0C) if len(blob) > 16 else None)


def pick(records: list[tuple[str, int, int, bool]], suffix: str) -> tuple[str, int, int, bool] | None:
    want = suffix.replace("/", "\\").lower()
    hits = [r for r in records if r[0].endswith(want) or r[0] == want]
    return hits[0] if hits else None


def main() -> None:
    if len(sys.argv) < 4:
        raise SystemExit("usage: extract_bsa.py <archive.bsa> <out-dir> <rel> [<rel> ...]")
    archive = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    wanted = sys.argv[3:]
    recs = list_bsa(archive)
    for rel in wanted:
        hit = pick(recs, rel)
        if not hit:
            print("MISSING", rel)
            # close matches
            tail = rel.replace("/", "\\").lower().rsplit("\\", 1)[-1]
            close = [r[0] for r in recs if tail in r[0]][:12]
            for c in close:
                print("  close", c)
            continue
        dest = out_dir / Path(hit[0].replace("\\", "/")).name
        extract_one(archive, hit, dest)


if __name__ == "__main__":
    main()
