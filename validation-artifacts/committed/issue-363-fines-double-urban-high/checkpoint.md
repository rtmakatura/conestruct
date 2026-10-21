# #363 checkpoint: urban_high Fines Double plaques

Branch `issue-363-fines-double-urban-high`, built on #361's evidence `b6587af`. No code changed yet.

## Why this stops
Every fix that removes the note needs a change to #360 ruling Q3, Ryan's ruling: "A plaque may go only where it's at least 250 ft from every other sign (Sheet 12 Note 4) and upstream of the taper start, never in the buffer or the taper." The issue also carries `needs-spec-decision`. R145 stop reason: a reversal of a ruling.

## What the probe found (`probes/probe363.py`, output `probes/probe-b6587af.txt`)
- 144 reduced-speed shoulder plans per road type (12 speed pairs × 6 work lengths × divided/undivided).
- The engineer note shows on **90 of 144 `urban_high` plans** and on **0 of 144** each for rural, expressway and freeway.
- Every `urban_high` gap that remains runs from R2-10 to the top in-zone plaque. Overruns go from 22 ft (2,662) to 480 ft (3,120).
- Cause: Table 6B-1 spaces `urban_high` signs 350 ft apart. A midpoint needs 500 ft between signs to stay 250 ft from both, so no spot upstream of the taper is legal. The in-zone top plaque sits at the middle of the work area, so the taper, buffer and half the work area all fall inside the gap.

## What the source says (S-630-1 Sheet 12, PDF p. 160; text in `issue-360-advance-anchoring/sources/s630-1-2026-pdf160-sheet12.txt`)
- Note 4: "Placement of "Double Fines" signing may be adjusted as needed to provide a minimum 250' spacing between other signing required for the specific work zone setup."
- Note 3: "Signs should be placed so that motorists immediately associate the signs with present work activities."
- Case 24's drawing (checked by eye on the rendered page) puts a G20-5P / R2-6P assembly **inside "LIMITS OF ACTIVE WORK OR CONSTRUCTION RELATED HAZARDS"**. The R2-6P is always on its own G20-5P / R2-6P assembly. It is never drawn under an R2-1 or a warning sign.

## Options
- **(a) Share a post with an advance sign or the R2-1 group.** Not recommended. Case 24 never draws an R2-6P under an R2-1 or a warning sign, and Note 4 asks for spacing, not sharing. No source in the repo supports it.
- **(b') Let the fill use the work area's upstream end. Recommended.** If no legal spot is left upstream of the taper, add one plaque at the work area's upstream end (station = work length), CHOSEN, only if it's at least 250 ft from the top in-zone plaque. The buffer and taper stay off limits. Basis: Case 24 draws this assembly inside the work limits, and Note 3 asks for signs tied to the work.
  - Probe: fixes **84 of the 90** plans. All 6 left are 75 mph with 200 ft of work, where the spot is 100 ft from the in-zone plaque. Those keep the note, which is true there.
  - On a 75 mph plan the new gap is 2,620 ft, inside 2,640 by 20 ft.
- **(c) Keep the note and say why.** The note's reason names the 350 ft spacing. This is the cheapest option, but 90 of 144 plans keep a note Ryan called noise.
- **(d) Move the in-zone top plaque up to the work area's upstream end.** This reverses "in-zone plaques keep today's stations" (Q3 / R3), changes rural, expressway and freeway plans too, and breaks the issue's acceptance ("Rural, expressway and freeway plans are unchanged"). Not recommended.

## The tracking link (no ruling needed; R145 self-rule once the option is set)
`FINES_DOUBLE_SPACING_ISSUE` (`src/api/audit.py:2205`) points at closed #360. Under (b') the note stays only where the rule truly can't be met (Sheet 2 Note 4's engineer clause). Then it's a true disclosure, not a Conestruct gap, so the link is set to `None`. If Ryan wants it tracked, it points at #363 while #363 is open.

## Rule 5 prediction under (b')
- Changes: the 84 `urban_high` plans above each gain one G20-5P / R2-6P pair at station = work length, in the PDF, crew sheet and audit, and lose the `fines_double_spacing` pending item. The audit's `plaque_long_gaps_ft` empties on those plans.
- Byte-identical: every rural, expressway and freeway plan (the fill never runs out of upstream spots there), every plan with no speed reduction, every non-shoulder plan, and the 6 plans left with the note. Only their tracking link changes.
- The snapshots that record a noted `urban_high` plan get re-recorded. They get named before the diff.

## Question for Ryan
Do you approve (b')? That changes Q3 so a plaque may also go at the work area's upstream end, only when nothing upstream of the taper is legal. The alternatives are (c), the note alone, or (d).
