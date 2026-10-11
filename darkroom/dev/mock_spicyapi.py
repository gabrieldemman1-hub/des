"""A fake api.spicyapi.com for development and tests (nothing leaves your machine).

    python dev/mock_spicyapi.py --port 8787
    python app.py --spicy-key sk-spicy-test --spicy-url http://127.0.0.1:8787/v1

It follows the documented contract (October 2026): bearer auth, GET /v1/account,
POST /v1/moderations, POST /v1/images/generations (synchronous), POST
/v1/videos/generations -> task, GET /v1/videos/tasks/{id} with the status walk
queued -> processing -> finalizing -> succeeded, OpenAI-shaped errors, and the one
rule that shapes Darkroom's design: ``image_url`` must be an image this server
generated.  Magic words in prompts:

* ``REALPERSON``  -> moderation outcome "block" (category real_person)
* ``UNSURE``      -> moderation outcome "review"
* ``FAIL``        -> the video task fails (refunded)
* ``WITHHELD``    -> the video task fails with error_code "blocked"
* ``SLOW``        -> the task takes ~10 polls instead of 3
* ``BADKEY`` key  -> every call is a 401; key ``sk-spicy-broke`` -> 402 on paid calls
"""
from __future__ import annotations

import argparse
import io
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from PIL import Image, ImageDraw

PRICES = {"spicy-motion-3": {"480P": 0.10, "720P": 0.20, "1080P": 0.40}, "spicy-motion-3-fast": {"480P": 0.14, "720P": 0.28, "1080P": 0.56}}
IMAGE_PRICES = {"spicy-image-1": 0.06, "spicy-image-photo-1": 0.08, "spicy-image-1-pro": 0.09}


def _err(status: int, message: str, kind: str, **extra: Any) -> JSONResponse:
    return JSONResponse({"error": {"message": message, "type": kind, **extra}}, status_code=status)


