# XIM Matrix Setup Guide — App Concept

**Working title:** *Dialed* (placeholder — rename anytime)
**Status:** Concept for review · v0.3 · 2026-09-22

---

## 1. One-liner

A web app that guides intermediate-to-advanced XIM Matrix users to a dialed-in,
evidence-based configuration for their game — starting with **Destiny 2 on Xbox and PC** — where
every recommended value comes with the *why* and the *source* behind it.

## 2. The problem

Setting up a XIM Matrix well is genuinely hard, even for experienced users:

- Good settings knowledge is scattered across the XIM community forum, YouTube
  videos, and Discord threads — much of it outdated, contradictory, or pure
  superstition.
- Settings interact: an aggressive ballistic curve can mask a wrong in-game
  sensitivity; a sync mode choice changes how every other value feels. Tuning one
  knob at a time without understanding the chain wastes hours.
- "Perfect config" advice is usually someone else's config, with no explanation of
  which parts transfer to *your* hardware, playstyle, and preferences and which
  don't.

## 3. Who it's for

**Intermediate to advanced XIM Matrix users.** They already know what a Smart
Translator is, have the Matrix working, and want to go from "functional" to
"perfect." The app does not teach XIM basics and does not talk down to the user.

Initial user: the app's own author. No accounts, no multi-user features in v1 —
but the concept is written so the app can later serve the wider XIM community
without a redesign.

## 4. What it is — and is not

| It is | It is not |
|---|---|
| A **guide + recommender**: tailored values with full rationale and citations | A beginner tutorial or generic "what is XIM" content |
| **Reference-only**: you apply values yourself in XIM Matrix Manager | Connected to the device (no Bluetooth, no config-code import/export in v1) |
| **Evidence-based**: official XIM documentation + trusted community experts only | A dump of random forum configs or unverified YouTube claims |
| **Destiny 2 first** (Xbox and PC), deep rather than broad | A shallow database of many games (that may come later) |
| A **concept explainer**: plain-language, sourced definitions of every Matrix setting | A copy of the manual — explanations are about *why it matters for your aim*, not just what the slider is |

## 5. Core experience — three flows

### Flow A: Guided setup ("build my config")
A step-by-step walkthrough that builds a complete Destiny 2 configuration from the
ground up, in dependency order (see §6). At each step the app shows the
recommended value *for this user* (based on their profile, §7), the reasoning, and
the source. The end state is a summary sheet the user works through in XIM Matrix
Manager and in Destiny 2's own settings.

### Flow B: Tune my current config ("what should I change?")
The user enters their existing settings. The app compares them against the
evidence base and their profile, flags what's off (and what's fine), and proposes
targeted changes — ordered by impact, one change at a time, so cause and effect
stay observable.

### Flow C: Troubleshoot by feel ("my aim feels…")
A symptom-driven diagnostic: the user picks what feels wrong (*floaty, sticky,
jumpy, inconsistent ADS, slow turns, micro-adjust overshoot…*) and the app maps
the symptom to the settings that cause it, explains the mechanism, and suggests
what to adjust first.

### Flow D: Explain a concept ("what does this actually do?")
A learn/glossary mode for the Matrix's own vocabulary — e.g. *classic vs standard
smoothing, precision, response, easing, angle, magnitude, quantization, sync,
steady aim, ballistic curves* — each explained in plain language: what the setting
changes mechanically, what it feels like when it's too high or too low, and which
aim styles it matters for. The same explanations are available **inline
everywhere**: every setting name in Flows A–C is clickable and opens its
explanation, so the user never has to leave a recommendation to understand it.

Flows A–C converge on the same output format: a **config sheet** — the full list
of values across every layer, each annotated with rationale + source, ready to be
entered into Matrix Manager and the game. Flow D feeds the other three: its
explanations *are* the rationale text shown next to each value.

## 6. Scope of guidance — the four layers

The app treats a "configuration" as a stack, and always presents it in this order
because upper layers are meaningless if the lower ones are wrong:

