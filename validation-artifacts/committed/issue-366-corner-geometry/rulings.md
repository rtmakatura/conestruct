# #366 rulings: the picker draws a corner plan's run past the work zone as the plan builds it

Built on #352's production-check evidence `4782cba` (`issue-352-prod-check`), which ships with this branch.

Governing rule: #257, one producer per printed fact. `placed_downstream_taper_ft(placements)` (`src/rules/corridor.py:1162`) is the only producer of the run past the work zone. The audit's `corridor_spec`, page 2's CORRIDOR DETAILS and aerial, and the crew's step 3 read it. The two corridor reads didn't, because they had no layout. #365 R1 froze the geometry for that arc and handed the gap to this issue.

## Rulings

- **R1 (R145 self-ruled): a near_intersection read lays the plan out and passes its placements to the one layout call.** `/render/corridor-geometry` calls `_read_placements(scenario)`, which runs the generator with the cross street placed (`scenario_to_call`'s default), then `laid_out(..., placements=...)`. That is the same call page 2 makes, so the producer stays `placed_downstream_taper_ft`. The issue lists this option ("or from the placements when the read can afford a layout"). The read can afford it: the corner plan's warm read is 2.8 ms on the base and 3.1 ms with the layout (median of 20, TestClient, this machine). The station dict (`near_intersection_stations(...)["upstream_curb"]`) was the other option. It would copy the placement loop's last-cone rule into a second place (Rule 3), so it isn't used.
  - Every other kind reads no placements. Shoulder and flagger layouts place the §6B.08 floor, the read's floor already (the `corridor_kwargs` docstring), and the sweep shows them byte-identical.
  - If the generator raises `ValueError` (for example a cross street inside the work zone, or `CrossStreetStationError`), the read keeps the floor it drew before. Every deliverable refuses that plan, so no built run exists to draw. This keeps the read's answer unchanged for those plans.
- **R2 (R145 self-ruled): `/render/corridor-map`, the band aerial, gets the same fix.** It draws page 2's overlays (`static_aerial.fit_overlays`) from the same `laid_out` call without placements, so it drew the 50 ft floor next to a page 2 aerial that draws the built run. It's the same file and the same helper (one call site, under 20 lines), so it's folded in under R154 rather than filed.

## Rule 5 prediction (before the commit of the diff)

- **Moves:** near_intersection plans whose closure runs to the corner (`extend_to_corner`), on both reads.
  - The `downstream` zone's `length_ft` becomes the built run, the distance from the work zone's downstream end to the cross street's upstream curb line. That can be shorter than the 50 ft floor (48 at `alongStationFt -60`) or longer (88 at -100).
  - Corridor-end pin (the pin is the corridor's downstream end): every zone's `points` and `parts`, and `work`'s, shift along the road by the difference. Lengths other than `downstream` don't change.
  - Work-start pin (the pin is the work start): only the `downstream` zone's points move.
  - `/render/corridor-map`'s Mapbox URL for those plans (work-start only; corridor-end plans answer 409 `side_not_confirmed` there, unchanged).
- **Byte-identical:**
  - Midblock near-side and far-side near_intersection plans (their layout places 50), on both pin models.
  - All 13 `pdf_worst_case` fixtures (shoulder, flagger, near_intersection; pinned and unpinned).
  - Every deliverable (PDF, XLSX, markdown, audit, quotes). Page 2 already passes placements.
  - The `kind_proposal`, `side_options`, `coverage_*` and status fields on every plan (the corner fixtures carry no relayed road, so their coverage stays null).
- **Correction recorded before the commit:** the session's plan bullet predicted "50 → 48 on corner plans". The sweep showed the run can also be longer than the floor (88 ft at -100). The prediction above states the general rule. The code didn't change between the two.
- **Tests:** no existing test moves. New: `tests/test_corner_extension_geometry.py`, and a corner-plan case in `tests/s630/test_cross_surface.py`.

## Outcome

Filled in after the diff: see `outcome.md`.
