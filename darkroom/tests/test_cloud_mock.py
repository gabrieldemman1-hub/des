"""End-to-end: real Darkroom server + the mock SpicyAPI (the optional cloud video engine), over real sockets.

The mock ComfyUI is started too, so the rest of the app behaves as in test_e2e_mock.py, but no
cloud job ever touches it.  Everything here must stay fast: the SpicyAPI client normally polls a
task every 10 s, so the module fixture shortens that (see ``fast_polling``).
"""
import io
import json
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

import spicy_client  # noqa: E402
from app import create_app  # noqa: E402
from mock_comfyui import create_mock_app  # noqa: E402
from mock_spicyapi import create_mock_spicy  # noqa: E402

FAST_POLL = 0.05


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


def dead_url() -> str:
    """A loopback URL where nothing listens (keeps the local-LLM probe instant)."""
    return f"http://127.0.0.1:{free_port()}/v1"


# ---- fixtures ------------------------------------------------------------------------
@pytest.fixture(scope="module")
def fast_polling():
    """SpicyClient.wait() binds ``poll=POLL_SECONDS`` (10 s) at definition time, so patching the
    constant does nothing; wrap the method instead.  ``box["poll"]`` can be raised by a test that
    needs a wider window (the cancel test)."""
    box = {"poll": FAST_POLL}
    orig = spicy_client.SpicyClient.wait

    def wait(self, task_id, on_status=None, **kw):
        kw.pop("poll", None)
        return orig(self, task_id, on_status, poll=box["poll"], **kw)

    spicy_client.SpicyClient.wait = wait
    try:
        yield box
    finally:
        spicy_client.SpicyClient.wait = orig


@pytest.fixture(scope="module")
def cloud(tmp_path_factory, fast_polling):
    """Darkroom with a key + the mock SpicyAPI + the mock ComfyUI."""
    data = tmp_path_factory.mktemp("comfy")
    outputs = tmp_path_factory.mktemp("outputs_cloud")
    cport, sport, aport = free_port(), free_port(), free_port()
    comfy = ServerThread(create_mock_app(data, step_delay=0.01), cport)
    mock_url = f"http://127.0.0.1:{sport}"
    spicy_app = create_mock_spicy(polls_to_finish=2, base_url=mock_url)
    spicy = ServerThread(spicy_app, sport)
    comfy_url = f"http://127.0.0.1:{cport}"
    app = ServerThread(create_app(comfy_url=comfy_url, outputs_dir=outputs, spicy_key="sk-spicy-test", spicy_url=f"{mock_url}/v1", llm_url=dead_url()), aport)
    comfy.start()
    spicy.start()
    app.start()
    wait_for(f"{comfy_url}/system_stats")
    wait_for(f"{mock_url}/v1/models")  # answers 401 without a key, which is enough to know it is up
    wait_for(f"http://127.0.0.1:{aport}/api/status")
    client = httpx.Client(base_url=f"http://127.0.0.1:{aport}", timeout=30)
    yield SimpleNamespace(c=client, outputs=outputs, mock=spicy_app, mock_url=mock_url, comfy_url=comfy_url, poll=fast_polling)
    client.close()
    app.stop()
    spicy.stop()
    comfy.stop()


@pytest.fixture(scope="module")
def others(cloud, tmp_path_factory):
    """Three more Darkrooms against the same mocks: no key at all, a bad key, an empty balance."""
    servers, clients = [], {}
    for name, key in (("nokey", None), ("badkey", "sk-spicy-BADKEY"), ("broke", "sk-spicy-broke")):
        aport = free_port()
        srv = ServerThread(create_app(comfy_url=cloud.comfy_url, outputs_dir=tmp_path_factory.mktemp(f"outputs_{name}"), spicy_key=key, spicy_url=f"{cloud.mock_url}/v1", llm_url=dead_url()), aport)
        srv.start()
        servers.append(srv)
        clients[name] = httpx.Client(base_url=f"http://127.0.0.1:{aport}", timeout=30)
    for c in clients.values():
        wait_for(f"{c.base_url}/api/status")
    yield SimpleNamespace(**clients)
    for c in clients.values():
        c.close()
    for srv in servers:
        srv.stop()


