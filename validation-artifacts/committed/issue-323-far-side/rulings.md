# issue-323 far side: rulings

## R152 (Ryan, 2026-10-15), Q1
> Q1 far side: (a). Build TA-23's turn-bay layout (left-turn bay, R3-7L) as its own branch. Every length and sign from TA-23 (notes p. 904, figure p. 905) or S-630-1, cited by subject with page; stop on any unsourced value.

## R153 (Ryan, 2026-10-15), Q3
> #323 Q3 (Ryan, 2026-10-15), R153: (b). The left-turn bay's storage length is site geometry, so the operator enters it. No default and no value copied from TA-22 (Rule 12). Until it's entered, the left far-side plan refuses honestly and names the missing field (Rule 10). The plan and audit record it as "entered by operator". Show TA-22's dimension A next to the field only if it's clearly labelled as a reference from a different figure, never prefilled. It's a new input, so post a screenshot of the field at 1440 and 360 before wiring it in, and stop for Ryan's look. Then the usual loop to a backticked result: line.

## Ryan's review of the field (2026-10-15)
> Turn-bay field reviewed (Ryan, 2026-10-15). Approved with two changes:
> 1. Replace the help text with exactly: "Enter the length the bay needs to hold the vehicles that turn left in one signal cycle (MUTCD TA-23, Note 5, p. 904). Get it from the signal timing or turn counts. The plan won't build without it."
> 2. Remove the TA-22 reference line completely, and don't send A back with the refusal. A number from a different figure next to an empty safety field invites copying.
> Then wire TA-23's far-side layout as planned (backend field, refusal naming the missing length, "entered by operator" in plan and audit). Usual loop to a backticked result: line. #327 can follow it in the same queue.

## R145 self-ruled (CC, 2026-10-15)

Each one fits existing rules or the house convention for the right far side. All are disclosed in the plan's audit (one pending-verification item).

- **S1. Stop line = the upstream curb line.** The tool doesn't model a stop line. The right far side already measures its 100 ft clearance from the upstream curb (`_INTERSECTION_TAPER_CLEARANCE_FT`). The bay's channelizers end there.
- **S2. Where the taper ends.** It ends at whichever is further upstream: the upstream curb + the entered storage + TA-23's 100 ft, or the work zone + its Table 6B-2 buffer. This is the same `max` the right far side takes. The storage stays exactly as entered. When the buffer reaches further, the opening between the taper end and the bay grows past 100 ft, and the audit prints the opening length.
- **S3. No centerline channelizers.** TA-23 draws them along the centerline of a two-way road. A left-lane plan exists only on a one-way street (`left_side_built`), which has no centerline: the left curb bounds the lane.
- **S4. R3-7L placement.** One on the channelized island at the taper end, in the closed lane. One on the far curb (the right curb), as TA-23 draws them (Note 5: "repeated on the left adjacent to the lane that it controls"). Together they are the both-sides posting S-630-1 Note 8 asks for, so the one-way Note 8 mirror doesn't copy R3-7L a third time.
- **S5. Arrow board at the work space's upstream end, pointing right,** as TA-23 draws it (marked optional), in place of the taper start. TA-23 draws no arrow board on the approach taper.
- **S6. Past the intersection, the closed lane stays channelized from the far curb to the work zone.** TA-23 draws the work starting at the far curb. The tool's work zone can start further on, and the right far side keeps that stretch closed (the house convention).
- **S7. The downstream end is the house convention, unchanged:** the 2-cone downstream taper, then G20-2 and R2-11, as on the right far side. TA-23 doesn't draw a downstream end.
- **S8. Field bounds:** greater than 0, and at most `WORK_LEN_MAX_FT` (20,000 ft), the ceiling the schema already puts on every along-road length. The cross-street distance check that already exists still applies to the whole layout.
