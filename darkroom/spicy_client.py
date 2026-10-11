"""Client for SpicyAPI (api.spicyapi.com): the *optional* cloud video engine.

Darkroom never loads this unless you start it with an API key (``--spicy-key`` or
the ``SPICYAPI_KEY`` environment variable).  With a key configured, only the
"Cloud video" tab talks to the internet, and only when you press Generate there.

What the service is (from its own documentation, October 2026)
--------------------------------------------------------------
* ``POST /v1/videos/generations`` starts an asynchronous task on ``spicy-motion-3``
  (or ``-fast``); the price is debited immediately; ``GET /v1/videos/tasks/{id}`` is
  polled every 10-15 s until ``succeeded`` or ``failed`` (failed = refunded).
* The first frame of an image-to-video task must be an image *SpicyAPI generated
  for your account*; local files, base64 and third-party URLs are rejected before
  any charge, by design.  So Darkroom offers text-to-video, or "frame + video":
  a first frame rendered on ``spicy-image-1`` from a frame prompt, then animated.
* ``POST /v1/moderations`` ($0.001) runs the same content screen as a generation
  but never records a strike; Darkroom calls it before spending.  (``dry_run`` and
  sandbox keys *do* record strikes for severe refusals, so they are not used as a
  pre-check.)
* Prices (per delivered output second): motion-3 $0.10 / $0.20 / $0.40 at
  480P / 720P / 1080P; motion-3-fast $0.14 / $0.28 / $0.56; +20 % for 60 fps;
  first frames $0.06-$0.09.  ``duration: -1`` ("smart") debits 30 s and refunds the
  difference.  Check https://www.spicyapi.com/pricing before relying on these.

Privacy (from SpicyAPI's privacy policy): prompts, parameters, your IP and output
links are kept for the life of the account plus six years; prompts and generated
media are processed by Alibaba Cloud (Singapore); clips rendered at 60 fps are
also sent to fal.ai (US); prompt text is classified by TypeSafe AI (US).

Swapping the service: this module is the only place that knows the HTTP shapes.
"""
from __future__ import annotations

import asyncio
import ipaddress
import logging
import time
from typing import Any, Awaitable, Callable
from urllib.parse import urlsplit

import httpx

log = logging.getLogger("darkroom.spicy")

DEFAULT_BASE_URL = "https://api.spicyapi.com/v1"
VIDEO_MODELS = {
    "spicy-motion-3": {"label": "Spicy Motion 3", "usd_per_second": {"480P": 0.10, "720P": 0.20, "1080P": 0.40}},
    "spicy-motion-3-fast": {"label": "Spicy Motion 3 Fast", "usd_per_second": {"480P": 0.14, "720P": 0.28, "1080P": 0.56}},
}
FRAME_MODELS = {
    "spicy-image-1": {"label": "Spicy Image 1", "usd": 0.06},
    "spicy-image-photo-1": {"label": "Spicy Image Photo 1", "usd": 0.08},
    "spicy-image-1-pro": {"label": "Spicy Image 1 Pro", "usd": 0.09},
}
FRAME_SIZES = ("832*1216", "1216*832", "1024*1024", "1024*1536", "1536*1024", "1080*1920", "1920*1080", "1280*1280", "1440*1440", "1152*2048", "2048*1152")  # the eleven sizes every image model accepts
MAX_IMAGE_PROMPT_CHARS = 4000
RESOLUTIONS = ("480P", "720P", "1080P")
ASPECT_RATIOS = ("16:9", "9:16", "1:1", "4:3", "3:4", "21:9")
DURATION_MIN, DURATION_MAX = 2, 30
SMART_DURATION = -1
MAX_PROMPT_CHARS = 20000
MODERATION_USD = 0.001
FPS60_SURCHARGE = 0.20
POLL_SECONDS = 10.0
TASK_TIMEOUT = 45 * 60.0
TERMINAL = ("succeeded", "failed")
STATUS_LABELS = {"queued": "Queued at SpicyAPI", "processing": "Rendering at SpicyAPI", "finalizing": "Finalizing at SpicyAPI (output check, 60 fps)"}


def is_loopback(url: str) -> bool:
    host = (urlsplit(url).hostname or "").lower().strip("[]")
    return host in ("127.0.0.1", "localhost", "::1") or host.startswith("127.")


def is_public_https(url: str) -> bool:
    """True for an https URL whose host is a public name or address (never loopback / LAN / link-local)."""
    parts = urlsplit(url)
    host = (parts.hostname or "").lower().strip("[]")
    if parts.scheme != "https" or not host or host == "localhost":
        return False
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return "." in host  # a DNS name
    return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified)


