"""Prompt Director: turns a short prompt into a long, structured video/image prompt.

Why this exists
---------------
Hosted services (SpicyAPI, Alibaba Model Studio, fal.ai) quietly run every prompt
through a language model that expands "woman walks to the window" into a paragraph
with motion beats, camera work, lighting and sound.  The video models are trained
on captions written that way, so the expansion is a large part of the "their AI is
so good" effect.  The open-source Wan rewriter also silently *replaces* adult
content with something else, which is why Darkroom does this step itself, on your
PC, and sends the finished prompt with the service's own rewriter switched off.

Two flavours, both applied only when you press "Expand" and always shown for
editing before anything is generated:

* ``compose()``  - deterministic rules.  No model, instant, never phones anywhere.
  It restructures what you wrote into the order the Wan family likes and adds only
  neutral cinematography defaults (camera, light, "no dialogue"), never content.
* ``LocalLLM``   - an OpenAI-compatible chat server on *localhost* (Ollama, LM Studio,
  llama.cpp ``llama-server``, KoboldCpp).  The system prompts below are built from
  Alibaba's published Wan 3.0 prompt formula and the prompt-extension prompts in
  the open-source Wan repositories, plus house rules (keep everything the user
  asked for, adults only).  Darkroom refuses non-loopback LLM URLs unless
  ``allow_remote=True``.

Targets
-------
``wan3``  hosted Wan 3.0 class video (SpicyAPI Spicy Motion 3): timed beats, camera,
          dialogue in quotes, sound/music lines, inline "Negative prompt list".
``wan``   local Wan 2.1/2.2 in ComfyUI: silent, <=100 words, negatives go in the
          separate negative prompt.
``image`` natural-language still image models (Flux, Chroma, Qwen-Image, SpicyAPI).
``sdxl``  comma tags for SDXL / Pony / Illustrious checkpoints.

Official references the rules follow (October 2026):
  Alibaba Model Studio "Wan 3.0 video generation prompt guide":
    [Overall description] + [Shot N (start-end s): Subject + Scene + Motion + Aesthetic
    control] + [Dialogue: xx says: "..."] + [Sound effect / BGM] + [Style / Mood] +
    [Negative prompt list]; 2-5 s per segment; "fixed camera, position unchanged";
    "No dialogue." / "No background music." to suppress; "Lip sync." after lines.
  Model Studio prompt guide, image-to-video: "The image defines the entity, scene,
    and style. Your prompt should focus on motion and camera movements."
  Wan2.2 I2V extender prompt: keep the dynamic parts, remove static descriptions
    already visible in the image, <= 100 words.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlsplit

import httpx

log = logging.getLogger("darkroom.director")

# Prompts that mention minors are refused before anything is sent anywhere (the
# ComfyUI path additionally appends ALWAYS_NEGATIVE in app.py).
BLOCKED_TERMS = ("child", "children", "kid", "minor", "underage", "teen", "loli", "shota", "schoolgirl", "schoolboy", "preteen", "toddler", "infant", "baby girl", "baby boy")
_BLOCK_RE = re.compile(r"(?<![\w-])(" + "|".join(re.escape(t) for t in BLOCKED_TERMS) + r")s?(?![\w-])", re.IGNORECASE)

# Vocabulary used to recognise what the user already covered, so we do not add a
# second camera move or a second light source on top of theirs (whole words only).
CAMERA_WORDS = ("dolly", "pan", "pans", "panning", "tilt", "tilts", "zoom", "zooms", "orbit", "orbits", "tracking shot", "handheld", "static shot", "fixed shot", "locked off", "crane", "push in", "pushes in", "push-in", "pull back", "pulls back", "pull out", "pulls out", "close-up", "close up", "closeup", "wide shot", "medium shot", "full shot", "pov", "point of view", "drone", "steadicam", "rack focus", "slow motion", "slow-motion", "bird's eye", "low angle", "high angle", "over the shoulder", "selfie", "lens", "35mm", "50mm", "85mm", "bokeh", "depth of field")
LIGHT_WORDS = ("light", "lights", "lit", "lighting", "sunlight", "sunset", "sunrise", "golden hour", "neon", "candle", "candles", "candlelight", "lamp", "lamplight", "backlit", "backlight", "rim light", "shadows", "glow", "glowing", "moonlight", "moonlit", "overcast", "window light", "studio lighting", "spotlight", "firelight", "dim", "dimly", "bright", "dark room", "night", "dusk", "dawn", "chiaroscuro", "silhouette")
SOUND_WORDS = ("says", "say", "said", "saying", "whisper", "whispers", "whispering", "moan", "moans", "moaning", "laugh", "laughs", "laughing", "giggle", "giggles", "giggling", "speaks", "speaking", "talks", "talking", "voice", "music", "song", "sound", "sounds", "ambient", "rain", "wind", "footsteps", "breathing", "silence", "silent", "asmr", "dialog", "dialogue", "sfx", "audio", "sings", "singing", "gasps", "gasping", "screams", "shouts", "bgm", "soundtrack")
MUSIC_WORDS = ("music", "song", "bgm", "soundtrack", "piano", "guitar", "synth", "beat", "melody", "score")
STYLE_WORDS = ("photorealistic", "photoreal", "realistic", "hyperrealistic", "cinematic", "anime", "illustration", "3d", "render", "rendered", "film grain", "35mm film", "16mm", "vhs", "polaroid", "black and white", "monochrome", "painting", "cartoon", "pixar", "noir", "oil painting", "watercolor", "sketch", "pixel art", "documentary")
PACE_WORDS = ("slow", "slowly", "fast", "quick", "quickly", "sudden", "suddenly", "gentle", "gently", "rapid", "rapidly", "lazy", "lazily", "frantic", "steady", "steadily", "unhurried", "languid", "brisk", "gradually")
SPEECH_VERBS = ("says", "say", "said", "whispers", "whisper", "moans", "shouts", "asks", "replies", "tells", "screams", "calls", "mutters", "sings", "giggles", "speaks")
SEQUENCE_SPLIT = re.compile(r"[,;]?\s*\b(?:and then|then|after that|afterwards|next|finally|eventually|at the end|lastly)\b,?\s*", re.I)
LEADING_CONNECTOR = re.compile(r"^(?:(?:and|then|next|finally|eventually|lastly|after that|afterwards|so|now)\b,?\s*)+", re.I)


def _vocab(words: tuple[str, ...]) -> "re.Pattern[str]":
    return re.compile(r"(?<![\w-])(?:" + "|".join(re.escape(w) for w in sorted(words, key=len, reverse=True)) + r")(?![\w-])", re.I)


_CAMERA_VOCAB_RE, LIGHT_RE, SOUND_RE, MUSIC_RE, STYLE_RE, PACE_RE, SPEECH_RE = (_vocab(w) for w in (CAMERA_WORDS, LIGHT_WORDS, SOUND_WORDS, MUSIC_WORDS, STYLE_WORDS, PACE_WORDS, SPEECH_VERBS))
# "the camera pushes in" / "fixed camera" are instructions; "she looks at the camera" is not.
_CAMERA_PHRASE_RE = re.compile(r"\b(?:camera\s+(?:slowly\s+|quickly\s+|gently\s+)?(?:push|pull|move|pan|tilt|orbit|track|follow|zoom|stay|hold|remain|is|drift|circle|rise|descend|shake|crane|dolli|glide|sweep|cut|fix|lock|static)\w*|(?:fixed|static|locked(?:-off)?|handheld|steady|moving|slow|still|stationary|wide|close|low|high|overhead|aerial|shaky)\s+camera)\b", re.I)


class _CameraRe:
    @staticmethod
    def search(text: str):
        return _CAMERA_VOCAB_RE.search(text) or _CAMERA_PHRASE_RE.search(text)


CAMERA_RE = _CameraRe()

# Official wording: always state the camera, including stillness.
CAMERA_DEFAULTS = {
    "none": "Medium shot, eye level, fixed camera, position unchanged.",
    "photoreal": "Medium shot, eye level, fixed camera, position unchanged, shallow depth of field.",
    "cinematic": "Medium close-up, eye level, the camera pushes in slowly and stops, shallow depth of field.",
    "glamour": "Medium shot at chest height, the camera orbits slowly about 30 degrees and stops, shallow depth of field.",
    "noir": "Low-angle medium shot, fixed camera, position unchanged.",
    "anime": "Medium shot, fixed camera, position unchanged.",
    "pony": "Medium shot, fixed camera, position unchanged.",
}
STILL_CAMERA_DEFAULTS = {
    "none": "Medium shot at eye level, 85mm lens, shallow depth of field.",
    "photoreal": "Medium shot at eye level, 85mm lens, shallow depth of field, sharp focus on the eyes.",
    "cinematic": "Medium close-up, anamorphic framing, shallow depth of field.",
    "glamour": "Three-quarter shot from slightly above, 85mm lens, soft focus falloff.",
    "noir": "Low-angle medium shot, hard-edged shadows across the frame.",
    "anime": "Clean medium shot, centred composition.",
    "pony": "Clean medium shot, centred composition.",
}
LIGHT_DEFAULTS = {
    "none": "Soft side light from a window, natural colour.",
    "photoreal": "Soft natural side light from a window, realistic skin texture, warm tones.",
    "cinematic": "Warm key light and cool fill, practical lamps in frame, subtle film grain.",
    "glamour": "Warm, soft, flattering light with a gentle glow and smooth falloff.",
    "noir": "Low-key hard light from one side, deep shadows, high contrast.",
    "anime": "Bright, clean lighting with soft cel shading.",
    "pony": "Bright, clean lighting with soft shading.",
}
LOOKS = {"none": "photoreal", "photoreal": "photoreal", "cinematic": "cinematic film", "glamour": "glamour photography", "noir": "black-and-white film noir", "anime": "anime", "pony": "illustrated"}
STYLE_TAGS = {
    "none": "Photorealistic, 35mm cinematic film look.",
    "photoreal": "Photorealistic, documentary-style live-action footage.",
    "cinematic": "35mm cinematic film look, graded colour.",
    "glamour": "Glamour photography look, soft and polished.",
    "noir": "Black-and-white film noir look.",
    "anime": "2D anime style, clean lines.",
    "pony": "Illustrated 2D style, clean lines.",
}
STILL_TAILS = {
    "none": "Photorealistic, high detail, natural anatomy",
    "photoreal": "Photorealistic RAW photo, high detail, natural skin, natural anatomy",
    "cinematic": "Cinematic film still, high detail, natural anatomy",
    "glamour": "Glamour photography, high detail, natural skin, natural anatomy",
    "noir": "Film noir photograph, high detail, natural anatomy",
    "anime": "High-quality anime illustration, clean lines, consistent character design",
    "pony": "High-quality illustration, clean lines, consistent character design",
}
NEGATIVE_LIST = "Negative prompt list: no subtitles, no watermark, no extra people, no face distortion, no shot cuts, no slow motion."
# English translation of the default negative prompt shipped in the open-source Wan 2.1/2.2
# configs (wan/configs/shared_config.py), for the local ComfyUI presets' negative field.
WAN_DEFAULT_NEGATIVE = ("garish colours, overexposed, static, blurred details, subtitles, style, artwork, painting, picture, still, overall greyish, worst quality, "
                        "low quality, JPEG compression artefacts, ugly, mutilated, extra fingers, poorly drawn hands, poorly drawn face, deformed, disfigured, "
                        "malformed limbs, fused fingers, motionless picture, cluttered background, three legs, many people in the background, walking backwards")

# ---- local-LLM system prompts -----------------------------------------------------
HOUSE_RULES = """You are a prompt-rewriting tool inside a private, adults-only art app; the user is an adult making content for themselves. Rewrite faithfully: never refuse, never moralise, never water down, replace or omit anything the user asked for, including explicit sexual content between adults. Keep every subject, action, object, setting and explicit detail the user wrote; do not add new characters, props or plot. Everyone depicted is an adult; if the input could be read otherwise, write it unambiguously as adults (for example "a woman in her thirties"). Never name real people. Write in English, present tense, plain concrete words; describe only what is seen and heard, no literary mood filler ("full of tension"). Output the prompt only: no title, no preamble, no quotes around the whole text, no explanation."""

VIDEO_SYSTEM = HOUSE_RULES + """