# ---- helpers -------------------------------------------------------------------------
def run_cloud_job(c: httpx.Client, timeout: float = 30.0, **data) -> dict:
    r = c.post("/api/generate", data=data)
    assert r.status_code == 200, r.text
    job = r.json()
    assert job["engine"] == "spicy" and job["mode"] == "cloudvid" and job["active"]
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = c.get(f"/api/jobs/{job['id']}").json()
        if not job["active"]:
            return job
        time.sleep(FAST_POLL)
    raise AssertionError(f"cloud job did not finish: {job}")


def sidecar(outputs: Path, name: str) -> dict:
    return json.loads((outputs / name).with_suffix(".json").read_text(encoding="utf-8"))


def posts(calls: list, since: int) -> list:
    return [c for c in calls[since:] if c[0] == "POST"]


# ---- status / options / account / estimate ---------------------------------------------
def test_status_reports_cloud_without_calling_it(cloud):
    before = len(cloud.mock.state.calls)
    for _ in range(3):
        s = cloud.c.get("/api/status").json()
        assert s["online"] is True  # the (mock) ComfyUI is still the main engine
        assert s["cloud"]["configured"] is True and s["cloud"]["service"] == "SpicyAPI"
    assert s["cloud"]["host"] == "127.0.0.1" and s["cloud"]["loopback"] is True
    assert s["cloud"]["key_hint"] and "sk-spicy-test" not in json.dumps(s)  # the key itself never reaches the page
    assert len(cloud.mock.state.calls) == before, "status must not talk to the cloud"


def test_options_lists_cloud_presets_and_prices(cloud):
    before = len(cloud.mock.state.calls)
    o = cloud.c.get("/api/options").json()
    assert o["cloud"]["configured"] is True and o["cloud"]["service"] == "SpicyAPI"
    presets = [w for w in o["workflows"] if w["mode"] == "cloudvid"]
    assert [p["id"] for p in presets] == ["spicy_t2v", "spicy_frame"]
    assert all(p["engine"] == "spicy" for p in presets)
    assert [p["cloud"]["kind"] for p in presets] == ["t2v", "frame"]
    t2v = presets[0]
    assert t2v["controls"]["prompt"] is True and t2v["controls"]["steps"] is False and t2v["controls"]["size"] is False
    assert t2v["defaults"]["duration"] == 5 and t2v["defaults"]["resolution"] == "720P" and t2v["defaults"]["cloud_model"] == "spicy-motion-3"
    assert t2v["constraints"] == {"duration_min": 2, "duration_max": 30}
    video_models = {m["id"]: m for m in o["cloud"]["video_models"]}
    assert video_models["spicy-motion-3"]["usd_per_second"] == {"480P": 0.10, "720P": 0.20, "1080P": 0.40}
    assert video_models["spicy-motion-3-fast"]["usd_per_second"]["720P"] == 0.28
    frame_models = {m["id"]: m for m in o["cloud"]["frame_models"]}
    assert frame_models["spicy-image-1"]["usd"] == 0.06
    assert o["cloud"]["duration"] == {"min": 2, "max": 30, "smart": -1} and o["cloud"]["fps60_surcharge"] == 0.2
    assert "9:16" in o["cloud"]["aspect_ratios"] and o["cloud"]["resolutions"] == ["480P", "720P", "1080P"] and "832*1216" in o["cloud"]["frame_sizes"]
    # the local presets are untouched
    assert any(w["mode"] == "txt2img" for w in o["workflows"]) and any(w["mode"] == "img2vid" for w in o["workflows"])
    assert len(cloud.mock.state.calls) == before


