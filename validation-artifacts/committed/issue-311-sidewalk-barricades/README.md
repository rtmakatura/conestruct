# #311 build (R113, R115): the work-side sidewalk pair only, on every road

Rulings: `rulings.md` (R113, R115; R94 for the reasoning). Checkpoint: `checkpoint.md`.

## The change

`src/rules/site_adjustments.py`: `_adjust_pedestrian_facility` places the Type III pair at `+offset` only, on every road. The `-offset` pair went with it (`sides = (offset,)`, was `(offset,) if one_way_street else (offset, -offset)`). The docstrings of that function and `_ped_offset` say why. The action sentence and `devices_added` are computed from the lists, so they follow. `conestruct/site/components/AuditTrail.tsx:64-69` is a comment only: it no longer says "4 elsewhere".

## Before / after, page 1 (`probes/r113_page1_render.py`)

TestClient on the checkout named on the command line, Overpass stubbed, `MAPBOX_TOKEN` empty in both runs so both draw the same one-page plan. "Before" is the main checkout at `d6d2a49`; "after" is this branch. The renders are `probes/r113_<plan>_<before|after>.png`; the placements and pixel-diff boxes are in `probes/r113_before.txt` / `r113_after.txt`.

| Plan | Devices | Device-summary Type III | Barricades off the hatched band | Page 1 |
|---|---|---|---|---|
| Colorado Blvd (39.70900, −104.94070), divided | 40 → **38** | 4 → **2** | 2 at −45 ft (page y 651.5, the opposing band, no hatch, no R9-9) → **0** | the far pair is gone from the opposing band; summary qty and total change |
| Lafayette St (39.74362, −104.97070), two-way control | 40 → **38** | 4 → **2** | 2 at −21 ft (page y 558.5, past the opposing shoulder, no band drawn) → **0** | the pair floating above the road is gone; summary qty and total change |
| N Broadway SB, one-way (R94) | 35 → 35 | 2 → 2 | 0 → 0 | **pixel-identical** (diff box `None`) |

Every remaining Type III and R9-9 sits on the band page 1 hatches closed. The CHOSEN render inputs (speeds, lane counts) are named in the script's docstring.

`probes/probe311.py` (placements + `/render/device-breakdown` + the corpus snapshot diff): `probe311-d6d2a49.txt` before; `probe311-prediction-scratch-patch.txt` is the checkpoint's prediction from a scratch copy; `probe311-after.txt` is the same probe on this branch.

## Tests changed (Rule 5: each value the checkpoint predicted)

| File | Was | Now |
|---|---|---|
| `tests/test_verification.py` `…_pedestrian_facility_adds_six` → `…_adds_four` | 37, Δ barricades 4, `devices_added` 6 | 35, 2, 4 |
| `tests/test_verification.py` `…_all_flags_add_ten` → `…_add_eight` | 41; docstring "6 (4 barricades + 2 R9-9)" | 39; "4 (2 barricades + 2 R9-9; #311 R113)" |
| `tests/test_night_adjustments.py:230` | `+ 6` | `+ 4` |
| `tests/test_crew_narrative.py:529` | "4 Type III barricades" | "2 Type III barricades" |
| `tests/test_r94_one_way_page1.py` `test_a_divided_road_keeps_the_mirrored_pair` | divided keeps 4 mirrored | replaced by `test_every_road_barricades_only_the_work_side_sidewalk[divided, two-way]` and `test_every_road_s_barricades_land_on_the_hatched_band[divided, two-way]` (Rule 11: the page-y of each barricade against the hatched band) |
| `tests/snapshots/corpus/grid_site_pedestrian_facility.json` | action "Added 4 …", `devices_added` 6 | "Added 2 …", 4 (the only two fields that differ) |

All 9 of those failed before the code change (watched red) and pass after.

## Recorded fixtures left as recorded (R115)

These were recorded from the backend, or hand-built, before R113. They still carry the mirrored pair's numbers. Nothing re-derives them from the backend, and the frontend reads only `devices_added > 0`, so they stay green. Per R115 they are left as recorded:

- `tests/fixtures/tiering/adv-ni-denver.json`: `devices_added` 6, breakdown "Type III Barricade" qty 4
- `tests/fixtures/tiering/control-lakewood.json`: the same
- `tests/fixtures/tiering/scanned-asserted.json`: the same
- `tests/fixtures/tiering/scanned-lakewood.json`: the same
- `tests/fixtures/tiering/scanned-not-checked.json`: the same
- `conestruct/site/components/__fixtures__/audit-shoulder-full.json`: `site_adjustments[2].devices_added` 6
- `conestruct/site/lib/tiering.test.ts:203`: hand-built input, `devices_added: 6`
- `conestruct/site/lib/needs-you-conditions.test.ts:35`: hand-built input, "6 devices added"

## Out of scope

The page-1 direction arrows in the sidewalk band: `issue-draft-arrows.md`, for the chat to repost.
