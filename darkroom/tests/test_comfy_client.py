import asyncio

import pytest

from comfy_client import ComfyClient, OutputFile, classify_output


def test_choices_from_info_handles_all_schemas():
    classic = {"input": {"required": {"ckpt_name": [["a.safetensors", "b.safetensors"], {"tooltip": "x"}]}}}
    classic_bare = {"input": {"required": {"unet_name": [["wan.safetensors"]]}}}
    v3 = {"input": {"required": {"sampler_name": ["COMBO", {"options": ["euler", "uni_pc"], "default": "euler"}]}}}
    optional_only = {"input": {"required": {}, "optional": {"lora_name": [{"options": ["l1.safetensors"]}]}}}
    assert ComfyClient.choices_from_info(classic, "ckpt_name") == ["a.safetensors", "b.safetensors"]
    assert ComfyClient.choices_from_info(classic_bare, "unet_name") == ["wan.safetensors"]
    assert ComfyClient.choices_from_info(v3, "sampler_name") == ["euler", "uni_pc"]
    assert ComfyClient.choices_from_info(optional_only, "lora_name") == ["l1.safetensors"]
    assert ComfyClient.choices_from_info({}, "ckpt_name") == []
    assert ComfyClient.choices_from_info({"input": {"required": {"steps": ["INT", {"default": 20}]}}}, "steps") == []


def test_outputs_from_history_covers_every_save_node_shape():
    entry = {
        "outputs": {
            "9": {"images": [{"filename": "img_00001_.png", "subfolder": "darkroom", "type": "output", "metadata": {"kind": "image"}}]},
            "10": {"images": [{"filename": "ComfyUI_temp_x_00001_.png", "subfolder": "", "type": "temp"}]},
            "12": {"images": [{"filename": "clip_00001_.mp4", "subfolder": "darkroom", "type": "output"}], "animated": [True]},
            "13": {"images": [{"filename": "anim_00001_.webp", "subfolder": "", "type": "output"}], "animated": [True]},
            "14": {"gifs": [{"filename": "vhs_00001.mp4", "subfolder": "", "type": "output", "format": "video/h264-mp4", "frame_rate": 16}]},
            "15": {"text": ["not a file"], "unfinished_batch": [True]},
        }
    }
    outs = ComfyClient.outputs_from_history(entry)
    by_name = {o.filename: o for o in outs}
    assert "ComfyUI_temp_x_00001_.png" not in by_name  # temp previews are dropped when real outputs exist
    assert by_name["img_00001_.png"].kind == "image" and by_name["img_00001_.png"].subfolder == "darkroom"
    assert by_name["clip_00001_.mp4"].kind == "video"
    assert by_name["anim_00001_.webp"].kind == "animation"
    assert by_name["vhs_00001.mp4"].kind == "video" and by_name["vhs_00001.mp4"].extra["format"] == "video/h264-mp4"
    assert len(outs) == 4
    # Only a PreviewImage: fall back to the temp file rather than reporting nothing.
    only_temp = {"outputs": {"10": {"images": [{"filename": "p.png", "subfolder": "", "type": "temp"}]}}}
    assert [o.type for o in ComfyClient.outputs_from_history(only_temp)] == ["temp"]


def test_classify_output():
    assert classify_output("images", {"filename": "a.png"}) == "image"
    assert classify_output("images", {"filename": "a.mp4"}) == "video"
    assert classify_output("images", {"filename": "a.webp", "animated": True}) == "animation"
    assert classify_output("gifs", {"filename": "a.gif", "format": "image/gif"}) == "animation"
    assert classify_output("gifs", {"filename": "a.webm", "format": "video/webm"}) == "video"


