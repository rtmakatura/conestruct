# #547 (findings 1 to 3): the dead bearing note goes

Mission `coords-wrong-pin` (tracking #549), item #547. Branch `issue-547-dead-bearing-note`, stacked on `prompt-coords-wrong-pin` (65615703). Line numbers below are at that base.

This plan and its prediction were written before the diff.

## Plan

1. **Problem.** `conestruct/site/components/LocationPickerModal.tsx:485` declares `bearingWarning`. Its only setters are `setBearingWarning(null)` (`:782`, `:820`), so the slot at `:1560` (`{bearingWarning && <p className="mw-note mw-search-line">{bearingWarning}</p>}`) can never render. Two comments still call the note a line in the list (`LocationPickerModal.tsx:1537-1539`, `conestruct/site/app/globals.css:5490`), and `LocationPickerModal.coords-bar.test.tsx:499-512` pins the slot by reading the source text.
2. **Rulings.** Ruling 2 and ruling 3 of `docs/prompts/cc-prompt-coords-wrong-pin.md` (Ryan, 2026-11-23), quoted in `rulings.md`.
3. **Change.** Delete the state, its section heading comment, the two `null` setters and the slot. Reword the two comments so they name only the coarse-match notice. Delete the source-text test and reword the comment above its `describe`. Fold-in (R154): the #545 test comment that puts quote marks round a flattened ruling 1 (#547 finding 8) is reworded so it no longer claims the exact text.
4. **Rule 5 churn prediction.** No behaviour change. Nothing rendered changes: the slot's condition was always false, so the DOM, every box, every string, every API body and every device count are byte-identical. No new string, no new hex, no new CSS rule, no CSS rule removed (`.mw-search-line` and `.mw-search-list` are still used by the coarse notice and the search's own lines).

   | File | Predicted |
   |---|---|
   | `conestruct/site/components/LocationPickerModal.tsx` | +2 / -8 (state, heading, two setters, slot; a three-line comment becomes two) |
   | `conestruct/site/app/globals.css` | +1 / -1 (one comment line) |
   | `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx` | about +8 / -22: the slot test and its comment (-13), the `describe` comment (about +2 / -3), finding 8's comment (about +6 / -6). One test fewer in the file; no other test changes. |
   | this evidence folder | new |

   Not touched: `lib/search-coords.ts` and its tests, the coordinates-refusal strings, the two geocode senders, findings 4 to 7 of #547.
5. **Proof.** There is no red proof: the deleted code could not run, so no test can fail on the old code for it (the only test that named it is the one deleted). The proof is (a) `git log -S` and grep showing no setter passes a string (`removed.md`), (b) the `LocationPickerModal.*` vitest files and the tests that read `globals.css`, `tsc --noEmit` and lint, (c) one walk script run on the base code and again on the fix at 1440x900, 1198x930 and 390x844, comparing the floating list's HTML and box and the map, search row, right panel and bar boxes in three states (no line, the coarse-match notice, an out-of-range line): 0 px, the same HTML, axe 0 (`walk.md`).
