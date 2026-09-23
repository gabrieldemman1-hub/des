# Dialed

A phone-first web app that guides intermediate-to-advanced **XIM MATRIX** users to a dialed-in,
evidence-based configuration for **Destiny 2 on Xbox and PC** (controller output), where every
recommendation comes with the *why* and the *source* behind it.

The agreed concept, including the evidence policy, is in [CONCEPT.md](CONCEPT.md). Research notes
are in [docs/research/](docs/research/).

**Status:** app foundation. The shell, navigation, profile, loadouts, sources, knowledge-base
loader and offline support are built. The four flows (Build my config, Tune my config,
Troubleshoot by feel, Explain a concept) are placeholder screens for now; they are the next step.

## Run it on your computer

You need **Node.js 22.22.2 or newer on 22.x, 24.15+ or 26+** (the test runner's jsdom 30
requires it; React Router 8 needs 22.22+) and npm.

```sh
npm install
npm run dev
```

Open the address it prints (normally <http://localhost:5173>).

## Open it on your phone

With the phone and the computer on the same Wi-Fi:

```sh
npm run dev -- --host
```

Vite prints a **Network** address such as `http://192.168.1.20:5173`. Open that on the phone.

Things to know:

- **Your data lives on the phone, per address.** The profile and loadouts are saved in that
  browser for that exact address. If the computer's IP address or the port changes, the phone
  sees a new site with no saved data (the old data is still there under the old address). Use
  **Profile › Download backup** to keep a copy, and **Restore from backup** to bring it back.
- **Install and offline need HTTPS.** Browsers only run service workers on `https://` or
  `localhost`, so over `http://192.168.…` the app works but can't be installed or used offline.
  That works once the built app is hosted on HTTPS (GitHub Pages is planned; the build uses a
  relative base, so it works from any subpath).

To try the production build on the phone: `npm run build && npm run preview -- --host`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload (`-- --host` to reach it from your phone) |
| `npm run build` | Production build into `dist/` (app, service worker, manifest) |
| `npm run preview` | Serves `dist/` locally |
| `npm test` | All tests once (Vitest): knowledge base, storage, loadout rules, screens |
| `npm run lint` | ESLint (type-aware) |
| `npm run typecheck` | TypeScript 7 type check of the app, knowledge base, scripts and configs |
| `npm run verify:citations` | Fetches every cited page and checks each quote and #anchor is on it (manual, needs network) |
| `npm run check:release` | Release gate: fails while statements still wait on the in-game Easing test (manual, not in CI) |
| `npm run icons` | Regenerates the PNG icons from the SVGs in `app/icons/` |

CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, typecheck, test and build on Node 22 for
every push and pull request.

## Project structure

```
app/                      the web app (Vite root)
  index.html
  icons/                  icon sources: icon.svg, icon-maskable.svg
  public/                 served as-is: favicon.svg, icons/*.png (generated, committed)
  src/
    main.tsx              entry: hash router, data provider, service worker updates
    routes.tsx            the screens and their URLs (#/, #/loadouts, #/profile, …)
    styles.css            phone-first styles; dark theme, light via prefers-color-scheme
    components/           Screen, TabBar, ConfidenceBadge, ConfirmDialog, SegmentedField, …
    screens/              Home, Flow (placeholder), Profile, Loadouts, LoadoutEditor, Sources
    content/              UI text from CONCEPT.md: flow descriptions, labels
    state/                profile/loadout schema, storage, loadout rules, React contexts
    test/                 test setup, fixtures, render helper
knowledge/                the evidence base (see below)
  schema.ts               the zod contract (evidence rules from CONCEPT.md §8)
  sources.json            the source whitelist
  matrix/*.json           XIM MATRIX glossary, setup checks, symptoms, aim styles, expert notes
  destiny2/*.json         Destiny 2 game settings and weapon archetypes
  index.ts                loads and validates every file, merges the glossary, lookup helpers
  integrity.ts            cross-reference and citation checks
  knowledge.test.ts       runs the schema and integrity checks on the real files
scripts/
  verify-citations.mjs    npm run verify:citations
  lib/citations.mjs       HTML-to-text and quote normalisation (unit-tested)
  generate-icons.mjs      npm run icons
docs/research/            research notes behind the concept
CONCEPT.md                the agreed concept
```

## The knowledge base

Everything the app says about the MATRIX or Destiny 2 comes from the JSON files in
`knowledge/`, compiled into the app. The rules, enforced by `schema.ts` and the tests:

- **Whitelisted sources only.** Every citation names a source in `sources.json`, and its URL
  must be on one of that source's `hosts`. Adding a source requires a logged decision
  (CONCEPT.md §8).
- **Every statement carries a confidence label:** `official` and `expert` need at least one
  citation, `contested` needs at least two from different sources (both positions), `reasoned`
  must explain its `reasoning` (a direction, never an invented number) and cite the
  definitions it relies on, or say in its `caveat` why it can't (e.g. the weapon mappings:
  no whitelisted source covers Destiny 2 weapons), and `gap` has no citations.
- **The Easing caveat.** Any statement that gives an Easing direction carries, word for word,
  the caveat in `EASING_CAVEAT` (`knowledge/integrity.ts`). `npm run check:release` fails while
  any statement still carries it: the direction is confirmed in-game before Dialed ships.
- **XIM MATRIX-era only.** Citations of the `expert` source (XIM Central) must set
  `"matrixEra": true`, and only those may set it; nothing written for XIM APEX or XIM4.
- **Explanations are sourced too.** A "not to be confused with" entry that doesn't point at
  another term (`termId`) carries its own `statement`, and every name note is a `statement`.