def test_cloud_account(cloud):
    before = len(cloud.mock.state.calls)
    r = cloud.c.get("/api/cloud/account")
    assert r.status_code == 200, r.text
    acct = r.json()
    assert isinstance(acct["balance_usd"], (int, float)) and 0 < acct["balance_usd"] <= 50.0
    assert acct["sandbox"] is False and acct["email"] == "you@example.com" and acct["limits"]["video_jobs_in_progress"] == 20
    assert cloud.mock.state.calls[before:] == [("GET", "/v1/account")]  # exactly one request, no polling
    # The service flags sandbox keys; Darkroom passes the flag through.
    r = httpx.get(f"{cloud.mock_url}/v1/account", headers={"Authorization": "Bearer sk-spicy-sandbox-1"})
    assert r.status_code == 200 and r.json()["sandbox"] is True


def test_cloud_estimate_is_computed_locally(cloud):
    before = len(cloud.mock.state.calls)
    est = lambda **q: cloud.c.get("/api/cloud/estimate", params=q).json()  # noqa: E731
    e = est(duration=10, resolution="720P")
    assert e["usd"] == pytest.approx(2.001) and e["smart"] is False and "10 s" in e["breakdown"] and "720P" in e["breakdown"]
    e = est(duration=10, resolution="720P", fps60="1")
    assert e["usd"] == pytest.approx(2.401) and "60 fps" in e["breakdown"]
    e = est(duration=-1, resolution="720P")
    assert e["smart"] is True and e["usd"] == pytest.approx(6.001) and "30 s" in e["breakdown"] and "refunded" in e["breakdown"]
    e = est(duration=5, resolution="1080P", frame_model="spicy-image-1")
    assert e["usd"] == pytest.approx(5 * 0.40 + 0.06 + 2 * 0.001) and "first frame" in e["breakdown"]
    e = est(duration=4, resolution="480P", cloud_model="spicy-motion-3-fast")
    assert e["usd"] == pytest.approx(4 * 0.14 + 0.001)
    assert est(duration=1)["usd"] == pytest.approx(2 * 0.20 + 0.001)  # clamped to the 2 s minimum
    assert cloud.c.get("/api/cloud/estimate", params={"duration": "abc"}).status_code == 400
    assert len(cloud.mock.state.calls) == before


