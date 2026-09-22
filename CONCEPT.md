# Dialed — XIM MATRIX Setup Guide: App Concept

**Name:** *Dialed*
**Status:** Concept for review · v0.5 · 2026-09-22
**Research behind this version:** [`docs/research/2026-09-22-sources-platforms-glossary.md`](docs/research/2026-09-22-sources-platforms-glossary.md)

---

## 1. One-liner

A web app that guides intermediate-to-advanced XIM MATRIX users to a dialed-in,
evidence-based configuration for their game — starting with **Destiny 2 on Xbox and
PC** — where every recommendation comes with the *why* and the *source* behind it.

## 2. The problem

Setting up a XIM MATRIX well is genuinely hard, even for experienced users:

- Good settings knowledge is scattered across XIM's user guide, the login-walled
  community forum, YouTube videos and Discord threads. Much of it is outdated
  (written for the older XIM APEX), contradictory, or pure superstition.
- Settings interact. A non-linear aiming curve can hide a wrong in-game
  sensitivity, and the smoothing mode changes how every other value feels. Tuning
  one knob at a time without understanding the chain wastes hours.
- "Perfect config" advice is usually someone else's config, with no explanation of
  which parts transfer to *your* hardware, playstyle, and preferences and which
  don't.

## 3. Who it's for

**Intermediate to advanced XIM MATRIX users.** They already know what a Smart
Translator is, have the MATRIX working, and want to go from "functional" to
"perfect." The app does not teach XIM basics and does not talk down to the user.

Initial user: the app's own author. No accounts, no multi-user features in v1 —
but the concept is written so the app can later serve the wider XIM community
without a redesign.

## 4. What it is — and is not

| It is | It is not |
|---|---|
| A **guide + recommender**: tailored guidance with full rationale and citations | A beginner tutorial or generic "what is XIM" content |
| **Reference-only**: you apply values yourself in XIM MATRIX Manager | Connected to the device (no Bluetooth, no config-code import/export in v1) |
| **Evidence-based**: official XIM documentation + trusted community experts (XIM Central) only | A dump of random forum configs or unverified YouTube claims |
| **Destiny 2 first** (Xbox and PC), deep rather than broad | A shallow database of many games (that may come later) |
| A **concept explainer**: plain-language, sourced definitions of every MATRIX setting | A copy of the manual — explanations are about *why it matters for your aim*, not just what the slider is |

## 5. Core experience — four flows

### Flow A: Guided setup ("build my config")
A step-by-step walkthrough that builds a complete Destiny 2 configuration from the
ground up, in dependency order (see §6). At each step the app shows the
recommendation *for this user* (based on their profile, §7), the reasoning, and the
source. The end state is a summary sheet the user works through in XIM MATRIX
Manager and in Destiny 2's own settings.

### Flow B: Tune my current config ("what should I change?")
The user enters their existing settings. The app compares them against the
evidence base and their profile, flags what's off (and what's fine), and proposes
targeted changes — ordered by impact, one change at a time, so cause and effect
stay observable.

### Flow C: Troubleshoot by feel ("my aim feels…")
For when something feels wrong but you don't know which setting is responsible. It
works in two stages. Setup mistakes are the best-documented causes of bad-feeling
aim, so they get ruled out before anything is tuned.

**Stage 1 — Setup check.** A checklist built from XIM's own troubleshooting,
cm/360-validation and warning-light pages:
- firmware and the Smart Translator are current (Manager flags an out-of-date
  translator; the fix is to recreate the Config)
- Destiny 2's required in-game settings are exact (cross-checked against Manager's
  gear-icon list)
