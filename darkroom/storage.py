"""
Local storage: the ./outputs gallery, thumbnails and the prompt history.

Everything Darkroom produces is written to one folder on this machine
(``darkroom/outputs`` by default, ``--outputs`` to change it):

    outputs/
      20260411-213055_txt2img_a-woman-in-red_123456.png   the result
      20260411-213055_txt2img_a-woman-in-red_123456.json  its settings (prompt, seed, ...)
      .thumbs/20260411-213055_txt2img_a-woman-in-red_123456.jpg   small preview
      history.json                                         last 20 prompts

Filenames are ``<timestamp>_<mode>_<prompt snippet>_<seed>.<ext>`` so a plain
file browser already tells you what each file is.  The JSON sidecar lets the
gallery show the full prompt and lets "reuse settings" restore everything.
"""
from __future__ import annotations

import io
import json
import os
import re
import threading
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    from PIL import Image
except ImportError:  # pragma: no cover - Pillow is in requirements.txt
    Image = None  # type: ignore[assignment]

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
VIDEO_EXT = {".mp4", ".webm", ".mov", ".mkv", ".m4v"}
ANIMATION_EXT = {".gif"}  # shown with <img>, like an animated webp
MEDIA_EXT = IMAGE_EXT | VIDEO_EXT | ANIMATION_EXT

THUMB_SIZE = 400
HISTORY_LIMIT = 20
_SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


class StorageError(Exception):
    """A file could not be removed or written (locked, permissions...)."""


def slugify(text: str, max_len: int = 40) -> str:
    # Fold accents to ASCII (café -> cafe) so file names stay portable across OSes and shells.
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if len(text) > max_len:
        text = text[:max_len].rsplit("-", 1)[0] or text[:max_len]
    return text or "untitled"


def kind_for(ext: str, hint: str | None = None) -> str:
    """image | video | animation, from the extension (or a hint from ComfyUI)."""
    ext = ext.lower()
    if ext in VIDEO_EXT:
        return "video"
    if ext in ANIMATION_EXT:
        return "animation"
    if hint in ("video", "animation") and ext in IMAGE_EXT:
        return hint  # e.g. SaveAnimatedWEBP -> animated .webp
    return "image"


