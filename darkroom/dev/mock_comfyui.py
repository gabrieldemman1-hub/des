#!/usr/bin/env python3
"""
A fake ComfyUI server, for trying Darkroom without a GPU or a real ComfyUI.

    python dev/mock_comfyui.py            # listens on http://127.0.0.1:8188 like the real thing
    python app.py                         # in another terminal: Darkroom connects to it as usual

It speaks the subset of the ComfyUI HTTP/WebSocket API that Darkroom uses
(/system_stats, /object_info, /prompt, /ws, /history, /view, /upload/image,
/queue, /interrupt) and "renders" placeholder images / videos with Pillow (and
ffmpeg for .mp4 when it is installed).  It is only a development aid; it does
not generate anything real and is not needed to use Darkroom.

Handy test prompts:  put the word FAIL in the prompt to get an execution
error, SLOW to get a 60-step job you can cancel.
"""
from __future__ import annotations

import argparse
import asyncio
import io
import json
import math
import os
import random
import shutil
import subprocess
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, File, Form, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from PIL import Image, ImageDraw

CHOICES: dict[tuple[str, str], list[str]] = {
    ("CheckpointLoaderSimple", "ckpt_name"): ["mock_sdxl_v1.safetensors", "mock_illustrious_xl.safetensors", "mock_sd15.safetensors"],
    ("UNETLoader", "unet_name"): ["wan2.2_ti2v_5B_fp16.safetensors", "wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors", "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors"],
    ("ImageOnlyCheckpointLoader", "ckpt_name"): ["svd_xt.safetensors", "svd_xt_1_1.safetensors"],
    ("KSampler", "sampler_name"): ["euler", "euler_ancestral", "dpmpp_2m", "dpmpp_2m_sde", "dpmpp_sde", "uni_pc", "ddim", "lcm"],
    ("KSampler", "scheduler"): ["normal", "karras", "exponential", "sgm_uniform", "simple", "ddim_uniform", "beta"],
    ("CLIPLoader", "clip_name"): ["umt5_xxl_fp8_e4m3fn_scaled.safetensors"],
    ("VAELoader", "vae_name"): ["wan2.2_vae.safetensors", "wan_2.1_vae.safetensors"],
    ("CLIPVisionLoader", "clip_name"): ["clip_vision_h.safetensors"],
}
KNOWN_CLASSES = {
    "CheckpointLoaderSimple", "UNETLoader", "ImageOnlyCheckpointLoader", "CLIPLoader", "VAELoader", "CLIPVisionLoader", "LoadImage",
    "CLIPTextEncode", "CLIPSetLastLayer", "CLIPVisionEncode", "EmptyLatentImage", "KSampler", "KSamplerAdvanced", "VAEDecode", "SaveImage", "PreviewImage", "ModelSamplingSD3",
    "WanImageToVideo", "Wan22ImageToVideoLatent", "SVD_img2vid_Conditioning", "VideoLinearCFGGuidance", "CreateVideo", "SaveVideo",
    "SaveAnimatedWEBP", "SaveAnimatedPNG", "SaveWEBM", "LoraLoader", "LoraLoaderModelOnly",
}
ORDER = ["CheckpointLoaderSimple", "UNETLoader", "ImageOnlyCheckpointLoader", "CLIPLoader", "VAELoader", "CLIPVisionLoader", "LoraLoader", "LoraLoaderModelOnly",
         "LoadImage", "CLIPSetLastLayer", "CLIPTextEncode", "CLIPVisionEncode", "EmptyLatentImage", "WanImageToVideo", "Wan22ImageToVideoLatent", "SVD_img2vid_Conditioning",
         "ModelSamplingSD3", "VideoLinearCFGGuidance", "KSampler", "KSamplerAdvanced", "VAEDecode", "CreateVideo", "SaveImage", "PreviewImage", "SaveVideo", "SaveAnimatedWEBP", "SaveAnimatedPNG", "SaveWEBM"]


