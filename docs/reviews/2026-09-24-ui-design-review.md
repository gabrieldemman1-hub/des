# UI design review, 2026-09-24

_A heuristic review of the live app (https://gabrieldemman1-hub.github.io/des/) through eight lenses, every finding checked by two independent reviewers. Screen names like `dark-sheet.s02` refer to phone screenshots taken during the review, which are not in the repository. The P1 items, the quick wins, Home (F01, F10, F12, C04), the evidence de-duplication (F06, F21, F22, F23, F50) and label consistency (F26, F28, F35, F47, F51) were fixed in the days after the review; the rest is open._

## 1. Verdict

Dialed is a well-built, unusually honest product with a clear identity. The hero explains itself in two lines, the four flows are phrased as the player's own intents, every confidence label is one plain word with a shape as well as a colour, and the config sheet's big top-right value is exactly the right thing to put in front of a phone propped beside a console. Contrast, tap targets, focus rings, safe areas and the 360 px layout are handled with more discipline than most shipping apps. What holds it back is density and consistency: the evidence that is the product's promise is printed open, repeated and re-stamped on almost every card, so the core loop (glance, check one thing in Manager, tap Done) becomes 24 screens of scrolling on Build step 2, and the sheet's aim rows, Tune's value pairs and the progress marks each use a different grammar for the same information. Three problems go beyond polish: a required Destiny 2 value can read "Done" while it differs, the aim rows give no glanceable value where values matter most, and a stylesheet-order bug greys out the Raise/Lower direction that is Tune's deliverable. None of this needs a redesign; it needs the app's own best patterns (the sheet row, the "Why and source" disclosure, the shared caveat) applied everywhere.

## 2. What works

**First run.** A new user reads what, for whom and the promise before any chrome; no empty state is a dead end; the Build index says which profile fields are missing and that "You can still build"; the loadout editor enforces "only a filled slot can be main" visually and validates inline with focus on the first bad field; Profile hides Output type until a platform is picked and autosaves; the install card states its benefit in context and is never final. (empty-dark-home-fold, empty-dark-build-index.s01/s02, empty-dark-loadout-new-invalid.s01, empty-dark-profile.s01, empty-dark-home.s02)

**Navigation.** Every non-root screen has a back link that names its destination; your place in Build and Tune is in the address, so reload, share and phone-back keep it; the four-step indicator is a real, non-linear navigator that fits at 360 px; deleted loadouts and bad symptom ids get contextual recovery, not a generic 404; each flow ends with a hand-off to the next. (dark-build-step1-destiny.s01, narrow-dark-build-step3-aim.s01, dark-symptom-jitter.s06, dark-tune-changes.s05)

**The sheet and the evidence.** The value to enter sits top-right at 1.5rem/800 with a red "Differs from 1.5" tag; disclosures keep 19 items to about six screens with every citation one tap away; evidence blocks are verbatim, scoped ("Said about Quantization. Dialed applies it to every change.") and candid about gaps; the shared caveat is hoisted once; the plain-text copy keeps the labels and falls back to a selectable textarea; "Change this first" gives Tune a single focus. (dark-sheet.s02/s06, light-sheet.s02, dark-tune-changes.s01, dark-symptom-floaty-gap.s01)

**Copy.** Confidence labels are single words and the Gap copy says what Dialed will not do; symptoms are named in the player's words with "Also described as"; Profile hints pre-empt the name collisions ("It isn't the Precision setting"); empty states and errors are short imperatives that name the next action; Tune's diff ("Yours 1 / XIM's list 1.5") is as short as it can be. (dark-sources.s03, dark-troubleshoot.s10–s12, dark-profile.s03, dark-tune-changes.s01)

**Accessibility and ergonomics.** Every text pair clears WCAG AA and most clear AAA in both themes (muted text 7.2:1 dark, 6.1:1 light), with a darker accent for light mode; badges pair shape, colour and a hidden "Confidence:" prefix; a 3px focus ring, forced-colours fallbacks and focus-to-heading after navigation; correct nav/aria-current/aria-pressed semantics; tap targets 44–60 px enforced in CSS; numeric fields use the phone keypad, accept a decimal comma and never zoom; destructive actions go through a focus-trapped confirm dialog; feedback appears where the action happened. (dark-troubleshoot.s02, dark-tune-settings.s01, dark-loadout-edit.s02, dark-learn-search.s01)

**Layout.** Content always clears the tab bar (its real height is measured), safe areas and the iOS standalone case are handled, nothing clips or scrolls sideways at 360 px, spacing follows a small token set, and the tab bar follows current mobile conventions. (narrow-dark-sheet.s09, narrow-dark-tune-settings.s01, dark-home-fold)

## 3. What to fix, by priority

Lens key: **Onboarding** (first run), **IA** (navigation), **Hierarchy** (visual hierarchy, type, density), **Copy**, **Interaction** (forms, feedback), **Colour/A11y**, **Layout**, **Sheet** (config sheet and evidence), **Critic** (completeness pass).

### P1: fix first

**1. Build step 2 prints every check's evidence open, and the Done buttons sit at the bottom of each card (F02).** Seven checks run to 20–24 phone screens because "Why it matters" renders its reasoning and 4–13 quotes inline; one card's Done/Needs fixing pair is three screens below its title, and the "Next" pager appears on screen 24. Step 3 does the same at smaller scale. The identical checks are collapsed in Troubleshoot and on the sheet, so this is an inconsistency, not a choice. *Why it matters:* this is the core loop, done one-handed at the console; scrolling citation walls to find the button that records a check is the largest source of friction in the app. *Fix:* reuse Troubleshoot's `<details class="why">` for "Why it matters" (closed by default; open "How to fix it" only when marked Needs fixing); move the Done/Needs fixing pair into the card header beside the title, or make it sticky above the tab bar on tall cards; put step 3's quotes behind "Reasons and sources" as the sheet does; repeat the pager under the "2 of 7 done" row. Expect ~24 screens to become ~5. (dark-build-step2-matrix.full/s03–s06/s24, narrow-dark-build-step3-aim.s03, dark-troubleshoot.s02–s03 · Hierarchy, Layout, Interaction)

**2. Aim rows on the sheet abandon the row grammar: no glanceable value, orange link titles, floating badge (F07).** Destiny 2 and MATRIX rows read name / big value / badge / Yours / disclosure. In Aim settings only Precision has a value ("Raise"); Sensitivity, Smoothing, Aiming Curve, Quantization and Velocity Mapping leave the value slot empty and hide "keep it linear", "off by default" inside 0.95rem prose; the title becomes an underlined orange term link, so it reads as navigation. *Why it matters:* the concept calls aim "the heart of the perfect config", and this is where the eye stops finding the number it learned to look for. *Fix:* derive a value for every aim row (Linear, Off, Standard, "A preset", "Your cm/360" with the Gap badge, Raise) and put it in `.sheet-value`; render titles in `--text` with a small "What is this?" chip; badge and status on one line; mirror the value in the text export. (dark-sheet.s05–s08, narrow-dark-sheet.s08, light-sheet.s06 · Sheet, Hierarchy)

**3. A Destiny 2 row can say "Done" and "Differs from 1.5" at once, and the summary and Tune contradict the sheet (F09).** ADS Sensitivity Modifier shows a green Done chip above "Your current value: 1 · Differs from 1.5"; the header says "1 needs fixing" and does not count it; Tune's "Change this first" is that very setting. `sheetProgress()` only forces "problem" for MATRIX checks, not required settings. *Why it matters:* a wrong required value "silently breaks everything above" (concept §6); a sheet that hides it defeats the layer-first validation the product is built on. *Fix:* treat a differing required setting as "problem" regardless of the tick, render the existing "You marked this Done, but your value differs" line, count it in the header and in `planProgress` for the Build index. (dark-sheet.s02–s03, dark-tune-changes.s01 · Sheet)

### P2

**Home never reflects state, on first run or after (F01, F10).** First run: the only guidance is a muted status line pointing to Profile (optional) while the loadout (required) is unmentioned; returning: after a platform, two loadouts and 5 of 19 items, only one line changes and all four cards still say "Ready to use" (a constant from when three flows were placeholders). The sheet is three taps and a small pill away. *Why:* a home-screen PWA opened many times a session should route to where you are. *Fix:* with no loadouts, a "Start here" card (1. Add a loadout, required · 2. Profile, optional · 3. Build) with a primary "Add your first loadout"; with loadouts, a "Your loadouts" strip linking each to its sheet with "5 of 19 done · 1 needs fixing" and a "Continue build" link; replace "Ready to use" with per-flow state or nothing; make "Config sheet" the full-width button on the Loadouts card. (dark-home-fold, empty-dark-home-fold, dark-loadouts.s01 · Onboarding, IA, Hierarchy, Copy, Colour/A11y)

**Term and aim-style back links go to a hard-coded parent you never visited (F03).** From a symptom, tapping Precision lands on the glossary with "‹ Explain a concept" and the Learn tab lit; the same from Build step 3, Tune cards and every sheet term link. In the installed app that link is the only back control. *Fix:* generalise `sheet-navigation.ts` into a from-state helper so the link reads "‹ Jitter or shake on small movements", with the Learn fallback for direct entry. (dark-symptom-jitter.s02, dark-term-easing.s01, dark-style-snap.s01 · IA)

**Symptom pages bury the answer under the reasoning (F04).** "What it points to" opens with a 20-line paragraph, the bold lead-in and 11 quotes; the settings chips arrive on screen 4 and "Try this one change" on screen 6. *Fix:* inverted pyramid: mapping sentence with badge, settings chips, the one change with an action, "Check these first", then one collapsed "Why, and the sources". (dark-symptom-hip-ads.s01–s06 · Hierarchy)

**Type scale has no step between section heading, card title and body (F05).** h2 is 18.4 px, card titles 17.6 px, body 16 px, so "MATRIX setup" is barely larger than "Firmware is up to date" beneath it. *Fix:* h1 1.75rem, h2 1.35rem with 24 px top margin, card 1.1rem, body 1rem, meta 0.875rem; keep `.sheet-value` at 1.5rem. (dark-sheet.s03/s05, dark-build-step2-matrix.s01 · Hierarchy)

**Boilerplate and duplicate quotes triple the length of "why" pages (F06, F23).** Every Reasoned statement repeats the bold "Worked out from XIM's definitions, not stated by a source." under a badge whose legend already says it; on Easing the same caveat appears four times and one quote five times; Snap repeats four quotes twice; Smoothing's definition and its first blockquote are identical; the Precision card prints the lead-in with no reasoning after it; Tune repeats the five-line Game Settings caveat in every Destiny 2 card although the sheet hoists it once; sheet disclosures re-print the statement already shown above them. *Why:* the boilerplate is bold and the real reasoning is grey, so weight is inverted and readers learn to skip. *Fix:* drop the lead-in when the badge is shown; hoist page-wide caveats to one banner; reuse `sharedCaveat()` in Tune; dedupe citations by (url, quote) per card and per page; add `showText={false}` for disclosures. (dark-term-easing.s01–s05, dark-term-smoothing.s01, dark-sheet.s07, dark-tune-changes.s03 · Copy, Hierarchy, Sheet)

**Stylesheet order silently greys out Tune's Raise/Lower tag (F08).** `main.tsx` imports routes before `styles.css`, so the later `.tag` rule overrides `.tag-direction` (and `.tune-first`'s ring). The direction word is Tune's deliverable and currently the least prominent element on the card. *Fix:* import `styles.css` first and declare `@layer base, features`; remove the `.tag.tag-differs` workaround. (dark-tune-changes.s03, light-tune-changes.s03 · Colour/A11y)

