"""End-to-end: real Darkroom server + the mock ComfyUI, over real sockets."""
import io
import shutil
import socket
import sys
import threading
import time
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
import uvicorn
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "dev"))

from app import ALWAYS_NEGATIVE, create_app  # noqa: E402
from mock_comfyui import create_mock_app  # noqa: E402


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class ServerThread(threading.Thread):
    def __init__(self, app, port: int):
        super().__init__(daemon=True)
        self.server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))

    def run(self):
        self.server.run()

    def stop(self):
        self.server.should_exit = True
        self.join(timeout=10)


def wait_for(url: str, timeout: float = 15.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if httpx.get(url, timeout=1.0).status_code < 500:
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.1)
    raise RuntimeError(f"{url} did not come up")


@pytest.fixture(scope="module")
def env(tmp_path_factory):
    data = tmp_path_factory.mktemp("mock")
    outputs = tmp_path_factory.mktemp("outputs")
    mport, aport = free_port(), free_port()
    mock = ServerThread(create_mock_app(data, step_delay=0.01), mport)
    app = ServerThread(create_app(comfy_url=f"http://127.0.0.1:{mport}", outputs_dir=outputs), aport)
    mock.start()
    app.start()
    wait_for(f"http://127.0.0.1:{mport}/system_stats")
    wait_for(f"http://127.0.0.1:{aport}/api/status")
    client = httpx.Client(base_url=f"http://127.0.0.1:{aport}", timeout=30)
    yield SimpleNamespace(c=client, outputs=outputs, mock_url=f"http://127.0.0.1:{mport}", data=data)
    client.close()
    app.stop()
    mock.stop()


@pytest.fixture(scope="module")
def offline(tmp_path_factory):
    """A Darkroom pointed at a port where nothing listens."""
    aport = free_port()
    app = ServerThread(create_app(comfy_url=f"http://127.0.0.1:{free_port()}", outputs_dir=tmp_path_factory.mktemp("out2"), probe_urls=(f"http://127.0.0.1:{free_port()}",)), aport)
    app.start()
    wait_for(f"http://127.0.0.1:{aport}/api/status")
    client = httpx.Client(base_url=f"http://127.0.0.1:{aport}", timeout=30)
    yield client
    client.close()
    app.stop()


def png(w=320, h=200) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (120, 30, 60)).save(buf, "PNG")
    return buf.getvalue()


def run_job(c: httpx.Client, **data) -> dict:
    files = data.pop("files", None)
    r = c.post("/api/generate", data=data, files=files)
    assert r.status_code == 200, r.text
    job = r.json()
    deadline = time.time() + 60
    while time.time() < deadline:
        job = c.get(f"/api/jobs/{job['id']}").json()
        if not job["active"]:
            return job
        time.sleep(0.1)
    raise AssertionError("job did not finish")


# ---- tests -------------------------------------------------------------------
def test_status_and_options(env):
    s = env.c.get("/api/status").json()
    assert s["online"] is True and s["template_problems"] == [] and "Mock" in s["device"]["name"]
    o = env.c.get("/api/options").json()
    ids = [w["id"] for w in o["workflows"]]
    assert ids[0] == "img2vid_wan22_5b" or "txt2img_checkpoint" in ids
    assert o["models"]["CheckpointLoaderSimple.ckpt_name"] == ["mock_sdxl_v1.safetensors", "mock_illustrious_xl.safetensors", "mock_sd15.safetensors"]
    assert "uni_pc" in o["samplers"] and "karras" in o["schedulers"]
    assert [s["id"] for s in o["styles"]][0] == "none"


