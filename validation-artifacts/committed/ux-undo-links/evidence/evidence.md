# #457 walk evidence (2026-11-07)

A local walk; Ryan's hand check on the preview is the visual gate. Setup: `next dev` on the issue-457 worktree (port 3457), started by a scratchpad launcher that reads the main checkout's `.env.local` into the environment (no copy into the worktree). Backend: `ux-group3-where/evidence/script/serve_replay.py` from this worktree (port 8457), Overpass replayed from a scratchpad copy of `ux-group3-where/evidence/overpass-fixture/`; `/api/road-bearing` stubbed from the same fixture. The aerial, the tap's coordinate and the nearest-intersection read are live. The gate header went through `scripts/gate.cjs` `newGatedContext` (the local site's own host only). Chromium, DPR 1. Sizes 1440x900 and 390x844 in full, 390x664 for focus after Move. Script: `script/walk.mjs`.

`before/` was walked on the unchanged product code (base `2cd6d72`; only the tests had been written), `after/` on the built change. Each has `walk-<phase>.json`: for every Undo on screen its class, box, font, ink, border, case, underline, padding, its row's height and right padding, and the gaps from the link to the row's top, bottom and right; axe and the 44 px sweep over the block; and where focus is. Every figure below is read from those two files.

## Places reached, and what changed

| Place | Crops (before → after, each size) | Before (1440 and 390) | After (1440 and 390) |
|---|---|---|---|
| U-a CONFIRM answered rows (kind; cross street) | `*-01-confirm-kind-answered.png`, `*-04-confirm-cross-answered.png` | `act-btn wq-undo`, "UNDO", mono 9.5px/400, `rgb(200, 209, 221)`, 1px solid border, uppercase, 52.1 x 44; row 45 (kind) and 44 (cross); gap to the row's top 0, bottom 1 and 0 | `undo-link`, "Undo", Inter 13.5px/600, `rgb(52, 169, 232)` (`--act`), no border, underlined, padding 0 8px, 50.8 x 44; row 48, right padding 16px; gap top 1.5 / bottom 2.5 (kind), 2 / 2 (cross); right 16 |
| U-b NEEDS YOU answered row (Sidewalks, after Generate) | `*-05-needs-you-answered.png` | `act tr-step nyq-undo`, same box as U-a; row 45, gap top 0, bottom 1 | `undo-link`, same as U-a; row 48, gap top 1.5, bottom 2.5, right 16 |
| U-e the cross street's ✓ row | `*-02-cross-row.png` | `wq-link`, Inter 13.5px/600, underlined, padding 0 4px, 44 x 44; row right padding 12px | `undo-link`, padding 0 8px, 50.8 x 44; row right padding 16px |

At 390 the ✓ row is 133 px both before and after (#446 T16's reserved height), with Move and Undo on their own line.

**Not reached by the walk:** U-c (the NEEDS YOU condition records), U-d (a staged acknowledgement) and U-f (the near-intersection note after "Lane count is right"). This plan has no condition the question flow doesn't own, no acknowledgement row, and no disputed lane count. Each is covered by its mounted test only: `NeedsYouConditions.test.tsx` (two of the three records), `NeedsYou.acknowledge.test.tsx`, `GeneratorForms.confirm-undo.test.tsx`; all three share the one class the walk measured.

## Focus after Move (#446's known limit, U8)

Keyboard only: Tab to Move, Enter.

| Size | Before | After |
|---|---|---|
| 390x664 | on `cross-move` (now "Cancel"), top 741.5, off screen | on `band-aerial-big-map` ("Use the big map instead"), top 228.8, on screen |
| 390x844 | on `cross-move` ("Cancel"), top 741.5, on screen | on `band-aerial-big-map`, top 228.8, on screen |
| 1440x900 | on `cross-move` ("Cancel"), top 668.8, on screen | on `band-aerial-big-map`, top 345.5, on screen |

Viewports: `*-03-after-move-viewport.png`. The scroll Move makes is unchanged: at 390 it ends at scrollY 214 before and after (from 340 / 343 at 390x844 and 421 / 421 at 390x664); at 1440 the picture is already in view and Move doesn't scroll (135 → 135 before, 138 → 138 after).

## Keyboard focus crop

`after/after-1440x900-06-needs-you-undo-focus.png` and `after/after-390x844-06-needs-you-undo-focus.png`: the NEEDS YOU answered row's Undo, reached by Tab, with its 2 px `--act` ring inside the link's own box (outline `2px solid`). Before: `before/*-06-*.png`.

## axe and the 44 px measure

- axe: 0 violations on every state walked, both phases, both sizes (the WHERE band for U-a and U-e, the NEEDS YOU block for U-b).
- 44 px: every Undo is 44 px tall in every state, 50.8 px wide after (52.1 before for the boxed ones, 44 for U-e). The only targets under 44 px in any walked state are the aerial's two zoom buttons at 1440 (`a-aerial-zbtn`, 32 x 32), the same before and after, outside this change.

## Known limits

- The near-intersection note (U-f) puts its Undo under the note, left-aligned; the link's 8 px padding sets its text 8 px in from the note's text. Not walked (above).
- On the cross street's ✓ row, Move and Undo now match (both underlined `--act` links); the 1440 crop shows them side by side.
- 390x664 and 390x844 are Chromium window sizes, not phones.
- One rejected request at the before run's teardown (`lateRejections` 1 in `walk-before.json`): a gate route still in flight when the browser closed. It came after every measure.