**"Add a loadout" from Build ends on the Loadouts tab, not back in Build (F11).** After saving, the user is dropped on Loadouts with the tab highlight moved and three equal pills to choose from. *Fix:* pass `returnTo` state; after save navigate to `/build/<id>` (or `/tune/<id>/settings`) and flash "Saved. Starting its build."; align the editor's back link and Cancel with the origin. (empty-dark-build-index.s02, dark-loadouts.s01 · Onboarding)

**Flow intros are spec prose in "the app" voice that push the first action below the fold (F12).** Build's eight-line lede hides "Add a loadout" on first run and the second loadout card when populated; Tune repeats two paragraphs of CONCEPT.md ("a diff, not a restart"). *Fix:* one sentence in Dialed's voice, the rest behind "How this works"; on the populated Build index put loadouts above the profile block. (empty-dark-build-index.s01, dark-build-index.s01, dark-tune-index.s01 · Onboarding, Copy)

**Build step 4 "Your config sheet" is not the sheet (F15).** It is a landing page; "Open the config sheet" jumps to the Loadouts tab, drops the step chrome, and the back link then reads "‹ Build my config" while returning to step 4. *Fix:* render the sheet as step 4 under the indicator, fold "Where you are" into its header, collapse the guardrail, keep `/loadouts/:id/sheet` as the stand-alone address; or rename the step "Finish". (dark-build-step4-sheet.s01–s03, dark-sheet.s01 · IA, Sheet)

