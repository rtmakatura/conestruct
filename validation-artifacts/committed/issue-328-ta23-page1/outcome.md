# #328 outcome: page 1 of a TA-23 plan draws the left-turn bay open

The checkpoint (`checkpoint.md`, `2b0c723`) states the predicted behavior before any code: option (a), and every other page byte-identical.

## Built (`src/rendering/plan_sheet.py`)

**`_TURN_BAY_FRAME`**, a context variable. `render_plan_sheet` sets it only for a plan whose bridge passed a turn-bay length (TA-23), from `near_intersection_stations`. It's reset after page 1.

**`_turn_bay_x_mapping`**, page 1's frame for TA-23:
- **To scale:** the taper, the opening, the bay and the cross street.
- **The stretch from the far curb to the work zone:** compressed to `BUFFER_VISUAL_FT` with a // break when it's longer than that. Its channelizers stand in for the dimension line; signs there are still drawn.
- **Off-page origin:** the real taper start, so R3-7L is drawn and only W4-2L, W20-5L, R2-10 and W20-1 list off-page.

**The closed-lane band** (`_draw_one_way_street`, `closed_x_spans`) is shaded over the taper and from the far curb through the work. The bay and the opening are open. Upstream of the taper the lane is open, as it is.

**`_draw_cross_street`** draws pavement across the road between the curb lines, so no edge line, lane line or shading crosses the intersection.

**The dimension line** reads:
- L = 280 ft
- OPENING = 100 ft
- LEFT-TURN BAY = 300 ft, ENTERED BY OPERATOR
- CROSS STREET
- CLOSED = N ft (with "(NTS)" when compressed)
- WORK ZONE

The scale note says what's to scale and what's compressed.

## Before and after (`page1/`)

| plan | before (`879d89e`, live) | after |
|---|---|---|
| E 11th Ave, 1,000 ft work zone, 300 ft bay (Ryan's check) | `before-e11th-300.png`: the whole approach shaded closed; L / BUFFER labels; no bay, opening or cross street | `after-e11th-300.png` |
| E 14th Ave, 2,000 ft work zone, 300 ft bay | `before-e14th-300.png`: the approach off-page; R3-7L listed as "advance" | `after-e14th-300.png`: the 2,704 ft stretch to the work compressed (NTS) |
| E 14th Ave, right lane (TA-22) | | `right-far-e14th-unchanged.png`: byte-identical to the PNG rendered at `4bbddcf` |

## Rule 5

`parity323f.py`: 107 scenarios × 9 routes = 963 responses, `p328-before.json` at `2b0c723` and `p328-after.json`.
- **Changed:** only `ni-left-far-300` `/render/pdf`.
- **Unchanged:** every other plan's PDF, right far-side plans included, and every other route of the TA-23 plan.

## Tests (`tests/test_ta23_page1.py`, rendered output)

- **Pixel columns:** at E 11th and at E 14th, the bay and the opening have no closed-lane pink; the taper and the work zone do.
- **Page text:** the dimension labels are present, and there's no "BUFFER =".
- **Off-page list:** names only the four advance signs.
- **Compressed stretch:** labelled "(NTS)", and the scale note says so.
- **Containment:** 0/0/0 at E 11th and E 14th with 50, 300 and 1,200 ft bays.
- **Frame:** reset after render.

## Suites

- **pytest:** 2,908 passed, 2 skipped.
- **mypy:** `src`, 0 issues.
- **ruff:** format and check clean.
- **Frontend:** no frontend file changed.
