# #355 checkpoint — non-freeway 65→60 / 75→65 shoulder plans stop citing Sheet 14

Branch `issue-355-nonfreeway-stepdown`, built on `issue-354-prod-check` (`e4d0185`, #354's production check; it ships with this fix).

## Sources (quoted in the issue body, S-630-1 July 2026, repo copy `validation-artifacts/s630-1-2026.pdf`)
- Sheet 14 (PDF p. 162) titles: "Shoulder Work - Freeway/Expressway w/ 65 MPH Speed Limit" (Case No. 26) and the 75 MPH twin (Case No. 27). The "570' MIN" and "650' MIN" buffer callouts belong to those cases.
- Sheet 1 (PDF p. 149): every static shoulder-work row is "Shoulder Work - Freeway/Expressway" (Case 11, Sheet 7; Cases 26/27, Sheet 14). No sheet draws static shoulder work on another road class.
- MUTCD 11th Ed. Table 6B-2, already in `src/rules/tables.py` `BUFFER_SPACE`: 645 ft at 65 mph, 820 ft at 75 mph.

## The problem (`f3abd5d` and current `e4d0185`)
- `_cdot_buffer_or_none` (`src/rules/spacing.py:231`) keys on speed and work-zone speed only. Every surface that sizes or cites the buffer goes through it (`buffer_space`, `_is_cdot_minimum`, the audit's `is_supplement_case`, `src/api/audit.py:373`).
- So a `rural_divided`, `rural_undivided` or `urban_arterial` shoulder plan at 65→60 or 75→65 gets Sheet 14's 570/650 ft floor, the Case 26/27 taper citation (`audit.py:484`), the Sheet 14 buffer source (`audit.py:613`), the Case 26/27 label (`audit.py:1574`) and the "same device layout as the reference case" narrative, while it draws the Table 6B-1 series (`sheet_14_freeway_series` is freeway-only, `src/rules/validators.py:617`).

## The plan
1. One predicate, in `spacing.py`: Sheet 14's floor applies to a shoulder closure only on a freeway or expressway (`ScenarioParams.road_type` is the Table 6B-1 class; the form maps `rural_*` → `rural`, `urban_arterial` → `urban_low`/`urban_high`, `freeway` → `freeway`, `schemas.py:1213`). `_cdot_buffer_or_none`, `_is_cdot_minimum` and `buffer_space` take keyword-only `road_type` and `closure_type`. Every `src/` caller passes them from its params; a sentinel test fails on a caller that doesn't.
2. The audit routes such a plan like any other non-Case-26/27 reduction (the existing `is_reduced` Case 11 branch, issue option (a)), with its own wording: the reduction is the Case 26/27 step-down, but Sheet 14 is drawn for freeway/expressway, so the federal posted-speed buffer governs. `narrative_2` says S-630-1 draws no reduced-speed typical for the road class, and what the plan follows instead.
3. Lane closures are not touched (see R2).

## Rule 5 churn prediction (before the diff)
Moves, on purpose — CDOT shoulder closures with `road_type` ≠ freeway/expressway and (speed, work-zone speed) = (65, 60) or (75, 65):
- buffer 570 → 645 ft (65 mph) and 650 → 820 ft (75 mph). Every station upstream of the buffer shifts by +75 / +170 ft on every surface (PDF page 1, page 2 corridor, crew sheet, XLSX, audit, corridor/site-scan box).
- audit taper `cdot_reference` → the Case 11 text; buffer `source`/`lookup_text` → the federal value with the new non-freeway wording; the divergence fields (`jurisdiction`, `cdot_value_ft`, `mutcd_value_ft`, `divergence`) drop out; case label → "Case 11 (reduced work-zone speed): …"; `trigger_condition` drops out; `narrative` and `narrative_2` get the new wording.
- crew sheet: the "Trigger Condition" section (Sheet 14's "WHEN HAZARDS … WITHIN 8/10 FT OF TRAVEL WAY", `crew_narrative.py:510`) drops out. Added to this prediction during the build, before any test run: the crew sheet prints that Sheet 14 text on any 65/75 reduction, so it would keep citing Sheet 14 on these plans. Only these plans lose it; a 65→55 or 75→70 crew sheet keeps it (filed with R2's follow-up).
- validator: the buffer check uses the federal 645/820 with the normal 10% tolerance instead of the strict CDOT floor.
- Expected test fallout: corpus `grid_reduced_65_60` and `grid_reduced_75_65` (rural_divided base), and any test in `tests/test_rules.py`, `tests/test_audit_endpoint.py`, `tests/test_audit_pdf.py`, `tests/test_crew_narrative*.py`, `tests/test_corridor_*.py`, `tests/test_citation_single_source.py` that builds a non-freeway 65→60/75→65 shoulder plan. Each move is checked against the rows above.

Byte-identical: freeway Case 26/27 plans (`tests/s630/` harness is `roadType: "freeway"`), every lane, flagger, near-intersection, mobile and work-beyond-shoulder plan, every other speed and reduction (65→55, 75→70, 55→45 …), federal jurisdiction, and every plan without a reduction.
