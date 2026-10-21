# #364 Rule 5 churn prediction

Stated in the session plan before the diff. The branch builds on the pending evidence branch `issue-357-flagger-opposing-buffer` (`08ed8a7`, #357's ruling and crops, docs and PNGs only), so that commit ships with this fix.

## Predicted
| What | Change |
|---|---|
| `src/rules/sign_codes.py` | W16-2a value = host station − taper start; legend "N,NNN FT" with no "NEXT"; template "XXX FT plaque" |
| Every freeway shoulder plan's W16-2a legend | Case 11: "NEXT 2,678 FT" → "2,000 FT" (55 mph); Sheet 14 (Cases 26/27): → "1,320 FT". Same change on page 1, the audit sign table, the crew sheet and the XLSX (one helper) |
| Locked snapshots | 3 files, one W16-2a string each: `audit_shoulder_75mph` ("NEXT 3,070 FT" → "2,000 FT"), `audit_shoulder_reduction_65mph_envelope` ("NEXT 2,107 FT" → "1,320 FT"), `corpus/grid_road_freeway` ("NEXT 2,678 FT" → "2,000 FT") |
| `tests/test_rules.py` | the two "NEXT 2,678 FT" asserts |
| `src/rules/validators.py` | the MISSING_SECOND_W21_5aR message's "NEXT XXX FT plaque" |
| Comments | layout, crew narrative, test_generators |
| New test | `tests/s630/test_cross_surface.py` W16-2a on all four surfaces, Case 11 and Case 26 |

## Byte-identical
Every station, every other sign's legend (W7-3a "NEXT X MILES" and G20-1 "(NEXT XXX FT)" keep NEXT; they state lengths), device counts, all non-freeway and non-shoulder plans.

## Outcome
- Matched. The three snapshot strings changed exactly as predicted, and nothing else in any snapshot changed. Full suite: 3453 passed, 2 skipped (3451 + the 2 new cases).
- One miss: `tests/test_crew_narrative.py`'s value-agnostic cross-surface test had a regex that pinned "NEXT" (`r"(NEXT [\d,]+ FT) ..."`). It failed and was changed to `r"([\d,]+ FT) ..."`. The prediction didn't list it.

## Amendment 1 (Ryan, before the ship, 2026-10-20): Sheet 14 plans read "¼ MILE"
Stated before this diff. Ryan's change: on Case 26/27 plans (`sheet_14_freeway_series`), the W16-2a legend reads "¼ MILE" (U+00BC), matching Sheet 14's drawn plaque. This is the same pattern as #354's W20-1 "ROAD WORK ½ MILE". Case 11 keeps "2,000 FT".

| What | Change |
|---|---|
| `src/rules/sign_codes.py` | W16-2a branch: `sheet_14_freeway_series(params)` → "¼ MILE"; otherwise the FT value as above |
| `tests/snapshots/audit_shoulder_reduction_65mph_envelope.json` | the one W16-2a string, "1,320 FT (under first W21-5aR)" → "¼ MILE (under first W21-5aR)" |
| `tests/s630/test_cross_surface.py` | the new #364 test's case_26 legend → "¼ MILE"; add case_27 and the undivided Case 26 plan |
| `rulings.md` | R1 records the amendment (R2) |

Byte-identical against the first prediction: the other two snapshots (Case 11 plans), every station, every other legend. `test_rules.py` and `test_crew_narrative.py` don't change, because both use Case 11 plans.

### Amendment 1 outcome
Matched. The diff touched exactly the four rows above. One snapshot string moved; the other two snapshots, `test_rules.py` and `test_crew_narrative.py` are unchanged. Full suite: 3455 passed, 2 skipped (3453 + case-27 and case-26-undivided).
