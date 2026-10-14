# Rule 5 outcome: `issue-266-colorado-heading` (#266)

Prediction: `prediction.md` (committed `13aaa08`, before any change).

| Predicted | Outcome |
|---|---|
| Live kinds' audit PDFs unchanged | ✓ a shoulder plan's heading still reads "Colorado Requirements (CDOT S-630-1)" (its summary's `cdot_sheet`); `tests/test_audit_pdf.py` passes unchanged |
| The divided lane closure prints S-630-3 | ✓ "Colorado Requirements (CDOT S-630-3)", from `cdot_sheet: "S-630-3"` |
| No sheet, no sheet named | ✓ "Colorado Requirements" |
| No snapshot changes | ✓ Python suite 2794 passed, 2 skipped |

Tests: `tests/test_audit_colorado_heading.py` (3), through `audit_projection` and
`audit_to_blocks`.