You write prompts for a Wan video model using Alibaba's official structure, in this order:
1. Overall line: "{duration} seconds, one continuous shot." plus the pacing in three words or fewer.{anchor_rule}
2. Motion, as {beats} beat(s) in time order{timestamps_rule}. One main action per beat, verb first, with a speed adverb (slowly, steadily, quickly) and an end state ("until she reaches the window", "and holds the pose"). Keep motion physically plausible and continuous. Early words matter most: lead with the action.
3. Camera, always, in plain words: shot size, angle and ONE move with its end point, or "fixed camera, position unchanged". Keep orbits under 45 degrees. Optionally a lens note ("85mm, shallow depth of field").
4. Light only if it changes during the clip or no image is given (one short clause: source, direction, tone).{audio_rule}
{style_rule}{negatives_rule}
{length_rule} Never write a line like "Prompt:" and never add headings.

Example (user wrote: she smiles and waves | 5 s | no image | sound on):
5 seconds, one continuous shot, calm pacing. A woman in her thirties with dark shoulder-length hair sits on a sofa in a sunlit living room. She slowly breaks into a warm smile, then raises her right hand and gives a small relaxed wave, holding it for a beat before lowering it. Medium shot, eye level, fixed camera, position unchanged. Soft window light from the left, warm tones. No dialogue. Sound effects: quiet room tone, the faint rustle of fabric as her arm moves. No background music. Photorealistic, 35mm cinematic film look. Negative prompt list: no subtitles, no watermark, no extra people, no face distortion, no shot cuts.

