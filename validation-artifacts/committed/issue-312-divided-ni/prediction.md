# Rule 5 prediction: `issue-312-divided-ni` (#312, R134)

Written 2026-10-12, before any code, off main `9fc9840` plus the checkpoint (`6cb6e84`). Lane:
backend, plus frontend comments only. `frontend-only: no`. Authority: `rulings.md` (R134),
`checkpoint.md` (option (a)).

## Deliberate changes: a near-intersection plan whose carriageway verdict is `divided`

1. **Params:** `ScenarioParams.divided_carriageway = True`, from `scenario.carriageway_verdict() ==
   "divided"`. `is_divided` stays False.
2. **Signs:** all 8 mainline signs are mirrored at −4.0 ft from the median edge (CHOSEN, #309's
   value). That makes 8 left and 8 right, G20s included, and 34 → 42 placements on Colorado Blvd.
3. **Note 8:** `validate_co_signs_both_sides` owes both sides. The audit row reads "Signs on both sides
   of divided highway · Required: True. Signs placed: 8 left, 8 right."
4. **Title:** "Lane Closure Near Intersection · Divided Highway".
5. **The median opening (Q3):** one audit `pending_verification` item, and one crew-sheet line asking
   the Engineer to confirm the signing at the median opening. Nothing drawn.
6. **The narrative and the crew sheet's left-side lines:** #309's, worded for a median. The plan sheet
   carries the mirrored signs as #309's do.

## Not changing

- **Every one-way (#309) and two-way near-intersection plan:** byte-identical.
- **Every other kind:** byte-identical.
- **The wire:** `divided: true` is still refused (422), and `roadType` options are unchanged.
- **The 20 mph floor:** stays at 25 (R134; the sources are in `rulings.md`).
- **The frontend's behaviour:** no change.

## Predicted churn

| Area | Rough count |
|---|---|
| `tests/test_r114_one_way_near_intersection.py::test_a_divided_verdict_keeps_today_s_plan`: rewritten to the new plan | 1 |
| Other existing backend tests | 0 |
| New `tests/test_divided_near_intersection.py` | ~10 |
| Frontend tests | 0 (comments only) |