1. **In-game Destiny 2 settings** — the controller/sensitivity values the Smart
   Translator was trained against. Wrong values here silently break everything
   above, so this layer is validated first in every flow. Covered for **Xbox and
   PC**; where the two platforms differ, values are recorded per platform and the
   user's platform selects which they see.
2. **Matrix global/device settings** — polling rate, sync mode, response rate:
   the device-level foundation shared by all configs.
3. **Aim config (hip & ADS)** — sensitivity, ballistic curves, deadzone,
   smoothing, steady aim: the heart of the "perfect config," and where
   personalization matters most.
4. **Troubleshooting knowledge** — the symptom → cause → fix mapping that powers
   Flow C and the "why" annotations everywhere else.

### Weapon-archetype awareness (inside layer 3)

Aim config recommendations are **weapon-aware**, because different Destiny 2
weapon archetypes demand different kinds of aim, and settings like smoothing,
curves, and ADS sensitivity trade off between them:

| Aim style | Typical archetypes | What the settings need to favour |
|---|---|---|
| **Tracking** — hold on target through sustained fire | Pulse rifles, auto rifles, SMGs, trace rifles, machine guns | Stability and consistency: micro-corrections without overshoot |
| **Snap / flick** — acquire a target seen for a split second, fire, re-peek | Hand cannons, snipers, shotguns, sidearms | Fast, direct acquisition: minimal delay or damping between hand and reticle |
| **Precision hold** — line up a single deliberate shot | Scout rifles, linear fusions, bows | Fine control at low speed without losing turn speed |

The app asks which archetypes the user runs as primary/special (see §7) and
recommends per-archetype values where the evidence supports a difference —
e.g. how much smoothing suits a tracking-heavy pulse loadout versus a hand-cannon
snap loadout. Each per-archetype recommendation carries the same rationale +
source as everything else. *(The exact mapping of archetypes to aim styles, and
the values per style, are knowledge-base work — the table above is the shape,
not the answer.)*

*(Exact recommended values are intentionally **not** in this concept doc — they are
the knowledge-base work of the next milestone, where each value gets researched
and cited properly.)*

## 7. Personalization — the user profile

Recommendations are tailored from four inputs, collected once and editable
anytime (stored locally in the browser; no account needed):

- **Platform & hardware** — Xbox or PC; mouse model/DPI, mouse polling rate,
  monitor. Platform selects the right in-game values; the rest drives the math
  (e.g., DPI × sensitivity interactions, whether "jumpy" is a settings problem or
  a hardware ceiling).
- **Playstyle & loadout** — Crucible (PvP) vs PvE focus, aggressive vs precise,
  and the weapon archetypes they actually run (primary/special/heavy). Loadout
  drives the weapon-aware recommendations in §6; the rest changes which
  trade-offs the app recommends.
- **Current config** — existing settings as the starting point for Flow B, so
  advice is a diff, not a restart.
- **Feel preferences** — snappy vs smooth, high vs low sens targets. Where the
  evidence supports a *range*, preferences pick the point within it.

## 8. Evidence & citation model

This is the app's identity, so it's a hard rule, not a style choice:

- **Allowed sources:** official XIM Technologies documentation and developer
  guidance (manuals, Smart Translator release notes, OBsIV's posts), plus two
  named trusted community sources: **XIM Central** (YouTube) and **The XIM
  Guide**. Any further source is added only by an explicit decision recorded in
  the decision log — the list is a whitelist, not a starting point.
- **Every recommended value ships with:** the recommendation, a plain-language
  rationale (the mechanism, not just "trust me"), the source (who/where, with a
  link), and a confidence level — *official*, *expert consensus*, or *contested*
  (shown when trusted sources genuinely disagree, with both positions).
- **No orphan values.** If a value can't be sourced, it doesn't go in the app.
  Gaps are shown honestly as gaps.
- **Explanations are sourced too.** Flow D's definitions (what smoothing,
  precision, easing, etc. actually do) are drawn from the same allowed sources
  and cited the same way — the app never invents a mechanism to sound
  authoritative.

## 9. MVP definition (first buildable version)

