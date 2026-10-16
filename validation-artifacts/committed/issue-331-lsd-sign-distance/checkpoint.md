# #331 checkpoint — limited sight distance on the flagger and near-intersection plans

*2026-10-16. Stopped under R145 (scope: the R155 ruling was framed on shoulder plans; two more live kinds carry the flag).*

## The ruling (R155, Ryan, 2026-10-16)
With limited sight distance, the nearest advance sign goes at the top of MUTCD §6B.04's range (8 × speed ft urban, 12 × speed ft rural), measured from the taper; the other advance signs keep their Table 6B-1 spacing beyond it. Remove the 1.5 factor. Add the Engineer note (S-630-1 Sheet 2 Notes 10 and 25). The audit says what moved.

## What the code does today on the other live kinds
`ENABLED_SCENARIOS` = shoulder, flagger_lane_closure, near_intersection (`src/api/render_api.py:141`). `_adjust_limited_sight_distance` (`src/rules/site_adjustments.py:47`) multiplies the station of every sign in a fixed label list by 1.5, when station > 0:

- **Flagger (35 mph urban, 400 ft zone):** the upstream chain W20-7 / W3-4 / W20-4 / W20-1 sits at 950 / 1,050 / 1,150 / 1,250. W20-4 is not in the label list, so the move gives W20-7 1,425, W3-4 1,575, **W20-4 1,150 (unmoved)**, W20-1 1,875: the sign order is scrambled. The opposing approach (negative stations) never moves.
- **Near intersection:** R2-10 (BEGIN DOUBLE FINES, at ½C inside W20-1) is not in the list and stays behind; each cross-street W20-1 is in an approach frame (0 = curb line) and gets multiplied by 1.5 too.

## Recommendation (one rule for every kind)
Read "the nearest sign at the top of the range" as **"top of the range in place of Table 6B-1's A"**, and shift each approach's whole advance series by the same amount, so every gap behind the nearest sign is kept:

- delta = max(0, top − A), with top = 8 × speed (urban_low / urban_high) or 12 × speed (rural).
- **Shoulder and near-intersection mainline:** A is measured from the taper, so the nearest sign lands at top from the taper (the ruling exactly). 30 mph urban: 100 → 240 ft.
- **Flagger:** Fig. 6P-10 measures A from the flagger station, not the taper (`layout.py:2070`). The nearest sign (W20-7) lands at top from the flagger station, both approaches. 35 mph urban: 100 → 280 ft from each flagger. Measuring from the taper instead would put W20-7 100 ft closer to the flagger than top.
- **Never closer:** urban_high at 41–44 mph has 8 × speed < A = 350, so delta = 0 there. Expressway and freeway keep Table 6B-1 (§6B.04's ranges cover urban streets and rural roads only); the Engineer note still prints.
- **Cross-street approaches (near intersection):** not moved; the flag describes the mainline approach. The note covers them.
- The Engineer note (Notes 10 and 25) prints on every plan with the flag; the audit sentence states the delta, the rule and each moved sign's distance.

## Alternatives
- (b) Shoulder only: apply R155 on shoulder plans; on flagger and near-intersection plans move nothing and print only the Engineer note, recorded as pending verification. Smaller, but those plans then ignore the flag's spacing increase.
- (c) Flagger measured from the taper, per the ruling's literal words.
