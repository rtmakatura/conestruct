# #332 outcome (after code)

## Matches the prediction
- **The backend verdict.** A two-way `trunk` reads `undivided`, and `plans_divided()` is False even with a stale `divided: true`. Tests: `tests/test_carriageway.py`, `tests/test_trunk_twoway_332.py`.
- **The site classifier.** A two-way trunk relays facts and reads `divided: false`: `rural_undivided` outside towns, `urban_arterial` in them. Tests: `classify.test.ts`.
- **The divided toggle** is hidden on `undivided`. Test: `PlanDetails.test.tsx`.
- **US 24 near Hartsel,** rendered locally (`render332.py`, images `us24-before.png` / `us24-after.png`):

  | | Before | After |
  |---|---|---|
  | MHT type | "Case 11: Shoulder closure on divided highway" | "… on undivided highway" ("2-LANE UNDIVIDED" on page 1) |
  | Median | drawn | none |
  | Signs | mirrored into the median | right side only |
  | L/3 | 217 ft | 173 ft |
  | Devices | 35 | 27 |

- **Backend parity:** 107 scenarios, 963 responses, **0 changed** against `origin/main` 4662ace (`parity323f.py` + `cmp323f.py`).

## Narrowed during the build (stated, not hidden)
- **Motorways are excluded from the `undivided` rule.**
  - The frontend's existing motorway test uses an untagged motorway and expects divided. That's right: OSM implies `oneway=yes` on `highway=motorway` even untagged.
  - So rule 2b applies to `trunk` only, and an untagged motorway relays no facts (its divided-by-class reading stands).
  - The prediction said "trunk or motorway". This narrows it.
- **`oneway=reversible` / `alternating` are excluded.** Reversible express lanes (I-25's) are their own carriageway, not a two-lane road. Only untagged or `oneway=no` reads `undivided`.

## Two effects the prediction didn't list
- **The single-lane gate** (`render_api.py:800`): a two-way trunk tagged `lanes=1` was exempt as "divided". It now refuses like any undivided one-lane road. That's the honest answer. No audited or fixture road has this shape.
- **`kind_proposal._road_facts`** now lets an `undivided` verdict outrank a stale `divided` flag, as `plans_divided` does.
- **The one-way trunk's divided provenance line** read "same-name carriageway null m away". It now reads "OSM class=trunk, oneway=yes: one carriageway of a divided highway → divided". It's the same ternary, fixed in passing.

## Left as is (noted for Ryan)
On an urban one-way trunk (divided by class, #322), the divided toggle still shows, though the backend's verdict ignores it. That's the same dead-control shape as S3, but it predates #332 and is outside it.
