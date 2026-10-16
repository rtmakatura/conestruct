# #331 rulings

## R155 (Ryan, 2026-10-16): the limited-sight-distance sign distance
With limited sight distance, the nearest advance sign goes at the top of MUTCD §6B.04's range (8 × speed ft on urban roads, 12 × speed ft on rural roads), measured from the taper, and the other advance signs keep their table spacing beyond it. Remove the unsourced 1.5 factor. Add the note that the Engineer sets final sign locations (S-630-1 Notes 10 and 25). The audit text must describe the move truthfully.

- **Source.** MUTCD 11th Ed. §6B.04, p. 771: ¶04 urban "should range from 4 to 8 times the speed limit in mph"; ¶06 rural "from 8 to 12 times the speed limit in mph". CDOT S-630-1 Sheet 2 General Note 10 ("the final locations of signs are subject to approval of the Engineer") and Note 25 ("Additional signage is also encouraged in locations where drivers' line of sight to advance warning signs is obstructed"). Quoted on #331's options comment.

## R155 clarified (Ryan, 2026-10-16, at `checkpoint.md`): every live kind
"The top of §6B.04's range replaces Table 6B-1's A, and each approach's whole advance-sign set moves together. Shoulder and near-intersection main road measured from the taper, flagger from the flagger station on both approaches; never closer than A; expressways and freeways keep Table 6B-1; cross-street approaches stay, covered by the Engineer note."

## S1 (R145 self-ruled): what "the whole advance-sign set" is
Every mainline placement at or beyond the approach's nearest sign (the sign Table 6B-1's A places: W21-5aR/L, W4-2R/L, W20-7/W20-7a). On the flagger's opposing approach (negative stations), every placement at or beyond its W20-7. So the R2-10 fines sign, the W3-5 advisory signs, the R2-1 and G20-5P/R2-6P assemblies inside a reduced-speed chain move with the signs around them and keep their gaps. The old label list left W20-4 (flagger) and R2-10 (near intersection) behind.
- **Fits:** R155's "the other advance signs keep their table spacing beyond it".

## S2 (R145 self-ruled): "never closer than A" is a real case
`max(0, top − A)`. It bites on Table 6B-1's rural row below 45 mph (12 × 35 = 420 < 500) and on an explicit urban_high below 45 mph. Those plans move nothing, and the audit says why.

## S3 (R145 self-ruled): where the move is told
- **Audit:** the record's sentence states the count, the shift, the nearest sign's distance and anchor, the factor × speed and the range. The A/B/C position labels follow the moved signs (the shift is read off the placed A sign), and `advance.spacing_text` adds "limited sight distance moves every advance sign N ft farther upstream (MUTCD §6B.04)". The chip prefix stays `MUTCD § 6B.04`, byte-identical to the frontend's static table.
- **Crew sheet:** the record's sentence (Site-Specific Notes), the distances from placements, and the near-intersection R2-10 read from its placement (it read the generator's unmoved station).
- **Page 1:** one NOTES line: the nearest sign's distance and rule, then the Engineer note, from `site_adjustments.limited_sight_page_note`.
- **Panel:** the static "50% farther" panel copy is removed so the backend's sentence shows (`AuditTrail.tsx`, the pedestrian_facility pattern). The setup chip's description reads "Moves the advance signs farther upstream (MUTCD §6B.04)."
