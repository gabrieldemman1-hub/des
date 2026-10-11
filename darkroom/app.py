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
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from comfy_client import ComfyClient, ComfyError, ComfyInterrupted, ComfyUnavailable
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

    def to_dict(self, *, preview: bool = True) -> dict[str, Any]:
        return {
            "id": self.id,
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
def create_app(*, comfy_url: str = DEFAULT_COMFY_URL, outputs_dir: Path = DEFAULT_OUTPUTS, workflows_dir: Path = WORKFLOWS_DIR, allowed_hosts: tuple[str, ...] = (), probe_urls: tuple[str, ...] = DEFAULT_PROBE_URLS, port: int = 0) -> FastAPI:
    any_host = any(h in ("0.0.0.0", "::") for h in allowed_hosts)  # the user chose to expose it on the LAN

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
        return {
            "online": online,
            "workflows": workflows,
            "models": models,
            "samplers": samplers,
            "schedulers": schedulers,
            "styles": [{"id": s["id"], "name": s.get("name", s["id"]), "description": s.get("description", "")} for s in request.app.state.styles],
            "always_negative": ALWAYS_NEGATIVE,
            "template_problems": request.app.state.template_problems,
        }

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
    ):
        templates: dict[str, Template] = request.app.state.templates
        storage: Storage = request.app.state.storage
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
    app = create_app(comfy_url=args.comfy, outputs_dir=Path(args.outputs), allowed_hosts=(args.host,), port=args.port)
    phone = ("\n  Phone     ->  " + "  or  ".join(lan) + "  (same Wi-Fi; allow it if Windows Firewall asks)") if lan else ""
    print(f"\n  Darkroom  ->  {url}{phone}\n  ComfyUI   ->  {args.comfy}\n  Outputs   ->  {Path(args.outputs).resolve()}\n", flush=True)
    if not args.no_browser:
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info" if args.verbose else "warning", access_log=args.verbose, server_header=False)


if __name__ == "__main__":
    main()