**Hand-offs land on the top of a five-screen form, not on the field (F16).** A symptom's "Raise Precision" links only to the generic Tune picker; Tune's "Update your settings" opens the form top. *Fix:* give fields ids, scroll to `#precision` on mount, add "Adjust Precision for Pulse + shotgun" under "Try this one change". (dark-symptom-jitter.s06, dark-tune-settings.s05 · IA)

**Troubleshoot's symptom picker is nine screens down behind a checklist the returning user has done (F17).** *Fix:* once any check is marked, collapse Stage 1 to its summary card ("2 of 8 done · 1 needs fixing · Show the checks") so Stage 2 starts on screen 1. (dark-troubleshoot.s01/s10 · IA)

**Learn's search is a screen and a half down and the page jumps under the focused field (F19).** The Aim styles cards unmount on the first keystroke. *Fix:* search directly under the lede, aim styles as three chips or below results, nothing above the input changes height. (dark-learn.s02, dark-learn-search.s01 · IA, Interaction)

**"Yours vs target" is drawn three ways and Tune's values are body-size (F20, F37).** Sheet: 1.5rem target, small "Yours"; Tune: both 16 px in a side-by-side list, and aim cards show no target; sheet status is 13.6 px, tags 12 px, quotes 0.95rem muted. *Why:* at 50–60 cm, 13–16 px reads like 9–10 px at a desk. *Fix:* one ValuePair component ("Yours" muted, "Set to" at 1.35–1.5rem/800, danger colour when it differs); status 0.95rem, tags 0.8rem, badge 0.85rem, quotes in `--text`. (dark-sheet.s02, dark-tune-changes.s01/s03 · Hierarchy, Colour/A11y)

