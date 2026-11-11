# #517 walk: the What section

Walked 2026-11-11 on `issue-517-what-section` (uncommitted work on `7a77005`). Setup: local site and stub backend, Overpass replayed, Chromium via Playwright, DPR 1, Inter loaded. Sizes: 1440x900, 1198x930 and 390x844. Scripts are in `walk-script/`, adapted from group 8's: `servers.ps1` starts the site and backend, and `run.ps1 walk517.mjs <worktree> <crops> <extra>` runs the walk. `run.ps1` reads the gate token from `.env.local` and never prints it.

The final run is after the three walk fixes in rulings.md § Walk findings. The first run's crops were moved, not deleted, to `validation-artifacts-extra/ux-group7-what-section/issue-517/pre-fix-committed-crops/`. One crop, `hours-all-open-1440`, was taken while the ✓-glyph fix was still landing. It was re-walked (1440, Colfax flow), and the superseded copy moved to `.../superseded-committed/`.

## States (crops `crops/w517-<state>-<size>.png`, 15 states x 3 sizes = 45)

| State | What it shows |
|---|---|
| guesses-3 | E Colfax: "Check our 3 guesses". Box rows: road type, street class, jurisdiction, each with its reason. |
| guesses-1 | Pin-only plan: "We filled in what we could from your pin. Check our 1 guess…" and "Check this guess". |
| guesses-0 | All three checked, then the pin moved to N Lincoln St: the intro drops its second clause, and no box shows. |
| guess-checked | Street class Arterial → Collector: the row reads "✓ Checked". Box row tops stay 407.5 / 490 / 572.5 at 1440 and 1198, and 523.38 / 655.88 / 788.38 at 390, before and after. 0 px moved. |
| measured-closed / measured-open | "30 mph · 2 lanes each way · Divided", then "Not from the map: 12 ft lanes" (round 3, #521), with Change, then the panel open (Done). |
| tip-measured / tip-guess | A why tip open for a measured field and for a guess. |
| dropdown-jurisdiction | The shared listbox open, the selected option on `--pri-off` with ✓. |
| dates-unset | "Pick start and end dates", and "Optional. We check them against Denver's work hours." |
| dates-inside | Mon Nov 16 to Fri Nov 20, 9:00 AM to 3:00 PM: "✓ fits your dates". |
| dates-outside | 7:00 AM to 5:00 PM: "⚠ 3 h outside the permitted … windows" (`windowsSummary`'s words). |
| hours-all-open | "See all of Denver's work hours" opens #227's table, headed "Denver's work hours". |
| files-closed / files-open | "File details (optional)" with Show, then the two inputs with Hide. |

Also measured, with no committed crop (the extras are in `validation-artifacts-extra/.../walk-final/`): dates-picker-open, dates-set-no-times, all-checked.

## Results (every state, every size)

- axe on `[data-testid=band-what]`: 0 violations in all 54 readings (18 states x 3 sizes).
- 44 px: 0 controls under 44 px. The readings covered list options, day buttons, inputs, time lists and source-line buttons.
- Mono or caps in the section: 0 after the fixes. The band's shared step head ("STEP 2 OF 4", "WHAT") stays mono, as on every band (ruling 8).
- Columns: every two-column grid in the section (About the work, the measured panel, File details) ends together, 0 px. **Withdrawn in round 3 (#520):** this reading measured the stretched column boxes, which always agree; measured where the content ends, the round-2 layout was 89 to 159 px apart (`red-proof-520.txt`).
- No element past the band's edge, and no horizontal page scroll (`scrollWidth` equals the viewport width).
- Network: 0 4xx/5xx responses and 0 page errors in every flow.

## Permanent check

`scripts/verify-columns-end-together.mjs` has a new `what` phase. It walks 10 What states and checks, in each one, that the grids end together, that no control is under 44 px, and that axe finds 0 violations. A guess check FAILs if any box row moves. Its WHERE phases are unchanged.

- Run with `ONLY=what`, `SIZES=1024x768,1198x930,1440x900,390x844`, `ZOOMS=1`: 40 readings, grids max 0 px, 0 controls under 44 px, 0 axe violations. **RESULT PASS.**
- Before the fixes it FAILed, on the listbox's axe rule only. At that point the reopened WHERE read band 793.25, #469's base.
- Not run at 200% text in this session.

## Round 1 notes

**Why the 1198 crops are byte-identical to the 1440 ones (reviewer finding 8).** The walk really ran at 1198. Each Playwright context is opened with `viewport: { width: w, height: h }` from `SIZES` (`walk-script/walk517.mjs`, `setup`). The page's own reading of `innerWidth` is in every state's record (`walk-final/walk517-*.json`, `cols.vw`): 1440, 1198 and 390. `documentElement.scrollWidth` matches each one.

The band is a fixed-width centered column, so the crop of the band is the same at both widths. In guesses-3, the About-the-work grid sits at left 297 → right 1143 at 1440, and at left 176 → right 1022 at 1198. That is the same 846 px width, shifted 121 px, which is exactly half the 242 px narrower viewport. The crops are element-scoped to `[data-testid=band-what]`, so the 930 vs 900 viewport height does not enter them.

`innerHeight` and the band's own box were added to the walk's record (`vh`, `bandBox`) in round 1 and are captured by the round 1 re-walk below.

## Round 1 re-walk (after the repairs)

Re-walked 2026-11-11 on the uncommitted round 1 repairs, same setup (`walk-script/servers.ps1 start`, then `walk-all.ps1` one size per process, each size running the colfax, pin and zero flows). All 45 committed crops were recaptured. The pre-repair crops were moved, not deleted, to `validation-artifacts-extra/ux-group7-what-section/issue-517/pre-repair/`. The records are in `validation-artifacts-extra/.../walk-run/extra-states/walk517-*.json`.

| Size | `innerWidth` x `innerHeight` | Band box (left, width) | `scrollWidth` |
|---|---|---|---|
| 1440x900 | 1440 x 900 | 280, 880 | 1440 |
| 1198x930 | 1198 x 930 | 159, 880 | 1198 |
| 390x844 | 390 x 844 | 14, 362 | 390 |

Readings, 18 states x 3 sizes = 54:
- axe on the band: 0 violations in all 54.
- 44 px: 0 controls under 44 px in all 54.
- Mono or caps in the section body: 0. The band head ("STEP 2 OF 4", "WHAT") is mono in every state, as ruled (ruling 8).
- Two-column grids: 44 readings at 1440 and 1198, max 0 px. No element past the band's edge, `scrollWidth` equals `innerWidth` in every state.
- Guess check: box rows at 407.5 / 490 / 572.5 (1440, 1198) and 523.38 / 655.88 / 788.38 (390), 0 px moved.
- Network: 0 4xx/5xx and 0 page errors in all nine flows.

The repairs show in the new crops: measured-open has a Lane width row with its own "Default" source line under Lanes; guesses-1 (pin-only) opens a row titled "About the road", with a Road type row ("Default"); tip-guess's road type tip has no "Divided" line.

**The 1440 and 1198 crops are still byte-identical (all 15 states).** The band is the same 880 px column at both widths (left 280 at 1440, left 159 at 1198: 121 px, half the 242 px difference), and the crop is element-scoped to the band, so the 900 vs 930 viewport height does not enter it. `innerWidth` reads 1440 and 1198, so the resize happened.

Permanent check, `ONLY=what SIZES=1024x768,1198x930,1440x900,390x844 ZOOMS=1`, against the local site: 10 What states at each size, each PASS (1024, 1198, 1440: about, measured and files grids 0 px; 390: one column), 0 controls under 44 px, 0 axe violations. The reopened WHERE band at 1198 and 1440: 0 px. **RESULT PASS.**

## Round 3 (#520, #521 folded in; Ryan, 2026-11-11)

Built on `mission-ux7-prod-check` `42f825d` (the uncommitted work fast-forwarded onto it from `7a77005`; WhereBand.tsx and corridor-geometry.ts, the only code files between them, are not touched here). Same setup: `walk-script/servers.ps1 start`, then `walk-all.ps1` with the colfax, pin and zero flows at 1440x900, 1198x930 and 390x844. All 45 committed crops were recaptured. The round-2 crops were copied, not deleted, to `validation-artifacts-extra/ux-group7-what-section/issue-517/round2-superseded-committed/`.

**The columns check, fixed first (#520).** `readWhat` now reads where each column's content ends (rulings.md S24a). Against the round-2 layout at 1440 it FAILs every What state: About the work 139 px (89.5 with dates set, 134.25 with the hours table open), the measured panel 159 px (`red-proof-520.txt`).

**The layout (S24).** One grid of cells per section, two to a row, the last row's content at the bottom of its cells. Permanent check after the change, `ONLY=what SIZES=1024x768,1198x930,1440x900,390x844 ZOOMS=1`, local site: 10 What states x 4 sizes, 40 readings. About the work, the measured panel and File details: content 0 px and boxes 0 px in every two-column reading (1024, 1198, 1440); 390 is one column. 0 controls under 44 px, 0 axe violations. The reopened WHERE band at 1024, 1198 and 1440: band 793.25, frame↔last 0 px, column↔column 0 px (unchanged). **RESULT PASS** (`cols-round3.txt`). Its last cells: Speed reduction / Work dates with no dates, Start time / End time with dates; in the measured panel Lane width / Carriageway.

**The walk, 18 states x 3 sizes = 54 readings:** axe 0 in all 54; 0 controls under 44 px; mono or caps in the section 0 (the band head stays mono, ruling 8); the guess check's box rows at 407.5 / 490 / 572.5 (1440, 1198) and 523.38 / 655.88 / 788.38 (390), before and after, 0 px moved; 0 4xx/5xx and 0 page errors in all nine flows.

**#521 in the crops.**
- `guesses-0`: on the one-way N Lincoln St the closed row reads "30 mph · 4 lanes · One-way", then "Not from the map: 11 ft lanes · Urban street · Arterial street · Denver". The first line is built only from the fields whose source line is "Measured from the map" (WhatBand.tsx, `measured`), and `WhatBand.guesses-first.test.tsx` § #521 checks the line against the open panel's measured sources. No line says "each way".
- `dates-inside`: Start time and End time each read "Set by you" under their labels.
- `measured-closed`: E Colfax reads "30 mph · 2 lanes each way · Divided" with "Not from the map: 12 ft lanes" under it. (In the columns check's own run, where the carriageway is left undecided, it reads "30 mph · 2 lanes each way" and "Not from the map: 12 ft lanes · Carriageway not set".)
