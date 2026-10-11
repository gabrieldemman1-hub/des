#!/usr/bin/env python3
"""
Darkroom: a private, local-only web frontend for ComfyUI.

    python app.py                 # then open http://127.0.0.1:8585

Everything runs on this machine: this server binds to 127.0.0.1, talks only
to your local ComfyUI (http://127.0.0.1:8188 by default) and writes results
to ./outputs.  No analytics, no accounts, no CDN, no external requests of any
kind.  The page even ships a Content-Security-Policy that forbids the browser
from loading anything that is not served by this process.

Swapping models / workflows: see workflows.py and workflows/README.md.
"""
from __future__ import annotations

import sys

if sys.version_info < (3, 10):  # the type annotations below need 3.10+
    sys.exit(f"Darkroom needs Python 3.10 or newer; this is Python {sys.version.split()[0]}.")

import argparse
import asyncio
import json
import logging
import math
import mimetypes
import os
import secrets
import socket
import threading
import time
import traceback
import uuid
import webbrowser
from collections import OrderedDict
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from comfy_client import ComfyClient, ComfyError, ComfyInterrupted, ComfyUnavailable
from director import Director, LLMError, LocalLLM, blocked_term
from spicy_client import (ASPECT_RATIOS, DURATION_MAX, DURATION_MIN, FRAME_MODELS, FRAME_SIZES, RESOLUTIONS, SMART_DURATION, VIDEO_MODELS,
                          SpicyClient, SpicyError, SpicyFailed, estimate_cost)
from spicy_client import DEFAULT_BASE_URL as SPICY_DEFAULT_URL
from storage import Storage, StorageError
from workflows import Template, TemplateError, load_templates, ordered

HERE = Path(__file__).resolve().parent
log = logging.getLogger("darkroom")

# ---- configuration (CLI flags / env vars override these) -----------------------
DEFAULT_COMFY_URL = os.environ.get("COMFY_URL", "http://127.0.0.1:8188")
# While ComfyUI is unreachable at the configured URL, these loopback addresses are tried too
# (8188 = git / portable ComfyUI, 8000 = the ComfyUI Desktop app). Never anything off-machine.
DEFAULT_PROBE_URLS = ("http://127.0.0.1:8188", "http://127.0.0.1:8000")
DEFAULT_HOST = os.environ.get("DARKROOM_HOST", "127.0.0.1")  # localhost only; see README before changing
DEFAULT_PORT = int(os.environ.get("DARKROOM_PORT", "8585"))
DEFAULT_OUTPUTS = Path(os.environ.get("DARKROOM_OUTPUTS", str(HERE / "outputs")))
WORKFLOWS_DIR = HERE / "workflows"
PRESETS_DIR = HERE / "presets"
STATIC_DIR = HERE / "static"

# Always appended to the negative prompt.  It costs nothing for adult content
# and is a hard guard against the model drifting towards minors.  Keep it.
ALWAYS_NEGATIVE = "child, minor, underage, loli, shota"

# ComfyUI accepts seeds up to 2**64-1, but JavaScript numbers are exact only up to 2**53-1 and the
# browser must be able to show the seed back to you unchanged, so Darkroom caps it there.
MAX_SEED = 2**53 - 1
MAX_UPLOAD_BYTES = 64 * 1024 * 1024
MAX_JOBS_KEPT = 200
ALLOWED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}

# ---- optional cloud engine (SpicyAPI) ------------------------------------------------
# Only exists when Darkroom is started with a key.  Two presets, shown as a fourth tab.
# They are not workflow files because nothing runs in ComfyUI; see spicy_client.py.
CLOUD_MODE = "cloudvid"
CLOUD_PRESETS: dict[str, dict[str, Any]] = {
    "spicy_t2v": {
        "name": "Text → Video (Spicy Motion 3)",
        "kind": "t2v",
        "description": "Writes the whole clip from your prompt on SpicyAPI's Spicy Motion 3 (a Wan 3.0-class model): 2-30 s, up to 1080p, with speech and sound. Pick an aspect ratio or let the model choose.",
    },
    "spicy_frame": {
        "name": "Frame + Video (SpicyAPI image → Spicy Motion 3)",
        "kind": "frame",
        "description": "First renders a still on SpicyAPI from the frame prompt (what the picture shows), then animates it with the motion prompt. SpicyAPI only animates images it generated itself, so local images cannot be used here.",
    },
}
STATUS_LABELS_CLOUD = {"queued": "Queued at SpicyAPI", "processing": "Rendering at SpicyAPI (1-5 min)", "finalizing": "Finalizing at SpicyAPI (output check / 60 fps)"}
CLOUD_CONTROLS = {"prompt": True, "negative": False, "steps": False, "cfg": False, "seed": True, "size": False, "frames": False, "fps": False, "strength": False, "sampler": False, "model": False}


def cloud_presets_public() -> list[dict[str, Any]]:
    out = []
    for pid, spec in CLOUD_PRESETS.items():
        out.append({
            "id": pid, "name": spec["name"], "mode": CLOUD_MODE, "engine": "spicy", "cloud": {"kind": spec["kind"]},
            "description": spec["description"], "notes": [], "requires": [], "controls": CLOUD_CONTROLS,
            "defaults": {"prompt": "", "negative": "", "duration": 5, "resolution": "720P", "aspect": "", "audio": True, "fps60": False, "enhance": False,
                         "cloud_model": "spicy-motion-3", "frame_model": "spicy-image-1", "frame_size": "832*1216", "frame_prompt": ""},
            "constraints": {"duration_min": DURATION_MIN, "duration_max": DURATION_MAX}, "model": None, "sizes": [], "sampler_node": None, "tokens": [], "prompt_style": "natural",
        })
    return out


# ---- jobs -----------------------------------------------------------------------
@dataclass
class Job:
    id: str
    mode: str
    workflow_id: str
    workflow_name: str
    params: dict[str, Any]
    created: float = field(default_factory=time.time)
    status: str = "queued"  # queued | running | saving | done | error | cancelled
    prompt_id: str | None = None
    position: int | None = None
    progress: dict[str, Any] = field(default_factory=lambda: {"value": 0, "max": 0, "label": "Queued", "node": None})
    preview: str | None = None  # data: URL of ComfyUI's live preview (if previews are enabled there)
    error: dict[str, Any] | None = None
    results: list[dict[str, Any]] = field(default_factory=list)
    finished: float | None = None
    cancel_requested: bool = False
    warnings: list[str] = field(default_factory=list)  # e.g. ComfyUI skipped an output node that failed validation
    task: asyncio.Task | None = field(default=None, repr=False, compare=False)
    source_thumb: str | None = None  # data: URL of the img2vid source, for the UI
    engine: str = "comfy"            # "comfy" (local) | "spicy" (cloud)
    cost_usd: float | None = None    # cloud jobs: what SpicyAPI debited
    cloud_task_id: str | None = None

    def to_dict(self, *, preview: bool = True) -> dict[str, Any]:
        return {
            "id": self.id,
            "engine": self.engine,
            "cost_usd": self.cost_usd,
            "cloud_task_id": self.cloud_task_id,
            "mode": self.mode,
            "workflow_id": self.workflow_id,
            "workflow_name": self.workflow_name,
            "params": self.params,
            "created": self.created,
            "status": self.status,
            "prompt_id": self.prompt_id,
            "position": self.position,
            "progress": self.progress,
            "preview": self.preview if preview else None,
            "error": self.error,
            "warnings": self.warnings,
            "results": self.results,
            "finished": self.finished,
            "elapsed": round((self.finished or time.time()) - self.created, 1),
            "active": self.status in ("queued", "running", "saving"),
        }


