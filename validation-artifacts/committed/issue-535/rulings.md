# #535 rulings

## Ryan, 2026-11-12 (posted on #535)
- R1: "Undo restores only the times the fix changed, never a later date change."
- R2: "The 'Change my hours to …' button comes back whenever the hours are outside again, even while the record stands."
- R3: "The rest of this issue goes into the spacing round: class-unset days drawn in the inside ink, the stale S9 comments, the no-closures key entry, and the night-week ▾." Not touched here.

## R145 self-ruled
- S1: a second fix, applied while the first record stands, replaces the record. Its Undo puts back the times that fix changed (the times on the page when it was pressed, e.g. a hand edit), not the times before the first fix. This is R1 read literally: Undo restores the times *the fix* changed. Test: `WorkHoursDialog.test.tsx` "#535: the fix comes back while the record stands…".
- S2: in the window the record line ("Hours changed to … Undo") sits above the fix button when both show. Order follows the page: the record of what happened, then the offer. No new copy, no CSS change.
- S3: the stored prior holds `start_time` and `end_time` only. The fix is offered only with both times set (`timed`), so both exist when the fix is applied. Undo merges them onto the schedule as it stands, so date fields and `date_mode` keep any later edit.
