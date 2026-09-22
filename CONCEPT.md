# XIM Matrix Setup Guide — App Concept

**Working title:** *Dialed* (placeholder — rename anytime)
**Status:** Concept for review · v0.1 · 2026-09-22

---

## 1. One-liner

A web app that guides intermediate-to-advanced XIM Matrix users to a dialed-in,
evidence-based configuration for their game — starting with **Destiny 2** — where
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
| **Destiny 2 first**, deep rather than broad | A shallow database of many games (that may come later) |

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

All three flows converge on the same output format: a **config sheet** — the full
list of values across every layer, each annotated with rationale + source, ready
to be entered into Matrix Manager and the game.

## 6. Scope of guidance — the four layers

The app treats a "configuration" as a stack, and always presents it in this order
because upper layers are meaningless if the lower ones are wrong:

1. **In-game Destiny 2 settings** — the controller/sensitivity values the Smart
   Translator was trained against. Wrong values here silently break everything
   above, so this layer is validated first in every flow.
2. **Matrix global/device settings** — polling rate, sync mode, response rate:
   the device-level foundation shared by all configs.
3. **Aim config (hip & ADS)** — sensitivity, ballistic curves, deadzone,
   smoothing, steady aim: the heart of the "perfect config," and where
   personalization matters most.
4. **Troubleshooting knowledge** — the symptom → cause → fix mapping that powers
   Flow C and the "why" annotations everywhere else.

*(Exact recommended values are intentionally **not** in this concept doc — they are
the knowledge-base work of the next milestone, where each value gets researched
and cited properly.)*

## 7. Personalization — the user profile

Recommendations are tailored from four inputs, collected once and editable
anytime (stored locally in the browser; no account needed):

- **Hardware** — mouse model/DPI, mouse polling rate, monitor. Drives the math
  (e.g., DPI × sensitivity interactions, whether "jumpy" is a settings problem or
  a hardware ceiling).
- **Playstyle** — Crucible (PvP) vs PvE focus, aggressive vs precise, preferred
  weapon types. Changes which trade-offs the app recommends.
- **Current config** — existing settings as the starting point for Flow B, so
  advice is a diff, not a restart.
- **Feel preferences** — snappy vs smooth, high vs low sens targets. Where the
  evidence supports a *range*, preferences pick the point within it.

## 8. Evidence & citation model

This is the app's identity, so it's a hard rule, not a style choice:

- **Allowed sources:** official XIM Technologies documentation and developer
  guidance (manuals, Smart Translator release notes, OBsIV's posts), and
  well-established testing/configs from respected XIM community forum experts.
- **Every recommended value ships with:** the recommendation, a plain-language
  rationale (the mechanism, not just "trust me"), the source (who/where, with a
  link), and a confidence level — *official*, *expert consensus*, or *contested*
  (shown when trusted sources genuinely disagree, with both positions).
- **No orphan values.** If a value can't be sourced, it doesn't go in the app.
  Gaps are shown honestly as gaps.

## 9. MVP definition (first buildable version)

- Web app, desktop-browser-first (usable on a phone next to the console later).
- Destiny 2 only.
- Flows A and B, plus the config-sheet output. (Flow C ships second — it reuses
  the same knowledge base once that exists.)
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
2. **Platform detail** — PlayStation, Xbox, or both for Destiny 2 guidance? (Some
   in-game settings and STs differ by platform.)
3. **Trusted experts list** — are there specific community members/creators you
   already trust (or explicitly *don't*), to seed the allowed-sources list?
4. **Flow C in MVP?** — included above as fast-follow; say the word if it's
   actually the feature you'd use most and it moves into MVP.

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
| Knowledge policy | Evidence-based: official XIM docs + trusted community experts |
| Rationale display | Full rationale + source on every value |
| Guidance scope | In-game D2 settings, Matrix global settings, aim config (hip/ADS), troubleshooting by feel |
| Personalization inputs | Hardware, playstyle, current config, feel preferences |
