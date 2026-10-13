# Rule 5 prediction: `issue-286-formula-fields` (Phase 4 branch 5A, #286, R144)

Written 2026-10-13, off main `3fdf074`, before any code. Authority: `../rulings.md` (R144).
Citations: `citations.md`.

## Deliberate changes

**Backend (`src/api/audit.py`, `build_audit_trail`).** New wire fields, all additive; no existing
field changes value.

| Section | `result_text` | `formula_text` (list of lines) | Other |
|---|---|---|---|
| `taper` | `"L/3 = 54 ft"` on a shoulder closure, `"L = 540 ft"` on a lane or near-intersection closure, `"L = 100 ft"` on a flagger closure (the label the panel shows today, from `closure_type`; the number is `L_required_ft`) | `L_calc_text`, then on a shoulder closure `L_third_calc_text`, with "×" in place of the ASCII " x " (the panel's `xify` today) | none |
| `buffer` | `"B = 200 ft"` | none: the buffer is a table lookup; `lookup_text` stays the line the panel shows | none |
| `spacing` | `"22 devices · 30/60 ft o.c."`: taper drums required + tangent cones required (today's frontend sum), in-taper and tangent spacing | `taper_count_text`, `tangent_count_text`, then `downstream_count_text` when present | none |
| `advance` | `"3 signs"`: the sign table's row count (today's frontend count) | none: a table lookup; `road_type_text` and `spacing_text` stay | **`citation`** `{cite: "MUTCD TABLE 6B-1", footer: "MUTCD § 6H.02 · TABLE 6B-1 · ADVANCE WARNING SIGN SPACING"}` from new `_SEC_ADVANCE` / `_TBL_ADVANCE` constants, added to the single-source pin |
| `flagger` (flagger kind only, beside `sight_distance_ft`) | `sight_distance_result_text`: `"360 ft"` | `sight_distance_formula_text`: `["SSD @ 45 mph = 360 ft"]`, the audit's own speed (R144 Q5) | none |

**Frontend (`conestruct/site/components/AuditTrail.tsx`).** The taper, buffer, spacing, advance
and flagger sight-distance rows render only those wire fields:
- the result is `result_text` when the plan is generated, and "—" otherwise or when the field is
  absent (Rule 10; also the deploy window where Vercel leads Modal);
- the formula lines are `formula_text`'s lines;
- **removed:** `labelPrefix` ("L/3"/"L" from `closure_type`), `isShoulder`, `xify`, the "B ="
  label, `totalDevices = nDrums + nCones`, the "N signs" count, the authored advance cite and the
  "MUTCD § 6B-1" footer, the SSD line built from `scenario.speed`;
- the advance row reads `section.citation` like the other three (`sectionCitation`, with a
  fallback constant carrying the corrected footer).

**Not changing:** the setup forms' fixed "MUTCD: ≥45 mph uses L=W·S" line (R144 Q5); the
calculation rows' place in "Checked & passed" (Q3); the explanatory prose sentences in the buffer
and SSD rows (copy, no math); the gated kinds' authored rows (work beyond the shoulder, the mobile
operations: gated under Rule 8, outside #286's live set); the PDF, XLSX and Streamlit surfaces
(they read the existing fields, which keep their values).

## Predicted outcome

**On screen, for the same plan, before vs. after** (production vs. this branch's Preview, shoulder
and flagger plans, every disclosure open):
1. Every result string is character-identical ("L/3 = … ft", "B = … ft", "N devices · a/b ft o.c.",
   "N signs", the SSD "N ft").
2. Every formula line is character-identical, "×" included.
3. **The advance row's footer changes** from "MUTCD § 6B-1 · ADVANCE WARNING SIGN SPACING" to
   "MUTCD § 6H.02 · TABLE 6B-1 · ADVANCE WARNING SIGN SPACING". Its header stays "MUTCD TABLE 6B-1".
4. **The SSD formula line loses its per-token styling** (the `var`/`op`/`res` spans): the same
   characters, rendered like the other rows' formula lines.
5. Rows with no audit yet read "—" where they read "L = —", "B = — ft", "— devices", "— signs".

**Snapshots.** The 16 top-level audit snapshots:

| File | Predicted |
|---|---|
| `audit_flagger_reduction_fines_double_required.json` | changes: the four sections' new fields, `advance.citation`, the two flagger sight-distance fields |
| `audit_shoulder_65mph.json` | changes: the four sections' new fields and `advance.citation` |
| `audit_shoulder_75mph.json` | the same |
| `audit_shoulder_no_reduction.json` | the same |
| `audit_shoulder_reduction_10.json` | the same |
| `audit_shoulder_reduction_25.json` | the same |
| `audit_shoulder_reduction_65mph_envelope.json` | the same |
| `audit_shoulder_urban25_quadratic.json` | the same |
| `audit_flagger_reduction_carve_out_pre_correction.json` | unchanged: an archived `_pre_` baseline, read by no test (`tests/test_snapshot_encoding.py:22-26`) |
| `audit_shoulder_65mph_pre_item2.json` | unchanged (archived) |
| `audit_shoulder_75mph_pre_item2.json` | unchanged (archived) |
| `audit_shoulder_no_reduction_pre_item1.json` | unchanged (archived) |
| `audit_shoulder_no_reduction_pre_item2.json` | unchanged (archived) |
| `audit_shoulder_no_reduction_pre_item3.json` | unchanged (archived) |
| `audit_shoulder_reduction_10_pre_item3.json` | unchanged (archived) |
| `audit_shoulder_reduction_25_pre_item3.json` | unchanged (archived) |

The 74 corpus snapshots (`tests/snapshots/corpus/`): 70 change by added keys only (the 27 flagger
files also gain the two sight-distance fields); the 4 `ni-grid-*` files are placement lists with no
audit and stay unchanged.

| File | Predicted additions |
|---|---|
| `flagger_grid_afad.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_all_toggles.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_duration_long.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_lanewidth_10.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_lanewidth_12.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_lanewidth_13.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_lanewidth_14.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_lanewidth_9.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_night.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_pedestrian_access.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_pilot_car.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_road_urban_arterial.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_road_urban_arterial_35.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_speed_20.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_speed_25.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_speed_30.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_speed_35.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_speed_40.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_speed_50.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_speed_55.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_worklen_2500.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_worklen_500.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_worklen_5280.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_worktype_chip_seal.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_worktype_other.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_worktype_patching.json` | taper, buffer, spacing, advance + flagger sight distance |
| `flagger_grid_worktype_water_main.json` | taper, buffer, spacing, advance + flagger sight distance |
| `grid_duration_long.json` | taper, buffer, spacing, advance |
| `grid_lanewidth_10.json` | taper, buffer, spacing, advance |
| `grid_lanewidth_11.json` | taper, buffer, spacing, advance |
| `grid_lanewidth_13.json` | taper, buffer, spacing, advance |
| `grid_lanewidth_14.json` | taper, buffer, spacing, advance |
| `grid_lanewidth_8.json` | taper, buffer, spacing, advance |
| `grid_lanewidth_9.json` | taper, buffer, spacing, advance |
| `grid_night.json` | taper, buffer, spacing, advance |
| `grid_reduced_55_45.json` | taper, buffer, spacing, advance |
| `grid_reduced_55_50.json` | taper, buffer, spacing, advance |
| `grid_reduced_65_60.json` | taper, buffer, spacing, advance |
| `grid_reduced_75_65.json` | taper, buffer, spacing, advance |
| `grid_reduced_75_70.json` | taper, buffer, spacing, advance |
| `grid_road_freeway.json` | taper, buffer, spacing, advance |
| `grid_road_rural_undivided.json` | taper, buffer, spacing, advance |
| `grid_road_urban_arterial.json` | taper, buffer, spacing, advance |
| `grid_site_adjacent_interchange.json` | taper, buffer, spacing, advance |
| `grid_site_adjacent_intersection.json` | taper, buffer, spacing, advance |
| `grid_site_bicycle_facility.json` | taper, buffer, spacing, advance |
| `grid_site_driveways_present.json` | taper, buffer, spacing, advance |
| `grid_site_limited_sight_distance.json` | taper, buffer, spacing, advance |
| `grid_site_pedestrian_facility.json` | taper, buffer, spacing, advance |
| `grid_site_school_zone.json` | taper, buffer, spacing, advance |
| `grid_speed_20.json` | taper, buffer, spacing, advance |
| `grid_speed_25.json` | taper, buffer, spacing, advance |
| `grid_speed_30.json` | taper, buffer, spacing, advance |
| `grid_speed_35.json` | taper, buffer, spacing, advance |
| `grid_speed_40.json` | taper, buffer, spacing, advance |
| `grid_speed_45.json` | taper, buffer, spacing, advance |
| `grid_speed_50.json` | taper, buffer, spacing, advance |
| `grid_speed_60.json` | taper, buffer, spacing, advance |
| `grid_speed_65.json` | taper, buffer, spacing, advance |
| `grid_speed_70.json` | taper, buffer, spacing, advance |
| `grid_speed_75.json` | taper, buffer, spacing, advance |
| `grid_undivided.json` | taper, buffer, spacing, advance |
| `grid_worklen_1000.json` | taper, buffer, spacing, advance |
| `grid_worklen_10560.json` | taper, buffer, spacing, advance |
| `grid_worklen_500.json` | taper, buffer, spacing, advance |
| `grid_worklen_5000.json` | taper, buffer, spacing, advance |
| `grid_worktype_guardrail.json` | taper, buffer, spacing, advance |
| `grid_worktype_other.json` | taper, buffer, spacing, advance |
| `grid_worktype_signal_cabinet.json` | taper, buffer, spacing, advance |
| `grid_worktype_survey.json` | taper, buffer, spacing, advance |
| `ni-grid-far-buffer-anchor.json` | no audit (placement list): unchanged |
| `ni-grid-far-curb-anchor.json` | no audit (placement list): unchanged |
| `ni-grid-near-35x45-2ap.json` | no audit (placement list): unchanged |
| `ni-grid-near-midblock-rural.json` | no audit (placement list): unchanged |

**Every snapshot diff is additions only**: no existing key's value changes. The outcome checks
this mechanically (a key-by-key diff of before vs. after).

**Tests that move:** `tests/test_audit_endpoint.py`'s formula asserts gain the new fields; the
section-key test (`:183-208`) does not move (no new section). Frontend:
`AuditTrail.test.tsx` (the shoulder fixture's results and the placeholder strings),
`AuditTrail.ni-parity.test.tsx:63` ("B = — ft" becomes "—"), and the fixture
`components/__fixtures__/audit-shoulder-full.json` gains the new fields. New: a backend test of
every field for shoulder, lane, near-intersection and flagger, and a frontend guard that
`AuditTrail.tsx` no longer authors the labels, the sum, or "§ 6B-1".
