# #368 outcome

## The change
- `shoulder_speed_group` (`src/generation/layout.py`), Case 11 branch: W20-1 = max(taper + 5,200, last W3-5 + Table 6B-1 freeway A) (R1, R2).
- `shoulder_advance_stations`, Case 11 branch: a reduced-speed plan takes the speed group's W20-1. The generators, the audit and the crew sheet read W20-1 from here, so without this the new station never reached a plan.
- `construction_plaque_zone_length`: a Case 11 reduced-speed plan still counts its in-zone G20-5P series from taper + 5,200 (R3).

## Stations (`probe368.py`; `probe-f66c8dd.txt` → `probe-after.txt`)
Every freeway reduced-speed shoulder plan, divided and undivided, 1,000 and 5,000 ft. Distances are from the taper start.

| W3-5 steps | Last W3-5 | W20-1 before → after | Gap after | Plans |
|---|---|---|---|---|
| 1 | 4,030 | 5,200 → 5,200 | 1,170 | 52 |
| 2 | 4,560 | 5,200 → 5,560 | 1,000 | 60 |
| 3 | 5,090 | 5,200 → 6,090 | 1,000 | 48 |
| 4 | 5,620 | 5,200 → 6,620 | 1,000 | 12 |
| Sheet 14 (65→60, 75→65) | 2,110 | 2,640 → 2,640 | 530 | 8 |

The in-zone G20-5P count is unchanged on every plan (3 at 1,000 ft, 5 at 5,000 ft; Sheet 14 2 / 6).

## Byte identity (`byteid.py`; `byteid-base-f66c8dd.json` → `byteid-after.json`; `byteid-compare.txt`)
326 plans, 317 rendered, 9 HTTP 400 on both runs. **120 moved**: exactly the 30 two-, three- and four-step pairs × divided/undivided × 1,000/5,000 ft, as predicted. Each moved on the audit JSON, audit PDF, plan PDF and crew sheet. Everything else is byte-identical: the one-step pairs, Sheet 14, freeway with no reduced speed and all 126 non-freeway plans.

## Rule 5 misses (recorded honestly)
1. **XLSX:** predicted to move on the 120 plans; it didn't. The XLSX carries device counts, not distances, and no count changed. The acceptance line asking the XLSX to "show" W20-1's move can't be met by the XLSX as built; it has no station column.
2. **Test churn:** predicted no pin on a multi-step Case 11 W20-1. `test_advance_anchoring_360.py::test_speed_signs_sit_upstream_of_the_taper_in_case_11_order` pinned 5,200 on every freeway plan, and its grid holds three two-step pairs (55→30, 65→45, 75→55): 18 cases failed. The pin now asserts R1's rule. The grep that missed it read line 114's `5200.0` as a one-step pin.

## Tests
- New `tests/s630/test_w20_1_floor_368.py` (12 cases, Rule 11: audit, page 1 and crew sheet through the real API). Red against `528a563`: 10 failed, 2 passed (the one-step 75→60 pair, which shouldn't move); `red-proof-528a563.txt`.
- Updated: the #360 pin above.
