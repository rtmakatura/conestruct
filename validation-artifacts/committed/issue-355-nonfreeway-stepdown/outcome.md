# #355 outcome

## What changed
- `src/rules/spacing.py`: `sheet_14_road_class(road_type, closure_type)` is false for a shoulder closure off the freeway/expressway class. `_cdot_buffer_or_none`, `_is_cdot_minimum` and `buffer_space` take keyword-only `road_type` / `closure_type` and return the federal value on such a plan. `off_class_stepdown(...)` is the one producer for the "Sheet 14 doesn't apply" wording.
- Every `src/` scenario buffer call passes the road class (layout ×5, plan_sheet ×5, validators ×5, render_api, crew_narrative, night_adjustments, sign_codes, corridor, audit). Sentinel: `tests/s630/test_nonfreeway_stepdown_355.py::test_every_scenario_buffer_call_passes_the_road_class`.
- `src/api/audit.py`: the Case 26/27 routing is gated on the road class; a new buffer branch and case clause for the off-class step-down (R3); `narrative_2` disclosure.
- `src/narrative/crew_narrative.py`: no Sheet 14 trigger section on the off-class step-down.

## Tests
- Baseline on `e4d0185`: 3078 passed, 2 skipped. After: 3096 passed, 2 skipped (+16 in the new file, +2 corridor rows). ruff and mypy clean.
- Red proof (new file run against `e4d0185` via `git archive`): 14 failed, 2 passed. The 2 that pass are the freeway Case 26/27 keepers, as they should.
- Moved on purpose (pins that built the Case 26 path on a non-freeway road): `test_audit_endpoint.py` ×5 and `test_corridor_map.py` ×1 now build it on a freeway (`_freeway_at_65`); `test_corridor_agreement.py` gains freeway rows (570/650) and non-freeway rows (645/820). Corpus `grid_reduced_65_60` and `grid_reduced_75_65` re-baselined.

## Rule 5: prediction against the diff
The two corpus diffs match every row in `checkpoint.md` (buffer, stations +75/+170 ft, citations, divergence fields gone, case label, narratives, trigger gone, buffer cone count). Two things the prediction didn't state:
1. **W3-5 doesn't shift.** It is anchored 530 ft above R2-10 (work zone + 500 ft, `layout.py:337`), not to the taper. So at 65→60 its distance from the taper shrinks by 75 ft (243 → 168 ft upstream) instead of its station moving.
2. **At 75→65 W3-5 now sits inside the taper.** The taper's upstream end moves from 2,900 to 3,070 ft; W3-5(65) stays at 3,030 ft, 40 ft inside the taper, and the audit's advance table drops its row ("4 signs" → "3 signs"). This is the adjacent defect the issue names (R2-10 and W3-5 placed from the work zone, not the buffer). It already happens on every non-freeway 75→70 plan on `e4d0185` (same 820 ft buffer: W3-5(70) at 3,030, taper end 3,070). The fix moves 75→65 into that same state. It is a sign placement, so it is not self-ruled (R145 stop: safety value / scope).

## Open
- **Q1 (Ryan):** ship as is and file the W3-5/R2-10 anchoring as its own issue, or hold #355 until that anchoring is fixed. Recommendation: ship, file it at priority-high. The borrowed 570/650 ft floor is the bigger defect, and 75→70 already shows the W3-5 problem today.
- Follow-up (R2): lane closures at 65→60 / 75→65 still take the 570/650 floor under a Case 10 label, and the crew sheet prints Sheet 14's trigger on any 65/75 reduction (65→55, 75→70).