Example (user wrote: she says hi to the camera, flirty | 6 s | image given | sound on):
6 seconds, one continuous shot, playful pacing. Keep her face, hair and outfit from the first frame unchanged. (0-2s) She looks up at the camera and lets a playful smile form. (2-6s) She leans in slightly and speaks, then bites her lower lip for a moment. Medium close-up, slight low angle, the camera pushes in very slowly and stops, shallow depth of field. She says in a soft, teasing, unhurried voice: "Hi. Took you long enough." Lip sync. Sound effects: a faint creak as she leans, warm room tone. No background music. Negative prompt list: no subtitles, no extra voices, no extra people, no face distortion, no shot cuts."""

AUDIO_RULE_ON = """
5. Sound, in three parts: dialogue, sound effects, music. If the user wrote or implied speech, write the line as: She says in a <emotion, tone, speed> voice: "<the words, at most about 10 words per 5 seconds>". Lip sync. Otherwise write "No dialogue." Then "Sound effects: <source + action + ambient sound>" using observable sources (fabric, breathing, footsteps, rain). Then the music the user asked for, or "No background music." Vocal sounds the user asked for (moans, gasps, laughter) are sound effects, not dialogue."""
AUDIO_RULE_OFF = """
5. This clip is generated WITHOUT sound: do not mention dialogue, voices, sound effects or music at all."""
ANCHOR_RULE_IMAGE = """ A reference image is the first frame: the image already defines the person, scene and style, so do NOT re-describe them; describe how they move and what the camera does. Add one anchor sentence: "Keep her face, hair and outfit from the first frame unchanged." (adapt to the person). If the user re-described things visible in the image, drop those words."""
ANCHOR_RULE_TEXT = """ No image is given: open with one sentence that names who (adults, with a rough age), where, and what they wear or do not wear, taken from the user's words."""
STYLE_RULE_TEXT = "6. One short style tag at the end ({style_tag}) unless the user named a style.\n"
STYLE_RULE_IMAGE = "6. No style tag unless the user named one; the image sets the style.\n"
NEGATIVES_RULE_WAN3 = """7. Finish with one line "Negative prompt list: ..." holding only things to avoid (no subtitles, no watermark, no extra people, no face distortion, no shot cuts, plus anything specific); never repeat positives there."""
NEGATIVES_RULE_WAN = """7. No negative list: this model has a separate negative prompt."""