def test_txt2img_end_to_end(env):
    job = run_job(env.c, mode="txt2img", workflow="txt2img_checkpoint", prompt="A quiet Portrait", negative="blurry", steps="4", cfg="5.5", width="500", height="770", style="cinematic", seed="12345")
    assert job["status"] == "done", job.get("error")
    p = job["params"]
    assert p["seed"] == 12345 and p["random_seed"] is False
    assert p["width"] % 8 == 0 and p["height"] % 8 == 0
    assert "cinematic still" in p["final_prompt"] and p["final_prompt"].startswith("A quiet Portrait")
    assert p["final_negative"].startswith("blurry") and p["final_negative"].endswith(ALWAYS_NEGATIVE)
    assert p["model"] == "mock_sdxl_v1.safetensors"
    (rec,) = job["results"]
    assert rec["kind"] == "image" and rec["file"].endswith("_12345.png") and "_txt2img_a-quiet-portrait_" in rec["file"]
    path = env.outputs / rec["file"]
    assert path.exists() and path.with_suffix(".json").exists() and (env.outputs / ".thumbs" / (path.stem + ".jpg")).exists()
    assert rec["width"] == p["width"] and rec["height"] == p["height"]
    # ComfyUI's own copy went to output/darkroom/
    assert list((env.data / "output" / "darkroom").glob("txt2img_*.png"))
    # download + thumb + meta endpoints
    r = env.c.get(rec["download_url"])
    assert r.status_code == 200 and r.headers["content-type"] == "image/png" and rec["file"] in r.headers["content-disposition"]
    assert env.c.get(rec["url"]).headers.get("content-disposition") is None
    assert env.c.get(rec["thumb_url"]).headers["content-type"] == "image/jpeg"
    assert env.c.get(f"/api/gallery/{rec['file']}/meta").json()["seed"] == 12345
    # gallery + history
    g = env.c.get("/api/gallery").json()
    assert g["total"] >= 1 and g["items"][0]["file"] == rec["file"]
    h = env.c.get("/api/history").json()["items"]
    assert h[0]["prompt"] == "A quiet Portrait" and h[0]["seed"] == 12345 and h[0]["style"] == "cinematic"


def test_clipskip_preset_and_pony_style(env):
    job = run_job(env.c, mode="txt2img", workflow="txt2img_checkpoint_clipskip2", prompt="portrait", steps="1", style="pony")
    assert job["status"] == "done", job.get("error")
    assert job["params"]["final_prompt"].startswith("score_9, score_8_up") and job["params"]["final_prompt"].endswith("portrait")
    assert job["params"]["sampler"] == "euler_ancestral"


def test_random_seed_when_empty(env):
    a = run_job(env.c, mode="txt2img", workflow="txt2img_checkpoint", prompt="seed test", steps="1")
    b = run_job(env.c, mode="txt2img", workflow="txt2img_checkpoint", prompt="seed test", steps="1", seed="-1")
    assert a["params"]["random_seed"] and b["params"]["random_seed"] and a["params"]["seed"] != b["params"]["seed"]
    # Same prompt twice -> one history entry (deduped), newest first.
    assert sum(1 for i in env.c.get("/api/history").json()["items"] if i["prompt"] == "seed test") == 1


def test_img2vid_from_gallery_image(env):
    src = env.c.get("/api/gallery?kind=image").json()["items"][0]
    job = run_job(env.c, mode="img2vid", workflow="img2vid_wan22_5b", prompt="slow push in", steps="2", frames="18", fps="8", width="650", height="370", source=src["file"])
    assert job["status"] == "done", job.get("error")
    p = job["params"]
    assert p["frames"] == 17 and p["width"] % 32 == 0 and p["height"] % 32 == 0 and p["source_image"] == src["file"]
    (rec,) = job["results"]
    ext = ".mp4" if shutil.which("ffmpeg") else ".webp"
    assert rec["file"].endswith(ext) and rec["kind"] in ("video", "animation")
    assert rec["thumb_url"] and (env.outputs / ".thumbs" / (Path(rec["file"]).stem + ".jpg")).exists()  # poster from the source
    # the source image was uploaded into ComfyUI/input/darkroom/
    assert list((env.data / "input" / "darkroom").glob(f"darkroom_{job['id']}*"))
    assert env.c.get("/api/gallery?kind=video").json()["items"][0]["file"] == rec["file"] or ext == ".webp"


