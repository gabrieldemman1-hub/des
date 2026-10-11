# Workflow presets

Every `*.json` file in this folder is one entry in Darkroom's **Workflow** dropdown.
A preset is a normal ComfyUI workflow in **API format** plus a `_meta` block and a few
`{{TOKENS}}` where the form's values go. Darkroom never changes the graph structure: it only
fills the tokens and sends the result to `POST /prompt` on your ComfyUI, exactly like
ComfyUI's own "Queue" button.

Files whose name starts with `_` are ignored (handy for keeping a preset around without
showing it). Presets are read when Darkroom starts, so restart it after editing.

## Shipped presets

| File | Mode | Model files it expects (ComfyUI/models/…) |
|---|---|---|
| `txt2img_checkpoint.json` | Text → Image | `checkpoints/<any SD1.5 / SDXL / Pony / Illustrious checkpoint>` (dropdown lists them) |
| `img2vid_wan22_5b.json` | Image → Video | `diffusion_models/wan2.2_ti2v_5B_fp16.safetensors`, `text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors`, `vae/wan2.2_vae.safetensors` |
| `img2vid_wan22_14b.json` | Image → Video | `diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors` + `wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors`, `text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors`, `vae/wan_2.1_vae.safetensors` (two-expert, 24 GB class GPU) |
| `img2vid_wan21_14b.json` | Image → Video | `diffusion_models/wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors`, `text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors`, `vae/wan_2.1_vae.safetensors`, `clip_vision/clip_vision_h.safetensors` |
| `img2vid_svd.json` | Image → Video | `checkpoints/svd_xt_1_1.safetensors` (no text prompt; animated .webp output) |

The Wan files come from the official ComfyUI Wan examples (Comfy-Org repackaged weights on
Hugging Face); SVD from Stability AI. Each preset's `_meta.requires` lists the exact paths and
the model dropdown shows which files ComfyUI actually sees.

## Adding your own workflow (any model, any custom nodes)

1. Build the workflow in ComfyUI and run it once so you know it works there.
2. Export it in API format: **Workflow ▸ Export (API)** in the new UI, or *Save (API Format)*
   in the old one (enable *Dev mode options* in settings if the item is missing).
3. Copy the file into this folder, e.g. `txt2img_flux_mylora.json`.
4. Open it and replace the values you want to control from Darkroom with tokens, keeping the
   quotes: `"seed": 123` → `"seed": "{{SEED}}"`, `"text": "a cat"` → `"text": "{{PROMPT}}"`.
   A string that is *exactly* a token becomes a typed value (number, text); a token inside a
   longer string is pasted as text (`"filename_prefix": "mine/{{FILENAME_PREFIX}}"`).
5. Add a `_meta` block at the top (copy one from a shipped preset and edit it, see below).
6. Restart Darkroom. The preset appears under the tab named by `_meta.mode`.

Anything you leave as a literal value (LoRA names and strengths, shift, denoise, samplers,
ControlNets…) is sent unchanged, so you can bake a whole setup into one preset and switch
between presets from the dropdown.

### Tokens

| Token | Filled with | Type |
|---|---|---|
| `{{PROMPT}}` | Prompt (text→image) or motion prompt (image→video), after the style preset is applied | text |
| `{{NEGATIVE}}` | Negative prompt + style negative + Darkroom's always-on safety negative | text |
| `{{SEED}}` | Seed (random unless "Fixed" is ticked) | int |
| `{{STEPS}}` | Steps | int |
| `{{CFG}}` | CFG | float |
| `{{WIDTH}}` `{{HEIGHT}}` | Size, snapped to `constraints.size_step` | int |
| `{{MODEL}}` | The file picked in the Model dropdown (see `_meta.model`) | text |
| `{{SAMPLER}}` `{{SCHEDULER}}` | Advanced ▸ sampler / scheduler | text |
| `{{IMAGE}}` | The source image, after Darkroom uploads it to `ComfyUI/input/darkroom/` | text |
| `{{FRAMES}}` `{{FPS}}` | Video length and frame rate | int |
| `{{FILENAME_PREFIX}}` | `darkroom/<mode>` so ComfyUI's own copy lands in `ComfyUI/output/darkroom/` | text |

A preset may use any subset. Controls whose token is absent are hidden automatically
(for example the SVD preset has no `{{PROMPT}}`, so the prompt box disappears).

### `_meta` reference

