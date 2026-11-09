# #459 evidence: the verdict strip names the WHERE confirm

Branch `issue-459-strip-where-confirm` on `5e6f44c` (#461's tip). Rulings and the plan: `rulings.md` in this folder.

## The strip, by state (the ranks above INVALID INPUT)

| State | Strip | Changed? |
|---|---|---|
| No pin | ◌ NO SITE CHOSEN YET (#435 ruling 7; below input error and refusal, as before) | no |
| A pin, no kind chosen (`kindState` `none`) | ◌ AWAITING KIND OF WORK | no |
| A pin, kind chosen, side owed (`picked`) | **◌ AWAITING WHERE CONFIRMATION** | was ◌ AWAITING KIND OF WORK |
| A pin, kind chosen, side answered, Confirm not pressed (`picked`) | **◌ AWAITING WHERE CONFIRMATION** | was ◌ AWAITING KIND OF WORK |
| Kind confirmed, side unconfirmed | ◌ AWAITING OCCUPIED SIDE | no |
| Kind and side confirmed | input error, refusal, verifying and verdict branches as before | no |

Seen, not changed: the comments at `StatusBar.tsx:27` and `:166` still call the no-pin state "AWAITING LOCATION"; the rendered words are "◌ NO SITE CHOSEN YET" since #435 ruling 7.

The rank of the `picked` state is unchanged (it rendered the kind branch, ranked first; it now renders its own branch right after it). The WHAT row and the Generate hint are untouched; in the `picked` state they read "Opens after you confirm where" and "Confirm where the work is first" (#456 ruling 4), so the three surfaces now name one state. The same states are listed under #456's table in `validation-artifacts/committed/ux-map-in-view/evidence/evidence.md`.

## Churn: predicted vs actual (Rule 5)

| File | Predicted | Actual |
|---|---|---|
| `conestruct/site/components/StatusBar.tsx` | about 20 lines | +21 |
| `conestruct/site/components/GeneratorShell.tsx` | about 6 lines | +3 / -1 |
| `conestruct/site/components/StatusBar.test.tsx` | about 20 lines | +22 |
| `conestruct/site/components/GeneratorShell.no-location.test.tsx` | about 10 lines; about 17 after repair 1 (amended 2026-11-08) | +10; +16 after repair 1 |
| `validation-artifacts/committed/ux-map-in-view/evidence/evidence.md` | 1 line | 1 line |

No other file and no existing assertion changed.

## Tests

- Baseline (`5e6f44c`): vitest `2973 passed | 1 skipped`; pytest `3908 passed, 3 skipped`.
- Red proof against the old source: `red-vitest.txt` (2 failed | 44 passed; the mounted test fails on the missing `strip-where-unconfirmed`, the unit test on the missing branch).
- After the fix: affected files `46 passed`; full vitest `2974 passed | 1 skipped` (+1 test: the StatusBar unit test; the mounted asserts extend an existing test). `tsc --noEmit` clean.
- Repair 1 (2026-11-08): the mounted test also asserts the cta-reason beside the new strip and the strip's absence after the confirm; that absence assert was red-proved (`red-vitest.txt`, repair 1 section). Affected files `46 passed`; full vitest `2974 passed | 1 skipped`; `tsc --noEmit` exit 0.
- Not run: a browser walk, axe and widths (the acceptance names a mounted test; the change is one string in an existing chromeless strip variant with the same class, glyph and slot height). Backend untouched, so pytest was not re-run after the change.