def test_rejection_message_and_hints():
    c = ComfyClient("http://127.0.0.1:1")
    body = {"error": {"type": "prompt_outputs_failed_validation", "message": "Prompt outputs failed validation", "details": "", "extra_info": {}},
            "node_errors": {"4": {"errors": [{"type": "value_not_in_list", "message": "Value not in list", "details": "ckpt_name: 'x' not in (list of length 37)", "extra_info": {}}], "dependent_outputs": ["9"], "class_type": "CheckpointLoaderSimple"}}}
    err = c._rejection(body, {})
    assert "CheckpointLoaderSimple (node 4)" in err.message and "not in (list of length 37)" in err.message
    assert "not installed" in err.hint
    missing = {"error": {"type": "missing_node_type", "message": "Node 'X' not found. The custom node may not be installed.", "details": "Node ID '#5'", "extra_info": {}}, "node_errors": {}}
    err = c._rejection(missing, {})
    assert "not found" in err.message and "Node ID" in err.message
    asyncio.run(c.aclose())


def test_execution_error_hints():
    oom = ComfyClient._error_from_message({"node_type": "KSampler", "exception_message": "Allocation on device\nThis error means you ran out of memory on your GPU.", "exception_type": "torch.OutOfMemoryError"})
    assert oom.message.startswith("KSampler failed") and "memory" in oom.hint.lower()
    interrupted = ComfyClient._error_from_history({"status": {"status_str": "error", "messages": [["execution_start", {}], ["execution_interrupted", {"prompt_id": "x"}]]}})
    assert interrupted.__class__.__name__ == "ComfyInterrupted"


def test_normalize_url_variants():
    assert ComfyClient.normalize_url("http://127.0.0.1:8188") == ("http://127.0.0.1:8188", "ws://127.0.0.1:8188/ws")
    assert ComfyClient.normalize_url("127.0.0.1:8188/") == ("http://127.0.0.1:8188", "ws://127.0.0.1:8188/ws")
    assert ComfyClient.normalize_url("localhost:8000") == ("http://localhost:8000", "ws://localhost:8000/ws")
    assert ComfyClient.normalize_url("https://host.local/comfy/") == ("https://host.local/comfy", "wss://host.local/comfy/ws")
    for bad in ("", "ftp://x", "http://"):
        with pytest.raises(ValueError):
            ComfyClient.normalize_url(bad)


def test_queue_position_counts_jobs_ahead(monkeypatch):
    c = ComfyClient("http://127.0.0.1:1")
    state = {"queue_running": [[1, "run", {}, {}, []]], "queue_pending": [[3, "b", {}, {}, []], [2, "a", {}, {}, []]]}

    async def fake_queue_state():
        return state

    monkeypatch.setattr(c, "queue_state", fake_queue_state)
    assert asyncio.run(c.queue_position("run")) == 0
    assert asyncio.run(c.queue_position("a")) == 1  # only the running job is ahead
    assert asyncio.run(c.queue_position("b")) == 2
    assert asyncio.run(c.queue_position("zzz")) is None
    state["queue_running"] = []
    assert asyncio.run(c.queue_position("a")) == 0 + 0 or asyncio.run(c.queue_position("a")) == 0
    asyncio.run(c.aclose())


def test_rejection_hints_for_missing_node_and_no_outputs():
    c = ComfyClient("http://127.0.0.1:1")
    missing = {"error": {"type": "missing_node_type", "message": "Node 'SaveVideo' not found. The custom node may not be installed.", "details": "Node ID '#14'", "extra_info": {}}, "node_errors": {}}
    assert "update it" in c._rejection(missing, {}).hint
    old_style = {"error": {"type": "invalid_prompt", "message": "Cannot execute because node SaveVideo does not exist.", "details": "Node ID '#14'", "extra_info": {}}, "node_errors": {}}
    assert "update it" in c._rejection(old_style, {}).hint
    no_out = {"error": {"type": "prompt_no_outputs", "message": "Prompt has no outputs", "details": "", "extra_info": {}}, "node_errors": {}}
    assert "SaveImage" in c._rejection(no_out, {}).hint
    asyncio.run(c.aclose())
