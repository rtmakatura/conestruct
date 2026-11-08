# #451 checkpoint (written before the diff)

## Plan

1. Problem: `src/rendering/audit_blocks.py:751-785` `_pending_blocks` prints `pending_verification.count` and its items; the cover (`audit_blocks.py:811`) prints `tier_ledger(...)["pending"]`, which also counts `jur:hours` when the schedule isn't checked (`src/rendering/tier_ledger.py:72-75`).
2. Rulings: Ryan's two (rulings.md), quoted verbatim.
3. Change: `tier_ledger.py` gains `pending_fact_ids` (the ledger's pending facts, in page order); `_pending_blocks(projection, jurisdiction)` lists one bullet per id and counts them. Work hours: "Work hours not checked (<hours_eval.note>)".
4. Churn (below).
5. Proof: a new PDF-text test through `/render/audit-pdf` (cover N, section N and bullet count equal; hours bullet present), red on the base; the issue's repro rendered locally, page 1 and the section extracted to `evidence/`.

## Rule 5 churn prediction

Changes:
- Audit PDF, "Not checked yet" section, first line: "N reference(s) not checked yet." becomes "N item(s) not checked yet." ("1 item" / "N items"), N the ledger's pending count. The note and "  Tracking: " after it stay byte-identical. *(Amended before the diff, X5:)* the first line drops the flat note and "  Tracking: <link>" (they repeat bullet 1, or are the general tracker) whenever the section has a bullet; they print after the count only when it has none. *(Repair 1 amendment, written before its diff:)* the earlier rule (keep them at count 0) printed the general #19 link above a lone hours bullet.
- Audit PDF, same section: a last bullet "Work hours not checked (<note>)" on every plan that names a jurisdiction whose hours aren't checked. With it the bullet list appears even when `items` is empty.
- Tests: `tests/s630/test_fines_double_note_363.py` (new `_pending_blocks` signature; the line becomes "2 items not checked yet."), `tests/test_not_checked_yet_450.py` (regex `reference\(s\)` becomes `items?`). New `tests/test_pdf_not_checked_count_451.py`.

Repair 1 amendments (before the repair diff):
- The section renders when there is no `pending_verification` block but the ledger counts unchecked hours (X6).
- Hours bullet reason: an absent schedule reads "schedule marked Not set: hours not evaluated" instead of "no work schedule provided" (X7). New `schedule_not_set` parameter on `render_audit_pdf` / `audit_to_blocks` / `_pending_blocks`, set by `/render/audit-pdf`; `src/rules/jurisdiction.py` names its two notes as constants (values unchanged); `src/api/render_api.py` passes the flag.
- The repro's printed text doesn't move (it sends `date_mode: "tbd"`).

Byte-identical:
- `/render/audit` JSON (no field added or changed), so every audit snapshot fixture: 0 files move.
- The PDF cover, every other PDF section, the plan sheet, XLSX, crew narrative.
- Frontend: nothing touched.
- No device count, spacing, sign placement or plan value moves.