def estimate_cost(model: str, duration: int, resolution: str, *, fps60: bool = False, frame_model: str | None = None) -> dict[str, Any]:
    """Rough price from the published table.  ``duration == -1`` means smart duration:
    the maximum (30 s) is debited and the unused part refunded later."""
    rates = VIDEO_MODELS.get(model, VIDEO_MODELS["spicy-motion-3"])["usd_per_second"]
    rate = rates.get(resolution, rates["720P"])
    seconds = DURATION_MAX if duration == SMART_DURATION else max(DURATION_MIN, min(DURATION_MAX, int(duration)))
    video = seconds * rate
    if fps60:
        video *= 1 + FPS60_SURCHARGE
    frame = FRAME_MODELS[frame_model]["usd"] if frame_model in FRAME_MODELS else 0.0
    total = round(video + frame + MODERATION_USD * (2 if frame_model else 1), 3)
    bits = [f"{seconds} s × ${rate:.2f} at {resolution}"]
    if fps60:
        bits.append("+20 % for 60 fps")
    if frame_model:
        bits.append(f"+ ${frame:.2f} first frame")
    if duration == SMART_DURATION:
        bits.append("smart duration: 30 s debited first, the unused seconds refunded")
    return {"usd": total, "smart": duration == SMART_DURATION, "breakdown": ", ".join(bits)}