- the DPI in your Config matches your mouse (Manager's Check DPI tool)
- your mouse actually reaches its polling rate (Check Rate tool; wireless
  interference; the Hardware Compatibility List)
- before judging sensitivity, rule out anything that changes real-world cm/360:
  a non-linear curve, quantization, or an Elite 2 stick curve on Xbox. These are
  features, not faults — quantization is even recommended for aim assist — but
  they muddy the test.
- light notifications are switched on, and what they say:
  - purple blinking = timing errors (cables, hubs)
  - a quick red flash = you hit the game's maximum turn speed
  - a green/yellow flash on ADS = the MATRIX sees you aiming down sights
- on PC with controller output: XIM warns that tools like Steam Input or DS4Windows
  may conflict. It lists this under connection problems.

Every item is sourced, and this is where the official fixes for "jittery",
"stuttery" and "sensitivity feels wrong" live. If the problem persists, stage 2
applies.

**Stage 2 — Symptom → setting.** You pick what you feel, and the app points to the
setting whose official definition describes that feel. It explains the mechanism
and suggests *one* change. The official guide describes several settings in feel
words ("heaviness", "lighter feeling reticle", "smoother transition from rest"), so
many symptoms map directly:

| You feel… | Where the app points | Basis |
|---|---|---|
| Jitter / shake on small movements | **Smoothing** — its official purpose is countering "hardware and natural hand jitter" | official |
| Heavy or sluggish on small adjustments | **Precision** — higher is smoother at low speed but "increases the heaviness of the reticle" | reasoned from official wording |
| Too light / too heavy on fast turns | **Response** — higher gives "a lighter feeling reticle at faster aim speeds" | reasoned from official wording |
| A lag when you first start moving | **Easing** — higher gives a "smoother transition from rest but lower response time" | reasoned from official wording |
| Fast turns cap out or slow down | The game's **maximum turn speed** (red flash) | official |
| Hip-fire and ADS feel inconsistent | **Game Roles** (the ADS light), **ADS Activation Delay**, and **Hip/ADS inheritance** | official mechanism, no official feel mapping |
| Fighting aim assist ("bubble") | **Quantization** (officially for aim-assist compatibility), plus XIM Central material | official + expert, thin |
| Mushy / spongy | Too much smoothing | expert (XIM Central, APEX era) |
| Floaty · overshooting | — | **gap:** no sourced answer yet; the app says so |

The labels in the "Basis" column are the same confidence labels as §8, plus *gap*.
The flow ends with a guardrail:
- change one value at a time (the official guide: "Adjust one value at a time")
- stick with a setup long enough to judge it (XIM Central, APEX-era advice: 1–2 weeks)

Whether one or both stages are in the MVP is **open question 1**.

### Flow D: Explain a concept ("what does this actually do?")
A learn/glossary mode for the MATRIX's own vocabulary:
- the two smoothing modes, **Standard** (Precision, Response, Easing) and **Classic**
  (Smooth, Decay, Synch)
- **Quantization** (Magnitude, Angle)
- **Aiming Curve**, **Y Scale**, **Velocity Mapping**, **Deadzone**
- **Hip vs ADS** and inheritance
- **Game Settings synchronization**
- sensitivity in **cm/360**

Each term shows:
- the official definition
- what it changes mechanically
- the official feel description, where the guide gives one (Precision, Response,
  Easing, Stability)
- which aim styles it likely matters for. This part is labelled *reasoned* (see
  open question 4), because no source ties settings to aim styles.

The glossary also untangles confusing names:
- **"Standard"** is a smoothing mode, a sync method and a velocity-mapping mode,
  three unrelated things.
- **"Angle" and "Magnitude"** mean different things in quantization, in Smart
  Actions, and in Behavior Variance.
- **"Response"** (a smoothing setting) is not the mouse "response rate".
- **"Steady Aim" and "Boost"** were XIM APEX settings. MATRIX has no settings by
  those names, though XIM Central uses "Steady Aim" loosely for quantization and
  describes a MATRIX "Boost" feature.

The same explanations appear **inline everywhere**: every setting name in Flows A–C
opens its explanation.

Flows A–C converge on the same output format: a **config sheet** — the full list
of values across every layer, each annotated with rationale + source, ready to be
entered into MATRIX Manager and the game. Flow D feeds the other three: its
explanations *are* the rationale text shown next to each value.

## 6. Scope of guidance — the four layers

The app treats a "configuration" as a stack, and always presents it in this order
because upper layers are meaningless if the lower ones are wrong:

1. **In-game Destiny 2 settings.** The values XIM's Smart Translation expects,
   from XIM's per-game required-settings list. The readable copy is a public
   mirror of a login-walled forum page, so the app tells you to confirm the values
   in Manager (gear icon). Wrong values here silently break everything above, so
   this layer is validated first in every flow. We found no evidence that Destiny 2
   supports Custom sync, so the plan is **Standard sync**: maximum in-game
   sensitivity, the required values, everything else default. XIM documents no
   Xbox vs PC difference for Destiny 2.
2. **MATRIX global settings & hardware foundation.** The device-level footing
   shared by all configs: output type (see open question 5), mouse DPI entered
   correctly, the mouse's polling rate, current firmware and Smart Translator, and
   the light notifications Flow C relies on. Which other MATRIX Manager global
   settings belong here is knowledge-base work.
3. **Aim config (Hip & ADS).** This is the heart of the "perfect config", and
   where personalization matters most:
   - sensitivity in cm/360
   - smoothing: a preset, or custom Standard/Classic values
   - Mechanics: aiming curve, Y Scale, quantization
   - velocity mapping
   - deadzone
   - Hip vs ADS inheritance
4. **Troubleshooting knowledge.** The setup checklist and symptom → setting
   mapping that power Flow C and the "why" annotations everywhere else.

### Weapon-aware guidance (inside layer 3) — your pulse rifle vs hand cannon question

Different Destiny 2 weapons demand different kinds of aim:

| Aim style | Typical archetypes | What the settings need to favour *(reasoned)* |
|---|---|---|
| **Tracking** — hold on target through sustained fire | Pulse rifles, auto rifles, SMGs, trace rifles, machine guns | Stable, consistent micro-corrections |
| **Snap / peek** — acquire a target seen for a split second, fire, re-peek | Hand cannons, snipers, shotguns, sidearms | Fast, direct acquisition from a standstill |
| **Precision hold** — line up a single deliberate shot | Scout rifles, linear fusions, bows | Fine control at low speed without losing turn speed |

**What the research found.** No source we could read gives weapon-type-specific
settings, for Destiny 2 or any other game. That covers the official guide and every
XIM Central script and video title we could access; some XIM Central MATRIX videos
on weapon loadouts could only be read by title. What the official guide *does* give
is precise mechanism definitions that line up with these aim styles. So the app
answers your question like this, always labelled *reasoned*, never with invented
numbers:

- **Pulse rifle (tracking): Precision is the lever.** Precision controls "fine aim
  behavior". Raising it smooths your low-speed corrections, for a steadier hold, but
  "increases the heaviness of the reticle". Lowering it makes small adjustments
  lighter but less smoothed.
- **Hand cannon (peek shots): Easing is the lever.** Easing controls "aim behavior
  from rest". Lowering it gives a faster start from a standstill, which suits snapping
  onto someone who appears for a split second. The cost is a less smooth start.
  Raising it does the opposite: "smoother transition from rest but lower response
  time".
- **Standard vs Classic.** Standard smoothing "adapts to your current aim speed";
  Classic is static. The reasoned case for Standard is that it can treat slow
  tracking and fast snaps differently within one Config. Weapon-aware directions
  therefore assume Standard; Classic users get the definitions but not the
  directions.

**How it gets applied, given what the MATRIX can do:**
- **It can't read your weapon directly.** The MATRIX has no documented way to read
  the equipped weapon. Rumble Triggers (controller output) can infer it from rumble
  patterns, but whether Destiny 2 has distinct per-weapon patterns is unverified.
  Even then, they switch binding groups, not smoothing.
- **Smoothing can't follow your weapon inside one Config.** No documented action
  changes smoothing, curve or quantization within one Config. (Undocumented, not
  proven impossible.) Hip vs ADS can have separate smoothing, but pulse rifles and
  hand cannons are both fired in ADS, so that split doesn't separate them. Modify
  Aim Sensitivity changes sensitivity only.
- **So per-weapon smoothing means per-weapon Configs,** loaded mid-match by hotkey or
  a Load Config Smart Action. Hotkeys need Navigate Mode by default, and loading is
  slower while Manager is connected.
- **The alternative is one Config for your whole loadout,** where the app picks a
  balance point and tells you which weapon it favours. See open question 3.

*(Exact recommended values are intentionally **not** in this concept doc. They are
the knowledge-base work of the next milestone, where each value gets researched and
cited properly.)*

## 7. Personalization — the user profile

Recommendations are tailored from four inputs, collected once and editable
anytime (stored locally in the browser; no account needed):

- **Platform & hardware.** Xbox or PC, the MATRIX output type, and your mouse
  model, DPI and polling rate. Platform decides which setup steps apply (e.g. the
  Xbox authentication controller in Port 3, or tool conflicts on PC). Which output
  types the MVP covers is open question 5.
- **Playstyle & loadout.** Crucible (PvP) vs PvE focus, aggressive vs precise,
  and the weapon archetypes you actually run (primary/special/heavy). Loadout
  drives the weapon-aware guidance in §6; the rest changes which trade-offs the
  app recommends.
- **Current config.** Your existing settings as the starting point for Flow B, so
  advice is a diff, not a restart.
- **Feel preferences.** Snappy vs smooth, high vs low sensitivity targets.
  Where the evidence supports a *range*, preferences pick the point within it.

## 8. Evidence & citation model

This is the app's identity, so it's a hard rule, not a style choice.

**Allowed sources (whitelist).** Additions require a logged decision.

| Tier | Source | Notes |
|---|---|---|
| **Official** | [XIM MATRIX User Guide](https://guide.xim.tech/) (guide.xim.tech) | The canonical reference for every MATRIX setting. It has no Destiny 2 content. It's our best match for "the XIM Guide" / "XIM community guide", pending your confirmation (open question 2). |
| **Official** | XIM's public forum pages: the [Game Settings list](https://community.xim.tech/pub/xim-game-settings) (Destiny 2's required in-game settings) and the [Hardware Compatibility List](https://community.xim.tech/pub/xim-matrix-official-hardware-compatibility-list) | The guide's "required aim settings" links lead to this list (via a login-walled forum topic; this is its public copy) |
| **Official** *(inferred)* | OBsIV's posts and the @OBsIV YouTube channel | OBsIV writes in XIM's voice and hosts XIM's Quick Start video, but no page states their role |
| **Community expert** | [XIM Central](https://www.youtube.com/@XIMCentral) (YouTube) | Not XIM's official channel: the creator says so in an older video script, and xim.tech presents its videos as community-made. The richest source of feel-based advice. Its Destiny 2 videos are from the XIM APEX era; see open question 4b for how APEX-era advice is handled. |

**Every recommendation ships with** a plain-language rationale (the mechanism, not
"trust me"), its source with a link, and one confidence label:
- *official*: XIM states it
- *expert*: XIM Central states it (tagged with its device era)
- *contested*: sources disagree, and both positions are shown. Example: DPI advice
  differs between XIM Central's APEX-era and MATRIX-era videos.
- *reasoned* (**proposed**, open question 4a): derived from an official mechanism
  definition where no source states the recommendation itself. It gives a
  direction, never an invented number.

**No orphan values.** If an exact value can't be sourced, it doesn't go in the app.
Gaps are shown honestly as gaps.

**Explanations are sourced too.** Flow D's definitions come from the official guide
and are cited the same way. Any "which aim style it matters for" part is labelled
*reasoned*. The app never invents a mechanism to sound authoritative.

## 9. MVP definition (proposed first buildable version)

- Web app, desktop-browser-first (usable on a phone next to the console later).
- Destiny 2 only, Xbox and PC. Output types per open question 5.
- Flows A, B and D, plus the config-sheet output. Flow D is in the MVP because it
  is cheap to build and its explanations double as the rationale text every other
  flow displays. **Flow C: per open question 1.**
- Weapon-aware guidance for the core Destiny 2 archetypes (at minimum pulse/auto vs
  hand cannon). This **depends on open question 4a**. If per-archetype Configs are
  chosen (open question 3), the MVP produces one config sheet per archetype.
- Knowledge base as versioned data files in this repo (e.g., JSON/YAML with a
  `sources` field per value), so it's reviewable, diffable, and updatable when XIM
  firmware or Destiny 2 patches change the ground truth.
- User profile + entered configs persist in browser local storage. No backend,
  no accounts.

**Out of scope for MVP:** other games, config share codes, device connection,
curve editor/visualizer, community submissions, accounts.

## 10. Later (post-MVP direction)

Roughly in order of likely value:

1. **Whatever of Flow C isn't in the MVP** (see open question 1), with stage 2
   growing as sources fill the gaps.
2. **Curve visualizer**: preview aiming curves before entering them.
3. **More games**: the knowledge-base format is per-game from day one, so adding
   a game means adding data, not code.
4. **Config library**: save and compare multiple named setups.
5. **Community features**: sharing, and submissions held to the same citation bar.

## 11. Proposed technical approach

*(Recommendation — to confirm before building.)*

- **Static single-page web app** (e.g., React + Vite or similar). No server: the
  knowledge base compiles into the app, profiles live in local storage. This
  keeps hosting free (GitHub Pages/Vercel/Netlify), makes the app fast, and
  matches "reference-only" — there's simply nothing that needs a backend yet.
- **Knowledge base as data, not prose:** structured files per game and layer, with
  values, applicability conditions (which profile inputs they depend on),
  rationale text, confidence label and source links. The recommendation engine is
  mostly "select + explain," which keeps it testable.
- **Repo layout sketch:** `app/` (UI), `knowledge/destiny2/` (the evidence base),
  `docs/` (this concept), `docs/research/` (research notes).

## 12. Open questions

1. **How much of troubleshoot-by-feel (Flow C) goes in the MVP?**

   | Option | What you get in v1 | Extra cost |
   |---|---|---|
   | (a) None | Nothing for "my aim feels off" until later | — |
   | (b) Stage 1 only | The setup checklist. It catches setup mistakes but doesn't diagnose feel. **You would not get the "tell it what you feel, get the setting" part you put in scope.** | Small: every item is already researched |
   | (c) Stages 1 + 2 | The checklist plus the symptom picker in §5: eight symptoms answered, with "floaty" and "overshooting" shown as gaps | Moderate: a symptom picker plus per-symptom write-ups. Several mappings are *reasoned*, so this depends on 4a. |

   **Recommendation: (c) if you accept 4a, otherwise (b).** The knowledge base is
   built for Flows A and B anyway. The symptom mappings mostly reuse the glossary's
   official definitions, so stage 2 costs little extra, and the gap labels handle
   what isn't sourced.
2. **Which guide did you mean by "XIM community guide"?** We found no resource
   published under that exact name (the login-walled forum couldn't be searched).
   The best match is the official XIM MATRIX User Guide (guide.xim.tech), which XIM's
   own community forum links as *the* guide. But you said "community": if you meant
   something community-written — a forum guide, or XIM's Config Cloud of user
   configs — send the link. It would go in the community tier, not official.
3. **Multi-weapon loadouts.** Different smoothing for your pulse rifle and hand
   cannon means switching Configs mid-match (hotkey or a Load Config Smart Action).
   Alternatively, run one "loadout compromise" Config. Proposed: default to the
   compromise, and offer per-archetype Configs (one config sheet each) as an
   option. Confirm, or tell me if you already switch Configs mid-match.
4. **Two evidence-policy proposals** (both relax or refine the rules you set, so
   they're yours to approve):
   - **(a) The *reasoned* label.** No source gives weapon-specific values, so
     without it the app can only tell you "no source covers pulse vs hand cannon".
     With it, the app can say "lower Easing favours peek shots", citing the official
     Easing definition and clearly marked as reasoning. If no: weapon-aware guidance
     leaves the MVP, and Flow C shrinks to option (b).
   - **(b) Handling XIM Central's APEX-era advice.**
     - APEX-era *smoothing values* are used only through the guide's official
       Classic-mode mapping (Smooth values match APEX; Decay 9.0; Synch 8 = Default,
       16 = Common, 32 = Slow, 0 = Off).
     - APEX-era *sensitivity* values never carry over, because MATRIX uses cm/360.
     - All other APEX-era advice is shown with its device era. Where MATRIX-era
       advice disagrees, it is marked *contested*.
5. **Output types for the MVP.** Proposed: controller output only, on Xbox and PC.
   Smart Translation and Destiny 2's required settings only exist there. PC
   mouse-and-keyboard output (and the PC-only "Mouse, Keyboard, Controller" mode)
   is a different system: velocity calibration, no Smart Translator. If you play PC
   with mouse-and-keyboard output, say so and it moves into scope.

## 13. Decision log

Choices made during concept alignment (2026-09-22). Rows marked *proposed* await
your answer in §12.

| Decision | Choice |
|---|---|
| Name | Dialed |
| Category | Gaming utility: XIM MATRIX setup helper |
| Platform | Web app first |
| Audience | Intermediate–advanced XIM users; author-only for now |
| First milestone | Concept definition (this document) |
| Device link | Reference-only — user applies values in XIM MATRIX Manager |
| First game | Destiny 2 |
| Platforms | Xbox and PC |
| Output types | *Proposed:* controller output only in the MVP (Q5) |
| Knowledge policy | Evidence-based: official XIM documentation + trusted community experts; whitelist, additions require a logged decision |
| Trusted sources | XIM Central (YouTube) and "the XIM guide" / "XIM community guide". *Proposed:* the guide = guide.xim.tech (Q2) |
| Evidence-policy refinements | *Proposed:* the *reasoned* label and APEX-era handling (Q4) |
| Rationale display | Full rationale + source on every value |
| Guidance scope | In-game D2 settings, MATRIX global settings (with hardware foundation), aim config (Hip/ADS), troubleshooting by feel (MVP extent: Q1) |
| Personalization inputs | Hardware (incl. platform), playstyle (incl. loadout), current config, feel preferences |
| Weapon-aware guidance | Yes — pulse rifle (tracking) vs hand cannon (peek) and other aim styles; *form depends on Q4a; delivery on Q3* |
| Concept explainer | Yes — Flow D glossary, inline on every setting name; in MVP |
