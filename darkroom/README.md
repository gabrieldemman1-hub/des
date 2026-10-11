# Darkroom

A private, local-only web frontend for [ComfyUI](https://github.com/comfyanonymous/ComfyUI):
text → image and image → video with a dark, phone-friendly page, a gallery of everything you
make, and swappable workflow presets. Everything runs on your machine; nothing leaves it.

* Talks only to **your** ComfyUI at `http://127.0.0.1:8188` (configurable).
* No accounts, no analytics, no CDN, no fonts or scripts from the web. The page ships a
  Content-Security-Policy that makes the browser refuse to load anything that is not served by
  Darkroom itself, so even a future mistake cannot phone home.
* Listens on `127.0.0.1` only. Results are saved to `./outputs` with the prompt and seed next to
  them.
* **✨ Expand** turns a few words into a full, structured prompt, with built-in rules or with a
  language model running on your own PC (Ollama / LM Studio). Nothing is applied silently.
* Optional and **off by default**: a *Cloud video* tab for SpicyAPI's Spicy Motion 3 (a paid,
  hosted Wan 3.0-class video model). It exists only when you start Darkroom with an API key, and
  only that tab uses the internet. See [Cloud video](#cloud-video-optional-paid).

![two modes, gallery, history](docs/screenshot-desktop.png)

## Requirements

* **ComfyUI** installed and working (desktop app, portable build, or a git checkout) with at
  least one model, e.g. an SDXL / Pony / Illustrious checkpoint in `ComfyUI/models/checkpoints`.
  For video, the Wan 2.2 5B files (see [workflows/README.md](workflows/README.md)).
  Pony-family checkpoints: use the "CLIP skip 2" preset and the "Pony score tags" style.
* **Python 3.10 or newer** for Darkroom itself (any Python; it does not need to be ComfyUI's).
  3.11 to 3.14 are the safe choices. On Windows, tick "Add python.exe to PATH" in the python.org
  installer. If pip ever says *Building wheel for … did not run successfully*, your Python is
  newer than a library supports: install Python 3.13, delete `.venv`, and run again.

Darkroom's own dependencies, all local libraries ([requirements.txt](requirements.txt)):
`fastapi`, `uvicorn`, `httpx`, `websockets`, `python-multipart`, `pillow`.

## Run it

**1. Start ComfyUI** the way you always do, and wait until it prints
`To see the GUI go to: http://127.0.0.1:8188`.

```sh
# git checkout
cd ComfyUI && python main.py
# Windows portable build: double-click run_nvidia_gpu.bat
# Desktop app: just open it. It listens on http://127.0.0.1:8000 (not 8188); Darkroom
# checks both ports by itself, so no flag is needed. Any other address: --comfy http://host:port
```

Keep ComfyUI on `127.0.0.1` (its default). Do not start it with `--listen`: ComfyUI has no login,
and it keeps its own copy of every Darkroom result and source image, so on `0.0.0.0` anyone on your
network could read them.

Live previews of the sampling steps appear in Darkroom automatically: it asks ComfyUI for
cheap latent previews per job. (Only very old ComfyUI builds ignore that request; there, start
ComfyUI with `--preview-method auto`.)

**2. Start Darkroom** (first run creates a `.venv` and installs the dependencies):

```sh
cd darkroom
./run.sh            # macOS / Linux
run.bat             # Windows (double-click works too)
```

or by hand:

```sh
cd darkroom
python3 -m venv .venv                            # Windows: py -3 -m venv .venv
.venv/bin/pip install -r requirements.txt        # Windows: .venv\Scripts\pip install -r requirements.txt
.venv/bin/python app.py                          # Windows: .venv\Scripts\python app.py
```

Your browser opens `http://127.0.0.1:8585`. The green dot top-right means ComfyUI is reachable;
a red banner tells you when it is not and what to do.

Options: `./run.sh --comfy http://127.0.0.1:8188 --port 8585 --outputs ./outputs --no-browser`
(`run.bat` passes options through the same way). The same can be set with the `COMFY_URL`,
`DARKROOM_PORT`, `DARKROOM_OUTPUTS` environment variables.

## Using it

**Text → Image.** Pick a workflow preset and a model (the dropdown lists the files ComfyUI
actually has), write the prompt and negative prompt, set steps / CFG / size, press
**Generate** (or Ctrl/⌘ + Enter). The progress bar follows ComfyUI's sampler; when the job
is done the image appears in the viewer and in the gallery, already saved to disk.

**Image → Image.** Start from a photo: drop it on the box, paste it, or press **→ Image** on a
gallery image, write a prompt and set the **Strength** slider (0.3 to 0.5 keeps the photo and
changes style and details, 0.7 to 0.9 keeps only the rough composition). "⟷ match source" picks a
size with the photo's aspect ratio; otherwise it is center-cropped.

**Image → Video.** Drop an image on the box, paste one from the clipboard, or press **→ Video**
on any gallery image, then write a *motion prompt* ("slow push-in, hair moving in the wind").
Frames and FPS are per preset (Wan 2.2: 121 frames at 24 fps ≈ 5 s). The result plays in the
viewer; the source frame becomes its gallery thumbnail.

**Seed.** Empty = a new random seed each time. The seed that was used is shown after every job;
tick **Fixed** to keep it, 🎲 picks a new fixed one. **Reuse settings** on a result restores
everything including the seed. Note that ComfyUI caches node results: a fixed seed with
unchanged settings comes back instantly as the same image (Darkroom still saves a new copy).

**Style.** A preset that wraps your prompt ("{prompt}, cinematic still, film grain…"). Edit or
add styles in `presets/styles.json` (read once at start-up; restart Darkroom afterwards).

**✨ Expand.** Rewrites a short prompt into the long, ordered form the models were trained on:
who and where → what happens, as motion beats in time order → camera → light → sound → style.
The result lands in the prompt box for you to edit; **Undo** puts your words back. The built-in
rules add only neutral camera and light defaults and never new content. If a local LLM is running
(see [Expanding prompts with a local LLM](#expanding-prompts-with-a-local-llm)) a **use local
LLM** box appears and the rewrite gets much better. Video presets get sentence prompts, SDXL /
Pony presets get comma tags; `prompt_style` in a preset's `_meta` switches that.

**Gallery.** Every result is saved as
`outputs/<date>-<time>_<mode>_<prompt snippet>_<seed>.<png|mp4|webp>` plus a `.json` with the
full settings. Thumbnails, filter by images/videos, download, delete, use as video source.

**Recent prompts.** The last 20 prompts (with their settings) in `outputs/history.json`.
Click one to load it.

**Cancel** interrupts the running job in ComfyUI or removes it from its queue.

## Using it from your phone

Darkroom listens only on the PC by default. To use it from a phone or tablet on the same Wi-Fi,
start it with `--lan`:

```sh
./run.sh --lan          # Windows: run.bat --lan
```

It prints a `Phone -> http://192.168.x.y:8585` line (the same address is shown under the
gallery); open that in the phone's browser. Allow Darkroom if Windows Firewall asks (private
networks). Note that there is no login: anyone on that Wi-Fi can open it while it runs this way,
so use it on your home network only. A VPN on the PC that blocks local-network access can also
block the phone; allow LAN access in the VPN's settings or disconnect it.

## Expanding prompts with a local LLM

Hosted services quietly run every prompt through a language model before generating: "woman
walks to the window" becomes a paragraph with motion beats, camera, light and sound, and the
video models are trained on captions written that way. That expansion is a large part of why
their output looks good. Darkroom does the same step on your PC. The rules-only version always
works; with [Ollama](https://ollama.com/download/windows) installed it uses a real model:

```powershell
# one-time, in PowerShell (no admin needed). Darkroom finds Ollama at 127.0.0.1:11434 by itself.
ollama pull dolphin3:8b                                  # default: follows instructions, ~5 GB
ollama pull mistral-nemo:12b                             # optional: better prose, ~7 GB, slower
ollama pull huihui_ai/qwen2.5-vl-abliterated:7b          # optional: *looks at the source image* first
```

Tick **use local LLM** next to the prompt and press ✨ Expand. Darkroom asks Ollama to unload the
model right after each answer (`keep_alive: 0`), so ComfyUI gets its VRAM back; a rewrite takes
about five to ten seconds on an RTX 4060 Ti. LM Studio (port 1234), llama.cpp's `llama-server`
(8080 / 9931) and KoboldCpp (5001) are detected too, as any OpenAI-compatible server is with
`--llm http://127.0.0.1:<port>/v1`. `--llm-model <tag>` picks a specific model, `--llm off`
hides the option. Darkroom refuses an LLM address that is not on this machine unless you add
`--llm-allow-remote`.

Why these models: stock Qwen, Llama and Gemma are tuned to refuse adult requests. Dolphin and
Mistral-Nemo follow the system prompt as written; the `huihui_ai/*-abliterated` builds are the
same base models with the refusal behaviour removed. If a model still refuses or answers in two
words, Darkroom says so and falls back to the rules.

Privacy: Ollama's tray app checks `ollama.com` for updates once an hour; running `ollama serve`
from a terminal instead does not, and nothing about your prompts is sent anywhere either way.
Model downloads obviously use the internet. `setx OLLAMA_NO_CLOUD 1` turns off Ollama's optional
cloud features for good measure.

The rules and the system prompts live in [director.py](director.py). They follow Alibaba's
published Wan 3.0 prompt guide (timed beats, "fixed camera, position unchanged", dialogue as
`She says in a soft voice: "…". Lip sync.`, `No dialogue.` / `No background music.` when you
want silence, a closing `Negative prompt list:` because Wan 3.0 has no negative-prompt field) and
the prompt-extension prompts shipped in the open-source Wan repositories, minus the part of those
prompts that silently replaces adult content with something else.

## Cloud video (optional, paid)

**Off unless you ask for it.** Start Darkroom with a [SpicyAPI](https://www.spicyapi.com) key and
a fourth tab, **☁ Cloud video**, appears. Only that tab talks to the internet: your prompts go to
SpicyAPI (Wayfinity Ltd, Cyprus), which renders them on Alibaba Cloud in Singapore and bills a
prepaid balance. Finished clips are downloaded into your gallery like everything else. Without a
key nothing in Darkroom can reach the internet.

```bat
run.bat --spicy-key sk-spicy-xxxxxxxx         :: Windows (or: set SPICYAPI_KEY=sk-spicy-... then run.bat)
./run.sh --spicy-key sk-spicy-xxxxxxxx        # macOS / Linux
```

What you get: **Spicy Motion 3** (and *3 Fast*), by every published parameter Alibaba's Wan 3.0
served with adult content allowed: 2 to 30 s clips, 480p / 720p / 1080p, speech, sound effects
and music written into the prompt, 60 fps on request. Two presets:

* **Text → Video.** The whole clip from your prompt; pick an aspect ratio or let the model choose.
* **Frame + Video.** A first picture is rendered on SpicyAPI from a *frame prompt* ($0.06 to
  $0.09), then animated with the *motion prompt*.

**Your own images cannot be used.** SpicyAPI animates only images it generated itself and rejects
uploads, local files and other URLs before charging, as a stated policy, not a bug. So the
Image → Video tab stays local (ComfyUI, Wan 2.2) and the cloud tab is for text or for frames
made there.

Before any money is spent, Darkroom runs each prompt through SpicyAPI's `/v1/moderations`
pre-check ($0.001). A prompt it would refuse stops right there with the reason, is not charged,
and does not count against your account, which matters: refusals of real generation requests in
the severe categories (minors, real people, non-consent, bestiality) are permanent strikes, an
account is flagged at three and suspended at ten. Sandbox keys and "dry runs" count too, which is
why the pre-check is the only probe Darkroom uses. The estimated price is on the Generate button
and a confirmation asks before sending. **Cancel** only stops waiting; SpicyAPI keeps rendering and
billing the task and the clip stays in your SpicyAPI library.

| Setting | Notes |
|---|---|
| Duration | 2 to 30 s. **auto** lets the model choose; SpicyAPI debits 30 s first and refunds the unused seconds. |
| Resolution / price | Spicy Motion 3: $0.10 / $0.20 / $0.40 per second at 480p / 720p / 1080p. Fast tier: $0.14 / $0.28 / $0.56. A 10 s 720p clip is $2.00. |
| Aspect ratio | Text → Video only (16:9, 9:16, 1:1, 4:3, 3:4, 21:9, or auto). A first frame sets the shape itself. |
| sound | Speech, effects and music generated with the clip. Lines in quotes in the prompt are spoken; `No dialogue.` keeps it quiet. |
| 60 fps | Interpolation after rendering, +20 % of the price. The clip is also sent to fal.ai (US) for this step. |
| SpicyAPI enhance | Their own prompt rewriter (you cannot see its version). Off by default: use ✨ Expand instead, which writes the prompt in Wan's official format and keeps your content. |
| Seed | Reproducibility seed, same as the local tabs. |

Prompting that works on this model, from Alibaba's guide and SpicyAPI's own notes: one action per
five seconds, state the camera even when it is still, write spoken lines in quotes with who says
them, say `No background music.` unless you want some, and keep clips short (5 to 10 s) and chain
them from a consistent first frame rather than asking for one long take. ✨ Expand does all of
this for you.

Before signing up, know the terms: prepaid only, $50 minimum top-up by card or crypto, no free
credits (a **Sandbox** key, ticked when you create it, returns example clips for free and is the
right way to try the tab); in the UK, France, Germany, Italy, Australia, Brazil and 27 US states
a one-time age check is required after the first top-up, and SpicyAPI forbids using a VPN for it;
the terms describe the service as intended for businesses, though nothing forbids a private user.
Data: SpicyAPI keeps request records (first 500 characters of each prompt, parameters, IP, links
to outputs) for the life of the account plus six years, outputs while the account exists, and
states that Alibaba Cloud processes prompts and media under its own terms "which may allow it to
use it to improve its own models". Prices and rules are theirs and change; the numbers above are
from October 2026.

Why not Alibaba's own API, at half the price? Alibaba Model Studio runs every prompt, input image
and output video through its content moderation and refuses explicit content
(`DataInspectionFailed`); fal.ai, which also serves Wan 3.0, sits on the same models. SpicyAPI's
markup pays for the permission and their own screening layer.

For development there is a fake SpicyAPI: `python dev/mock_spicyapi.py --port 8787`, then
`python app.py --spicy-key sk-spicy-test --spicy-url http://127.0.0.1:8787/v1`. Nothing leaves
the machine; see the magic words at the top of that file.

## Swapping models and workflows

The Model dropdown already covers "same workflow, different checkpoint". For anything else
(LoRAs, Flux, Wan 2.2 14B, LTX-Video, custom nodes…) drop a ComfyUI *API-format* workflow into
`workflows/` with a few `{{TOKENS}}` and a small `_meta` block. It shows up in the Workflow
dropdown after a restart. The how-to, the token list and the `_meta` reference are in
[workflows/README.md](workflows/README.md); the top of [workflows.py](workflows.py) explains
the mechanism in the code.

## Files

```
app.py              the web server (FastAPI) and the /api routes; python app.py starts it
comfy_client.py     the ComfyUI client: /prompt, /ws progress + previews, /history, /view, /upload
director.py         ✨ Expand: rule-based prompt rewriting + the optional local-LLM rewriter
spicy_client.py     the optional cloud engine (SpicyAPI); loaded only with --spicy-key
workflows.py        loads workflows/*.json and fills the {{TOKENS}}
storage.py          outputs/ gallery, sidecar JSON, thumbnails, prompt history
workflows/          the presets (API-format ComfyUI graphs) and their README
presets/styles.json style presets
static/             the page: index.html, style.css, app.js (no build step, no dependencies)
dev/mock_comfyui.py a fake ComfyUI for trying the UI without a GPU (optional)
dev/mock_llm.py     a fake Ollama / OpenAI-compatible chat server for tests
dev/mock_spicyapi.py a fake SpicyAPI for tests and for trying the cloud tab for free
tests/              pytest suite (unit tests + end-to-end runs against the mocks)
outputs/            your results (created on first run, ignored by git)
```

## Troubleshooting

| Message | What it means |
|---|---|
| **ComfyUI is not reachable at http://127.0.0.1:8188** | ComfyUI is not running, still loading, or on another port. Darkroom also checks port 8000 (the Desktop app) by itself; for any other port start it with `./run.sh --comfy http://127.0.0.1:<port>` (the port is in ComfyUI's console or its browser address bar). |
| **Value not in list … ckpt_name: 'x' not in […]** | The preset's model file is not installed (or sits in the wrong `models/` subfolder). Pick another model in the dropdown or download the file; press ↻ next to Model after copying files. |
| **Node 'X' not found. The custom node may not be installed** (older ComfyUI: *Cannot execute because node X does not exist*) | Your ComfyUI is too old for that node (the video presets need CreateVideo/SaveVideo/Wan22ImageToVideoLatent: update ComfyUI) or a custom node is missing. |
| **… out of memory** | Lower width/height, frames or steps; close other GPU apps; use fp8 weights or the smaller preset. |
| **Finished but produced no files** | The workflow has no `SaveImage` / `SaveVideo` node (a `PreviewImage` is not enough). |
| Model dropdown is empty | ComfyUI is offline, or the folder named in the preset's `requires` is empty. |
| Live preview never appears | Your ComfyUI ignores the per-job preview request; start it with `--preview-method auto`. Everything else works without it. |
| **No local LLM server found** | Ollama / LM Studio is not running on this PC (Darkroom looks at 127.0.0.1 ports 11434, 1234, 8080, 9931, 5001). Start it, or untick *use local LLM*; the rules-only Expand always works. |
| **The local model refused** / answered in two words | Pick a model that follows the system prompt (`ollama pull dolphin3:8b`) or pass `--llm-model`; Darkroom already fell back to the rules. |
| **SpicyAPI rejected the API key** | The key is wrong, revoked, or the terms were not accepted in the dashboard. Create a key at spicyapi.com → dashboard → API keys and restart Darkroom with it. |
| **Blocked by SpicyAPI's content screen** / **screen is unsure** | Their pre-check refused the prompt (nothing charged, no strike). Make every person unmistakably adult and consenting, avoid real people's names, then try again. |
| **Insufficient balance** / **spend limit reached** | Top up at spicyapi.com ($50 minimum) or raise the monthly limit in their dashboard. Nothing was charged. |
| Cloud task **withheld** after rendering | SpicyAPI's output check refused the finished clip; the charge is refunded. Change the prompt or the first frame. |

ComfyUI also keeps its own copy of each result in `ComfyUI/output/darkroom/` and the uploaded
source images in `ComfyUI/input/darkroom/` (the Desktop app: under its chosen base folder,
`Documents/ComfyUI` by default). Darkroom's Delete only removes its own copy in `./outputs`;
clear those ComfyUI folders yourself whenever you like.

## Privacy notes

* Darkroom binds to `127.0.0.1`. `--lan` (or `--host 0.0.0.0`) lets other devices on your
  network use it, without any login; only do that on a network you trust.
* Without a SpicyAPI key the server talks to exactly two things, both on this machine: the
  ComfyUI URL you configured and, if one is running, a local LLM server on `127.0.0.1`. Both
  clients ignore `HTTP_PROXY`-style environment variables so that cannot be redirected.
* With `--spicy-key`, the **Cloud video** tab, and only it, sends prompts to `api.spicyapi.com`
  and downloads the results. The status pill and the other tabs never contact the cloud; the
  balance check when you open that tab and pressing its Generate button do. The key is read from
  the command line or `SPICYAPI_KEY`, is never sent to the browser, and never appears in logs.
* The browser page cannot load anything from anywhere but Darkroom (CSP `default-src 'self'`).
* No telemetry anywhere in the stack. (This is also why Darkroom is a small FastAPI app rather
  than Gradio or Streamlit: both send usage analytics by default unless you remember to turn
  them off, and Gradio versions before 6.17 also pulled fonts and a script from CDNs.)
* The ComfyUI *server* (git checkout / portable build) has no telemetry. The ComfyUI **Desktop**
  app includes crash reporting and an optional "Send anonymous usage metrics" setting: decline it
  at install or turn it off in its settings. The ComfyUI *Manager* custom node fetches its node
  registry from the internet. None of this involves Darkroom.
* Your browser is the one component Darkroom does not control. Chrome and Edge, for example,
  contact their vendor's autofill service for any page that has a form, and do other profile-level
  background traffic. Use Firefox or Safari, or turn off "Save and fill addresses / payment
  methods" in Chrome's Autofill settings, if that matters to you.
* The page remembers your settings per preset in the browser: numbers and model names in
  `localStorage`, prompt text and seed only in `sessionStorage` (gone when the browser closes).
  The **Clear** button under Recent prompts also forgets the remembered prompt text.
* A short safety negative (`child, minor, underage, loli, shota`) is appended to every job
  server-side (`ALWAYS_NEGATIVE` in `app.py`). It costs nothing for adult content and keeps
  models from drifting somewhere illegal. For adults, depicting adults.

## Development

```sh
.venv/bin/pip install pytest
.venv/bin/python -m pytest             # unit tests + end-to-end tests against the three mocks
.venv/bin/python dev/mock_comfyui.py   # fake ComfyUI on :8188 to click around without a GPU
.venv/bin/python dev/mock_llm.py       # fake Ollama on :11434 (✨ Expand with "use local LLM")
.venv/bin/python dev/mock_spicyapi.py  # fake SpicyAPI on :8787 (then --spicy-key sk-spicy-test --spicy-url http://127.0.0.1:8787/v1)
```