- Web app, desktop-browser-first (usable on a phone next to the console later).
- Destiny 2 only, Xbox and PC.
- Flows A, B and D, plus the config-sheet output. (Flow C ships second — it
  reuses the same knowledge base once that exists.) Flow D is in the MVP because
  it is cheap to build and its explanations double as the rationale text every
  other flow displays.
- Weapon-aware aim config for the core Destiny 2 archetypes (at minimum the
  tracking vs snap split: pulse/auto vs hand cannon).
- Knowledge base as versioned data files in this repo (e.g., JSON/YAML with a
  `sources` field per value) — reviewable, diffable, and updatable when XIM
  firmware or Destiny 2 patches change the ground truth.
- User profile + entered configs persist in browser local storage. No backend,
  no accounts.

**Out of scope for MVP:** other games, config share codes, device connection,
curve editor/visualizer, community submissions, accounts.

## 10. Later (post-MVP direction)

Roughly in order of likely value:

1. **Flow C** (troubleshoot by feel) if not squeezed into MVP.
2. **Curve visualizer** — preview ballistic curves before entering them.
3. **More games** — the knowledge-base format is per-game from day one, so adding
   a game means adding data, not code.
4. **Config library** — save/compare multiple named setups.
5. **Community features** — sharing, submissions with the same citation bar.

## 11. Proposed technical approach

*(Recommendation — to confirm before building.)*

- **Static single-page web app** (e.g., React + Vite or similar). No server: the
  knowledge base compiles into the app, profiles live in local storage. This
  keeps hosting free (GitHub Pages/Vercel/Netlify), makes the app fast, and
  matches "reference-only" — there's simply nothing that needs a backend yet.
- **Knowledge base as data, not prose:** structured files per game/layer with
  values, applicability conditions (which profile they depend on), rationale
  text, and source links. The recommendation engine is mostly "select + explain,"
  which keeps it testable.
- **Repo layout sketch:** `app/` (UI), `knowledge/destiny2/` (the evidence base),
  `docs/` (this concept, research notes).

## 12. Open questions

1. **Name** — is *Dialed* worth keeping, or do you have a name in mind?
2. **Flow C in MVP?** — included above as fast-follow; say the word if it's
   actually the feature you'd use most and it moves into MVP.
3. **The XIM Guide** — confirm the exact document/URL so citations point at one
   canonical version (to be pinned down at the start of knowledge-base research).
4. **Multi-weapon loadouts** — the Matrix can't detect an in-game weapon swap, so
   weapon-aware settings can only be applied as (a) separate configs/sub-configs
   the user switches manually, or (b) one "loadout compromise" config tuned for
   the weapons they run together. Proposed: the app offers both, with (b) as the
   default and (a) as an option for users who already switch configs mid-match.
   Confirm or pick one.

*Resolved:* platform is **Xbox and PC**; trusted community sources are **XIM
Central** and **The XIM Guide** (see §8 and the decision log).

## 13. Decision log

Choices made during concept alignment (2026-09-22):

| Decision | Choice |
|---|---|
| Category | Gaming utility: XIM Matrix setup helper |
| Platform | Web app first |
| Audience | Intermediate–advanced XIM users; author-only for now |
| First milestone | Concept definition (this document) |
| Device link | Reference-only — user applies values in XIM Matrix Manager |
| First game | Destiny 2 |
| Platforms | Xbox and PC |
| Knowledge policy | Evidence-based: official XIM docs + trusted community experts |
| Trusted community sources | XIM Central (YouTube), The XIM Guide — whitelist; additions require a logged decision |
| Rationale display | Full rationale + source on every value |
| Guidance scope | In-game D2 settings, Matrix global settings, aim config (hip/ADS), troubleshooting by feel |
| Personalization inputs | Platform & hardware, playstyle & loadout, current config, feel preferences |
| Weapon-aware recommendations | Yes — aim config varies by weapon archetype / aim style (tracking vs snap vs precision hold) |
| Concept explainer | Yes — Flow D glossary, inline on every setting name, sourced like everything else; in MVP |
