# Research notes: sources, platforms, glossary, troubleshooting, weapons

**Date:** 2026-09-22 · pages fetched that day (guide.xim.tech showed `BUILD 20260714`)

**Method:**
- Five research questions. Each was answered by one researcher, and an independent
  fact-checker then re-opened every cited page. Of 173 claims, 165 were confirmed,
  4 were partly wrong (corrected here) and 4 couldn't be verified (marked).
- The notes and the concept were then reviewed three more times: against the live
  pages, against the fact-checker's verdicts, and against the user's decisions.
  Their corrections are included.

Unless marked, everything below is confirmed against the linked page. Quotes are
verbatim, including the source's own typos; `[brackets]` mark capitalisation changes.

These notes are raw material for the knowledge base, not app content. Nothing here
becomes a recommendation until it goes through the citation model in `CONCEPT.md` §8.

---

## 1. Sources

| Source | Publisher | Tier for Dialed | What it's good for |
|---|---|---|---|
| [XIM MATRIX User Guide](https://guide.xim.tech/) | XIM Technologies ("Copyright © 2026 XIM Technologies, Inc.") | **Official** | Definitions of every MATRIX setting, platform/output rules, troubleshooting checklists. **No Destiny 2 content at all.** |
| [XIM Game Settings](https://community.xim.tech/pub/xim-game-settings) (public copy) | XIM Community Forum; post by "mist" (not confirmed as XIM staff) | **Official by reference** | The required in-game settings per game, **including Destiny 2**. The guide's "required aim settings" links go to `xim.tech/settings`. That redirects (301) to the login-walled forum topic `community.xim.tech/t/xim-game-settings/195265`, not to this page. This page is a public copy of that topic's first post, and may not match the gated topic or the list in Manager's gear icon. Shows only the original post date (Dec 8, 2015), but has been updated since (e.g. it lists Battlefield 6 and Black Ops 7). |
| [XIM MATRIX Official Hardware Compatibility List](https://community.xim.tech/pub/xim-matrix-official-hardware-compatibility-list) | XIM forum | Official | Mice that don't work, or work only at certain polling rates |
| [XIM MATRIX Getting Started Guide](https://community.xim.tech/pub/xim-matrix-getting-started-guide) | OBsIV, writing in XIM's voice ("See our User Guide") | Official (OBsIV's role is inferred, not stated) | Short welcome page. Calls guide.xim.tech the "XIM MATRIX Comprehensive User Guide" |
| XIM MATRIX Support FAQ (`community.xim.tech/t/xim-matrix-support-faq/247232`) | XIM forum | Official | xim.tech describes it as "common problems and fixes". **Requires a forum login; not read yet.** |
| [@OBsIV on YouTube](https://www.youtube.com/@OBsIV) | Hosts XIM's Quick Start video, which xim.tech and the Getting Started post link | Official (inferred) | Instructional videos |
| [XIM Central](https://www.youtube.com/@XIMCentral) (formerly XIMGameplay) | Independent creator | **Community expert** | See the XIM Central notes below the table. |
| [XIM Config Cloud](https://configs.xim.tech) | Community-uploaded, hosted by XIM | **Not on the whitelist** (candidate) | Public Destiny 2 configs. The guide's [Config Cloud page](https://guide.xim.tech/Config-Cloud/) says "Featured Configs are Configs contributed by our community that the XIM Team deems as exceptional." |

**XIM Central notes:**
- **Output dates.** MATRIX tutorials from 2025 cover smoothing, quantization and curves; 2026 tutorials cover sight modifiers and sight override.
- **Unofficial status.** In an older video script (APEX era), the creator says the channel is "not the official Youtube channel of the XIM Company". xim.tech calls its videos "created by XIM community gamers". The channel's About page lists XIM's contact page as its imprint.
- **Destiny 2.** Its Destiny 2 videos are all from the older XIM APEX/XIM4 devices.
- **What we could read.** Transcripts of recent videos were blocked, so many could only be read by title. English scripts were posted anonymously on pastebin/controlc. Some are confirmed as linked from XIM Central video descriptions; others aren't.

**Watch out:** a YouTube channel called "Official Xim Matrix" (`UCdM4OpQJvUTLx83MIO8aoJg`)
exists. Its ownership could not be verified, so don't treat it as official.

**About the "XIM community guide":**
- We found no resource published under that exact name. The login-walled forum
  couldn't be searched.
- The best match is guide.xim.tech, the only complete, current, XIM-published
  reference, which XIM's own forum links as *the* guide.
- The user's word "community" could instead point to something community-written:
  a forum guide, or the Config Cloud. Needs the user's confirmation.

## 2. Platforms and Destiny 2

- **PC is supported.** XIM MATRIX supports "Xbox Series X|S, PlayStation 5, Xbox One,
  PlayStation 4, and PC" ([What is XIM MATRIX?](https://guide.xim.tech/What-Is-XIM-MATRIX/)).
- **Output type decides everything downstream.**
  - Game Settings synchronization applies "only to Configs that output as
    controller" ([Game Settings](https://guide.xim.tech/Game-Settings/)).
  - Mouse-output Configs have no Smart Translators
    ([Velocity Calibration](https://guide.xim.tech/Velocity-Calibration/)). They use a
    Reticle Velocity Calibration instead, redone whenever aim-affecting in-game
    settings change. They have no required in-game settings, but the in-game mouse
    sensitivity still has to be set sensibly, and PC mouse acceleration must be off.
  - **Xbox:** the [Gaming On Xbox](https://guide.xim.tech/Gaming-On-Xbox/) page says
    output must be controller, with an authentication controller in Port 3. The
    [Inputs & Outputs](https://guide.xim.tech/Inputs-Outputs/) table, however, also lists
    mouse-and-keyboard output for Xbox; the guide is inconsistent. It is also
    inconsistent on whether third-party licensed controllers can authenticate.
  - **PC:** controller output (XInput, Xbox, DualSense or DualShock 4),
    mouse-and-keyboard output, or "Mouse, Keyboard, Controller" (PC only).
  - **PC with controller output:** under *connection problems*, XIM warns "make sure you
    don't have any virtual controller emulation tools (such as Steam Input or
    DS4Windows) installed that may conflict"
    ([Troubleshooting PC](https://guide.xim.tech/Troubleshooting-PC/)). The Game
    Settings page tells *Apex* PC players to enable Steam Input, so rules differ per
    game. There is no Destiny 2-specific PC guidance.
- **Destiny 2 required in-game settings**, from the
  [public copy](https://community.xim.tech/pub/xim-game-settings):
  - Movement Controls: Default
  - Button Layout: Default
  - Look Sensitivity: 20
  - ADS Sensitivity Modifier: 1.5
  - Axial Deadzone: 0
  - Radial Deadzone: 0.13

  The page's general rule is "maximum in-game sensitivity and all other values as
  default unless otherwise stated". Manager can show the required settings too:
  "press the gear icon on Manager's main screen". Cross-check the two.
- **Sync for Destiny 2 — plan for Standard.**
  - We found no evidence that Destiny 2 supports Custom sync. Fifteen game entries say
    "This game supports Custom In-Game Settings"; Destiny 2's doesn't.
  - This is weak evidence: all 15 are exactly the entries that also carry the SAB
    requirement, so the note may only ever appear on SAB games.
  - Manual sync exists for any controller Config, but XIM discourages it.
  - The way to confirm is to create a Destiny 2 controller Config in Manager.
  - The guide mentions Sight Modifiers only in the context of Custom Game Settings, and
    per-scope settings require Custom.
- **SAB (Simulate Analog Behavior):** the public Destiny 2 entry lists no SAB
  requirement. Entries that do include Apex Legends, Arc Raiders, Battlefield 6, Black
  Ops 6/7 and Fortnite. This is inferred from absence; the gated full topic was not
  readable.
- **No documented Xbox vs PC difference** for Destiny 2. Also unconfirmed: whether PC
  Destiny 2's menu labels and ranges match console. Bungie's PC input policy was not
  researched.
- Current platform columns for Destiny 2 in the Game Support List require a forum login.
  A Feb 2023 archived copy listed Destiny 2 on Xbox Series X|S, PS5, Xbox One, PS4 and PC.
  *Unconfirmed for today.*

## 3. Glossary: official definitions

All from [Aim Settings](https://guide.xim.tech/Aim-Settings/) unless noted.

| Term (as Manager spells it) | Official meaning |
|---|---|
| **Sensitivity** (mouse) | cm/360, the distance to do a full turn: "[L]ower values produce faster aiming speeds." Manager's own label reads "Lower values are faster." Official advice: "Always start with just adjusting Sensitivity. Change other values only if necessary. There is no "right" set of values." |
| **Smoothing** | "Gaming input hardware and natural hand jitter can cause an noisy input environment. Smoothing solves this by providing additional stability and control to your aim." Mouse and motion each have presets; "It's strictly based on preference." Preset names seen in screenshots: *Synchronous*, *Balanced*, *Custom*. *Light* appears once but isn't confirmed as a preset name. |
| **Standard** (smoothing mode) | "dynamic smoothing behavior that adapts to your current aim speed." Settings: Precision, Response, Easing (+ Stability, motion aim only). *"Standard" is also a sync method and a velocity-mapping mode; the three are unrelated.* |
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
| **Quantization** | "can be used to improve compatibility with aim assist … your reticle velocity will "snap" to configured magnitude and angle values." Start at "Magnitude to 25 and Angle to 25. Adjust one value at a time". Warning: "may negatively affect real world sensitivity accuracy." Off by default ([SAB page](https://guide.xim.tech/Simulate-Analog-Behavior/)). |
| **Magnitude** (quantization) | "Snaps your reticle to predefined speeds. The effect increases the faster you aim." |
| **Angle** (quantization) | "Snaps your reticle to predefined angles. The effect is independent of aiming speed." |
| Aim Magnitude / Aim Angle | **The same names are used for other things.** They are Smart Actions that move the reticle at a set speed and angle, e.g. for recoil control or auto-turn ([Smart Actions Reference](https://guide.xim.tech/Smart-Actions-Reference/)). [Behavior Variance](https://guide.xim.tech/Behavior-Variance/) also has "Aim Magnitude Variance" and "Aim Angle Variance" settings for those actions. |
| **Velocity Mapping** | How curves and thumbstick aim map to reticle velocity; for thumbstick aim, only with Custom Stick Behavior. Standard is the default ([SAB page](https://guide.xim.tech/Simulate-Analog-Behavior/)). |
| **Game Settings synchronization** | Standard / Custom / Manual; controller output only ([Game Settings](https://guide.xim.tech/Game-Settings/)). Standard: in-game sensitivity at maximum, required settings applied, everything else default. Manual calibration for controller output "is thus discouraged". |
| **Hip / Aim Down Sight** | Set independently when the game has ADS, which Game Roles detect. Inheritance: *Inherit All* (default), *Sensitivity Only*, *Inherit Nothing*. There is also an *ADS Activation Delay* (optionally with *Smooth ADS Transition*). |
| **Deadzone** | Inner, outer, axial and drift offsets. "Your game's deadzone settings must match the required settings for your game." |
| **SAB** (Simulate Analog Behavior) | A controller-output feature. When a game requires it (the public Destiny 2 entry lists no such requirement), a strict checklist applies: no curves, no quantization, smoothing not below the presets, not faster than 20 cm/360 ([SAB](https://guide.xim.tech/Simulate-Analog-Behavior/)). |
| *Steady Aim, Boost* | **XIM APEX setting names; MATRIX has no settings by those names.** XIM Central's MATRIX quantization video title calls quantization "Aim Stabilizer (Steady Aim)", but no source says the two are equivalent. The guide uses "Vertical Sensitivity Boost" for a recoil technique built on Modify Aim Sensitivity ([Recoil Control](https://guide.xim.tech/Recoil-Control/)). XIM Central has a Jan 2026 MATRIX video, "Boost Feature – Most Hidden XIM Feature", reportedly set in the curve editor; its content is not reviewed yet. |

## 4. Troubleshooting: what's sourced

**Official symptom → fix pairs are few.** The most direct one for aim feel: with
mouse-and-keyboard output, if at very low speed "your reticle is skipping or jittering
then lower your game's mouse sensitivity", and disable mouse acceleration on PC
([Velocity Calibration](https://guide.xim.tech/Velocity-Calibration/)). Others:
- suspected wireless dropouts → the Check Rate tool / a USB extension
- purple timing-error blinking → check cables and hubs

**Official setup and diagnostic checks.** These come from connection troubleshooting,
cm/360 validation and the warning-light pages, not from aim-feel guidance. Sources:
[Troubleshooting Mice](https://guide.xim.tech/Troubleshooting-Mice/),
[Dashboard](https://guide.xim.tech/Dashboard/), [Warning Lights](https://guide.xim.tech/Warning-Lights/),
[Identity](https://guide.xim.tech/Identity/).

- Update firmware first: "It is recommended that you upgrade if there is an update available before continuing troubleshooting."
- Required in-game settings: "Failure to configure your game's required settings correctly will result in negative aiming performance".
- An out-of-date Smart Translator is flagged in Manager. Fix: "Recreate the Config to update its translation."
- A wrong DPI in the Config: "If it is wrong, your mouse aim won't be accurate." Use Manager's Check DPI tool.
- A polling rate lower than what you set, caused by onboard-memory settings or wireless interference. Use the Check Rate tool, move the dongle away with a USB extension, and check the Hardware Compatibility List.
- **Conditions for the cm/360 accuracy test:** a linear curve, quantization disabled, and on Xbox no Elite 2 stick curve. These are features, not faults (quantization is even recommended for aim assist), but they change real-world cm/360, so rule them out before judging sensitivity. The page adds that accurate cm/360 "isn't strictly necessary".
- **Light cues** (they can be turned off in Identity, so check they're on first):
  - rapid purple blinking = "timing errors"
  - a quick red flash = you hit the game's maximum turn speed
  - a green/yellow flash on ADS confirms Game Roles are set correctly

**Coverage of feel symptoms:**

| Coverage | Symptoms |
|---|---|
| Well sourced | Jitter / stutter / skipping; "sensitivity feels wrong or inconsistent"; wireless dropouts |
| Thin, or official mechanism only | Laggy/delayed; sluggish or capped turns; fighting aim assist ("bubble"); mushy/spongy from too much smoothing (XIM Central, APEX era); hip-fire vs ADS inconsistency (Game Roles, trigger role %, ADS Activation Delay, inheritance — no official feel mapping) |
| **No sourced answer** | Floaty; overshooting |

**Community (XIM Central, mostly 2018–2021 scripts; attribution checked for some but not all):**
- A slow-trace stutter test and an ordered fix list: in-game settings → translator →
  DPI → polling → sync → smoothing → hardware.
- "[T]oo much smoothing will make your mouse movements feel spongy and less direct."
- Stutter makes aim assist feel "like an obstacle".
- Don't change settings every few days; stick with a setup for 1–2 weeks before judging
  it. This comes from an anonymous script not yet linked to the channel.

**Contested (sources from different device generations disagree):**
- DPI: APEX-era 3,000–4,000 vs MATRIX-era "more DPI", up to about 12,000
- polling rate
- Synch

The official guide documents only the mouse's polling rate and the MATRIX output
"update rate" (keep at "Standard" per the SAB page). The APEX idea of a separate "XIM
polling rate" doesn't carry over as-is.

## 5. Weapons and multiple aim setups

- **No source we could read gives weapon-type-specific settings** (e.g. pulse rifle vs
  hand cannon) for Destiny 2 or any other game. That covers the official guide and
  XIM Central's accessible scripts and video titles. Several XIM Central MATRIX videos
  on weapon loadouts and rumble-based weapon tracking could only be read by title, and
  the forum is login-walled.
- MATRIX has **no documented way to read the equipped weapon directly.**
  [Rumble Triggers](https://guide.xim.tech/Rumble-Triggers/) (controller output only)
  can infer it from rumble patterns if the game has unique patterns per weapon.
  Unverified for Destiny 2.
- **Documented ways to have more than one aim behavior:**
  - separate **Hip vs ADS** settings (with *Inherit Nothing*, ADS can differ entirely)
  - bindings that apply only in Hip or only in ADS
  - **Modify Aim Sensitivity** Smart Action (while its binding runs)
  - other aim-affecting Smart Action categories (Aim Control, Turn Assist, Sight Override)
  - **Groups** that switch sets of *bindings* for [weapon loadout tracking](https://guide.xim.tech/Weapon-Loadouts/), cycled manually or by Rumble Triggers
  - Sight Modifiers and per-scope settings (Custom sync only; Destiny 2 support unconfirmed)
  - **loading another Config**: by hotkey or Config cycling ([Loading Configs](https://guide.xim.tech/Loading-Configs/)), or with the Load Config Number / Previous / Next Smart Actions ([Smart Actions Reference](https://guide.xim.tech/Smart-Actions-Reference/)). Two limits: "Hotkeys, by default, are only available if Navigate Mode is active", and loading is slower while Manager is connected.
- **No documented action changes smoothing, curve or quantization inside one Config**,
  other than Hip vs ADS having separate values. The only documented way to change them
  is loading a different Config. *Undocumented, not proven impossible.* Both pulse rifles
  and hand cannons are normally fired in ADS, so the Hip/ADS split doesn't separate them.

## 6. Still open

- Forum-login-only material: the Support FAQ, the full Game Settings topic, and the Game
  Support List from D onward. Needs a forum account.
- Content of XIM Central's recent MATRIX videos (transcripts were blocked), especially
  Boost, weapon loadouts, and rumble weapon tracking.
- Whether Destiny 2 supports Custom sync, and whether it has per-weapon rumble patterns.
- Destiny 2 on PC: menu labels vs console, output mode and Steam Input guidance, and
  Bungie's input policy (not researched).
