# #334 Rule 5: prediction against outcome

The prediction was made in `checkpoint.md` (committed `a924cde`) before any code.

## Predicted
- **Moves:** every freeway shoulder plan that cites Case 11. On these plans the W21-5aR pair moves to 1,000 / 2,000 ft, W20-1 to 5,200 ft, and W20-2 is removed. The change shows on page 1, page 2, the crew sheet, the XLSX and the quote. The audit's sign table and position labels change.
- **Byte-identical:** every non-freeway plan, flagger, lane closure, near-intersection and Case 26/27 plans.
- **Carried along:** the branch is built on evidence commit `4723e00` (#338's production check). That commit is docs only and moves nothing.

## Outcome
Full suite: baseline 2990 passed, 2 skipped. With the change before updates, 14 failed. After updates, 3000 passed, 2 skipped (+10 new).

The 14 failures, each a pin of the old Case 11 geometry:

| Test | Why it moved | Predicted? |
|---|---|---|
| `test_grid_matches_snapshot[grid_road_freeway]` | freeway shoulder snapshot | yes |
| `test_audit_buffer_at_75_matches_baseline` | freeway shoulder snapshot | yes |
| `test_audit_road_type_text_sourced_from_lookup_value[freeway-55..75]` (5) | S4: `road_type_text` names Case 11 | yes (S4) |
| `test_no_reduction_omits_quote_and_fines_double` | the new Case 11 citation chip is panel-only, like Table 6B-1's | yes (S4) |
| `test_crew_narrative_plaque_values_equal_shared_helper_and_audit` | host text "W21-5aR at A" becomes "first W21-5aR" | yes (S4) |
| `test_shoulder_divided[75mph_freeway_8000ft]` | W20-2 pair gone: 30 to 28 signs | yes (Q1) |
| `test_shoulder_divided_freeway_w21_5aR_pair_station_geometry` | pins the midpoint rule | yes |
| `test_build_advance_warning_table_case_11_off_page_rows` | off-page order and W16-2a value | yes |
| `test_case_11_pdf_renders_g1_g2_off_page_signs` | expects W20-2 on page 1 | yes |
| `test_case_27_keeps_its_four_two_column_rows` | 8 to 7 rows | see miss 1 |

The re-baselined snapshots changed only in `sections.advance` and `sections.colorado.checks` (`rebaseline_snapshots.py` prints the paths). `colorado.checks` moved in two ways:
- Note 8's "Signs placed: 12 left, 12 right" is now 11 / 11, because the W20-2 pair is gone.
- Note 4's "Zone length: 7,710 ft" is now 7,770 ft, because W20-1 moved 60 ft upstream. The required plaque count is unchanged (3).

## Misses (recorded honestly)
1. `test_case_27_keeps_its_four_two_column_rows` is named for Case 27, but its plan is 75 to 40, not Case 27's 75 to 65. It cites Case 11, so it moved. The prediction covered "non-standard reductions" but didn't name this test. Its docstring now says why.
2. Note 4's zone-length detail (+60 ft) wasn't predicted. It follows from W20-1's move, the standing "always-present field" predictor. No plaque count moved in the suite. A plan whose signed length crosses a 2,640 ft multiple between A + B + C and taper + 5,200 ft would gain a G20-5P set.
