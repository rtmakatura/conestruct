# #438 production check on 39328fc

Run on 2026-11-04 between 18:00 and 18:25 UTC, against https://www.conestruct.com/sandbox and the live backend.

- healthz: `https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz` returned `{"status":"ok","sha":"39328fc1d445af66e65e1f982f1a1820076cfbfe"}`. That equals main.
- Browser: Playwright Chromium from the main checkout, DPR 2, at 1440x900 and 390x844. axe-core came from the main checkout's `conestruct/site/node_modules/axe-core/axe.min.js`. The gate token was sent from `.env.local` and never printed.
- Script: `script/walk-prod.mjs`, adapted from `../evidence/script/walk.mjs` and `ux-group3-where/prod-check/script/walk-prod.mjs`. The flow is pin 1600 E Colfax Ave, Denver, then westbound East Colfax, then the first side option, then shoulder work, Confirm, One-way and Generate.

## Upstream outage: what was and was not live

1. **Live road detection was down.** Run 1 (`walk-live.json`, `run-live.log`, `live-*-error.png`) used no stubs. All 6 `/api/road-bearing` answers, across both widths and the picker's two Re-detect retries, were `200 {"scan_status":"unavailable","candidates":[]}`. Runs 2 and 3 therefore stubbed **`/api/road-bearing` only**, with #437 branch 3's three-road stub, the one the earlier checks used. Everything else was live: Mapbox geocoding, the render API and the backend.
2. **The backend's corridor scan was down too.** Generate returned "Plan declined", with the corridor scan line `overpass.openstreetmap.fr: 403 Forbidden; overpass-api.de: 502 Bad Gateway · budget 20 s`. That is run 2: `walk-stub-declined.json` and `run-stub-declined.log`. Run 3, the one recorded in `walk.json`, `run.log` and the crops, took the product's own **Generate anyway** button. The scan line from each width is recorded in `walk.json` under `generateAnyway`.
3. With no corridor scan, the plan asks **no NEEDS YOU questions**: `questionsAsked` = 0 at both widths. So there was nothing to answer and no Apply. The plan comes up directly in the N = 0 state, the same strip branch Apply leads to. The "staged" state is the same page, measured again.

## Results

| # | Check | 1440 | 390 |
|---|---|---|---|
| 1 | N = 0 strip: A and P equal the page's counts, no pill | PASS. A = 2 non-question rows ("Site conditions", "Site corridor validation"), P = 2 ("2 not verified yet"); the strip says 2 and 2; pill false. Reached by Generate anyway, **not after Apply** (see above). | PASS, same values |
| 2 | Before Apply: "Answer N quick questions" | NOT CHECKED: no questions were asked (no corridor scan) | NOT CHECKED, same reason |
| 3 | Answered rows "<Topic>: <answer>", including a No | NOT CHECKED: no questions, so no `.nyq-row` and no Yes/No answers. The script answers the first question Yes and every later one No, ready for a re-run | NOT CHECKED, same reason |
| 4 | KEY DISTANCES `.hero-meta .k` matches TOTAL DEVICES `.hero-cell .k` | PASS. Both are `__JetBrains_Mono_5f34dc`, 10px, 1.8px, uppercase, rgb(147,160,176) | PASS, same values |
| 5 | `.ny-prov` is Inter; `.ny-cite` is mono | PASS (`__Inter_176161` / `__JetBrains_Mono_5f34dc`) | PASS, same |
| 6 | Heading outline | PASS for what rendered: h1, then h2 NEEDS YOU, YOUR PLAN, DOWNLOADS, then h3 Plan sheet, Device list, Crew instructions, Audit trail. The question h3 was NOT CHECKED (no question) | PASS, same order. The Downloads h3s render once the "6 files" fold is open |
| 7 | axe | PASS: 0 violations at generated and staged. Applied NOT CHECKED (no Apply) | PASS: 0 at generated and staged. Applied NOT CHECKED |
| 8 | Targets under 44 px in `.results-stack` / `.status-slot` | 6 listed below | none |
| 9 | Download works | PASS: "Download plan sheet PDF" gave `East-Colfax-Avenue_shoulder_2026-11-04_70cd99.pdf`, 1,046,420 bytes, no failure. This was after Generate anyway, not after Apply | PASS: same file, 1,046,439 bytes |

## Strip text (both widths, generated state)

"⚠ Plan ready. 2 items above and 2 under Pending need a check before field use."

## Targets under 44 px (1440)

There are six `button.chip-sum` disclosure rows, each 43.5 px tall and 810 to 844 px wide: "Needs attention 4", "Reference", "Denver hazards", "Work hours: Denver", "Permit: Denver" and "Plan details: device schedule". All are in `.results-stack`, and each is 0.5 px under 44. At 390 there are none. The local walk did not list them; this prod page shows more chips, because the scan did not run.

## Not checked, and why

Checks 2 and 3, the question h3 in check 6, axe in the applied state, and the strip and downloads after Apply could not be checked. All of them need NEEDS YOU questions. The questions come from the corridor scan, and that scan was down upstream for the whole run: Overpass answered 403 or 502. A re-run of `script/walk-prod.mjs` without `STUB` covers them once Overpass answers.

## Files

`walk.json` and `run.log` (run 3); `walk-live.json`, `run-live.log` and `live-*-error.png` (run 1); `walk-stub-declined.json` and `run-stub-declined.log` (run 2); the crops `<w>-generated-*.png`, `<w>-staged-*.png` and `<w>-full-generated.png`; and `script/walk-prod.mjs`.
