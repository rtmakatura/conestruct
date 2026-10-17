# #337 Rule 5 prediction (written before the diff)

| Surface | Plan | Change |
|---|---|---|
| Crew sheet MD (`/render/markdown`) | divided shoulder | the one Safety Notes Note 8 line changes wording |
| Crew sheet PDF (`/render/crew-pdf`) | divided shoulder | same line, same wording |
| Crew sheet MD/PDF | divided work-beyond-shoulder (gated) | same line (S2) |
| Crew sheet MD/PDF | divided lane closure | byte-identical |
| Crew sheet MD/PDF | undivided, one-way, near intersection, flagger, mobile | byte-identical (`is_divided` false) |
| Audit JSON/PDF, page 1, XLSX, quote, breakdown | all | byte-identical (the template feeds only the crew sheet) |

No committed test or snapshot pins the old line (`grep -rl "must be posted on BOTH sides" tests/` = 0 files). Historical runs under `validation-artifacts/committed/audit-shoulder/` are records and are not regenerated.

New test: `tests/s630/test_note8_crew_sheet_337.py` (3 cases). Red on the old template: 2 failed (the day and night shoulder cases), 1 passed (the lane case, unchanged by design).
