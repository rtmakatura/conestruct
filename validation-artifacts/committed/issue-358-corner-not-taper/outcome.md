# #358 outcome

## Before (base `f4f0c23`), served `/render/audit`, `_ni_body()` (near side, alongStationFt -60)

    Downstream taper: 48 ft at ~48 ft spacing -> 1 cones (MUTCD Sec 6B.08: 50-100 ft downstream taper); 9 tangent + 3 buffer + 1 downstream = 13 cones total

## After

    Corner extension: 48 ft past the work zone to the upstream curb line -> 1 cone (no downstream taper; the lane reopens beyond the intersection); 9 tangent + 3 buffer + 1 corner = 13 cones total

- `sections.spacing`: `corner_count_text` and `n_corner_extension_cones: 1` replace `downstream_count_text` and
  `n_downstream_taper_cones`; `n_cones_placed_total` stays 13 and equals the quote's CONE lines (test 2).
- Audit PDF (`src/rendering/audit_blocks.py`) and the Streamlit panel (`src/api/app.py`) print the corner line.
- The site renders `formula_text` as received (`AuditTrail.tsx`), so it needs no change.

## Proof
- `tests/test_corner_extension_audit.py`: 3 tests. Red on base: 2 failed, 1 passed (`red-on-base.txt`); the passing one
  is the midblock guard (alongStationFt -400 keeps "Downstream taper: 50 ft at ~25 ft spacing -> 2 cones").
- Full suite: base `3448 passed, 2 skipped`; after `3451 passed, 2 skipped`. ruff and mypy clean.
- Rule 5: one unpredicted test moved (`tests/test_formula_fields.py::_common` key list); the prediction was
  amended in `rulings.md` before that diff.

## Filed
- #365: `corridor_spec.downstream_taper_ft` still reads 48 on the same plan (`placed_downstream_taper_ft`).