# ---- happy paths --------------------------------------------------------------------------
def test_text_to_video_end_to_end(cloud):
    calls, bodies = cloud.mock.state.calls, cloud.mock.state.bodies
    c0, b0 = len(calls), len(bodies)
    job = run_cloud_job(cloud.c, mode="cloudvid", workflow="spicy_t2v", prompt="she dances slowly", duration="5", resolution="720P", aspect="9:16", audio="1", seed="4242")
    assert job["status"] == "done", job.get("error")
    assert job["engine"] == "spicy" and job["workflow_id"] == "spicy_t2v" and job["error"] is None and job["warnings"] == []
    assert job["cost_usd"] == pytest.approx(1.0)  # 5 s × $0.20; the $0.001 moderation pre-check is not part of the task's price
    assert job["cloud_task_id"].startswith("task_") and job["prompt_id"] == job["cloud_task_id"]
    assert "Done" in job["progress"]["label"] and "$1.00" in job["progress"]["label"]
    p = job["params"]
    assert p["duration"] == 5 and p["resolution"] == "720P" and p["aspect"] == "9:16" and p["audio"] is True and p["fps"] == 30
    assert p["model"] == "spicy-motion-3" and p["seed"] == 4242 and p["random_seed"] is False and p["style"] == "none"
    assert p["estimate_usd"] == pytest.approx(1.001) and p["service"] == "SpicyAPI" and p["frame_prompt"] is None and p["frame_model"] is None
    (rec,) = job["results"]
    assert rec["kind"] == "video" and rec["file"].endswith(".mp4") and "_cloudvid_she-dances-slowly_4242" in rec["file"]
    path = cloud.outputs / rec["file"]
    assert path.exists() and path.read_bytes()[4:8] == b"ftyp"
    side = sidecar(cloud.outputs, rec["file"])
    assert side["engine"] == "spicy" and side["cloud_task_id"] == job["cloud_task_id"] and side["kind"] == "video"
    assert side["cost_usd"] == pytest.approx(1.0) and side["job_id"] == job["id"] and side["cloud_url"] == f"{cloud.mock_url}/outputs/{job['cloud_task_id']}.mp4"
    assert side["duration"] == 5 and side["resolution"] == "720P" and side["fps"] == 30 and side["source_image"] == "" and side["frame_file"] is None
    assert side["prompt"] == "she dances slowly" and side["workflow"] == "spicy_t2v" and side["mode"] == "cloudvid"
    r = cloud.c.get(rec["url"])
    assert r.status_code == 200 and r.headers["content-type"] == "video/mp4"
    assert cloud.c.get(f"/api/gallery/{rec['file']}/meta").json()["engine"] == "spicy"
    # What the service saw: the moderation pre-check, then exactly one task, polls on it, one download.
    assert posts(calls, c0) == [("POST", "/v1/moderations"), ("POST", "/v1/videos/generations")]
    assert ("GET", f"/v1/videos/tasks/{job['cloud_task_id']}") in calls[c0:]
    assert ("GET", f"/outputs/{job['cloud_task_id']}.mp4") in calls[c0:]
    mod, vid = bodies[b0:]
    assert mod["path"] == "/v1/moderations" and mod["input"] == "she dances slowly"
    assert vid["path"] == "/v1/videos/generations" and vid["model"] == "spicy-motion-3" and "she dances slowly" in vid["prompt"]
    assert vid["aspect_ratio"] == "9:16" and vid["audio"] is True and vid["fps"] == 30 and vid["duration"] == 5 and vid["resolution"] == "720P" and vid["seed"] == 4242
    assert "image_url" not in vid and "enhance_prompt" not in vid
    # History and gallery know about it.
    h = cloud.c.get("/api/history").json()["items"]
    assert h[0]["engine"] == "spicy" and h[0]["mode"] == "cloudvid" and h[0]["prompt"] == "she dances slowly"
    assert h[0]["cost_usd"] == pytest.approx(1.0) and h[0]["file"] == rec["file"] and h[0]["aspect"] == "9:16" and h[0]["seed"] == 4242
    assert cloud.c.get("/api/gallery?kind=video").json()["items"][0]["file"] == rec["file"]
    assert cloud.c.get("/api/jobs").json()["jobs"][0]["id"] == job["id"]


