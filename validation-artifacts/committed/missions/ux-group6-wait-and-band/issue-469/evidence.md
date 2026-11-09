# #469 evidence: the WHERE band keeps one height

Rulings: `rulings.md` (Ryan's Part 2 rulings 1-4; B1-B8). Plan and churn: `checkpoint.md`. Issue: https://github.com/rtmakatura/conestruct/issues/469.

All the "after" numbers below come from the final walk, `walk/after.txt`. It was taken after repair 1, and repair 2's re-walk is byte-identical to it. In repair 1 the action row moved to the card's true bottom and the band value became 648; repair 2 added B4b, the open-Details rule.

## How it was measured

- Local walk `script/walk469.mjs`. Its launcher `script/launch.cjs` and backend stub `script/serve_stub.py` are copied from #461's. Chromium at DPR 1, `next dev` on this worktree, Overpass stubbed (a replay of `ux-group3-where`'s recorded answers, never live), and `/api/road-bearing` stubbed. The tap's failed state is a forced 500, and its none-found state is a reply with no cross street. The gate header rides only the site's own origin (`scripts/gate.cjs` `newGatedContext`).
- At each state the walk reads the band's box (`[data-testid=band-where]`), the stack, the aerial frame, the road row (`where-summary`), the right column and the CONFIRM card (`where-questions`). For the action row (`.nyq-foot`) it reads three things:
  - its page top;
  - its distance from the card's outer bottom (`foot->bottom`);
  - its offset past the card's 1 px border and 24 px inset (`offset`; 0 = pinned to the card's bottom).
