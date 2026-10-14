# Rule 5 prediction: `issue-265-reference-line` (#265, first half)

Written 2026-10-14, stacked on `issue-266-colorado-heading` (`747d1ec`), before any change.

#265 asks two things: one producer for the reference line (a refactor), and which edition a
Denver plan's line names, since `data/jurisdictions/denver.json` pins "MUTCD 2009 R2" ("a ruling,
not a refactor", in the issue's words). This branch does the first only; the second is put to Ryan.

## Found while reading: the two literals disagree on a fact

- Page 1 (`src/rendering/plan_sheet.py`, `_finish`): "Reference: CDOT S-630-1, MUTCD 11th Ed. Part 6
  (effective 2026-01-18), Colorado Supplement." The date attaches to MUTCD Part 6.
- The crew header (`src/narrative/templates/base.md.j2`): "Reference: CDOT S-630-1, MUTCD 11th Edition
  Part 6, Colorado Supplement (effective January 18, 2026)." The date attaches to the Supplement.
- Every module that sources the date says it is the Supplement's: "Colorado Supplement to MUTCD
  (effective 2026-01-18)" (`src/generation/layout.py:11`, `src/narrative/crew_narrative.py:15`,
  `src/rules/spacing.py:9`, `src/rules/tables.py:13`, `src/rules/validators.py:9`).

So page 1 misattributes the date.

## Deliberate change (R145 self-ruled: #265's own "one producer for the reference line")

`src/rules/references.py`, `REFERENCE_LINE`: the crew header's sentence, the one that attaches the
date correctly. Page 1 and the crew header both print it.

## Predicted outcome

- Page 1's reference line reads "Reference: CDOT S-630-1, MUTCD 11th Edition Part 6, Colorado
  Supplement (effective January 18, 2026)." on every plan, and still fits the notes box on one
  line (a test measures it against the box width).
- The crew header unchanged, character for character.
- No snapshot changes (the line is in rendered PDFs and the crew markdown, not the audit JSON).
