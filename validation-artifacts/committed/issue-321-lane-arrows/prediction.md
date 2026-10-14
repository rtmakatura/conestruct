# Rule 5 prediction: `issue-321-lane-arrows` (#321)

Written 2026-10-14, stacked on `issue-310-lane-clamp` (`05d5c80`), before any change.
Authority: #321 (its Proposed solution and Acceptance), #308 R94 (the one-way precedent), R145.

## Measured first (`render321.py`, page 1 through `/render/pdf`, `before/*-plan.png`)

| Plan | Arrows today |
|---|---|
| Shoulder, two-way, sidewalks | one, pointing right, in the margin past the work-side sidewalk band; no opposing arrow |
| Shoulder, divided, sidewalks | one per carriageway, each in the margin past its sidewalk band |
| Shoulder, two-way, 1 lane | one, in the margin below the shoulder |
| Near-intersection (2 lanes, lane 2 closed) | one, in the margin below the shoulder |
| Flagger (1 lane, closed) | one, in the margin below the shoulder; **the work-side lane is closed and drummed at the page's left edge**, where the arrows are drawn |
| One-way (control) | in the lanes (#308 R94) |

The arrows are drawn at the page's left (`PLAN_LEFT + 30` to `+ 130`). There, lane 1 on each side
(the lane beside the centerline or median) is open and clear of devices on every plan but the
flagger's work side.

## R145 self-ruled

#321's proposed solution: each arrow inside an open travel lane, pointing its direction of travel,
on two-way and divided roads alike. Built as:

- **Work-side arrow:** in work-side lane 1 (centered at half a lane width from the centerline or
  median edge), pointing right. Lane 1 is never the closed lane on a lane closure (the plan
  closes the rightmost lane, #176) and is clear of every shoulder device.
- **Opposing arrow:** in opposing lane 1, pointing left, on two-way roads too (they had none).
- **The flagger's work-side arrow stays where it is today** (the margin), because there is no open
  work-side lane where the arrows are drawn: the one lane is closed from the page's left edge.
  Flagged for a ruling; the flagger gains its opposing arrow like every two-way plan.
- One-way plans unchanged (#308 R94).
- The #314 (R136) sidewalk-band offset then applies only to the flagger's margin arrow.

## Predicted outcome

- Two-way shoulder (sidewalks or not) and near-intersection page 1: two arrows, one in each
  direction's lane 1. Divided: one in each carriageway's lane 1. None in a margin, a shoulder or a
  sidewalk band.
- Flagger: the work-side arrow unchanged; a new opposing arrow in the opposing lane.
- One-way: unchanged.
- Placements, counts, the device summary, XLSX, quote, audit: unchanged (page-1 drawing only);
  no snapshot changes.
