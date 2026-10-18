# #341 rulings — page 1's lane note names the sheet limit only when it is the cause

## S1 (R145 self-ruled, 2026-10-17)
**Question.** `layout.lanes_drawn_below_road` (`src/generation/layout.py`) prints
"Plans draw at most 4 lanes per direction, so ..." whenever the plan draws fewer
lanes than the road has. On I-25 drawn as 3 of 4 the limit is not why 3 was drawn.

**Ruling.** The limit is the cause only when the plan draws exactly the limit and the
road has more (`num_lanes == PLAN_MAX_LANES_PER_DIRECTION < road`). That case keeps
today's sentence byte for byte. Every other case (fewer lanes than both the road and
the limit) reads the issue's proposed wording:

> Drawn as 3 lanes per direction (entered); the road has 4. Device offsets are measured against 3 lanes.

**One reading beyond the issue's text.** The issue's acceptance says "5+ lane roads keep
today's wording". A 3-lane plan of a 5-lane road is the one case where that bullet and
the issue's principle ("name the limit only when it's the cause") disagree: the limit
allowed 4, so it is not why 3 was drawn. The principle wins; that case reads the
entered wording. Every 5+ lane road drawn at 4 (the only way the limit binds) keeps
today's wording. Fits Rule 10 (no stale or wrong reason presented as current) and
P21; no number, safety value, design direction or scope change, so no stop.

**Unchanged.** The predicate (when the note fires), the three surfaces that print it
(plan sheet upper-cased, audit pending item, crew narrative), the #310 tracking issue,
the frontend clamp note in `HandoffNotes.tsx` (there the clamp is the cause).
