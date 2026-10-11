import io
import json
import re

import pytest
from PIL import Image

from storage import HISTORY_LIMIT, Storage, kind_for, slugify


def png_bytes(w=64, h=48, color=(200, 40, 90)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "PNG")
    return buf.getvalue()


def test_slugify():
    assert slugify("A Woman in Red, smiling!") == "a-woman-in-red-smiling"
    assert slugify("") == "untitled"
    assert len(slugify("word " * 30)) <= 40


def test_kind_for():
    assert kind_for(".png") == "image"
    assert kind_for(".mp4") == "video"
    assert kind_for(".gif") == "animation"
    assert kind_for(".webp", "animation") == "animation"
    assert kind_for(".webp") == "image"


def test_save_image_creates_file_sidecar_and_thumb(tmp_path):
    s = Storage(tmp_path)
    rec = s.save(png_bytes(), ".png", {"mode": "txt2img", "prompt": "A test Portrait", "seed": 42, "steps": 5})
    assert re.fullmatch(r"\d{8}-\d{6}_txt2img_a-test-portrait_42\.png", rec["file"]), rec["file"]
    assert (tmp_path / rec["file"]).read_bytes() == png_bytes()
    side = json.loads((tmp_path / rec["file"]).with_suffix(".json").read_text())
    assert side["prompt"] == "A test Portrait" and side["seed"] == 42 and side["kind"] == "image"
    assert rec["width"] == 64 and rec["height"] == 48
    assert rec["url"].endswith(rec["file"]) and "download=1" in rec["download_url"]
    assert rec["thumb_url"] and (tmp_path / ".thumbs" / (rec["file"][:-4] + ".jpg")).exists()
    # A second save with the same prompt/seed in the same second gets a unique name.
    rec2 = s.save(png_bytes(), ".png", {"mode": "txt2img", "prompt": "A test Portrait", "seed": 42})
    assert rec2["file"] != rec["file"]


def test_video_without_poster_has_no_thumb_but_with_poster_does(tmp_path):
    s = Storage(tmp_path)
    rec = s.save(b"\x00\x00\x00\x18ftypmp42", ".mp4", {"mode": "img2vid", "prompt": "zoom", "seed": 1})
    assert rec["kind"] == "video" and rec["thumb_url"] is None
    rec2 = s.save(b"\x00\x00\x00\x18ftypmp42", ".mp4", {"mode": "img2vid", "prompt": "zoom", "seed": 2}, poster=png_bytes())
    assert rec2["thumb_url"] and s.thumb_path(rec2["file"]).exists()


def test_list_newest_first_and_kind_filter(tmp_path):
    import os, time
    s = Storage(tmp_path)
    a = s.save(png_bytes(), ".png", {"mode": "txt2img", "prompt": "one", "seed": 1})
    b = s.save(b"\x00\x00\x00\x18ftypmp42", ".mp4", {"mode": "img2vid", "prompt": "two", "seed": 2})
    os.utime(tmp_path / b["file"], (time.time() + 5, time.time() + 5))
    items = s.list_items()["items"]
    assert [i["file"] for i in items] == [b["file"], a["file"]]
    assert [i["file"] for i in s.list_items(kind="image")["items"]] == [a["file"]]
    assert s.list_items(limit=1, offset=1)["items"][0]["file"] == a["file"]


@pytest.mark.parametrize("bad", ["../app.py", "a/b.png", ".hidden.png", "", "..", "x\\y.png", "name with space.png"])
def test_resolve_rejects_unsafe_names(tmp_path, bad):
    s = Storage(tmp_path)
    with pytest.raises(ValueError):
        s.resolve(bad)


def test_delete_removes_media_sidecar_and_thumb(tmp_path):
    s = Storage(tmp_path)
    rec = s.save(png_bytes(), ".png", {"mode": "txt2img", "prompt": "bye", "seed": 3})
    s.delete(rec["file"])
    assert not any(tmp_path.glob("*bye*")) and not list((tmp_path / ".thumbs").iterdir())
    s.delete(rec["file"])  # idempotent


def test_history_dedupes_and_keeps_last_20(tmp_path):
    s = Storage(tmp_path)
    for i in range(25):
        s.add_history({"mode": "txt2img", "prompt": f"p{i}", "negative": ""})
    items = s.history()
    assert len(items) == HISTORY_LIMIT and items[0]["prompt"] == "p24"
    s.add_history({"mode": "txt2img", "prompt": "p20", "negative": ""})
    assert s.history()[0]["prompt"] == "p20" and sum(1 for i in s.history() if i["prompt"] == "p20") == 1
    s.clear_history()
    assert s.history() == []


def test_slugify_folds_accents():
    assert slugify("café élégante") == "cafe-elegante"


def test_video_filter_includes_animations_and_history_is_atomic(tmp_path):
    s = Storage(tmp_path)
    s.save(png_bytes(), ".png", {"mode": "txt2img", "prompt": "img", "seed": 1})
    s.save(b"RIFF....WEBP", ".webp", {"mode": "img2vid", "prompt": "anim", "seed": 2, "kind": "animation"})
    s.save(b"\x00\x00\x00\x18ftypmp42", ".mp4", {"mode": "img2vid", "prompt": "vid", "seed": 3})
    kinds = sorted(i["kind"] for i in s.list_items(kind="video")["items"])
    assert kinds == ["animation", "video"]
    assert [i["kind"] for i in s.list_items(kind="image")["items"]] == ["image"]
    s.add_history({"mode": "txt2img", "prompt": "p", "negative": ""})
    assert s.history()[0]["prompt"] == "p" and not list(tmp_path.glob("*.part"))


def test_list_items_survives_files_vanishing_and_uses_cache(tmp_path):
    s = Storage(tmp_path)
    a = s.save(png_bytes(), ".png", {"mode": "txt2img", "prompt": "a", "seed": 1})
    first = s.list_items()["items"]
    assert first[0]["file"] == a["file"]
    assert s.list_items()["items"][0] is first[0]  # cached record object reused
    (tmp_path / a["file"]).unlink()
    assert s.list_items()["total"] == 0
