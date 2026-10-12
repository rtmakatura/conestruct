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

## Outcome (after the build, `438bc0c`)

| Predicted | Actual |
|---|---|
| `test_a_divided_verdict_keeps_today_s_plan` rewritten: 1 | **1, as predicted.** It's now `test_a_divided_verdict_builds_one_carriageway_signed_both_sides`: `one_way_street` and `divided_carriageway` True, `is_divided` False, the audit differs from two-way, and 42 placements |
| Other existing backend tests: 0 | **0.** Backend 2738 → 2748 passed (2 skipped) |
| New: ~10 | **10** (`tests/test_divided_near_intersection.py`) |
| Frontend: 0 (comments only) | **0.** 203 files, 2120 passed. The branch's base predates R133's 3 tests |
| One-way and two-way plans byte-identical | **Proved against main**, in `probes/identity_main.txt` vs `identity_branch.txt`. All 14 digests are identical: audit JSON, crew markdown, device breakdown, plan PDF text, audit PDF text, crew PDF text and XLSX cells, for each plan. The first run differed only on the plan PDF: the main checkout's `.env` loads a Mapbox token at import and adds an aerial page 2. The probe now clears the token after import on both sides |
| **Not predicted** | The route went one step further than the checkpoint's sketch. A divided verdict sets `one_way_street` as well as `divided_carriageway`, so #309's drawing, mirror and Note 8 obligation are reused whole. `divided_carriageway` only changes the words. Two wording fixes were found while reviewing the deliverables: the crew sheet's Note 8 parenthetical, and "left (median) edge", so the new line names the same edge as the steps |

**Evidence** (`before/` on the unchanged code, `after/` on the build). Colorado Blvd at E Exposition
Ave, a work-start plan with two cross-street legs:

| | Before | After |
|---|---|---|
| Plan sheet type (`plan-p1.png`) | "LANE CLOSURE NEAR INTERSECTION · UNDIVIDED" | "LANE CLOSURE NEAR INTERSECTION · DIVIDED HIGHWAY". Mainline signs ①–④ on both curbs; device summary 2 of each mainline sign |
| Audit PDF Note 8 row (`audit-p*.png`) | "Required: False. Signs placed: 0 left, 8 right." | "Required: True. Signs placed: 8 left, 8 right." |
| Audit pending items | none for the median | "Divided highway: the cross street crosses the median at an opening the CDOT S-630-1 Sheet 10 plates (Cases 18/19) don't draw. Confirm the signing at the median opening, and any turning traffic there, with the Engineer (…). Nothing is drawn for it (#312)." |
| Crew sheet (`crew-p*.png`, `crew.md`) | single-side signing | "Divided highway: all warning and regulatory signs are posted on BOTH sides of this carriageway, the median side included … Offsets are measured from the left (median) edge of the roadway." and "Median opening: … Confirm the signing at the median opening with the Engineer before setup." |
