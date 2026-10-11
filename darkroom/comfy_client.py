"""
A small async client for a *local* ComfyUI server.

Only talks to the URL you give it (default http://127.0.0.1:8188).  Uses the
same endpoints ComfyUI's own web UI uses:

    GET  /system_stats                  is the server up?
    GET  /object_info/<NodeClass>       which model files exist (dropdowns)
    POST /upload/image                  put a source image in ComfyUI/input
    POST /prompt                        queue a workflow (API-format graph)
    WS   /ws?clientId=...               live progress + previews for that client
    GET  /history/<prompt_id>           where the finished files are
    GET  /view?filename=..&subfolder=..&type=output   download a result
    POST /interrupt, POST /queue        cancel

Nothing here ever contacts any other host.
"""
from __future__ import annotations

import asyncio
import base64
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

import httpx

try:  # websockets >= 13 (new asyncio implementation)
    from websockets.asyncio.client import connect as ws_connect
    from websockets.exceptions import ConnectionClosed, InvalidURI, InvalidHandshake
except ImportError:  # pragma: no cover - very old websockets
    from websockets import connect as ws_connect  # type: ignore[no-redef]
    from websockets.exceptions import ConnectionClosed, InvalidURI, InvalidHandshake  # type: ignore[no-redef]


# ---- errors -----------------------------------------------------------------
class ComfyError(Exception):
    """Any failure talking to ComfyUI, with a message meant for the UI."""

    def __init__(self, message: str, hint: str | None = None, details: Any = None):
        super().__init__(message)
        self.message = message
        self.hint = hint
        self.details = details

    def to_dict(self) -> dict[str, Any]:
        return {"message": self.message, "hint": self.hint, "details": self.details}


class ComfyUnavailable(ComfyError):
    """ComfyUI is not running / not reachable at the configured URL."""


class ComfyRejected(ComfyError):
    """POST /prompt returned 400: the workflow failed validation (missing model, bad input...)."""


class ComfyExecutionError(ComfyError):
    """A node raised while executing (out of memory, bad image, ...)."""


class ComfyInterrupted(ComfyError):
    """The job was interrupted (by us or from the ComfyUI UI)."""


# ---- data ---------------------------------------------------------------------
@dataclass
class OutputFile:
    filename: str
    subfolder: str
    type: str  # "output" | "temp" | "input"
    kind: str  # "image" | "video" | "animation"
    node_id: str
    extra: dict[str, Any] = field(default_factory=dict)


Event = Callable[[str, dict[str, Any]], None]

# Friendly labels for the node currently executing.
NODE_LABELS = {
    "CheckpointLoaderSimple": "Loading model",
    "UNETLoader": "Loading model",
    "ImageOnlyCheckpointLoader": "Loading model",
    "CLIPLoader": "Loading text encoder",
    "DualCLIPLoader": "Loading text encoder",
    "VAELoader": "Loading VAE",
    "CLIPVisionLoader": "Loading vision encoder",
    "LoraLoader": "Loading LoRA",
    "CLIPTextEncode": "Encoding prompt",
    "CLIPVisionEncode": "Encoding image",
    "LoadImage": "Loading image",
    "EmptyLatentImage": "Preparing",
    "WanImageToVideo": "Preparing",
    "Wan22ImageToVideoLatent": "Preparing",
    "SVD_img2vid_Conditioning": "Preparing",
    "KSampler": "Sampling",
    "KSamplerAdvanced": "Sampling",
    "SamplerCustom": "Sampling",
    "SamplerCustomAdvanced": "Sampling",
    "VAEDecode": "Decoding",
    "VAEDecodeTiled": "Decoding",
    "CreateVideo": "Encoding video",
    "SaveVideo": "Saving video",
    "SaveAnimatedWEBP": "Saving video",
    "SaveAnimatedPNG": "Saving video",
    "SaveWEBM": "Saving video",
    "VHS_VideoCombine": "Saving video",
    "SaveImage": "Saving image",
    "PreviewImage": "Saving image",
}

VIDEO_EXT = {".mp4", ".webm", ".mov", ".mkv", ".m4v"}
ANIM_EXT = {".gif"}


def classify_output(key: str, item: dict[str, Any]) -> str:
    name = str(item.get("filename", "")).lower()
    ext = name[name.rfind("."):] if "." in name else ""
    if ext in VIDEO_EXT or key in ("gifs", "videos") or str(item.get("format", "")).startswith("video/"):
        return "video" if ext in VIDEO_EXT else ("animation" if ext in ANIM_EXT or ext in (".webp", ".png") else "video")
    if ext in ANIM_EXT or item.get("animated") or key == "animated":
        return "animation"
    return "image"