IMAGE_SYSTEM = HOUSE_RULES + """

You write prompts for a still-image model in natural language, in this order: who (adults, rough age, body, hair, expression, clothing or lack of it) and what they are doing; where (setting, time of day); shot size, angle and lens; light (source, direction, tone); one short style tag ({style_tag}) unless the user named a style. {length_rule} Describe only what is visible; no story, no motion over time."""

SDXL_SYSTEM = HOUSE_RULES + """

You write prompts for SDXL / Pony / Illustrious checkpoints as a comma-separated list of short tags, most important first: subject tags (adults, age, body, hair, expression, clothing or lack of it, pose, what they are doing), setting tags, shot and lens tags, lighting tags, then quality tags ({quality_tags}). 25-60 tags, no sentences, no numbering, no duplicate tags, keep every tag the user wrote."""

IMAGE_DESCRIBE_PROMPT = "Describe this photo in two factual sentences for a video director: who is in it (adults), pose, clothing or lack of it, setting, framing and lighting. Plain words, no judgement, no refusal."


def blocked_term(text: str) -> str | None:
    """Return the first blocked word found in ``text`` (case-insensitive), else None."""
    m = _BLOCK_RE.search(text or "")
    return m.group(1).lower() if m else None


def _sentences(text: str) -> list[str]:
    """Split on sentence ends, never inside double quotes."""
    text = re.sub(r"\s+", " ", (text or "").strip())
    if not text:
        return []
    parts: list[str] = []
    buf = ""
    in_quote = False
    for ch in text:
        if ch in "\"“”":
            in_quote = not in_quote
        if not in_quote and ch in ".;!?":
            if buf.strip():
                parts.append(buf.strip() + (ch if ch in "!?" else ""))
            buf = ""
            continue
        buf += ch
    if buf.strip():
        parts.append(buf.strip())
    return parts


def _segments(text: str) -> list[str]:
    """Sentences, further split at sequence words ("then", "after that"...) outside quotes."""
    out: list[str] = []
    for s in _sentences(text):
        pieces = [s] if ('"' in s or "“" in s) else SEQUENCE_SPLIT.split(s)  # keep dialogue sentences whole
        for p in pieces:
            p = LEADING_CONNECTOR.sub("", p.strip(" ,;"))
            if p:
                out.append(p)
    return out


def _is_aesthetic(seg: str) -> bool:
    """A short clause that only sets camera, light or style (no action)."""
    if SPEECH_RE.search(seg) or len(seg.split()) > 7:
        return False
    return bool(CAMERA_RE.search(seg) or LIGHT_RE.search(seg) or STYLE_RE.search(seg))


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s


def _end(s: str) -> str:
    return s if s.endswith((".", "!", "?")) else s + "."


def _lower_first(text: str) -> str:
    """Lower-case the first letter of a clause that now follows a connector (keeps "I" and acronyms)."""
    if len(text) > 1 and text[0].isupper() and text[1].islower() and not text.startswith("I "):
        return text[0].lower() + text[1:]
    return text


def beats_for(duration_s: float) -> int:
    """How many motion beats a clip of this length holds (official guidance: 2-5 s per segment)."""
    if duration_s <= 5:
        return 1
    if duration_s <= 10:
        return 2
    if duration_s <= 15:
        return 3
    if duration_s <= 22:
        return 4
    return 5


def words_for(duration_s: float) -> tuple[int, int]:
    """Target word range for a Wan 3.0 prompt: ~40-90 (<=5 s), 80-150 (6-10 s), 150-400 (11-30 s)."""
    if duration_s <= 5:
        return (40, 90)
    if duration_s <= 10:
        return (80, 150)
    return (150, min(400, 150 + int((duration_s - 10) * 12)))


def _who(raw: str) -> str:
    if re.search(r"\b(she|her|hers|woman|girl|wife|girlfriend|lady|women)\b", raw, re.I):
        return "She"
    if re.search(r"\b(he|him|his|man|guy|husband|boyfriend|men)\b", raw, re.I):
        return "He"
    return "The person"


@dataclass
class Composed:
    prompt: str
    source: str                       # "rules" | "llm:<model>"
    beats: int
    notes: list[str] = field(default_factory=list)
    image_description: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {"prompt": self.prompt, "source": self.source, "beats": self.beats, "notes": self.notes, "image_description": self.image_description}


