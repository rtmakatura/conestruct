# #354 checkpoint — the W20-1 and G20-5P faces match the sheets the plan cites

## The problem
- `SIGN_DESCRIPTIONS["W20-1"]` is `"ROAD WORK AHEAD"` for every plan (`src/rules/sign_codes.py:30`). A Case 26/27 plan (`sheet_14_freeway_series`, `src/rules/validators.py:617`) places its W20-1 at 2,640 ft from the taper (#344), and Sheet 14 shows that sign as "ROAD WORK ½ MILE".
- `SIGN_DESCRIPTIONS["G20-5P"]` is `"CONSTRUCTION ZONE plaque"` for every plan (`src/rules/sign_codes.py:54`). Sheet 14 shows "WORK ZONE", and so does Sheet 2 General Note 4. The crew sheet's own step 4 already prints "Place G20-5P WORK ZONE plaque(s)" for every plan (`src/narrative/templates/base.md.j2:60`), while its sign schedule prints "CONSTRUCTION ZONE plaque". Today's crew sheet disagrees with itself.

## The sources, read by subject
- **S-630-1 Sheet 14** (`validation-artifacts/s630-1-2026.pdf`, PDF p. 162), Cases 26 and 27, read on the rendered sheet (the text layer drops both faces). Crops: `sheet14-faces.png` in this folder. Left to right: Case 26's W20-1 "ROAD WORK ½ MILE", Case 27's W20-1 "ROAD WORK ½ MILE", a plaque captioned "G20-5P" reading "WORK ZONE", a plaque captioned "G20-5" reading "WORK ZONE".
- **S-630-1 Sheet 2** (PDF p. 150), General Note 4:
  > Work Zone (G20-5p) and Fines Double (R2-6p) signs shall be provided every 2640' between R2-10 and R2-11 signs.
- **MUTCD 11th Ed. (December 2023) §6G.08** Work Zone and Higher Fines Signs and Plaques, ¶01, p. 795 (`validation-artifacts/ta10_flagger/mutcd_part6.pdf`):
  > A WORK ZONE (G20-5aP) plaque (see Figure 6G-1) may be mounted above a Speed Limit sign to emphasize that a reduced speed limit is in effect within a TTC zone.

## Where the faces reach the surfaces
Every surface already reads `substitute_sign_description`: the results breakdown and PDF page 1 (`src/api/render_api.py:2024`), the XLSX (`src/export/device_list.py:171`), the quote (`src/export/quote_generator.py:225`), the crew sheet's sign schedule (`src/narrative/crew_narrative.py:153, 258`) and the audit (`src/api/audit.py:1014`). The crew sheet's plaque row reads `description_for("G20-5P")` (`crew_narrative.py:477`), the catalog itself. So two edits in `sign_codes.py` move every surface together (the #51 pattern).

## Rule 5 churn prediction
- **Changes:** on a Case 26/27 plan, every W20-1 face (left and right on a divided road) reads "ROAD WORK ½ MILE" on every surface. On every plan that places a G20-5P, its face reads "WORK ZONE plaque" on every surface.
- **Byte-identical:** every placement, station, offset, count and audit verdict. Case 11 plans and every non-freeway plan keep "ROAD WORK AHEAD". The crew sheet's step 4 line (already "WORK ZONE").
- **Tests:** one existing assertion pins a Case 26/27 face against live output: `tests/s630/test_sheet14_series_344.py:100` (#344's crew row "| W20-1 | ROAD WORK AHEAD | 2,640 ft upstream |"). It moves to "ROAD WORK ½ MILE" on purpose. Two docstrings in `tests/test_verification.py` (lines 363, 413) name the plaque and are updated to match; nothing asserts them. Case 11 and limited-sight pins on "ROAD WORK AHEAD" (`test_case11_spacing_334.py`, `test_limited_sight_331.py`) stay. The six `tests/fixtures/tiering/*.json` files carry "CONSTRUCTION ZONE" as recorded wire inputs. They are read, not regenerated, so they stay as recorded and no test fails. Committed validation-artifacts are past-run records and are not rewritten.
- **Prediction note (Rule 5, recorded honestly):** the first draft of this prediction said no test pins either legend. That grep's output was cut short by `head` and by `.pyc` matches. A full grep caught the #344 pin after the code edit and before the first test run. This amended line is the prediction the run was checked against.
