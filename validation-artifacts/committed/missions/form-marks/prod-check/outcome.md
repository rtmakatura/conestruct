# #412 production check (mission form-marks, tracking #413)

- Served sha checked: `5b5144a5810bbf46a31f7df4fae6283357654398`: the frontend build sha in the chunks of https://www.conestruct.com/, and the backend `/healthz` sha. The worktree HEAD is the same commit.
- Checked on 2026-10-26 against https://www.conestruct.com/sandbox, headless Chromium, DPR 2, at 1440x900 and 390x844.
- Real interaction throughout. The pin is a real address search for "1600 E Colfax Ave, Denver" with the live road lookup (no stub): the Colfax road, the side chip "South side · eastbound traffic", the kind chip "Shoulder work", Confirm, then the toggle's chosen "Daytime". For the dismiss-reason chip, Generate ran a real site scan with 3 detected rows (Dismiss buttons). I opened the first row's Dismiss and chose the first reason, "Fenced off". Nothing was injected.
- Method: the same as `../412/measurements.json`. The offset is the ink-weighted centre of the ● minus the middle of the label's x-height band (the cap-height band on the all-caps dismiss chip), in CSS px; + means the mark sits lower. PASS needs |offset| <= 0.5 px (CHOSEN tolerance, as #412) and contrast >= 4.5:1. The script is `prodcheck412.mjs`; it reads the gate token at run time and never writes it.

| Control | Width | Label | Offset (px) | Contrast | Result |
|---|---|---|---|---|---|
| Side chip | 1440 | South side · eastbound traffic | -0.36 | 5.60:1 | PASS |
| Kind chip | 1440 | Shoulder work | -0.35 | 5.60:1 | PASS |
| Segmented toggle | 1440 | Daytime | -0.35 | 5.16:1 | PASS |
| Dismiss-reason chip | 1440 | Fenced off | -0.12 | 5.21:1 | PASS |
| Side chip | 390 | South side · eastbound traffic | -0.36 | 5.60:1 | PASS |
| Kind chip | 390 | Shoulder work | -0.35 | 5.60:1 | PASS |
| Segmented toggle | 390 | Daytime | -0.36 | 5.16:1 | PASS |
| Dismiss-reason chip | 390 | Fenced off | -0.12 | 5.21:1 | PASS |

**Counts: 8 PASS, 0 FAIL, 0 N/A.**

The live offsets match the after-fix figures recorded in #412: side −0.36, kind −0.35, toggle −0.35/−0.36, dismiss −0.12; contrast 5.60, 5.60, 5.16, 5.21:1. The live side chip reads "South side · eastbound traffic", but in #412 the stubbed road gave "East side · traffic heads north"; the offset is the same.

Shots: `prod-<width>-<control>.png` (side-chip, kind-chip, segmented, reason-chip), 8 files. Raw numbers: `measurements.json`.