def _png(size: str, text: str) -> bytes:
    w, h = (int(x) for x in size.split("*"))
    im = Image.new("RGB", (max(64, w // 4), max(64, h // 4)), (60, 24, 40))
    ImageDraw.Draw(im).text((8, 8), text[:40], fill=(230, 200, 210))
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def _mp4(seconds: float, label: str) -> tuple[bytes, str]:
    """A tiny real mp4 when ffmpeg is installed, else a stub with the mp4 magic bytes."""
    ff = shutil.which("ffmpeg")
    frames = max(2, int(min(seconds, 2) * 4))
    if ff:
        with tempfile.TemporaryDirectory() as td:
            for i in range(frames):
                im = Image.new("RGB", (128, 72), (40 + i * 8, 20, 50))
                ImageDraw.Draw(im).text((4, 4), f"{label[:12]} {i}", fill=(240, 220, 230))
                im.save(Path(td) / f"f{i:04d}.png")
            out = Path(td) / "out.mp4"
            try:
                subprocess.run([ff, "-y", "-loglevel", "error", "-framerate", "4", "-i", str(Path(td) / "f%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)], check=True, timeout=60)
                return out.read_bytes(), "video/mp4"
            except (subprocess.SubprocessError, OSError):
                pass
    return b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"\x00" * 512, "video/mp4"


def create_mock_spicy(*, polls_to_finish: int = 3, base_url: str | None = None) -> FastAPI:
    app = FastAPI()
    app.state.calls: list[tuple[str, str]] = []        # (method, path) for every request, for tests
    app.state.bodies: list[dict[str, Any]] = []        # JSON bodies of POSTs
    app.state.tasks: dict[str, dict[str, Any]] = {}
    app.state.files: dict[str, tuple[bytes, str]] = {}
    app.state.balance = 50.0
    app.state.base_url = base_url

    def public_url(request: Request, name: str) -> str:
        base = app.state.base_url or str(request.base_url).rstrip("/")
        return f"{base}/outputs/{name}"

    @app.middleware("http")
    async def record(request: Request, call_next):
        app.state.calls.append((request.method, request.url.path))
        if request.url.path.startswith("/v1/"):
            auth = request.headers.get("authorization", "")
            if not auth.startswith("Bearer sk-spicy-") or "BADKEY" in auth:
                return _err(401, "Invalid API key", "invalid_api_key")
            request.state.broke = auth.endswith("sk-spicy-broke")
            request.state.sandbox = "sandbox" in auth
        return await call_next(request)

    @app.get("/v1/account")
    async def account(request: Request):
        return {"email": "you@example.com", "balance_usd": round(app.state.balance, 3), "sandbox": request.state.sandbox,
                "limits": {"requests_per_minute": 600, "declined_prompts_per_minute": 60, "screened_requests_per_end_user_per_minute": 30, "video_jobs_in_progress": 20}}

    @app.get("/v1/models")
    async def models():
        return {"object": "list", "data": [{"id": m, "kind": "video", "pricing": {"unit": "second", "usd_by_resolution": p}} for m, p in PRICES.items()]}

    @app.post("/v1/moderations")
    async def moderations(request: Request):
        body = await request.json()
        app.state.bodies.append({"path": "/v1/moderations", **body})
        text = str(body.get("input") or "")
        cats = {"minor": 0.02, "real_person": 0.01, "non_consent": 0.02, "bestiality": 0.0, "gore": 0.0, "injection": 0.01}
        outcome, category, layer = "allow", None, "jev"
        if "REALPERSON" in text:
            outcome, category, cats["real_person"] = "block", "real_person", 0.99
        elif "UNSURE" in text:
            outcome, category, cats["minor"] = "review", "minor", 0.55
        app.state.balance -= 0.001
        return {"object": "moderation", "flagged": outcome != "allow", "outcome": outcome, "category": category, "categories": cats, "layer": layer, "cost_usd": 0.001}

    @app.post("/v1/images/generations")
    async def images(request: Request):
        body = await request.json()
        app.state.bodies.append({"path": "/v1/images/generations", **body})
        model = body.get("model")
        if model not in IMAGE_PRICES:
            return _err(400, f"Unknown model {model}", "invalid_request_error")
        if request.state.broke:
            return _err(402, "Insufficient balance", "insufficient_balance")
        prompt = str(body.get("prompt") or "")
        if "REALPERSON" in prompt:
            return _err(422, "Prompt was declined by content screening (real person)", "moderation_blocked", code="real_person", outcome="block", categories={"real_person": 0.99})
        size = str(body.get("size") or "1024*1024")
        if "*" not in size:
            return _err(400, "size must look like 832*1216", "invalid_request_error")
        n = int(body.get("n") or 1)
        rid = "req_" + uuid.uuid4().hex[:8]
        data = []
        for i in range(n):
            name = f"{rid}-{i}.png"
            app.state.files[name] = (_png(size, prompt), "image/png")
            data.append({"url": public_url(request, name)})
        cost = IMAGE_PRICES[model] * n
        app.state.balance -= cost
        return {"id": rid, "object": "image.generation", "model": model, "created": int(time.time()), "data": data, "cost_usd": round(cost, 3), "sandbox": request.state.sandbox}

    @app.post("/v1/videos/generations")
    async def videos(request: Request):
        body = await request.json()
        app.state.bodies.append({"path": "/v1/videos/generations", **body})
        model = body.get("model")
        if model not in PRICES:
            return _err(400, f"Unknown model {model}", "invalid_request_error")
        prompt = str(body.get("prompt") or "")
        image_url = body.get("image_url")
        if not prompt and not image_url:
            return _err(400, "prompt is required unless image_url or action is sent", "invalid_request_error")
        if len(prompt) > 20000:
            return _err(400, "prompt exceeds maxPromptChars (20000)", "invalid_request_error")
        if image_url:
            name = str(image_url).rsplit("/", 1)[-1]
            if name not in app.state.files or not name.endswith(".png"):
                return _err(400, "image_url must be one of your generated images (uploads and external URLs are rejected)", "invalid_request_error")
            if body.get("aspect_ratio"):
                return _err(400, "aspect_ratio is not accepted with image_url: the output follows the source", "invalid_request_error")
        res = body.get("resolution") or "720P"
        if res not in PRICES[model]:
            return _err(400, "resolution must be 480P, 720P or 1080P", "invalid_request_error")
        duration = int(body.get("duration", 5))
        if duration != -1 and not (2 <= duration <= 30):
            return _err(400, "duration must be 2-30 or -1", "invalid_request_error")
        fps = int(body.get("fps", 30))
        if fps not in (30, 60):
            return _err(400, "fps must be 30 or 60", "invalid_request_error")
        if "REALPERSON" in prompt:
            return _err(422, "Prompt was declined by content screening (real person)", "moderation_blocked", code="real_person", outcome="block")
        if request.state.broke:
            return _err(402, "Insufficient balance", "insufficient_balance")
        seconds = 30 if duration == -1 else duration
        cost = seconds * PRICES[model][res] * (1.2 if fps == 60 else 1.0)
        app.state.balance -= cost
        tid = "task_" + uuid.uuid4().hex[:8]
        app.state.tasks[tid] = {
            "id": tid, "object": "task", "type": "video", "model": model, "status": "queued", "output": None, "error": None, "error_code": None,
            "cost_usd": round(cost, 3), "poll_url": f"/v1/videos/tasks/{tid}", "usage": None,
            "_polls": 0, "_need": polls_to_finish * (3 if "SLOW" in prompt else 1), "_prompt": prompt, "_seconds": 7 if duration == -1 else duration, "_res": res, "_fps": fps,
        }
        return JSONResponse({k: v for k, v in app.state.tasks[tid].items() if not k.startswith("_")}, status_code=202)

    @app.get("/v1/videos/tasks/{tid}")
    async def task(request: Request, tid: str):
        t = app.state.tasks.get(tid)
        if not t:
            return _err(404, "Unknown task", "invalid_request_error")
        t["_polls"] += 1
        if t["status"] not in ("succeeded", "failed"):
            frac = t["_polls"] / t["_need"]
            t["status"] = "queued" if frac < 0.34 else "processing" if frac < 0.67 else "finalizing" if frac < 1 else "done"
            if t["status"] == "done":
                if "FAIL" in t["_prompt"]:
                    t.update(status="failed", error="Upstream render failed", error_code=None)
                    app.state.balance += t["cost_usd"]
                elif "WITHHELD" in t["_prompt"]:
                    t.update(status="failed", error="Output withheld by content screening", error_code="blocked")
                    app.state.balance += t["cost_usd"]
                else:
                    name = f"{tid}.mp4"
                    app.state.files[name] = _mp4(t["_seconds"], t["_prompt"])
                    t.update(status="succeeded", output={"video_url": public_url(request, name)},
                             usage={"output_seconds": t["_seconds"], "resolution": t["_res"], "fps": t["_fps"]})
                    if t["_seconds"] != 30 and t["cost_usd"] > t["_seconds"] * PRICES[t["model"]][t["_res"]] * 1.25:
                        t["cost_usd"] = round(t["_seconds"] * PRICES[t["model"]][t["_res"]] * (1.2 if t["_fps"] == 60 else 1.0), 3)  # smart duration settles
        return {k: v for k, v in t.items() if not k.startswith("_")}

    @app.get("/outputs/{name}")
    async def outputs(name: str):
        f = app.state.files.get(name)
        if not f:
            return Response(status_code=404)
        return Response(f[0], media_type=f[1])

    return app


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--polls", type=int, default=3, help="polls until a task succeeds")
    a = ap.parse_args()
    uvicorn.run(create_mock_spicy(polls_to_finish=a.polls), host="127.0.0.1", port=a.port, log_level="warning")
