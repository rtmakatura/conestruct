# #446 walk evidence (2026-11-06, after repair round 4, with Ryan's answers: B, stays, yes, and his fourth-round go)

Local `next dev` on this worktree against the local backend (`ux-group3-where/evidence/script/serve_replay.py`, Overpass replayed). `/api/road-bearing` is stubbed from the recorded fixture, and its answer is what makes the lookup slow, fail or find no street. The aerial, the tap's coordinate, the geometry read and the nearest-intersection read are live. Playwright Chromium, DPR 2. Sizes: 1440x900 and 390x844 in full, each with a reduced-motion run; 1440x700 and a Safari-sized phone (390x664) through the tap and the scroll; 390x664 again from y=260, once found and once failed. 390x664 and 390x844 are Chromium window sizes, not phones; see Known limits.

Script: `script/walk.mjs`. Every measure: `walk.json`; round 4's: `walk-r4.json`. Pictures: `crops/`. Red proof: `red-proof.md`. The one full-run failure on the way: `full-run-failures.md`.

To put the card off screen as the issue describes, the walk scrolls the page as far up as it goes and taps with the raw mouse, so its own click can't scroll anything.

## Hand check, in order

1. **T19, built as Ryan ruled (B). What B costs at 390x664:** the row and Next are on screen (row 455 to 588, Next 604 to 648 of 664) and the aerial goes: 43 of 250 px left, bar, box and label off screen, so the map's answer is no longer visible after the scroll. `crops/390x664-07-04-found-after-scroll-viewport.png`.
2. **T24, new this round: Move brings the picture back.** At 390x664, from the found tap's scroll, Move asks for -207.25 px and leaves the whole picture under the nav (frame 51.8 to 301.8) with the tap bar readable. What it costs: the row, and the Cancel button keyboard focus stays on, are now off screen. `crops/r4-390x664-03-after-move-viewport.png`. With the row in view at 1440x700: `crops/r4-1440x700-03-after-move-viewport.png`.
3. **T25, new this round: a failed tap's hidden bar comes back.** From y=260 at 390x664 the page moves 260 to 215 and the words and Try again are clear of the nav (bar 51.8 to 116.4, nav's bottom 52: the page lands on the half-pixel, 0.2 px, not visible). `crops/390x664-y260-failed-03-09-failed-viewport.png`. **For Ryan:** "no street there" with its bar hidden still doesn't scroll, because the go named Try again and that bar has none. `crops/r4-390x664-08-no-street-hidden-viewport.png` shows what that looks like. Widening it is one condition.
4. **T8: the row doesn't sit "just below the aerial" at any size.** The summary row (#439 ruling 1) and the paragraph (#440 ruling 1, kept by Ryan's "stays", T18) stay between them. Measured gap, aerial's bottom to the row's top: 360.3 px at 390, 235.3 px at 1440.
5. **T19's margin:** at 390x844 and 1440x700 the 16 px margin gives way so the bar's words stay about at the nav (Next at 842 of 844, 699.8 of 700). At 1440x700 the words' top is 50, 2 px under the nav's bottom.
6. **T2: the found box is blue inside a green outline.** Ruling 2's words say it stays as #440 drew it; the canvas draws it green and larger.
7. **T1: the spinner doesn't turn.** It's `TapA1`'s still arc, because the motion test (R10) fails a new animation.
8. **T10: at 390 the failed bar covers the picture's top 65 px, and the dashed ring touches its words** when the tap is near the top. `crops/390-15-09-failed.png`.
9. **T12, T13: the bar sits over the picture**, as #440 built it (the canvas draws it above), and the found bar has none of `TapA2`'s distance or Next link (ruling 2's words and `TapB` don't either).

## After a tap finds a street

