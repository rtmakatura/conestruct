# #356 rulings

Governing ruling: #345 S3 (Ryan, 2026-10-19,
`validation-artifacts/committed/issue-345-lane-narrowing/rulings.md`): the 52 ft
is `MAX_DRAWABLE_HALF_ROAD_FT` (src/rules/validators.py:75-84), the widest
half-road Conestruct's own drawing fits at 3.5 pt/ft, CHOSEN. It is not on any
CDOT sheet, so the wording is "the 52 ft half-road this plan can draw".

## R1 — R145 self-ruled: the freeway tail of the same refusal is in scope
The shoulder refusal's freeway branch (src/api/schemas.py, #335) goes on
"(CDOT S-630-1 Sheet 7 Case 11 '11' MIN.'), so the sheet draws at most N lanes".
Right after a Sheet 7 cite, "the sheet" reads as CDOT's sheet: the same defect
in the same message. It now says "so this plan draws at most N lanes". The
11 ft cite is unchanged.

## R2 — R145 self-ruled: the frontend mirror copy stays
`conestruct/site/lib/scenarios/validation.ts` says "is wider than the plan sheet
can draw (52 ft per direction)" and, on the freeway branch, "so the sheet draws
at most N lanes per direction". Neither cites a CDOT sheet, and "can draw"
already marks the 52 as a drawing limit. Rewording it moves 5 frontend tests
and the handoff note copy, which is beyond the issue's three refusals (a scope
change, an R145 stop reason), so it is flagged here, not changed. The two
frontend fixtures that copy the backend 422 body
(`render-proxy.validation.test.ts`, `GeneratorShell.error-honesty.test.tsx`)
are updated to the new backend wording so they stay true to the wire.

## R3 — R145 self-ruled: the validator's parenthetical
`validators.py`'s recovery becomes "At 11 ft this plan draws at most N lanes in
this direction beside the S ft shoulder (the widest half-road it can draw is
52 ft)." Numbers stay from `FREEWAY_MIN_LANE_WIDTH_FT`,
`freeway_max_drawable_lanes` and `MAX_DRAWABLE_HALF_ROAD_FT`.

## Rule 5 churn prediction
- Changes: the three refusal strings plus R1's tail; two Python tests that match
  "drawable half-road" (`tests/test_intersection_schema.py:212`,
  `tests/test_lanes_geometry.py:295`); three frontend fixture strings and one
  `toContain` in `render-proxy.validation.test.ts`; a new test file.
- Byte-identical: every PDF, audit JSON, XLSX and snapshot (no successful plan
  carries these strings); refusal triggers, rule ids, status codes and recovery
  numbers. The committed audit-shoulder run artifacts keep the old text: they
  are the record of that run.
