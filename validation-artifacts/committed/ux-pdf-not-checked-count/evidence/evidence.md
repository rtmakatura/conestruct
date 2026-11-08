# #451 evidence

## Repro, rendered locally

`script/repro_pdf.py` posts the issue's plan (1600 E Colfax Ave, Denver, Shoulder, One-way confirmed, schedule "Not set"; the payload is `colfax()` in `tests/test_pdf_not_checked_count_451.py`) to `/render/audit-pdf` through the local TestClient, with no site scan, and writes page 1 and the section as text plus a PNG of each page. `before-*` is the base `b88700b`, `after-*` this branch.

- `repro/before-page-1.txt` and `repro/after-page-1.txt`: the cover reads "2 not checked yet". The two files are byte-identical.
- `repro/before-section.txt`: "1 reference(s) not checked yet." then the #308 sentence and link, then one bullet that repeats it. No work-hours line.
- `repro/after-section.txt`: "2 items not checked yet." then two bullets: the #308 item and "Work hours not checked (schedule marked Not set: hours not evaluated)".

This local plan has one pending-verification item, not the two in #450's walk: the walk ran with the replayed site scan and road relays, which this repro doesn't send. The split is the same (cover counts the hours, the section didn't).

## Red proof

`red-pytest-on-base.txt`: the new test file run against the base code (only the test file new). The two PDF tests fail with the cover and section numbers `(2, 1)`; the block-level test fails on the missing `pending_fact_ids`. Two cases pass on the base (schedule set, no jurisdiction), where the counts already matched. That run used the first draft of the file; later edits changed one expected first line (X5) and added `test_nothing_pending_keeps_the_flat_note_and_link`, which were not red-run.

The red run overlapped the baseline full run in time (two test runs at once, against the one-run rule). Neither result depended on the other.

## Tests

- Baseline on `b88700b`: `3899 passed, 3 skipped`.
- This branch: `3905 passed, 3 skipped` (+6: the new file's 6 cases). mypy `Success: no issues found in 49 source files`; ruff check `All checks passed!`; ruff format `271 files already formatted`.
- Churn against `checkpoint.md`'s prediction: as predicted. Changed tests: `tests/s630/test_fines_double_note_363.py`, `tests/test_not_checked_yet_450.py`; no snapshot fixture moved; `repro/before-page-1.txt` and `repro/after-page-1.txt` are byte-identical.

## Repair 1

- Changes: X5 narrowed (flat note/link only when the section has no bullet), X6 (section stands with no `pending_verification` block), X7 (absent schedule reads "Not set"); `src/api/render_api.py` and `src/rules/jurisdiction.py` joined the diff (flag pass-through; two note constants, values unchanged). Three new cases: the date-without-times PDF case and two block-level tests (`test_hours_alone_print_no_general_tracking_link`, `test_hours_without_a_pending_block_still_get_the_section`). The two block-level tests were not red-run against the pre-repair code.
- The repro was regenerated after repair 1; `after-page-1.txt` and `after-section.txt` came out byte-identical to the committed ones (the repro sends `date_mode: "tbd"`), so `repro/` was not refreshed. Backing: `repro-regenerated-after-repair-1.txt` (sha256 of each regenerated and committed extract, and the `cmp` result); the regenerated files themselves were not kept.
- Full run after repair 1: `3908 passed, 3 skipped`; mypy `Success: no issues found in 49 source files`; ruff check `All checks passed!`; ruff format `271 files already formatted`. No snapshot fixture moved.

## Known limits

- **Page vs PDF, no-windows jurisdiction (P2, filed #463).** For a jurisdiction with no windows (`data/jurisdictions/cdot.json` `"windows": []`, `el_paso.json` `shape: "none"`) and the default Not set schedule, the page row says 'Schedule marked "Not set". These windows are reference only…' (`conestruct/site/lib/reference-sections.tsx:180-183`, the Not-set branch ignores `hours_eval.note`), while the PDF says "Work hours not checked (jurisdiction publishes no work-hour windows)". The PDF is the true one. https://github.com/rtmakatura/conestruct/issues/463
- **The bracketed reason in the `indeterminate` case (filed #462).** https://github.com/rtmakatura/conestruct/issues/462
- **`NO_SCHEDULE_NOTE`'s comment is too narrow.** `src/rules/jurisdiction.py:266-267` calls both notes "for a schedule nobody set", but `NO_SCHEDULE_NOTE` is also the note for a date mode with no times (`jurisdiction.py:305`). The behavior is right (`_hours_reason` swaps it only when `schedule_not_set`); the comment is not. Not fixed: this round is write-up only.
- **A future pending fact would raise.** `src/rendering/audit_blocks.py:793` assumes every non-hours pending fact is `audit:pending:<i>`. Today `tier_facts` emits no other pending id; a new one would raise mid-render instead of printing.
- **Legacy shape with an empty note.** `src/rendering/audit_blocks.py:801`: a `pending_verification` with a count, no `items`, and an empty note and link would print an empty bullet. `src/api/audit.py:3033` doesn't produce that shape today (a count above 0 always comes with `items`).