class JobStore:
    def __init__(self) -> None:
        self._jobs: "OrderedDict[str, Job]" = OrderedDict()

    def add(self, job: Job) -> None:
        self._jobs[job.id] = job
        while len(self._jobs) > MAX_JOBS_KEPT:
            old_id, old = next(iter(self._jobs.items()))
            if old.status in ("queued", "running", "saving"):
                break
            self._jobs.popitem(last=False)

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def recent(self, limit: int = 20) -> list[Job]:
        return list(self._jobs.values())[-limit:][::-1]

    def active(self) -> list[Job]:
        return [j for j in self._jobs.values() if j.status in ("queued", "running", "saving")]


# ---- helpers ---------------------------------------------------------------------
def lan_addresses() -> list[str]:
    """This machine's IPv4 addresses on the local network (for opening Darkroom from a phone)."""
    ips: set[str] = set()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))  # no packet is sent; it only picks the outbound interface
            ips.add(s.getsockname()[0])
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    return sorted(ip for ip in ips if not ip.startswith("127.") and not ip.startswith("169.254."))


def load_styles() -> list[dict[str, Any]]:
    path = PRESETS_DIR / "styles.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        log.warning("Could not read %s: %s", path, e)
        data = []
    styles = [s for s in data if isinstance(s, dict) and s.get("id")]
    if not any(s["id"] == "none" for s in styles):
        styles.insert(0, {"id": "none", "name": "None", "prompt": "{prompt}", "negative": "{negative}"})
    return styles


def apply_style(style: dict[str, Any] | None, prompt: str, negative: str) -> tuple[str, str]:
    """Styles are tiny templates: "{prompt}, cinematic, film grain"."""
    if not style:
        return prompt, negative
    p_tpl = str(style.get("prompt") or "{prompt}")
    n_tpl = str(style.get("negative") or "{negative}")
    p = p_tpl.replace("{prompt}", prompt) if "{prompt}" in p_tpl else (f"{prompt}, {p_tpl}" if prompt else p_tpl)
    n = n_tpl.replace("{negative}", negative) if "{negative}" in n_tpl else (f"{negative}, {n_tpl}" if negative else n_tpl)
    return _tidy(p), _tidy(n)


def _tidy(text: str) -> str:
    parts = [p.strip() for p in text.replace("\n", " ").split(",")]
    return ", ".join(p for p in parts if p)


def _int(value: str | None, default: int, lo: int, hi: int, name: str) -> int:
    if value is None or str(value).strip() == "":
        return default
    try:
        f = float(str(value).strip())
        if not math.isfinite(f):
            raise ValueError
        v = int(f)
    except (ValueError, OverflowError):
        raise HTTPException(400, f"{name} must be a whole number") from None
    return max(lo, min(hi, v))


def _float(value: str | None, default: float, lo: float, hi: float, name: str) -> float:
    if value is None or str(value).strip() == "":
        return default
    try:
        v = float(str(value).strip())
        if not math.isfinite(v):
            raise ValueError
    except ValueError:
        raise HTTPException(400, f"{name} must be a number") from None
    return max(lo, min(hi, v))


