# Research notes: sources, platforms, glossary, troubleshooting, weapons

**Date:** 2026-09-22 · pages fetched that day (guide.xim.tech showed `BUILD 20260714`)

**Method:** five research questions. Each was answered by one researcher, and an
independent fact-checker then re-opened every cited page. Of 173 claims, 165 were
confirmed, 4 were partly wrong (corrected below) and 4 could not be verified (marked).
Unless marked, everything below is confirmed against the linked page. Quotes are verbatim,
including the source's own typos.

These notes are raw material for the knowledge base, not app content. Nothing here
becomes a recommendation until it goes through the citation model in `CONCEPT.md` §8.

---

## 1. Sources

| Source | Publisher | Tier for Dialed | What it's good for |
|---|---|---|---|
| [XIM MATRIX User Guide](https://guide.xim.tech/) | XIM Technologies ("Copyright © 2026 XIM Technologies, Inc.") | **Official** | Definitions of every MATRIX setting, platform/output rules, troubleshooting checklists. **No Destiny 2 content at all.** |
| [XIM Game Settings](https://community.xim.tech/pub/xim-game-settings) (public copy of a forum topic) | XIM Community Forum; post by "mist" | **Official by reference.** The guide's "required aim settings" links go to `xim.tech/settings`, which redirects here | The required in-game settings per game, **including Destiny 2**. Shows only the original post date (Dec 8, 2015) but has been updated since (e.g. it lists Battlefield 6 and Black Ops 7) |
| [XIM MATRIX Official Hardware Compatibility List](https://community.xim.tech/pub/xim-matrix-official-hardware-compatibility-list) | XIM forum | Official | Mice that don't work, or work only at certain polling rates |
| [XIM MATRIX Getting Started Guide](https://community.xim.tech/pub/xim-matrix-getting-started-guide) | OBsIV, posting as XIM ("See our User Guide") | Official | Short welcome page. Calls guide.xim.tech the "XIM MATRIX Comprehensive User Guide" |
| XIM MATRIX Support FAQ (`community.xim.tech/t/xim-matrix-support-faq/247232`) | XIM forum | Official | xim.tech describes it as "common problems and fixes". **Requires a forum login; not read yet.** |
| [@OBsIV on YouTube](https://www.youtube.com/@OBsIV) | XIM (the official Quick Start video) | Official | Instructional videos |
| [XIM Central](https://www.youtube.com/@XIMCentral) (formerly XIMGameplay) | Independent creator | **Community expert** | Active MATRIX tutorials in 2026 (smoothing, quantization, curves, sight modifiers). The channel says it is "not the official Youtube channel of the XIM Company", and xim.tech calls its videos "created by XIM community gamers". **Its Destiny 2 videos are all from the older XIM APEX/XIM4 devices.** Transcripts of recent videos could not be read; creator-posted English scripts exist on pastebin/controlc for some older ones |
| [XIM Config Cloud](https://configs.xim.tech) | Community-uploaded, hosted by XIM | **Not on the whitelist** (candidate) | Public Destiny 2 configs. "Featured Configs are Configs contributed by our community that the XIM Team deems as exceptional." |

**Watch out:** a YouTube channel called "Official Xim Matrix" (`UCdM4OpQJvUTLx83MIO8aoJg`)
exists. Its ownership could not be verified, so don't treat it as official.

**About the "XIM community guide":** nothing published under that exact name exists.
The best match is guide.xim.tech, the only complete, current, XIM-published reference,
which XIM's own community forum links as *the* guide. That still needs the user's
confirmation.

## 2. Platforms and Destiny 2

- **PC is supported.** XIM MATRIX supports "Xbox Series X|S, PlayStation 5, Xbox One,
  PlayStation 4, and PC" ([What is XIM MATRIX?](https://guide.xim.tech/What-Is-XIM-MATRIX/)).
- **Output type decides everything downstream.** Smart Translation and Game Settings
  synchronization "apply only to Configs that output as controller"
  ([Game Settings](https://guide.xim.tech/Game-Settings/)). Mouse-and-keyboard output instead
  uses a one-time Reticle Velocity Calibration and has no required in-game settings.
  - Xbox: output as a controller, with an authentication controller in Port 3
    ([Gaming On Xbox](https://guide.xim.tech/Gaming-On-Xbox/)). The guide is inconsistent on
    whether third-party licensed controllers can authenticate.
  - PC: controller output (XInput, Xbox, DualSense or DualShock 4), mouse-and-keyboard
    output, or "Mouse, Keyboard, Controller" (PC only).
    ([Inputs & Outputs](https://guide.xim.tech/Inputs-Outputs/))
  - PC with controller output: "make sure you don't have any virtual controller emulation
    tools (such as Steam Input or DS4Windows) installed that may conflict"
    ([Troubleshooting PC](https://guide.xim.tech/Troubleshooting-PC/)).
- **Destiny 2 required in-game settings** ([XIM Game Settings](https://community.xim.tech/pub/xim-game-settings)):
  Movement Controls: Default · Button Layout: Default · Look Sensitivity: 20 ·
  ADS Sensitivity Modifier: 1.5 · Axial Deadzone: 0 · Radial Deadzone: 0.13.
  General rule on that page: "maximum in-game sensitivity and all other values as default
  unless otherwise stated". Manager can also show them: "press the gear icon on Manager's
  main screen".
- **Destiny 2 probably supports only Standard sync.** Fifteen game entries say "This game
  supports Custom In-Game Settings"; Destiny 2's doesn't. *This is an inference, not a
  statement.* Sight Modifiers and per-scope settings require Custom.
- **Destiny 2 has no Simulate Analog Behavior (SAB) requirement,** unlike Apex, Black Ops
  6/7 and Fortnite.
- **No documented Xbox vs PC difference** for Destiny 2.
- Current platform columns for Destiny 2 in the Game Support List require a forum login.
  A Feb 2023 archived copy listed Destiny 2 on Xbox Series X|S, PS5, Xbox One, PS4 and PC.
  *Unconfirmed for today.*

## 3. Glossary: official definitions

All from [Aim Settings](https://guide.xim.tech/Aim-Settings/) unless noted.

| Term (as Manager spells it) | Official meaning |
|---|---|
| **Sensitivity** (mouse) | cm/360, the distance to do a full turn. "Lower values produce faster aiming speeds." Official advice: "Always start with just adjusting Sensitivity. Change other values only if necessary. There is no "right" set of values." |
| **Smoothing** | "Gaming input hardware and natural hand jitter can cause an noisy input environment. Smoothing solves this by providing additional stability and control to your aim." Mouse and motion each have presets; "It's strictly based on preference." Preset names seen in screenshots: *Synchronous*, *Balanced*, *Custom*. *Light* appears once but isn't confirmed as a preset name. |
| **Standard** (smoothing mode) | "dynamic smoothing behavior that adapts to your current aim speed." Settings: Precision, Response, Easing (+ Stability, motion aim only). |
| **Precision** | "Controls fine aim behavior. Higher values provide a smoother result at low aim speeds and increases the heaviness of the reticle." |
| **Response** | "Controls fast aim behavior. Higher values produces a lighter feeling reticle at faster aim speeds." *(Unrelated to the mouse "response rate" diagnostic tool.)* |
| **Easing** | "Specifies aim behavior from rest. Higher values result in smoother transition from rest but lower response time." |
| **Stability** | "Specifies aim behavior at rest … (motion aim only)." |
| **Classic** (smoothing mode) | "based on our past generation XIM APEX device which provides static smoothing behavior" — it does *not* adapt to aim speed. Settings: Smooth, Decay, Synch. |
| **Smooth** | APEX's old "Smoothing": "Higher values increase impact". "Values match XIM APEX behavior." |
| **Decay** | "Controls how much the Smooth setting relies on past inputs. Higher values decrease the impact of older input values." APEX-equivalent: 9.0. |
| **Synch** | APEX's old "Synchronize". APEX equivalents: "8=Default, 16=Common, 32=Slow, or 0=Off". |
| **Aiming Curve** | "how your reticle speed transitions from 0 to 100% velocity". Default is linear. MATRIX curves *replace* the game's curve instead of stacking on it. |
| **Y Scale** | Vertical-only sensitivity (%), in the "Mechanics" section alongside the curve and quantization. |
| **Quantization** | "can be used to improve compatibility with aim assist … your reticle velocity will "snap" to configured magnitude and angle values." Off by default. Start at "Magnitude to 25 and Angle to 25. Adjust one value at a time". Warning: "may negatively affect real world sensitivity accuracy." |
| **Magnitude** (quantization) | "Snaps your reticle to predefined speeds. The effect increases the faster you aim." |
| **Angle** (quantization) | "Snaps your reticle to predefined angles. The effect is independent of aiming speed." |
| Aim Magnitude / Aim Angle (*Smart Actions*) | **A different thing with the same names:** actions that move the reticle at a set speed and angle, e.g. for recoil control or auto-turn ([Smart Actions Reference](https://guide.xim.tech/Smart-Actions-Reference/)). Behavior Variance adds randomness to them. |
| **Velocity Mapping** | How curves and thumbstick aim map to reticle velocity. Standard is the default. |
| **Game Settings synchronization** | Standard / Custom / Manual; controller output only ([Game Settings](https://guide.xim.tech/Game-Settings/)). Standard: in-game sensitivity at maximum, required settings applied, everything else default. Manual calibration for controller output "is thus discouraged". |
| **Hip / Aim Down Sight** | Set independently when the game has ADS, which Game Roles detect. Inheritance: *Inherit All* (default), *Sensitivity Only*, *Inherit Nothing*. There is also an *ADS Activation Delay*. |
| **Deadzone** | Inner, outer, axial and drift offsets. "Your game's deadzone settings must match the required settings for your game." |
| **SAB** (Simulate Analog Behavior) | A controller-output feature. When a game requires it (Destiny 2 doesn't), a strict checklist applies: no curves, no quantization, smoothing not below the presets, not faster than 20 cm/360 ([SAB](https://guide.xim.tech/Simulate-Analog-Behavior/)). |
| *Steady Aim, Boost* | **Not MATRIX settings.** These were XIM APEX features. XIM Central's MATRIX quantization video title calls quantization "Aim Stabilizer (Steady Aim)", but no source says the two are equivalent. |

## 4. Troubleshooting: what's sourced

**Official symptom → fix (the only explicit one):** with mouse-and-keyboard output, if at very
low speed "your reticle is skipping or jittering then lower your game's mouse sensitivity",
and disable mouse acceleration on PC ([Velocity Calibration](https://guide.xim.tech/Velocity-Calibration/)).

**Official "foundation" checks.** These are the things that make aim feel wrong. Mostly from
[Troubleshooting Mice](https://guide.xim.tech/Troubleshooting-Mice/),
[Dashboard](https://guide.xim.tech/Dashboard/), [Warning Lights](https://guide.xim.tech/Warning-Lights/)
and [Identity](https://guide.xim.tech/Identity/).

- Update firmware first: "It is recommended that you upgrade if there is an update available before continuing troubleshooting."
- Required in-game settings: "Failure to configure your game's required settings correctly will result in negative aiming performance".
- An out-of-date Smart Translator is flagged in Manager. Fix: "Recreate the Config to update its translation."
- A wrong DPI in the Config: "If it is wrong, your mouse aim won't be accurate." Use Manager's Check DPI tool.
- A polling rate lower than what you set, caused by onboard-memory settings or wireless interference. Use the Check Rate tool, move the dongle away with a USB extension, and check the Hardware Compatibility List.
- A non-linear curve, quantization turned on, or an Elite 2 stick curve on Xbox all break cm/360 accuracy.
- Rapid purple blinking means "timing errors" (check cables and hubs). A quick red flash means you hit the game's maximum turn speed.

**Coverage of feel symptoms:**

| Coverage | Symptoms |
|---|---|
| Well sourced | Jitter / stutter / skipping; "sensitivity feels wrong or inconsistent"; wireless dropouts |
| Thin (mostly XIM Central, APEX era) | Laggy/delayed; sluggish or capped turns; fighting aim assist ("bubble"); mushy/spongy from too much smoothing |
| **No sourced answer** | Floaty; overshooting; hip-fire vs ADS inconsistency |

**Community (XIM Central, mostly 2018–2021 scripts; attribution checked for some but not all):**
a slow-trace stutter test and an ordered fix list (in-game settings → translator → DPI →
polling → sync → smoothing → hardware). "Too much smoothing will make your mouse movements
feel spongy and less direct." Stutter makes aim assist feel "like an obstacle". Also: don't
change settings too often, because you need time to get used to one before you can judge it.

**Contested (sources from different device generations disagree):** DPI (APEX-era 3,000–4,000
vs MATRIX-era "more DPI", up to about 12,000), polling rate, and Synch.

## 5. Weapons and multiple aim setups

- **No source (official or XIM Central) gives weapon-type-specific settings** (e.g. pulse
  rifle vs hand cannon) for Destiny 2 or any other game.
- MATRIX has no documented way to know which weapon is equipped. The closest is inferring
  it from rumble patterns (Rumble Triggers, controller output only). Whether Destiny 2 has
  distinct rumble patterns per weapon is unknown.
- **Documented ways to have more than one aim behavior:**
  - separate **Hip vs ADS** settings (with *Inherit Nothing*, ADS can differ entirely)
  - bindings that apply only in Hip or only in ADS
  - **Modify Aim Sensitivity** Smart Action (while a button is used)
  - **Groups** for [weapon loadout tracking](https://guide.xim.tech/Weapon-Loadouts/), cycled manually
  - Sight Modifiers and per-scope settings (need Custom sync, likely unavailable for Destiny 2)
  - **loading another Config** by hotkey or with the Load Config Smart Actions ([Loading Configs](https://guide.xim.tech/Loading-Configs/))
- **Smoothing, curve and quantization can't change mid-game inside one Config.** No
  documented action does it. The only documented way is loading a different Config.
  *Undocumented, not proven impossible.*

## 6. Still open

- Forum-login-only material: the Support FAQ, the full Game Settings topic, and the Game
  Support List from D onward. Needs a forum account.
- Content of XIM Central's recent MATRIX videos (transcripts were blocked).
- Whether Destiny 2 supports Custom sync, and whether it has per-weapon rumble patterns.
- Bungie's policy on input devices for PC Destiny 2 (out of scope for XIM sources; not researched).