class Mock:
    def __init__(self, data_dir: Path, step_delay: float):
        self.data_dir = data_dir
        self.output = data_dir / "output"
        self.input = data_dir / "input"
        self.temp = data_dir / "temp"
        for d in (self.output, self.input, self.temp):
            d.mkdir(parents=True, exist_ok=True)
        self.step_delay = step_delay
        self.queue: list[dict[str, Any]] = []
        self.running: dict[str, Any] | None = None
        self.history: dict[str, dict[str, Any]] = {}
        self.sockets: dict[str, WebSocket] = {}
        self.counter = 0
        self.number = 0
        self.interrupt_flag = False
        self.ffmpeg = shutil.which("ffmpeg")

    # ---- messaging ----------------------------------------------------------------
    async def send(self, client_id: str | None, mtype: str, data: dict[str, Any]) -> None:
        ws = self.sockets.get(client_id or "")
        if ws is None:
            return
        try:
            await ws.send_text(json.dumps({"type": mtype, "data": data}))
        except Exception:
            self.sockets.pop(client_id or "", None)

    async def send_binary(self, client_id: str | None, payload: bytes) -> None:
        ws = self.sockets.get(client_id or "")
        if ws is None:
            return
        try:
            await ws.send_bytes(payload)
        except Exception:
            self.sockets.pop(client_id or "", None)

    async def broadcast_status(self) -> None:
        remaining = len(self.queue) + (1 if self.running else 0)
        for cid, ws in list(self.sockets.items()):
            try:
                await ws.send_text(json.dumps({"type": "status", "data": {"status": {"exec_info": {"queue_remaining": remaining}}, "sid": cid}}))
            except Exception:
                self.sockets.pop(cid, None)

    # ---- validation (mirrors ComfyUI's error shape) -----------------------------
    def validate(self, prompt: Any) -> dict[str, Any] | None:
        if not isinstance(prompt, dict) or not prompt:
            return {"error": {"type": "invalid_prompt", "message": "Cannot execute because the prompt is empty or not an object.", "details": "", "extra_info": {}}, "node_errors": {}}
        node_errors: dict[str, Any] = {}
        has_output = False
        for nid, node in prompt.items():
            if not isinstance(node, dict) or "class_type" not in node:
                return {"error": {"type": "invalid_prompt", "message": f"Cannot execute because node {nid} does not have a class_type.", "details": f"Node ID '#{nid}'", "extra_info": {}}, "node_errors": {}}
            cls = node["class_type"]
            if cls not in KNOWN_CLASSES:  # same shape as current ComfyUI's validate_prompt
                return {"error": {"type": "missing_node_type", "message": f"Node '{cls}' not found. The custom node may not be installed.", "details": f"Node ID '#{nid}'", "extra_info": {"node_id": nid, "class_type": cls, "node_title": cls}}, "node_errors": {}}
            if cls.startswith("Save") or cls == "PreviewImage":
                has_output = True
            errors = []
            for (ccls, inp), choices in CHOICES.items():
                if cls == ccls and inp in node.get("inputs", {}):
                    val = node["inputs"][inp]
                    if val not in choices:
                        errors.append({"type": "value_not_in_list", "message": "Value not in list", "details": f"{inp}: '{val}' not in {choices}", "extra_info": {"input_name": inp, "input_config": [choices], "received_value": val}})
            for inp, val in node.get("inputs", {}).items():
                if isinstance(val, str) and "{{" in val:
                    errors.append({"type": "value_not_in_list", "message": "Value not in list", "details": f"{inp}: unreplaced template token {val!r}", "extra_info": {}})
            if errors:
                node_errors[nid] = {"errors": errors, "dependent_outputs": [], "class_type": cls}
        if not has_output:
            return {"error": {"type": "prompt_no_outputs", "message": "Prompt has no outputs", "details": "", "extra_info": {}}, "node_errors": {}}
        if node_errors:
            return {"error": {"type": "prompt_outputs_failed_validation", "message": "Prompt outputs failed validation", "details": "", "extra_info": {}}, "node_errors": node_errors}
        return None

    # ---- execution ----------------------------------------------------------------
    async def worker(self) -> None:
        while True:
            if not self.queue:
                await asyncio.sleep(0.1)
                continue
            item = self.queue.pop(0)
            self.running = item
            self.interrupt_flag = False
            await self.broadcast_status()
            try:
                await self.execute(item)
            except Exception as e:  # noqa: BLE001
                print("mock: execution crashed:", repr(e))
            self.running = None
            await self.broadcast_status()

    def _node_order(self, prompt: dict[str, Any]) -> list[str]:
        return sorted(prompt.keys(), key=lambda nid: (ORDER.index(prompt[nid]["class_type"]) if prompt[nid]["class_type"] in ORDER else 99, nid))

    async def execute(self, item: dict[str, Any]) -> None:
        pid, prompt, cid = item["prompt_id"], item["prompt"], item["client_id"]
        text = " ".join(str(n["inputs"].get("text", "")) for n in prompt.values() if n["class_type"] == "CLIPTextEncode")
        messages: list[list[Any]] = [["execution_start", {"prompt_id": pid, "timestamp": int(time.time() * 1000)}]]
        await self.send(cid, "execution_start", {"prompt_id": pid, "timestamp": int(time.time() * 1000)})
        outputs: dict[str, Any] = {}
        for nid in self._node_order(prompt):
            node = prompt[nid]
            cls = node["class_type"]
            await self.send(cid, "executing", {"node": nid, "display_node": nid, "prompt_id": pid})
            await asyncio.sleep(self.step_delay)
            if cls in ("KSampler", "KSamplerAdvanced"):
                steps = int(node["inputs"].get("steps", 20))
                if cls == "KSamplerAdvanced":  # only the steps this stage actually runs
                    steps = max(1, min(int(node["inputs"].get("end_at_step", steps)), steps) - int(node["inputs"].get("start_at_step", 0)))
                if "SLOW" in text:
                    steps = max(steps, 60)
                for i in range(1, steps + 1):
                    if self.interrupt_flag:
                        await self.send(cid, "execution_interrupted", {"prompt_id": pid, "node_id": nid, "node_type": cls, "executed": list(outputs)})
                        messages.append(["execution_interrupted", {"prompt_id": pid, "node_id": nid, "node_type": cls}])
                        self.history[pid] = {"prompt": [item["number"], pid, prompt, {"client_id": cid}, []], "outputs": outputs, "status": {"status_str": "error", "completed": False, "messages": messages}}
                        return
                    await asyncio.sleep(self.step_delay)
                    await self.send(cid, "progress", {"value": i, "max": steps, "prompt_id": pid, "node": nid})
                    if i % 3 == 0:
                        await self.send_binary(cid, self._preview_frame(i, steps, node["inputs"].get("seed", 0)))
                if "FAIL" in text:
                    err = {"prompt_id": pid, "node_id": nid, "node_type": cls, "executed": list(outputs), "exception_message": "Allocation on device: CUDA out of memory (mock failure, you wrote FAIL in the prompt)", "exception_type": "torch.OutOfMemoryError", "traceback": ["mock"], "current_inputs": {}, "current_outputs": {}}
                    await self.send(cid, "execution_error", err)
                    messages.append(["execution_error", err])
                    self.history[pid] = {"prompt": [item["number"], pid, prompt, {"client_id": cid}, []], "outputs": outputs, "status": {"status_str": "error", "completed": False, "messages": messages}}
                    return
            if cls in ("SaveImage", "PreviewImage"):
                out = self._render_image(prompt, node, pid, temp=(cls == "PreviewImage"))
                outputs[nid] = out
                await self.send(cid, "executed", {"node": nid, "display_node": nid, "output": out, "prompt_id": pid})
            elif cls in ("SaveVideo", "SaveAnimatedWEBP", "SaveWEBM", "SaveAnimatedPNG"):
                out = await asyncio.to_thread(self._render_video, prompt, node, pid, cls)
                outputs[nid] = out
                await self.send(cid, "executed", {"node": nid, "display_node": nid, "output": out, "prompt_id": pid})
        await self.send(cid, "executing", {"node": None, "display_node": None, "prompt_id": pid})
        await self.send(cid, "execution_success", {"prompt_id": pid, "timestamp": int(time.time() * 1000)})
        messages.append(["execution_success", {"prompt_id": pid, "timestamp": int(time.time() * 1000)}])
        self.history[pid] = {"prompt": [item["number"], pid, prompt, {"client_id": cid}, list(outputs)], "outputs": outputs, "status": {"status_str": "success", "completed": True, "messages": messages}, "meta": {}}

    # ---- fake rendering -----------------------------------------------------------
    def _next_name(self, prefix: str, ext: str, base: Path) -> tuple[str, str]:
        prefix = prefix.strip("/") or "ComfyUI"
        sub, _, stem = prefix.rpartition("/")
        folder = base / sub if sub else base
        folder.mkdir(parents=True, exist_ok=True)
        self.counter += 1
        name = f"{stem}_{self.counter:05d}_.{ext}"
        return name, sub

    def _size_of(self, prompt: dict[str, Any]) -> tuple[int, int]:
        for n in prompt.values():
            if n["class_type"] in ("EmptyLatentImage", "WanImageToVideo", "Wan22ImageToVideoLatent", "SVD_img2vid_Conditioning"):
                return int(n["inputs"].get("width", 512)), int(n["inputs"].get("height", 512))
        return 512, 512

    def _seed_of(self, prompt: dict[str, Any]) -> int:
        for n in prompt.values():
            if n["class_type"] in ("KSampler", "KSamplerAdvanced"):
                return int(n["inputs"].get("seed", n["inputs"].get("noise_seed", 0)))
        return 0

    def _source_image(self, prompt: dict[str, Any]) -> Image.Image | None:
        for n in prompt.values():
            if n["class_type"] == "LoadImage":
                ref = str(n["inputs"].get("image", "")).replace(" [input]", "")
                p = self.input / ref
                if p.exists():
                    try:
                        return Image.open(p).convert("RGB")
                    except Exception:
                        return None
        return None

    def _canvas(self, w: int, h: int, seed: int, t: float = 0.0, source: Image.Image | None = None) -> Image.Image:
        rnd = random.Random(seed)
        c1 = tuple(rnd.randint(30, 200) for _ in range(3))
        c2 = tuple(rnd.randint(30, 200) for _ in range(3))
        img = Image.new("RGB", (w, h))
        px = img.load()
        for y in range(h):
            f = (y / max(1, h - 1) + t) % 1.0
            col = tuple(int(c1[i] * (1 - f) + c2[i] * f) for i in range(3))
            for x in range(w):
                px[x, y] = col
        if source is not None:
            # Ken Burns style pan/zoom of the source so "video" looks like the input moving.
            zoom = 1.0 + 0.15 * t
            sw, sh = source.size
            cw, ch = int(sw / zoom), int(sh / zoom)
            left, top = int((sw - cw) * (0.5 + 0.3 * math.sin(t * math.pi))), int((sh - ch) * 0.5)
            crop = source.crop((left, top, left + cw, top + ch)).resize((w, h))
            img = Image.blend(crop, img, 0.15)
        return img

    def _annotate(self, img: Image.Image, lines: list[str]) -> Image.Image:
        d = ImageDraw.Draw(img)
        y = 10
        for line in lines:
            d.rectangle((6, y - 2, 6 + 7 * len(line) + 8, y + 14), fill=(0, 0, 0))
            d.text((10, y), line, fill=(255, 255, 255))
            y += 18
        return img

    def _render_image(self, prompt: dict[str, Any], node: dict[str, Any], pid: str, temp: bool) -> dict[str, Any]:
        w, h = self._size_of(prompt)
        w, h = min(w, 1024), min(h, 1024)
        seed = self._seed_of(prompt)
        text = next((str(n["inputs"].get("text", "")) for n in prompt.values() if n["class_type"] == "CLIPTextEncode"), "")
        img = self._annotate(self._canvas(w, h, seed), ["MOCK ComfyUI", f"seed {seed}  {w}x{h}", text[:60]])
        base = self.temp if temp else self.output
        name, sub = self._next_name(str(node["inputs"].get("filename_prefix", "ComfyUI")), "png", base)
        img.save(base / sub / name if sub else base / name)
        return {"images": [{"filename": name, "subfolder": sub, "type": "temp" if temp else "output"}]}

    def _render_video(self, prompt: dict[str, Any], node: dict[str, Any], pid: str, cls: str) -> dict[str, Any]:
        w, h = self._size_of(prompt)
        scale = min(1.0, 384 / max(w, h))
        w, h = max(16, int(w * scale) // 2 * 2), max(16, int(h * scale) // 2 * 2)
        seed = self._seed_of(prompt)
        length = next((int(n["inputs"].get("length", n["inputs"].get("video_frames", 25))) for n in prompt.values() if n["class_type"] in ("WanImageToVideo", "Wan22ImageToVideoLatent", "SVD_img2vid_Conditioning")), 25)
        fps = int(node["inputs"].get("fps", 0) or next((int(n["inputs"].get("fps", 16)) for n in prompt.values() if n["class_type"] == "CreateVideo"), 16))
        frames_n = min(length, 36)
        source = self._source_image(prompt)
        frames = [self._annotate(self._canvas(w, h, seed, t=i / max(1, frames_n - 1), source=source), ["MOCK video", f"frame {i + 1}/{frames_n}"]) for i in range(frames_n)]
        prefix = str(node["inputs"].get("filename_prefix", "video/ComfyUI"))
        if cls == "SaveVideo" and self.ffmpeg:
            name, sub = self._next_name(prefix, "mp4", self.output)
            with tempfile.TemporaryDirectory() as td:
                for i, fr in enumerate(frames):
                    fr.save(Path(td) / f"f{i:04d}.png")
                out = (self.output / sub / name) if sub else (self.output / name)
                subprocess.run([self.ffmpeg, "-y", "-loglevel", "error", "-framerate", str(fps), "-i", str(Path(td) / "f%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)], check=True)
            return {"images": [{"filename": name, "subfolder": sub, "type": "output"}], "animated": [True]}
        ext = "png" if cls == "SaveAnimatedPNG" else "webp"
        name, sub = self._next_name(prefix, ext, self.output)
        out = (self.output / sub / name) if sub else (self.output / name)
        frames[0].save(out, save_all=True, append_images=frames[1:], duration=int(1000 / max(1, fps)), loop=0)
        return {"images": [{"filename": name, "subfolder": sub, "type": "output"}], "animated": [True]}

    def _preview_frame(self, step: int, steps: int, seed: Any) -> bytes:
        img = self._canvas(128, 128, int(seed) if str(seed).isdigit() else 0, t=step / max(1, steps))
        img = self._annotate(img, [f"step {step}/{steps}"])
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=70)
        # ComfyUI binary frame: 4-byte event type (1 = PREVIEW_IMAGE), 4-byte image type (1 = JPEG), bytes.
        return (1).to_bytes(4, "big") + (1).to_bytes(4, "big") + buf.getvalue()


def create_mock_app(data_dir: Path, step_delay: float = 0.15) -> FastAPI:
    mock = Mock(data_dir, step_delay)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        worker = asyncio.create_task(mock.worker())
        try:
            yield
        finally:
            worker.cancel()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.state.mock = mock

    @app.get("/")
    async def root():
        return PlainTextResponse("mock ComfyUI (Darkroom dev server). Not the real thing.")

    @app.get("/system_stats")
    async def system_stats():
        return {"system": {"os": "posix", "ram_total": 0, "ram_free": 0, "comfyui_version": "mock", "python_version": "3.x", "embedded_python": False},
                "devices": [{"name": "Mock GPU (nothing is really generated)", "type": "cpu", "index": 0, "vram_total": 0, "vram_free": 0}]}

    @app.get("/object_info/{node_class}")
    async def object_info(node_class: str):
        if node_class == "UpscaleModelLoader":  # a V3-API node: combos are ["COMBO", {"options": [...]}]
            return {node_class: {"input": {"required": {"model_name": ["COMBO", {"options": ["4x_mock_upscaler.pth"], "default": "4x_mock_upscaler.pth"}]}}, "name": node_class, "output": ["UPSCALE_MODEL"], "output_node": False}}
        required = {inp: [choices, {}] for (cls, inp), choices in CHOICES.items() if cls == node_class}
        if not required and node_class not in KNOWN_CLASSES:
            return {}
        return {node_class: {"input": {"required": required}, "input_order": {"required": list(required)}, "output": [], "name": node_class, "display_name": node_class, "category": "mock", "output_node": node_class.startswith("Save")}}

    @app.get("/object_info")
    async def object_info_all():
        return {cls: (await object_info(cls)).get(cls, {}) for cls in KNOWN_CLASSES}

    @app.post("/upload/image")
    async def upload_image(image: UploadFile = File(...), overwrite: str = Form("false"), type: str = Form("input"), subfolder: str = Form("")):
        folder = {"input": mock.input, "temp": mock.temp, "output": mock.output}.get(type, mock.input) / subfolder
        folder.mkdir(parents=True, exist_ok=True)
        name = Path(image.filename or "image.png").name
        target = folder / name
        if target.exists() and overwrite.lower() not in ("true", "1"):
            stem, ext = os.path.splitext(name)
            i = 1
            while (folder / f"{stem} ({i}){ext}").exists():
                i += 1
            name = f"{stem} ({i}){ext}"
            target = folder / name
        target.write_bytes(await image.read())
        return {"name": name, "subfolder": subfolder, "type": type}

    @app.post("/prompt")
    async def post_prompt(request: Request):
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid json"}, status_code=400)
        prompt = body.get("prompt")
        problem = mock.validate(prompt)
        if problem:
            return JSONResponse(problem, status_code=400)
        mock.number += 1
        pid = str(uuid.uuid4())
        mock.queue.append({"number": mock.number, "prompt_id": pid, "prompt": prompt, "client_id": body.get("client_id")})
        await mock.broadcast_status()
        return {"prompt_id": pid, "number": mock.number, "node_errors": {}}

    @app.get("/queue")
    async def get_queue():
        running = [[mock.running["number"], mock.running["prompt_id"], mock.running["prompt"], {}, []]] if mock.running else []
        pending = [[q["number"], q["prompt_id"], q["prompt"], {}, []] for q in mock.queue]
        return {"queue_running": running, "queue_pending": pending}

    @app.post("/queue")
    async def post_queue(request: Request):
        body = await request.json()
        if body.get("clear"):
            mock.queue.clear()
        for pid in body.get("delete", []):
            mock.queue = [q for q in mock.queue if q["prompt_id"] != pid]
        await mock.broadcast_status()
        return PlainTextResponse("", status_code=200)

    @app.post("/interrupt")
    async def interrupt():
        mock.interrupt_flag = True
        return PlainTextResponse("", status_code=200)

    @app.post("/free")
    async def free():
        return PlainTextResponse("", status_code=200)

    @app.get("/history")
    async def history_all():
        return mock.history

    @app.get("/history/{prompt_id}")
    async def history_one(prompt_id: str):
        return {prompt_id: mock.history[prompt_id]} if prompt_id in mock.history else {}

    @app.get("/view")
    async def view(filename: str, subfolder: str = "", type: str = "output"):
        base = {"output": mock.output, "input": mock.input, "temp": mock.temp}.get(type, mock.output)
        path = (base / subfolder / filename).resolve()
        if base.resolve() not in path.parents or not path.is_file():
            return PlainTextResponse("not found", status_code=404)
        return FileResponse(path)

    @app.websocket("/ws")
    async def ws_endpoint(ws: WebSocket):
        await ws.accept()
        cid = ws.query_params.get("clientId") or uuid.uuid4().hex
        mock.sockets[cid] = ws
        remaining = len(mock.queue) + (1 if mock.running else 0)
        await ws.send_text(json.dumps({"type": "status", "data": {"status": {"exec_info": {"queue_remaining": remaining}}, "sid": cid}}))
        try:
            while True:
                await ws.receive_text()
        except WebSocketDisconnect:
            pass
        except Exception:
            pass
        finally:
            if mock.sockets.get(cid) is ws:
                mock.sockets.pop(cid, None)

    return app


def main() -> None:
    p = argparse.ArgumentParser(description="Mock ComfyUI server for Darkroom development")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8188)
    p.add_argument("--data", default="", help="Folder for the fake input/output files (default: a temp folder)")
    p.add_argument("--step-delay", type=float, default=0.15, help="Seconds per fake sampling step")
    args = p.parse_args()
    data_dir = Path(args.data) if args.data else Path(tempfile.mkdtemp(prefix="mock_comfyui_"))
    print(f"mock ComfyUI on http://{args.host}:{args.port}  (files in {data_dir})")
    uvicorn.run(create_mock_app(data_dir, args.step_delay), host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
