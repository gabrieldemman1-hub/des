import json
from pathlib import Path

import pytest

from workflows import KNOWN_TOKENS, TemplateError, load_template, load_templates

ROOT = Path(__file__).resolve().parents[1]


def write(tmp_path: Path, name: str, data: dict) -> Path:
    p = tmp_path / name
    p.write_text(json.dumps(data), encoding="utf-8")
    return p


MINIMAL = {
    "_meta": {"name": "T", "mode": "txt2img", "model": {"node_class": "CheckpointLoaderSimple", "input": "ckpt_name"}},
    "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "{{MODEL}}"}},
    "3": {"class_type": "KSampler", "inputs": {"seed": "{{SEED}}", "steps": "{{STEPS}}", "cfg": "{{CFG}}", "model": ["4", 0]}},
    "6": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{PROMPT}}", "clip": ["4", 1]}},
    "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "darkroom/{{FILENAME_PREFIX}}_x", "images": ["3", 0]}},
}
VALUES = {"MODEL": "a.safetensors", "SEED": 7, "STEPS": 20, "CFG": 6.5, "PROMPT": "hello", "FILENAME_PREFIX": "img"}


def test_shipped_templates_load_cleanly():
    templates, problems = load_templates(ROOT / "workflows")
    assert problems == []
    assert {"txt2img_checkpoint", "img2vid_wan22_5b", "img2vid_wan21_14b", "img2vid_svd"} <= set(templates)
    for t in templates.values():
        assert t.tokens() <= set(KNOWN_TOKENS)
        pub = t.to_public()
        assert "graph" not in pub and pub["mode"] in ("txt2img", "img2vid")


def test_render_replaces_tokens_with_typed_values(tmp_path):
    t = load_template(write(tmp_path, "t.json", MINIMAL))
    graph = t.render(VALUES)
    assert "_meta" not in graph
    assert graph["3"]["inputs"]["seed"] == 7 and isinstance(graph["3"]["inputs"]["seed"], int)
    assert graph["3"]["inputs"]["cfg"] == 6.5 and isinstance(graph["3"]["inputs"]["cfg"], float)
    assert graph["4"]["inputs"]["ckpt_name"] == "a.safetensors"
    assert graph["9"]["inputs"]["filename_prefix"] == "darkroom/img_x"  # partial substitution
    assert graph["3"]["inputs"]["model"] == ["4", 0]  # links untouched
    # The template itself is not mutated.
    assert t.graph["3"]["inputs"]["seed"] == "{{SEED}}"


def test_render_missing_value_is_an_error(tmp_path):
    t = load_template(write(tmp_path, "t.json", MINIMAL))
    with pytest.raises(TemplateError, match="SEED"):
        t.render({k: v for k, v in VALUES.items() if k != "SEED"})


def test_unknown_token_rejected(tmp_path):
    bad = json.loads(json.dumps(MINIMAL))
    bad["6"]["inputs"]["text"] = "{{PROMT}}"
    with pytest.raises(TemplateError, match="PROMT"):
        load_template(write(tmp_path, "t.json", bad))


def test_bad_mode_and_missing_meta_rejected(tmp_path):
    bad = json.loads(json.dumps(MINIMAL))
    bad["_meta"]["mode"] = "video"
    with pytest.raises(TemplateError, match="mode"):
        load_template(write(tmp_path, "t.json", bad))
    nometa = {k: v for k, v in MINIMAL.items() if k != "_meta"}
    with pytest.raises(TemplateError, match="_meta"):
        load_template(write(tmp_path, "t2.json", nometa))


def test_non_api_format_rejected(tmp_path):
    ui_format = {"_meta": {"mode": "txt2img"}, "nodes": [{"id": 1}], "links": []}
    with pytest.raises(TemplateError, match="Export"):
        load_template(write(tmp_path, "t.json", ui_format))


def test_img2vid_requires_image_token(tmp_path):
    bad = json.loads(json.dumps(MINIMAL))
    bad["_meta"]["mode"] = "img2vid"
    with pytest.raises(TemplateError, match="IMAGE"):
        load_template(write(tmp_path, "t.json", bad))


def test_broken_file_is_reported_not_fatal(tmp_path):
    write(tmp_path, "good.json", MINIMAL)
    (tmp_path / "broken.json").write_text("{not json", encoding="utf-8")
    write(tmp_path, "_disabled.json", {"nonsense": True})
    templates, problems = load_templates(tmp_path)
    assert set(templates) == {"good"}
    assert len(problems) == 1 and "broken.json" in problems[0]


def test_controls_follow_tokens():
    templates, _ = load_templates(ROOT / "workflows")
    svd = templates["img2vid_svd"]
    assert svd.controls["prompt"] is False and svd.controls["negative"] is False
    assert svd.controls["frames"] is True and svd.controls["size"] is True
    t2i = templates["txt2img_checkpoint"]
    assert t2i.controls["sampler"] is True and t2i.controls["frames"] is False
    assert t2i.model_selector == {"node_class": "CheckpointLoaderSimple", "input": "ckpt_name", "default": ""}
    wan = templates["img2vid_wan22_5b"]
    assert wan.model_selector["node_class"] == "UNETLoader"
    assert wan.constraints["frames_rule"] == "4n+1" and wan.constraints["size_step"] == 32
