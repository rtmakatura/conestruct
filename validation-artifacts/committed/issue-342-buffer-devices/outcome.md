# #342 outcome

Measured against the prediction in `checkpoint.md` (commit `1056ffe`).

## What changed, and whether it was predicted

**Snapshots: 30 moved, as predicted.**
- `corpus/flagger_grid_*`: 27.
- `corpus/ni-grid-near-35x45-2ap` and `corpus/ni-grid-near-midblock-rural`: 2.
- `audit_flagger_reduction_fines_double_required`: 1.

`regen342.py` rewrote all 70 audit-grid snapshots and all 4 near-intersection grid snapshots through `write_snapshot`. `git diff` shows content changes in exactly these 30. Every other file differed only in line endings and was restored.

**Byte-identical, as predicted.**
- All 43 shoulder `grid_*` snapshots and every `audit_shoulder_*`.
- `ni-grid-far-buffer-anchor` and `ni-grid-far-curb-anchor`.

**Frozen fixture: unchanged.** `audit_flagger_reduction_carve_out_pre_correction.json` isn't read by any test, so it didn't move. The checkpoint allowed for this.

**Fields that moved in the 28 audit snapshots.**
- New: `buffer_count_text`, `n_buffer_cones`, `buffer_cone_spacing_ft`.
- Changed: `result_text`, `formula_text`, `downstream_count_text`, `n_cones_placed_total`.
- **Rule 5 miss: `n_tangent_cones_actual` also moved, and the checkpoint didn't list it.** `audit.py:767` sets it to every mainline cone (`actual_cones`), so any added cone raises it. #333 moved it the same way for shoulder plans.

**The near-intersection placement snapshots** each gained 3 lane-line CONE rows inside the buffer, and nothing else.

**17 hand-written count pins** moved by the producer's own counts. Each has a comment saying why:
- `test_generators`: lane closure +3/+3/+4/+4/+5; flagger +3.
- `test_verification`: lane closure +4; flagger +3.
- `test_r114_one_way_near_intersection`: +3 (near side).
- `test_crew_narrative` (flagger step 3).
- `test_near_intersection_generator` (near side).
- `test_buffer_cones_333::test_a_lane_closure_is_not_changed` is now `..._takes_the_same_buffer_cones`.

## Surfaces agree (`render342.py`, local, network stubbed)

| Plan | Page-1 label | Page-1 summary | XLSX | Audit total | Crew step 3 |
|---|---|---|---|---|---|
| Flagger 45 mph rural, 500 ft | `BUFFER = 360 ft (NTS) · 3 CONES` | 14 | 14 | 14 (7 tangent + 3 buffer + 4 downstream) | 3 more cones at 90 ft, 500 → 860 |
| Near side 25 mph urban, 500 ft | `BUFFER = 155 ft (NTS) · 3 CONES` | 15 | 15 | 15 (11 + 3 + 1) | 3 more cones at 39 ft, 500 → 655 |

Before the fix (`before/`): 11 and 12 cones, with no buffer line on any surface. Page-1 images are in `before/` and `after/`. On page 1 the compressed buffer carries no drawn cones, and its label names them (S4).

## Proof
- **Red proof.** `tests/test_buffer_cones_342.py` was run against `git archive` of `1056ffe` (the base code). 12 of its 13 tests fail. The base has no `buffer_carries_cones`, so the red copy used a local stand-in with the same near-side rule. The one test that passes there is the far-side guard, which pins behavior that doesn't change.
- **Backend.** `3067 passed, 2 skipped` (baseline `3054 passed, 2 skipped`, plus 13 new).

## Noticed, not in scope
The near-side extend-to-corner audit line reads "Downstream taper: 48 ft at ~48 ft spacing -> 1 cones (MUTCD Sec 6B.08: 50-100 ft downstream taper)". It names a downstream taper that this branch doesn't have, and says "1 cones". It's the same on the base (`before/`).
