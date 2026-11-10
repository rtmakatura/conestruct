# #479 evidence: NEEDS YOU's Details floats; the card doesn't grow

Rulings: `rulings.md` (Ryan's 2026-11-10 ruling; R1-R5). Plan and churn: `checkpoint.md`.

## How it was measured

- `script/walk479.mjs`, with `script/launch479.cjs` starting the local backend (`scripts/verify-generate-cls-stub.py`, Overpass replayed from the `ux-group3-where` and `ux-site-map` fixtures) and `next dev` on this worktree (ports 3479 / 8479). Chromium at DPR 1. `/api/road-bearing` answered from the recorded Colfax fixture (the permanent check's `roadAnswer`). The stub logged only `replay` asks (29 over the first runs, 8 on the final walk; the log was in the scratchpad). The gate token came from a walk-only secrets file in the scratchpad; a scan of this folder for it and the walk's render secret: 0 hits.
- The flow is `scripts/verify-generate-cls.mjs`'s: pin 1600 E Colfax Ave, shoulder work, the first side, Generate. Then: scroll the card's foot to the centre; measure every results box with Details closed; open Details; measure again, with the panel's box, an on-top check (the topmost element at its centre and 4 px inside each corner is the panel), the page's scroll width, and every layout-shift entry since the click; axe and the 44 px list on `section.needs-you` in both states; then Esc.
- The scan answered with 3 questions; the card is on question 1 ("Are there sidewalks along the work zone?").
- Raw output: `walk-output.txt`, per-size JSON in `walk/`. Crops in `walk/crops/`, the viewport at the same scroll, closed and open, for Ryan's hand check.

## Details closed and open (px)

| | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| NEEDS YOU section, closed / open | 1024.8 / 1024.8 | 1024.8 / 1024.8 | 1135.3 / 1135.3 |
| card, closed / open | 792 / 792 | 792 / 792 | 886.3 / 886.3 |
| boxes that moved (section, card, foot, toggle, rows, other conditions, Your plan, Downloads, reference group) | none | none | none |
| layout-shift entries after the click | none | none | none |
| `p.nyq-details` in the card's flow | 0 | 0 | 0 |
| panel (x, width, height; 280 wide when anchored at the toggle) | 297-657, 360, 78.3 | 176-536, 360, 78.3 | 31-359, 328, 78.3 |
| panel in view / on top | yes / yes | yes / yes | yes / yes |
| page scroll width, open | 1440 | 1198 | 390 |
| axe (section.needs-you), closed / open | 0 / 0 | 0 / 0 | 0 / 0 |
| targets under 44 px, closed / open | none / none | none / none | none / none |
| the toggle | 49.5 x 44 | 49.5 x 44 | 49.5 x 44 |
| Esc closes it, focus back on the toggle | yes | yes | yes |

The first walk, with only the prop set, had the same zero-move result but put the panel at x 134.8-414.8 on the 390 screen (page 415 wide), which is why R4's rule went in. Its second walk showed the Details text in three grid rows, which is why R5's span went in. A third walk followed the reviewer's fold-in (R6: the duration "· 0.1 s" no longer wraps at 1440 and 1198; numbers identical). Only that final walk is kept.

Not measured: a "before" walk of the in-flow line. The issue already states that the line grows the card (P1), and the mounted test's red proof (`red-vitest.txt`) shows the base renders the in-flow line.

## The permanent check

`scripts/verify-generate-cls.mjs` against the same local site, run before the R6 fold-in (a nowrap inside the closed panel, which can't shift layout) (`verify-generate-cls.txt`): Generate CLS 0 PASS at 1440x900, 1198x930 and 390x844. Outline check PASS, outlines left 0. NEEDS YOU's own delta (+91 / +91 / +53) is the 3-question scan over the one-question reserve, reported, not failed (#477 answer 1). It matches the live delta in handoff.md's #478 production check.

## Tests

- New: `NeedsYouQuestion.test.tsx` "#479 Details floats as #469's does". Red on the base (`red-vitest.txt`: 1 failed, 15 passed), green after.
- Changed: `NeedsYouMap.test.tsx`'s card child list drops `nyq-details` (predicted).
- Affected vitest (31 files): 307 passed.
