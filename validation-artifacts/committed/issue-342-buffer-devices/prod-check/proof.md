# #342 production check of 3eaa9c7

**PASS 2/2.** Run 2026-10-20 against www.conestruct.com through the site proxy. `healthz.txt` shows the backend sha is `3eaa9c7`.

`prodcheck342.py` replays `render342.py`'s two plans. For each plan it checks the audit, the crew narrative, the XLSX device list and page 1. Full output is in `replay.txt`.

| Plan | Buffer cones | Spacing | Audit / XLSX / page 1 total | Page-1 label |
|---|---|---|---|---|
| Flagger 45 mph rural, 500 ft | 3 | 90.0 ft (max 90) | 14 / 14 / 14 | `BUFFER = 360 ft (NTS) · 3 CONES` |
| Near side 25 mph urban, 500 ft | 3 | 38.8 ft (max 50) | 15 / 15 / 15 | `BUFFER = 155 ft (NTS) · 3 CONES` |

Production matches the local after-renders in `../outcome.md`. Page 1 for each plan is saved as `page1-*.png`.
