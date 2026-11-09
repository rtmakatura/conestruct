# #461 evidence: the CONFIRM question clears the 390 strip

Rulings: `rulings.md` (N1-N4). Issue: https://github.com/rtmakatura/conestruct/issues/461.

## How it was measured

- Local walk `script/walk461.mjs` (launcher `script/launch.cjs`, backend stub `script/serve_stub.py`, both copied from #460's), Chromium at DPR 1, `next dev` on this worktree, Overpass stubbed (replay of `ux-group3-where`'s recorded answers, never live), `/api/road-bearing` stubbed. The same steps as #456's walk (`ux-map-in-view/evidence/script/walk.mjs`), from the pin's Save & Close (#460's landing) on.
- The measure #456's walk lacked: **cover** = the bottom edge of whatever is pinned under the nav at that moment (the strip, or the Show map row), read off the page (computed `position: sticky` and its top on the nav's bottom); the nav's bottom when nothing is pinned. **Heading clear** = the question heading's top at or below the cover and its bottom inside the window. **First line clear** = the sentence's (`.nyq-why`) top at or below the cover and its first line inside the window (`-` = the question has no sentence; the kind question).
- Before = `401d7611` (this branch's base, #460 and #465 in). After = this diff. Same dev server, hot-reloaded. Screens and the per-step JSON stayed in the scratchpad; the crops cited are committed under `crops/`.
- Playwright's click scrolls its target into view first, the way a person scrolls to reach a button; the large `y` moves on 05, 06 and 12 come from that, not from the page.

## 390: heading and first line against the strip (Y = clear, N = covered or off the window)

| step | 390x844 before | after | 390x664 before | after |
|---|---|---|---|---|
| 01 kind question (after Save & Close) | Y - | Y - | Y - | Y - |
| 02 kind answered | Y - | Y - | Y - | Y - |
| 03 side question (Next) | Y Y | Y Y | **N N** | Y Y |
| 04 side answered | Y Y | Y Y | Y Y | Y Y |
| 05 kind reopened (its row) | **N -** | Y - | **N -** | Y - |
| 06 side reopened (Undo) | **N N** | Y Y | **N N** | Y Y |
| 07 side answered again | **N N** | Y Y | Y Y | Y Y |
| 08 scrolled by hand to 400 | Y Y | Y Y | Y Y | Y Y |
| 09 map hidden | Y Y | Y Y | Y Y | Y Y |
| 10 side reopened, map hidden (Undo) | Y Y | Y Y | **N N** | Y Y |
| 11 Show map | Y Y | Y Y | **N N** | Y Y |
| 12 near-intersection kind answered | Y - | Y - | **N -** | **N -** |
| 13 tap question | Y Y | Y Y | Y Y | Y Y |
| 14 tap found | Y Y | Y Y | Y Y | Y Y |
| 15 side question after the tap (Next) | Y Y | Y Y | **N N** | Y Y |

Numbers (after; px from the window's top): with the strip pinned the cover is 202 (52 nav + 150), and the heading lands at 209.5-209.8 and the sentence at 265 (05, 06, 07 at 844; 03, 04, 05, 06, 07, 11, 15 at 664), which is N1's 8 px under the strip. With the map hidden (10 at 664) the cover is 96 (52 + 44) and the heading lands at 103.5. Before, the same states had the heading at 119.5-119.8 (844) and -54.5 to 45.5 (664), under the strip.

Crops, before and after (same step, same size): `crops/before/` and `crops/after/` `390x664-03-03-side-question.png`, `390x844-05-05-kind-reopened.png`, `390x844-06-06-side-undone.png`, `390x664-10-10-hidden-after-undo.png`, `390x664-11-11-map-shown.png`, `390x664-14-15-side-after-tap.png`. In each "before" the strip sits on the question (or the question is above it); in each "after" "Which side of the road is the work on?" / "What kind of work is it?", and, for the side question, the sentence's first line, sit just under the strip.

07 at 844 is clear after because 06's scroll put the side option on screen, so the click no longer scrolled the page.

**Not met: 12 at 390x664.** The kind question is already open; the near-intersection answer is the last chip, below the window, so the click (like a person) scrolls down to it, and the heading goes under the strip (heading top 136.5, cover 202, before and after alike). #461's acceptance says "on every CONFIRM question", and this state misses it. The scope is narrowed on purpose (rulings N3a, R145 self-ruled): an answer on the same question does not scroll, because that would move the chip just tapped. The miss is filed as https://github.com/rtmakatura/conestruct/issues/468, and no answer trigger is added here.

## #446's tap scroll and P1

- The tap's scroll is unchanged: 390x844 `y 117 -> 227`, 390x664 `y 214 -> 421`, before and after (step 14). M8's opening scroll (step 13) is unchanged (y 117 and 214, before and after).
- Layout shift without input (CLS entries with `hadRecentInput` false), whole walk: 390x844 0.0241 before, 0.0241 after; 390x664 0.0002 before, 0.0001 after. N2's scroll only follows a click.

## Desktop (N4): measured first, no change

With #460's landing in (this branch's base), the page never leaves the landing (y 99) on any of the eleven measured states (steps 01-07 and 12-15 above; 08-11 are narrow only), and the aerial is wholly in view on all of them, before and after alike:

| size | states | y | aerial frame (px) | aerial whole | heading clear | CLS without input, before / after |
|---|---|---|---|---|---|---|
| 1440x900 | 11 | 99 | 157.5..717.5 | all | all | 0.0035 / 0.0035 |
| 1198x930 | 11 | 99 | 157.5..717.5 | all | all | 0.0067 / 0.0049 |
| 1024x768 | 11 | 99 | 157.5..717.5 | all | all | 0.0268 / 0.0268 |

So the issue's desktop case (the sticky with no room) needed #460, as the issue foresaw, and no change here (N4). The sticky's lack of room is still true when the page is scrolled by hand past the band's top with a short right column; nothing in the walk does that.

Raw lines: `walk/before.txt`, `walk/after.txt` (one line per step: scroll y, cover, heading top, sentence top, clear flags, frame, aerial whole).

## Not run

- axe: not run on this diff. It adds no element, no attribute and no text, only a scroll margin and a scroll; #456's walk ran axe on these states (0 violations).
- Widths other than the five walked; the card reopening from a row after it was closed (N2a); a north-south road.

## Tests

- Red proof against the old source (`WhereBand.tsx` at `401d7611`, CSS unchanged): `red-vitest.txt`, 3 failed | 1 passed (the two-column guard passes on old and new alike).
- Repair 1 adds the tap-question case. Its red proof, with N2's `crossOpen` bail removed and then restored byte for byte: `red-vitest-tap.txt`, 1 failed | 4 passed.
- Rule 5 timing (repair 1): the reviewer read the files' creation times and found rulings.md created after the diff. The prediction was in fact written first; that time is reset by later edits. The session order is set out in rulings.md under "Rule 5 churn prediction". So there was no Rule 5 slip, but two edits to the prediction section came after the diff, and both are listed there.
- After: `WhereBand.strip-question.test.tsx` 4 passed (5 after repair 1); affected files (`components/bands/WhereBand*`, `BandAerial*`, `WhereQuestions*`, `lib/cross-street-reveal*`) 11 files, 80 passed.
- Full vitest after: 275 files passed | 1 skipped; 2972 tests passed | 1 skipped (baseline at `401d7611`: 2968 passed | 1 skipped; +4 is the new file).
- pytest baseline at `401d7611`: 3908 passed, 3 skipped. Not re-run: the diff touches no Python.
- `tsc --noEmit`: clean.
