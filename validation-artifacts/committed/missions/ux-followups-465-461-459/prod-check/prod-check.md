# Mission #466 production check (2026-11-08, on `69d7cc0`)

Ship: SHIP VERIFIED. `/healthz` reads `69d7cc05c078ba803bbe4b36eb5b9753d15e45f9` (re-read at the start of this check), and the served frontend is at the same sha.

**Setup.**
- Site: https://www.conestruct.com/sandbox, with the live backend, live Overpass and live road-bearing. Nothing is stubbed.
- Gate header: `scripts/gate.cjs` `newGatedContext`.
- Browser: Chromium, DPR 1.
- Script: `script/walk-prod.mjs`. It merges #456's prod walk (`d46199a0`, `ux-map-in-view/prod-check/script/walk-prod.mjs`) with #461's local walk (`../issue-461/script/walk461.mjs`) and adds a strip read for #459 and a bar log for #465.
- Pins: 1550 E Colfax Ave at 1198x930 ("Colfax Avenue, westbound") and 1600 E Colfax Ave at 390 ("Colfax Avenue").
- Results: `walk/summary.txt` (from `script/summarize.cjs`) and `walk/<size>.json`.
- The walk ran three times. The first two runs gave the same verdicts; their strip crops landed under the sticky nav. These files are from the third run, which centres the strip before the crop.

## #459: the verdict strip names the WHERE confirm. **PASS**

Strip text by state. It reads the same at 1198x930, 390x844 and 390x664 (`strips` / `stripText` in each step).

| State | Strip | testid |
|---|---|---|
| Pin, no kind (`01`) | ◌ AWAITING KIND OF WORK | `strip-kind-unconfirmed` |
| Kind picked, still on the kind question (`02`) | ◌ AWAITING WHERE CONFIRMATION | `strip-where-unconfirmed` |
| Side owed (`03`, `13`, `14`) | ◌ AWAITING WHERE CONFIRMATION | `strip-where-unconfirmed` |
| Side answered, Confirm not pressed (`04`, `07`, `11b`, `18`) | ◌ AWAITING WHERE CONFIRMATION | `strip-where-unconfirmed` |
| After Confirm (`12`) | 1198: "✓ VERIFIED · 0 VALIDATION WARNINGS READY FOR TCS REVIEW"; 390: "⚠ VERIFIED · 1 VALIDATION WARNING REVIEW WARNINGS" (innerText, whitespace collapsed) | neither awaiting strip is present |

The two pins differ (1550 vs 1600 E Colfax), which accounts for the 0 vs 1 warning after Confirm. That difference is the plan's verdict and is not part of #459.

Crops:
- `crops/1198x930-02-strip-01-kind-question.png`
- `crops/1198x930-06-strip-04-side-answered.png`
- `crops/390x844-05-strip-04-side-answered.png`
- `crops/1198x930-08-strip-12-confirmed.png`

## #461: at 390 the question heading clears the pinned strip. **PASS** (one known miss, #468)

The script uses walk461's measure: the cover is the nav or whatever is pinned under it. The table gives the heading's top against the cover's bottom, in px.

| State | 390x844 | 390x664 |
|---|---|---|
| 03 side question | 506.5 vs 52 (strip not pinned) | **209.5 vs 202** |
| 04 side answered | 573 vs 52 | 210 vs 202 |
| 05 kind reopened | **210 vs 202** | 210 vs 202 |
| 06 side undone | **209.5 vs 202** | 209.5 vs 202 |
| 07 side again | 210 vs 202 | 210 vs 202 |
| 08 scrolled by hand | 290 vs 202 | 290 vs 202 |
| 09 map hidden | 289.5 vs 96 | 289.5 vs 96 |
| 10 hidden, after Undo | 289.5 vs 96 | 255.5 vs 96 |
| 11 Show map pressed | **395.5 vs 202** | **361.5 vs 202** |
| 13 near-intersection kind answered | 511.5 vs 52 | **136.5 vs 202: MISS, known, #468** |
| 14 tap question | 606.5 vs 52 | 509.5 vs 52 |
| 18 side after the tap | **209.5 vs 202** | **209.5 vs 202** |

Every opened question and every Show map press leaves the heading at or below the strip's bottom, with the 8 px clearance the local walk measured (209.5 vs 202). The first line of the question's sentence is clear in every state that has one. State 13@664 matches the local walk (136.5 vs 202, `../issue-461/walk/after.txt`). That miss is the #468 case and is recorded here, not counted as a failure.

At 1198x930 nothing changed. On all 14 states the aerial is whole (frame 157.5..717.5 under the 52 nav) and the heading sits at 329.

Crops:
- `crops/390x664-04-03-side-question.png`
- `crops/390x844-06-11-map-shown.png`
- `crops/390x664-12-18-side-after-tap.png`
- `crops/390x664-09-13-ni-kind-answered.png` (#468)
- `crops/1198x930-04-03-side-question.png`

## #465: the tap question's bar names a held load. **PASS** (observed, all three sizes)

**Method.**
1. On the tap question, the script presses Zoom in while the browser's own `/api/corridor-map` answer is held 4 s client-side. The site itself is not slowed; #456's prod walk used the same hold.
2. A MutationObserver on the page logs every change to the bar's text, the frame's `data-bar`, `is-armed` and `aria-busy`.
3. 700 ms in, the script takes a screenshot and taps the middle of the map.

| | 1198x930 | 390x844 | 390x664 |
|---|---|---|---|
| Bar log after Zoom in | 0 ms armed "Tap the intersection nearest the work" → **40 ms waiting "Drawing the corridor…"** (+busy, no `is-armed`) → 4940 ms armed "Tap…" | 0 → **33 ms waiting** → 4718 ms armed | 0 → **33 ms waiting** → 4824 ms armed |
| Focus mid-load | Zoom in | Zoom in | Zoom in |
| Tap mid-load: nearest-intersection / road-bearing requests | 0 | 0 | 0 |
| Bar after the picture lands | "Tap the intersection nearest the work" | same | same |
| Next tap read (step 0, at the crossing) | "✓ Near Franklin Street" | same | same |

The bar never read "Tap…" during the held load, and the tap made mid-load was not read.

Zoom out back to step 0 drew no held load at any size. The picture was already held, so the bar stayed armed, which is expected. The tap that was read came after that Zoom out, on the step-0 picture, not on the zoomed-in picture. The pixel maths in the walk assumes step 0.

Crops: `crops/1198x930-10-held-in.png` and `crops/390x844-10-held-in.png`. Both show the bar reading "Drawing the corridor…" with the finding-arc glyph.

Not checked here (#465's acceptance): axe, and #446's ring, box and label beyond the found tap.

## Console and page errors

0 page errors and 0 console errors at all three sizes.

## Verdict

**PASS** for #459, #461 (12@664 still the known #468 miss) and #465 on production `69d7cc0`. #459's strip words and #461's layout are visible changes, so Ryan's browser check is still open.