def _bytes_to_data_url(data: bytes, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(data).decode("ascii")


class ComfyClient:
    def __init__(self, base_url: str = "http://127.0.0.1:8188", *, connect_timeout: float = 3.0, preview_method: str | None = "auto"):
        self.base_url = base_url.rstrip("/")
        # Asked per job via extra_data so live previews work without restarting ComfyUI
        # with --preview-method. "auto" = cheap latent2rgb previews; None = server default.
        self.preview_method = preview_method
        if self.base_url.startswith("https://"):
            self.ws_url = "wss://" + self.base_url[len("https://"):] + "/ws"
        else:
            self.ws_url = "ws://" + self.base_url[len("http://"):] + "/ws"
        self._http = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(connect=connect_timeout, read=120.0, write=60.0, pool=10.0),
            trust_env=False,  # never pick up HTTP(S)_PROXY from the environment: stay on localhost
        )
        self._choices_cache: dict[tuple[str, str], tuple[float, list[str]]] = {}

    async def aclose(self) -> None:
        await self._http.aclose()

    # ---- low level -----------------------------------------------------------
    def _unavailable(self, exc: Exception) -> ComfyUnavailable:
        return ComfyUnavailable(
            f"ComfyUI is not reachable at {self.base_url}",
            hint="Start ComfyUI first (python main.py in the ComfyUI folder, or run_nvidia_gpu.bat for the "
                 "portable build) and wait until it prints 'To see the GUI go to: http://127.0.0.1:8188'. "
                 "If it listens somewhere else, start Darkroom with --comfy http://host:port.",
            details=str(exc),
        )

    async def _get(self, path: str, **params: Any) -> Any:
        try:
            r = await self._http.get(path, params=params or None)
        except httpx.HTTPError as e:
            raise self._unavailable(e) from e
        if r.status_code >= 400:
            raise ComfyError(f"ComfyUI returned HTTP {r.status_code} for {path}", details=r.text[:500])
        return r

    async def _post_json(self, path: str, payload: Any) -> httpx.Response:
        try:
            return await self._http.post(path, json=payload)
        except httpx.HTTPError as e:
            raise self._unavailable(e) from e

    # ---- status / info -------------------------------------------------------
    async def system_stats(self) -> dict[str, Any]:
        return (await self._get("/system_stats")).json()

    async def is_online(self) -> bool:
        try:
            await self.system_stats()
            return True
        except ComfyError:
            return False

    async def object_info(self, node_class: str) -> dict[str, Any]:
        data = (await self._get(f"/object_info/{node_class}")).json()
        return data.get(node_class) or {}

    async def input_choices(self, node_class: str, input_name: str, *, max_age: float = 20.0) -> list[str]:
        """The list of valid values for a combo input, e.g. installed checkpoints.

        ComfyUI describes a node as {"input": {"required": {"ckpt_name": [[...choices], {...}]}}}.
        """
        key = (node_class, input_name)
        cached = self._choices_cache.get(key)
        if cached and time.monotonic() - cached[0] < max_age:
            return cached[1]
        info = await self.object_info(node_class)
        choices: list[str] = []
        for section in ("required", "optional"):
            spec = ((info.get("input") or {}).get(section) or {}).get(input_name)
            if isinstance(spec, list) and spec and isinstance(spec[0], list):
                choices = [str(c) for c in spec[0]]
                break
            if isinstance(spec, list) and spec and isinstance(spec[0], dict) and isinstance(spec[0].get("options"), list):
                choices = [str(c) for c in spec[0]["options"]]  # COMBO with options dict (newer schema)
                break
        self._choices_cache[key] = (time.monotonic(), choices)
        return choices

    async def queue_state(self) -> dict[str, Any]:
        return (await self._get("/queue")).json()

    async def queue_position(self, prompt_id: str) -> int | None:
        """0 = running now, n = n jobs ahead of it, None = not in queue (finished)."""
        try:
            q = await self.queue_state()
        except ComfyError:
            return None
        for item in q.get("queue_running", []):
            if len(item) > 1 and item[1] == prompt_id:
                return 0
        pending = sorted(q.get("queue_pending", []), key=lambda it: it[0] if it else 0)
        for i, item in enumerate(pending):
            if len(item) > 1 and item[1] == prompt_id:
                return i + 1 + len(q.get("queue_running", []))
        return None

    # ---- uploads -------------------------------------------------------------
    async def upload_image(self, data: bytes, filename: str, *, subfolder: str = "darkroom", overwrite: bool = True) -> str:
        """Upload to ComfyUI/input/<subfolder>/ and return the value for a LoadImage node."""
        files = {"image": (filename, data, "application/octet-stream")}
        form = {"overwrite": "true" if overwrite else "false", "type": "input", "subfolder": subfolder}
        try:
            r = await self._http.post("/upload/image", files=files, data=form)
        except httpx.HTTPError as e:
            raise self._unavailable(e) from e
        if r.status_code >= 400:
            raise ComfyError("ComfyUI refused the image upload", details=r.text[:500])
        info = r.json()
        name = info.get("name") or filename
        sub = info.get("subfolder") or ""
        return f"{sub}/{name}" if sub else name

    # ---- queueing ------------------------------------------------------------
    async def queue_prompt(self, graph: dict[str, Any], client_id: str, *, extra_data: dict[str, Any] | None = None) -> str:
        payload: dict[str, Any] = {"prompt": graph, "client_id": client_id}
        if extra_data:
            payload["extra_data"] = extra_data
        r = await self._post_json("/prompt", payload)
        if r.status_code == 200:
            body = r.json()
            pid = body.get("prompt_id")
            if not pid:
                raise ComfyError("ComfyUI accepted the job but returned no prompt_id", details=body)
            return str(pid)
        try:
            body = r.json()
        except ValueError:
            body = {"error": {"message": r.text[:500]}}
        raise self._rejection(body, graph)

    def _rejection(self, body: dict[str, Any], graph: dict[str, Any]) -> ComfyRejected:
        err = body.get("error") or {}
        node_errors = body.get("node_errors") or {}
        lines: list[str] = []
        types: set[str] = set()
        for nid, info in node_errors.items():
            cls = (info or {}).get("class_type") or (graph.get(nid) or {}).get("class_type") or "node"
            for e in (info or {}).get("errors", []):
                types.add(str(e.get("type", "")))
                detail = str(e.get("details") or "").strip()
                lines.append(f"{cls} (node {nid}): {e.get('message', 'invalid')}" + (f" - {detail}" if detail else ""))
        top = err.get("message") or "Prompt failed validation"
        if not lines and err.get("details"):
            lines.append(str(err["details"]))
        message = "ComfyUI rejected the workflow: " + top + ("\n" + "\n".join(lines) if lines else "")
        hint = None
        if "value_not_in_list" in types:
            hint = ("A model file named in the workflow is not installed in ComfyUI. Pick a different model in the "
                    "dropdown, or download the file into the right ComfyUI/models/... folder (see darkroom/workflows/README.md).")
        elif "required_input_missing" in types or "return_type_mismatch" in types:
            hint = "The workflow template is missing or mis-wiring an input. Check the template JSON (darkroom/workflows/)."
        elif "invalid_prompt" in str(err.get("type", "")) and "class_type" in str(err.get("details", "")).lower():
            hint = "ComfyUI does not have one of the node types this workflow uses. Update ComfyUI or install the custom node."
        return ComfyRejected(message[:4000], hint=hint, details=body)

    async def interrupt(self, prompt_id: str | None = None) -> None:
        """Stop the running job. ComfyUI >= 0.3.57 only acts if ``prompt_id`` is the one running; older builds ignore the body."""
        await self._post_json("/interrupt", {"prompt_id": prompt_id} if prompt_id else {})

    async def delete_queued(self, prompt_id: str) -> None:
        await self._post_json("/queue", {"delete": [prompt_id]})

    # ---- results -------------------------------------------------------------
    async def history(self, prompt_id: str) -> dict[str, Any] | None:
        data = (await self._get(f"/history/{prompt_id}")).json()
        entry = data.get(prompt_id) if isinstance(data, dict) else None
        return entry or None

    @staticmethod
    def outputs_from_history(entry: dict[str, Any]) -> list[OutputFile]:
        """Every produced media file, whatever node saved it.

        SaveImage puts files under "images"; SaveVideo / SaveAnimatedWEBP also
        use "images" (with animated: [true]); VideoHelperSuite uses "gifs".
        We simply look at every list of dicts that carries a "filename".
        """
        found: list[OutputFile] = []
        for node_id, out in (entry.get("outputs") or {}).items():
            if not isinstance(out, dict):
                continue
            animated = bool((out.get("animated") or [False])[0]) if isinstance(out.get("animated"), list) else False
            for key, items in out.items():
                if not isinstance(items, list):
                    continue
                for item in items:
                    if not isinstance(item, dict) or "filename" not in item:
                        continue
                    if animated:
                        item = {**item, "animated": True}
                    found.append(
                        OutputFile(
                            filename=str(item["filename"]),
                            subfolder=str(item.get("subfolder") or ""),
                            type=str(item.get("type") or "output"),
                            kind=classify_output(key, item),
                            node_id=str(node_id),
                            extra={k: v for k, v in item.items() if k not in ("filename", "subfolder", "type")},
                        )
                    )
        saved = [f for f in found if f.type == "output"]
        return saved or found

    async def view(self, f: OutputFile) -> bytes:
        try:
            r = await self._http.get("/view", params={"filename": f.filename, "subfolder": f.subfolder, "type": f.type}, timeout=httpx.Timeout(10, read=600.0))
        except httpx.HTTPError as e:
            raise self._unavailable(e) from e
        if r.status_code >= 400:
            raise ComfyError(f"ComfyUI could not serve {f.filename} (HTTP {r.status_code})")
        return r.content

    # ---- the main loop -------------------------------------------------------
    async def run(self, graph: dict[str, Any], on_event: Event, *, node_classes: dict[str, str] | None = None) -> tuple[str, list[OutputFile]]:
        """Queue ``graph`` and follow it to the end over the websocket.

        ``on_event(name, data)`` is called with: queued {prompt_id}, position
        {position}, progress {value, max, node, label}, preview {data_url},
        done {}.  Returns (prompt_id, output files).  Raises ComfyRejected /
        ComfyExecutionError / ComfyInterrupted / ComfyUnavailable.
        """
        client_id = uuid.uuid4().hex
        node_classes = node_classes or {nid: str(n.get("class_type", "")) for nid, n in graph.items()}
        last_preview = 0.0
        prompt_id: str | None = None
        finished = False
        error: ComfyError | None = None

        def label_for(node: Any) -> str:
            cls = node_classes.get(str(node), "")
            return NODE_LABELS.get(cls, cls or "Working")

        try:
            ws_ctx = ws_connect(f"{self.ws_url}?clientId={client_id}", max_size=None, open_timeout=5, ping_interval=20, ping_timeout=20)
            ws = await ws_ctx.__aenter__()
        except (OSError, InvalidURI, InvalidHandshake, asyncio.TimeoutError, ConnectionClosed) as e:
            raise self._unavailable(e) from e

        try:
            # Connect first, then queue, so no message can be missed.
            extra = {"preview_method": self.preview_method} if self.preview_method else None
            prompt_id = await self.queue_prompt(graph, client_id, extra_data=extra)
            on_event("queued", {"prompt_id": prompt_id})
            pos = await self.queue_position(prompt_id)
            if pos is not None:
                on_event("position", {"position": pos})

            idle_checks = 0
            while not finished:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                except asyncio.TimeoutError:
                    # Nothing for 5 s: make sure we did not miss the end (e.g. after a reconnect).
                    idle_checks += 1
                    if idle_checks % 2 == 0:
                        entry = await self.history(prompt_id)
                        if entry and (entry.get("status") or {}).get("completed") or (entry and entry.get("outputs") and not entry.get("status")):
                            finished = True
                        elif entry and (entry.get("status") or {}).get("status_str") == "error":
                            error = self._error_from_history(entry)
                            finished = True
                        else:
                            pos = await self.queue_position(prompt_id)
                            if pos is not None:
                                on_event("position", {"position": pos})
                    continue
                except ConnectionClosed:
                    # Websocket dropped (ComfyUI restarted / proxy): finish by polling history.
                    entry = await self._poll_history(prompt_id)
                    if (entry.get("status") or {}).get("status_str") == "error":
                        error = self._error_from_history(entry)
                    finished = True
                    break

                if isinstance(msg, (bytes, bytearray)):
                    # Binary frame: 4-byte event type, 4-byte image type, then the image.
                    now = time.monotonic()
                    if len(msg) > 8 and now - last_preview > 0.4:
                        event_type = int.from_bytes(msg[:4], "big")
                        if event_type == 1:  # PREVIEW_IMAGE
                            img_type = int.from_bytes(msg[4:8], "big")
                            mime = "image/jpeg" if img_type == 1 else "image/png"
                            on_event("preview", {"data_url": _bytes_to_data_url(bytes(msg[8:]), mime)})
                            last_preview = now
                    continue

                try:
                    payload = json.loads(msg)
                except (TypeError, ValueError):
                    continue
                mtype = payload.get("type")
                data = payload.get("data") or {}
                pid = data.get("prompt_id")

                if mtype == "status":
                    remaining = ((data.get("status") or {}).get("exec_info") or {}).get("queue_remaining")
                    if remaining is not None:
                        pos = await self.queue_position(prompt_id)
                        if pos is not None:
                            on_event("position", {"position": pos})
                    continue
                if pid != prompt_id:
                    continue  # another client's job
                if mtype == "execution_start":
                    on_event("position", {"position": 0})
                    on_event("progress", {"value": 0, "max": 0, "node": None, "label": "Starting"})
                elif mtype == "executing":
                    node = data.get("node")
                    if node is None:
                        finished = True  # the authoritative "all done" signal
                    else:
                        on_event("progress", {"value": 0, "max": 0, "node": str(node), "label": label_for(node)})
                elif mtype == "progress":
                    node = data.get("node")
                    on_event("progress", {"value": int(data.get("value", 0)), "max": int(data.get("max", 0)), "node": str(node) if node is not None else None, "label": label_for(node)})
                elif mtype == "execution_success":
                    finished = True
                elif mtype == "execution_error":
                    error = self._error_from_message(data)
                    finished = True
                elif mtype == "execution_interrupted":
                    error = ComfyInterrupted("The job was interrupted", hint="Cancelled from Darkroom or from the ComfyUI window.")
                    finished = True
        finally:
            try:
                await ws_ctx.__aexit__(None, None, None)
            except Exception:
                pass

        if error is not None:
            raise error
        assert prompt_id is not None
        entry = await self._poll_history(prompt_id)
        status = entry.get("status") or {}
        if status.get("status_str") == "error":
            raise self._error_from_history(entry)
        outputs = self.outputs_from_history(entry)
        if not outputs:
            raise ComfyError(
                "ComfyUI finished but produced no files",
                hint="The workflow has no SaveImage / SaveVideo node, or it only has a PreviewImage node. "
                     "Add a save node to the template.",
                details=entry.get("outputs"),
            )
        on_event("done", {})
        return prompt_id, outputs

    async def _poll_history(self, prompt_id: str, *, timeout: float = 30.0) -> dict[str, Any]:
        """History can lag a moment behind the websocket; poll until it is complete."""
        deadline = time.monotonic() + timeout
        last: dict[str, Any] | None = None
        while time.monotonic() < deadline:
            entry = await self.history(prompt_id)
            if entry:
                last = entry
                status = entry.get("status") or {}
                if status.get("completed") or status.get("status_str") in ("success", "error") or (entry.get("outputs") and not status):
                    return entry
            else:
                # Not in history yet: still running or still queued. Keep waiting while it is in the queue.
                pos = await self.queue_position(prompt_id)
                if pos is not None:
                    deadline = time.monotonic() + timeout
            await asyncio.sleep(1.0)
        if last:
            return last
        raise ComfyError("ComfyUI finished but the job never appeared in its history", hint="Check the ComfyUI console for errors.")

    @staticmethod
    def _error_from_message(data: dict[str, Any]) -> ComfyExecutionError:
        node_type = data.get("node_type") or "node"
        msg = str(data.get("exception_message") or data.get("exception_type") or "unknown error").strip()
        text = f"{node_type} failed: {msg}"
        hint = None
        low = msg.lower()
        if "out of memory" in low or "cuda" in low and "memory" in low or "allocat" in low:
            hint = "Out of GPU memory. Lower the width/height, frames or steps, close other GPU programs, or pick a smaller model / fp8 weights."
        elif "no such file" in low or "not found" in low or "does not exist" in low:
            hint = "A file the workflow needs is missing (model, LoRA or source image). Check the ComfyUI console for the path."
        elif "size" in low and ("match" in low or "mismatch" in low or "shape" in low):
            hint = "Resolution/frames are not compatible with this model. Use multiples of 16 (video: 4n+1 frames) and the template's default size."
        return ComfyExecutionError(text[:4000], hint=hint, details={k: data.get(k) for k in ("node_id", "node_type", "exception_type", "traceback") if k in data})

    @classmethod
    def _error_from_history(cls, entry: dict[str, Any]) -> ComfyError:
        for m in reversed((entry.get("status") or {}).get("messages") or []):
            if isinstance(m, list) and len(m) == 2 and m[0] == "execution_error":
                return cls._error_from_message(m[1] or {})
            if isinstance(m, list) and len(m) == 2 and m[0] == "execution_interrupted":
                return ComfyInterrupted("The job was interrupted")
        return ComfyExecutionError("ComfyUI reported an error for this job", details=entry.get("status"))
