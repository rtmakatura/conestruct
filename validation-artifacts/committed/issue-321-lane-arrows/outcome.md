# Rule 5 outcome: `issue-321-lane-arrows` (#321)

Prediction: `prediction.md` (committed `7f9fa16`, before any change). Before and after: page 1
through `/render/pdf` on this branch's code before and after the change (`render321.py`;
`before/*-plan.png`, `after/*-plan.png`).

## Measured

| Plan | Before | After |
|---|---|---|
| Shoulder, two-way, sidewalks | one arrow, in the margin past the sidewalk band | **two**, one in each direction's lane 1 |
| Shoulder, divided, sidewalks | one per carriageway, each in the margin | one per carriageway, **in lane 1 beside the median** |
| Shoulder, two-way, 1 lane | one, in the margin | **two**, one per lane |
| Near-intersection (lane 2 closed) | one, in the margin | **two**, each in lane 1, clear of the taper |
| Flagger | one, in the margin | the work-side one **unchanged** (pending a ruling), plus **an opposing arrow** in the open lane |
| One-way (control) | in the lanes (#308 R94) | **pixel-identical** |

Pixel diff of each page before vs. after: the one-way control is identical; every other page
differs only inside x 95 to 297 px at 2x (the arrow column, `PLAN_LEFT + 30` to `+ 130`), so no
device, label, band or note moved.

## Prediction vs. outcome

| Predicted | Outcome |
|---|---|
| Two-way and near-intersection: an arrow in each direction's lane 1 | ✓ |
| Divided: one per carriageway in lane 1 | ✓ |
| Flagger: work-side arrow unchanged, a new opposing arrow | ✓ |
| One-way unchanged | ✓ identical pixels |
| Page-1 drawing only; no snapshot changes | ✓ no snapshot or fixture changed |

## Tests

`tests/test_lane_arrows.py` (5): records every `_draw_lane_arrow` call during a real
`/render/pdf` and checks each arrow's y against its lane: two-way (with and without sidewalks),
divided, the flagger (opposing arrow in its lane; work-side one still outside the asphalt), and
the one-way fixture (every arrow pointing the one direction).

## Open: the flagger's work-side arrow

The flagger plan's one work-side lane is closed from the page's left edge, where the arrows are
drawn (its taper drums start there), so there's no open work-side lane for the arrow. It keeps
its pre-#321 margin place. Options for a ruling: (a) keep it there; (b) draw it in the open
lane beside the opposing arrow (TA-10 is a one-lane, two-way operation: both directions use
that lane, alternately); (c) drop it, leaving only the opposing arrow.
