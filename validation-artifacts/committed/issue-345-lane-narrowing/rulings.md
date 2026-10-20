# #345 rulings

## S1 — R145 self-ruled: option (a), keep the relay unless the detection was disputed
A shoulder form lane edit keeps `roadLanesPerDirection`. It clears only when the
edit disputes the detection (`setLanes`'s existing `disputed` test: total 1 or the
#120 arithmetic mismatch), since the road count came from the same suspect
detection. The relay is kept on every undisputed edit, not only on edits below the
road count: the backend predicate already stays silent when the plan draws at least
the road's count, and keeping it means a 3 → 4 → 3 sequence doesn't lose the note.
An operator who thinks the map's count is wrong corrects it through the picker's
lane override, which already sets the relay (overrides.ts:145). No new "this is a
correction" control: that would be new UI (out of scope, R145 stop reason).

## S2 — R145 self-ruled: the freeway-minimum reason, on #341 S1's principle
`lanes_drawn_below_road` names the freeway minimum as the cause when all hold:
the road type is freeway, the plan draws `freeway_max_drawable_lanes(shoulder)`
lanes, that count is below `PLAN_MAX_LANES_PER_DIRECTION`, and the road has more.
That is the case where no legal lane width fits the road's count on the sheet
(the #335 refusal's own arithmetic), so the reason is true whatever lane width was
entered. A freeway plan drawn below the fit count keeps the #341 "(entered)"
sentence: the operator chose it. All numbers come from the existing constants
(`FREEWAY_MIN_LANE_WIDTH_FT` 11, CDOT S-630-1 Sheet 7 Case 11 "11' MIN.";
`MAX_DRAWABLE_HALF_ROAD_FT` 52, CHOSEN, already printed by the #335 refusal;
the plan's shoulder width).

## S3 — Ryan, 2026-10-19 (pre-ship): the 52 ft is not "the sheet's"
Ryan asked where "the sheet's 52 ft half-road" comes from. It is
`MAX_DRAWABLE_HALF_ROAD_FT` (src/rules/validators.py:75-84): the widest
half-road Conestruct's plan drawing fits at its 3.5 pt/ft scale, found
empirically (CHOSEN). It is not on CDOT S-630-1 Sheet 7 and it is not I-25's
measured width. "The sheet's" could be read as CDOT's sheet, so the sentence now
says "the 52 ft half-road this plan can draw". Ryan's example wording ("the
road's 52 ft half-width") was not used: it would state the road is 52 ft wide,
which nothing measured. The 11 ft cite (Sheet 7 Case 11) is unchanged.
