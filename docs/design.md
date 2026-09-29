# Design: Calibration

_Dialed's visual design since the 2026-09-29 redesign. It grew out of the [UI design review](reviews/2026-09-24-ui-design-review.md) and a design plan approved on 2026-09-29. The tokens live at the top of `app/src/styles.css`._

## The idea

A night-slate instrument panel. The numbers are the brightest thing on screen. One amber signal marks the next action and where you are. Green and red mean only Done and Needs fixing. Evidence is always one tap away, and it is never printed open in the way of the task.

## Colour

Each colour has one role. The same roles apply in both themes. The dark theme is the default, and the light theme follows `prefers-color-scheme`.

| Role | Tokens | Used for |
|---|---|---|
| Page and panels | `--bg`, `--surface`, `--surface-2`, `--surface-3` | Tonal steps instead of borders. A panel is a step lighter than what it sits on. |
| Text | `--text`, `--text-muted`, `--text-faint` | Values and titles; reading text; small-caps labels and captions. |
| Signal | `--accent`, `--accent-text`, `--on-accent`, `--lock` | The page's one primary button, links' underline, the main-weapon diamond and the target-lock brackets. |
| State | `--success`, `--danger`, `--tick-empty` | Done and Needs fixing only, including the ruler's ticks. |
| Data ink | `--data`, `--focus` | Icons, glyphs and the focus ring. |
| Confidence | `--c-official` … `--c-publisher` | Badges, always with a shape and a word as well as the colour. |

Every text pair is at least 4.5:1, including badges and pressed toggles on their tinted fills. Control edges, the focus ring, the lock and icons are at least 3:1. `scripts/theme-contrast.test.ts` reads the tokens from the stylesheet and checks 106 pairs across both themes, so a colour change that breaks AA fails the tests.

## Type

The app bundles three faces under the SIL Open Font License (`app/src/assets/fonts/`, licences in `LICENSE.md`), so they also work offline.

- **Dialed Display** (Archivo, narrowed) is for titles, section labels and the tab labels.
- **Dialed Text** (Atkinson Hyperlegible Next) is for reading.
- **Dialed Numbers** (Martian Mono) is for values, counts and readouts, with tabular figures so values line up down a column.

## Parts

- **Target lock** (`.lock`): corner brackets, as on a scope, around the one thing that is "here" or "first". It marks the current tab, the current build step and the change to make first in Tune.
- **Tick ruler** (`TickRuler`): progress with one tick per item. Done ticks come first, then Needs fixing, then the ones to go. The counts are its accessible name and are written under it.
- **Readout** (`Readout`): a small-caps label over a value in the numbers face. `Yours → XIM's list` pairs step the current value back so the target leads.
- **Slide-up sheet** (`Sheet`): a modal panel from the bottom with one item's detail. Focus starts on Close and stays inside the panel. Escape and the backdrop close it, and focus returns to the row that opened it.
- **Filter chips, tool tiles and list rows**: tonal, with no borders. A chosen chip is inverted, like the selected segment.

## Layout rules

- Each screen has at most one amber action: the step forward. The long Build step 2 repeats its Next above the list.
- Intros are one line. The rest sits behind "How this works" (or its equivalent).
- A caveat is one line with More. The full text is always there for a screen reader.
- On the config sheet, a section whose rows share one confidence says it once, beside the title.

## Navigation

There are four tabs: Home, Loadouts, Learn and Profile. Sources has no tab. It is reached from the end of Learn and Profile and from Home's footnote, and its back link returns to wherever it was opened from. The flows open from Home, so the Home tab stays lit inside them.

## Motion

Motion runs only under `prefers-reduced-motion: no-preference`:

- A new screen rises in (220 ms).
- A ruler sweeps in tick by tick, then each tick changes colour in place.
- A Done mark draws its tick.
- The detail sheet slides up.

## Checked

These were checked on 2026-09-29, over 20 routes in Chromium:

- No horizontal overflow at 360 px (dark and light), at 200% text, or in forced colours.
- In forced colours, the ruler's ticks and the main-weapon diamond are drawn in system colours: outlined to go, filled when done, highlighted when they need fixing.
- With reduced motion, every animation is off.
