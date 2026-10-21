# #363 outcome (R2: option (c))

## Change
- `src/api/audit.py`: the envelope carries `plaque_long_gaps_sign_spacing_ft` (Table 6B-1 A/B/C), only when plaque gaps stay over 2,640 ft and the plan isn't Case 11 (R3). The `fines_double_spacing` note names the spacing, the 250 ft clearance (S-630-1 Sheet 12 Note 4) and Sheet 2 Note 4's engineer clause. `FINES_DOUBLE_SPACING_ISSUE` is `None` (R2).
- `src/rendering/audit_blocks.py`: an item or summary line with no tracking link prints no "()" or "Tracking:" (R4).

## Byte identity against the prediction (`byteid.py`, `byteid_compare.py`)
- Grid: 96 plans: 4 wire road types × 8 speed pairs (7 reduced, 1 not) × 3 work lengths. Surfaces checked: the audit JSON, audit PDF text, plan PDF text, crew markdown and XLSX cells. XLSX timestamps are masked, because Summary!B8 is the export time and changes on every run.
- Base `a486176` vs after (`byteid-compare.txt`): **14 plans move, all `urban_arterial`, all with the note, on the audit and audit PDF only.** The other 82 don't change on any surface, including every rural and freeway plan. No plan PDF, crew sheet or XLSX changes. This matches the Rule 5 prediction in `rulings.md`.

## Crops for Ryan (`crops/`, from `crop_note.py`)
- `urban-55-45-L1000-audit-pdf-note.png`: audit PDF p. 4, urban_arterial 55 → 45, 1,000 ft of work, after.
- `urban-55-45-L1000-audit-pdf-note-before.png`: the same plan at base.
- The note prints twice, as it did before: once on the summary line (the flat `note` mirrors the first item) and once as the item bullet. That repetition is unchanged by #363.

## Red proof (`red-proof-a486176.txt`)
The new suite run on base code (`git archive` of `a486176`): 4 failed, 3 passed. The 3 that pass are the rural/freeway guards, which already hold at base.
