# Dialed — XIM MATRIX Setup Guide: App Concept

**Name:** *Dialed*
**Status:** Concept for review · v0.4 · 2026-09-22
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
| **Evidence-based**: official XIM documentation + XIM Central only | A dump of random forum configs or unverified YouTube claims |
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
A diagnostic for when something feels wrong but the user doesn't know which
setting is responsible. It works in two stages, because the research showed that
the best-sourced causes of bad-feeling aim are setup mistakes, not tuning:

1. **Foundation check.** Before touching any tuning, a short checklist of the
   causes XIM officially documents:
   - firmware and Smart Translator are current (Manager flags an out-of-date
     translator)
   - Destiny 2's required in-game settings are exact
   - the DPI in the Config matches the mouse (Manager's Check DPI tool)
   - the mouse is actually reaching its polling rate (Check Rate tool; wireless
     interference)
   - no non-linear curve or quantization is quietly enabled
   - on PC, no Steam Input or DS4Windows conflicts
   - what the MATRIX's lights are saying (purple blinking = timing errors; a quick
     red flash = you hit the game's maximum turn speed)

   Every item is sourced, and this stage alone resolves the "jittery", "stuttery"
   and "sensitivity feels wrong" complaints.
2. **Symptom → setting.** Once the foundation is clean, the user picks what they
   feel (*jittery, heavy on small adjustments, sluggish on fast turns, slow to
   start moving, mushy, fighting aim assist…*). The app maps it to the setting whose
   official definition matches that feel, explains the mechanism, and suggests
   one change. For example, "heavy on small adjustments" maps to **Precision**:
   higher values are smoother at low speeds but increase "the heaviness of the
   reticle". Each symptom carries a coverage label. Some have no sourced answer
   (*floaty*, *overshooting*, *hip-fire vs ADS inconsistency* as of this research),
   and the app says so rather than guessing.

It ends with a guardrail: change one thing, then play long enough to judge it
before changing another (XIM Central's advice).

### Flow D: Explain a concept ("what does this actually do?")
A learn/glossary mode for the MATRIX's own vocabulary:
- the two smoothing modes, **Standard** (Precision, Response, Easing) and **Classic**
  (Smooth, Decay, Synch)
- **Quantization** (Magnitude, Angle)
- **Aiming Curve**, **Y Scale**, **Velocity Mapping**, **Deadzone**
- **Hip vs ADS** and inheritance
- **Game Settings synchronization**
- sensitivity in **cm/360**

Each term is explained in plain language: the official definition, what it changes
mechanically, what it feels like too high or too low, and which aim styles it
matters for. The glossary also resolves confusing names. "Angle" and "Magnitude"
mean different things in quantization and in Smart Actions. "Steady Aim" and "Boost"
are XIM APEX terms, not MATRIX settings. "Response" (a smoothing setting) is not the
mouse "response rate". The same explanations appear **inline everywhere**: every
setting name in Flows A–C opens its explanation.

Flows A–C converge on the same output format: a **config sheet** — the full list
of values across every layer, each annotated with rationale + source, ready to be
entered into MATRIX Manager and the game. Flow D feeds the other three: its
explanations *are* the rationale text shown next to each value.

## 6. Scope of guidance — the four layers

The app treats a "configuration" as a stack, and always presents it in this order
because upper layers are meaningless if the lower ones are wrong:

1. **In-game Destiny 2 settings.** The values XIM's Smart Translation expects,
   taken from XIM's per-game required-settings list. Wrong values here silently
   break everything above, so this layer is validated first in every flow. Destiny
   2 appears to support only **Standard** synchronization (maximum in-game
   sensitivity, required values applied, everything else default). XIM documents
   no Xbox vs PC difference for Destiny 2.
2. **Hardware & device foundation.** Output type (controller output; see
   §7), mouse DPI entered correctly in the Config, the mouse and MATRIX polling
   rates, current firmware and Smart Translator. This is the device-level footing
   shared by all configs.
3. **Aim config (Hip & ADS).** This is the heart of the "perfect config", and
   where personalization matters most:
   - sensitivity in cm/360
   - smoothing: a preset, or custom Standard/Classic values
   - Mechanics: aiming curve, Y Scale, quantization
   - velocity mapping
   - deadzone
   - Hip vs ADS inheritance
4. **Troubleshooting knowledge.** The foundation checklist and symptom → setting
   mapping that power Flow C and the "why" annotations everywhere else.

### Weapon-archetype awareness (inside layer 3)

Different Destiny 2 weapons demand different kinds of aim:

| Aim style | Typical archetypes | What the settings need to favour |
|---|---|---|
| **Tracking** — hold on target through sustained fire | Pulse rifles, auto rifles, SMGs, trace rifles, machine guns | Stability and consistency: micro-corrections without overshoot |
| **Snap / flick** — acquire a target seen for a split second, fire, re-peek | Hand cannons, snipers, shotguns, sidearms | Fast, direct acquisition: minimal delay or damping between hand and reticle |
| **Precision hold** — line up a single deliberate shot | Scout rifles, linear fusions, bows | Fine control at low speed without losing turn speed |

**What the research found:** no source, official or XIM Central, gives
weapon-type-specific settings for Destiny 2 or any other game. What the official
guide *does* give is precise mechanisms that line up with these aim styles:
- **Easing** governs "aim behavior from rest", where higher values mean a "smoother
  transition from rest but lower response time". That is exactly the moment of a
  hand-cannon peek shot.
- **Precision** governs "fine aim behavior", where higher is smoother but heavier at
  low speed. That is the regime of holding a pulse rifle on target.
- **Response** governs fast aim, where higher means lighter at speed.

So weapon-aware guidance is built as **mechanism-reasoned** advice. It names the
setting, quotes its official definition, and suggests a *direction* (e.g. "for a
snap-heavy loadout, try lower Easing than your tracking setup"). It is always
labelled as reasoned rather than sourced (see §8), and never invents an exact
number.

**How it gets applied, given what the MATRIX can do.** The MATRIX can't know which
weapon is equipped. Smoothing, curve and quantization can't change mid-match inside
one Config; the only documented way is **loading a different Config** (hotkey, or
the Load Config Smart Actions). The documented levers within one Config are:
- separate **Hip vs ADS** settings (ADS can be fully independent)
- a **Modify Aim Sensitivity** action held on a button

See open question 3.

*(Exact recommended values are intentionally **not** in this concept doc. They are
the knowledge-base work of the next milestone, where each value gets researched and
cited properly.)*

## 7. Personalization — the user profile

Recommendations are tailored from four inputs, collected once and editable
anytime (stored locally in the browser; no account needed):

- **Platform & hardware.** Xbox or PC, and on PC the output type; mouse
  model, DPI and polling rate. Platform decides which setup steps apply (e.g. the
  Xbox authentication controller, or Steam Input conflicts on PC). The MVP covers
  **controller output** on both platforms, since Smart Translation and required
  game settings only exist there. PC mouse-and-keyboard output is a different
  system (velocity calibration, no Smart Translator) and is out of MVP scope unless
  you say otherwise.
- **Playstyle & loadout.** Crucible (PvP) vs PvE focus, aggressive vs precise,
  and the weapon archetypes they actually run (primary/special/heavy). Loadout
  drives the weapon-aware guidance in §6; the rest changes which trade-offs the
  app recommends.
- **Current config.** Existing settings as the starting point for Flow B, so
  advice is a diff, not a restart.
- **Feel preferences.** Snappy vs smooth, high vs low sensitivity targets.
  Where the evidence supports a *range*, preferences pick the point within it.

## 8. Evidence & citation model

This is the app's identity, so it's a hard rule, not a style choice.

**Allowed sources (whitelist).** Additions require a logged decision.

| Tier | Source | Notes |
|---|---|---|
| **Official** | [XIM MATRIX User Guide](https://guide.xim.tech/) (guide.xim.tech) | The canonical reference for every MATRIX setting. This is what we take "the XIM Guide" / "XIM community guide" to mean (pending confirmation, §12). It has no Destiny 2 content. |
| **Official** | XIM's public forum pages: [Game Settings](https://community.xim.tech/pub/xim-game-settings) (Destiny 2's required in-game settings), [Hardware Compatibility List](https://community.xim.tech/pub/xim-matrix-official-hardware-compatibility-list), OBsIV's posts and @OBsIV videos | The guide links to the Game Settings list as the "required aim settings" |
| **Community expert** | [XIM Central](https://www.youtube.com/@XIMCentral) (YouTube) | Self-declared *not* official. The richest source of feel-based advice, but its Destiny 2 videos are XIM APEX-era. APEX advice is used only when the guide's official Classic-mode mapping translates it (Smooth values match APEX, Decay 9.0, Synch 8/16/32/0). Sensitivity values never carry over, because MATRIX uses cm/360. |

**Every recommendation ships with** a plain-language rationale (the mechanism, not
"trust me"), its source with a link, and one of these confidence labels:
- *official*: XIM states it
- *expert*: XIM Central states it
- *contested*: sources disagree. Both positions are shown, e.g. DPI advice differs
  between XIM Central's APEX-era and MATRIX-era videos.
- *reasoned* (**proposed**, see §12): derived from an official mechanism definition
  where no source states the recommendation itself. Gives a direction, never an
  invented number.

**No orphan values.** If an exact value can't be sourced, it doesn't go in the app.
Gaps are shown honestly as gaps.

**Explanations are sourced too.** Flow D's definitions come from the official
guide and are cited the same way. The app never invents a mechanism to sound
authoritative.

## 9. MVP definition (first buildable version)

- Web app, desktop-browser-first (usable on a phone next to the console later).
- Destiny 2 only, Xbox and PC, controller output.
- Flows A, B and D, plus the config-sheet output. Flow D is in the MVP because it
  is cheap to build and its explanations double as the rationale text every other
  flow displays. (Whether Flow C's foundation check joins the MVP is open question 1.)
- Weapon-aware guidance for the core Destiny 2 archetypes (at minimum the tracking
  vs snap split: pulse/auto vs hand cannon), as mechanism-reasoned advice.
- Knowledge base as versioned data files in this repo (e.g., JSON/YAML with a
  `sources` field per value), so it's reviewable, diffable, and updatable when XIM
  firmware or Destiny 2 patches change the ground truth.
- User profile + entered configs persist in browser local storage. No backend,
  no accounts.

**Out of scope for MVP:** other games, PC mouse-and-keyboard output, config share
codes, device connection, curve editor/visualizer, community submissions, accounts.

## 10. Later (post-MVP direction)

Roughly in order of likely value:

1. **Flow C stage 2** (symptom → setting), growing as sources fill the gaps.
2. **Curve visualizer**: preview aiming curves before entering them.
3. **More games**: the knowledge-base format is per-game from day one, so adding
   a game means adding data, not code.
4. **Config library**: save and compare multiple named setups, including the
   per-loadout Configs from §6.
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

1. **Flow C in the MVP?** Recommendation: **yes for stage 1, the foundation
   check.** It is fully sourced, cheap to build, and targets the most common real
   cause of bad-feeling aim. Stage 2 (symptom → setting) follows once the knowledge
   base exists, because several symptoms have no sourced answer yet.
2. **"XIM community guide" = guide.xim.tech?** No resource is published under that
   exact name. The official XIM MATRIX User Guide is the only complete, current
   reference, and XIM's own community forum links it as *the* guide. If you meant
   something else (e.g. a forum thread, or the Config Cloud), send the link.
3. **Multi-weapon loadouts.** Weapon-specific smoothing means switching Configs
   (hotkey or a Load Config Smart Action) mid-match. The alternative is one
   "loadout compromise" Config, plus Hip vs ADS separation. Proposed: default to
   the compromise Config, and offer per-archetype Configs as an option. Confirm, or
   tell me if you already switch configs mid-match.
4. **Allow the *reasoned* confidence label?** Without it, weapon-aware guidance is
   impossible today, because no source gives weapon-specific values. With it, the
   app can say "lower Easing favours peek shots" with the official Easing
   definition as the citation, clearly marked as reasoning. Confirm.

*Resolved:*
- the name is **Dialed**
- the platforms are **Xbox and PC**
- the community source is **XIM Central**; the official guide is **guide.xim.tech**
  (see §8)

## 13. Decision log

Choices made during concept alignment (2026-09-22):

| Decision | Choice |
|---|---|
| Name | Dialed |
| Category | Gaming utility: XIM MATRIX setup helper |
| Platform | Web app first |
| Audience | Intermediate–advanced XIM users; author-only for now |
| First milestone | Concept definition (this document) |
| Device link | Reference-only — user applies values in XIM MATRIX Manager |
| First game | Destiny 2 |
| Platforms | Xbox and PC; controller output (PC mouse-and-keyboard output out of MVP scope) |
| Knowledge policy | Evidence-based whitelist: official XIM documentation + XIM Central; additions require a logged decision |
| Official sources | XIM MATRIX User Guide (guide.xim.tech) — canonical; XIM's public forum pages (Game Settings list, Hardware Compatibility List, OBsIV) |
| Community sources | XIM Central (YouTube): self-declared unofficial, labelled *expert*; APEX-era advice only via the official Classic-mode mapping |
| Rationale display | Full rationale + source + confidence label on every recommendation |
| Guidance scope | In-game D2 settings, hardware & device foundation, aim config (Hip/ADS), troubleshooting by feel |
| Personalization inputs | Platform & hardware, playstyle & loadout, current config, feel preferences |
| Weapon-aware recommendations | Yes — by aim style (tracking vs snap vs precision hold), built on official mechanism definitions |
| Concept explainer | Yes — Flow D glossary, inline on every setting name, sourced like everything else; in MVP |
