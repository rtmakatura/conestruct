# #446 production check on 763bee5 (2026-11-06)

SHIP VERIFIED: `/healthz` sha and the served frontend are both `763bee5457184937187b268c7f63c44f22fb4857`, which is main HEAD.

Run: `script/walk-prod.mjs` against https://www.conestruct.com/sandbox with the gate token from `.env.local` (never printed or saved), the header sent to the site only. Chromium at DPR 2. Live: geocoding, `/api/road-bearing` for the found tap and the big map, `/api/aerial-point`, the nearest-intersection read, the aerial. Changed in the browser, for those taps only, because they can't be had on demand: "failed" answers 502, and "no street" takes the live answer and keeps only the Colfax candidates. Picture: `walk/`. Numbers: `walk/walk.json`.

**Result: PASS at 390x844 and 390x664 with saved measures. 1440x900 ran once through, without a saved file, and without the "no street, bar in view" answer.** See "1440x900" below.

| Check | 390x844 | 390x664 | 1440x900 (first run's log) |
|---|---|---|---|
| Found tap, live: scroll asked | 227.3 smooth | 421 smooth | 35.75 smooth |
| Focus after it | `cross-row-name` | Same | Same |
| ✓ row's bottom, Next's bottom | 782, 842 of 844 | 588, 648 of 664 | Not saved |
| Move, from there: asked | -13.25 smooth | -207.25 smooth | Nothing, already there |
| Frame after Move | 51.8 to 301.8 | 51.8 to 301.8 | Not saved |
| Move's Cancel, then Undo: asked | Nothing | Nothing | Not saved |
| Failed, bar 30 px under the nav: asked | -30.25 smooth | -30.25 smooth | -30.5 smooth |
| Bar after it | 51.8 to 116.4 | 51.8 to 116.4 | Not saved |
| No street, bar 30 px under the nav: asked | -30.25 smooth | -30.25 smooth | -30.5 smooth |
| Bar after it | 51.8 to 105.5 | 51.8 to 105.5 | Not saved |
| No street, bar clear of the nav: asked | Nothing | Nothing | Not measured |
| T27: big-map crossing, then Move | `armed`, Cancel, nothing asked | Same | Same |
| axe, WHERE band: armed, found, Move, failed, no street, after the big map | 0 | 0 | 0 |
| Targets under 44 px | 0 | 0 | Not saved |
| Horizontal overflow | 0 | 0 | Not saved |
| Page errors | 0 | 0 | Not saved |

These match the local walk's figures wherever both exist.

**The wait is now timed on production (the limit evidence.md listed).** The scroll follows the found bar by 516 ms at 390x844 and 246 ms at 390x664, and the nearest-intersection read took 511 ms and 244 ms, so the wait is the read and never reached T15's 1,500 ms limit. Two reads only. Tap to found bar took 2.6 s and 9.1 s; the bar says "finding" meanwhile.

**The live road service failed often during this check, and a real failure was seen on screen.** Four rounds of runs, about ten minutes apart at most. Of 10 page loads, 3 had the picker say "Road detection is unavailable right now" (the walk stopped there), and 2 had the tap's own lookup not find a street within the walk's limit. `walk/390x844-error.png` is one of those: a real production failure, with the failed bar, dashed ring and Try again as ruled, though the walk was waiting for a found bar. `walk/1440x900-error.png` is the picker's. Why it failed wasn't looked into; repeated runs may have added to it. The same flakiness is what a person would meet, and the failed bar is what they'd see.

## 1440x900

Attempts 2, 3 and 4 stopped on the road service, so `walk.json`'s 1440x900 entry is the last failure, not the run. The first run's console log is kept word for word in `walk/attempt-1-1440x900.log`, and its crops are the `1440x900-02` to `-05`, `-07` and `-08` files. That log's "no street, bar in view" line read `finding`: a fixed wait was too short for the live lookup, so that step proved nothing, its crop was dropped, and the walk now waits for the answer. The scroll code has no width in it, and the local walk measured this row at 1440x900 (nothing asked). I stopped retrying rather than keep hitting the service.

## Seen, not changed

- At 390x664 one big-map run landed "✓ Near Unnamed road" (`walk/390x664-07-after-big-map.png`): the walk clicks a fixed spot on the map, and that spot's live answer was an unnamed way. The 390x844 run landed on Franklin Street. Not this issue's change.

## By eye

Opened: `1440x900-03-after-move.png`, `390x844-02-found-after-scroll.png`, `390x844-error.png`, `1440x900-error.png`. The other crops weren't opened one by one. Ryan's browser check is still the visual gate.

## Not done in production

Reduced motion, the card's Try again, a saved plan reopened on this question, a real "no street" answer from the live service, real phones, real Safari, a real screen reader. No PDF: this issue doesn't change the sheet.
