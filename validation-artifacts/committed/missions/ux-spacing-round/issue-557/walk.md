# #557 walk

Run 2026-11-24 against a local dev server of this worktree (`next dev -p 3557`, started in `conestruct/site`), headless Chromium, DPR 1, read-only: nothing saved, nothing downloaded, no sign-in. The backend it called is the deployed one (the site's own API routes). No answer was edited in the browser. The columns check (last section) ran against a local stub backend instead.

- Scripts: `script/shots-557.mjs` (the main walk), `script/probe-hours-row.mjs` (the hours row's sentence and link), `script/shots-557-tap.mjs` (the aerial's tallest state), `script/summary.mjs` (before against after, with the checks). They use item 1's helpers (`../issue-555/script/lib.mjs`) and follow the before set's steps (`validation-artifacts-extra/spacing-round-before/script/shots-page.mjs`: untracked, main checkout, not committed).
- Each script ran twice: on the base (`c7fc482e`, the four source files put back to it) and on the final code. Base readings: `measures-before-<size>.json`, `hours-row-before.json`, `measures-tap-before.json`. Final readings: `measures-<size>.json`, `hours-row-after.json`, `measures-tap.json`. Every comparison below is in `measures-summary.txt` ("all checks ok").
- Sizes: 1440x900, 1198x930 and 390x844. The tap-question probe adds 768x900 and 600x900 (rulings.md S11).
- Setup: open `/sandbox`, "Pick on map", search `1550 E Colfax Ave, Denver`, pick the Colfax row, "Save and close" (setup A); then Shoulder, Next, the first side, Confirm (setup B). The page set Denver itself.
- The base's crops, and the crops of three earlier runs that were replaced, are in `validation-artifacts-extra/ux-spacing-round/issue-557/` (untracked, main checkout, not committed). Nothing here rests on them, except the byte-identical list, which compares against `before/` there.

## Runs that were replaced (kept, not deleted)

- **Run 1, both base and final: thrown out.** The dev server was started from the repo root, so Tailwind found none of the site's files and the page had no utility classes (the screen-reader text showed, the header was unstyled). Moved to `run1-no-tailwind/` in the extra folder. Every reading in this file is from a server started in `conestruct/site`, where the "Default" link measures 42.45 px on the base, as the before set measured on the live site.
- **The first final run at 390: replaced.** Its WHERE section read 882.75 px against the base's 923.25. In that run the road's summary had no cross street ("East Colfax Avenue Eastbound · 1,000 ft · shoulder work"), so it was one line shorter: the live cross-street lookup hadn't answered. The run was repeated and read 923.25. Moved to `run2-390-first-after/`.
- **The final runs before S11's rule was added: replaced** by a run on the final code. Moved to `run3-before-s11/`. The readings were the same.

## Crops

`crops/<name>-<size>.png`. The first five names are the before set's (`validation-artifacts-extra/spacing-round-before/`: untracked, main checkout, not committed).

| Crop | Sizes | What it shows |
|---|---|---|
| `439-where-row-change` | 1440, 1198, 390 | d. The closed Where row. The link reads "Change" in Inter 13.5/600, `--act`, underlined. At 390 it has its own line under the value, centred, as before. |
| `439-aerial-zoom` | 1440, 1198, 390 | e. The aerial's top-right corner after the pin: "Edit on map", then + and − at 44 x 44. At 390 the picture is the 150 px strip, which has no zoom buttons (as on the base); the crop shows "Edit on map" and "Hide map". |
| `534-hours-link-focus-ring` | 1440, 1198, 390 | f. "See Denver's work hours" with the keyboard's ring, the record line under it ("Hours changed to 8:30 am to 3:30 pm. Undo"). At 390 the ring is clear of the sentence above it. |
| `439-edit-change-move-default` | 1440, 1198, 390 | The Edit panel (Road · Change, Work starts · Move, the length). Not changed by this item: see the byte-identical list. |
| `535-night-week-bottom-marks` | 1440, 1198, 390 | The bottom of the week's columns, 8 pm to 5 am, Mon Dec 7 to Sun Dec 13. No `▾`; the bars run to 5 am. |
| `535-night-week` | 1440, 1198, 390 | The same window, whole. |
| `557-where-row-change-focus` | 1440, 1198, 390 | d. The same row with the ring on "Change". |
| `557-what-row-change` | 1440, 1198, 390 | d (S2). Where reopened with "Change": the closed "What's the job?" row carries the same link. |
| `557-aerial-frame` | 1440, 1198, 390 | e. The whole frame after the pin. |
| `557-aerial-frame-reset` | 1440, 1198 | e. After one "Zoom in": Reset joins the stack, 44 px tall. (At 390 the strip has no zoom.) |
| `557-aerial-tap-reset` | 1440, 1198, 768, 600, 390 | e (S11). The tap question (kind "near an intersection", Next) after one "Zoom in": the bar, "Edit on map", the zoom with Reset, "Use the big map instead". A column at 1440, 1198 and 390; a row at 768 and 600. |
| `557-default-links` | 1440, 1198, 390 | g. The three cells with a "Default" source line: Type of work, Work hours, Speed reduction. |
| `557-default-link-focus` | 1440, 1198, 390 | g. The first of them with the ring: the box is 46.45 x 44. The ring's top edge sits on the label above it, as on the base (see "Seen in the walk"). |

**Byte-identical crops.**

- Against the base's crop of the same name (`before/` in the extra folder: untracked, main checkout, not committed): `439-edit-change-move-default` and `535-night-week` and `535-night-week-bottom-marks`, each at all three sizes (9 files). So the work-hours window draws the same pixels with the arrows' code gone.
- Between sizes, in this folder: the 1198 and 1440 files are the same bytes for `439-aerial-zoom`, `439-edit-change-move-default`, `439-where-row-change`, `534-hours-link-focus-ring`, `535-night-week`, `535-night-week-bottom-marks`, `557-aerial-tap-reset`, `557-default-link-focus`, `557-what-row-change` and `557-where-row-change-focus` (10 pairs; the tool column is 880 px wide at both).
- Not compared: these crops against #555's or #556's. #556 changed the window after #555's crops, and #556's walk has no 8 pm to 5 am state with a street class set.

## Measurements (`measures-summary.txt`)

"Before" is the base, "after" the final code. Positions are in CSS px.

**d. The collapsed rows' link** (both rows read the same at each size)

| | 1440 and 1198 | 390 |
|---|---|---|
| Text | "CHANGE" to "Change" (also the accessible name) | the same |
| Type | JetBrains Mono 9.5/400, uppercase, tracked 1.33 px, to Inter 13.5/600, no transform, no tracking | the same |
| Colour | `rgb(52, 169, 232)` = `--act` (`#34a9e8`), before and after | the same |
| Line under it | a 1 px bottom border, to a text underline | the same |
| Link box | 42.19 x 32 to 58.66 x 44 | 298 x 44, unchanged |
| Row height | 58 to 58 | 140.63 to 140.63 |
| Label's top in the row | 18.38 to 20.88 (2.5 px lower) | 13 to 13 |
| Value's top; left | 17.38 to 19.88; 16.47 px further left | 38.5 to 38.5; unchanged |

The 2.5 px: the row's words line up on the link's baseline, and a 13.5 px word in a 44 px box sits lower than a 9.5 px word in a 32 px box. The prediction said "up to 2 px". After, the label's line (17.5 px tall, from 20.88) is centred in the 58 px row to within 0.63 px; before it sat 1.87 px high.

**e. The small aerial's zoom**

- 1440 and 1198, pinned: + and − 32 x 32 to 44 x 44. + stays at the same top (61 px from the frame's top); its left edge moves 12 px left; − moves 12 px down. Reset 51.61 x 32 to 51.61 x 44, 24 px lower. Frame 411 x 655 before and after; the WHERE section 793.25 px before and after, with and without Reset.
- "Edit on map", the logo, the attribution and the key are where they were in every reading at 1198 and 390, and in three of four at 1440. The fourth (1440, Where reopened) is **not compared**: in the base run the picture was still loading (its "held" line was up, with no zoom and no key), so the two runs show different things.
- Overlaps between any two controls or lines on the frame, in every reading (pinned, zoomed in, Edit panel open, Where reopened; 11 readings over the three sizes): 0.
- 390: the strip shows no zoom (before and after). With Where reopened the frame is 250 px and the buttons are 44 x 44 at the same place before and after. The key sits under the frame at this width, before and after (the summary's "past the frame's edge").
- The tap question, with Reset (`measures-tap.json`; base in `measures-tap-before.json` for 768 and 600):

  | Size | Frame | Zoom | Overlaps |
  |---|---|---|---|
  | 1440, 1198 | 411 x 655 | a column: + at 105, − at 153, Reset 201 to 245; "Use the big map instead" from 559 | 0 |
  | 768 | 706 x 300 | a row at 105 to 149: +, −, Reset; the big-map button from 220 | 0 (base: a 32 px column, Reset to 209, 0) |
  | 600 | 538 x 300 | the same row | 0 (base: the same column, 0) |
  | 390 | 328 x 250 | a column on the left: 73, 121, Reset 169 to 213; the logo from 222 | 0 |

  The 390 layout is the base's (its buttons were already 44 px); it was not walked on the base in this state.
- **200% text and the bar's other states** (found, failed, none found): not measured by these scripts. The columns check below covers them against Mapbox's marks, in two columns: 0 overlaps. Against "Edit on map" and the big-map button they are **not measured** at 200% text; at 100% the tap question's reading above stands for the bar's other states only by layout (the stack starts at the same 104 px in each).

**f. The hours link**

| | 1440 and 1198 | 390 |
|---|---|---|
| Link | beside the sentence | wraps under the sentence |
| Link's top in the row | 4 to 12 | 21.5 to 29.5 |
| Ring's top edge to the sentence's ink | not under the sentence | -2.5 (it crossed) to 5.5 px clear |
| Ring's top edge to the text above the row (with the record showing) | 12.75 to 20.75 | 30.25 to 38.25 |
| Sentence and link, ink tops apart | -0.37 to -1 (0.63 px, baseline for centre) | on two lines |
| Hours row | 100 to 108 | 117.5 to 125.5 |
| The same in its three states (outside, record showing, after Undo) | 108, 108, 108 | 125.5, 125.5, 125.5 |
| Work dates cell | 106 px: unchanged, same place | 173.5 px: unchanged, same place |
| What section | 971.75 to 979.75 | 1602.75 to 1610.75 |

The link is 171.61 x 44 before and after. The ring is `2px solid`, offset 2 px.

**g. The "Default" links**

- Each of the three: 42.45 x 44 to 46.45 x 44 (padding 2 px each side, margin -2 px each side). The box's left edge moves 2 px left; the word doesn't move (0, 0 px). Inter 12.5 px.
- Every box read in the What section (cells, labels, source words, controls, rows: 35 at each size): 32 are in the same place and the same size (0 px on every side); the hours row is 8 px taller with its top unchanged (f); the 2 under it are 8 px lower and the same size. Nothing else moved.

**The week columns**

- 8 pm to 5 am, whole week and weekday view, all three sizes: 0 arrow characters in the window's text, 0 `.whd-clip` elements, 7 "your hours" bars, columns 240 px, window 560 x 600 (358 x 640 at 390), as on the base.

## Checks

- **axe.** Run at each size on the WHERE section after the pin, the What section (first show, and with the record showing), the work-hours window (week and weekday, night shift), and the whole tool page with Where reopened: 18 readings, 0 violations.
- **44 px.** Controls under 44 px on either side, in the same five places at each size:
  - Before: the two zoom buttons (32 x 32, at 1440 and 1198), the three "Default" links (42.45 x 44, all sizes), "CHANGE" (42.19 x 32, at 1440 and 1198).
  - After: 0.
  - Left out, unchanged: Mapbox's logo and attribution links (#505's exception), and the page's own header and footer links ("conestruct.", "Terms", "Privacy"), which are outside the tool's sections and outside this item.
- **Inter only, group 1's sizes.** The changed text controls compute to Inter at 13.5 px ("Change") and 12.5 px ("Default"). Reset is not Inter: it stays `tr-prov` mono, as on the base (`conestruct/site/components/bands/BandAerial.tsx:727`), because ruling e names the buttons' size only; this item changes its height and nothing else. The diff adds no font-size rule and removes one (`.whd-clip`'s); `lib/design/type-exceptions.ts` loses that row and its count goes from 236 to 235. The type census test is in "Tests".
- **Tokens only, no new hex.** The diff adds no colour.
- **Rows and columns (#469, #490).** The fact rows, the Work dates row and the WHERE section are the same height before and after; the hours row is 8 px taller than on the base (100 to 108 px; 117.5 to 125.5 at 390), which is the ruled space, and the same height in each of its states. The columns check is below: it is red on the base and the same red with this item.

## The columns check (`scripts/verify-columns-end-together.mjs`)

**Run, on the final code and on the base. Both end in `RESULT FAIL`, with the same 20 FAIL lines at each size. This item changes none of them.**

- Setup, as #517 and #526 ran it: the stub backend (`scripts/verify-generate-cls-stub.py` on :8000, this worktree's `src`, Overpass replayed from the two committed fixture folders and a copy of #517's recorded backend fixture, never live) and this worktree's site on :3000 (`next dev`, started by #517's `walk-script/launch-site.cjs` with `MODAL_RENDER_URL` on the stub and its Overpass preload on a copy of #517's site fixture). The copies were made in the session's scratch folder so that nothing was written into #517's extra folder. Secrets and the gate token were read raw from `conestruct/site/.env.local` and never printed.
- The check ran with its defaults: 1024x768, 1198x930 and 1440x900, text at 100% and 200%, every phase. To save time it ran as three processes at once, one size each. 390x844 is not in the script's default sizes and was **not run**.
- Results: `columns-check-final.txt` (the final code) and `columns-check-base.txt` (the base, the four source files put back to `c7fc482e`). Each holds every FAIL line and the script's own "Layouts checked" block, per size. The full logs are in `columns-check-logs/` in the extra folder (untracked, main checkout, not committed). So "the same FAIL lines" can be checked from the two committed files only: their FAIL lines and their "Layouts checked" blocks. The PASS lines are in the untracked logs and are given here as counts.

What the final run read, at each of the three sizes:

- WHERE section, aerial against the right column: 32 states x 2 text zooms, largest difference 0 px.
- Controls and lines on the aerial frame against Mapbox's logo and attribution: 64 readings, 0 overlaps. This covers the zoom stack at 200% text and in the bar's found, failed and none-found states, in two columns.
- Text past the WHERE section's bottom: 0 in 64 readings.
- Hours row (#526's reserve): before the fix 108, with the record 108, after Undo 108 px, at 100% and 200%. On the base: 100, 100, 100.
- Work dates row at 100%: 106 px in all ten states.
- Work-hours window: 560 x 600 in both views, Esc closes, focus returns to the link.
- What section, 21 states x 2 zooms: controls under 44 px in 0 readings; axe violations in 0 readings.
- Your plan's columns and the Downloads cards: 0 px.
- 105 PASS lines and 20 FAIL lines.

The 20 FAIL lines, the same on the base and the final code at every size:

- 2 at 100%: "WHAT open … last buttons" 32.25 px (`cell-reduction`, `cell-work-dates`) and 14.75 px (`cell-lane-width`, `cell-carriageway`). The same rows' boxes end together (0 px).
- 2 at 200%: the same two rows, 41 px and 21.5 px.
- 15 at 200%: What states from `dates-none` on, "measured content 19.5 px" (`cell-lane-width`, `cell-carriageway`).
- 1 at 200%: the Work dates row reads 211, 176 and 141 px across its states (70 px apart).

With the section's height and the hours row's three numbers masked, the two result files are the same, line for line. The only differences are this item's: the hours row is 100 px on the base and 108 px now, and the What section is 8 px taller in the 200% states' lines. Filed, for the check itself: https://github.com/rtmakatura/conestruct/issues/563.

Two shorter runs came first and are in the same logs folder: the WHERE states alone at 1440x900 and 100% on the final code and on the base (23 states PASS in each, and the same two "last buttons" lines), and a full run on the final code that was stopped early for being too slow as one process.

## Tests

Run in `conestruct/site` on the final code, one run at a time. The full vitest and pytest suites were not run locally (CI runs them).

- Baseline, before any edit: 20 files, 288 passed (the same 20 files as the next line).
- Red proof, tests first on the base: 7 failed, 90 passed (97), 5 files (`red-proof.md`, `red-output.txt`). That run was before S11's test existed.
- Final: 20 files, 297 passed (297): `components/WorkHoursDialog.test.tsx`, `components/BandStack.single-voice.test.tsx`, `components/GeneratorSidebar.prepin-gating.test.tsx`, `components/tap-targets.test.ts`, `components/GeneratorShell.hit-targets.test.tsx`, `components/bands/BandAerial.test.tsx`, `components/WhatBand.step2-layout.test.tsx`, `components/WhatBand.density.test.tsx`, `components/controls-fidelity.test.tsx`, `components/GeneratorShell.class-stability.test.tsx`, the 9 files in `lib/design/` (the type census and the type roles among them) and `lib/scenarios/band-facts.test.ts`. 9 tests are new: 5 in `tap-targets.test.ts`, 3 in `WorkHoursDialog.test.tsx`, 1 in `band-facts.test.ts`.
- Also run, because they read the source line or press the fact link: `components/WhatBand.detection.test.tsx`, `components/WhatBand.every-kind.test.tsx`, `components/WhatBand.speed-guess.test.tsx`, `components/BandStack.one-open.test.tsx`, `components/GeneratorShell.kind-confirm.test.tsx`: 5 files, 28 passed (28).
- `npx tsc --noEmit`: exit 0, no output.
- Which tests are mounted and which read source text: the table in `red-proof.md`. S11's test (added after that table's run) reads `app/globals.css` as text.

## Seen in the walk, not changed by this item

- A source line's focus ring crosses the label above it ("Default" under "Type of work": the ring's top edge is 4 px inside the label's line). It is the same on the base. Filed: https://github.com/rtmakatura/conestruct/issues/562.