class Storage:
    def __init__(self, root: Path):
        self.root = Path(root).resolve()
        self.thumbs = self.root / ".thumbs"
        self.history_path = self.root / "history.json"
        self.root.mkdir(parents=True, exist_ok=True)
        self.thumbs.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._records: dict[str, tuple[float, int, dict[str, Any]]] = {}  # name -> (mtime, size, record)

    # ---- naming / paths ------------------------------------------------------
    def resolve(self, name: str) -> Path:
        """Map a gallery file name to a path, refusing anything outside the folder."""
        if not name or not _SAFE_NAME.match(name) or ".." in name:
            raise ValueError("invalid file name")
        path = (self.root / name).resolve()
        if path.parent != self.root:
            raise ValueError("invalid file name")
        return path

    def new_name(self, mode: str, prompt: str, seed: int | None, ext: str) -> str:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        base = f"{stamp}_{mode}_{slugify(prompt)}"
        if seed is not None:
            base += f"_{seed}"
        name, n = f"{base}{ext}", 1
        while (self.root / name).exists() or (self.root / f"{Path(name).stem}.json").exists():
            n += 1
            name = f"{base}-{n}{ext}"
        return name

    # ---- writing -------------------------------------------------------------
    def save(self, data: bytes, ext: str, meta: dict[str, Any], poster: bytes | None = None) -> dict[str, Any]:
        """Write a result + sidecar + thumbnail and return its gallery record.

        ``poster`` is an optional image (bytes) used as the thumbnail for
        videos, e.g. the source frame of an image -> video job.
        """
        ext = ext.lower() if ext.startswith(".") else f".{ext.lower()}"
        kind = kind_for(ext, meta.get("kind"))
        with self._lock:
            name = self.new_name(str(meta.get("mode", "gen")), str(meta.get("label") or meta.get("prompt") or ""), meta.get("seed"), ext)
            path = self.root / name
            tmp = path.with_suffix(path.suffix + ".part")
            tmp.write_bytes(data)
            os.replace(tmp, path)

        record = dict(meta)
        record.update({"kind": kind, "file": name, "created": time.time(), "bytes": len(data)})
        if kind == "image" and Image is not None:
            try:
                with Image.open(io.BytesIO(data)) as im:
                    record["width"], record["height"] = im.size
            except Exception:
                pass
        self._write_sidecar(path, record)
        self._make_thumb(path, kind, poster)
        self._records.pop(path.name, None)
        return self.record(path)

    @staticmethod
    def _write_json_atomic(path: Path, data: Any) -> None:
        tmp = path.with_suffix(path.suffix + ".part")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)

    def _write_sidecar(self, path: Path, record: dict[str, Any]) -> None:
        self._write_json_atomic(path.with_suffix(".json"), record)

    def _make_thumb(self, path: Path, kind: str, poster: bytes | None) -> Path | None:
        if Image is None:
            return None
        out = self.thumbs / (path.stem + ".jpg")
        try:
            src = io.BytesIO(poster) if poster else (path if kind != "video" else None)
            if src is None:
                return None
            with Image.open(src) as im:
                im = im.convert("RGB")
                im.thumbnail((THUMB_SIZE, THUMB_SIZE))
                im.save(out, "JPEG", quality=82)
            return out
        except Exception:
            return None

    # ---- reading -------------------------------------------------------------
    def thumb_path(self, name: str) -> Path | None:
        path = self.resolve(name)
        out = self.thumbs / (path.stem + ".jpg")
        if out.exists():
            return out
        if not path.exists():
            return None
        kind = kind_for(path.suffix)
        if kind == "video":
            return None
        return self._make_thumb(path, kind, None)

    def record(self, path: Path, st: os.stat_result | None = None) -> dict[str, Any]:
        side = path.with_suffix(".json")
        rec: dict[str, Any] = {}
        try:
            rec = json.loads(side.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            rec = {}
        if not isinstance(rec, dict):
            rec = {}
        try:
            st = st or path.stat()
        except OSError:
            return {}
        kind = rec.get("kind") or kind_for(path.suffix)
        rec.update(
            {
                "file": path.name,
                "kind": kind,
                "created": rec.get("created") or st.st_mtime,
                "bytes": st.st_size,
                "url": f"/api/gallery/{path.name}",
                "download_url": f"/api/gallery/{path.name}?download=1",
                "thumb_url": f"/api/thumbs/{path.name}" if (kind != "video" or (self.thumbs / (path.stem + '.jpg')).exists()) else None,
            }
        )
        return rec

    def _cached_record(self, path: Path) -> dict[str, Any] | None:
        """record() with a per-file cache keyed on (mtime, size), so listing is cheap for big galleries."""
        try:
            st = path.stat()
        except OSError:
            return None  # deleted between iterdir() and here
        hit = self._records.get(path.name)
        if hit and hit[0] == st.st_mtime and hit[1] == st.st_size:
            return hit[2]
        rec = self.record(path, st)
        if rec:
            self._records[path.name] = (st.st_mtime, st.st_size, rec)
        return rec or None

    def list_items(self, limit: int = 60, offset: int = 0, kind: str | None = None) -> dict[str, Any]:
        entries = []
        for p in self.root.iterdir():
            if p.name.startswith(".") or p.suffix.lower() not in MEDIA_EXT:
                continue
            try:
                st = p.stat()
            except OSError:
                continue
            if not os.path.isfile(p):
                continue
            entries.append((st.st_mtime, p))
        entries.sort(key=lambda e: e[0], reverse=True)
        kinds = {"video", "animation"} if kind == "video" else ({kind} if kind else None)
        records = []
        for _, p in entries:
            rec = self._cached_record(p)
            if rec and (kinds is None or rec.get("kind") in kinds):
                records.append(rec)
        total = len(records)
        return {"items": records[offset: offset + limit], "total": total, "offset": offset, "limit": limit}

    def delete(self, name: str) -> None:
        path = self.resolve(name)
        self._records.pop(path.name, None)
        failed = []
        for p in (path, path.with_suffix(".json"), self.thumbs / (path.stem + ".jpg")):
            try:
                p.unlink()
            except FileNotFoundError:
                pass
            except OSError as e:  # e.g. Windows: the file is open in another program
                failed.append(f"{p.name}: {e.strerror or e}")
        if failed:
            raise StorageError("; ".join(failed))

    # ---- prompt history ------------------------------------------------------
    def history(self) -> list[dict[str, Any]]:
        try:
            data = json.loads(self.history_path.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
        except (OSError, json.JSONDecodeError):
            return []

    def add_history(self, entry: dict[str, Any]) -> None:
        with self._lock:
            items = self.history()
            key = (entry.get("mode"), (entry.get("prompt") or "").strip(), (entry.get("negative") or "").strip())
            items = [i for i in items if (i.get("mode"), (i.get("prompt") or "").strip(), (i.get("negative") or "").strip()) != key]
            items.insert(0, {**entry, "ts": time.time()})
            self._write_json_atomic(self.history_path, items[:HISTORY_LIMIT])

    def clear_history(self) -> None:
        with self._lock:
            try:
                self.history_path.unlink()
            except FileNotFoundError:
                pass
