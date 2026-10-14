# Rule 5 outcome: `issue-321-flagger-arrow` (#321, ruled (b))

Prediction: `prediction.md` (committed `9c730f1`, before any change).

| Predicted | Outcome |
|---|---|
| Flagger page 1: both arrows inside the open lane, opposite ways, the work-side one nearer the centerline | ✓ `after-flagger-plan.png`; `tests/test_lane_arrows.py` checks both y's lie in the open lane (0 to -W), the work-side arrow nearer the centerline, 0.4 W apart |
| Every other plan pixel-identical to `40f23e6` | ✓ against the shipped renders (`../after/`), the only other difference on each page is a 10 x 13 px box in the title block: the plan date, 2026-10-13 then 2026-10-14 |
| No snapshot changes | ✓ Python suite 2791 passed, 2 skipped |

The pre-#321 margin placement and its #314 (R136) sidewalk-band offset are gone: no plan draws an
arrow outside the asphalt now.
