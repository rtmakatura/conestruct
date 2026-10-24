# #386 rulings

## R1 (R145 self-ruled, 2026-10-24): the replacement 400 fixture is the freeway lane-width refusal

The mocked 400s in nine `conestruct/site/` test files carried the removed `WORK_ZONE_SHORTER_THAN_TAPER` message. Each now carries `LANE_WIDTH_BELOW_FREEWAY_MIN`'s message instead. This is the issue's suggested substitute, and the backend still sends it (`src/rules/validators.py:1918-1926`). The full string is copied byte for byte from the live answer in #382's production check (`validation-artifacts/committed/issue-382-short-work-zone/`): "Lane width 10.0 ft is below the 11 ft minimum for freeway work zones (CDOT S-630-1 Sheet 7 Case 11 '11' MIN.' annotation). Increase lane width to at least 11 ft, or verify the scenario is not actually on a freeway." Fixtures that used a shortened message before use its first sentence. The two asserts on the old message's number (`"at least 184 ft"`) now assert `"at least 11 ft"`. Variable names (`FLOOR_400`, `BACKEND_FLOOR_MSG`, `floor400`) are kept: the lane-width minimum is also a floor, and renaming them would add churn without changing what the tests check.

## R2 (R145 self-ruled, 2026-10-24): the default shoulder `workLen` stays 1000

`lib/scenarios/index.ts` gave the default `workLen: 1000` two reasons: the removed taper hard rule and the `WORK_ZONE_SHORT_VS_BUFFER` soft rule. Only the comment changes, and it now cites the soft rule alone. Changing the value would be a behavior change, which is outside this comments-and-fixtures issue (Rule 5).

## R3 (R145 self-ruled, 2026-10-24): `validation.near-intersection.test.ts:70` is in scope

The issue's list missed this file. Its test title said the merging-taper floor is the "backend 400" that "owns it", which is the same stale claim, so it falls under the issue's own fix. Only the title and comment change. The test count stays the same, and one test name changes in `vitest list`.
