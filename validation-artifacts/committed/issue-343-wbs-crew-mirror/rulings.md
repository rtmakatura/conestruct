# #343 rulings — the divided crew sheet mirrors only what the placements mirror

Governing ruling: **#243 R54**, as applied in #337 S1. CDOT S-630-1 Sheet 2 General Note 8 doesn't require both sides "where only one shoulder is closed (ex: Case 11 on Sheet 7)". The audit's Note 8 row for a divided shoulder-type plan already reads "Not required: one shoulder closed (Note 8's Case 11 exception)" (`src/api/audit.py:1207`).

## S1 (R145 self-ruled): the mirror lines read the placements, not `is_divided`
- `build_narrative_context` adds `mirrored_signs`: a divided plan with a non-plaque sign at a negative offset. It also adds `mirrored_plaques`: a divided plan with a G20-5P at a negative offset.
- `base.md.j2` steps 2, 4 and 6 and takedown step 1 key on those flags instead of `is_divided`.
- This is the issue's first proposed solution. The generator stays the single owner of where signs go (Rule 3). No new number or fact.
- Divided shoulder and lane plans place every sign and plaque at both a positive and a negative offset (checked on `generate_shoulder_closure_divided` and `generate_lane_closure_divided` at 55 mph freeway), so their sheets are byte-identical.

## S2 (R145 self-ruled): the Safety Notes line on a divided shoulder-type plan without mirrored signs
- New wording: "Divided highway: signs go on the {work side} side only. CDOT S-630-1 Sheet 2 General Note 8 doesn't require both sides when only one shoulder is closed (Case 11 on Sheet 7)."
- The citation and the Case 11 / Sheet 7 pointer are #337's, already in the template. It matches the audit row. A mirrored divided shoulder plan keeps #337's "by choice" line.

## S3 (R145 self-ruled): the rest of the work-beyond-shoulder crew sheet is a separate issue
The work-beyond-shoulder crew sheet is the shoulder-closure template applied to a layout with only two signs. It tells the crew to set an arrow board, "0 traffic cones", G20-5P plaques, "0 channelizing drums" and a 495 ft buffer. It also lists G20-5P in the sign schedule and measures distances "from taper". The same is true on undivided roads. That is a different template branch, not the mirror lines this issue names. It is filed as #359, not widened into #343. The kind stays gated (Rule 8), so nothing live prints it.