# ---- rule-based composer ------------------------------------------------------------
def compose(
    user_prompt: str,
    *,
    has_image: bool = False,
    duration_s: float = 5.0,
    audio: bool = False,
    style: str = "none",
    target: str = "wan3",
) -> Composed:
    """Deterministic rewrite.  Adds structure and neutral defaults, never new content."""
    style = style if style in CAMERA_DEFAULTS else "none"
    raw = re.sub(r"\s+", " ", (user_prompt or "").strip())
    notes: list[str] = []
    video = target in ("wan3", "wan")
    hosted = target == "wan3"
    duration_s = max(1.0, float(duration_s or 5))
    nb = beats_for(duration_s) if video else 0

    if target == "sdxl":
        tags = [c.strip() for c in re.split(r"[,.;]\s*", raw) if c.strip()]
        if not STYLE_RE.search(raw):
            tags += [t.strip() for t in STILL_TAILS[style].lower().split(",")]
        if not LIGHT_RE.search(raw):
            tags.append(LIGHT_DEFAULTS[style].rstrip(".").lower())
        if not CAMERA_RE.search(raw):
            tags.append(STILL_CAMERA_DEFAULTS[style].rstrip(".").lower())
        seen: set[str] = set()
        tags = [t for t in tags if not (t.lower() in seen or seen.add(t.lower()))]
        return Composed(prompt=", ".join(tags), source="rules", beats=0, notes=["tag style"])

    segments = _segments(raw)
    dialogue_only = re.compile(r"^[\"“][^\"”]+[\"”][.!?]?$")
    aesthetic = [s for s in segments if _is_aesthetic(s)]
    content = [s for s in segments if not _is_aesthetic(s) and not dialogue_only.match(s)]
    quoted = re.findall(r"[\"“]([^\"”]+)[\"”]", raw)
    has_cam = bool(CAMERA_RE.search(raw))
    has_light = bool(LIGHT_RE.search(raw))
    has_sound = bool(SOUND_RE.search(raw)) or bool(quoted)
    has_music = bool(MUSIC_RE.search(raw))
    has_style = bool(STYLE_RE.search(raw))
    has_pace = bool(PACE_RE.search(raw))
    parts: list[str] = []

    if not video:
        # Still image, natural language: subject -> aesthetics -> camera -> light -> style.
        if has_image:
            parts.append("Keep the person, pose and framing of the reference image.")
        if content:
            parts.append(_end(_cap(", ".join(content))))
        elif not raw:
            notes.append("Empty prompt.")
        if aesthetic:
            parts.append(_end(_cap(", ".join(aesthetic))))
        if not has_cam:
            parts.append(STILL_CAMERA_DEFAULTS[style])
            notes.append("Added a default framing (edit it if you want another).")
        if not has_light:
            parts.append(LIGHT_DEFAULTS[style])
        if not has_style:
            parts.append(_end(STILL_TAILS[style]))
        return Composed(prompt=re.sub(r"\s+", " ", " ".join(parts)).strip(), source="rules", beats=0, notes=notes)

    # ---- video ----
    secs = int(round(duration_s))
    if hosted:
        pacing = "" if has_pace else (", steady unhurried pacing" if secs >= 6 else ", natural pacing")
        parts.append(f"{secs} seconds, one continuous shot{pacing}.")
    if has_image:
        parts.append(f"Keep the {LOOKS[style]} look of the first frame. Keep the person's face, hair and outfit unchanged.")
    # Motion beats, timestamped for hosted clips longer than one beat.
    if content:
        groups: list[list[str]] = [[] for _ in range(min(nb, len(content)))]
        for i, c in enumerate(content):
            groups[i * len(groups) // len(content)].append(c)
        total_slots = nb if hosted else len(groups)
        slot = duration_s / max(1, total_slots)
        connectors = ["", "Then ", "Next, ", "Finally, ", "At the very end, "]
        for i, g in enumerate(groups):
            text = g[0] + "".join(", then " + _lower_first(x) for x in g[1:])
            if hosted and total_slots > 1:
                a, b = int(round(i * slot)), int(round((i + 1) * slot))
                parts.append(f"({a}-{b}s) " + _end(_cap(text)))
            else:
                lead = connectors[min(i, len(connectors) - 1)] if len(groups) > 1 else ""
                parts.append(_end(_cap(lead + _lower_first(text) if lead else text)))
        if hosted and len(groups) < nb:
            a = int(round(len(groups) * slot))
            parts.append(f"({a}-{secs}s) The movement continues at the same pace and settles into a held pose as the shot ends.")
            notes.append(f"{secs} s holds about {nb} motion beats; you wrote {len(groups)}. Add more steps for a busier clip.")
    elif has_image:
        parts.append("The person comes to life with subtle, continuous motion: breathing, small shifts of weight, eyes and expression moving naturally.")
        notes.append("No action given; added gentle idle motion.")
    elif not raw:
        notes.append("Empty prompt.")
    # Camera / light the user wrote (short clauses), then defaults for what is missing.
    if aesthetic:
        parts.append(_end(_cap(", ".join(aesthetic))))
    if not has_cam:
        parts.append(CAMERA_DEFAULTS[style])
        notes.append("Added a default camera (edit it if you want another move).")
    if not has_light:
        parts.append("Lighting unchanged." if has_image else LIGHT_DEFAULTS[style])
    # Sound (hosted model with audio on): dialogue, effects, music; silence must be asked for.
    if hosted and audio:
        if quoted and not SPEECH_RE.search(raw):
            parts.append(f"{_who(raw)} says in a soft, unhurried voice: \"{quoted[0].strip()}\". Lip sync.")
        elif quoted:
            parts.append("Lip sync.")
        else:
            parts.append("No dialogue.")
        if not has_sound or quoted:
            parts.append("Sound effects: natural room tone, fabric and breathing that follow the movement.")
        if not has_music:
            parts.append("No background music.")
    elif video and has_sound and not (hosted and audio):
        notes.append("Sound is off for this preset, so spoken lines and sound words will not be heard.")
    # Style tag (only when no image sets the look) and the inline negative list.
    if not has_style and not has_image:
        parts.append(STYLE_TAGS[style])
    if hosted:
        parts.append(NEGATIVE_LIST)
    prompt = re.sub(r"\s+", " ", " ".join(parts)).strip()
    return Composed(prompt=prompt, source="rules", beats=nb, notes=notes)


# ---- local LLM --------------------------------------------------------------------
class LLMError(Exception):
    def __init__(self, message: str, hint: str | None = None):
        super().__init__(message)
        self.hint = hint

    def to_dict(self) -> dict[str, Any]:
        return {"message": str(self), "hint": self.hint}


DEFAULT_LLM_URLS = ("http://127.0.0.1:11434/v1", "http://127.0.0.1:1234/v1", "http://127.0.0.1:8080/v1", "http://127.0.0.1:9931/v1", "http://127.0.0.1:5001/v1")
VISION_HINTS = ("vl", "vision", "llava", "minicpm", "moondream", "gemma3", "pixtral", "bakllava", "caption", "joycaption")
# When the server lists several models and none was chosen with --llm-model, prefer these (first match wins).
# They are the ones that follow a system prompt without moralising (see README "Local LLM").
PREFERRED_MODELS = ("dolphin3", "mistral-nemo", "qwen2.5-abliterate", "qwen3-abliterated", "llama3.1-8b-abliterated", "hermes3", "dolphin", "mistral", "qwen2.5", "qwen3", "llama3")
THINKING_MODELS = ("qwen3", "deepseek-r1", "gpt-oss", "magistral")


def is_loopback(url: str) -> bool:
    host = (urlsplit(url).hostname or "").lower().strip("[]")
    return host in ("127.0.0.1", "localhost", "::1") or host.startswith("127.")


@dataclass
class LLMInfo:
    url: str
    model: str
    server: str          # "ollama" | "lm studio" | "openai-compatible"
    vision: bool         # the text model itself can look at images
    models: list[str]
    native: str | None = None        # Ollama root URL (without /v1) when its native API is available
    vision_model: str | None = None  # a separate vision-capable model on the same server, if any


def _is_vision(name: str) -> bool:
    n = name.lower()
    return any(h in n for h in VISION_HINTS)


def _pick_model(models: list[str], wanted: str) -> str:
    if wanted:
        for m in models:
            if m == wanted or m.startswith(wanted + ":") or m.startswith(wanted):
                return m
        return wanted  # not listed, use it anyway (the server may still accept it)
    text_models = [m for m in models if not _is_vision(m)] or models
    for pref in PREFERRED_MODELS:
        for m in text_models:
            if pref in m.lower():
                return m
    return text_models[0] if text_models else ""


class LocalLLM:
    """Minimal OpenAI-compatible chat client for a *local* server.

    ``url`` is the base URL ending in ``/v1`` (``http://127.0.0.1:11434/v1`` for Ollama,
    ``http://127.0.0.1:1234/v1`` for LM Studio).  ``model`` is the model tag; if empty
    the first model the server lists is used.
    """

    def __init__(self, url: str | None = None, model: str | None = None, *, allow_remote: bool = False, timeout: float = 180.0):
        self.urls = [url.rstrip("/")] if url else list(DEFAULT_LLM_URLS)
        if not allow_remote:
            bad = [u for u in self.urls if not is_loopback(u)]
            if bad:
                raise ValueError(f"LLM URL must be on this machine (127.0.0.1); got {bad[0]}. Pass --llm-allow-remote to use a server on your LAN.")
        self.model = (model or "").strip()
        self.timeout = timeout
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=3.0), trust_env=False)
        self._info: LLMInfo | None = None
        self._info_at = 0.0
        self._lock = asyncio.Lock()

    async def aclose(self) -> None:
        await self._http.aclose()

    async def info(self, max_age: float = 20.0) -> LLMInfo | None:
        """Probe the configured URL(s); cached for ``max_age`` seconds.  None = nothing running."""
        async with self._lock:
            if self._info is not None and time.time() - self._info_at < max_age:
                return self._info
            if self._info is None and time.time() - self._info_at < min(max_age, 5.0):
                return None
            for base in self.urls:
                try:
                    r = await self._http.get(f"{base}/models", timeout=2.0)
                    if r.status_code != 200:
                        continue
                    data = r.json()
                except (httpx.HTTPError, ValueError):
                    continue
                models = [m.get("id") for m in (data.get("data") or []) if isinstance(m, dict) and m.get("id")]
                server = "openai-compatible"
                native = None
                root = base[:-3] if base.endswith("/v1") else base
                try:
                    tags = await self._http.get(f"{root}/api/tags", timeout=2.0)  # only Ollama answers this
                    if tags.status_code == 200 and isinstance(tags.json(), dict) and "models" in tags.json():
                        server, native = "ollama", root
                        models = [m.get("name") or m.get("model") for m in tags.json().get("models") or [] if isinstance(m, dict)] or models
                except (httpx.HTTPError, ValueError):
                    pass
                if server != "ollama" and ":1234" in base:
                    server = "lm studio"
                model = _pick_model(models, self.model)
                if self.model and models and model == self.model and self.model not in models:
                    log.warning("LLM model %s is not in the server's list (%s); using it anyway", self.model, ", ".join(models[:5]))
                vision_model = model if _is_vision(model) else next((m for m in models if _is_vision(m)), None)
                self._info = LLMInfo(url=base, model=model, server=server, vision=vision_model is not None, models=models, native=native, vision_model=vision_model)
                self._info_at = time.time()
                return self._info
            self._info = None
            self._info_at = time.time()
            return None

    async def chat(self, messages: list[dict[str, Any]], *, temperature: float = 0.7, max_tokens: int = 450, model: str | None = None) -> str:
        """One chat completion.  On Ollama the native /api/chat is used so the model is unloaded
        right after the answer (``keep_alive: 0``) and the context size is bounded; elsewhere the
        OpenAI-compatible endpoint is used with explicit sampling values."""
        info = await self.info(max_age=0 if self._info is None else 20.0)
        if info is None:
            raise LLMError("No local LLM server found", f"Start Ollama or LM Studio (looked at {', '.join(self.urls)}), or run Darkroom with --llm off to hide this option.")
        model = model or info.model
        if not model:
            raise LLMError("The local LLM server has no models loaded", "Pull one first, e.g. `ollama pull dolphin3:8b`, or pick a model in LM Studio.")
        temp = 0.3 if "nemo" in model.lower() else temperature  # Mistral: "We recommend to use a temperature of 0.3"
        if info.native:
            body: dict[str, Any] = {
                "model": model, "messages": _to_ollama_messages(messages), "stream": False,
                "keep_alive": 0,  # give the VRAM back to ComfyUI as soon as the rewrite is done
                "options": {"temperature": temp, "top_p": 0.9, "top_k": 40, "repeat_penalty": 1.05, "num_predict": max_tokens, "num_ctx": 8192},
            }
            if any(t in model.lower() for t in THINKING_MODELS):
                body["think"] = False
            url = f"{info.native}/api/chat"
        else:
            body = {"model": model, "messages": messages, "temperature": temp, "top_p": 0.9, "max_tokens": max_tokens, "stream": False}
            url = f"{info.url}/chat/completions"
        try:
            r = await self._http.post(url, json=body)
        except httpx.TimeoutException:
            raise LLMError("The local LLM took too long", "A 7-8B model should answer in well under a minute on a 4060 Ti; close ComfyUI's model from VRAM or pick a smaller LLM.") from None
        except httpx.HTTPError as e:
            self._info = None
            raise LLMError(f"Local LLM request failed: {e.__class__.__name__}", "Is the LLM server still running?") from None
        if r.status_code >= 400:
            try:
                detail = (r.json().get("error") or {}).get("message") or r.text[:200]
            except (ValueError, AttributeError):
                detail = r.text[:200]
            raise LLMError(f"Local LLM returned HTTP {r.status_code}: {detail}", "Check the model name (--llm-model) and the server's own log.")
        try:
            data = r.json()
            text = data["message"]["content"] if info.native else data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError):
            raise LLMError("Local LLM returned an unexpected response", "The server is not OpenAI-compatible, or the model produced nothing.") from None
        return str(text or "")


