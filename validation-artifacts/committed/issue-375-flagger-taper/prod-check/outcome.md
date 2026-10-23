# #375 production check: 3/3 PASS

Shipped `2b6c23b` (healthz `2b6c23b2542250858055cce6ce125c6c8e1a22f1`, recorded in `results.json`). `check.py` ran 2026-10-23T18:03:08Z through www.conestruct.com's `/api/render/*` proxy. It replayed the audit lane's own requests (`audit-lane/runs/<id>/request.json`) and changed only `workLen`. No scan token was read or written (#371). Raw output: `results.json`.

| Row | Request | Production answer | Verdict |
|---|---|---|---|
| F17 (the #375 acceptance) | flagger, Ogden St, 25 mph, 50 ft | audit 400 and PDF 400, `geometry_validation_failed`, message "Work zone length (50 ft) is shorter than the 100 ft one-lane, two-way taper this flagger plan draws. Increase the work zone to at least 100 ft." on both, and on the `WORK_ZONE_SHORTER_THAN_TAPER` violation (`mutcd_section` still "6B.08") | PASS |
| F17 at 100 ft | the same request, `workLen` 100 | audit 200: the limit didn't move | PASS |
| N1 at 100 ft (near-intersection control) | `workLen` 100, 30 mph | audit 400, "Work zone length (100 ft) is shorter than the required merging taper (L) of 180 ft at 30 mph. Increase the work zone to at least 180 ft, or reduce the speed limit." The old wording is unchanged. | PASS |

Before the fix, F17's answer was "…shorter than the required merging taper (L) of 100 ft at 25 mph. Increase the work zone to at least 100 ft, or reduce the speed limit." (`audit-lane/runs/F17/pdf-error.txt`).

No browser check needed: this is message text only, and the site shows the backend's message as-is.