def test_img2vid_wan22_14b_two_stage(env):
    src = env.c.get("/api/gallery?kind=image").json()["items"][0]
    job = run_job(env.c, mode="img2vid", workflow="img2vid_wan22_14b", prompt="camera orbits slowly", steps="99", frames="9", fps="16", source=src["file"])
    assert job["status"] == "done", job.get("error")
    assert job["params"]["frames"] == 9 and job["results"][0]["kind"] in ("video", "animation")


def test_img2vid_from_upload_svd_without_prompt(env):
    job = run_job(env.c, mode="img2vid", workflow="img2vid_svd", prompt="", steps="2", frames="7", fps="6", files={"image": ("my upload.png", png(), "image/png")})
    assert job["status"] == "done", job.get("error")
    (rec,) = job["results"]
    assert rec["file"].endswith(".webp") and rec["kind"] == "animation"
    assert "_img2vid_my-upload_" in rec["file"]  # named after the source when there is no prompt
    assert rec["thumb_url"]


def test_execution_error_is_reported(env):
    job = run_job(env.c, mode="txt2img", workflow="txt2img_checkpoint", prompt="please FAIL", steps="2")
    assert job["status"] == "error" and job["results"] == []
    assert "out of memory" in job["error"]["message"].lower() and "memory" in job["error"]["hint"].lower()


def test_cancel_running_job(env):
    r = env.c.post("/api/generate", data={"mode": "txt2img", "workflow": "txt2img_checkpoint", "prompt": "SLOW", "steps": "60"})
    job = r.json()
    deadline = time.time() + 10
    while time.time() < deadline and env.c.get(f"/api/jobs/{job['id']}").json()["status"] != "running":
        time.sleep(0.05)
    r = env.c.post(f"/api/jobs/{job['id']}/cancel")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    time.sleep(0.5)
    assert env.c.get(f"/api/jobs/{job['id']}").json()["status"] == "cancelled"
    q = httpx.get(env.mock_url + "/queue").json()
    time.sleep(0.3)
    assert httpx.get(env.mock_url + "/queue").json()["queue_pending"] == []


def test_validation_errors(env):
    c = env.c
    assert c.post("/api/generate", data={"mode": "txt2img", "workflow": "nope", "prompt": "x"}).status_code == 400
    assert "preset" in c.post("/api/generate", data={"mode": "img2vid", "workflow": "txt2img_checkpoint", "prompt": "x"}).json()["error"]["message"]
    assert "prompt" in c.post("/api/generate", data={"mode": "txt2img", "workflow": "txt2img_checkpoint", "prompt": "  "}).json()["error"]["message"].lower()
    assert "source image" in c.post("/api/generate", data={"mode": "img2vid", "workflow": "img2vid_wan22_5b", "prompt": "x"}).json()["error"]["message"].lower()
    assert c.post("/api/generate", data={"mode": "img2vid", "workflow": "img2vid_wan22_5b", "prompt": "x"}, files={"image": ("x.txt", b"hello", "text/plain")}).status_code == 400
    assert c.post("/api/generate", data={"mode": "txt2img", "workflow": "txt2img_checkpoint", "prompt": "x", "seed": "abc"}).status_code == 400
    job = run_job(c, mode="txt2img", workflow="txt2img_checkpoint", prompt="x", steps="1", model="missing.safetensors")
    assert job["status"] == "error" and "not in list" in job["error"]["message"] and "not installed" in job["error"]["hint"]


