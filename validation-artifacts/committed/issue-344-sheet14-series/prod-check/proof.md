# #344 production check of f3abd5d

Shipped 2026-10-19: SHIP VERIFIED, healthz = `f3abd5d` (`healthz.txt`). The frontend is served at `8ceb810`; its build was skipped because nothing in the site changed.

Replay: `prodcheck344.py` (run from the repo root: `uv run --extra dev python -I <this folder>/prodcheck344.py <repo root> <this folder>`). It posts the recorded `audit-shoulder/runs/i25-r-65-night-3lanes` request (I-25, freeway, divided, 3 lanes, 1,500 ft work) to www.conestruct.com's `/api/render/audit` and `/api/render/pdf`, with its speeds set per case. Full output: `replay.txt`.

| Case | Result | Distances from the taper |
|---|---|---|
| 65 to 60 (Case 26) | PASS | second W21-5aR 530, first W21-5aR 1,320, R2-10 1,580, W20-1 2,640; no W20-2; source "CDOT S-630-1 Sheet 14 Case 26"; 0 validation warnings; page 1 200 with no W20-2 |
| 75 to 65 (Case 27) | PASS | the same distances; source "CDOT S-630-1 Sheet 14 Case 27"; 0 validation warnings |
| 65, no reduction (Case 11 control) | PASS | W5-1 500, second W21-5aR 1,000, first W21-5aR 2,000, W20-1 5,200 (#334, unchanged); source "CDOT S-630-1 Sheet 7 Case 11"; 0 validation warnings |

OVERALL PASS, 3/3.

Run note: the first attempt failed in the script, not on the server. It posted the E-470 run's fields at the top level instead of under `scenario`, and that run's 10.5 ft lanes are refused under #335's 11 ft rule. The replay was moved to #341's I-25 run.
