# Red proof: the #446 tests against undone fixes (2026-11-06, repair round 4, rewritten)

Rewritten in round 4 from one run, on the final code. The review found the old version wrong: its "of 53" counts included lib files though it said only the mounted file ran, its top list named a T19 test that no longer exists, and the T19 B tests had never been shown red.

Every count below is of the same 88 tests in the same five files, run together: `components/GeneratorShell.cross-street-tap.test.tsx`, `components/bands/BandAerial.test.tsx`, `lib/cross-street-mark.answer.test.ts`, `lib/cross-street-tag.held.test.ts`, `lib/cross-street-reveal.test.ts`. With nothing undone: 0 failed. Each row undoes one thing in the source, runs them, and puts the file back; the run after the last row was again 0 failed of 88, and the old-source case's files were checked by sha256. The eight source files hash the same (sha256 of their bytes joined in this order, under `conestruct/site`: `components/GeneratorSidebar.tsx`, `components/bands/BandAerial.tsx`, `components/bands/WhereQuestions.tsx`, `components/bands/WhereBand.tsx`, `lib/cross-street-mark.ts`, `lib/cross-street-tag.ts`, `lib/cross-street-reveal.ts`, `app/globals.css`: `f00cc46fc06d039ce42155a2ef80f9a38d439d1328f4bc0707a8230c30562c51`) before the walk and after this run, so the walk and this proof are of one code state.

Tests that aren't listed under a row passed in it. A pure-helper test is named only where the undone line is that helper's.

## Each fix undone on its own