```jsonc
"_meta": {
  "name": "Shown in the dropdown",
  "mode": "txt2img",                 // or "img2vid" (which tab it belongs to)
  "order": 10,                       // sort order inside the tab (lower first)
  "description": "One or two sentences shown under the dropdown.",
  "notes": ["Free-form comments. JSON has no comment syntax; put yours here."],
  "requires": ["ComfyUI/models/checkpoints/whatever.safetensors"],

  // Which node/input the Model dropdown should list. Darkroom asks ComfyUI
  // (GET /object_info/<node_class>) for that input's choices = the files it found.
  // "default" is pre-selected when installed. Omit "model" to hide the dropdown
  // (then don't use {{MODEL}}; hard-code the file in the node instead).
  "model": { "node_class": "CheckpointLoaderSimple", "input": "ckpt_name", "default": "" },
  //   other useful pairs:  UNETLoader/unet_name   ImageOnlyCheckpointLoader/ckpt_name
  //                        VAELoader/vae_name     CLIPLoader/clip_name   LoraLoader/lora_name

  // Show/hide form controls (defaults: everything on except sampler/frames/fps).
  "controls": { "prompt": true, "negative": true, "steps": true, "cfg": true, "seed": true,
                "size": true, "model": true, "sampler": false, "frames": false, "fps": false },

  // Initial values the first time this preset is used (the form remembers your last values).
  "defaults": { "steps": 28, "cfg": 6.0, "width": 1024, "height": 1024, "frames": 81, "fps": 16,
                "sampler": "dpmpp_2m", "scheduler": "karras", "negative": "lowres, ..." },

  // Darkroom snaps width/height to size_step and clamps to [size_min, size_max];
  // frames_rule "4n+1" (Wan) or "8n+1" (LTX) snaps the frame count.
  "constraints": { "size_step": 8, "size_min": 256, "size_max": 2048,
                   "frames_rule": null, "frames_min": 1, "frames_max": 1024 },

  // Quick-pick size chips.
  "sizes": [[1024, 1024], [832, 1216], [1216, 832]]
}
```

## Recipes

**Add a LoRA to the checkpoint preset.** In ComfyUI insert *LoraLoader* after the checkpoint
loader and re-wire MODEL/CLIP through it, export (API), add `_meta`. The exported node looks like:

```json
"10": { "class_type": "LoraLoader", "inputs": { "lora_name": "my_style.safetensors",
        "strength_model": 0.8, "strength_clip": 0.8, "model": ["4", 0], "clip": ["4", 1] } }
```

and the KSampler's `model` becomes `["10", 0]`, both CLIPTextEncode `clip` inputs `["10", 1]`.
Use `{{MODEL}}` with `"model": {"node_class": "LoraLoader", "input": "lora_name"}` if you would
rather pick the *LoRA* from the dropdown and hard-code the checkpoint.

**Video output nodes.** Any of these work; Darkroom finds the produced file whatever node saved it:

```json
"13": { "class_type": "CreateVideo", "inputs": { "images": ["12", 0], "fps": "{{FPS}}" } },
"14": { "class_type": "SaveVideo",   "inputs": { "video": ["13", 0], "filename_prefix": "{{FILENAME_PREFIX}}", "format": "mp4", "codec": "h264" } }
```
```json
"13": { "class_type": "SaveAnimatedWEBP", "inputs": { "images": ["12", 0], "filename_prefix": "{{FILENAME_PREFIX}}", "fps": "{{FPS}}", "lossless": false, "quality": 90, "method": "default" } }
```
```json
"13": { "class_type": "VHS_VideoCombine", "inputs": { "images": ["12", 0], "frame_rate": "{{FPS}}", "loop_count": 0, "filename_prefix": "{{FILENAME_PREFIX}}", "format": "video/h264-mp4", "pingpong": false, "save_output": true } }
```
(the last one needs the ComfyUI-VideoHelperSuite custom node).

**Wan 2.2 14B (two-stage high/low noise), LTX-Video, Hunyuan, Flux…** Export the official
example from ComfyUI's template browser (Workflow ▸ Browse Templates), tokenise the seed /
prompts / size / length, set `_meta.model` to the node that loads the main weights, done.

## When ComfyUI rejects a preset

Darkroom shows ComfyUI's own validation message. The common ones:

* `Value not in list … ckpt_name: 'x' not in […]` – that model file is not installed, or it is
  in the wrong folder. Pick another in the dropdown or download it to the listed folder.
* `Required input is missing` / `Return type mismatch` – a link in the JSON points at the wrong
  node or slot; re-export from ComfyUI rather than editing links by hand.
* `Cannot execute because node X does not exist` – a custom node is not installed in ComfyUI.
* `uses {{FOO}} but no value was provided` (from Darkroom) – a typo in a token name.