**"Official" is on 17 of 19 rows and appears twice per card in two chip styles (F21).** The confidence badge and the grey source-tier tag ("Official (by reference)") overload one word; "by reference" is never defined on screen. *Fix:* render Official as a plain dot + text and reserve pills for the four exceptions; rename tier tags to provenance ("XIM's guide", "XIM forum · public copy") or hide them when they equal the badge. (dark-sheet.s02, dark-build-step2-matrix.s02, dark-tune-changes.s01 · Hierarchy, Copy, Colour/A11y, Sheet)

**The per-Config note is styled as a quotation and repeated on five of seven cards (F22).** "Check this in every Config you use" wears the grey left rule the app uses for verbatim XIM quotes. *Fix:* say it once under the section heading and mark affected cards with a small "Per Config" tag; if it stays on cards, give it a non-quote style. (dark-sheet.s03–s05, dark-troubleshoot.s03 · Copy, Hierarchy)

**At 360 px the sheet's value column breaks (F24).** Long names push the 1.5rem value to a left-aligned second line while short names keep it top-right, so the column the eye runs down jumps card to card. *Fix:* `.sheet-row-head { display:grid; grid-template-columns: minmax(0,1fr) auto }`, word values at 1.1rem, "Differs" tag always on its own line. (narrow-dark-sheet.s02–s03/s05 · Hierarchy, Colour/A11y, Layout, Sheet)

**Tune's primary action does not outrank the reset beside it (F25).** "Update your settings" is secondary; "Start the aim changes again" sits directly under it in the same style; a done card shows a filled primary "Done". *Fix:* make Update primary, move the reset to the section end as a small danger link, keep Done toggles secondary in both states (see F35). (dark-tune-changes.s01–s03 · Hierarchy)

**Research-log provenance leaks into player copy (F27).** A citation note quotes oEmbed data and a YouTube channel id; Sources says "CONCEPT.md §8", "Whitelist", "requires a logged decision". *Fix:* split notes into a one-sentence user note and a hidden provenance field; rename "Whitelist" to "Sources Dialed uses". (dark-symptom-jitter.s05, dark-sources.s01–s02 · Copy)

**Setup-check instructions are 100–130-word paragraphs not tailored to the profile (F29).** An Xbox user reads PC, XInput and DualSense branches although the header says "Showing checks for Xbox". *Fix:* branch on platform/output, lead with the 30-word check, numbered steps over 60 words, platform matrix under "How to fix it". (dark-troubleshoot.s02–s03, dark-build-step2-matrix.s03 · Copy)

**The sheet shows a status on every row but no way to change it (F30).** Fourteen rows say "Not checked yet" while the toggles live only on the step screens, where they are at the bottom of long cards. *Fix:* reuse the 44 px aria-pressed Done/Needs fixing pair in the sheet's meta row; keep the chip only for derived states. (dark-sheet.s02–s05 · Interaction, Sheet)

