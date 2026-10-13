# Rule 5 outcome: `phase4-tap-targets` (Phase 4 branch 2, R138)

Prediction: `prediction.md` (committed before any "after" measurement). Before = production
(www.conestruct.com/sandbox, equal to main `03fa273`); after = a local stack of this branch. Both run
with `tapsize.cjs` at 1440×1000 and 360×800 (isMobile, touch). Every control, both sides:
`sizes-before-after.md` (built by `tapcompare.cjs`); raw boxes in `before/` and `after/`.

## Totals

| Surface | Width | Under 44 before | Under 44 after |
|---|---|---|---|
| Picker | 360 | 15 of 15 | **0** of 14 |
| WHERE | 360 | 0 | 0 |
| WHAT, shoulder | 360 | 11 | **0** |
| WHAT, flagger | 360 | 9 | **0** |
| WHAT, near-intersection | 360 | 12 | **0** |
| WHAT (all three kinds) | 1440 | 21 / 17 / 32 | 12 / 12 / 25: only the segmented chips changed |
| Picker, WHERE | 1440 | 18, 4 | 17, 4 (+2 aerial zoom, see below) |

## Prediction vs. outcome

| Predicted | Outcome |
|---|---|
| Segmented chips 42 → 44 at every width, nothing around them moves | ✓ 42 → 44 at 1440 and 360; each option is also 0.6–1 px wider (the 1 px side border is gone). Same 44 px track. |
| Windows line 32 → 44, OPEN 42.2 → 44 wide (360) | ✓ |
| Cross-street type select 43 → 44; sliders 2 → 44; "Lane count is right" 28 → 44 (360) | ✓ |
| Picker: Close 34×26 → 44×44; coordinate toggle 30 → 44; three text fields 43 → 44; STREETS 34 → 44; CHANGE 25 → 44; Re-detect 23.5 → 44; Cancel, Save & Close 35.5 → 44 (360) | ✓ all ten |
| Mapbox zoom in/out/compass 32 → 44, attribution toggle 24 → 44 (360) | ✓; the icons keep their drawn size (32 / 24 px) inside the 44 px box |
| WHERE unchanged at 360 (already 44) | ✓ |
| Desk sizes otherwise identical | ✓, every desk row except the chips is byte-for-byte the same size |
| Mapbox wordmark link stays 88×23 | **Not measured on the after side.** The local stack's map shows no wordmark at either width (the before, on production, has it), so the row is "only one side". This branch adds no rule that touches `.mapboxgl-ctrl-logo`; it is checked on the Preview build. |

## Not predicted

- **WHERE at 1440 lists two more controls after** ("Zoom in"/"Zoom out", 32×32): the corridor
  aerial's own Mapbox buttons, which had loaded by census time on the local run and not on the
  production run. At 360 they are 44×44 in both runs (already sized there). Not a change.