- **Quotes are verbatim** from the cited page (checked by `npm run verify:citations`).
- **Ids are kebab-case and unique** per collection (the two glossary files count as one), and
  every reference (`termIds`, `related`, `notToBeConfusedWith.termId`, name note `termId`,
  `symptomIds`, symptom `checkIds`, lever `termId`, archetype `aimStyle`) must point at
  something that exists. `related` links go both ways.
- **The glossary is game-agnostic.** Destiny 2 guidance lives in `knowledge/destiny2/`: game
  notes, and `preferences` (what each profile preference can change, with a `gap` statement
  where no source lets it change anything). The setup checks name Destiny 2 only where the
  check is about the game itself.
- **Every JSON file is registered** in `knowledge/index.ts` with its schema; a test fails if a
  file in `knowledge/` isn't.

`npm test` runs these checks. A file that fails its schema can't crash the app: the loader
replaces it with an empty one and the Sources screen says part of the knowledge base was left
out. The tests fail in that case, so it never ships.

### Checking citations against the live pages

```sh
npm run verify:citations
npm run verify:citations -- --verbose        # also list the quotes that were found
npm run verify:citations -- --dir some/folder  # check another folder of JSON files
```

It collects every citation in `knowledge/**/*.json`, fetches each unique URL once (anchor
removed), turns the page into text (drops `<script>` and `<style>`, strips tags, decodes HTML
entities, and includes description meta tags), normalises both the page and the quote (curly
quotes and apostrophes to straight ones, non-breaking spaces to spaces, whitespace collapsed),
and checks the quote appears on the page. A cited `#anchor` must exist on the page too (an
`id`, or a `name` on an `<a>` element, which the forum pages use). It prints each failure (file, entry id, URL, quote,
reason) and a summary, and exits with code 1 if anything fails.

It is a manual check, not part of CI, because it depends on third-party sites. Requests honour
`HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY`. Behind a proxy that re-signs TLS, point
`NODE_EXTRA_CA_CERTS` at its CA bundle.

## Data on the phone

The profile and loadouts are stored in `localStorage` under one versioned key, `dialed:v1`,
and validated with zod whenever they're read. Stored data and backups carry a `version`; data
from an older version is brought up to date step by step (`MIGRATIONS` in
`app/src/state/storage.ts`), so a schema change never makes old backups unrestorable. The
player's current Config values (Flow B's starting point) aren't stored yet: they arrive with
Flow B, together with a version bump and its migration step. If storage is blocked, the saved data is corrupt,
or it doesn't match the schema, the app starts from defaults (keeping whatever is still valid),
shows a small notice, and copies the unreadable data aside to `dialed:v1:unreadable` so it
isn't lost. Backups are plain JSON files, validated before anything is replaced.

## Installable app (PWA) and icons

`vite-plugin-pwa` generates the web app manifest and a service worker that precaches the app,
so after the first visit over HTTPS it opens offline and can be added to the home screen. When
a new version is deployed, the app offers a **Reload** button rather than reloading while you
edit.

The icons are generated from `app/icons/icon.svg` (the crosshair mark on a rounded square, also
used as the favicon) and `app/icons/icon-maskable.svg` (full-bleed, with the mark inside the
maskable safe zone). After editing either SVG, run `npm run icons` and commit the PNGs in
`app/public/icons/`.

## Tooling and versions

All installed together and checked with lint, typecheck, test and build:

| Package | Version |
|---|---|
| react, react-dom | 19.3.0 |
| react-router | 8.4.0 (hash routing: `createHashRouter`) |
| zod | 4.6.5 |
| vite | 8.3.0 |
| @vitejs/plugin-react | 6.1.1 |
| vite-plugin-pwa | 1.3.0 (Workbox 7.4.1) |
| vitest | 5.0.1, with jsdom 30.1.1 |
| @testing-library/react / dom / user-event / jest-dom | 16.3.3 / 10.4.2 / 14.6.7 / 7.0.1 |
| eslint, @eslint/js | 10.11.0, 10.0.1 |
| typescript-eslint | 8.70.1 |
| eslint-plugin-react-hooks, eslint-plugin-react-refresh | 7.1.1, 0.5.7 |
| TypeScript | 7.0.2 for type checking; 6.0.3 API for ESLint (see below) |
| undici, entities | 8.11.0, 8.1.0 (citation checker) |
| @resvg/resvg-js | 2.6.2 (icon generation) |

**TypeScript 7 and ESLint.** typescript-eslint 8.70.1 does not support TypeScript 7: it stops
with "typescript-eslint does not support TS 7.0", because the `typescript` 7 package no longer
exposes the classic compiler API it uses. Its error message points to running TypeScript 7 side
by side with the TypeScript 6.0 API, which is what this project does:

- `typescript` in `package.json` is an alias for `@typescript/typescript6` (the TypeScript 6.0
  API, which resolves to TypeScript 6.0.3 in `node_modules/@typescript/old`). typescript-eslint
  uses it. Editors use their own bundled TypeScript; to use the workspace's TypeScript 6.0.3 in
  VS Code, set `"typescript.tsdk": "node_modules/@typescript/old/lib"`.
- `typescript-7` is TypeScript 7.0.2. `npm run typecheck` runs it explicitly.

Use `npm run typecheck` rather than `npx tsc`: `npx tsc` resolves to TypeScript 6. When
typescript-eslint supports TypeScript 7, replace both entries with a single `typescript`
dependency and point the `typecheck` script back at `tsc -b`.