def test_input_edge_cases(env):
    c = env.c
    base = {"mode": "txt2img", "workflow": "txt2img_checkpoint", "prompt": "x"}
    assert c.post("/api/generate", data={**base, "steps": "1e400"}).status_code == 400
    assert c.post("/api/generate", data={**base, "cfg": "nan"}).status_code == 400
    assert c.post("/api/generate", data={**base, "seed": str(2**53)}).status_code == 400
    assert c.post("/api/generate", data={**base, "seed": str(2**53 - 1), "steps": "1"}).status_code == 200
    (env.outputs / "favourites").mkdir(exist_ok=True)
    r = c.post("/api/generate", data={"mode": "img2vid", "workflow": "img2vid_wan22_5b", "prompt": "x", "source": "favourites"})
    assert r.status_code == 404
    # Presets without a Model dropdown never record a stale model name.
    src = c.get("/api/gallery?kind=image").json()["items"][0]
    job = run_job(c, mode="img2vid", workflow="img2vid_wan22_14b", prompt="m", steps="1", frames="5", source=src["file"], model="wan2.2_ti2v_5B_fp16.safetensors")
    assert job["status"] == "done" and job["params"]["model"] == ""
    # The video filter includes animated webp results (SVD preset).
    kinds = {i["kind"] for i in c.get("/api/gallery?kind=video").json()["items"]}
    assert "animation" in kinds


def test_local_only_protection(env):
    c = env.c
    port = c.base_url.port
    assert c.get("/api/status", headers={"Host": f"evil.example:{port}"}).status_code == 421
    assert c.get("/api/status", headers={"Host": f"localhost:{port}"}).status_code == 200
    assert c.get("/api/status", headers={"Host": f"[::1]:{port}"}).status_code == 200
    data = {"mode": "txt2img", "workflow": "txt2img_checkpoint", "prompt": "csrf", "steps": "1"}
    assert c.post("/api/generate", data=data, headers={"Origin": "http://attacker.example"}).status_code == 403
    assert c.post("/api/generate", data=data, headers={"Origin": "null"}).status_code == 403
    assert c.post("/api/generate", data=data, headers={"Sec-Fetch-Site": "cross-site"}).status_code == 403
    assert c.post("/api/generate", data=data, headers={"Origin": f"http://127.0.0.1:{port}"}).status_code == 200
    assert c.delete("/api/gallery/x.png", headers={"Origin": "http://attacker.example"}).status_code == 403
    # An oversized upload is refused from its Content-Length alone, before any body is read.
    with socket.create_connection(("127.0.0.1", port), timeout=5) as sock:
        sock.sendall(
            f"POST /api/generate HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: multipart/form-data; boundary=x\r\n"
            f"Content-Length: {500 * 1024 * 1024}\r\n\r\n".encode()
        )
        status_line = sock.recv(64).split(b"\r\n")[0]
    assert b"413" in status_line, status_line


def test_hand_added_gallery_file_with_spaces_is_fully_usable(env):
    name = "my photo (1).png"
    (env.outputs / name).write_bytes(png())
    items = env.c.get("/api/gallery").json()["items"]
    rec = next(i for i in items if i["file"] == name)
    assert rec["url"] == "/api/gallery/my%20photo%20%281%29.png"
    assert env.c.get(rec["url"]).status_code == 200 and env.c.get(rec["thumb_url"]).status_code == 200
    job = run_job(env.c, mode="img2vid", workflow="img2vid_svd", prompt="", steps="1", frames="3", source=name)
    assert job["status"] == "done" and job["params"]["source_image"] == name
    assert env.c.delete("/api/gallery/my%20photo%20%281%29.png").status_code == 200
    assert env.c.get(rec["url"]).status_code == 404


def test_v3_combo_choices_through_the_mock(env):
    import asyncio

    from comfy_client import ComfyClient

    async def go():
        client = ComfyClient(env.mock_url)
        try:
            return await client.input_choices("UpscaleModelLoader", "model_name")
        finally:
            await client.aclose()

    assert asyncio.run(go()) == ["4x_mock_upscaler.pth"]