**"About …" links sit as 20 px targets in the gap above every input (F33).** Seventeen chances to leave a half-filled form on a mis-tap. *Fix:* a 44 px "?" icon in the label row or a chip below the input; collapse duplicates. (dark-tune-settings.s02–s05 · Interaction)

**Progress state is drawn three ways and by colour alone (F35).** Pressed "Done" is the orange CTA style (so it reads "do this next" and a second tap clears it), Done and Needs fixing pressed look identical, forced-colours ignores aria-pressed, and the green Official dot mirrors the green Done dot. *Fix:* one success and one danger token with a glyph (✓ / !) for progress everywhere, tinted-not-filled pressed states, a forced-colours rule, and the mark in the card header. (dark-troubleshoot.s02, dark-sheet.s02, dark-tune-changes.s03 · Colour/A11y, Interaction, Hierarchy)

**The installed app is locked to portrait (F38).** `manifest.orientation: 'portrait'` stops Android rotating; a phone in a landscape stand beside the console is a normal case and WCAG 1.3.4 asks for both. *Fix:* `orientation: 'any'`. (desktop-dark-home-fold · Layout)

**The sheet's first value is a full screen down and "Copy as text" is the page's primary action (F41).** Three stacked buttons and a five-line caveat precede Movement Controls. *Fix:* one row of two small secondary buttons, "Continue building" as a text link, caveat inside the disclosure; Movement Controls visible on screen 1. (dark-sheet.s01, narrow-dark-sheet.s01 · Sheet)

**No "where to enter this" path, and Precision appears twice (F43).** Precision is a sub-value of Smoothing in Manager but a sibling row here. *Fix:* a `managerPath` per setting shown under each section title; nest lever rows under Smoothing. (dark-sheet.s06–s07 · Sheet)

**A second loadout's Tune page analyses nothing and says "Nothing to flag" (C01).** Shared Destiny 2 values count as "entered", so the page opens on "What to change", reports a clean setup and offers Done on "Not entered yet". *Fix:* choose the start tab from Config values alone; one "Nothing entered for this Config yet" card with a primary link to the form; no Done on missing values. (dark-tune-changes-l2-empty.s01–s04 · Critic)

**The Troubleshoot "Destiny 2 settings" check is writable although it is derived from six Build ticks (C02).** Tapping it overrides the six and the counters diverge (2 of 8, 2 of 7, 5 of 19). *Fix:* read-only aggregate: "2 of 6 ticked · 1 differs · Review in Build step 1". (dark-troubleshoot.s04, dark-build-step1-destiny.s03 · Critic)

**Three loadout lists describe a loadout three ways, and the Loadouts tab shows the least (C04).** *Fix:* one LoadoutCard (weapons on one line, aim style as a tag, status line "Sheet 5 of 19 · Settings entered 23 Sep") under 200 px. (dark-loadouts.s01–s02, dark-build-index.s02, dark-tune-index.s01 · Critic)

### P3

