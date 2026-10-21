# #365 rulings: a corner plan's corridor spec names its corner extension, not a downstream taper

Issue: https://github.com/rtmakatura/conestruct/issues/365
Branch: `issue-365-corner-spec`, on #364's production-check evidence commit `656fa1c` (docs only).

## Checkpoint findings (2026-10-21)
- `placed_downstream_taper_ft` (`src/rules/corridor.py:1162`) returns 48 on the near-side extend-to-corner plan
  (`tests.test_lane_confidence_block._ni_body()`). That value reaches the audit's
  `corridor_spec.downstream_taper_ft` (`src/api/audit.py:2071`), the sidebar's extent row
  (`WhereBand.tsx`, "Downstream · 48 ft") and the plan sheet's CORRIDOR DETAILS row (`plan_sheet.py`,
  "Downstream: 48 ft").
- No printed surface says "taper"; "Downstream" is the zone name. The crew's step 3 already words the corner run
  (`base.md.j2`, `ni_extend_to_corner`). Only the JSON key claims a taper.

## R1 (Ryan, 2026-10-21: "go recommended"): relabel on corner plans only
- The audit's `corridor_spec` carries `corner_extension_ft` in place of `downstream_taper_ft` when
  `near_intersection_stations(...)["extend_to_corner"]` is true. Same value, same producer
  (`placed_downstream_taper_ft`). The absent element gets no key, as in #358 R1.
- The sidebar extent row reads "Corner extension · 48 ft" when `corner_extension_ft` is present. It reads the key; it
  decides nothing (Rule 3). If neither key is present, the row reads "Downstream · unavailable", never a crash or a
  guessed number (Rule 10). The backend deploys before the frontend, so the old frontend can briefly meet the new key.
- The plan sheet's CORRIDOR DETAILS row reads "Corner extension: 48 ft" on those plans.
- Ryan's condition: corridor geometry, stations and every non-corner plan stay byte-identical; if anything else moves,
  stop and report. Ryan checks committed crops of the two rows in place of a browser check.

## R2 (R145 self-ruled): the map legends keep "Downstream"
The page-2 aerial legend (`static_aerial.py` `ZONE_WORD`) and the picker legend name a coloured band, not a
length. The band is the stretch past the work zone, which the corner plan does have, and Ryan ruled geometry
unchanged. They stay byte-identical.

## R3 (R145 self-ruled): the signal is the generator's own station dict
The audit already holds `corner_extension` (`audit.py`, from `ni["extend_to_corner"]`, #358 R2). The plan sheet
computes the same dict from `near_intersection_stations(params, approaches)`, as it already does for TA-23's frame.
No inference from station signs.

## Rule 5 churn prediction (before the diff)
- Moves, near-side near_intersection plans with `extend_to_corner` true only:
  - audit `sections.corridor_spec`: `downstream_taper_ft` → `corner_extension_ft` (same value).
  - plan sheet page 2, CORRIDOR DETAILS: the row label "Downstream" → "Corner extension" (same value, same position).
  - sidebar extent popover: "Downstream · N ft" → "Corner extension · N ft".
  - `CorridorSpecLengths` (`render-types.ts`): `downstream_taper_ft` becomes optional; `corner_extension_ft?` added.
- Byte-identical: `placed_downstream_taper_ft`, `corridor_layout.corridor_kwargs`, every `WorkCorridor` field,
  `/render/corridor-geometry`, every station, the aerial and picker legends, the crew narrative, the XLSX, the quote,
  the audit's spacing section; every other plan's audit, plan sheet and sidebar. No test snapshot or fixture holds an
  extend-to-corner `corridor_spec` (grep: no `"downstream_taper_ft": 4x` under tests/ or the site components).
- The branch also carries #364's production-check evidence commit `656fa1c` (docs only).

## Outcome (after the diff)
- Prediction held. `byte-identity-diff.txt`: `byte_identity.py` dumped five plans (near-side corner, near-side
  midblock, far side, shoulder, flagger) on the base (`656fa1c`, git archive) and the branch: audit, corridor
  geometry, crew markdown, quote breakdown, device breakdown, XLSX cells, plan-sheet page text and page 2's Mapbox
  requests. Two hunks moved, both on the corner plan and both predicted: the `corridor_spec` key and the
  CORRIDOR DETAILS row label. The other five hunks are the XLSX's generated-at cell (run time). Geometry, stations,
  Mapbox overlays and every non-corner plan are byte-identical.
- Red on base: `red-on-base-backend.txt` (2 failed, 1 passed: the midblock guard passes on both) and
  `red-on-base-frontend.txt` (2 failed, 4 passed), each run against a git-archive of `656fa1c`.
- Crops for Ryan's check (in place of a browser check), in `crops/`:
  - `plan-sheet-corridor-details-{before,after}.png`: page 2 of the served PDF, cropped by
    `plan_sheet_crop.py` at 4x. The aerial image is a stub, and the box isn't.
  - `sidebar-extent-{before,after}.png`: the real `CorridorExtentLines` rendered with the served corner
    `corridor_spec` (`corner-corridor-spec.json`) and the site's compiled `globals.css`, on the workbench `--paper`
    background (`extent-crop.mts`, `shot-extent.cjs`). It's the component, not the live /sandbox flow, and the
    next/font faces aren't loaded, so the type falls back to the browser serif. "Before" is the branch component
    fed the base payload, which renders the same text as the base component (the downstream path is unchanged).
- Found, not changed (Ryan: geometry must not move): the picker's `/render/corridor-geometry` draws the
  corner plan's downstream zone at 50 ft (the §6B.08 floor; that read has no layout), while the plan builds 48 ft
  and page 2 draws 48. This was already true on the base. Filed separately.