| Undone | Failed | Which |
|---|---|---|
| Round 4 finding 1: `openPicker` without `leaveForPicker` | 10 of 88 | T21: Edit on map during a lookup drops it: no write, no focus, no scroll<br>T21: the bar's big-map button during a lookup drops it: no write, no focus, no scroll<br>T21: Enter in the address field during a lookup drops it: no write, no focus, no scroll<br>T21: the ledger's action during a lookup drops it: no write, no focus, no scroll<br>T21: Edit on map during the scroll's wait calls the scroll off, and cancelling the picker doesn't bring it back<br>T21: the bar's big-map button during the scroll's wait calls the scroll off, and cancelling the picker doesn't bring it back<br>T21: Enter in the address field during the scroll's wait calls the scroll off, and cancelling the picker doesn't bring it back<br>T21: the ledger's action during the scroll's wait calls the scroll off, and cancelling the picker doesn't bring it back<br>T21: a picker opened during a Move's lookup keeps the Move armed when it's cancelled<br>T5: the big-map button stays on in every state, and while a lookup runs it drops that lookup |
| Finding 4: `leaveForPicker` clearing `rearmed` again (its old `cancel()`) | 1 of 88 | T21: a picker opened during a Move's lookup keeps the Move armed when it's cancelled |
| `leaveForPicker` without `setRevealOwed(false)` | 4 of 88 | T21: Edit on map during the scroll's wait calls the scroll off, and cancelling the picker doesn't bring it back<br>T21: the bar's big-map button during the scroll's wait calls the scroll off, and cancelling the picker doesn't bring it back<br>T21: Enter in the address field during the scroll's wait calls the scroll off, and cancelling the picker doesn't bring it back<br>T21: the ledger's action during the scroll's wait calls the scroll off, and cancelling the picker doesn't bring it back |
| Finding 3: the card's Try again not remembering focus | 1 of 88 | T25, T26: the card's Try again failing again doesn't scroll and keeps focus; no street puts focus on that answer's line |
| Finding 5: the hook keeping what it held across keys | 1 of 88 | A, B, A: A's old answer doesn't come back while A is read again, or after that read fails |
| Finding 6: `focusWasDropped` always true | 2 of 88 | T26: a place the person moved focus to during band-aerial-retry Try again stays<br>T26: a place the person moved focus to during cross-retry Try again stays |
| T24: Move without the scroll | 3 of 88 | T24: Move brings the aerial back; nothing else does, and a picture already there stays put<br>T24: with reduced motion Move's scroll is a jump<br>T27: Move on a crossing the big map made re-arms, scrolls, cancels, and a tap there undoes back to it |
| T25: a failed or no-street answer without the scroll | 10 of 88 | T25: a failed tap with its bar under the nav scrolls just enough, once; a bar in view stays put<br>T25: with reduced motion the failed tap's scroll is a jump<br>T25: no street there with its bar under the nav scrolls just enough, once<br>T25: with reduced motion no street's scroll is a jump<br>T25: the bar's Try again failing with its bar under the nav scrolls, once<br>T25, T22: the bar's Try again answering no street with its bar under the nav scrolls, once, and focus lands<br>T25: the tap's own coordinate read refused: the failed bar, its scroll, and Try again asks from the tap<br>T25: the tap's own coordinate read garbled: the failed bar, its scroll, and Try again asks from the tap<br>T25: the tap's own coordinate read down: the failed bar, its scroll, and Try again asks from the tap<br>#446 T25: an answer counted while the bar wasn't failed doesn't scroll later; a new one does |
| T25: scrolling a bar already in view (`intoViewDelta` always asking) | 5 of 88 | all in view: no scroll, down to the pixel<br>under a pixel off is already there: where a scroll lands at DPR 2<br>below the fold: just enough to show it<br>T25: a failed tap with its bar all in view doesn't scroll<br>T25: no street there with its bar all in view doesn't scroll |
| T25: an answer seen only while the bar shows it (the late scroll) | 1 of 88 | #446 T25: an answer counted while the bar wasn't failed doesn't scroll later; a new one does |
| T25: the bar's Try again treated as the card's | 2 of 88 | T25: the bar's Try again failing with its bar under the nav scrolls, once<br>T25, T22: the bar's Try again answering no street with its bar under the nav scrolls, once, and focus lands |
| T26: the card's Try again answering no street sending focus to the big map | 1 of 88 | T25, T26: the card's Try again failing again doesn't scroll and keeps focus; no street puts focus on that answer's line |
| T25: the card's Try again counting as a bar failure | 1 of 88 | T25, T26: the card's Try again failing again doesn't scroll and keeps focus; no street puts focus on that answer's line |
| T25: "no street" not counted (Ryan's answer undone in the hook) | 3 of 88 | T25: no street there with its bar under the nav scrolls just enough, once<br>T25: with reduced motion no street's scroll is a jump<br>T25, T22: the bar's Try again answering no street with its bar under the nav scrolls, once, and focus lands |
| T25: the bar's scroll for failed only (Ryan's answer undone in the aerial) | 3 of 88 | T25: no street there with its bar under the nav scrolls just enough, once<br>T25: with reduced motion no street's scroll is a jump<br>T25, T22: the bar's Try again answering no street with its bar under the nav scrolls, once, and focus lands |
| T25: a half-pixel counted as hidden | 1 of 88 | under a pixel off is already there: where a scroll lands at DPR 2 |
| T25: the coordinate read's failures not counted | 3 of 88 | T25: the tap's own coordinate read refused: the failed bar, its scroll, and Try again asks from the tap<br>T25: the tap's own coordinate read garbled: the failed bar, its scroll, and Try again asks from the tap<br>T25: the tap's own coordinate read down: the failed bar, its scroll, and Try again asks from the tap |
| T27: Move needing a tap's snapshot again (#440's `markStands`) | 1 of 88 | T27: Move on a crossing the big map made re-arms, scrolls, cancels, and a tap there undoes back to it |
| T27: a Move outliving the crossing it was pressed on | 1 of 88 | T27: a different crossing saved on the big map ends the Move |
| T19 B: the build A helper (the bar's words cap the scroll) | 4 of 88 | T19 B: the row and the button win, and the bar's words go<br>T19 B: the button is never cut for the words, even by a little<br>T19 B: words lost by more than the margin keep the margin<br>T19 B: when the aerial, the row and the button can't all fit, the row and the button win and the bar's words go |
| T22: no focus on the big-map button | 2 of 88 | T25, T22: the bar's Try again answering no street with its bar under the nav scrolls, once, and focus lands<br>T22: Try again answering no street puts focus on the bar's big-map button |
| T23: the hook returning any held answer, same render | 1 of 88 | T23: re-tapping the same street waits for the new read, not the old one |
| T6: `foundSeen` updated only with the heading present | 1 of 88 | T6: a tap found with the row off the card isn't owed anything when a later big-map save marks the crossing |

## The old source

The six changed source files at `618f7ba` (the sidebar, `BandAerial`, `WhereQuestions`, `WhereBand`, the mark hook, the tag hook). `lib/cross-street-reveal.ts` stays in place so the mounted file can import it, so `lib/cross-street-reveal.test.ts` isn't red here; at `618f7ba` that module doesn't exist, and its tests are shown red by the rows above that undo its lines. 47 of 88 failed. The rest are #440 behaviour that had to stay, or guards against a state #446 added.

```
FAIL cross-street-mark.answer.test.ts: goes when the pin moves, and doesn't come back when the pin returns
FAIL cross-street-mark.answer.test.ts: stays while the pin and the crossing stay, and clear() forgets it and its point
FAIL GeneratorShell.cross-street-tap.test.tsx: the tap: aerial-point, then the picker's own lookup, then the picker Save's own apply; Move / Cancel; Undo r
FAIL GeneratorShell.cross-street-tap.test.tsx: ruling 1: the ring and the finding bar show before the lookup answers; the bar is the band's one live region
FAIL GeneratorShell.cross-street-tap.test.tsx: rulings 2-3: found turns the bar ready, keeps #440's box and label, scrolls the row and the button in, and f
FAIL GeneratorShell.cross-street-tap.test.tsx: T19 B: when the aerial, the row and the button can't all fit, the row and the button win and the bar's words
FAIL GeneratorShell.cross-street-tap.test.tsx: T19 B: with the bar's words already off the top, the scroll runs the same
FAIL GeneratorShell.cross-street-tap.test.tsx: T21: Edit on map during a lookup drops it: no write, no focus, no scroll
FAIL GeneratorShell.cross-street-tap.test.tsx: T21: the bar's big-map button during a lookup drops it: no write, no focus, no scroll
FAIL GeneratorShell.cross-street-tap.test.tsx: T21: Enter in the address field during a lookup drops it: no write, no focus, no scroll
FAIL GeneratorShell.cross-street-tap.test.tsx: T21: the ledger's action during a lookup drops it: no write, no focus, no scroll
FAIL GeneratorShell.cross-street-tap.test.tsx: T21: the bar's big-map button during the scroll's wait calls the scroll off, and cancelling the picker doesn
FAIL GeneratorShell.cross-street-tap.test.tsx: T21: a picker opened during a Move's lookup keeps the Move armed when it's cancelled
FAIL GeneratorShell.cross-street-tap.test.tsx: T24: Move brings the aerial back; nothing else does, and a picture already there stays put
FAIL GeneratorShell.cross-street-tap.test.tsx: T24: with reduced motion Move's scroll is a jump
FAIL GeneratorShell.cross-street-tap.test.tsx: T25: a failed tap with its bar under the nav scrolls just enough, once; a bar in view stays put
FAIL GeneratorShell.cross-street-tap.test.tsx: T25: a failed tap with its bar all in view doesn't scroll
FAIL GeneratorShell.cross-street-tap.test.tsx: T25: with reduced motion the failed tap's scroll is a jump
FAIL GeneratorShell.cross-street-tap.test.tsx: T25: no street there with its bar under the nav scrolls just enough, once
FAIL GeneratorShell.cross-street-tap.test.tsx: T25: no street there with its bar all in view doesn't scroll
FAIL GeneratorShell.cross-street-tap.test.tsx: T25: with reduced motion no street's scroll is a jump
FAIL GeneratorShell.cross-street-tap.test.tsx: T25, T26: the card's Try again failing again doesn't scroll and keeps focus; no street puts focus on that an
FAIL GeneratorShell.cross-street-tap.test.tsx: T25: the bar's Try again failing with its bar under the nav scrolls, once
FAIL GeneratorShell.cross-street-tap.test.tsx: T25, T22: the bar's Try again answering no street with its bar under the nav scrolls, once, and focus lands
FAIL GeneratorShell.cross-street-tap.test.tsx: T25: the tap's own coordinate read refused: the failed bar, its scroll, and Try again asks from the tap
FAIL GeneratorShell.cross-street-tap.test.tsx: T25: the tap's own coordinate read garbled: the failed bar, its scroll, and Try again asks from the tap
FAIL GeneratorShell.cross-street-tap.test.tsx: T25: the tap's own coordinate read down: the failed bar, its scroll, and Try again asks from the tap
FAIL GeneratorShell.cross-street-tap.test.tsx: T27: a different crossing saved on the big map ends the Move
FAIL GeneratorShell.cross-street-tap.test.tsx: T27: Move on a crossing the big map made re-arms, scrolls, cancels, and a tap there undoes back to it
FAIL GeneratorShell.cross-street-tap.test.tsx: T26: a place the person moved focus to during band-aerial-retry Try again stays
FAIL GeneratorShell.cross-street-tap.test.tsx: T26: a place the person moved focus to during cross-retry Try again stays
FAIL GeneratorShell.cross-street-tap.test.tsx: T22: Try again answering no street puts focus on the bar's big-map button
FAIL GeneratorShell.cross-street-tap.test.tsx: T23: re-tapping the same street waits for the new read, not the old one
FAIL GeneratorShell.cross-street-tap.test.tsx: T6: a tap found with the row off the card isn't owed anything when a later big-map save marks the crossing
FAIL GeneratorShell.cross-street-tap.test.tsx: T20: from a failed tap, a crossing saved on the big map shows the found bar, no ring, no Try again, and noth
FAIL GeneratorShell.cross-street-tap.test.tsx: T20: from a none tap, a crossing saved on the big map shows the found bar, no ring, no Try again, and nothin
FAIL GeneratorShell.cross-street-tap.test.tsx: T20: a picker save that changes nothing also clears a failed tap; cancelling the picker doesn't
FAIL GeneratorShell.cross-street-tap.test.tsx: ruling 3: both already in view, no scroll; focus still lands
FAIL GeneratorShell.cross-street-tap.test.tsx: ruling 3: with reduced motion the scroll is a jump
FAIL GeneratorShell.cross-street-tap.test.tsx: ruling 4: failed turns the bar warn with Try again in it and a dashed ring, no scroll; Try again asks the sa
FAIL GeneratorShell.cross-street-tap.test.tsx: T15: with no read answering, the scroll goes at the wait's end; Move or Undo before then calls it off
FAIL GeneratorShell.cross-street-tap.test.tsx: ruling 4: no street there has the same look with X8's copy, and no Try again
FAIL GeneratorShell.cross-street-tap.test.tsx: ruling 5: Move re-arms the bar and Undo clears the box; with the picture in view, neither scrolls
FAIL GeneratorShell.cross-street-tap.test.tsx: T7: Undo after a failed tap clears the dashed ring; Move's new tap scrolls again when it is found
FAIL GeneratorShell.cross-street-tap.test.tsx: T6: a crossing marked on the big map shows the found bar without a box, a scroll or a focus move
FAIL GeneratorShell.cross-street-tap.test.tsx: T5: the big-map button stays on in every state, and while a lookup runs it drops that lookup
FAIL BandAerial.test.tsx: #446 T25: an answer counted while the bar wasn't failed doesn't scroll later; a new one does
```