- It also runs axe on the band and lists every visible button, link or answer label under 44 px. The kind question is traced with each answer chosen.
- Before = `385b6c0` (this branch's base). After = this diff. Same dev server, hot-reloaded. Raw lines: `walk/before.txt` and `walk/after.txt`; per-step JSON `walk/before-*.json` and `walk/after-*.json`.
- Earlier builds' walks are kept for the record:
  - `walk/after-pass1.txt`: build 1, value 624, outgrown by one state.
  - `walk/after-pass2.txt`: build 2, value 631, with the action row above the rows. The reviewer failed that layout.

## The band's height, every CONFIRM state (px)

| state | 1440x900 before | after | 1198x930 before | after |
|---|---|---|---|---|
| kind question | 693.3 | 762.5 | 693.3 | 762.5 |
| kind answered | 693.3 | 762.5 | 693.3 | 762.5 |
| side question (Next) | 674.5 | 762.5 | 674.5 | 762.5 |
| side answered | 698.3 | 762.5 | 698.3 | 762.5 |
| kind reopened (its row) | 698.3 | 762.5 | 698.3 | 762.5 |
| side undone (Undo) | 674.5 | 762.5 | 674.5 | 762.5 |
| side answered again | 698.3 | 762.5 | 698.3 | 762.5 |
| near-intersection kind answered | 738.3 | 762.5 | 738.3 | 762.5 |
| tap question | 674.5 | 762.5 | 674.5 | 762.5 |
| tap failed | 674.5 | 762.5 | 674.5 | 762.5 |
| tap, no street found | 674.5 | 762.5 | 674.5 | 762.5 |
| tap found | 674.5 | 762.5 | 674.5 | 762.5 |
| cross street undone (Undo) | 674.5 | 762.5 | 674.5 | 762.5 |
| tap found again | 674.5 | 762.5 | 674.5 | 762.5 |
| side after the tap (Next) | 674.5 | 762.5 | 674.5 | 762.5 |
| side answered after the tap | 698.3 | 762.5 | 698.3 | 762.5 |
| **spread** | **63.8** | **0** | **63.8** | **0** |

The kind trace (each answer chosen) gives 762.5 for all three answers after. Before it gave 693.3, 693.3 and 738.3.

After, on all 16 states at both sizes: the stack is 648, the aerial frame is 624.3 tall at the same top (256.5), and the road row is the same box (top 256.5, height 86.8). Before, the frame was 560, and the stack ran 560 to 623.8 as either column grew.

## The action row (ruling 1: "pinned to the card's bottom")

| | 1440x900 before | after | 1198x930 before | after |
|---|---|---|---|---|
| action row top (page px) | varies | 835.5 on all 16 states | varies | 835.5 on all 16 states |
| `foot->bottom` (card outer bottom to the row's bottom) | 70 / 74 / 115 / 118 / 118.1 / 122 | 25.1 on all 16 | the same as 1440 | 25.1 on all 16 |
| offset past the 1 px border and 24 px inset | | 0.1 (sub-pixel) on all 16 | | 0.1 on all 16 |

The action row's move across states is 0 px. The 24 px under it is the question block's own bottom padding (`.nyq-card`, `var(--space-section)`), kept as the card's inset. Focus order is unchanged (DOM unchanged); rulings B4a.

## The tallest question (ruling 1's trace)

The tallest is the kind question with near intersection chosen. Its right column is 623.8 on the base and 647.8 with the action row's room reserved at the card's bottom. The full table and the re-traces are in `rulings.md`, "The trace". The map's minimum (M2's 560 frame + the 23.75 line slot) is 583.75, so the band is the tallest question's height: 648 px (B1, CHOSEN).

## Details opened (B4b, option d, PARKED for Ryan; `walk/details.txt`, `walk/details-*.json`)

> Superseded 2026-11-09: Ryan ruled Details a floating tooltip, and option (d) is removed. The current measurements are in `missions/ux-wait-band-followups/issue-469/evidence.md`, where the band is 762.5 with Details open or closed. This section is the record of the parked build.

The kind question's Details was walked open and closed at 1440x900 and 1198x930, twice: unanswered, and with near intersection chosen (the tallest state). The two sizes measure the same. With Details open, the action row goes back into the question's flow (B4b), so its toggle sits above the text.

| state | band (px) | action row top | toggle bottom | Details text top | rows top |
|---|---|---|---|---|---|
| kind question | 762.5 | 835.5 | 879.5 | closed | 729.3 |
| kind, Details open | 765.5 | 721.3 | 765.3 | 781.3 | 861.5 |
| kind, Details closed again | 762.5 | 835.5 | 879.5 | closed | 729.3 |
| near intersection chosen | 762.5 | 835.5 | 879.5 | closed | 729.3 |
| near intersection, Details open | 810.5 | 721.3 | 765.3 | 781.3 | 861.5 |
| near intersection, Details closed again | 762.5 | 835.5 | 879.5 | closed | 729.3 |

- **The pressed toggle and the action row move 114.2 px up on open** (top 835.5 to 721.3) and back down on close. The action row is no longer pinned to the card's bottom while Details is open. P1's allocated-room clause is not met. This is why #469 parks for Ryan (rulings B4b).
- **The text opens directly under its toggle:** its top is 16 px below the toggle's bottom (781.3 vs 765.3), which is the question block's own gap, as on the base. The order on screen is toggle, text, rows, the same as the DOM and focus order.
- **The band grows downward only,** as the minimum allows: +3 on the unanswered kind (content 548.3 against the 545.3 card), +48 with near intersection chosen. The band's top, the road row and the aerial (frame 624.3 at 256.5) don't move. Closing Details restores 762.5 and the action row at 835.5.
- axe 0 on every state; the 44 px list is the same (the zoom's 32 px pair).
- Before option d (repair 2's first walk, kept as `walk/details-before-d.txt` and `crops/details-before-d-1440x900-*.png`): the text opened 141 px above its toggle, under the answers' note. The band was 789.5 / 834.5 with Details open.
- Note: `crops/details-before-d-1440x900-sheet.png` has the in-image title "details 1440x900", the same as the after sheet (`details-1440x900-sheet.png`). It was renamed on disk but not regenerated. Its file name is what marks it as the before-d walk.
- Crops: `crops/details-1440x900-sheet.png` (all six states), `crops/details-1440x900-kind-details-open.png`, `crops/details-1440x900-ni-kind-details-open.png`.

## 390 (ruling 3)

Every measured value at 390x844 is identical before and after, on all 16 states and the kind trace. That covers the band, stack, frame and road boxes, the card heights, `foot->bottom`, axe and the target list. The only text difference is the two fields the walk added in repair 1 (`foot top`, `offset`).

## axe and the 44 px measure

- axe: 0 violations on every state at all three sizes, before and after.
- Targets under 44 px: at 1440 and 1198, the aerial zoom's `+` and `−` (32 x 32, rule 133's 32 px pair on desktop), on every state, before and after alike. None at 390.

## Crops (committed under `crops/`)

- `after-1440x900-sheet.png`, `after-1198x930-sheet.png`, `after-390x844-sheet.png`: every walked state's band at quarter scale, each captioned with its measured height. At 1440 and 1198 the boxes are one height, with the action row at each card's bottom. At 390 they follow the card, unchanged.
- `before-1440x900-sheet.png`: the same view on the base.
- Half-scale singles:
  - before: `before-1440x900-kind-question.png`, `before-1440x900-side-question.png`;
  - after: `after-1440x900-kind-question.png`, `after-1440x900-side-question.png`, `after-1440x900-ni-kind-answered.png` (the tallest), `after-1440x900-cross-failed.png`.
- The walk's other crops are kept, uncommitted, in `crops/extra/` (gitignored by this folder's `.gitignore`). `script/sheet469.mjs` makes the sheets from the walk's own screenshots, with every network request refused.

## Tests

- New: `conestruct/site/components/bands/WhereBand.one-height.test.tsx`, 6 passed. It holds two mounted flows covering 15 of the 16 walked states (all but side answered again), and four CSS pins (B6) that include the action row's pin to the card's bottom and B4b's open-Details rule.
- Red proofs: `red-vitest.txt`, re-run in repair 2 with the current test; each time the fixed `globals.css` was restored afterwards (checked with `cmp`).
  - Against the base `globals.css` (`git show 385b6c0`): 2 failed | 4 passed. The failures are the CSS pins for B1/B2 (`expected null to be '648px'`) and for ruling 1.
  - Against the repair-1 `globals.css` (before option d): 1 failed | 5 passed. The new B4b assertion fails: the rule for an open Details is missing.
  - The mounted flows, the state-rule guard and the 390 guard pass on the base too. They guard against regressions and aren't the fix's proof.
- Affected vitest: 23 files, 247 passed. The files are `components/bands/WhereBand*`, `BandAerial*`, `WhereQuestions*`, `QuestionSteps*`, `NeedsYou*`, the `GeneratorShell` WHERE-card, cross-street, kind-confirm, picker-close and value-link suites, and `lib/cross-street-reveal*`.
- Full vitest baseline at `385b6c0`: 2974 passed | 1 skipped.
- `tsc --noEmit`: clean.
- pytest not run: no Python changed.

## Not covered

- Two-column widths other than 1440 and 1198. Both give an 880 px band. A band between 720 and 880 px wraps more text, and a question there can outgrow 648 and grow the band on that question (B1's known limit). It's never clipped.
- The tap's sub-second resolving state (B8), and the Edit fold opened (the operator's own disclosure; B4's `min-height` lets it open the band).
- No CI check measures layout. Filed as https://github.com/rtmakatura/conestruct/issues/472 (B6).
