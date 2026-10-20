# #342 checkpoint and Rule 5 prediction

Written before the diff. Base: `issue-345-prod-check` (`73d2833`, #345's production-check evidence, on `f7e4d48`), so the evidence commit ships with this fix.

## Plan
1. **Problem.** Three generators leave the buffer bare:
   - `src/generation/layout.py:2308`, the flagger: "# 4. Buffer space — intentionally empty."
   - `layout.py:1263`, the divided lane closure: the same line.
   - `layout.py:1843`, the near intersection: it only fills the buffer on the far side.

   The audit (`src/api/audit.py:714`), the crew sheet (`src/narrative/crew_narrative.py:417`) and page 1 (`src/rendering/plan_sheet.py:5147`) count buffer cones only when `closure_type == "shoulder"`.
2. **Rulings.** S1–S4 in `rulings.md`, R145 self-ruled. They carry #333 S1–S3 over.
3. **Change.**
   - The three generators place `buffer_cone_stations(...)` on their own tangent line.
   - A new `buffer_carries_cones(params, approaches)` replaces the three shoulder checks.
   - The crew template's flagger and near-intersection step 3 take #333's buffer sentence.
   - The near-intersection companion count now counts the far side only.
   - The XLSX, quote and device summary count every CONE placement, so they change on their own.

## Rule 5 prediction
**Changes.** Every flagger, divided lane-closure and near-side near-intersection plan gains buffer cones. Table 6B-2's buffer is longer than 2S at every speed these kinds take, so no plan of these kinds stays the same.
- **Snapshots (31).** `tests/snapshots/corpus/flagger_grid_*` (27), `ni-grid-near-35x45-2ap` and `ni-grid-near-midblock-rural` (2), `audit_flagger_reduction_carve_out_pre_correction` and `audit_flagger_reduction_fines_double_required` (2). If a `_pre_*` file is a frozen historical fixture, it doesn't move; that gets checked when they're regenerated.
- **What moves.** Only the spacing section's cone fields: `buffer_count_text`, `n_buffer_cones`, `buffer_cone_spacing_ft`, `result_text`, `formula_text`, and the `downstream_count_text` cone total.
- **Other surfaces.** Crew-sheet step 3 on these kinds, page-1 buffer labels, and the device counts on the XLSX, quote and device summary.

**Byte-identical.** All shoulder snapshots: `grid_*` (43) and `audit_shoulder_*` (14). The far-side near-intersection snapshots, `ni-grid-far-buffer-anchor` and `ni-grid-far-curb-anchor`. TA-23 plans, mobile and work beyond the shoulder.

## Proof
- **New `tests/test_buffer_cones_342.py`, payload-level (Rule 11):**
  - On the three kinds, no gap along the closed lane's edge from the work zone to the taper exceeds 2S.
  - The audit, crew sheet, XLSX and page-1 label counts agree.
  - Shoulder and far-side placements are unchanged.
- **Red proof:** the new tests fail on the base, run through `git archive`.
- **Evidence** in this folder: `outcome.md`, and the page-1 before/after images.