| Measure | 1440x900 | 1440x700 | 390x844 | 390x664 | 390x664, from y=260 |
|---|---|---|---|---|---|
| Scroll asked for | 35.75 px | 219.75 px | 227.30 px | 421 px | 161 px |
| Scroll trail, scrollY | 0, 23, 35, 36 | 0, 47, 184, 209, 220 | 0, 14, 172, 209, 226, 227 | 0, 33, 281, 358, 402, 419, 421 | 260, 316, 404, 420, 421 |
| Bar's top after (nav's bottom is 52) | 221.5 | 37.5 | 39.8 | -154.3 | -154.3 |
| Bar's words' top after | 234 | 50 | 52.3 | -141.7, off screen | -141.7, off screen |
| Aerial on screen after | 300 of 300 | 285 of 300 | 237 of 250 | 43 of 250 | 43 of 250 |
| Box and label in view | Yes | Yes | Yes | No | No |
| Row's heading in view | Yes | Yes | Yes | Yes | Yes |
| ✓ row's bottom | 823.8 of 900 | 639.8 of 700 | 782 of 844 | 588 of 664 | 588 of 664 |
| Next question's bottom | 883.8 of 900 | 699.8 of 700 | 842 of 844 | 648 of 664 | 648 of 664 |
| Ruling 3's row and button in view | Yes | Yes | Yes | Yes | Yes |
| Gap, aerial's bottom to the row's top | 235.3 | 235.3 | 360.3 | 360.3 | 360.3 |
| Focus | `h4` `cross-row-name` | Same | Same | Same, now on screen | Same |

"Yes" on the row and button means these Chromium windows; a real phone's browser bars change the window as the page scrolls, and that wasn't run (Known limits).

**Reduced motion:** at both full sizes the same distance is asked for as `instant` (35.75 and 227.30 px), and the first read after found is already there. Under reduced motion there's no "before the scroll" to photograph, so those files are named `found-after-jump`.

**Both in view, window 1800 tall, either width:** no scroll asked for, and focus still lands.

## A failed tap, then the big map (T20)

Failed, "Use the big map instead", a mark in the picker, Save & Close, at 1440x900 and 390x844: found bar "✓ Near Franklin Street", no ring, no Try again, no failed line in the card, no scroll, axe 0. No box either, since a picker mark has no tap pixel (X5). The street name in these crops comes from the walk's stubbed `/api/road-bearing`, not a live lookup. `crops/1440-19-14-after-big-map-save.png`, `crops/390-18-14-after-big-map-save-viewport.png`. "No street there" followed by a save, a save with no change, Cancel, Undo afterwards, and the moved pin are in the tests (`GeneratorShell.cross-street-tap.test.tsx`, `lib/cross-street-mark.answer.test.ts`), not walked.

## Repair round 4: Move and the failed bar (T24, T25), walked

`walk-r4.json`, five runs, read around each press. Nav's bottom is 52 at every size. Bar's top is the one measure; "asked" is what the page asked `window.scrollBy` for.

| Press | 1440x900 | 1440x700 | 390x844 | 390x664 | 390x664, reduced motion |
|---|---|---|---|---|---|
| Move, from the found tap's scroll: asked | Nothing, already all there | -15.5 smooth | -13.25 smooth | -207.25 smooth | -207.25 instant |
| Frame's top to bottom, after | 220.5 to 520.5 | 51.5 to 351.5 | 51.8 to 301.8 | 51.8 to 301.8 | 51.8 to 301.8 |
| Move's Cancel, then Undo: asked | Nothing | Nothing | Nothing | Nothing | Nothing |
| Failed tap, bar's top 30 px under the nav: asked | -30.5 smooth | -30.5 smooth | -30.25 smooth | -30.25 smooth | -30.25 instant |
| Bar's top to bottom, after | 51.5 to 95.5 | 51.5 to 95.5 | 51.8 to 116.4 | 51.8 to 116.4 | 51.8 to 116.4 |
| Failed tap, bar's top just clear of the nav (52.5 at 1440, 52.8 at 390): asked | Nothing | Nothing | Nothing | Nothing | Nothing |
| The card's Try again, failing again, bar off screen: asked | Nothing | Nothing | Nothing | Nothing | Nothing |
| Focus after that | `cross-retry` | Same | Same | Same | Same |
| "No street there", bar's top 30 px under the nav: asked | Nothing | Nothing | Nothing | Nothing | Nothing |
| Page errors | 0 | 0 | 0 | 0 | 0 |

Axe didn't run on these runs; the states themselves (armed, failed, no street) are the ones axe measured in the table below. The 0.2 to 0.5 px the bar sits under the nav after a scroll is the page landing on a half-pixel at DPR 2.

## Repair rounds 3 and 4: in the mounted tests, not walked