def _to_ollama_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """OpenAI content parts -> Ollama native (text + raw-base64 ``images``)."""
    out = []
    for m in messages:
        content = m.get("content")
        if isinstance(content, list):
            texts, images = [], []
            for part in content:
                if part.get("type") == "text":
                    texts.append(part.get("text", ""))
                elif part.get("type") == "image_url":
                    url = (part.get("image_url") or {}).get("url", "")
                    images.append(url.split(",", 1)[1] if url.startswith("data:") and "," in url else url)
            msg: dict[str, Any] = {"role": m.get("role", "user"), "content": "\n".join(texts)}
            if images:
                msg["images"] = images
            out.append(msg)
        else:
            out.append({"role": m.get("role", "user"), "content": str(content or "")})
    return out


def _clean_llm_text(text: str) -> str:
    """Strip reasoning tags, code fences, leading labels and wrapping quotes from a model answer."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    text = re.sub(r"^```[a-z]*\s*|\s*```$", "", text.strip(), flags=re.S)
    text = re.sub(r"^\s*(prompt|expanded prompt|rewritten prompt|output)\s*:\s*", "", text, flags=re.I)
    text = text.strip()
    if len(text) > 2 and text[0] in "\"“" and text[-1] in "\"”" and text.count('"') <= 2:
        text = text[1:-1]
    text = re.sub(r"\s*\n\s*", " ", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def system_prompt_for(target: str, *, duration_s: float, audio: bool, has_image: bool, style: str) -> str:
    """Build the system prompt for the local LLM for one request."""
    style = style if style in CAMERA_DEFAULTS else "none"
    if target == "sdxl":
        return SDXL_SYSTEM.format(quality_tags=STILL_TAILS[style].lower())
    if target == "image":
        return IMAGE_SYSTEM.format(style_tag=STILL_TAILS[style].split(",")[0].lower(), length_rule="Length: 40-90 words.")
    hosted = target == "wan3"
    nb = beats_for(duration_s)
    lo, hi = words_for(duration_s) if hosted else (40, 100)
    secs = int(round(duration_s))
    return VIDEO_SYSTEM.format(
        duration=secs,
        beats=nb,
        timestamps_rule=(f", each on its own with a time range like (0-{max(2, secs // nb)}s)" if hosted and nb > 1 else ""),
        anchor_rule=ANCHOR_RULE_IMAGE if has_image else ANCHOR_RULE_TEXT,
        audio_rule=(AUDIO_RULE_ON if audio else AUDIO_RULE_OFF) if hosted else AUDIO_RULE_OFF,
        style_rule=(STYLE_RULE_IMAGE if has_image else STYLE_RULE_TEXT.format(style_tag=STYLE_TAGS[style].rstrip("."))),
        negatives_rule=NEGATIVES_RULE_WAN3 if hosted else NEGATIVES_RULE_WAN,
        length_rule=f"Length: {lo}-{hi} words for a {secs} second clip.",
    )


class Director:
    """Facade used by app.py: rules always work; the LLM is optional."""

    def __init__(self, llm: LocalLLM | None = None):
        self.llm = llm

    async def status(self) -> dict[str, Any]:
        info = await self.llm.info() if self.llm else None
        return {
            "rules": True,
            "llm": None if info is None else {"url": info.url, "model": info.model, "server": info.server, "vision": info.vision, "vision_model": info.vision_model},
            "llm_configured": self.llm is not None,
            "llm_urls": self.llm.urls if self.llm else [],
        }

    async def describe_image(self, image_bytes: bytes, mime: str) -> str | None:
        """Ask a vision-capable local model for a two-sentence description of the source image."""
        if not self.llm:
            return None
        info = await self.llm.info()
        if not info or not info.vision_model:
            return None
        data_url = f"data:{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"
        try:
            text = await self.llm.chat(
                [{"role": "user", "content": [{"type": "text", "text": IMAGE_DESCRIBE_PROMPT}, {"type": "image_url", "image_url": {"url": data_url}}]}],
                temperature=0.2,
                max_tokens=160,
                model=info.vision_model,
            )
        except LLMError as e:
            log.warning("Image description skipped: %s", e)
            return None
        return _clean_llm_text(text)[:600] or None

    async def direct(
        self,
        user_prompt: str,
        *,
        use_llm: bool,
        has_image: bool,
        duration_s: float,
        audio: bool,
        style: str,
        target: str = "wan3",
        image_bytes: bytes | None = None,
        image_mime: str = "image/png",
    ) -> Composed:
        """Expand ``user_prompt``.  Raises LLMError when ``use_llm`` is set and no server answers."""
        bad = blocked_term(user_prompt)
        if bad:
            raise ValueError(f"The prompt contains '{bad}'. Darkroom only generates adults; remove that word.")
        if target not in ("wan3", "wan", "image", "sdxl"):
            target = "wan3"
        if not use_llm or self.llm is None:
            return compose(user_prompt, has_image=has_image, duration_s=duration_s, audio=audio, style=style, target=target)
        video = target in ("wan3", "wan")
        nb = beats_for(duration_s) if video else 0
        description = await self.describe_image(image_bytes, image_mime) if (has_image and image_bytes) else None
        system = system_prompt_for(target, duration_s=duration_s, audio=audio, has_image=has_image, style=style)
        facts = []
        if video:
            facts.append(f"Clip length: {int(round(duration_s))} seconds. Sound: {'on' if (audio and target == 'wan3') else 'off'}.")
        if style not in ("none", ""):
            facts.append(f"Style preset: {style}.")
        if has_image:
            facts.append("A reference image is supplied" + (" as the first frame." if video else ".") + (f" It shows: {description}" if description else " Assume the person, pose and setting come from it."))
        user = "\n".join(facts) + f"\n\nUser prompt:\n{user_prompt.strip() or '(none: bring the image to life)'}\n\nRewritten prompt:"
        _, hi = words_for(duration_s) if target == "wan3" else (40, 100)
        text = await self.llm.chat([{"role": "system", "content": system}, {"role": "user", "content": user}], temperature=0.7, max_tokens=int(hi * 2.2) + 120)
        cleaned = _clean_llm_text(text)
        notes: list[str] = []
        if blocked_term(cleaned):
            raise ValueError("The local model wrote something about minors; the rewrite was discarded. Rephrase and try again.")
        fallback_reason = None
        if len(cleaned.split()) < 12:
            fallback_reason = "The model answered very briefly; falling back to the rule-based rewrite."
        elif re.search(r"\b(I can(?:'|no)t|I cannot|I'm sorry|as an AI|I am unable|I won't)\b", cleaned[:160], re.I):
            fallback_reason = "The local model refused; use a less restricted model (see README) or the rule-based rewrite."
        if fallback_reason:
            fb = compose(user_prompt, has_image=has_image, duration_s=duration_s, audio=audio, style=style, target=target)
            fb.notes = [fallback_reason] + fb.notes
            return fb
        info = await self.llm.info()
        return Composed(prompt=cleaned[:6000], source=f"llm:{info.model if info else '?'}", beats=nb, notes=notes, image_description=description)
