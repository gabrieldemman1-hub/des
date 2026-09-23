# Dialed — XIM MATRIX Setup Guide: App Concept

**Name:** *Dialed*
**Status:** Concept agreed · v1.0 · 2026-09-22
**Research behind this version:** [`docs/research/2026-09-22-sources-platforms-glossary.md`](docs/research/2026-09-22-sources-platforms-glossary.md)

---

## 1. One-liner

A phone-first web app that guides intermediate-to-advanced XIM MATRIX users to a dialed-in,
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
| **Evidence-based**: official XIM documentation + XIM Central, XIM MATRIX-era material only | A dump of random forum configs, unverified YouTube claims, or advice written for older XIM devices |
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
  features, not faults (quantization is an official option for aim-assist
  compatibility), but they muddy the test.
- light notifications are switched on, and what they say:
  - purple blinking = timing errors (cables, hubs)
  - a quick red flash = you hit the game's maximum turn speed
  - a green/yellow flash on ADS = the MATRIX sees you aiming down sights
- on PC with controller output: XIM warns that tools like Steam Input or DS4Windows
  may conflict. It lists this under connection problems.

Every item is sourced. Together they cover the best-documented setup causes of
"stuttery" and "sensitivity feels wrong". Hand or hardware jitter is what Smoothing
is officially for, so that's handled in stage 2.

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
| A lag when you first start moving | **Easing** — higher gives a "smoother transition from rest but lower response time" | reasoned from official wording (see the Easing caveat in §6) |
| Fast turns cap out or slow down | The game's **maximum turn speed** (red flash) | official |
| Hip-fire and ADS feel inconsistent | **Game Roles** (the ADS light), **ADS Activation Delay**, and **Hip/ADS inheritance** | reasoned (official mechanisms; no official feel mapping) |
| Fighting aim assist ("bubble") | **Quantization** (officially an option for aim-assist compatibility) | official (the option exists); thin until XIM Central's MATRIX videos are reviewed |
| Floaty · overshooting · mushy/spongy | — | **gap:** no sourced MATRIX-era answer yet; the app says so |

The "Basis" column uses the §8 confidence labels (*official*, *expert*,
*reasoned*), plus *gap*. The flow ends with a guardrail: change one thing at a time
(the official guide: "Always start with just adjusting Sensitivity. Change other
values only if necessary.").

**Both stages are in the MVP** (your choice).

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
  §8), because no source we could read ties settings to aim styles.

The glossary also untangles confusing names:
- **"Standard"** is a smoothing mode, a sync method and a velocity-mapping mode,
  three unrelated things.
- **"Angle" and "Magnitude"** mean different things in quantization, in Smart
  Actions, and in Behavior Variance.
- **"Response"** (a smoothing setting) is not the mouse "response rate".
- **"Steady Aim" and "Boost"** were XIM APEX settings, and the official MATRIX
  guide lists no settings by those names. XIM Central's video titles use "Steady
  Aim" for quantization and describe a MATRIX "Boost" feature, which we haven't
  reviewed yet.

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
   shared by all configs: controller output, mouse DPI entered
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

  *Caveat:* the official text says higher Easing gives "smoother transition from rest but lower
  response time". We read "lower response time" as *less responsive*, because of the
  "but". Taken literally, it would mean the opposite, so this direction gets
  confirmed in-game before the app ships it.
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
  hand cannons are normally both fired in ADS, so that split doesn't separate them. Modify
  Aim Sensitivity changes sensitivity only.
- **So different smoothing means different Configs. Your choice: one Config per
  loadout.** For each loadout you run (say, pulse rifle + shotgun, or hand cannon +
  sniper), the app builds a separate config sheet. Each is tuned toward that
  loadout's main aim style, and the sheet says which weapon the balance favours.
  When you switch loadouts, you load the matching Config in one of three ways:
  - by hotkey (this needs Navigate Mode by default)
  - with a Load Config Smart Action
  - from Manager (loading is slower while Manager is connected)

*(Exact recommended values are intentionally **not** in this concept doc. They are
the knowledge-base work of the next milestone, where each value gets researched and
cited properly.)*

## 7. Personalization — the user profile

