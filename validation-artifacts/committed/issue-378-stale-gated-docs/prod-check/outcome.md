# #378 production check: 5/5 PASS

Run 2026-10-24 against www.conestruct.com (`/api/render/*`), healthz sha `777e3e7`. Script: `check.py`; raw rows: `results.json`.

| Case | Endpoint | Status | Result |
|---|---|---|---|
| #370 R6 replay (S Colorado Blvd at E Exposition Ave, `divided: true`) | audit | 400 | PASS: the new refusal text, and no "aren't supported" |
| same | pdf | 400 | PASS: the same |
| R6 with `divided: false`, carriageway facts as sent | audit | 200 | PASS: #312's divided words (median) in the audit |
| same | pdf | 200 | PASS |
| R6 with `divided: false`, `carriageway: {"confirmed": "divided"}` | audit | 200 | PASS: median in the audit |

The refusal as served:

> divided must be false on a near-intersection plan. For a divided road, send the road's carriageway facts in carriageway, as /sandbox does, or set carriageway.confirmed to "divided". The plan is then built for the one carriageway the work is on.

**Status code.** The first run expected 422, which is the backend's status under TestClient. Production's proxy answers it as 400, and R6 recorded 400 before the fix (`audit-lane/runs/R6/audit.json`), so the status is unchanged. The check was corrected to 400 and re-run. The first run's three 200 rows passed; its two 400 rows failed only on that expectation, and their text was already the new text.

No browser check needed: no visible design change (R145).
