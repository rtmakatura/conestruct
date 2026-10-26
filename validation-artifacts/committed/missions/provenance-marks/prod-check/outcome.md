# #407 production check — main c5c7290

Checked 2026-10-26 ~03:02 UTC on https://www.conestruct.com/sandbox. Backend healthz sha `c5c7290a97ca0af26d85a7d3e08e658d7433e4c7`. Headless Chromium, DPR 2, 1440x900 and 390x844. Read-only (nothing saved, Apply never pressed). Real road detection and site scan; nothing stubbed. The gate token was sent as `x-conestruct-gate` to www.conestruct.com only, and it is never printed or written.

Flow (#397's): Pick on map → `1600 E Colfax Ave, Denver` → "East Colfax Avenue Eastbound" → Save & Close → first side ("South side · eastbound traffic") → Shoulder work → Confirm → step 2 Hours (Daytime is pressed by default). axe ran on the form at that point. Then "Generate plan" (a sandbox render) ran the live site scan. It found 3 conditions, each offering DISMISS (adjacent at-grade intersection, 50 found; pedestrian sidewalks, 38; bike lane, 2). Dismiss on the first condition and choosing "Fenced off" gave the dismiss-reason chip.

Script: `script/check.mjs`. Measurements: `measurements.json`. Contrast = the mark's computed colour against the composited background of each ancestor (the same method as 407/script/shoot.mjs).

**Result: 28 PASS, 0 FAIL, 0 N/A.**

| # | Check | 1440 | 390 |
|---|---|---|---|
| 1 | Side chip: chosen shows ●, no ✓ (span text `● `; control text "● South side · eastbound traffic") | PASS | PASS |
| 2 | Side chip: ● contrast rgb(52,169,232) on rgb(19.6,42.1,60.1) ≥ 4.5 | PASS 5.60 | PASS 5.60 |
| 3 | Side chip screenshot | PASS `1440-side-chip.png` | PASS `390-side-chip.png` |
| 4 | Kind chip (Shoulder work, aria-pressed=true): `::after` content `" ●"`, no ✓ anywhere in the control | PASS | PASS |
| 5 | Kind chip: ● contrast on rgb(19.6,42.1,60.1) | PASS 5.60 | PASS 5.60 |
| 6 | Kind chip screenshot | PASS `1440-kind-chip.png` | PASS `390-kind-chip.png` |
| 7 | Segmented toggle (Hours "Daytime", pressed): `.a-seg-label::before` content `"● "`, no ✓ | PASS | PASS |
| 8 | Segmented: ● contrast on rgb(25.0,48.4,65.5) | PASS 5.16 | PASS 5.16 |
| 9 | Segmented screenshot | PASS `1440-segmented.png` | PASS `390-segmented.png` |
| 10 | Dismiss-reason chip ("Fenced off", chosen): `.reason-glyph` text `●`, no ✓ | PASS | PASS |
| 11 | Dismiss-reason: ● contrast on rgb(21.0,47.7,67.7) | PASS 5.21 | PASS 5.21 |
| 12 | Dismiss-reason screenshot | PASS `1440-reason-chip.png` | PASS `390-reason-chip.png` |
| 13 | No page errors (`pageerror`) over the whole flow | PASS 0 | PASS 0 |
| 14 | axe on the form (wcag2a/2aa/21aa/22aa + best-practice) | PASS 0 violations, 39 passes, 1 incomplete | PASS 0 violations, 39 passes, 1 incomplete |

The production figures match the pre-ship measurements exactly: 5.60 / 5.60 / 5.16 / 5.21. The dismiss chip's 5.21 was measured on a replica before the ship. Here it is measured on the real chip, after a live scan hit.

Notes
- Console errors: 0 in the final run. The failed requests are aborted Mapbox tiles and superseded `/api/render/audit` and `/api/corridor-map` calls (normal cancellation).
- Earlier runs were discarded. The script was still being built (the first runs stopped before Generate), and two problems came from the harness, not the site:
  - One run sent the gate header to every origin. That turned the Clerk and Sentry requests into failing CORS preflights, which raised a "Failed to load Clerk" page error. The fix was to send the header to www.conestruct.com only.
  - In a later run, the 390 pass lost `/api/road-bearing` to a local `net::ERR_NETWORK_CHANGED`. The picker showed "Couldn't reach road-detection service" (`attempt1-390-road-detection-unreachable.png`). The 1440 pass of the same run passed.
  - The final run is the one recorded above.
- Known and not checked here: on the toggle the ● sits lower than on the other three controls (#412). It is visible in `*-segmented.png`. The "✓ default" next to Hours is a provenance mark, not a chosen-option mark (R110 Q8, an open question for Ryan).
