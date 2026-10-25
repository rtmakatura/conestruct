# Production check of ae38fac (#396, mission site-walkthrough-audit)

Run 2026-10-25 against https://www.conestruct.com. `/healthz` reported `ae38facc9b8957f18214f5c2bfad4eecad1c8bc4` before the run, which equals `origin/main`. The driver was headless Playwright: Chromium at 1440x900, 390x844 and 360x780, and WebKit at 390x844, all at DPR 2. The gate header went on conestruct.com requests only. The run was read-only: no contact form, no signup, no saves.

**Nothing was stubbed.** Road detection was live on every run. `/api/road-bearing` returned 200 eleven times out of eleven and detected East 14th Avenue (way 628643747, one-way, secondary) at `200 E 14th Ave, Denver`. It took about 28 s per call. Before every measure and screenshot the pointer was parked at the bottom-right corner. Picker shots also waited for Mapbox requests to settle.

| # | Check | Result | Measured |
|---|---|---|---|
| 1 | L1 W20: no-location reason | PASS | "Set a location first: use Pick on map to find the site." at 1440 and 390 |
| 2 | L1 W7: decline reason and strip | PASS | One-way plus flagger, live backend 400 on `/api/render/audit`. Reason "Generation declined. The PLAN DECLINED notice says why." at 1440 and 390. Strip "PLAN DECLINED · DETECTION SAW A ONE-WAY STREET. …" visible (1440: 720x33 at y 97; 390: 309x50 at y 82) |
| 3 | L1 W6: jurisdiction row | PASS | "not evaluated: the check didn't answer; the option shown stands" at 1440 and 390, with no "you picked" |
| 4 | L2 W12: ✓ on pressed kind chip and toggle | PASS | Kind chip ::after "\00a0✓": hidden when unpressed, visible when pressed. Label centre is 74.59 px unpressed and 74.59 px pressed (Δ 0.00) at 1440, 390 and 360, and 74.58 to 74.58 in WebKit 390. Toggle "Night" ::before is `none` unpressed and "✓\00a0" absolute when pressed. Label centre Δ 0.00 for Night and Daytime in all four runs. ✓ contrast 5.61 (chip) and 5.19 (toggle) in Chromium, 5.60 and 5.18 in WebKit |
| 5 | L2 W13: WebKit 390 select ink | PASS | Ink rgb(234,240,247) on rendered ground rgb(52,52,52) gives **10.85:1** on all 3 on-screen selects, `color-scheme: dark`. Chromium 13.91:1 |
| 6 | L2 W15: "STEP n OF 4" on one line | PASS | 1 line in all 9 states: step 1 fresh, step 1 located, step 2, each at 1440, 390 and 360. scrollWidth = viewport (1440/1440, 390/390, 360/360) |
| 7 | L2 W21: phone nav wordmark border | PASS | Wordmark border-right 0px at 390, 360 and WebKit 390, with no bordered nav cell. At 1440 the 3 bordered cells (wordmark 0/120, DEMO 120/247, edition 1270/170) are identical to L2's after measurements |
| 8 | L2 hover fold-in | PASS | Pressed chip under the pointer keeps border rgb(52,169,232) (`--act`) in all 4 runs. An unpressed chip under the pointer still lifts: rgb(44,62,83) at rest, rgb(41,64,86) on hover |
| 9 | L3 W14: phone picker | PASS | Dialog equals the viewport with every gap 0 at 390x844, 360x780 and WebKit 390x844, in both the "Detecting road" state and the detected state. "Save & Close" is 1 line and 44 px. The stacking probe found 0 frame hits inside the dialog (frame z 60, picker z 65). Frame-rule pixels through the dialog: 0 of 334 (left line) and 0 of 1400 (top line) at 390; 0 of 406 and 0 of 1280 at 360. At 1440 the dialog is 80,45 1280x810 and Save is 128.66x35.5 on 1 line, both identical to L3's after measurements |
| 10 | Downloads | PASS | Shoulder plan generated in 2.9 s with banner "VERIFIED · 2 PLAN FLAGS". All 6 downloads returned 200: bundle `application/zip` 817,354 B; pdf `application/pdf` 793,347 B; xlsx (spreadsheetml) 6,789 B; crew-pdf `application/pdf` 7,913 B; markdown `text/markdown; charset=utf-8` 6,762 B; audit-pdf `application/pdf` 10,209 B |

**10 PASS, 0 FAIL, 0 N/A.**

## Notes

- The only HTTP error was the expected decline: `400 /api/render/audit`, which is the one-way flagger refusal that checks 2, 3 and 4 rely on. The console also showed a few `ERR_NAME_NOT_RESOLVED` / "Could not resolve hostname" resource failures for a third-party host. Neither affected any check.
- Playwright WebKit is not a real iPhone. iOS Safari is still unchecked (report question 4).
- Check 4 compares the same control unpressed and then pressed on production. The L2 build compared it before and after the change.
- Before comparing with L2's `measurements.json`, its text has to be repaired: it stores "·" double-encoded. `L3/measurements.json` is in the Windows code page. `script/measure.py` handles both.

## Files

- `script/lib.mjs`, `l1_downloads.mjs`, `l2.mjs`, `l3.mjs`: the drivers, reused from L2 and L3 and pointed at production. `script/measure.py` folds the runs into `measurements.json`.
- `measure-l1-downloads.json`, `measure-l2.json`, `measure-l3.json`: the raw runs. `measurements.json` holds the verdict per check, with logs.
- `shots/`: 45 PNGs. The `px-*` shots are the full-viewport frames sampled for ✓ contrast. Downloaded files were kept outside the repo.
