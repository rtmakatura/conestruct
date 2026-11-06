# Red proof: the #446 tests against the old source (2026-11-06, final test set)

Run by putting `618f7ba`'s six changed source files in place, running the tests, and restoring them (`cmp` checked each). `lib/cross-street-reveal.ts` stayed in place so the mounted file can import it. Tests that pass here are #440 behaviour that had to stay, or guards against a state #446 added.

```
19 failed | 5 passed
FAIL cross-street-mark.answer.test.ts: goes when the pin moves, and doesn't come back when the pin returns
FAIL cross-street-mark.answer.test.ts: stays while the pin and the crossing stay, and clear() forgets it and its point
pass GeneratorShell.cross-street-tap.test.tsx: rulings 1-3: the second question, the armed pin picture, the bar and the big-map button
FAIL GeneratorShell.cross-street-tap.test.tsx: the tap: aerial-point, then the picker's own lookup, then the picker Save's own apply; Move / Cancel
pass GeneratorShell.cross-street-tap.test.tsx: ruling 2 / X20: after the tap, Next asks the side last, and its button is Confirm
pass GeneratorShell.cross-street-tap.test.tsx: X8: no street at the tap says so and keeps the tap armed, writing nothing
pass GeneratorShell.cross-street-tap.test.tsx: ruling 4 / X4: Use the big map instead opens the picker armed, and its Save writes what the tap writ
FAIL GeneratorShell.cross-street-tap.test.tsx: ruling 1: the ring and the finding bar show before the lookup answers; the bar is the band's one liv
FAIL GeneratorShell.cross-street-tap.test.tsx: rulings 2-3: found turns the bar ready, keeps #440's box and label, scrolls the row and the button i
FAIL GeneratorShell.cross-street-tap.test.tsx: T19: when the aerial, the row and the button can't all fit, the bar's words stay clear of the top an
FAIL GeneratorShell.cross-street-tap.test.tsx: T19: with the bar's words already off the top, the scroll still runs, because nothing more is lost
FAIL GeneratorShell.cross-street-tap.test.tsx: T20: from a failed tap, a crossing saved on the big map shows the found bar, no ring, no Try again, 
FAIL GeneratorShell.cross-street-tap.test.tsx: T20: from a none tap, a crossing saved on the big map shows the found bar, no ring, no Try again, an
FAIL GeneratorShell.cross-street-tap.test.tsx: T20: a picker save that changes nothing also clears a failed tap; cancelling the picker doesn't
FAIL GeneratorShell.cross-street-tap.test.tsx: ruling 3: both already in view, no scroll; focus still lands
FAIL GeneratorShell.cross-street-tap.test.tsx: ruling 3: with reduced motion the scroll is a jump
FAIL GeneratorShell.cross-street-tap.test.tsx: ruling 4: failed turns the bar warn with Try again in it and a dashed ring, no scroll; Try again ask
FAIL GeneratorShell.cross-street-tap.test.tsx: T15: with no read answering, the scroll goes at the wait's end; Move or Undo before then calls it of
FAIL GeneratorShell.cross-street-tap.test.tsx: ruling 4: no street there has the same look with X8's copy, and no Try again
FAIL GeneratorShell.cross-street-tap.test.tsx: ruling 5: Move re-arms the bar and Undo clears the box; neither scrolls
FAIL GeneratorShell.cross-street-tap.test.tsx: T7: Undo after a failed tap clears the dashed ring; Move's new tap scrolls again when it is found
FAIL GeneratorShell.cross-street-tap.test.tsx: T6: a crossing marked on the big map shows the found bar without a box, a scroll or a focus move
FAIL GeneratorShell.cross-street-tap.test.tsx: T5: the big-map button stays on in every state, and while a lookup runs it drops that lookup
pass GeneratorShell.cross-street-tap.test.tsx: the bar leaves with the question: after Next, the side's picture has no bar
```

T20's mounted tests also failed against review cycle 1's code, before the fix, and `lib/cross-street-mark.answer.test.ts` fails here because `clear` doesn't exist.

## `lib/cross-street-reveal.test.ts`

At `618f7ba` the module doesn't exist, so the whole file fails on import. Against review cycle 1's helper (cap `min(need, max(room, 0))`) these two failed before the cap was changed: "with the words already under the nav, the scroll runs" (expected 116, got 0) and "that scroll still stops with the row's top at the nav" (expected 98, got 0). A walk confirmed it in the browser: at 390x664 from y=260 on that helper, no scroll was asked for, and the row and Next stayed cut off.

## Superseded

The first red proof on this branch was 11 failed and 5 passed on a smaller file. It's replaced by the run above.

## Repair round 3 (2026-11-06)

Each fix undone on its own, the mounted file run, the fix put back (`.keep` copies; none left in `git status`).

| Fix undone | Failed |
|---|---|
| `openMap` without `leaveForPicker` | T21 Edit on map during a lookup; T21 `where-open-picker` during the wait (2 of 53) |
| `leaveForPicker` without `setRevealOwed(false)` | T21 `where-open-picker` and `band-aerial-big-map` during the wait (2 of 28) |
| No focus on the big-map button | T22 (1 of 53) |
| `useCrossStreetTag` returning any held answer | T23 (1 of 53) |
| `foundSeen` updated only with the heading present | T6 (1 of 53) |
