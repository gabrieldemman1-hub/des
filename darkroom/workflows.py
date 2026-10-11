"""
Workflow templates: the bridge between Darkroom's simple form and ComfyUI's node graph.

HOW THIS WORKS
--------------
ComfyUI does not know about "models" or "modes"; it executes a JSON node graph
("API format" / "prompt" format).  Darkroom keeps one such graph per preset in
``darkroom/workflows/*.json`` and fills in the user's values before sending it.

A template is a normal ComfyUI API-format workflow (the file you get from
ComfyUI's menu: *Workflow -> Export (API)*), with two additions:

1. A top-level ``"_meta"`` object that describes the preset to the UI (name,
   mode, defaults, which model dropdown to show...).  It is stripped before the
   graph is sent to ComfyUI, so it is also the place to leave notes/comments
   (JSON has no comment syntax).

2. Placeholder tokens written as ``"{{NAME}}"`` wherever a user-controlled
   value belongs.  When a string value is *exactly* a token it is replaced by
   a typed value (int/float/str), so ``"steps": "{{STEPS}}"`` becomes
   ``"steps": 28``.  Tokens inside a longer string are substituted as text,
   e.g. ``"filename_prefix": "darkroom/{{FILENAME_PREFIX}}"``.

TO POINT DARKROOM AT A DIFFERENT WORKFLOW / MODEL
-------------------------------------------------
* Build and test the workflow in ComfyUI's own UI.
* Export it with *Workflow -> Export (API)* (enable Dev mode in settings if the
  item is missing).
* Save it as ``darkroom/workflows/<anything>.json``.
* Replace the values you want to control from the form with tokens (see
  ``KNOWN_TOKENS`` below), e.g. the KSampler's ``seed`` -> ``"{{SEED}}"``,
  the positive CLIPTextEncode's ``text`` -> ``"{{PROMPT}}"``.
* Add a ``"_meta"`` block (copy one from an existing template).  Set
  ``"mode"`` to ``"txt2img"`` or ``"img2vid"`` so it shows up under the right
  tab.  If the graph loads a model through a node whose choices ComfyUI can
  list (CheckpointLoaderSimple/ckpt_name, UNETLoader/unet_name, ...), point
  ``"_meta.model"`` at that node class + input and use ``"{{MODEL}}"`` for
  its value; the UI will then offer a live dropdown of installed files.
* Restart Darkroom (templates are loaded at start-up).  The preset appears in
  the "Workflow" dropdown.  Nothing else in the code needs to change.

See ``darkroom/workflows/README.md`` for the full ``_meta`` reference.
"""
from __future__ import annotations

import copy
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

