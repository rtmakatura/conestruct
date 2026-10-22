# #366 outcome

## The change

- `src/api/render_api.py`: `_read_placements(scenario)` lays out a near_intersection plan and returns its placements (`None` for every other kind, and when the generator raises `ValueError`). `/render/corridor-geometry` and `/render/corridor-map` pass them to the one `laid_out` call (R1, R2).
- `src/rules/corridor_layout.py` and `src/rules/corridor.py`: two docstrings that said the read has no layout now say what it does.

## Prediction vs result

The sweep (`sweep.py`, run on the base tree and on the branch; output in `sweep-base.json`, `sweep-branch.json`, summary in `sweep-summary.txt`) gives 17 of 20 plans byte-identical on both reads.

| Plan | Downstream drawn, base → branch | Predicted | Result |
|---|---|---|---|
| near_intersection, corridor end, corner at -60 | 50 → 48 | moves | geometry moved: the downstream length, and every zone's and the work's points (the anchor shift) |
| near_intersection, corridor end, corner at -100 | 50 → 88 | moves | the same |
| near_intersection, work start, corner 60 ft past the work | 50 → 48 | moves | geometry moved (the downstream zone only); the corridor-map URL moved |
| near_intersection midblock -600 / far 800, corridor end | 50 → 50 | identical | identical |
| near_intersection midblock / far side, work start | 50 → 50 | identical | identical, map URLs included |
| 13 `pdf_worst_case` fixtures | unchanged | identical | identical |

No Rule 5 miss on the code. The one prediction correction (the run can be longer than the floor) was recorded in `rulings.md` before the code commit.

## Proof

- `tests/test_corner_extension_geometry.py` (6 tests): the served read's downstream equals the audit's `corner_extension_ft` at -60 (48) and -100 (88) and under the work-start pin. Midblock and far-side plans still draw 50. The band aerial fetches page 2's overlay URL for the built run, and the test checks that URL differs from the floor's.
- `tests/s630/test_cross_surface.py::test_corner_extension_is_one_length_on_every_surface`: the picker, the sidebar's `corridor_spec`, the crew's step 3 and page 2's "Corner extension" row all read 48 on one corner plan.
- Red against the base code: `red-on-base.txt`, 5 failed (the two midblock/far-side tests pass on the base by design).
- Speed: the warm corner read is 2.8 ms on the base and 3.1 ms on the branch (median of 20, TestClient).
