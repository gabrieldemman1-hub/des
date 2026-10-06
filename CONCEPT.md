# Primer: concept

Primer is a phone guide to the XIM MATRIX settings. It explains each setting in the order XIM MATRIX Manager shows it, with the evidence behind every sentence.

## Who it's for

People who use an XIM MATRIX with controller output, mostly to play Destiny 2, and want to know what a setting actually does before they change it.

## Its one job

Explain the settings. Primer doesn't build a config for you, tune one, keep a profile or save anything about you. It is a reference you read.

## What it covers

- **MATRIX aim settings:** sensitivity, smoothing (Standard and Classic), aiming curve, quantization, velocity mapping and the rest of the Config's aim settings.
- **MATRIX setup:** output type, mouse DPI, polling rate, firmware, Smart Translation and game settings sync, light notifications, Configs and how they load.
- **Weapon aim styles:** what tracking, snap and precision-hold weapons ask of those settings, with the Destiny 2 weapon types that fire each way.

Left out: Destiny 2's own in-game settings list, mouse-and-keyboard output, and recommended numbers that no source gives. Where nothing gives a number, Primer says so.

## How it's organised

The home screen is a map that follows the XIM MATRIX guide's own chapters (Configuring, Manage, Troubleshooting), and within them the Manager screens. Each setting sits on the screen where you change it in Manager (`content/map.json`). Search on top filters the map.

Each setting has one page:

1. Where it is in Manager.
2. XIM's definition.
3. In plain words.
4. How it feels.
5. What to set.
6. By aim style.
7. Not to be confused with.
8. Read next.
9. The numbered notes, which quote each source word for word.

The previous and next links follow the order on the Manager screen.

## Evidence policy

Every sentence about a setting is a **statement** with a confidence label and its citations (`content/schema.ts`):

| Label | Meaning | Rule |
|---|---|---|
| Official | XIM says it | At least one citation |
| Expert | An expert source says it, in MATRIX-era material | At least one citation, marked `matrixEra` |
| Contested | Sources disagree | Both sides cited |
| Reasoned | Primer works it out from what is cited | Shows its reasoning |
| Gap | No source says it | No citations, and it states no uncited fact |

Every quote must appear word for word on the page it cites. `npm run verify:citations` fetches every cited page and checks it. Sources are limited to `content/sources.json`, and adding a source needs a decision recorded below. Primer is an independent guide, not made by or affiliated with XIM Technologies.

## Decisions

- **2026-10-06: restart.** The earlier app, Dialed, is replaced by Primer, a guide only, with the answers above: XIM MATRIX and Destiny 2, simpler; its one job is to explain the settings; full evidence; a phone web app; no data about the user; navigation that mirrors Manager's menus. Dialed's code, history and live site stay in git history.
- **2026-10-06: evidence carried over.** Dialed's fact-checked entries for the in-scope settings and the three aim styles became Primer's content. Every citation was re-checked against its live page: 781 of 781 passed. Each setting gained a cited "where it is in Manager" statement (275 new citations, all verified), and wording about Dialed's own features was removed.
- **2026-10-06: sources.** The XIM MATRIX User Guide, XIM Game Settings (public copy) and the XIM MATRIX Official Hardware Compatibility List are the sources still cited. XIM Central, the Getting Started guide and Bungie's policy page are no longer cited, so they are not listed.
- **2026-10-06: look.** The field manual look: cool paper and black ink, condensed capitals for names, a serif for reading, cobalt footnote numbers, light first with a dark theme.