def test_gallery_safety_and_delete(env):
    c = env.c
    for bad in ("../app.py", "..%2Fapp.py", ".hidden.png", "a%2Fb.png"):
        assert c.get(f"/api/gallery/{bad}").status_code in (400, 404), bad
    assert c.get("/api/gallery/does-not-exist.png").status_code == 404
    item = c.get("/api/gallery").json()["items"][-1]
    before = c.get("/api/gallery").json()["total"]
    assert c.delete(f"/api/gallery/{item['file']}").status_code == 200
    assert c.get("/api/gallery").json()["total"] == before - 1
    assert not (env.outputs / item["file"]).exists() and not (env.outputs / item["file"]).with_suffix(".json").exists()


def test_page_is_self_contained(env):
    r = env.c.get("/")
    assert r.status_code == 200 and "Content-Security-Policy" in r.text and "default-src 'self'" in r.text
    assert "http://" not in r.text.replace("http://127.0.0.1:8188", "") and "https://" not in r.text
    for path in ("/static/app.js", "/static/style.css"):
        body = env.c.get(path).text
        assert "https://" not in body and "http://" not in body, path
    assert env.c.get("/docs").status_code == 404 and env.c.get("/openapi.json").status_code == 404


def test_autodetects_comfy_on_another_loopback_port(env, tmp_path_factory):
    """Configured for a dead port, but ComfyUI (the mock) answers on another: Darkroom switches by itself."""
    aport = free_port()
    app = ServerThread(create_app(comfy_url=f"http://127.0.0.1:{free_port()}", outputs_dir=tmp_path_factory.mktemp("out3"), probe_urls=("http://127.0.0.1:1", env.mock_url)), aport)
    app.start()
    wait_for(f"http://127.0.0.1:{aport}/api/status")
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{aport}", timeout=30) as c:
            # (wait_for above already hit /api/status once, which is when the switch happens)
            s = c.get("/api/status").json()
            assert s["online"] is True and s["comfy_url"] == env.mock_url
            assert "switched_to" not in s  # only reported on the call that switched
            assert c.get("/api/options").json()["models"]["CheckpointLoaderSimple.ckpt_name"]
    finally:
        app.stop()


def test_lan_mode_reports_phone_urls(env, tmp_path_factory):
    from app import lan_addresses

    aport = free_port()
    app = ServerThread(create_app(comfy_url=env.mock_url, outputs_dir=tmp_path_factory.mktemp("out4"), allowed_hosts=("0.0.0.0",), port=aport), aport)
    app.start()
    wait_for(f"http://127.0.0.1:{aport}/api/status")
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{aport}", timeout=30) as c:
            s = c.get("/api/status", headers={"Host": f"192.168.1.50:{aport}"}).json()  # any Host is fine in LAN mode
            assert s["online"] is True
            assert s["lan_urls"] == [f"http://{ip}:{aport}" for ip in lan_addresses()]
            assert env.c.get("/api/status").json()["lan_urls"] == []  # default (loopback) mode advertises nothing
    finally:
        app.stop()


def test_offline_comfy_is_explained(offline):
    s = offline.get("/api/status").json()
    assert s["online"] is False and "not reachable" in s["error"]["message"] and "Start ComfyUI" in s["error"]["hint"]
    assert "Looked for it at" in s["error"]["hint"]
    o = offline.get("/api/options").json()
    assert o["online"] is False and len(o["workflows"]) == 6 and o["models"] == {}
    job = run_job(offline, mode="txt2img", workflow="txt2img_checkpoint", prompt="x", steps="1", model="whatever.safetensors")
    assert job["status"] == "error" and "not reachable" in job["error"]["message"]
    r = offline.post("/api/generate", data={"mode": "txt2img", "workflow": "txt2img_checkpoint", "prompt": "x"})
    assert r.status_code == 503 and "Start ComfyUI" in r.json()["error"]["hint"]  # not a misleading "no model files"
