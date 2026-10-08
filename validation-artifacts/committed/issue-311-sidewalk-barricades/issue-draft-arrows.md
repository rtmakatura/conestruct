Draft for the chat to repost (R113: "The arrows-in-the-sidewalk-band item stays out of scope; draft it as its own issue for the chat to repost.").

```
Title: Page-1 direction arrows sit outside the travel lanes on two-way and divided plans, in the sidewalk band when sidewalks are present
Labels: bug, priority-low, pdf-rendering, p4, p8

## Problem

On every two-way and divided plan, page 1 draws the direction-of-travel arrows outside the asphalt, not in a lane. When "Pedestrian sidewalks present" is checked, the arrows land inside the sidewalk band. Visual-only; it can't change a count or a station, but it puts a traffic arrow on a sidewalk on a sheet a crew posts from. Violates P8 (the drawing says what it doesn't mean) and P4 (an element placed off the geometry it describes).

`src/rendering/plan_sheet.py:4418-4446` places them 14 pt beyond the shoulder's outer edge:

    shoulder_outer_offset = params.num_lanes * params.lane_width_ft + shoulder_width_ft
    arrow_y_work_side = _y_of(shoulder_outer_offset, params.is_divided) - 14.0
    arrow_y_open_side = _y_of(-shoulder_outer_offset, params.is_divided) + 14.0

The comment at `plan_sheet.py:4418-4422` says this is on purpose ("in the page margin just outside the asphalt"). The sidewalk band starts 1 ft inside that same edge and runs 5 ft past it (`_sidewalk_strip_ft`, `plan_sheet.py:1091-1093`: `road_edge - 1.0, road_edge + 5.0`), so a 14 pt drop lands in the band. The band is drawn on the work side, and on both sides when divided (`plan_sheet.py:1208`).

The arrow helper's own docstring says the opposite of what the call site does (`plan_sheet.py:1776-1779`):

> "Direction-of-travel arrow drawn inside an open lane. … placement on the lane (rather than floating in white space outside the road) ties the indicator to the geometry it describes."

### Two-way roads also show one direction only
A two-way undivided plan draws only the work-side arrow, pointing right. The opposing direction gets no arrow. The second arrow is drawn only `if params.is_divided` (`plan_sheet.py:4439-4446`).

## Reproduction

1. Divided: Colorado Blvd, `39.70900, -104.94070`. Shoulder work, Utility locate, "Pedestrian sidewalks present", `35 mph`, 3 lanes × 11 ft. Generate and open page 1.
2. Expected: one arrow in an open lane of each carriageway, pointing its direction of travel.
3. Actual: the work-side arrow sits in the work-side sidewalk band and the opposing arrow in the opposing sidewalk band. Evidence: `validation-artifacts/committed/issue-308-oneway-read-as-divided/probes/r94_colorado_after.png`.
4. Two-way: Lafayette St, `39.74362, -104.97070`, the same flags. Expected: an arrow in each direction's lane. Actual: one arrow, below the work-side shoulder, in the sidewalk band.

## Impact

- **The crew** reads a traffic arrow drawn on a sidewalk.
- **The TCS/reviewer** sees a two-way road with one direction marked.
- The one-way fix (#308 R94) already puts arrows in lanes, so the three road types now disagree on page 1.

## Proposed solution

Follow #308 R94's one-way branch (`plan_sheet.py:4429-4436`), which draws arrows inside the travel lanes. Put the work-side arrow in an open lane of the work-side direction, pointing right: the lane inside the closed one on a lane closure. Put the opposing arrow in an opposing lane, pointing left, on two-way and divided roads alike. Rewrite the comment at `plan_sheet.py:4418-4422` to say what the code does.

## Acceptance

- On Colorado Blvd and Lafayette St page 1, every direction arrow sits inside an open travel lane and points its direction of travel. None is in a sidewalk band, a shoulder or the margin.
- A two-way plan shows both directions; a divided plan shows one arrow per carriageway.
- One-way plans unchanged (#308 R94).
- Placements, counts, the device summary, XLSX, quote and audit unchanged (page-1 drawing only).

## Reference

- `src/rendering/plan_sheet.py:1091-1093, 1208, 1776-1779, 4418-4446`; the one-way precedent at `4429-4436`
- `validation-artifacts/committed/issue-308-oneway-read-as-divided/probes/r94_colorado_after.png`; that arc's `checkpoint.md:415, 444`
- Split from #311 by ruling R113. Distinct from #311 (the far-side barricades) and #308 (one-way streets).
- Priority-low. Visual-only; no count changes.
```
