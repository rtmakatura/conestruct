# #377 production check: 6/6 PASS

Run 2026-10-24 against www.conestruct.com, healthz `280ffad` (`results.json` records it). Script: `check.py` beside this file. It replays the #370 row R1 request (`audit-lane/runs/R1/request.json`: N Broadway at E 11th Ave, Denver, `oneway: "yes"`, `detectedLanesTotal: 5`) and three variants of it through the site's `/api/render/*` proxy.

| Case | Endpoint | Status | Answer |
|---|---|---|---|
| R1 replay (one-way, 5 lanes) | pdf | 400 | one-way refusal, "Road carries two-way traffic" remedy (was the lane-count refusal at `d6d9a14`, `audit-lane/runs/R1/pdf-error.txt`) |
| R1 replay | device-breakdown | 400 | one-way refusal (the StatusBar path) |
| R1 replay | audit | 400 | one-way refusal |
| R1 with `detectedLanesTotal: 1` | pdf | 400 | one-way refusal, not the single-lane one |
| R1 with `oneway` cleared (two-way confirmed), 5 lanes | pdf | 400 | the #86 lane-count refusal, byte-identical |
| R1 with `oneway` and the lane relay cleared | pdf | 200 | the plan renders |

The lane-count message is kept for two-way roads, and a one-way road no longer gets the "one lane in each direction" remedy. No browser check is needed, because only refusal text changes.