class SpicyError(Exception):
    """Anything that stops a cloud job.  ``to_dict`` matches Darkroom's other error shapes."""

    def __init__(self, message: str, hint: str | None = None, *, status: int | None = None, kind: str | None = None, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.hint = hint
        self.status = status
        self.kind = kind
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        return {"message": str(self), "hint": self.hint, "type": self.kind, "status": self.status, "details": self.details or None}


class SpicyUnavailable(SpicyError):
    """Network problem or 5xx: nothing (or nothing lasting) was charged."""


class SpicyRejected(SpicyError):
    """4xx: the request was refused before any charge (bad key, no balance, moderation...)."""


class SpicyFailed(SpicyError):
    """The task ran and failed (refunded by SpicyAPI)."""


class SpicyClient:
    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE_URL, *, timeout: float = 60.0):
        key = (api_key or "").strip()
        if not key:
            raise ValueError("SpicyAPI key is empty")
        self.base_url = base_url.rstrip("/")
        if not self.base_url.endswith("/v1"):
            self.base_url += "/v1"
        self.key_hint = key[:9] + "…" + key[-4:] if len(key) > 16 else "sk-…"
        self._http = httpx.AsyncClient(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {key}", "User-Agent": "Darkroom/1.0 (local)"},
            timeout=httpx.Timeout(timeout, connect=15.0),
            trust_env=not is_loopback(self.base_url),  # a real cloud call may go through the system proxy; the test mock never does
            follow_redirects=False,
        )
        self.host = urlsplit(self.base_url).hostname or ""
        # Downloads go to the CDN without the bearer token.
        self._dl = httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=15.0), trust_env=not is_loopback(self.base_url), follow_redirects=True, headers={"User-Agent": "Darkroom/1.0 (local)"})

    async def aclose(self) -> None:
        await self._http.aclose()
        await self._dl.aclose()

    # ---- plumbing --------------------------------------------------------------
    async def _request(self, method: str, path: str, *, json: dict[str, Any] | None = None) -> Any:
        try:
            r = await self._http.request(method, path, json=json)
        except httpx.TimeoutException:
            raise SpicyUnavailable("SpicyAPI did not answer in time", "Check your internet connection and try again.", kind="timeout") from None
        except httpx.HTTPError as e:
            raise SpicyUnavailable(f"Could not reach SpicyAPI: {e.__class__.__name__}", "Check your internet connection (and VPN). Nothing was charged.", kind="network") from None
        if r.status_code < 400:
            try:
                return r.json()
            except ValueError:
                raise SpicyUnavailable("SpicyAPI returned something that is not JSON", f"HTTP {r.status_code} from {path}", status=r.status_code) from None
        raise self._error(r, path)

    def _error(self, r: httpx.Response, path: str) -> SpicyError:
        try:
            err = (r.json() or {}).get("error") or {}
        except ValueError:
            err = {}
        if not isinstance(err, dict):
            err = {"message": str(err)}
        message = str(err.get("message") or f"HTTP {r.status_code} from SpicyAPI")
        kind = err.get("type")
        code = err.get("code")
        details = {k: v for k, v in err.items() if k not in ("message",)}
        s = r.status_code
        if s == 401:
            return SpicyRejected("SpicyAPI rejected the API key", f"Create a key at https://www.spicyapi.com/dashboard/api-keys and start Darkroom with --spicy-key (or the SPICYAPI_KEY variable). Key used: {self.key_hint}.", status=s, kind=kind, details=details)
        if s == 402:
            return SpicyRejected(message, "Top up your prepaid balance at https://www.spicyapi.com (minimum $50) or raise the monthly spend limit in the dashboard. Nothing was charged.", status=s, kind=kind, details=details)
        if s == 403:
            hint = {
                "age_verification_required": "SpicyAPI requires a one-time age check for your location: finish it in the dashboard (Settings) and try again. It must not be done through a VPN.",
                "reference_terms_required": "Accept the reference-image terms in the SpicyAPI dashboard first.",
            }.get(str(kind), "Your SpicyAPI account cannot generate right now; check the dashboard for the reason.")
            return SpicyRejected(message, hint, status=s, kind=kind, details=details)
        if s == 422:
            cats = err.get("categories") or {}
            top = max(cats, key=cats.get) if isinstance(cats, dict) and cats else code
            hint = "Reword the prompt so that everyone is clearly an adult and consenting, and avoid real people's names or lookalikes. Nothing was charged."
            if code in ("minor",):
                hint = "The screen read this as involving a minor. Make every person unmistakably adult (give ages like 'in her thirties'); repeated refusals of this kind count against the account."
            elif code in ("real_person",):
                hint = "Real, identifiable people (and lookalikes) are refused even with consent. Describe a fictional person instead."
            elif code in ("non_consent",):
                hint = "Non-consent is refused in image and video prompts. Make consent explicit."
            return SpicyRejected(f"Blocked by SpicyAPI's content screen ({top or 'policy'}): {message}", hint, status=s, kind=kind, details=details)
        if s == 429:
            wait = r.headers.get("retry-after", "a few")
            return SpicyUnavailable(message or "Rate limited by SpicyAPI", f"Wait {wait} seconds and try again (also happens with 20 cloud videos already in progress).", status=s, kind=kind, details=details)
        if s == 400:
            return SpicyRejected(f"SpicyAPI refused the request: {message}", "This is a Darkroom bug or a changed API. Nothing was charged; see the console.", status=s, kind=kind, details=details)
        if s == 410:
            return SpicyRejected(message, "That model was retired by SpicyAPI; pick another one.", status=s, kind=kind, details=details)
        if s >= 500:
            return SpicyUnavailable(f"SpicyAPI problem (HTTP {s}): {message}", "Try again in a minute. Anything charged for a failed task is refunded by SpicyAPI.", status=s, kind=kind, details=details)
        return SpicyRejected(message, None, status=s, kind=kind, details=details)

    # ---- endpoints -------------------------------------------------------------
    async def account(self) -> dict[str, Any]:
        """Balance, sandbox flag and limits.  Also the cheapest way to test the key."""
        data = await self._request("GET", "/account")
        return data if isinstance(data, dict) else {}

    async def moderate(self, text: str) -> dict[str, Any]:
        """Run SpicyAPI's screen on a prompt without generating ($0.001; never a strike).
        Returns the moderation object; ``outcome`` is allow | review | block."""
        data = await self._request("POST", "/moderations", json={"input": text[:8000]})
        return data if isinstance(data, dict) else {}

    @staticmethod
    def moderation_problem(mod: dict[str, Any]) -> SpicyRejected | None:
        outcome = str(mod.get("outcome") or ("block" if mod.get("flagged") else "allow"))
        if outcome == "allow" and not mod.get("flagged"):
            return None
        cat = mod.get("category") or "policy"
        cats = mod.get("categories") or {}
        scores = ", ".join(f"{k} {v:.0%}" for k, v in sorted(cats.items(), key=lambda kv: -float(kv[1]))[:3]) if isinstance(cats, dict) else ""
        if outcome == "review":
            return SpicyRejected(f"SpicyAPI's screen is unsure about this prompt ({cat}{': ' + scores if scores else ''})", "Reword it to make ages (adults) and consent explicit, then try again. Nothing was charged and this check never counts against your account.", status=422, kind="moderation_review", details=mod)
        return SpicyRejected(f"SpicyAPI's screen would refuse this prompt ({cat}{': ' + scores if scores else ''})", "Remove the problem part and try again. Nothing was charged and this pre-check never counts against your account.", status=422, kind="moderation_blocked", details=mod)

    async def generate_image(self, model: str, prompt: str, size: str, *, seed: int | None = None, enhance_prompt: bool = False) -> dict[str, Any]:
        """One first frame.  Synchronous on their side (10-30 s).  Returns {url, cost_usd, id}."""
        if len(prompt) > MAX_IMAGE_PROMPT_CHARS:
            raise SpicyRejected(f"Frame prompt is longer than {MAX_IMAGE_PROMPT_CHARS} characters", "Shorten the frame prompt.", status=400)
        body: dict[str, Any] = {"model": model, "prompt": prompt, "size": size, "n": 1}
        if enhance_prompt:
            body["enhance_prompt"] = True
        if seed is not None:
            body["seed"] = int(seed)
        data = await self._request("POST", "/images/generations", json=body)
        items = (data or {}).get("data") or []
        url = items[0].get("url") if items and isinstance(items[0], dict) else None
        if not url:
            raise SpicyUnavailable("SpicyAPI returned no image URL", "Try again; if it keeps happening the API changed shape.", details=data if isinstance(data, dict) else None)
        return {"url": url, "cost_usd": data.get("cost_usd"), "id": data.get("id"), "sandbox": bool(data.get("sandbox"))}

    async def create_video(
        self,
        model: str,
        prompt: str,
        *,
        image_url: str | None = None,
        duration: int = 5,
        resolution: str = "720P",
        aspect_ratio: str | None = None,
        audio: bool = True,
        fps60: bool = False,
        enhance_prompt: bool = False,
        seed: int | None = None,
    ) -> dict[str, Any]:
        """Start a video task.  Returns the task object (id, status, cost_usd, poll_url)."""
        if len(prompt) > MAX_PROMPT_CHARS:
            raise SpicyRejected(f"Prompt is longer than {MAX_PROMPT_CHARS} characters", "Shorten it.", status=400)
        body: dict[str, Any] = {"model": model, "prompt": prompt, "resolution": resolution, "duration": int(duration), "audio": bool(audio), "fps": 60 if fps60 else 30}
        if image_url:
            body["image_url"] = image_url  # must be one of the account's own generated images
        elif aspect_ratio:
            body["aspect_ratio"] = aspect_ratio  # text-to-video only; omitted = model picks
        if enhance_prompt:
            body["enhance_prompt"] = True
        if seed is not None:
            body["seed"] = int(seed)
        data = await self._request("POST", "/videos/generations", json=body)
        if not isinstance(data, dict) or not data.get("id"):
            raise SpicyUnavailable("SpicyAPI returned no task id", None, details=data if isinstance(data, dict) else None)
        return data

    async def task(self, task_id: str) -> dict[str, Any]:
        data = await self._request("GET", f"/videos/tasks/{task_id}")
        return data if isinstance(data, dict) else {}

    async def wait(self, task_id: str, on_status: Callable[[dict[str, Any]], Awaitable[None] | None] | None = None, *, poll: float = POLL_SECONDS, timeout: float = TASK_TIMEOUT) -> dict[str, Any]:
        """Poll until the task is terminal.  Raises SpicyFailed on ``failed``."""
        deadline = time.monotonic() + timeout
        misses = 0
        while True:
            try:
                t = await self.task(task_id)
                misses = 0
            except SpicyUnavailable as e:
                misses += 1
                if misses >= 6:
                    raise SpicyUnavailable(f"Lost contact with SpicyAPI while waiting for the clip: {e}", f"The task {task_id} keeps running there; the clip will be in your SpicyAPI library.", kind="network") from None
                await asyncio.sleep(min(poll, 5.0))
                continue
            if on_status:
                res = on_status(t)
                if asyncio.iscoroutine(res):
                    await res
            status = str(t.get("status") or "")
            if status == "succeeded":
                return t
            if status == "failed":
                code = t.get("error_code")
                msg = str(t.get("error") or "SpicyAPI reported the task as failed")
                if code == "blocked":
                    raise SpicyFailed(f"SpicyAPI withheld the finished clip after its output check: {msg}", "The charge was refunded. Try a different prompt or first frame; repeated output blocks are not strikes.", kind="blocked", details=t)
                raise SpicyFailed(f"SpicyAPI task failed: {msg}", "The charge was refunded by SpicyAPI. Try again.", kind=str(code or "failed"), details=t)
            if time.monotonic() > deadline:
                raise SpicyUnavailable("Gave up waiting for SpicyAPI after 45 minutes", f"Task {task_id} may still finish; check your SpicyAPI library.", kind="timeout", details=t)
            await asyncio.sleep(poll)

    async def download(self, url: str) -> bytes:
        """Fetch a finished output from the URL the API returned.

        Outputs live on SpicyAPI's CDN (cdn.spicyapi.com today); any public https host is
        accepted so a CDN change cannot strand finished clips, but a URL pointing back into
        this machine or the LAN is refused (the only other host allowed is the configured
        base host, for the development mock)."""
        host = (urlsplit(url).hostname or "").lower()
        if not (host == self.host or is_public_https(url)):
            raise SpicyUnavailable(f"Refusing to download from an unexpected address: {host or url}", "SpicyAPI's outputs live on its public CDN; this looks like a changed API.")
        try:
            r = await self._dl.get(url)
        except httpx.HTTPError as e:
            raise SpicyUnavailable(f"Could not download the finished clip: {e.__class__.__name__}", "It stays in your SpicyAPI library; try again later.") from None
        if r.status_code >= 400:
            raise SpicyUnavailable(f"Download failed with HTTP {r.status_code}", "The clip stays in your SpicyAPI library; try again later.", status=r.status_code)
        return r.content