- **Profile has no exit and does not say which four fields the build uses (F13).** Tag or group Platform, Output, DPI, polling as "Used by the build"; add "Next: add a loadout" when none exist. (empty-dark-profile.s03–s04 · Onboarding)
- **Install card comes after the setup it should precede; "Got it" means "never show here again" (F14).** One-line iOS notice under the hero on first run; "Not now" in both modes. (empty-dark-home.s02 · Onboarding)
- **Tune's page switcher looks exactly like the radio segmented fields below it (F18).** Style as underlined tabs. (dark-tune-settings.s01 · IA, Interaction)
- **Three labels for "clear my marks" (F26).** "Clear marks" everywhere; move Tune's away from the primary. (dark-tune-changes.s02, dark-troubleshoot.s01 · Copy)
- **"Config" vs "config" differ only by a capital (F28).** "Config" for the Manager object, "sheet" for Dialed's. (dark-build-step4-sheet.s03 · Copy)
- **Tune number fields: no format hints, no Next key, errors flash mid-keystroke (F31, F32).** Placeholders in the game's format, "XIM's list: 0.13" under the six Destiny 2 fields, `enterKeyHint`, validate on blur. (dark-tune-settings.s02–s04 · Interaction)
- **The only aiming source is disabled and dimmed while "selected" (F34).** Keep it enabled and show "Keep at least one aiming source." (dark-profile.s01, light-profile.s01 · Interaction, Colour/A11y)
- **Orange is used for untappable status text (F36).** Reserve the accent for links and selection. (dark-home-fold, dark-sheet.s01 · Colour/A11y)
- **Five-option scale is 13 px with wrapped labels (F39).** Raise the stacking threshold to 24rem. (narrow-dark-profile.s03 · Layout)
- **"Copy as text" should be "Share" on a phone (F42).** `navigator.share` with clipboard fallback. (dark-sheet.s01 · Sheet)
- **Loadout form asks for a name before the weapons and paints three selects red for one error (F44).** Weapons first, name optional and derived, error on the group. (empty-dark-loadout-new-invalid.s01 · Onboarding, Interaction)
- **Not-found page names no address and lights no tab (F46).** (empty-dark-not-found.s01 · Onboarding)
- **Labels disagree: "Learn" tab vs "Explain a concept"; pager "Back" vs "All loadouts" changing sides (F47, F48).** Title the screen "Learn"; label previous with its destination. (dark-learn.s01, dark-build-step3-aim.s08 · IA)
- **Citations are typeset like body text and repeat the source line per quote (F50).** Group by source, number passages. (dark-build-step2-matrix.s06 · Hierarchy, Sheet)
- **Five wordings for the same disclosure (F51).** "Why and source" / "Why it matters" / "How to fix it" only. (dark-sheet.s02–s06 · Copy, Sheet)
- **Gap symptoms say "no answer" three times, then run 11 screens of checklist and a Tune link (F52, C03).** One screen: Gap card plus three "What you can do" links. (dark-symptom-floaty-gap.s01/s11 · Copy, Critic)
- **Voice flips between "we" and "Dialed" (F53).** (dark-term-easing.s01, dark-symptom-hip-ads.s02 · Copy)
- **"Dealt with" does not say what counts as done for "Easing: Lower" (F54).** (dark-build-step3-aim-l2.s02 · Copy)
- **Content ghosts through the 94 %-opaque tab bar (F57).** 97–98 % plus reduced-transparency and no-backdrop fallbacks. (narrow-dark-sheet.s02 · Colour/A11y, Layout)
- **No in-app dark/light override (F58).** "Appearance" in Profile via `data-theme`. (light-home-fold · Colour/A11y)
- **One outline pill does four jobs, and wrapped "Explained:" links leave 44 px blank bands (F59, C07).** Filled square "Main" tag; pills for glossary chips only; chip list for term links. (dark-loadouts.s01, dark-tune-changes.s02 · Colour/A11y, Layout, Critic)
- **"Aim settings" header crams badge and summary side by side at 360 px (F60).** Badge inside the summary. (narrow-dark-sheet.s06 · Layout, Sheet)
- **Desktop gets the phone layout verbatim (F61).** One `min-width: 900px` query: top bar, 640 px column, hover states. (desktop-dark-tune-changes.s01 · Layout)
- **No pressed feedback on buttons (F62).** `:active` states. (dark-build-step2-matrix.s24 · Layout)
- **Delete loadout does not say it also deletes entered settings and marks (C05).** Enumerate them in the dialog. (dark-loadout-edit.s02 · Critic)
- **The eight-screen sheet ends with nothing (C06).** End-of-sheet action row. (dark-sheet.s08 · Critic)
- **Troubleshoot counts marks two ways on one page (C08).** Reuse `progressSummary`. (dark-troubleshoot.s10 · Critic)
- **Term pages list the same setting under "Not to be confused with" and "Related" (C09).** Filter the overlap. (dark-term-easing.s07 · Critic)

## 4. Quick wins (under an hour each)

1. Import `styles.css` first in `main.tsx` and add `@layer base, features` so the Raise/Lower tag and the "Change this first" ring show (F08).
2. Set `orientation: 'any'` in the PWA manifest (F38).
3. Turn `.sheet-row-head` into a two-column grid so values never wrap left at 360 px (F24).
4. Restyle the Tune switcher as underlined tabs, two lines of CSS (F18).
5. Raise the tab bar mix to 97–98 % and add the two fallbacks (F57).
6. Add `:active` pressed states for buttons, choices, segments and tabs (F62).
7. Change the five-option scale's container threshold to 24rem (F39).
8. Standardise disclosure labels to "Why and source" / "Why it matters" / "How to fix it" and unify "Clear marks" (F51, F26).

## 5. Method

The app was reviewed through eight lenses (first run, navigation, visual hierarchy, copy, interaction, colour and accessibility, layout, and the config sheet) plus a completeness pass, each working from the captured screenshots at five viewports and the source. Every finding was then checked independently by two reviewers against the images and the code: 66 findings were kept with the severities shown above and 5 were refuted and dropped, so every item here has been seen on screen or traced to a line.