Every door onto the picker (Edit on map, the big map, Enter in the address field, the ledger's action) during a lookup or the scroll's wait, and a Move kept armed through a cancelled picker (T21); the card's Try again keeping focus, and a place the person moved focus to staying (T26); going A, B, A on the tag hook (T23); Try again answering "no street" (T22), re-tapping the same street (T23) and a tap found with the row off the card (T6) are proved in `GeneratorShell.cross-street-tap.test.tsx`, each red-proved (`red-proof.md`). Jsdom has no layout, so those tests prove what's called and where focus goes, not what a person sees.

## Every other state (1440x900 and 390x844)

| Check | 1440 | 390 |
|---|---|---|
| Right after the click, nothing settled (ruling 1) | Bar "Finding the street name…", solid ring | Same |
| Live regions in the band, every state | 1, the bar | 1 |
| Finding: outline, ring | `--act`, 3 px solid `--act-bright` | Same |
| Found: outline, bar | `--pass`, "✓ Near Franklin Street" on `--vd-ready-ground` | Same |
| Failed: outline, bar, ring, scroll | `--warn`, the ruled sentence on `--vd-flag-ground`, Try again in the bar, dashed ring; with the bar in view, no scroll asked (T25) | Same |
| "No street there" | Same look, X8's copy, no Try again, no scroll asked | Same |
| Try again by keyboard, fails again | Focus back on the new button | Same |
| Try again, answers | Same point (no second `/api/aerial-point`), then found | Same |
| Move, with the row centred: scrollY around the press (T24) | 376 to 205; 1 scroll call | 556 to 214; 1 scroll call |
| Cancel, Undo: scrollY around the press | 376 to 376, each; 0 scroll calls | 556 to 556, each; 0 scroll calls |
| Move re-arms; Undo clears | Tap bar; box stays on Move; box gone on Undo | Same |
| Edit on map and zoom, from the frame's top, every state (P1) | 53 and 105 px | 73 and 73 px |
| Bar height | 44 in every state | 44; "no street" 53.8; failed 64.7, clear of the buttons at 73 |
| Next question, finding to found (P1) | Doesn't move | Doesn't move |
| ✓ row height | 68 | 133, read in or not |
| axe, scoped to the WHERE band: armed, finding, found, Move, no street, failed, after the big map | 0 violations (7 states) | 0 violations (7 states) |
| Targets measured (big map, Edit, Move or Cancel, Undo, both Try agains, the card's big map) | All at least 44 x 44; bar's Try again 92.8 x 44 | All at least 44 x 44; bar's Try again 92.8 x 64.7 |
| Page errors | 0 | 0 |

axe also ran on the found state at 390x664, from y=260 and at 1440x700: 0 violations, and those runs' targets were at least 44 x 44. Axe didn't run on the failed state from y=260.

## Crops

Armed, Move and Undo crops, the Move viewport and the after-the-big-map shots are taken with the frame scrolled clear of the sticky nav, after the page's scroll is read. Other `-08-` and aerial crops are element shots: Playwright scrolls the page to the element, so they show the picture, not where the page sat, and the nav can cover the top. **Read a viewport shot for what a person sees.** `390x664-08-04-found-after-scroll.png` is the case to watch: its bar and box sit under the nav, and at that size after the scroll a person sees `390x664-07-04-found-after-scroll-viewport.png` instead.

Byte-identical crops are kept once. These are the same picture as the named file:

- `1440-08-04-found-after-scroll.png` is `1440-06-03-found-before-scroll.png`
- `1440-12-07-undo.png` is `1440-01-01-armed.png`
- `1440-17-11-retried-found.png` is `1440-06-03-found-before-scroll.png`
- `1440-reduced-04-03-found-after-jump-viewport.png` is `1440-07-04-found-after-scroll-viewport.png`
- `390-12-07-undo.png` is `390-01-01-armed.png`
- `390-17-11-retried-found.png` is `390-08-04-found-after-scroll.png`
- `390-reduced-04-03-found-after-jump-viewport.png` is `390-07-04-found-after-scroll-viewport.png`
- `390x664-y260-07-04-found-after-scroll-viewport.png` is `390x664-07-04-found-after-scroll-viewport.png`
- `390x664-y260-08-04-found-after-scroll.png` is `390x664-08-04-found-after-scroll.png`

Named in `walk.json` but dropped on purpose, to keep the folder small; they're repeats of states shown above or setup shots: `1440-02-01b-card-off-screen-viewport.png`, `1440-reduced-01-01-armed.png`, `1440-reduced-02-01b-card-off-screen-viewport.png`, `1440-reduced-03-02-finding.png`, `1440x700-01-01-armed.png`, `1440x700-02-01b-card-off-screen-viewport.png`, `1440x700-03-02-finding-viewport.png`, `1440x700-04-02-finding.png`, `1440x700-06-03-found-before-scroll.png`, `1440x700-09-found-card.png`, `390-02-01b-card-off-screen-viewport.png`, `390-reduced-01-01-armed.png`, `390-reduced-02-01b-card-off-screen-viewport.png`, `390-reduced-03-02-finding.png`, `390x664-01-01-armed.png`, `390x664-02-01b-card-off-screen-viewport.png`, `390x664-03-02-finding-viewport.png`, `390x664-04-02-finding.png`, `390x664-06-03-found-before-scroll.png`, `390x664-09-found-card.png`, `390x664-y260-01-01-armed.png`, `390x664-y260-02-01b-card-off-screen-viewport.png`, `390x664-y260-03-02-finding-viewport.png`, `390x664-y260-04-02-finding.png`, `390x664-y260-06-03-found-before-scroll.png`, `390x664-y260-09-found-card.png`, `390x664-y260-failed-01-01-armed.png`, `390x664-y260-failed-02-01b-card-off-screen-viewport.png`.

## Known limits

- **Move at 390x664 takes keyboard focus off screen (T24).** Focus stays on Move's button, now Cancel, while the page scrolls up to the picture. The picture is what comes next, by a tap; a keyboard user tabs on to the bar's big-map button or back.
- **A person who scrolled away during a lookup is brought back on failure (T25).** Their tap is what's being answered, and a lookup is usually under a second; a very slow one could move a page someone has moved on from. The failed answer is one scroll, once.
- **"No street there" doesn't scroll, bar hidden or not.** Ruling 4 stands for it (T25); its line still shows in the card, if that's on screen.
- **Review finding 7 (T3): with no aerial shown there's no bar, so the card's finding, failed and no-street lines announce nothing.** The picture can drop out mid-lookup only if its own read fails. Not a line or two: the card would have to know the bar isn't there.
- **The card's Try again leaves focus on the page during the retry itself**, as the bar's does (T11); it comes back with the answer.
- **Focus can land off screen before the scroll.** Focus lands on the found answer and the scroll follows when the read answers, up to 1,500 ms later (T9, T15). After the scroll the heading is on screen at every size walked.
- **The bar's top strip is under the nav at the fit sizes.** At 390x844 and 1440x700 the bar's top 12 to 15 px sits under the nav, with the words at the nav's edge (52.3 and 50). At 390x664 the whole bar is off screen (T19 B).
- **The wait isn't timed on production.** The scroll waits for the nearest-intersection read, up to 1,500 ms (T15). Production's read time wasn't measured, so the delay a person sees there is still to check. A read that outlasts the limit and then lengthens the lines above the button can leave the button partly under the fold at 390.
- **A street name long enough to wrap still grows the ✓ row at 390** (T16), and a two-line name in the bar changes where its words sit. Not walked; the fixture has one street.
- **Undo drops keyboard focus to the page**, because its row unmounts. Unchanged from #440, and the Undo prompt is out of scope here.
- **The card's failed, none and finding lines still move Next question when they appear** (#440).
- **"Yes" is not a real phone.** 390x844 is a Chromium window. A real phone browser's bars take height from it, which is why 390x664 is walked too; real Safari's bars also change the window as the page scrolls, and this code reads `innerHeight` once when it scrolls.
- **Not walked:** the reopened saved plan on this question (T6), the big map during a lookup (T5, mounted test only). Real phone hardware, real Safari, a real screen reader: not run. 390x664 is Chromium at that size, with no Safari toolbar behavior. "One live region" is measured from the DOM; nobody listened to it.
- **1440 uses the issue's 1550 E Colfax; 390 uses 1600 E Colfax**, as #440's walk did, because at 1550 Franklin falls at the 390 picture's left edge. A real tap at that pin at 390 would have to reach the edge or zoom out.
- **Zoom buttons stay 32 px at 1440 and 44 at 380 (rule 133's pair).** Not changed and not in the target table.
- **Overpass and road detection are stubbed**, so live answers are for the production check after the ship.

No gate token or signed site-scan token is saved here; `walk.json` keeps no scenario and was scanned for both words.
