# #360 outcome

## What changed
- `src/rules/spacing.py`: `CASE_11_FREEWAY_SIGN_FT` gains Case 11's drawn `R2-1` (3,000) and `R2-10` (3,500). New `R2_10_BEFORE_SPEED_ARRAY_FT = 500` (Sheet 12 Case 24).
- `src/generation/layout.py`:
  - `shoulder_speed_group` is the one producer of a reduced-speed shoulder plan's group, R2-10, W3-5 and W20-1 stations (Q1, Q2 (d)).
  - `shoulder_advance_stations` returns the moved W20-1.
  - `fines_double_envelope` takes R2-10 and the group from it, keeps today's in-zone assemblies and adds `_fill_plaques` (Q3, R2). Leftover gaps go in `long_gaps`.
  - `construction_plaque_zone_length` (R3).
- `src/api/audit.py`:
  - Stations come from the same producers.
  - Position labels: "R2-10", "Speed limit group", "Fines Double plaque", with " (Case 11)" on Case 11.
  - The spacing text names the group and R2-10.
  - `plaque_long_gaps_ft` appears in the envelope only when a gap is left. It drives a `fines_double_spacing` pending item that quotes Sheet 2 Note 4's engineer clause (tracking #360).
- `src/narrative/crew_narrative.py`: the R2-10 and entrance R2-1 distance text, read off the placements.
- `src/rules/validators.py`: R5. `src/rendering/plan_sheet.py`: R4.

## Probe (`probes/`)
`probe-3f92e6a.txt` (before): 136 of 144 plans had R2-10 or W3-5 at or past the taper start. `probe-after.txt`: 0 of 144.

## Renders (`renders/`)
Page 1, before and after, for urban_high 55→45, rural 75→65, expressway 65→55 and freeway Case 11 55→45 (1,000 ft of work, divided). `render_page1.py` made them; `before-signs.txt` and `after-signs.txt` list every sign station.
- urban_high 55→45 after: W20-1 4,108 · W3-5 3,758 · R2-10 3,228 · group 2,728 · W20-2 2,378 · W21-5aR 2,028 (taper start 1,178). No legal plaque spot (350 ft spacing), so the audit carries the engineer note for the 2,728 ft gap.
- Before, the same plan had W3-5 at 2,030, 2 ft from the W21-5aR at 2,028, and R2-10 at 1,500, inside the taper.

## Tests
- New: `tests/s630/test_advance_anchoring_360.py`, 346 tests. It runs the station grid over both generators × 4 classes × 7 speed pairs × 3 lengths, the fill, the Case 11 VAR slot, no group where another rule places the signs, the audit lists W3-5(70), Case 11 labels, the engineer note, the crew sheet, and the in-zone plaques.
- Red proof on base `3f1e0ab` (`red-proof-3f1e0ab.txt`, via `git archive`, missing import stubbed to None): 343 failed, 3 passed. The 3 that pass are the "no speed group" checks, which hold trivially on base.
- Full suite: 3442 passed, 2 skipped (baseline 3096 passed, 2 skipped).

## Rule 5 accounting
- **Snapshots:** predicted 7, re-recorded 7 (`rerecord/`): `grid_reduced_55_45`, `_55_50`, `_65_60`, `_75_65`, `_75_70`, `audit_shoulder_reduction_10`, `_25`. Every other snapshot is byte-identical, including `audit_shoulder_reduction_65mph_envelope` (Sheet 14) and the flagger and NI ones.
- **Tests updated** (all pinned the old R2-10 at work zone + 500 ft or its consequences):
  - `test_case_11.py` ×2.
  - `test_sheet14_series_344.py` ×1: #344 S3's "others keep work zone + 500", superseded by Q1/Q2.
  - `test_audit_endpoint.py` ×2 geometry, plus the 2 re-recorded snapshots.
  - `test_generators.py` ×5.
  - `test_r117_pdf_notes.py` ×1: the Case 11 75→40 table is now 17 entries; page 1 draws 13 and names 4 in the "+N MORE" line.
  - `test_rules.py` ×1 passes unchanged after R5.
- **Misses, recorded honestly:**
  1. The step-5 in-zone G20-5P growth wasn't in the prediction. It was caught in the expressway render and resolved under Q3 (R3).
  2. The page-1 table fixes (R4) and the validator bound (R5) weren't predicted. R4 changes how Case 26/27 PDFs draw a row whose text overlapped; their placements and audit stay byte-identical.

## Round 2 (Ryan's review of `001ee3a`)
- **Stale renders:** the after PNGs (11:15) predated R4's code-column fix (11:21). All four are re-rendered from the current code, and I looked at every image: whole pages plus a crop of each notes box. Every code clears its description, every description clears its distance, and the advance title clears its headers. Case 11 55→45 shows all 14 rows.
- **Title overlap (R6):** 1.5 pt more under the advance title in two-column mode.
- **New rendered-output test:** `test_page1_two_column_table_text_never_touches` (Case 11 55→45, Case 26) reads glyph boxes off page 1. It checks: title descenders ≥ 1 pt above the header caps; every W21-5aR ≥ 2 pt before its description; the entrance R2-1 description ≥ 2 pt before its distance. Red proof is in `red-proof-glyph-gaps.txt`: on `001ee3a` both fail on the title (−0.30 pt); on base `3f1e0ab` Case 26 fails the same way.
- **Rule 5 (not predicted):** `adv-shoulder` (worst-case fixture: Englewood, 45→25, three jurisdiction conflicts) used to print "+4 MORE ADVANCE SIGNS". It now shows all 9 advance rows.
  - The mechanism: the conflict footnotes are fitted after the table and collapse to one aggregate line when the cursor is low. The extra 1.5 pt makes them collapse one step earlier, into "† 3 ADOPTED-SOURCE CONFLICTS… SEE JURISDICTION PANEL", which frees room for the rows.
  - Both states disclose everything (Rule 10).
  - `test_plan_sheet_footer_235.py::test_every_cut_line_names_its_codes` keeps its check but now needs ≥ 1 cut line among the fixtures (adv-flagger), not ≥ 2.
