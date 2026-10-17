# #335 rulings — a 4-lane freeway's two refusals stop pointing at each other

Issue: https://github.com/rtmakatura/conestruct/issues/335. One arc, no checkpoint stop: the ruling below is the issue's own recommendation and fits existing rules (R145).

## S1 — R145 self-ruled: option (a), the refusals name the lane count that fits
When the freeway lane minimum (11 ft, `FREEWAY_MIN_LANE_WIDTH_FT`, CDOT S-630-1 Sheet 7 Case 11 "11' MIN.") and the sheet's drawable half-road (52 ft, `MAX_DRAWABLE_HALF_ROAD_FT`) can't both hold at the scenario's lane count, both refusals give the one recovery that works: draw `floor((52 − shoulder) / 11)` lanes at 11 ft (3 on a divided freeway's 10 ft shoulder).
- `LANE_WIDTH_BELOW_FREEWAY_MIN` (validators.py) drops "Increase lane width to at least 11 ft" in that case, because 11 ft trips the half-road refusal.
- The schema's half-road refusal on a freeway drops "Use a lane width of 10.5 ft or less" when that width is under the freeway minimum, because it trips the freeway refusal.
- The site's mirror (`validateLanes`) says the same, so the form and the backend speak with one voice. The 11 ft there is a display-only mirror of the backend constant (Rule 3).
No geometry changes, and no value is set for the operator (suggest-never-set). Options (b) (a wider sheet) and (c) (auto-fit to 3 lanes) are not built.
`MAX_DRAWABLE_HALF_ROAD_FT` moves to `src/rules/validators.py` (the validator needs it, and validators can't import schemas without a cycle); `src/api/schemas.py` re-imports it, so there is still one producer.
Rules: 10 (a refusal's recovery must work), 3, 12 (both numbers already trace to their sources).

## Noted, not changed
Setting lanes on the form clears the `roadLanesPerDirection` relay (#310), so page 1 doesn't say the road has 4 lanes when the operator draws 3. The refusal copy doesn't promise that note. Raise as its own issue if wanted.