def _snap(value: int, step: int, lo: int, hi: int) -> int:
    """Round to the nearest multiple of ``step`` and clamp to [lo, hi] (both snapped too)."""
    step = max(1, int(step))
    v = int(round(value / step)) * step
    lo_s = ((lo + step - 1) // step) * step
    hi_s = (hi // step) * step
    return max(lo_s, min(hi_s, v))


def _snap_frames(frames: int, rule: str | None, lo: int, hi: int) -> int:
    if rule == "4n+1":
        n = max(0, int(round((frames - 1) / 4)))
        frames = 4 * n + 1
    elif rule == "8n+1":
        n = max(0, int(round((frames - 1) / 8)))
        frames = 8 * n + 1
    return max(lo, min(hi, frames))


def _parse_seed(value: str | None) -> tuple[int, bool]:
    """'' or '-1' or 'random' -> a fresh random seed; otherwise the given integer."""
    text = (value or "").strip().lower()
    if text in ("", "-1", "random", "rand"):
        return secrets.randbelow(2**32), True  # 32-bit seeds stay exact in browsers and are plenty
    try:
        seed = int(text)
    except ValueError:
        raise HTTPException(400, "Seed must be a whole number (leave empty for random)") from None
    if not 0 <= seed <= MAX_SEED:
        raise HTTPException(400, f"Seed must be between 0 and {MAX_SEED}")
    return seed, False


def _data_url_thumb(data: bytes, max_px: int = 256) -> str | None:
    try:
        import base64
        import io

        from PIL import Image

        with Image.open(io.BytesIO(data)) as im:
            im = im.convert("RGB")
            im.thumbnail((max_px, max_px))
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=80)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        return None


def _image_size(data: bytes) -> tuple[int, int] | None:
    try:
        import io

        from PIL import Image

        with Image.open(io.BytesIO(data)) as im:
            return im.size
    except Exception:
        return None


# ---- application ------------------------------------------------------------------
def create_app(
    *,
    comfy_url: str = DEFAULT_COMFY_URL,
    outputs_dir: Path = DEFAULT_OUTPUTS,
    workflows_dir: Path = WORKFLOWS_DIR,
    allowed_hosts: tuple[str, ...] = (),
    probe_urls: tuple[str, ...] = DEFAULT_PROBE_URLS,
    port: int = 0,
    llm_url: str | None = "auto",
    llm_model: str | None = None,
    llm_allow_remote: bool = False,
    spicy_key: str | None = None,
    spicy_url: str = SPICY_DEFAULT_URL,
) -> FastAPI:
    """Build the FastAPI app.

    ``llm_url``: "auto" probes Ollama / LM Studio on their default localhost ports,
    "off" disables the local-LLM prompt rewriter, or pass an OpenAI-compatible base
    URL such as ``http://127.0.0.1:11434/v1``.
    ``spicy_key``: a SpicyAPI key enables the cloud video tab (and nothing else).
    """
    any_host = any(h in ("0.0.0.0", "::") for h in allowed_hosts)  # the user chose to expose it on the LAN
    llm: LocalLLM | None = None
    if llm_url and llm_url.lower() != "off":
        llm = LocalLLM(None if llm_url.lower() == "auto" else llm_url, llm_model, allow_remote=llm_allow_remote)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.comfy = ComfyClient(comfy_url)
        app.state.probe_urls = probe_urls
        app.state.probe_lock = asyncio.Lock()
        app.state.storage = Storage(outputs_dir)
        app.state.templates, app.state.template_problems = load_templates(workflows_dir)
        for problem in app.state.template_problems:
            log.warning("Workflow template skipped: %s", problem)
        app.state.styles = load_styles()
        app.state.jobs = JobStore()
        app.state.director = Director(llm)
        app.state.spicy = SpicyClient(spicy_key, spicy_url) if spicy_key else None
        app.state.comfy_url = comfy_url
        app.state.outputs_dir = Path(outputs_dir).resolve()
        app.state.lan_urls = [f"http://{ip}:{port}" for ip in lan_addresses()] if any_host and port else []
        log.info("Outputs folder: %s", app.state.outputs_dir)
        log.info("Workflow presets: %s", ", ".join(app.state.templates) or "(none!)")
        try:
            yield
        finally:
            for job in app.state.jobs.active():
                if job.task:
                    job.task.cancel()
            await app.state.comfy.aclose()
            if llm:
                await llm.aclose()
            if app.state.spicy:
                await app.state.spicy.aclose()

    # docs_url/redoc_url/openapi_url disabled: FastAPI's /docs page would load Swagger UI from a CDN.
    app = FastAPI(title="Darkroom", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    # Web pages from other sites can reach 127.0.0.1 through the user's browser (DNS rebinding, cross-site
    # form posts). Only answer when the browser believes it is talking to Darkroom, and only accept
    # state-changing requests from Darkroom's own page.
    local_hosts = {"127.0.0.1", "localhost", "::1"} | {h.lower() for h in allowed_hosts if h}

    @app.middleware("http")
    async def local_only(request: Request, call_next):
        host_header = request.headers.get("host", "")
        try:
            hostname = (urlsplit("//" + host_header).hostname or "").lower()
        except ValueError:
            hostname = ""
        if not any_host and hostname not in local_hosts:
            return JSONResponse({"error": {"message": "Request refused: unexpected Host header", "hint": "Open Darkroom as http://127.0.0.1:<port>."}}, status_code=421)
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            origin = request.headers.get("origin")
            if origin is not None and (urlsplit(origin).netloc or "").lower() != host_header.lower():
                return JSONResponse({"error": {"message": "Request refused: cross-origin request"}}, status_code=403)
            if request.headers.get("sec-fetch-site", "").lower() == "cross-site":
                return JSONResponse({"error": {"message": "Request refused: cross-site request"}}, status_code=403)
            if request.url.path == "/api/generate":
                declared = request.headers.get("content-length", "")
                if declared.isdigit() and int(declared) > MAX_UPLOAD_BYTES + 1024 * 1024:
                    return JSONResponse({"error": {"message": "Source image is too large (64 MB max)"}}, status_code=413)
        return await call_next(request)

    @app.middleware("http")
    async def no_store(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/") and "Cache-Control" not in response.headers:
            response.headers["Cache-Control"] = "no-store"
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        if request.url.path == "/":
            # Same policy as the <meta> tag in index.html, plus frame-ancestors (header-only directive).
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; "
                "style-src 'self'; script-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
            )
            response.headers["X-Frame-Options"] = "DENY"
        return response

    @app.exception_handler(ComfyError)
    async def comfy_error_handler(_: Request, exc: ComfyError):
        status = 503 if exc.__class__.__name__ == "ComfyUnavailable" else 502
        return JSONResponse({"error": exc.to_dict()}, status_code=status)

    @app.exception_handler(HTTPException)
    async def http_error_handler(_: Request, exc: HTTPException):
        return JSONResponse({"error": {"message": str(exc.detail), "hint": None}}, status_code=exc.status_code)

    @app.exception_handler(LLMError)
    async def llm_error_handler(_: Request, exc: LLMError):
        return JSONResponse({"error": exc.to_dict()}, status_code=503)

    @app.exception_handler(SpicyError)
    async def spicy_error_handler(_: Request, exc: SpicyError):
        return JSONResponse({"error": exc.to_dict()}, status_code=exc.status if exc.status and 400 <= exc.status < 500 else 502)

    def cloud_info(app: FastAPI) -> dict[str, Any]:
        """What the page needs to know about the cloud engine. Never contacts the cloud."""
        client: SpicyClient | None = app.state.spicy
        if client is None:
            return {"configured": False}
        return {"configured": True, "service": "SpicyAPI", "host": client.host, "key_hint": client.key_hint, "loopback": client.host in ("127.0.0.1", "localhost", "::1")}

    # ---- pages -----------------------------------------------------------------
    @app.get("/", include_in_schema=False)
    async def index():
        return FileResponse(STATIC_DIR / "index.html", headers={"Cache-Control": "no-cache"})

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    async def _find_comfy_elsewhere(app: FastAPI) -> str | None:
        """ComfyUI is not at the configured URL: look at the other loopback ports and switch if one answers."""
        async with app.state.probe_lock:
            current = app.state.comfy.base_url
            for url in app.state.probe_urls:
                try:
                    candidate = ComfyClient.normalize_url(url)[0]
                except ValueError:
                    continue
                if candidate == current:
                    continue
                probe = ComfyClient(candidate, connect_timeout=1.0)
                if await probe.is_online():
                    old = app.state.comfy
                    app.state.comfy = probe
                    app.state.comfy_url = candidate
                    log.info("ComfyUI did not answer at %s but is running at %s; using that.", current, candidate)
                    await old.aclose()
                    return candidate
                await probe.aclose()
        return None

    # ---- status / options --------------------------------------------------------
    @app.get("/api/status")
    async def api_status(request: Request):
        comfy: ComfyClient = request.app.state.comfy
        info: dict[str, Any] = {
            "online": False,
            "comfy_url": request.app.state.comfy_url,
            "outputs_dir": str(request.app.state.outputs_dir),
            "template_problems": request.app.state.template_problems,
            "active_jobs": [j.id for j in request.app.state.jobs.active()],
            "lan_urls": request.app.state.lan_urls,
            "director": await request.app.state.director.status(),  # local LLM, if one is running (loopback probe, cached)
            "cloud": cloud_info(request.app),  # configured or not; no network call
        }
        try:
            stats = await comfy.system_stats()
        except ComfyError as e:
            found = await _find_comfy_elsewhere(request.app)
            if found is None:
                err = e.to_dict()
                tried = [request.app.state.comfy_url] + [u for u in request.app.state.probe_urls if ComfyClient.normalize_url(u)[0] != request.app.state.comfy_url]
                err["hint"] = f"Looked for it at {', '.join(tried)}. " + (err.get("hint") or "")
                info["error"] = err
                return info
            comfy = request.app.state.comfy
            info["comfy_url"] = found
            info["switched_to"] = found
            try:
                stats = await comfy.system_stats()
            except ComfyError as e2:
                info["error"] = e2.to_dict()
                return info
        info["online"] = True
        system = stats.get("system") or {}
        devices = stats.get("devices") or []
        info["comfy_version"] = system.get("comfyui_version")
        info["python_version"] = (system.get("python_version") or "").split(" ")[0]
        if devices:
            d = devices[0]
            info["device"] = {"name": d.get("name"), "vram_total": d.get("vram_total"), "vram_free": d.get("vram_free")}
        try:
            q = await comfy.queue_state()
            info["queue"] = {"running": len(q.get("queue_running", [])), "pending": len(q.get("queue_pending", []))}
        except ComfyError:
            pass
        return info

    @app.get("/api/options")
    async def api_options(request: Request, fresh: int = 0):
        """Presets, installed model files, samplers and styles. ``?fresh=1`` bypasses the 20 s model-list cache."""
        comfy: ComfyClient = request.app.state.comfy
        templates: dict[str, Template] = request.app.state.templates
        max_age = 0.0 if fresh else 20.0
        online = await comfy.is_online()
        workflows = [t.to_public() for t in ordered(templates)]
        models: dict[str, list[str]] = {}
        samplers: list[str] = []
        schedulers: list[str] = []
        if online:
            for wf in workflows:
                sel = wf.get("model")
                if sel:
                    key = f"{sel['node_class']}.{sel['input']}"
                    if key not in models:
                        try:
                            models[key] = await comfy.input_choices(sel["node_class"], sel["input"], max_age=max_age)
                        except ComfyError as e:
                            log.warning("Could not list %s: %s", key, e)
                            models[key] = []
            try:
                samplers = await comfy.input_choices("KSampler", "sampler_name", max_age=max_age)
                schedulers = await comfy.input_choices("KSampler", "scheduler", max_age=max_age)
            except ComfyError:
                pass
        cloud: dict[str, Any] = cloud_info(request.app)
        if cloud["configured"]:
            workflows += cloud_presets_public()
            cloud.update({
                "video_models": [{"id": k, "label": v["label"], "usd_per_second": v["usd_per_second"]} for k, v in VIDEO_MODELS.items()],
                "frame_models": [{"id": k, "label": v["label"], "usd": v["usd"]} for k, v in FRAME_MODELS.items()],
                "frame_sizes": list(FRAME_SIZES), "resolutions": list(RESOLUTIONS), "aspect_ratios": list(ASPECT_RATIOS),
                "duration": {"min": DURATION_MIN, "max": DURATION_MAX, "smart": SMART_DURATION},
                "fps60_surcharge": 0.2,
            })
        return {
            "online": online,
            "workflows": workflows,
            "models": models,
            "samplers": samplers,
            "schedulers": schedulers,
            "cloud": cloud,
            "styles": [{"id": s["id"], "name": s.get("name", s["id"]), "description": s.get("description", "")} for s in request.app.state.styles],
            "always_negative": ALWAYS_NEGATIVE,
            "template_problems": request.app.state.template_problems,
        }

    # ---- prompt director -------------------------------------------------------------
    @app.post("/api/director")
    async def api_director(
        request: Request,
        prompt: str = Form(""),
        mode: str = Form("txt2img"),
        style: str = Form("none"),
        target: str = Form(""),
        duration: str = Form(""),
        audio: str = Form(""),
        use_llm: str = Form(""),
        source: str = Form(""),
        image: UploadFile | None = File(None),
    ):
        """Expand a short prompt into a structured one.  Never applied silently: the UI
        puts the result in the prompt box for editing.  Rules run locally; the LLM path
        talks to a *local* OpenAI-compatible server only (see director.py)."""
        director: Director = request.app.state.director
        storage: Storage = request.app.state.storage
        prompt = prompt.strip()
        if not prompt and not (image is not None and image.filename) and not source.strip():
            raise HTTPException(400, "Write a few words first")
        if len(prompt) > 8000:
            raise HTTPException(400, "Prompt is too long to expand (8000 characters max)")
        tgt = target.strip() or ("wan3" if mode == CLOUD_MODE else "wan" if mode == "img2vid" else "sdxl")
        if tgt not in ("wan3", "wan", "image", "sdxl"):
            raise HTTPException(400, "Unknown target")
        duration_v = _float(duration, 5.0, 1.0, 60.0, "Duration")
        audio_v = audio.strip().lower() in ("1", "true", "on", "yes")
        want_llm = use_llm.strip().lower() in ("1", "true", "on", "yes")
        image_bytes: bytes | None = None
        image_mime = "image/png"
        has_image = False
        if mode in ("img2vid", "img2img"):
            if image is not None and image.filename:
                image_bytes = await image.read()
                has_image = True
            elif source.strip():
                try:
                    path = storage.resolve(source.strip())
                except ValueError:
                    raise HTTPException(400, "Invalid gallery file") from None
                if path.is_file():
                    image_bytes = await asyncio.to_thread(path.read_bytes)
                    has_image = True
            if image_bytes is not None:
                if len(image_bytes) > MAX_UPLOAD_BYTES or await asyncio.to_thread(_image_size, image_bytes) is None:
                    image_bytes = None  # not a usable image: still expand the text, just without looking at it
                else:
                    image_mime = mimetypes.guess_type(getattr(image, "filename", None) or source or "x.png")[0] or "image/png"
        try:
            composed = await director.direct(
                prompt, use_llm=want_llm, has_image=has_image, duration_s=duration_v, audio=audio_v, style=style, target=tgt,
                image_bytes=image_bytes, image_mime=image_mime,
            )
        except ValueError as e:
            raise HTTPException(400, str(e)) from None
        return composed.to_dict()

    # ---- cloud engine -----------------------------------------------------------------
    @app.get("/api/cloud/account")
    async def api_cloud_account(request: Request):
        """Balance + sandbox flag.  Called by the page when the Cloud tab is opened (one request)."""
        client: SpicyClient | None = request.app.state.spicy
        if client is None:
            raise HTTPException(404, "Cloud engine is not configured (start Darkroom with --spicy-key)")
        acct = await client.account()
        return {"balance_usd": acct.get("balance_usd"), "sandbox": bool(acct.get("sandbox")), "email": acct.get("email"), "limits": acct.get("limits")}

    @app.get("/api/cloud/estimate")
    async def api_cloud_estimate(request: Request, cloud_model: str = "spicy-motion-3", duration: str = "5", resolution: str = "720P", fps60: str = "", frame_model: str = ""):
        if request.app.state.spicy is None:
            raise HTTPException(404, "Cloud engine is not configured")
        d = _int(duration, 5, SMART_DURATION, DURATION_MAX, "Duration")
        return estimate_cost(cloud_model if cloud_model in VIDEO_MODELS else "spicy-motion-3", d, resolution if resolution in RESOLUTIONS else "720P",
                             fps60=fps60.lower() in ("1", "true", "on"), frame_model=frame_model if frame_model in FRAME_MODELS else None)

    # ---- generation ----------------------------------------------------------------
    @app.post("/api/generate")
    async def api_generate(
        request: Request,
        mode: str = Form(...),
        workflow: str = Form(...),
        prompt: str = Form(""),
        negative: str = Form(""),
        steps: str = Form(""),
        cfg: str = Form(""),
        seed: str = Form(""),
        width: str = Form(""),
        height: str = Form(""),
        model: str = Form(""),
        sampler: str = Form(""),
        scheduler: str = Form(""),
        style: str = Form("none"),
        frames: str = Form(""),
        fps: str = Form(""),
        strength: str = Form(""),
        source: str = Form(""),
        image: UploadFile | None = File(None),
        # cloud-only fields
        duration: str = Form(""),
        resolution: str = Form(""),
        aspect: str = Form(""),
        audio: str = Form(""),
        fps60: str = Form(""),
        enhance: str = Form(""),
        cloud_model: str = Form(""),
        frame_prompt: str = Form(""),
        frame_size: str = Form(""),
        frame_model: str = Form(""),
    ):
        templates: dict[str, Template] = request.app.state.templates
        storage: Storage = request.app.state.storage
        if workflow in CLOUD_PRESETS or mode == CLOUD_MODE:
            return await _start_cloud_job(request, workflow=workflow, prompt=prompt, seed=seed, style=style, duration=duration, resolution=resolution, aspect=aspect,
                                          audio=audio, fps60=fps60, enhance=enhance, cloud_model=cloud_model, frame_prompt=frame_prompt, frame_size=frame_size, frame_model=frame_model)
        template = templates.get(workflow)
        if template is None:
            raise HTTPException(400, f"Unknown workflow preset '{workflow}'. Reload the page.")
        if template.mode != mode:
            raise HTTPException(400, f"Workflow '{template.name}' is a {template.mode} preset, not {mode}")
        controls = template.controls
        defaults = template.defaults
        cons = template.constraints

        prompt = prompt.strip()
        negative = negative.strip()
        if controls["prompt"] and not prompt:
            raise HTTPException(400, "Write a prompt first")

        style_obj = next((s for s in request.app.state.styles if s["id"] == style), None)
        final_prompt, final_negative = apply_style(style_obj if style != "none" else None, prompt, negative)
        final_negative = _tidy(f"{final_negative}, {ALWAYS_NEGATIVE}")

        seed_value, random_seed = _parse_seed(seed)
        steps_v = _int(steps, int(defaults["steps"]), 1, 500, "Steps")
        cfg_v = _float(cfg, float(defaults["cfg"]), 0.0, 100.0, "CFG")
        width_v = _snap(_int(width, int(defaults["width"]), 16, 16384, "Width"), cons["size_step"], cons["size_min"], cons["size_max"])
        height_v = _snap(_int(height, int(defaults["height"]), 16, 16384, "Height"), cons["size_step"], cons["size_min"], cons["size_max"])
        frames_v = _snap_frames(_int(frames, int(defaults["frames"]), 1, 4096, "Frames"), cons.get("frames_rule"), cons["frames_min"], cons["frames_max"])
        fps_v = _int(fps, int(defaults["fps"]), 1, 120, "FPS")
        strength_v = round(_float(strength, float(defaults["strength"]), 0.05, 1.0, "Strength"), 3)
        sampler_v = sampler.strip() or str(defaults["sampler"])
        scheduler_v = scheduler.strip() or str(defaults["scheduler"])

        selector = template.model_selector
        model_v = model.strip() if selector else ""  # presets without a Model dropdown record no model
        if selector and not model_v:
            model_v = selector.get("default") or ""
            if not model_v:
                try:
                    choices = await request.app.state.comfy.input_choices(selector["node_class"], selector["input"])
                except ComfyUnavailable:
                    raise  # -> 503 with the "start ComfyUI" hint, not a misleading "no model files"
                except ComfyError:
                    choices = []
                if not choices:
                    raise HTTPException(400, f"No model files found for {selector['node_class']}. Put a model in the right ComfyUI/models folder and press refresh.")
                model_v = choices[0]

        # Source image for image -> image and image -> video.
        image_bytes: bytes | None = None
        image_ext = ".png"
        source_name = ""
        if template.mode in ("img2vid", "img2img"):
            if image is not None and image.filename:
                image_bytes = await image.read()
                image_ext = Path(image.filename).suffix.lower() or ".png"
                source_name = image.filename
            elif source.strip():
                try:
                    path = storage.resolve(source.strip())
                except ValueError:
                    raise HTTPException(400, "Invalid gallery file") from None
                if not path.is_file():
                    raise HTTPException(404, "That gallery image no longer exists")
                try:
                    image_bytes = await asyncio.to_thread(path.read_bytes)
                except OSError as e:
                    raise HTTPException(500, f"Could not read {path.name}: {e.strerror or e}") from None
                image_ext = path.suffix.lower()
                source_name = path.name
            if not image_bytes:
                raise HTTPException(400, "Choose a source image first (upload one or pick one from the gallery)")
            if len(image_bytes) > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "Source image is too large (64 MB max)")
            if image_ext not in ALLOWED_IMAGE_EXT or await asyncio.to_thread(_image_size, image_bytes) is None:
                raise HTTPException(400, "Source must be a PNG, JPEG, WEBP or BMP image")

        job = Job(
            id=uuid.uuid4().hex[:12],
            mode=template.mode,
            workflow_id=template.id,
            workflow_name=template.name,
            params={
                "prompt": prompt,
                "negative": negative,
                "final_prompt": final_prompt,
                "final_negative": final_negative,
                "style": style if style_obj else "none",
                "seed": seed_value,
                "random_seed": random_seed,
                "steps": steps_v,
                "cfg": cfg_v,
                "width": width_v,
                "height": height_v,
                "model": model_v,
                "sampler": sampler_v,
                "scheduler": scheduler_v,
                "frames": frames_v,
                "fps": fps_v,
                "strength": strength_v if template.mode == "img2img" else None,
                "source_image": source_name,
            },
        )
        if image_bytes:
            job.source_thumb = await asyncio.to_thread(_data_url_thumb, image_bytes)  # PIL decode off the event loop

        values = {
            "PROMPT": final_prompt,
            "NEGATIVE": final_negative,
            "SEED": seed_value,
            "STEPS": steps_v,
            "CFG": cfg_v,
            "WIDTH": width_v,
            "HEIGHT": height_v,
            "MODEL": model_v,
            "SAMPLER": sampler_v,
            "SCHEDULER": scheduler_v,
            "FRAMES": frames_v,
            "FPS": fps_v,
            "DENOISE": strength_v,
            "FILENAME_PREFIX": f"darkroom/{template.mode}",
            "IMAGE": "",  # filled in after upload
        }
        request.app.state.jobs.add(job)
        job.task = asyncio.create_task(_run_job(request.app, job, template, values, image_bytes, image_ext))
        return job.to_dict()

    async def _run_job(app: FastAPI, job: Job, template: Template, values: dict[str, Any], image_bytes: bytes | None, image_ext: str) -> None:
        comfy: ComfyClient = app.state.comfy
        storage: Storage = app.state.storage

        def on_event(name: str, data: dict[str, Any]) -> None:
            if name == "queued":
                job.prompt_id = data["prompt_id"]
                job.progress = {"value": 0, "max": 0, "label": "Queued in ComfyUI", "node": None}
            elif name == "warning":
                job.warnings.append(data["message"])
                log.warning("Job %s: %s", job.id, data["message"])
            elif name == "position":
                job.position = data["position"]
                if job.position == 0 and job.status == "queued":
                    job.status = "running"
                if job.position and job.status == "queued":
                    job.progress = {"value": 0, "max": 0, "label": f"Waiting: {job.position} ahead in the ComfyUI queue", "node": None}
            elif name == "progress":
                job.status = "running"
                job.position = 0
                job.progress = {"value": data["value"], "max": data["max"], "label": data["label"], "node": data["node"]}
            elif name == "preview":
                job.preview = data["data_url"]
            elif name == "done":
                job.status = "saving"
                job.progress = {"value": job.progress.get("max", 0), "max": job.progress.get("max", 0), "label": "Saving to gallery", "node": None}

        try:
            if image_bytes is not None:
                job.progress = {"value": 0, "max": 0, "label": "Uploading source image to ComfyUI", "node": None}
                values["IMAGE"] = await comfy.upload_image(image_bytes, f"darkroom_{job.id}{image_ext}")
            graph = template.render(values)
            prompt_id, outputs = await comfy.run(graph, on_event, node_classes=template.node_classes())
            job.status = "saving"
            for out in outputs:
                data = await comfy.view(out)
                ext = Path(out.filename).suffix or (".mp4" if out.kind == "video" else ".png")
                meta = {
                    **job.params,
                    "label": job.params["prompt"] or Path(job.params.get("source_image") or "").stem or "untitled",
                    "mode": job.mode,
                    "workflow": job.workflow_id,
                    "workflow_name": job.workflow_name,
                    "kind": out.kind,
                    "comfy_file": f"{out.subfolder}/{out.filename}".strip("/"),
                    "prompt_id": prompt_id,
                    "job_id": job.id,
                }
                poster = image_bytes if out.kind in ("video", "animation") else None
                record = await asyncio.to_thread(storage.save, data, ext, meta, poster)
                job.results.append(record)
            await asyncio.to_thread(
                storage.add_history,
                {
                    "mode": job.mode,
                    "workflow": job.workflow_id,
                    "prompt": job.params["prompt"],
                    "negative": job.params["negative"],
                    "style": job.params["style"],
                    "seed": job.params["seed"],
                    "steps": job.params["steps"],
                    "cfg": job.params["cfg"],
                    "width": job.params["width"],
                    "height": job.params["height"],
                    "model": job.params["model"],
                    "sampler": job.params["sampler"],
                    "scheduler": job.params["scheduler"],
                    "frames": job.params["frames"],
                    "fps": job.params["fps"],
                    "strength": job.params["strength"],
                    "source_image": job.params["source_image"],
                    "file": job.results[0]["file"] if job.results else None,
                },
            )
            job.status = "done"
            job.progress = {"value": 1, "max": 1, "label": "Done", "node": None}
            log.info("Job %s done: %s", job.id, ", ".join(r["file"] for r in job.results))
        except asyncio.CancelledError:
            job.status = "cancelled"
            job.progress = {"value": 0, "max": 0, "label": "Cancelled", "node": None}
        except ComfyInterrupted as e:
            job.status = "cancelled" if job.cancel_requested else "error"
            job.error = None if job.cancel_requested else e.to_dict()
            job.progress = {"value": 0, "max": 0, "label": "Interrupted", "node": None}
        except (ComfyError, TemplateError) as e:
            job.status = "error"
            job.error = e.to_dict() if isinstance(e, ComfyError) else {"message": str(e), "hint": "Fix the template JSON in darkroom/workflows/ and restart Darkroom."}
            job.progress = {"value": 0, "max": 0, "label": "Failed", "node": None}
            log.warning("Job %s failed: %s", job.id, e)
        except Exception as e:  # noqa: BLE001 - last resort, surface it to the UI
            job.status = "error"
            job.error = {"message": f"Unexpected error: {e.__class__.__name__}: {e}", "hint": "See the Darkroom console for the traceback."}
            log.error("Job %s crashed:\n%s", job.id, traceback.format_exc())
        finally:
            job.finished = time.time()
            job.preview = None

    async def _start_cloud_job(request: Request, *, workflow: str, prompt: str, seed: str, style: str, duration: str, resolution: str, aspect: str,
                               audio: str, fps60: str, enhance: str, cloud_model: str, frame_prompt: str, frame_size: str, frame_model: str) -> dict[str, Any]:
        client: SpicyClient | None = request.app.state.spicy
        if client is None:
            raise HTTPException(400, "The cloud engine is not configured. Start Darkroom with --spicy-key (or set SPICYAPI_KEY) to use it.")
        spec = CLOUD_PRESETS.get(workflow)
        if spec is None:
            raise HTTPException(400, f"Unknown cloud preset '{workflow}'. Reload the page.")
        kind = spec["kind"]
        prompt = prompt.strip()
        frame_prompt = frame_prompt.strip()
        if not prompt:
            raise HTTPException(400, "Write a motion prompt first")
        if kind == "frame" and not frame_prompt:
            raise HTTPException(400, "Write a frame prompt (what the first picture shows) or switch to Text → Video")
        for text in (prompt, frame_prompt):
            bad = blocked_term(text)
            if bad:
                raise HTTPException(400, f"The prompt contains '{bad}'. Darkroom only generates adults; remove that word.")
        style_obj = next((s for s in request.app.state.styles if s["id"] == style), None)
        final_prompt, _ = apply_style(style_obj if style != "none" else None, prompt, "")
        final_frame_prompt, _ = apply_style(style_obj if style != "none" else None, frame_prompt, "") if frame_prompt else ("", "")
        seed_value, random_seed = _parse_seed(seed)
        truthy = lambda v: v.strip().lower() in ("1", "true", "on", "yes")  # noqa: E731
        model_v = cloud_model.strip() if cloud_model.strip() in VIDEO_MODELS else "spicy-motion-3"
        duration_v = _int(duration, 5, SMART_DURATION, DURATION_MAX, "Duration")
        if duration_v not in (SMART_DURATION,) and duration_v < DURATION_MIN:
            raise HTTPException(400, f"Duration must be {DURATION_MIN}-{DURATION_MAX} seconds, or auto")
        resolution_v = resolution.strip().upper() if resolution.strip().upper() in RESOLUTIONS else "720P"
        aspect_v = aspect.strip() if aspect.strip() in ASPECT_RATIOS else ""
        audio_v = truthy(audio) if audio.strip() else True
        fps60_v = truthy(fps60)
        enhance_v = truthy(enhance)
        frame_model_v = frame_model.strip() if frame_model.strip() in FRAME_MODELS else "spicy-image-1"
        frame_size_v = frame_size.strip() if frame_size.strip() in FRAME_SIZES else "832*1216"
        if fps60_v and resolution_v == "1080P" and aspect_v == "21:9":
            raise HTTPException(400, "60 fps is not available at 1080P 21:9 (over the pixel limit); use 720P or 30 fps")
        est = estimate_cost(model_v, duration_v, resolution_v, fps60=fps60_v, frame_model=frame_model_v if kind == "frame" else None)
        job = Job(
            id=uuid.uuid4().hex[:12],
            mode=CLOUD_MODE,
            engine="spicy",
            workflow_id=workflow,
            workflow_name=spec["name"],
            params={
                "prompt": prompt, "negative": "", "final_prompt": final_prompt, "final_negative": "", "style": style if style_obj else "none",
                "seed": seed_value, "random_seed": random_seed, "steps": None, "cfg": None, "width": None, "height": None, "model": model_v,
                "sampler": None, "scheduler": None, "frames": None, "fps": 60 if fps60_v else 30, "strength": None, "source_image": "",
                "duration": duration_v, "resolution": resolution_v, "aspect": aspect_v or None, "audio": audio_v, "enhance": enhance_v,
                "frame_prompt": frame_prompt or None, "final_frame_prompt": final_frame_prompt or None, "frame_model": frame_model_v if kind == "frame" else None,
                "frame_size": frame_size_v if kind == "frame" else None, "estimate_usd": est["usd"], "service": "SpicyAPI",
            },
        )
        job.progress = {"value": 0, "max": 0, "label": "Checking the prompt with SpicyAPI's screen", "node": None}
        request.app.state.jobs.add(job)
        job.task = asyncio.create_task(_run_cloud_job(request.app, job, kind))
        return job.to_dict()

    def _cloud_cancel_note(job: Job) -> str:
        if job.cloud_task_id:
            return "Cancelled. SpicyAPI keeps rendering and billing the task; the clip will appear in your SpicyAPI library."
        return "Cancelled. " + ("Nothing was charged." if not job.cost_usd else "The first frame was already charged.")

    async def _run_cloud_job(app: FastAPI, job: Job, kind: str) -> None:
        """Frame (optional) -> video task -> poll -> download -> save. Every step reports to the UI."""
        client: SpicyClient = app.state.spicy
        storage: Storage = app.state.storage
        p = job.params
        frame_bytes: bytes | None = None
        frame_url: str | None = None
        debited = 0.0
        try:
            # 1. Pre-check with the moderation endpoint: $0.001, never a strike, so a refusal costs nothing.
            texts = [p["final_prompt"]] + ([p["final_frame_prompt"]] if kind == "frame" else [])
            for text in texts:
                mod = await client.moderate(text)
                problem = SpicyClient.moderation_problem(mod)
                if problem:
                    raise problem
            if job.cancel_requested:
                raise asyncio.CancelledError
            # 2. First frame on SpicyAPI (the only image source it accepts).
            if kind == "frame":
                job.status = "running"
                job.progress = {"value": 0, "max": 0, "label": f"Rendering the first frame on SpicyAPI ({p['frame_model']}, ${FRAME_MODELS[p['frame_model']]['usd']:.2f})", "node": None}
                img = await client.generate_image(p["frame_model"], p["final_frame_prompt"], p["frame_size"], seed=None if p["random_seed"] else p["seed"], enhance_prompt=p["enhance"])
                frame_url = img["url"]
                job.cost_usd = float(img.get("cost_usd") or 0)
                frame_bytes = await client.download(frame_url)
                job.source_thumb = await asyncio.to_thread(_data_url_thumb, frame_bytes)
                frame_meta = {**p, "label": p["frame_prompt"], "prompt": p["frame_prompt"], "final_prompt": p["final_frame_prompt"], "mode": CLOUD_MODE, "engine": "spicy",
                              "workflow": job.workflow_id, "workflow_name": job.workflow_name, "kind": "image", "cloud_url": frame_url, "cloud_id": img.get("id"),
                              "cost_usd": img.get("cost_usd"), "job_id": job.id, "model": p["frame_model"]}
                job.results.append(await asyncio.to_thread(storage.save, frame_bytes, ".png", frame_meta, None))
                if job.cancel_requested:
                    raise asyncio.CancelledError
            # 3. Video task.
            job.status = "running"
            job.progress = {"value": 0, "max": 0, "label": "Starting the video task at SpicyAPI", "node": None}
            task = await client.create_video(
                p["model"], p["final_prompt"], image_url=frame_url, duration=p["duration"], resolution=p["resolution"], aspect_ratio=None if frame_url else p["aspect"],
                audio=p["audio"], fps60=p["fps"] == 60, enhance_prompt=p["enhance"], seed=None if p["random_seed"] else p["seed"],
            )
            job.cloud_task_id = str(task.get("id"))
            job.prompt_id = job.cloud_task_id
            debited = float(task.get("cost_usd") or 0)
            job.cost_usd = round((job.cost_usd or 0) + debited, 3)
            started = time.time()

            def on_status(t: dict[str, Any]) -> None:
                status = str(t.get("status") or "")
                label = STATUS_LABELS_CLOUD.get(status, f"SpicyAPI: {status}")
                mins = int((time.time() - started) // 60)
                job.progress = {"value": 0, "max": 0, "label": f"{label} · ${debited:.2f} debited" + (f" · {mins} min" if mins else ""), "node": None}

            final = await client.wait(job.cloud_task_id, on_status)
            if job.cancel_requested:
                raise asyncio.CancelledError
            job.status = "saving"
            job.progress = {"value": 0, "max": 0, "label": "Downloading the clip", "node": None}
            video_url = str(((final.get("output") or {}).get("video_url")) or "")
            if not video_url:
                raise SpicyError("SpicyAPI reported success but gave no video URL", "Check your SpicyAPI library; the clip may be there.")
            data = await client.download(video_url)
            settled = final.get("cost_usd")
            if settled is not None:
                job.cost_usd = round(float(settled) + (float(job.cost_usd or 0) - debited), 3)  # smart duration settles to the rendered length
            usage = final.get("usage") or {}
            ext = Path(urlsplit(video_url).path).suffix or ".mp4"
            meta = {
                **p, "label": p["prompt"], "mode": CLOUD_MODE, "engine": "spicy", "workflow": job.workflow_id, "workflow_name": job.workflow_name, "kind": "video",
                "cloud_url": video_url, "cloud_task_id": job.cloud_task_id, "cost_usd": job.cost_usd, "job_id": job.id,
                "duration": usage.get("output_seconds") or p["duration"], "resolution": usage.get("resolution") or p["resolution"], "fps": usage.get("fps") or p["fps"],
                "frame_file": job.results[0]["file"] if job.results else None, "source_image": job.results[0]["file"] if job.results else "",
            }
            record = await asyncio.to_thread(storage.save, data, ext, meta, frame_bytes)
            job.results.append(record)
            await asyncio.to_thread(storage.add_history, {
                "mode": CLOUD_MODE, "engine": "spicy", "workflow": job.workflow_id, "prompt": p["prompt"], "negative": "", "style": p["style"], "seed": p["seed"],
                "steps": None, "cfg": None, "width": None, "height": None, "model": p["model"], "sampler": None, "scheduler": None, "frames": None, "fps": p["fps"],
                "strength": None, "source_image": "", "duration": p["duration"], "resolution": p["resolution"], "aspect": p["aspect"], "audio": p["audio"],
                "frame_prompt": p["frame_prompt"], "frame_model": p["frame_model"], "frame_size": p["frame_size"], "cost_usd": job.cost_usd, "file": record["file"],
            })
            job.status = "done"
            job.progress = {"value": 1, "max": 1, "label": f"Done · ${job.cost_usd:.2f}" if job.cost_usd is not None else "Done", "node": None}
            log.info("Cloud job %s done: %s ($%s)", job.id, record["file"], job.cost_usd)
        except asyncio.CancelledError:
            job.status = "cancelled"
            job.progress = {"value": 0, "max": 0, "label": _cloud_cancel_note(job), "node": None}
        except SpicyError as e:
            job.status = "error"
            job.error = e.to_dict()
            if isinstance(e, SpicyFailed) and job.cloud_task_id:
                job.cost_usd = round(max(0.0, float(job.cost_usd or 0) - debited), 3)  # SpicyAPI refunds a failed task
            job.progress = {"value": 0, "max": 0, "label": "Failed", "node": None}
            log.warning("Cloud job %s failed: %s", job.id, e)
        except Exception as e:  # noqa: BLE001
            job.status = "error"
            job.error = {"message": f"Unexpected error: {e.__class__.__name__}: {e}", "hint": "See the Darkroom console for the traceback."}
            log.error("Cloud job %s crashed:\n%s", job.id, traceback.format_exc())
        finally:
            job.finished = time.time()
            job.preview = None

    @app.get("/api/jobs")
    async def api_jobs(request: Request, limit: int = 20):
        return {"jobs": [j.to_dict(preview=False) for j in request.app.state.jobs.recent(limit)]}

    @app.get("/api/jobs/{job_id}")
    async def api_job(request: Request, job_id: str):
        job = request.app.state.jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Unknown job (Darkroom was restarted?)")
        return job.to_dict()

    @app.post("/api/jobs/{job_id}/cancel")
    async def api_cancel(request: Request, job_id: str):
        comfy: ComfyClient = request.app.state.comfy
        job: Job | None = request.app.state.jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Unknown job")
        if job.status in ("done", "error", "cancelled", "saving"):
            return job.to_dict()  # 'saving' = ComfyUI is already finished; let the file land
        job.cancel_requested = True
        if job.engine == "spicy":
            # SpicyAPI has no cancel endpoint: stop waiting; the task finishes (and bills) on their side.
            if job.task and not job.task.done():
                job.task.cancel()
            job.status = "cancelled"
            job.finished = time.time()
            job.progress = {"value": 0, "max": 0, "label": _cloud_cancel_note(job), "node": None}
            return job.to_dict()
        if job.prompt_id:
            try:
                pos = await comfy.queue_position(job.prompt_id)
                if pos == 0:
                    await comfy.interrupt(job.prompt_id)  # it is the one running right now
                elif pos is not None:
                    await comfy.delete_queued(job.prompt_id)  # still waiting: just drop it from the queue
            except ComfyError as e:
                log.warning("Cancel: %s", e)
        if job.status in ("done", "error", "cancelled", "saving"):
            return job.to_dict()  # it finished while we were talking to ComfyUI
        if job.task and not job.task.done():
            job.task.cancel()
        job.status = "cancelled"
        job.finished = time.time()
        job.progress = {"value": 0, "max": 0, "label": "Cancelled", "node": None}
        return job.to_dict()

    # ---- gallery -------------------------------------------------------------------
    @app.get("/api/gallery")
    async def api_gallery(request: Request, limit: int = 60, offset: int = 0, kind: str | None = None):
        storage: Storage = request.app.state.storage
        return await asyncio.to_thread(storage.list_items, max(1, min(500, limit)), max(0, offset), kind or None)

    @app.get("/api/gallery/{name}")
    async def api_gallery_file(request: Request, name: str, download: int = 0):
        storage: Storage = request.app.state.storage
        try:
            path = storage.resolve(name)
        except ValueError:
            raise HTTPException(400, "Invalid file name") from None
        if not path.is_file():
            raise HTTPException(404, "File not found")
        media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        headers = {"Cache-Control": "private, max-age=3600"}
        if download:
            return FileResponse(path, media_type=media_type, filename=path.name, headers=headers)
        return FileResponse(path, media_type=media_type, headers=headers)

    @app.get("/api/gallery/{name}/meta")
    async def api_gallery_meta(request: Request, name: str):
        storage: Storage = request.app.state.storage
        try:
            path = storage.resolve(name)
        except ValueError:
            raise HTTPException(400, "Invalid file name") from None
        if not path.is_file():
            raise HTTPException(404, "File not found")
        return storage.record(path)

    @app.delete("/api/gallery/{name}")
    async def api_gallery_delete(request: Request, name: str):
        storage: Storage = request.app.state.storage
        try:
            await asyncio.to_thread(storage.delete, name)
        except ValueError:
            raise HTTPException(400, "Invalid file name") from None
        except StorageError as e:
            raise HTTPException(409, f"Could not delete {name}: {e}. Close the program that has it open and try again.") from None
        return {"ok": True}

    @app.get("/api/thumbs/{name}")
    async def api_thumb(request: Request, name: str):
        storage: Storage = request.app.state.storage
        try:
            thumb = await asyncio.to_thread(storage.thumb_path, name)
        except ValueError:
            raise HTTPException(400, "Invalid file name") from None
        if thumb is None:
            raise HTTPException(404, "No thumbnail")
        return FileResponse(thumb, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})

    # ---- prompt history --------------------------------------------------------------
    @app.get("/api/history")
    async def api_history(request: Request):
        return {"items": request.app.state.storage.history()}

    @app.delete("/api/history")
    async def api_history_clear(request: Request):
        request.app.state.storage.clear_history()
        return {"ok": True}

    return app


# ---- entry point --------------------------------------------------------------------
def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Darkroom: private local frontend for ComfyUI")
    p.add_argument("--comfy", default=DEFAULT_COMFY_URL, help=f"ComfyUI base URL (default {DEFAULT_COMFY_URL})")
    p.add_argument("--host", default=DEFAULT_HOST, help="Interface to listen on (default 127.0.0.1 = this machine only)")
    p.add_argument("--lan", action="store_const", const="0.0.0.0", dest="host", help="Also reachable from phones/tablets on your Wi-Fi (same as --host 0.0.0.0)")
    p.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Port for the Darkroom UI (default {DEFAULT_PORT})")
    p.add_argument("--outputs", default=str(DEFAULT_OUTPUTS), help="Folder for results + gallery (default ./outputs)")
    p.add_argument("--no-browser", action="store_true", help="Do not open the UI in your browser on start")
    p.add_argument("--verbose", action="store_true", help="Log every HTTP request")
    p.add_argument("--llm", default=os.environ.get("DARKROOM_LLM", "auto"), metavar="URL|auto|off",
                   help="Local LLM for the prompt expander: 'auto' looks for Ollama/LM Studio on this machine, 'off' hides it, or an OpenAI-compatible base URL like http://127.0.0.1:11434/v1 (default auto)")
    p.add_argument("--llm-model", default=os.environ.get("DARKROOM_LLM_MODEL"), help="Model tag for the local LLM (default: the first one the server lists)")
    p.add_argument("--llm-allow-remote", action="store_true", help="Allow --llm to point at another computer on your LAN (prompts then leave this PC)")
    p.add_argument("--spicy-key", default=os.environ.get("SPICYAPI_KEY"), metavar="sk-spicy-...",
                   help="Enable the optional CLOUD video tab (SpicyAPI, paid, sends prompts over the internet). Default: the SPICYAPI_KEY variable; unset = no cloud at all")
    p.add_argument("--spicy-url", default=os.environ.get("SPICYAPI_URL", SPICY_DEFAULT_URL), help=argparse.SUPPRESS)  # for the dev mock
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s", datefmt="%H:%M:%S")
    try:
        args.comfy = ComfyClient.normalize_url(args.comfy)[0]
    except ValueError as e:
        sys.exit(f"error: {e}")
    url = f"http://{'127.0.0.1' if args.host in ('0.0.0.0', '::') else args.host}:{args.port}"
    lan = [f"http://{ip}:{args.port}" for ip in lan_addresses()] if args.host in ("0.0.0.0", "::") else []
    if args.host not in ("127.0.0.1", "localhost", "::1"):
        log.warning("Listening on %s: anyone on your network can open Darkroom (there is no login). Use 127.0.0.1 for private use.", args.host)
    try:
        app = create_app(comfy_url=args.comfy, outputs_dir=Path(args.outputs), allowed_hosts=(args.host,), port=args.port,
                         llm_url=args.llm, llm_model=args.llm_model, llm_allow_remote=args.llm_allow_remote,
                         spicy_key=(args.spicy_key or "").strip() or None, spicy_url=args.spicy_url)
    except ValueError as e:
        sys.exit(f"error: {e}")
    cloud = ""
    if (args.spicy_key or "").strip():
        cloud = f"\n  Cloud     ->  SpicyAPI at {args.spicy_url} (ONLY the Cloud video tab uses the internet; paid)"
        log.warning("Cloud engine enabled: prompts typed in the Cloud video tab are sent to SpicyAPI and cost money.")
    phone = ("\n  Phone     ->  " + "  or  ".join(lan) + "  (same Wi-Fi; allow it if Windows Firewall asks)") if lan else ""
    print(f"\n  Darkroom  ->  {url}{phone}\n  ComfyUI   ->  {args.comfy}{cloud}\n  Outputs   ->  {Path(args.outputs).resolve()}\n", flush=True)
    if not args.no_browser:
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info" if args.verbose else "warning", access_log=args.verbose, server_header=False)


if __name__ == "__main__":
    main()
