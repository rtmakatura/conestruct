# Rule 5 outcome: `issue-265-reference-line` (#265, first half)

Prediction: `prediction.md` (committed `17cf255`, before any change).

| Predicted | Outcome |
|---|---|
| Page 1 reads "Reference: CDOT S-630-1, MUTCD 11th Edition Part 6, Colorado Supplement (effective January 18, 2026)." on one line inside the notes box | ✓ in the rendered page-1 text; its width at Helvetica-Oblique 6.5 measured against the box's drawn width (`tests/test_reference_line.py`); "Part 6 (effective" no longer appears |
| Crew header unchanged, character for character | ✓ the template now prints `REFERENCE_LINE`, the same sentence |
| No snapshot changes | ✓ Python suite 2797 passed, 2 skipped |

One producer: `src/rules/references.py`, `REFERENCE_LINE`, read by `plan_sheet._draw_notes`, the
crew narrative's context (`base.md.j2`), and the Streamlit page's closing caption
(`src/api/app.py`, which printed a third wording, "MUTCD 11th Ed., Colorado Supplement (Jan 2026)").

**Repair (diff-verifier, cycle 1):** the first verification found that third literal in
`src/api/app.py`, which the prediction missed; it now reads `REFERENCE_LINE` too. No "Reference:
CDOT" literal is left outside `references.py`.

Open, for Ryan (#265's second half): which edition a plan for a jurisdiction that pins another
should name. `data/jurisdictions/denver.json` pins "MUTCD 2009 R2 (pinned by PT-116.1, April
2022)"; the line names the 11th for every plan, as both deliverables did before.
