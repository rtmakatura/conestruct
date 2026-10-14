# #293: the negative `residual_ms` in the #256 acceptance runs

R145 self-ruled, inside #293's own proposed solution and acceptance. The three committed runs
(`../issue-256-scan-chain/acceptance/run{2,3,4}-*/`) are unchanged; the harness that reads them is
fixed. A measurement-tooling change only (no product code); no separate prediction was committed
before it, and its before/after is the recompute table below.

## The cause, demonstrated from the committed rows

The two negative minimums are each one row: cycle 1's Lakewood "cold" request in run 3 and in
run 4 (`rows.json`, `log.txt`):

| Run | Row | `wall_ms` | `duration_ms` | `residual_ms` | `memo_hit` on its own audit |
|---|---|---|---|---|---|
| run3-2e5a647 | c1 lakewood cold | 284 | 3620 | **-3336** | **true** |
| run4-cc820bf | c1 lakewood cold | 451 | 16025 | **-15574** | **true** |

- **#293's premise doesn't hold:** the rows don't report `memo_hit: false`. Each served audit says
  `memo_hit: true` (`log.txt`: `memo=true`), so its `duration_ms` is a stored scan's. A 284 ms
  round trip carrying a 3.6 s scan is a memo hit, which is the case the earlier probe's guard
  describes.
- **The guard wasn't in this harness:** `accept-256.js` computed the residual over every ok cold row
  (`:148, :172`), whatever `memo_hit` said. The rows are honest; the statistic was wrong.
- **`memo_hit` is right on the wire** for these rows, so there is no `memo_hit` defect to file.

## The fix

`accept-256.js` now computes the residual over fresh scans only (`memo_hit === false`) and prints
how many memo-hit rows it left out. Recomputed from each run's committed `rows.json`
(`resid293.py`):

| Run · pin | Before | After |
|---|---|---|
| run2 · denver | n=19 min=1004 median=4584 p90=16540 | the same |
| run2 · lakewood | n=20 min=662 median=11265 p90=15854 | the same |
| run3 · denver | n=19 min=615 median=683 p90=917 | the same |
| run3 · lakewood | n=18 **min=-3336** median=375 p90=587 | n=17 min=343 median=375 p90=587 (1 omitted: c1, memo hit) |
| run4 · denver | n=19 min=430 median=848 p90=958 | the same |
| run4 · lakewood | n=20 **min=-15574** median=419 p90=575 | n=19 min=270 median=419 p90=575 (1 omitted: c1, memo hit) |

Every median and p90 #256 closed on is unchanged, as #293 said.

## Recorded, not resolved

Why cycle 1's first Lakewood request found the memo warm at all. The run had made no Lakewood
request before it, and the harness sleeps past the memo TTL only after each cycle, so cycle 1's
"cold" leg isn't guaranteed cold. The stored scans' `measured_at` values (12:08:25 and 13:18:22)
don't line up with the client clock either. Telling a stored duration from a fresh one at the
source needs #293's third proof route (stamp each result with the request that produced it in
`run_site_scan`) and a fresh production run; neither is needed for the acceptance, which the
fix meets.
