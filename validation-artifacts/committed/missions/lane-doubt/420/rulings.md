# #420 rulings (mission lane-doubt, tracking #421)

Base: `8f9ba12` (#411, on finish-marks-prod-check `54b8182`). Branch `issue-420-lane-doubt-count`.

## Governing ruling

- Ryan, 2026-10-27 (https://github.com/rtmakatura/conestruct/issues/397#issuecomment-6435842275): "the WHAT header counts the near-intersection lane doubt as a guess (Rule 10: the lane count isn't from the road). This replaces R145-14." R145-14 is in `validation-artifacts/committed/missions/form-marks/397/rulings.md`.
- Unchanged: Ryan, 2026-10-26 on #397 (issuecomment-6428707399): the untouched Lanes row reads plain "default" and the ⚠ sits on the doubt line in the row's details.

## Plan (5 bullets, written before the diff)

1. Problem: `conestruct/site/components/bands/WhatBand.tsx:505-518` (`warnMarkers`) counts only the ⚠ markers on rows; the doubt line `lanesDoubt` (:470-479) is left out (comment :467-469, R145-14). A near-intersection plan whose only doubt is the lane count reads "prefilled from the road".
2. Ruling: Ryan 2026-10-27 above (replaces R145-14); Ryan 2026-10-26 on #397 unchanged.
3. Change: the header's N adds the doubt line when it is on show (`lanesDoubt.length`, 0 or 1), so N = row ⚠ markers + the lane doubt. Comments at :467-469 and above `warnMarkers` say so. No copy change: `whatHeader` already handles 1 vs N.
4. Rule 5 churn prediction: WhatBand.tsx about +6 / -4 (count + two comments); untouched-provenance.test.tsx about +15 / -8 (the Wadsworth test's header expectation, finding 3a's "N doesn't change" becomes "N drops by one", the no-map-count test asserts no lane guess, one new test with a second guess on show for the plural). Stated behaviour change: on a near-intersection plan with an untouched count and a map count, the WHAT header's N is one higher (Wadsworth fixture: "prefilled from the road" becomes "1 guess marked ⚠ · change any that are wrong"; live Wadsworth & W 10th: 2 becomes 3). Byte-identical: every other kind, a near-intersection plan with an edited count or no map count, the Lanes row text, the doubt line, every other row. No backend change.
5. Proof: mounted WhatBand tests in untouched-provenance.test.tsx, red on `8f9ba12` (red-proof.txt, via git archive); full vitest; before/after shots of the header at 1440 and 390 on a local near-intersection plan, with header text in measurements.json, all in this folder.

## Calls

- **R145 self-ruled, call 1 (what is counted).** The doubt counts when it is on show, the same condition that renders it (`lanesDoubt`: near-intersection, count untouched, map has a count). An edited count drops the line and the guess with it; a plan with no map count has no doubt and no guess. This follows the ruling's reason (Rule 10: the count isn't from the road) only where the tool actually voices the doubt; a no-map-count near-intersection plan says "default · set the real count" with no ⚠, and the ruling names the doubt, not the default.
- **R145 self-ruled, call 2 (no wording change).** The header keeps "N guesses marked ⚠ · change any that are wrong". The doubt line carries ⚠, so "marked ⚠" stays true; it sits in the row's details, which R145-14 named as the cost and Ryan ruled over. No follow-up filed for it.
- **R145 self-ruled, call 3 (the counter stays in WhatBand).** The count is UI emission, not MUTCD math (Rule 3 not engaged); it reads the same `lanesDoubt` array the row renders, so the two can't drift.
- **R145 self-ruled, call 4 (#397's rulings.md left as written).** R145-14 in `form-marks/397/rulings.md` is a record of that arc; it is not edited. This file and the commit message record that Ryan's 2026-10-27 ruling replaces it.

## Actual churn vs the prediction

| File | Predicted | Actual (+/-) |
|---|---|---|
| `conestruct/site/components/bands/WhatBand.tsx` | about +6 / -4 | +6 / -4 |
| `conestruct/site/components/bands/untouched-provenance.test.tsx` | about +15 / -8 | +29 / -9 |

The test file is over by 14 added lines: the new plural test builds its own road fixture with no `maxspeed` and a speed guess (+16), more than the one-assertion test the prediction counted. No other file changed (plus this evidence folder).

## Proof

- Red proof (`red-proof.txt`): 3 tests red on `8f9ba12`, all 21 green on this branch.
- Full vitest on this branch: Test Files 243 passed | 1 skipped (244); Tests 2591 passed | 1 skipped (2592) (#411's commit reported 2590 + 1 skipped; the +1 is the new test). A first "baseline" run started while the edits were being made, so it is not counted as a base baseline; it read the same 2591 / 1. `tsc --noEmit` clean. No backend file touched, so pytest, mypy and ruff weren't run.
- Shots (`shots/`, `measurements.json`, `script/shoot.mjs`): Wadsworth Blvd & W 10th Ave, near-intersection, untouched count, map count 4. Header before "2 guesses marked ⚠ · change any that are wrong", after "3 guesses marked ⚠ · change any that are wrong", at 1440 and 390. The header box is the same size before and after (878 x 44.75 at 1440, 360 x 60.5 at 390; one digit changes). The row ⚠ markers are the same two "⚠ from the road" before and after, and the Lanes row's text with its details open is identical (plain "default", the ⚠ doubt line in the details).
