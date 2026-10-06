# Primer

A phone guide to the XIM MATRIX settings, in the order XIM MATRIX Manager shows them, with the evidence behind every sentence. See [CONCEPT.md](CONCEPT.md) for what it covers and its evidence policy.

Primer is a static site: every setting is its own page, built ahead of time. It installs to a phone's home screen and works offline.

## Run it

You need Node.js 22.12 or newer, and npm.

```sh
npm install
npm run dev
```

Open the address it prints. The site lives under `/des/`, as it does on GitHub Pages.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local server with live reload |
| `npm run build` | Builds the site into `dist/`, including the offline service worker |
| `npm run preview` | Serves the built site |
| `npm test` | Content schema and integrity checks, and page rendering tests (Vitest) |
| `npm run check` | Type-checks the Astro pages and TypeScript |
| `npm run lint` | ESLint |
| `npm run verify:citations` | Fetches every cited page and checks every quote is on it (needs network) |
| `npm run icons` | Renders the PNG icons from `assets/icons/*.svg` |

CI runs lint, check, test and build on every push and pull request.

## Structure

```
content/                 the evidence: one JSON file per setting and aim style
  settings/*.json        each setting's statements and citations
  aim-styles/*.json      tracking, snap, precision hold
  names.json             names people use that the guide doesn't list as settings
  map.json               the guide's chapters and Manager screens, and what sits on each
  sources.json           the only sources Primer cites
  schema.ts              the evidence contract (zod)
  index.ts               loads and validates everything at build time
  integrity.ts           checks that span files
src/
  pages/                 the map (index), settings/[id], aim-styles/[id], sources, 404
  components/            a statement with its footnotes, the notes list, the confidence label
  lib/notes.ts           per-page footnote numbering
  layouts/Layout.astro   the page frame
  styles/global.css      the field manual's tokens and base styles
  sw-template.js         the offline service worker (filled in at build time)
scripts/                 verify-citations, icon generation
tests/                   page rendering tests
```

## Publishing

`.github/workflows/pages.yml` builds and publishes the site to GitHub Pages on every push to `main`.