TOKEN_RE = re.compile(r"\{\{([A-Z][A-Z0-9_]*)\}\}")
# Anything that looks like a placeholder, so {{prompt}} / {{ SEED }} can be reported instead of sent to ComfyUI verbatim.
LOOSE_TOKEN_RE = re.compile(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")

# Every token Darkroom knows how to fill.  A template may use any subset.
KNOWN_TOKENS: dict[str, str] = {
    "PROMPT": "Positive prompt (text -> image) or motion prompt (image -> video).",
    "NEGATIVE": "Negative prompt (Darkroom appends a short always-on safety negative).",
    "SEED": "Integer seed, 0 .. 2**64-1.",
    "STEPS": "Sampling steps (int).",
    "CFG": "Classifier-free guidance scale (float).",
    "WIDTH": "Output width in pixels (int).",
    "HEIGHT": "Output height in pixels (int).",
    "MODEL": "Model filename chosen in the Model dropdown (str).",
    "SAMPLER": "KSampler sampler_name (str).",
    "SCHEDULER": "KSampler scheduler (str).",
    "IMAGE": "Source image for image -> video, as uploaded to ComfyUI's input folder (str).",
    "FRAMES": "Number of video frames (int).",
    "FPS": "Video frames per second (int).",
    "FILENAME_PREFIX": "Prefix ComfyUI uses for its own copy of the output (str).",
}

MODES = ("txt2img", "img2vid")

# What the form shows by default; a template's _meta.controls can override.
DEFAULT_CONTROLS = {
    "prompt": True,
    "negative": True,
    "steps": True,
    "cfg": True,
    "seed": True,
    "size": True,
    "model": True,
    "sampler": False,
    "frames": False,
    "fps": False,
}

DEFAULT_DEFAULTS = {
    "steps": 25,
    "cfg": 6.0,
    "width": 1024,
    "height": 1024,
    "frames": 81,
    "fps": 16,
    "sampler": "euler",
    "scheduler": "normal",
    "negative": "",
    "prompt": "",
}


class TemplateError(ValueError):
    """A template file is malformed or is missing a value it needs."""


@dataclass
class Template:
    id: str
    path: Path
    graph: dict[str, Any]  # node graph only (no _meta)
    meta: dict[str, Any]

    # ---- descriptive helpers -------------------------------------------------
    @property
    def name(self) -> str:
        return str(self.meta.get("name") or self.id)

    @property
    def mode(self) -> str:
        return str(self.meta.get("mode"))

    @property
    def order(self) -> int:
        try:
            return int(self.meta.get("order", 100))
        except (TypeError, ValueError):
            return 100

    @property
    def controls(self) -> dict[str, bool]:
        controls = dict(DEFAULT_CONTROLS)
        controls.update({k: bool(v) for k, v in (self.meta.get("controls") or {}).items()})
        # A control is pointless if the graph has no token for it.
        toks = self.tokens()
        if "NEGATIVE" not in toks:
            controls["negative"] = False
        if "STEPS" not in toks:
            controls["steps"] = False
        if "CFG" not in toks:
            controls["cfg"] = False
        if "WIDTH" not in toks and "HEIGHT" not in toks:
            controls["size"] = False
        if "MODEL" not in toks:
            controls["model"] = False
        if "SAMPLER" not in toks and "SCHEDULER" not in toks:
            controls["sampler"] = False
        if "FRAMES" not in toks:
            controls["frames"] = False
        if "FPS" not in toks:
            controls["fps"] = False
        if "PROMPT" not in toks:
            controls["prompt"] = False
        return controls

    @property
    def defaults(self) -> dict[str, Any]:
        d = dict(DEFAULT_DEFAULTS)
        d.update(self.meta.get("defaults") or {})
        return d

    @property
    def constraints(self) -> dict[str, Any]:
        c = {"size_step": 8, "size_min": 64, "size_max": 4096, "frames_rule": None, "frames_min": 1, "frames_max": 1024}
        c.update(self.meta.get("constraints") or {})
        return c

    @property
    def model_selector(self) -> dict[str, str] | None:
        m = self.meta.get("model")
        if not m or "MODEL" not in self.tokens():
            return None
        if not isinstance(m, dict) or not m.get("node_class") or not m.get("input"):
            raise TemplateError(f"{self.path.name}: _meta.model needs 'node_class' and 'input'")
        return {"node_class": str(m["node_class"]), "input": str(m["input"]), "default": str(m.get("default", ""))}

    def tokens(self) -> set[str]:
        found: set[str] = set()

        def walk(obj: Any) -> None:
            if isinstance(obj, dict):
                for v in obj.values():
                    walk(v)
            elif isinstance(obj, list):
                for v in obj:
                    walk(v)
            elif isinstance(obj, str):
                found.update(TOKEN_RE.findall(obj))

        walk(self.graph)
        return found

    def node_classes(self) -> dict[str, str]:
        """node id -> class_type, used to turn progress messages into labels."""
        return {nid: str(node.get("class_type", "?")) for nid, node in self.graph.items()}

    def to_public(self) -> dict[str, Any]:
        """What the browser needs to know about this preset (never the graph)."""
        return {
            "id": self.id,
            "name": self.name,
            "mode": self.mode,
            "description": str(self.meta.get("description", "")),
            "notes": list(self.meta.get("notes") or []),
            "requires": list(self.meta.get("requires") or []),
            "controls": self.controls,
            "defaults": self.defaults,
            "constraints": self.constraints,
            "model": self.model_selector,
            "sizes": [list(map(int, s)) for s in (self.meta.get("sizes") or []) if isinstance(s, (list, tuple)) and len(s) == 2],
            "sampler_node": (self.meta.get("sampler") or {}).get("node_class", "KSampler"),
            "tokens": sorted(self.tokens()),
        }

    # ---- rendering -----------------------------------------------------------
    def render(self, values: dict[str, Any]) -> dict[str, Any]:
        """Return a deep copy of the graph with every token replaced.

        ``values`` maps token names (without braces) to typed values.  A token
        used by the template but absent from ``values`` is an error, because
        ComfyUI would otherwise receive the literal string ``"{{SEED}}"``.
        """
        missing = self.tokens() - set(values)
        if missing:
            raise TemplateError(
                f"{self.path.name} uses {', '.join('{{' + m + '}}' for m in sorted(missing))} "
                "but no value was provided"
            )

        def substitute(obj: Any) -> Any:
            if isinstance(obj, dict):
                return {k: substitute(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [substitute(v) for v in obj]
            if isinstance(obj, str):
                exact = TOKEN_RE.fullmatch(obj)
                if exact:
                    return values[exact.group(1)]  # typed replacement
                return TOKEN_RE.sub(lambda m: str(values[m.group(1)]), obj)
            return obj

        return substitute(copy.deepcopy(self.graph))


def _validate(template: Template) -> None:
    p = template.path.name
    if template.mode not in MODES:
        raise TemplateError(f"{p}: _meta.mode must be one of {MODES}, got {template.mode!r}")
    if not template.graph:
        raise TemplateError(f"{p}: no nodes found (only _meta?)")
    for nid, node in template.graph.items():
        if not isinstance(node, dict) or "class_type" not in node or not isinstance(node.get("inputs"), dict):
            raise TemplateError(
                f"{p}: node {nid!r} must look like {{'class_type': ..., 'inputs': {{...}}}}. "
                "Did you export with 'Export (API)' rather than the normal save?"
            )
    unknown = template.tokens() - set(KNOWN_TOKENS)
    if unknown:
        raise TemplateError(
            f"{p}: unknown token(s) {sorted(unknown)}. Known tokens: {sorted(KNOWN_TOKENS)}"
        )
    loose: set[str] = set()

    def scan(obj: Any) -> None:
        if isinstance(obj, dict):
            for v in obj.values():
                scan(v)
        elif isinstance(obj, list):
            for v in obj:
                scan(v)
        elif isinstance(obj, str):
            for m in LOOSE_TOKEN_RE.finditer(obj):
                if not TOKEN_RE.fullmatch(m.group(0)):
                    loose.add(m.group(0))

    scan(template.graph)
    if loose:
        raise TemplateError(
            f"{p}: placeholder(s) {sorted(loose)} must be written exactly like {{{{SEED}}}}: upper-case, no spaces. "
            f"Known tokens: {sorted(KNOWN_TOKENS)}"
        )
    if template.mode == "img2vid" and "IMAGE" not in template.tokens():
        raise TemplateError(f"{p}: an img2vid template must use \"{{{{IMAGE}}}}\" in its LoadImage node")
    sel = template.model_selector  # also validates the shape of _meta.model
    if "MODEL" in template.tokens() and sel is None:
        raise TemplateError(
            f"{p}: the graph uses {{{{MODEL}}}} but _meta.model (node_class + input) is missing; add it, "
            "or hard-code the file name in the node and drop the token"
        )
    if sel is not None and not any(
        isinstance(n, dict) and n.get("class_type") == sel["node_class"] and (n.get("inputs") or {}).get(sel["input"]) == "{{MODEL}}"
        for n in template.graph.values()
    ):
        raise TemplateError(
            f"{p}: _meta.model points at {sel['node_class']}.{sel['input']} but no such node has \"{{{{MODEL}}}}\" "
            "as that input (copy-pasted _meta from another preset?)"
        )
    for key in ("steps", "cfg", "width", "height", "frames", "fps"):
        val = (template.meta.get("defaults") or {}).get(key)
        if val is not None and not isinstance(val, (int, float)):
            raise TemplateError(f"{p}: _meta.defaults.{key} must be a number, got {val!r}")


def load_template(path: Path) -> Template:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise TemplateError(f"{path.name}: invalid JSON ({e})") from e
    if not isinstance(raw, dict):
        raise TemplateError(f"{path.name}: top level must be an object")
    meta = raw.get("_meta")
    if not isinstance(meta, dict):
        raise TemplateError(f"{path.name}: missing \"_meta\" object (see workflows/README.md)")
    graph = {k: v for k, v in raw.items() if k != "_meta"}
    template = Template(id=path.stem, path=path, graph=graph, meta=meta)
    _validate(template)
    return template


def load_templates(directory: Path) -> tuple[dict[str, Template], list[str]]:
    """Load every ``*.json`` in ``directory``.

    Returns (templates by id, list of human-readable problems).  A broken file
    never stops the app; it is reported and skipped so the other presets work.
    """
    templates: dict[str, Template] = {}
    problems: list[str] = []
    for path in sorted(directory.glob("*.json")):
        if path.name.startswith("_"):
            continue  # convention: files starting with "_" are disabled
        try:
            templates[path.stem] = load_template(path)
        except TemplateError as e:
            problems.append(str(e))
    return templates, problems


def ordered(templates: dict[str, Template]) -> list[Template]:
    return sorted(templates.values(), key=lambda t: (t.mode, t.order, t.name.lower()))