Recommendations are tailored from four inputs, collected once and editable
anytime (stored locally in the browser; no account needed):

- **Platform & hardware.** Xbox or PC, the MATRIX output type, and your mouse
  model, DPI and polling rate. Platform decides which setup steps apply (e.g. the
  Xbox authentication controller in Port 3, or tool conflicts on PC). The MVP
  covers controller output only (your choice).
- **Playstyle & loadouts.** Crucible (PvP) vs PvE focus, aggressive vs precise,
  and your loadouts: the weapon combinations you actually run, with the main weapon
  of each marked. Each loadout gets its own Config (§6); the rest changes which
  trade-offs the app recommends.
- **Current config.** Your existing settings as the starting point for Flow B, so
  advice is a diff, not a restart.
- **Feel preferences.** Snappy vs smooth, high vs low sensitivity targets.
  Where the evidence supports a *range*, preferences pick the point within it.

## 8. Evidence & citation model

This is the app's identity, so it's a hard rule, not a style choice.

**Allowed sources (whitelist).** Additions require a logged decision.

| Tier | Source | Notes |
|---|---|---|
| **Official** | [XIM MATRIX User Guide](https://guide.xim.tech/) (guide.xim.tech) | The guide you named as a trusted source, and the canonical reference for every MATRIX setting. It has no Destiny 2 content. |
| **Official** (by reference) | XIM's public forum pages: the [Game Settings list](https://community.xim.tech/pub/xim-game-settings) (Destiny 2's required in-game settings) and the [Hardware Compatibility List](https://community.xim.tech/pub/xim-matrix-official-hardware-compatibility-list) | The guide's "required aim settings" links go to a login-walled forum topic. This page is a public copy of its first post and may differ from it. The Game Settings list's author ("mist") is not confirmed as XIM staff. |
| **Official** *(inferred)* | OBsIV's posts and the @OBsIV YouTube channel | Part of your original "official XIM docs" choice. OBsIV writes in XIM's voice and hosts XIM's Quick Start video, but no page states their role. |
| **Community expert** | [XIM Central](https://www.youtube.com/@XIMCentral) (YouTube) | Not XIM's official channel: the creator says so in an older video script, and xim.tech presents its videos as community-made. **MATRIX-era content only** (your decision). Anything made for XIM APEX or XIM4 is excluded, and that includes every XIM Central Destiny 2 video found so far. Its MATRIX videos (2025–2026) cover smoothing, quantization and curves, but our tools couldn't read their transcripts (see §12). |

**Every recommendation ships with** a plain-language rationale (the mechanism, not
"trust me"), its source with a link, and one confidence label:
- *official*: XIM states it
- *expert*: XIM Central states it, in MATRIX-era content
- *contested*: sources disagree, and both positions are shown (e.g. XIM Central vs
  the official guide)
- *reasoned*: derived from an official mechanism definition where no source states
  the recommendation itself. It gives a direction, never an invented number, and
  is always shown as "worked out from XIM's definitions, not stated by a source".
  This is how the pulse rifle vs hand cannon guidance works (your decision).

**No orphan values.** If an exact value can't be sourced, it doesn't go in the app.
Gaps are shown honestly as gaps.

**Explanations are sourced too.** Flow D's definitions come from the official guide
and are cited the same way. Any "which aim style it matters for" part is labelled
*reasoned*. The app never invents a mechanism to sound authoritative.

## 9. MVP definition (first buildable version)

- **Phone-first** web app (your choice): designed for a phone screen, used next to
  the console while you enter values in MATRIX Manager. It also works on desktop.
- Destiny 2 only, Xbox and PC, **controller output only**.
- **All four flows:** guided setup (A), tune my config (B), troubleshoot by feel
  (C, both stages), and explain a concept (D), plus the config-sheet output.
- **One config sheet per loadout,** each with weapon-aware (*reasoned*) guidance
  for that loadout's aim style: at minimum, pulse/auto (tracking) vs hand cannon
  (peek).
- Knowledge base as versioned data files in this repo (e.g., JSON/YAML with a
  `sources` field per value), so it's reviewable, diffable, and updatable when XIM
  firmware or Destiny 2 patches change the ground truth.
- User profile, loadouts and entered configs persist in browser local storage. No
  backend, no accounts.

**Out of scope for MVP:**
- other games
- PC mouse-and-keyboard output
- anything written for XIM APEX or XIM4
- config share codes
- device connection
- curve editor/visualizer
- side-by-side config comparison
- community submissions
- accounts

## 10. Later (post-MVP direction)

Roughly in order of likely value:

1. **Filling Flow C's gaps** (floaty, overshooting, mushy) as MATRIX-era sources
   cover them.
2. **Curve visualizer**: preview aiming curves before entering them.
3. **Config comparison**: put your per-loadout Configs side by side.
4. **More games**: the knowledge-base format is per-game from day one, so adding
   a game means adding data, not code.
5. **Community features**: sharing, and submissions held to the same citation bar.

## 11. Proposed technical approach

*(Recommendation — to confirm before building.)*

- **Phone-first layout:** single-column screens, large tap targets, and config
  sheets readable at arm's length. It can be made installable to the home screen
  (a Progressive Web App) so it opens like an app and works offline.
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

## 12. Next steps

All concept questions are answered, and the MVP (§9) is built: the Destiny 2 knowledge
base (`knowledge/`), the phone-first app (`app/`) and all four flows with a config sheet
per loadout. What's left for the first release:

- **Publish it.** The repository goes public and GitHub Pages is switched on
  (Settings → Pages → Source: GitHub Actions). From then on every merge to `main`
  publishes the app, which installs to the home screen and works offline.
- **One in-game test.** The official Easing wording is ambiguous (§6). Raising
  Easing and feeling whether the reticle gets slower to start moving settles which
  way the hand-cannon advice points. Until then, `npm run check:release` reports
  the statements that wait on it.

These don't block the release, but would help fill Flow C's gaps (§10):

- **Forum access.** XIM's MATRIX Support FAQ and the full Game Settings topic need a
  forum login. If you have an account, pasting those pages in fills gaps.
- **XIM Central's MATRIX videos.** These are the only XIM Central content in scope,
  and our tools couldn't read their transcripts. Notes or transcripts from you for
  the smoothing, quantization and "Boost" videos would let the app cite them.

## 13. Decision log

Choices made during concept alignment (2026-09-22):

| Decision | Choice |
|---|---|
| Name | Dialed |
| Category | Gaming utility: XIM MATRIX setup helper |
| Platform | Phone-first web app (works on desktop too) |
| Audience | Intermediate–advanced XIM users; author-only for now |
| First milestone | Concept definition (this document) — complete |
| Device link | Reference-only — user applies values in XIM MATRIX Manager |
| First game | Destiny 2 |
| Platforms | Xbox and PC |
| Output types | Controller output only. Out of scope: PC mouse-and-keyboard output, and the PC-only "Mouse, Keyboard, Controller" mode (it also aims through the controller, per the guide; can be added later) |
| Knowledge policy | Evidence-based whitelist: official XIM documentation + XIM Central; additions require a logged decision |
| Official guide | XIM MATRIX User Guide — https://guide.xim.tech |
| Device generation | XIM MATRIX only — no XIM APEX or XIM4 advice, including XIM Central's older videos |
| Confidence labels | *official*, *expert*, *contested*, *reasoned* (worked out from XIM's definitions, always clearly marked) |
| Rationale display | Full rationale + source on every value |
| Guidance scope | In-game D2 settings, MATRIX global settings (with hardware foundation), aim config (Hip/ADS), troubleshooting by feel |
| Troubleshoot by feel in MVP | Yes — both stages: setup check + symptom → setting |
| Personalization inputs | Hardware (incl. platform), playstyle (incl. loadouts), current config, feel preferences |
| Weapon-aware guidance | Yes — pulse rifle (tracking) vs hand cannon (peek) and other aim styles, as *reasoned* guidance |
| Multiple weapons | Separate Configs per loadout, loaded when you switch loadouts |
| Concept explainer | Yes — Flow D glossary, inline on every setting name; in the MVP (proposed in v0.3, no objection) |
| Hosting (2026-09-23) | GitHub Pages from a public repository, published on every merge to `main`; installed to the home screen as a Progressive Web App |