def test_frame_plus_video_end_to_end(cloud):
    calls, bodies = cloud.mock.state.calls, cloud.mock.state.bodies
    c0, b0 = len(calls), len(bodies)
    frame_prompt = "a woman in her thirties in a red dress"
    job = run_cloud_job(cloud.c, mode="cloudvid", workflow="spicy_frame", frame_prompt=frame_prompt, prompt="she turns to the camera", duration="4", resolution="480P", aspect="16:9", seed="7")
    assert job["status"] == "done", job.get("error")
    assert job["cost_usd"] == pytest.approx(0.06 + 4 * 0.10)
    p = job["params"]
    assert p["frame_prompt"] == frame_prompt and p["frame_model"] == "spicy-image-1" and p["frame_size"] == "832*1216" and p["aspect"] == "16:9"
    assert p["estimate_usd"] == pytest.approx(0.06 + 0.40 + 0.002)
    frame, video = job["results"]
    # 1. the first frame, rendered on SpicyAPI and kept in the gallery
    assert frame["kind"] == "image" and frame["file"].endswith(".png") and (frame["width"], frame["height"]) == (208, 304)
    fside = sidecar(cloud.outputs, frame["file"])
    assert fside["engine"] == "spicy" and fside["model"] == "spicy-image-1" and fside["kind"] == "image" and fside["cost_usd"] == pytest.approx(0.06)
    assert fside["prompt"] == frame_prompt and fside["job_id"] == job["id"] and fside["cloud_id"].startswith("req_") and fside["cloud_url"].startswith(f"{cloud.mock_url}/outputs/")
    assert cloud.c.get(frame["thumb_url"]).status_code == 200
    # 2. the clip, linked to its frame
    assert video["kind"] == "video" and video["file"].endswith(".mp4") and "_cloudvid_she-turns-to-the-camera_7" in video["file"]
    vside = sidecar(cloud.outputs, video["file"])
    assert vside["source_image"] == frame["file"] and vside["frame_file"] == frame["file"] and vside["engine"] == "spicy"
    assert vside["cost_usd"] == pytest.approx(0.46) and vside["cloud_task_id"] == job["cloud_task_id"] and vside["frame_prompt"] == frame_prompt
    assert vside["duration"] == 4 and vside["resolution"] == "480P"
    # 3. the frame doubles as the video's poster
    assert video["thumb_url"]
    r = cloud.c.get(f"/api/thumbs/{video['file']}")
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(r.content)).size == (208, 304)
    assert (cloud.outputs / ".thumbs" / (Path(video["file"]).stem + ".jpg")).exists()
    # 4. what the service saw, in order: both prompts screened, then the frame, then the task
    assert posts(calls, c0) == [("POST", "/v1/moderations"), ("POST", "/v1/moderations"), ("POST", "/v1/images/generations"), ("POST", "/v1/videos/generations")]
    assert [b["input"] for b in bodies[b0:] if b["path"] == "/v1/moderations"] == ["she turns to the camera", frame_prompt]
    img = next(b for b in bodies[b0:] if b["path"] == "/v1/images/generations")
    assert img["model"] == "spicy-image-1" and img["size"] == "832*1216" and img["n"] == 1 and img["prompt"] == frame_prompt and img["seed"] == 7
    vid = next(b for b in bodies[b0:] if b["path"] == "/v1/videos/generations")
    assert vid["image_url"].startswith(f"{cloud.mock_url}/outputs/req_") and vid["image_url"].endswith(".png")
    assert vid["image_url"] == fside["cloud_url"]
    assert "aspect_ratio" not in vid  # follows the frame; SpicyAPI rejects the pair
    assert vid["duration"] == 4 and vid["resolution"] == "480P" and vid["model"] == "spicy-motion-3" and vid["seed"] == 7
    assert ("GET", "/outputs/" + vid["image_url"].rsplit("/", 1)[-1]) in calls[c0:]  # the frame was downloaded from the service
    h = cloud.c.get("/api/history").json()["items"][0]
    assert h["engine"] == "spicy" and h["frame_prompt"] == frame_prompt and h["frame_model"] == "spicy-image-1" and h["cost_usd"] == pytest.approx(0.46)
    assert cloud.c.get("/api/gallery?kind=image").json()["items"][0]["file"] == frame["file"]


# ---- refusals and failures ------------------------------------------------------------------
@pytest.mark.parametrize("word, kind, outcome, phrase", [("REALPERSON", "moderation_blocked", "block", "would refuse"), ("UNSURE", "moderation_review", "review", "unsure")])
def test_moderation_precheck_stops_before_spending(cloud, word, kind, outcome, phrase):
    calls = cloud.mock.state.calls
    c0 = len(calls)
    job = run_cloud_job(cloud.c, mode="cloudvid", workflow="spicy_t2v", prompt=f"{word} she waves", duration="3")
    assert job["status"] == "error" and job["results"] == [] and job["cloud_task_id"] is None and job["cost_usd"] is None
    err = job["error"]
    assert err["type"] == kind and err["status"] == 422 and phrase in err["message"] and "Nothing was charged" in err["hint"]
    assert err["details"]["outcome"] == outcome and err["details"]["flagged"] is True
    assert job["progress"]["label"] == "Failed"
    assert posts(calls, c0) == [("POST", "/v1/moderations")]
    assert not any(path.startswith("/v1/videos") for _, path in calls[c0:])


def test_moderation_precheck_covers_the_frame_prompt(cloud):
    calls = cloud.mock.state.calls
    c0 = len(calls)
    job = run_cloud_job(cloud.c, mode="cloudvid", workflow="spicy_frame", prompt="she waves", frame_prompt="REALPERSON portrait")
    assert job["status"] == "error" and job["error"]["type"] == "moderation_blocked" and job["results"] == []
    assert posts(calls, c0) == [("POST", "/v1/moderations"), ("POST", "/v1/moderations")]  # no frame, no task


