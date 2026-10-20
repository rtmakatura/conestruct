# #354 outcome — the W20-1 and G20-5P faces match the sheets the plan cites

## The change
`src/rules/sign_codes.py`, two edits:
- `SIGN_DESCRIPTIONS["G20-5P"]` is now `"WORK ZONE plaque"` (rulings S2).
- `substitute_sign_description` gives W20-1 the face `"ROAD WORK ½ MILE"` when `sheet_14_freeway_series(params)` is true (rulings S1). "½" is U+00BD (S3).

Every surface reads these two producers, so nothing else in `src/` changed.

## Proof (Rule 11, through the real producers)
`tests/s630/test_sheet14_faces_354.py`, 5 tests:
- **Case 26, Case 27, Case 26 undivided:** the results breakdown (`/render/audit` with `include_breakdown`), page 1 (`/render/pdf`), the crew sheet (`/render/markdown`) and the XLSX Device List all print W20-1 "ROAD WORK ½ MILE" and G20-5P "WORK ZONE plaque". "ROAD WORK AHEAD" and "CONSTRUCTION ZONE" appear on none of them. Page 1 and the crew sheet print the W20-1 at 2,640 ft, the distance the face states.
- **Case 11 (freeway 55 → 50) and a rural divided 65 → 60 plan:** W20-1 stays "ROAD WORK AHEAD", G20-5P reads "WORK ZONE plaque", no "½ MILE".
- **Red proof:** the same file against the unfixed base (`git archive` of `204ff54`) gives `5 failed`.

The audit's advance `sign_table` carries code, position, station and distance, not faces. The faces reach the audit response through its breakdown, which the test reads.

## The glyph
- Page 1's text layer carries `\xbd` (U+00BD): `W20-1 ROAD WORK \xbd MILE 2640 ft`.
- `page1-w20-1.png` in this folder is page 1 of the Case 26 harness plan, rendered at 4x around the W20-1 line. The fraction draws in Helvetica.
- XLSX and Markdown: the tests compare the exact U+00BD string.

## Evidence files
- `sheet14-faces.png`: S-630-1 Sheet 14 (PDF p. 162) crops of the two W20-1 faces and the two G20-5P / G20-5 plaques.
- `page1-w20-1.png`: the plan's page 1 line.

## Tests
- `3078 passed, 2 skipped` (baseline `3073 passed, 2 skipped` + 5 new). One existing assertion moved, as predicted (`test_sheet14_series_344.py:100`).
- ruff clean; mypy `Success: no issues found in 49 source files`.
