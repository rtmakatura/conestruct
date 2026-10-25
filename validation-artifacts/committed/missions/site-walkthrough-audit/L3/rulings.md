# L3 — the location picker at phone width (mission site-walkthrough-audit, #396, W14)

Branch `mission-swa-l3-picker` off `mission-swa-l2-css` (`68f2321`). Light lane: Tailwind classes in `components/LocationPickerModal.tsx` only (layout), no wire field, API route, middleware, gate, or scenario/audit/pricing logic. W16 (#402, the "WHICH ROAD?" state after a pick) is not touched. `docs/style.md` is not in this checkout; no copy changes here, so its word list doesn't apply.

## Baseline (before the diff)

`cd conestruct/site && npx vitest run --silent`: `Test Files 240 passed | 1 skipped (241)`, `Tests 2553 passed | 1 skipped (2554)`. Green on the first run. No Python touched, so pytest isn't run.

## What the base measures (before the diff; now in `measurements.json` → `before`)

Measured on the base before writing the plan, so the plan fixes what is there:

- **Save & Close** wraps at phone width: 2 lines, 55 px tall at 390 and 360 (3 lines, 74.5 px, while "Detecting road…" shows); 1 line, 35.5 px at 1440. Its `white-space` is `normal`. The footer is one row; the warning text, Cancel and Save share 324 px (390) or 294 px (360).
- **Page text below the modal:** the backdrop pads the dialog by 8 px (`p-2`) on every side below `md`, so the dialog is 374 × 828 at 390 and 344 × 764 at 360, and the page shows through an 8 px band on each edge. All 12 sampled edge points (y = 1, 4, vh−4, vh−1 × x = 1, vw/2, vw−1) land outside the dialog.
- **Road list:** the list is **not** hidden behind the footer. Below `md` the whole dialog body is one scroller (`overflow-y-auto`) that ends at the footer's top edge; every one of the four rows scrolls fully into view above the footer (centre and bottom edge hit the row, row bottom ≤ footer top) at 390, 360 and WebKit 390. What the walkthrough shot shows is the list cut by the scroller's bottom edge at scroll 0, which reads as "behind the footer". The scroller is 636.5 px tall at 390 and 572.5 px at 360; the footer is 80 px (two-line Save) and 99.5 px while detecting.

## Plan

1. **Coverage** `LocationPickerModal.tsx:1501`: backdrop `p-2 md:p-6` → `p-0 md:p-6`. Below `md` the dialog fills the viewport (its `w-full h-full` now resolve to the viewport), so no page text shows around it. Desktop keeps `md:p-6`.
2. **Footer** `:1858`: `flex-wrap md:flex-nowrap`, and `gap-3` → `gap-x-3 gap-y-2`. Below `md` the warning ("Pick a road to continue" / "Detecting road…") takes its own line (`basis-full md:basis-auto` on both status spans, `:1860` and `:1866`), and Cancel and Save sit on the line under it, right-aligned as now. At `md` and up the footer is one row exactly as before (no wrap, the 12 px column gap unchanged; row gap only applies when wrapping).
3. **Save & Close** `:1880`: `whitespace-nowrap`, so the label never breaks even if the button row gets tight.
4. **Road list**: no change to the scroller. It already scrolls every row above the footer; the after measures the same reachability, and the scroller should grow by the 16 px the backdrop padding gave back, less any growth in the footer.
5. **Test** `lib/design/walkthrough-l3-picker.test.ts`: pins the three class changes in the source (backdrop padding, footer wrap and status basis, Save nowrap), red on the base. Evidence: before/after at 1440, 390, 360 and WebKit 390 for the detecting footer, the road list at rest and the road list scrolled to the end; `measurements.json` with the before/after rects.

## Rule 5 churn prediction (written before the diff)

- `components/LocationPickerModal.tsx`: 5 className lines changed (`:1501`, `:1858`, `:1860`, `:1866`, `:1880`) and a comment of about 5 lines added above the footer. No other line.
- New `lib/design/walkthrough-l3-picker.test.ts`: about 50 lines, 3 tests, all red on the base. No existing test changes. Expected full run: `Test Files 241 passed | 1 skipped (242)`, `Tests 2556 passed | 1 skipped (2557)`.
- No new font size (type census) and no new hex (ink literals): only spacing, flex and whitespace utilities.
- Visible changes, stated: below `md` the picker fills the screen with no gap; Save & Close is one line; the footer's warning sits on its own line above the buttons, so the footer in the "pick a road" state grows from 80 px to about 91 px while the scroller gains 16 px from the padding. At `md` and up: nothing moves (measured: dialog, header, footer, Save, Cancel, status and scroller rects at 1440, before vs after).
- Behaviour: none. No handler, state or prop changes.

## Calls (R145 self-ruled)

- **R145-1 (warning placement).** Below `md` the footer's warning goes on its own line above the buttons rather than sharing their row. Sharing the row leaves the warning about 70 px at 360, which puts "Detecting road… Save turns on once detection settles" on about six lines; its own line holds it to two. Cost: the "pick a road" footer is 96 px instead of 80. R145 self-ruled.
- **R145-2 (no border change).** The dialog keeps its 1 px rule border when it fills the phone screen; dropping it below `md` would be a second visual change with no finding behind it. R145 self-ruled.
- **R145-3 (W14's road list).** No change to the list. Measured on the base, every row already scrolls fully above the footer (see "What the base measures"), so the finding's "clipped behind the footer" is the scroller's edge at rest, not an overlap. The fix keeps reachability and the scroller is 18 px taller at 390 (unchanged at 360). Recorded here, not filed: nothing is hidden. R145 self-ruled.

## Amendment before the final diff

The first pass used `gap-x-3 gap-y-2` on the footer. The full run failed `components/LocationPickerModal.spacing.test.ts > every margin/padding/gap token is a scale step` (#166): its token regex reads `gap-x-3` as the off-scale value `x`. Name saved to `failing-tests-first-run.txt` before any re-run. It was a real failure from this diff, not a flake: the footer went back to `gap-3` (12 px row gap when wrapping instead of 8), the guard is untouched, and the same test passes in the next full run. The new test's footer assertion follows (`flex-wrap md:flex-nowrap` with `justify-end gap-3`). Not filed: the guard's misreading of `gap-x-*` only matters if someone uses those classes in this file.

## Actual churn vs prediction

- `components/LocationPickerModal.tsx`: +9 / −6. Five className lines changed (`:1501` backdrop `p-2` → `p-0`; `:1861` footer `flex flex-wrap md:flex-nowrap`; `:1863` and `:1869` status spans `basis-full md:basis-auto`; `:1884` Save `whitespace-nowrap`) and the `{/* Footer */}` comment grew from 1 line to 4. Prediction was 5 lines and a ~5-line comment; the footer's `gap-3` stayed as it was (amendment above).
- New `lib/design/walkthrough-l3-picker.test.ts`: 41 lines, 3 tests (predicted ~50, 3). Red on the base, 3 of 3 (`red-proof.txt`). No existing test changed.
- Full run: `Test Files 241 passed | 1 skipped (242)`, `Tests 2556 passed | 1 skipped (2557)`, as predicted.
- No new font size, no new hex (type census and ink-literals tests are in that green run).

## Measured (`measurements.json`; scripts in `script/`)

Local `next dev` of this worktree, Playwright Chromium and WebKit, DPR 2, pointer parked at the bottom-right corner before every measure and shot. `/api/road-bearing` stubbed with four one-way candidates and held open until the "Detecting road…" footer was measured; geocode and the rest live. `before/` is the base `68f2321` (the worktree before the diff), `after/` this diff, same script. The raw per-run JSON was folded into `measurements.json` by `script/measure.py` and deleted; re-running `shoot.mjs` regenerates it.

| | Save & Close (roads / detecting) | Footer (roads / detecting) | Dialog vs viewport | Edge points outside dialog | Scroller | Every row reachable above footer |
|---|---|---|---|---|---|---|
| 390 before | 55 px, 2 lines / 74.5 px, 3 lines | 80 / 99.5 px | 374 × 828, 8 px gap each side | 12 of 12 | 636.5 px | yes |
| 390 after | 44 px, 1 line / 44 px, 1 line | 96 / 111 px | 390 × 844, 0 gap | 0 of 12 | 654.5 px | yes |
| 360 before | 55 px, 2 lines / 74.5 px, 3 lines | 80 / 99.5 px | 344 × 764, 8 px gap | 12 of 12 | 572.5 px | yes |
| 360 after | 44 px, 1 line / 44 px, 1 line | 96 / 111 px | 360 × 780, 0 gap | 0 of 12 | 572.5 px | yes |
| WebKit 390 before | 55 px, 2 lines / 74.5 px, 3 lines | 80 / 99.5 px | 374 × 828, 8 px gap | 12 of 12 | 636.5 px | yes |
| WebKit 390 after | 44 px, 1 line / 44 px, 1 line | 96 / 111 px | 390 × 844, 0 gap | 0 of 12 | 654.5 px | yes |

- 44 px is the `tap-44` floor; the label is one line in every phone run. The warning is 1 line ("Pick a road to continue") or 2 ("Detecting road…") on its own row.
- `scrollWidth` equals the viewport in every run (no horizontal scroll).
- **Desktop 1440:** every rect (dialog, header, footer, Save, Cancel, status, scroller, the four rows, and the reach positions) in all three states has a delta of **0 px** (`desktop_1440_max_abs_delta_px`: 0). Save is 1 line, 35.5 px, before and after; its computed `white-space` changes `normal` → `nowrap` with no width change. Footer pixels (device-px crop of the footer box): 0 differing in the roads and roads-end shots; 1,644 in the detecting shot, all in the crop's top device-pixel row at x 162–1806, which is the half pixel shared with the map above (footer top is y 793.5) under the map column, where tiles were still loading. The footer's own pixels are unchanged. *(First pass only; superseded by repair cycle 1 below: the footer crop now differs by 0 px, and raising the picker dims the frame at md+.)*
- Errors: no page errors, no HTTP errors ≥ 400, no dev overlay in any run, before or after. The only console error is Mapbox telemetry not resolving (`net::ERR_NAME_NOT_RESOLVED` / WebKit "Could not resolve hostname"), the same before and after.
- **A real iPhone is unchecked**; Playwright WebKit is not iOS Safari (its dynamic toolbar and `100%` heights in particular).

## Screenshots

For each of `1440`, `390`, `360`, `390-webkit`, in `before/` and `after/` (viewport shots):
- `*-w14-picker-detecting.png`: the footer while detection runs (Save wrap, three lines before).
- `*-w14-picker-roads.png`: four roads detected, scroll at rest (the walkthrough's `390-picker-save-wraps.png` state: Save wrap, page band around the dialog).
- `*-w14-picker-roads-end.png`: the dialog body scrolled to the end, every row above the footer.

The dev server is stopped; the copied `.env.local`, the throwaway `.env.development.local` and the token file are deleted. The token was generated for this run and is in no committed file.

## Repair cycle 1 (reviewer FAIL; prediction amended before this diff)

Findings: (1) `.workbench-frame` (`globals.css:1118-1125`, `position: fixed; inset: 8px`, `z-index: var(--z-frame)` = 60) stacks above the picker's `z-50`; with the dialog now edge to edge below `md`, the frame's 1 px rule is drawn 8 px in through the dialog's header, separators and map (#232: frame rules sit in gutters no content reaches). On the base the 8 px backdrop padding kept the dialog inside the frame, so the rule fell in the gap. The edge-point check used `elementFromPoint`, which skips the frame's `pointer-events: none`. (2) `walkthrough/findings.md:28` still says the road list is clipped behind the footer. (3) This file cited `measure-before.json`, which was folded into `measurements.json` and deleted. (4) The shots weren't like-for-like: map tiles and labels still loading, and SEARCH kept hover/focus after its click (WebKit 390 detecting, before).

Amended prediction:
- `app/globals.css`: +1 token `--z-modal: 65;` in the z stack (`:830-833`) with a 3-line comment: the picker sits above the frame (60) and below the working band (70), which keeps the band's existing order over the picker. About +4 lines.
- `components/LocationPickerModal.tsx:1501`: `z-50` → `z-[var(--z-modal)]` (AppNav's pattern, `z-[var(--z-nav)]`). 1 line changed. At 1440 the dialog still sits inside the frame, but the frame now draws under the backdrop: see the stated behaviour change below.
- `lib/design/walkthrough-l3-picker.test.ts`: one more test (the token exists, sits between `--z-frame` and `--z-band`, and the picker reads it), about +12 lines; 4 tests, red on the base. Expected full run: `Tests 2557 passed | 1 skipped (2558)`, 242 files.
- `walkthrough/findings.md:28`: W14's row reworded to the measured finding. 1 line.
- `script/shoot.mjs`: a stacking check (the frame's `pointer-events` is switched on for the probe only, then `elementFromPoint` on the frame's three rules says whether the frame is topmost there) and a pixel check (frame-rule-coloured pixels on the frame's left line inside the dialog header band); waits for Mapbox tile requests to settle before each shot; blurs SEARCH and parks the pointer. All 24 shots retaken.
- This file: the `measure-before.json` citation corrected.

### Repair cycle 1: results

- **R145-4 (frame vs picker), R145 self-ruled.** The picker is raised to a new `--z-modal: 65` instead of the frame being hidden while it is open. Hiding it would need open-state wiring in `GeneratorShell` or a `:has()` rule. 65 sits above the frame (60) and below the working band (70), so the band keeps the order it already had over `z-50`. No other fixed layer sits between 50 and 70: the nav is 40, the strip 30, and PlanRow's `z-50` menu is on `/app`, where there is no frame. No toast layer exists.
- **Churn, actual:** `app/globals.css` +4 at `:831-834` (comment plus `--z-modal: 65;`); `LocationPickerModal.tsx` totals +9 / −6 over the base, unchanged in count, with `:1501` now `z-[var(--z-modal)] ... p-0 md:p-6`. The test file is 51 lines, 4 tests, red 4 of 4 on the base (`red-proof.txt`, regenerated). `walkthrough/findings.md:28`: 1 line. Matches the amended prediction.
- **Frame check (`measurements.json` → `before|after.<tag>.frame`, and `regression_probe`):**
  - Stacking check: the frame's three rules are hit-tested with its pointer events switched on for the probe only.
  - Pixel check: counts rule-coloured device pixels on the frame's left line over the dialog header band, and on its top line across the dialog. A line is counted only where it runs through the dialog's interior.
  - **Probe** (`probe/`, the first-pass fix with the picker still at `z-50`, Chromium 390): the frame is topmost at 6 of 6 probes in every state; 322 of 334 left-line and 1,400 of 1,400 top-line pixels are rule-coloured. Both checks catch the regression.
  - **After:** 0 of 6 probes in every state at 390, 360 and WebKit 390. Rule-coloured pixels: 0 of 334 (390) and 0 of 406 (360) on the left line, 0 of 1,400 and 0 of 1,280 on the top line. Computed z: picker 65, frame 60.
  - **Before** (8 px padding) **and 1440:** the frame's lines run outside the dialog or on its own border, never through it.
- **Like-for-like:** before every measure and shot, SEARCH is blurred, the pointer is parked, and Mapbox tile, style and glyph requests are allowed to settle (none in flight for 1.5 s). Zero were in flight at every shot (`settle`). All 24 before and after shots and the 3 probe shots were retaken. Desktop 1440 footer pixels: 0 differing in all three states; the first pass's 1,644 came from loading map tiles. Every rect delta at 1440 is still 0 px.
- **Stated behaviour change (Rule 5), found by the independent reviewer, missed by this prediction:** at every `md`+ width the workbench frame (60) now sits under the picker's `bg-black/70` backdrop (65), so its 1 px rule is dimmed while the picker is open (at device (16,900) in the 1440 shots: (44,62,83) before, (6,10,15) after). Each 1440 pair has 12,760 frame-coloured device pixels that are dimmed after, re-counted by the orchestrator with Pillow; roads and roads-end differ nowhere else. The detecting pair also has 11,672 other pixels differing by more than 8 per channel inside the dialog, outside the footer crop; they were not traced. The dimmed frame matches how every other page element sits under the backdrop.
- **Other measurements:** unchanged from the first pass (the table above holds).
- **Vitest (one run):** `Test Files 241 passed | 1 skipped (242)`, `Tests 2557 passed | 1 skipped (2558)`.
- **Cleanup:** the dev server is stopped. The env files, the token and the swapped-source copies are deleted. The raw per-run JSON is folded into `measurements.json` and deleted.
