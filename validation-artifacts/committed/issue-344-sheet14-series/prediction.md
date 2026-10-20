# #344 Rule 5 — predicted churn and what happened

## Predicted (session plan, before the diff)
Only CDOT freeway shoulder plans with the Case 26/27 step-down (65 to 60, 75 to 65) change:
- W20-2 is dropped; W20-1 moves to 2,640 ft from the taper.
- Both W21-5aRs, R2-10, W3-5 and the entrance R2-1 move upstream of the taper. The entrance R2-1 gets its own G20-5P.
- The envelope's length and assembly count change. The G20-5P plaque count changes because it is keyed to W20-1's station.
- The audit's advance section (labels, spacing text, source, citation) and the crew sheet rows change.
- The branch carries the #341 evidence commit (`48a71c2`, docs only).

Byte-identical: Case 11 plans, non-freeway plans (including 65 to 60), lane closures, flagger and near-intersection plans.

## What happened
- **Locked snapshots.** One changed, `tests/snapshots/audit_shoulder_reduction_65mph_envelope.json`, re-baselined by `rebaseline_snapshots.py` here. Every changed path was predicted: `sections.advance` (citation, result_text, road_type_text, sign_table, source, spacing_text), `sections.fines_double.envelope` (entrance_r2_1_station_ft, length_ft, n_assemblies, r2_10_station_ft) and two `sections.colorado` details:
  - signs per side go from 17 to 19 (W20-2 -1, entrance G20-5P +1, second assembly G20-5P and R2-6P +2, in-zone plaques 3 to 2 -1);
  - the zone goes from 6,927 ft to 4,427 ft, with 2 plaques required and 5 placed.
- **Tests that pinned the old geometry (predicted):**
  - `tests/s630/test_case_26.py` / `test_case_27.py`: R2-10 "at plus 500" becomes Sheet 14's 1,580 ft, and the entrance R2-1 goes from 833.33 ft to 1,060 ft, both from the taper;
  - `tests/test_audit_endpoint.py::test_entrance_r2_1_envelope_fields_at_65mph`: the entrance R2-1 is now inside the envelope, not the work zone;
  - `tests/s630/test_case11_spacing_334.py::test_case_26_plan_keeps_the_table_6b_1_series` is removed; its replacement is `test_sheet14_series_344.py`.
- **Misses (not in the prediction):**
  1. S6, the first G20-5P / R2-6P at 795 ft. It became a ruling mid-arc once the old midpoint rule put an assembly 52 ft from the second W21-5aR (ruling-added scope, the standing predictor).
  2. The entrance R2-1 validator's work-zone bound (`validate_fines_double_envelope`). The generator's own check refused the moved sign until the bound followed it (rulings S3).
  3. `tests/test_audit_pdf.py`'s panel-only allowlist gains the Case 26/27 citation chips, as #334 did for Case 11's.
