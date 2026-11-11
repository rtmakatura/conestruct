# #489 rulings (mission move-walk-side-line, #494)

## Ryan's hand check (2026-11-10, relayed in the mission brief)

Confirm → Edit → Move → Done works on prod by hand: the road is picked and the side is asked again.  So #489 is a check-tool bug, not a
product bug.  No product code changes.

## Cause (measured before the diff)

Probe `script/probe-move-pick.mjs` on prod (served sha 8c1f69d), 1198x930, log `logs/probe-move-pick-before.txt`.  In Move the picker
opens with the old road still picked, so Save & Close is already enabled.  The check's `search()` waits for "the road list, or an enabled
Save & Close", so the wait returned 2 ms after the SEARCH click, before the road lookup was even sent (t=1594 click, t=1596 wait returned,
t=1794 road lookup sent).  1.5 s later the check looked for a Colfax row: count 0 (old pick cleared, new list not in yet), so it clicked
nothing.  The 4-road list arrived at t=4575, with Save & Close disabled, and the next click on Save & Close timed out after 30 s.  The
row itself was never clicked, so it was never a selector or overlay problem.  The first pin isn't hit because nothing is picked yet then.

## R145 self-ruled

1. **Fix in the check, not the picker.**  Ryan's hand check shows the product works; the cause above sits wholly in `search()`.
2. **Wait for this search's own road answer.**  `search()` starts waiting for the `/api/road-bearing` response before it clicks SEARCH and
   awaits it, then keeps the existing "list or enabled Save & Close" wait.  This holds for live data and for the stubbed road answer
   (a fulfilled route still emits a response).  Timeout 90 s, the same as the existing wait (CHOSEN: Overpass on a cold path has taken
   over 30 s on prod; 90 s is the value the check already used).
3. **No silent pick.**  When the road list is up, the check clicks the first Colfax road row (`role=radio`) and fails with a named error
   if Save & Close is still disabled afterwards, instead of swallowing the click and timing out 30 s later on Save & Close.
4. **The #485 walk is copied forward, not edited.**  Archived evidence dirs are never edited (gate.cjs header, D4).  `script/walk-485-move-prod.mjs`
   here is #486's `walk-485-prod.mjs` with the same `search()` fix, step C on by default, and one added step E: after Confirm, reopen WHERE →
   Edit → Move → another address → Done → the side asked again with its line, the other answers kept.  E is the walk Ryan hand-checked.
5. **No unit test.**  The check scripts have no unit tests; the red proof is the failing prod run before the fix (the probe log, and the
   `ERRORS states: locator.click: Timeout 30000ms exceeded.` line in `ux-columns-copy-maps/prod-check/logs/verify-columns-end-together.txt`).

## Rule 5 churn prediction (written before the diff)

- `scripts/verify-columns-end-together.mjs`: only the `search()` helper changes (about 15 lines).  Every reading, state name, log line format
  and the PASS/FAIL rule stay byte-identical.  Behaviour change, stated: the Move states (`edit-moved` through `cancelled-after-confirm`, 6 states)
  now run on live road data instead of ending the walk; on the first pin the wait is the same plus the road lookup's own response.
- New files only under `validation-artifacts/committed/missions/move-walk-side-line/issue-489/` (this file, outcome.md, the scripts, logs, a few crops).
- No file under `conestruct/site/`, `backend/` or any other script changes.

## Actual churn (after the diff)

- `scripts/verify-columns-end-together.mjs`: `search()` only, +11 / -2 lines, as predicted.  Readings, state names, log format and the PASS rule unchanged.
- New files only under this folder.  Nothing under `conestruct/site/`, `backend/` or other scripts changed.  Matches the prediction.
