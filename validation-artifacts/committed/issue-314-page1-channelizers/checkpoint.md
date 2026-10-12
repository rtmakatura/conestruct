# 📋 Checkpoint: #314, page 1's shoulder-edge channelizers on the sidewalk band, the arrow board over the drums

Investigated on main `8f5e482`, 2026-10-12. No code written. R135: "option A, plus B if your checkpoint
shows it's needed". Probe: `probes/page1_probe.py` → `probes/page1_probe.txt`. It records page 1 from
the renderer's own functions: the final device positions out of `_layout_device_positions`, the road
outline from `_road_y_extent`, the sidewalk band from `_draw_strip`, and the direction arrows from
`_draw_lane_arrow`.

## Measured today

Four shoulder plans, each with and without a sidewalk:
- Broadway one-way, right and left;
- two-way undivided (`control-typical`);
- divided (`adv-shoulder`).

The glyph boxes are the draw functions' own: cone 8 × 10 pt, drum 10 × 14 pt, arrow board
20 × 12 pt.

| | Every case | With a sidewalk |
|---|---|---|
| First taper drum (shoulder taper start) | 7.0 pt past the road outline | **10.5 pt on the band** |
| Second taper drum | inside | **1.2 pt on the band** (1.8 on the divided plan), not in the issue |
| Last downstream cone | 5.0 pt past the road outline | **8.5 pt on the band** |
| Arrow board vs taper drums | one-way, both sides: overlaps drum 2 by 3.8 × 8.3 pt. **Divided: overlaps drums 1 and 2 by 10.0 × 8.5 and 8.0 × 8.8 pt** | same |
| Direction arrow | one-way: inside the lanes (#308 R94), fine | **two-way: on the band** (y 359 in 355.5–376.5). **Divided: both arrows on their bands** |

The two-way plan carries no arrow board, so it has no board overlap.

## Is B needed? Yes, measured

The probe simulates option A: every crossing box is pulled inside the road outline (+0.5 pt).

- **A alone:** the worst channelizer still sits **3.0 pt on the band, in every sidewalk case**. The
  band starts 1 ft (3.5 pt) *inside* the shoulder (`_sidewalk_strip_ft`: `road_edge - 1.0`), so a box
  that only clears the outline still sits on it.
- **A + B:** **0.0 pt in every case.** B starts the band at `road_edge`.
- **R9-9, the sidewalk barricades and the SIDEWALK label stay tidy under B.** R9-9 and the barricades
  sit at `road_edge + 2 ft` (`site_adjustments._ped_offset`), still inside the band (road edge to +5
  ft). That's what `test_r94_one_way_page1.py`'s "barricades land on the drawn sidewalk band" checks.
  The SIDEWALK label moves 3.5 pt with the band's inner edge.

**The alternative to B** would be A pulling the glyphs to the band's inner edge instead of the outline.
That leaves the band painted 1 ft into the shoulder, so the shoulder still reads as narrower than it is.
B is the honest one.

## The sources, by subject

**S-630-1 (July 2026), Standard Sheet No. 7, Case 11, "Shoulder Work – Freeway/Expressway"** (PDF
p.155, `issue-300-left-side-oneway/sources/s630-1-2026-pdf155-sheet7-cases10-11.png`).
- The ⅓ L shoulder taper starts on the shoulder's outer edge line.
- The channelizers then run along the lane edge past the work area.
- At the downstream end the line angles back out to the outer edge line.

So the device positions (`shoulder_edge_offset`) are right, and the fix is render-only: glyph sizes
on the drawing, not where the devices stand.

**MUTCD 11th Ed. Table 6B-3 (p. 775)** is **not in the repo's sources**. The code cites it for taper
*length* criteria (`audit.py:78-97`), not for where a taper ends laterally. The build states no new
lateral end point: the nudges are page-drawing only, commented as such, with Case 11 as the cite. If
you want Table 6B-3 quoted anyway, it needs the page added to the sources first.

## The build (A + B, and the arrow)

All in `src/rendering/plan_sheet.py`, page 1 only.

1. **A, step 1:** in `_layout_device_positions`, every `CONE` / `DRUM` box that crosses the road
   outline is pulled inward until it sits inside (cone 5 pt, drum 7 pt, plus 0.5 pt). CHOSEN,
   render-only, and the legend's "lateral offset exaggerated" note covers it.
2. **A, step 2, after step 1:** the `ARROW_BOARD` box moves upstream in x until it clears every
   channelizer box. On the divided plan that clears two drums.
3. **B:** `_sidewalk_strip_ft` starts the band at `road_edge`.
4. **The direction arrow:** when the side's sidewalk band is drawn, the arrow sits 8 pt beyond the
   band's outer edge instead of 14 pt beyond the shoulder line. That applies to two-way and divided
   plans; one-way plans keep #308's in-lane arrows.

## Acceptance (the issue's, plus the arrow)

- **A `_layout_device_positions` test** over the four plans, each with and without a sidewalk:
  - every `CONE` / `DRUM` box lies inside the road outline and off the band;
  - no `ARROW_BOARD` box intersects a channelizer box;
  - **the two-way and divided direction arrows lie off the band.**
- **A rendered check (Rule 11):** page 1 of the Broadway left and right plans, cropped at the taper
  start and the downstream taper, before and after, committed.
- **Byte-identical:** placements, the device breakdown, the XLSX, the crew sheet and the audit, diffed
  against main as for #312. The plan PDF's page 1 changes by design. Page 2 (the aerial) needs a
  Mapbox token to render, so its identity is shown by the unchanged corridor data it draws from rather
  than by a diff.

## Rule 5: predicted churn

**Deliberate changes, page 1 only, on every shoulder plan:**
- the first taper drum and the last downstream cone pulled inside the outline;
- the arrow board moved upstream clear of the drums;
- with a sidewalk: the band 3.5 pt narrower on its inner side, the SIDEWALK label moved with it, and
  the two-way and divided direction arrows moved beyond the band.

**Not changing:** placements, quantities, stations, offsets, every non-PDF deliverable, and the other
kinds' page 1 (the pull touches only boxes that cross the outline; lane-closure tapers end inside
it). That last point gets checked at the build with the lane-closure plans' page-1 positions.

| Area | Rough count |
|---|---|
| `test_r94_one_way_page1.py` (the band and the barricades) | 0–2 (the barricades stay inside the band by measurement) |
| Other page-1 tests: `test_lanes_geometry` (hashes only to show lane counts differ), the sign-band clamp tests in `test_rules` | 0 |
| New: the acceptance test (4 plans × 2), the arrow-board, direction-arrow and band-edge cases, the identity test | ~12 |

**Lane:** backend (the renderer), `frontend-only: no`, with no UI change.

## What I need from you

Nothing beyond R135, which said B "if your checkpoint shows it's needed": it does (3.0 pt left on the
band without it). Unless you say otherwise I'll build A + B + the arrow on `issue-314-page1-channelizers`:
the prediction first, then the code with its tests, the verifier, the before/after crops, and the go.