def test_failed_task_is_reported_as_refunded(cloud):
    balance = cloud.mock.state.balance
    job = run_cloud_job(cloud.c, mode="cloudvid", workflow="spicy_t2v", prompt="FAIL she waves", duration="3")
    assert job["status"] == "error" and job["results"] == []
    err = job["error"]
    assert err["type"] == "failed" and "Upstream render failed" in err["message"] and "refund" in err["hint"].lower()
    assert job["cloud_task_id"] and err["details"]["id"] == job["cloud_task_id"] and err["details"]["status"] == "failed"
    assert cloud.mock.state.balance == pytest.approx(balance - 0.001)  # only the pre-check was kept; the task was refunded
    assert not list(cloud.outputs.glob("*fail-she-waves*"))


def test_withheld_output_is_a_block(cloud):
    job = run_cloud_job(cloud.c, mode="cloudvid", workflow="spicy_t2v", prompt="WITHHELD she waves", duration="3")
    assert job["status"] == "error" and job["results"] == []
    err = job["error"]
    assert err["type"] == "blocked" and "withheld" in err["message"].lower() and "refunded" in err["hint"]
    assert err["details"]["error_code"] == "blocked"


# ---- other configurations -----------------------------------------------------------------------
def test_without_a_key_the_cloud_does_not_exist(others, cloud):
    c = others.nokey
    before = len(cloud.mock.state.calls)
    assert c.get("/api/status").json()["cloud"] == {"configured": False}
    o = c.get("/api/options").json()
    assert o["cloud"] == {"configured": False} and not [w for w in o["workflows"] if w["mode"] == "cloudvid"]
    assert any(w["mode"] == "txt2img" for w in o["workflows"])
    r = c.post("/api/generate", data={"mode": "cloudvid", "workflow": "spicy_t2v", "prompt": "she waves"})
    assert r.status_code == 400 and "--spicy-key" in r.json()["error"]["message"]
    r = c.post("/api/generate", data={"mode": "txt2img", "workflow": "spicy_frame", "prompt": "she waves"})  # a cloud preset id alone routes there too
    assert r.status_code == 400 and "--spicy-key" in r.json()["error"]["message"]
    assert c.get("/api/cloud/account").status_code == 404
    assert c.get("/api/cloud/estimate").status_code == 404
    assert len(cloud.mock.state.calls) == before


def test_bad_key_is_explained_without_leaking_it(others):
    c = others.badkey
    r = c.get("/api/cloud/account")
    assert r.status_code == 401, r.text
    err = r.json()["error"]
    assert "rejected the API key" in err["message"] and "dashboard" in err["hint"] and "--spicy-key" in err["hint"]
    assert "BADKEY" not in r.text  # only a hint of the key, never the key
    job = run_cloud_job(c, mode="cloudvid", workflow="spicy_t2v", prompt="she waves", duration="3")
    assert job["status"] == "error" and job["error"]["status"] == 401 and job["cloud_task_id"] is None


def test_empty_balance_stops_the_job_before_any_charge(others, cloud):
    c = others.broke
    calls = cloud.mock.state.calls
    c0 = len(calls)
    job = run_cloud_job(c, mode="cloudvid", workflow="spicy_t2v", prompt="she waves", duration="3")
    assert job["status"] == "error" and job["results"] == [] and job["cloud_task_id"] is None and job["cost_usd"] is None
    err = job["error"]
    assert err["status"] == 402 and "balance" in err["message"].lower() and "Top up" in err["hint"]
    assert posts(calls, c0) == [("POST", "/v1/moderations"), ("POST", "/v1/videos/generations")]
    # Frame + video: the frame is refused the same way, so no video task is even attempted.
    c1 = len(calls)
    job = run_cloud_job(c, mode="cloudvid", workflow="spicy_frame", prompt="she waves", frame_prompt="a woman in a red dress")
    assert job["status"] == "error" and job["error"]["status"] == 402 and job["results"] == []
    assert posts(calls, c1) == [("POST", "/v1/moderations"), ("POST", "/v1/moderations"), ("POST", "/v1/images/generations")]


# ---- cancel ----------------------------------------------------------------------------------
def test_cancel_stops_waiting_and_warns_about_billing(cloud):
    cloud.poll["poll"] = 0.5  # SLOW = 6 polls, so the task stays "running" for ~2.5 s
    try:
        r = cloud.c.post("/api/generate", data={"mode": "cloudvid", "workflow": "spicy_t2v", "prompt": "SLOW she waves", "duration": "3"})
        assert r.status_code == 200, r.text
        jid = r.json()["id"]
        deadline = time.time() + 10
        job = r.json()
        while time.time() < deadline and job["active"] and not job["cloud_task_id"]:
            time.sleep(0.02)
            job = cloud.c.get(f"/api/jobs/{jid}").json()
        assert job["active"] and job["cloud_task_id"], job
        assert jid in cloud.c.get("/api/status").json()["active_jobs"]
        r = cloud.c.post(f"/api/jobs/{jid}/cancel")
        assert r.status_code == 200, r.text
        assert r.json()["status"] in ("running", "cancelled")  # the task sees the cancel on the next loop turn
        deadline = time.time() + 5
        while time.time() < deadline and cloud.c.get(f"/api/jobs/{jid}").json()["active"]:
            time.sleep(0.02)
        job = cloud.c.get(f"/api/jobs/{jid}").json()
        assert job["status"] == "cancelled" and job["results"] == [] and job["error"] is None
        assert "SpicyAPI keeps rendering and billing" in job["progress"]["label"]
        assert jid not in cloud.c.get("/api/status").json()["active_jobs"]
        assert cloud.c.post(f"/api/jobs/{jid}/cancel").json()["status"] == "cancelled"  # idempotent
        # Darkroom stopped polling; the task itself lives on at the service.
        task_polls = lambda: sum(1 for m, p in cloud.mock.state.calls if p == f"/v1/videos/tasks/{job['cloud_task_id']}")  # noqa: E731
        n = task_polls()
        time.sleep(0.8)
        assert task_polls() == n
        assert cloud.mock.state.tasks[job["cloud_task_id"]]["status"] != "succeeded"
    finally:
        cloud.poll["poll"] = FAST_POLL


# ---- validation ----------------------------------------------------------------------------------
def test_cloud_validation_happens_before_any_cloud_call(cloud):
    c = cloud.c
    calls = cloud.mock.state.calls
    base = {"mode": "cloudvid", "workflow": "spicy_t2v", "prompt": "she waves"}

    def refused(data: dict) -> str:
        r = c.post("/api/generate", data=data)
        assert r.status_code == 400, r.text
        return r.json()["error"]["message"]

    c0 = len(calls)
    assert "adults" in refused({**base, "prompt": "a teen on the beach"})
    assert len(calls) == c0, "the blocked-term check must not reach the cloud"
    assert "adults" in refused({"mode": "cloudvid", "workflow": "spicy_frame", "prompt": "she waves", "frame_prompt": "a schoolgirl"})
    assert "Duration" in refused({**base, "duration": "1"})
    assert "whole number" in refused({**base, "duration": "five"})
    assert "frame prompt" in refused({"mode": "cloudvid", "workflow": "spicy_frame", "prompt": "she waves"}).lower()
    assert "60 fps" in refused({**base, "fps60": "1", "resolution": "1080P", "aspect": "21:9"})
    assert "motion prompt" in refused({**base, "prompt": "   "}).lower()
    assert "cloud preset" in refused({"mode": "cloudvid", "workflow": "spicy_nope", "prompt": "x"})
    assert "Seed" in refused({**base, "seed": "abc"})
    assert len(calls) == c0, "all of this is decided locally"
    # Unknown values fall back to the defaults instead of failing (the page only offers valid ones).
    r = c.get("/api/cloud/estimate", params={"duration": 5, "resolution": "4K", "cloud_model": "nope"})
    assert r.json()["usd"] == pytest.approx(1.001)
