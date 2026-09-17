# issue-256-scan-chain — the scan chain, the fold, and what closes #256

**Issue:** #256 — "Dense corridors sit at the 20 s scan budget". **Phase:** 0 (#287).
**Rulings:** `rulings.md` in this directory — a–j, quoted verbatim, with ruling a's
mid-arc correction kept beside the text it replaced.

## What #256 originally complained about, and what actually caused it

The issue's title is wrong, and the investigation said so before any code was written.
s2-arc31 (on main, `validation-artifacts/committed/s2-arc31-scan-budget/`) measured:

- **The query is not slow.** 99.9 % of its wall is TTFB; 79 KB transfers in 0.5 ms and
  parses in 3 ms.
- **Density is not the variable.** Lakewood at 160 elements refused **10/20** cold;
  Denver at 396 elements refused **7/20**. The *less* dense corridor refused more.
- **The chain was the defect.** `min(HTTP_TIMEOUT_S, remaining)` is `min(25, 20)`, so a
  budgeted mirror 1 received the entire budget and a stall consumed it. Mirror 3 answered
  the full Denver scan 3/3 clean in 2.8–4.4 s and was **never reached**: provenance read
  `overpass-api.de` on **80 of 80** prod rows.

So no budget was raised. Ruling a caps each mirror inside the budget that already exists.

## The commits

| | what | state |
|---|---|---|
| `03bc079` | `rulings.md` — the arc's authority, as its first commit | on main |
| `c20ad22` | ruling a corrected 6 s → 7 s; ruling j added (the 429) | on main |
| `5d569d7` | **fix 1** — the per-mirror cap and the 429 fall-through | **shipped** |
| `09ca861` | **commit 2** — the corridor-check fold | verified PASS, unshipped |

### fix 1 — the cap and the 429

`PER_MIRROR_READ_S = 7.0` / `PER_MIRROR_CONNECT_S = 3.0`, applied as an `httpx.Timeout`
on the budgeted path only and still floored by `remaining`, so the **budget** ends the
chain rather than the cap count. 7 s is traced twice: it clears the folded query's one
clean measurement (6.83 s) and it is the arc-31 README's own lever-table recommendation.
Connect 3 s is CHOSEN outright — there was no connect timeout in the codebase to raise it
from.

Ruling j: a 429 is that mirror's answer, not the chain's. Each mirror is independently
rate-limited, so a 429 now advances the chain exactly as a read timeout does; a genuine
400 still stops it. Without this, "mirror 3 reached in production" was not reliably
achievable — arc-31's own first decomposition run rate-limited itself and invalidated its
L3/L4/L5 legs.

### commit 2 — the fold

One Overpass request serves the site scan and the corridor bearing check: two named sets,
two `out` statements, separable because the road set carries `geometry` and the scan set
never does. `CORRIDOR_CHECK_BUDGET_S` retires with a Rule-5 declaration — the second 20 s
wait that could report `check_unavailable` while the scan itself succeeded is gone.
arc-31 measured that second trip failing on **43 %** (Denver) and **65 %** (Lakewood) of
otherwise-ok audits.

Two corrections to ruling g's premise, both recorded in the commit:

- **The corridor bbox does NOT serve both queries.** The road set keeps `around:50` at the
  anchor — the clause `validate_corridor_against_osm` already sends. Putting the bearing
  query on the corridor bbox would widen the pool across the whole ~1000 ft corridor and
  change which way the bearing is taken from: a behaviour change, not a fold.
- **No fixture re-record happened, and none was required.** The prediction assumed
  `lakewood_overpass.json` is a live capture. It is a stub payload tests hand back
  regardless of the query, so changing the query changes nothing any test sees. The
  consequence, recorded rather than hidden: that fixture now represents an *unfolded*
  payload, and the folded shape is covered by unit tests with a purpose-built payload
  instead.

The invariant ruling g cares about is a test, and the test was red-proved: disabling the
element split made `test_folded_scan_buckets_are_identical_to_unfolded` fail with
`AssertionError: interchanges` — the road set's `motorway_link` inventing a detection.

## The acceptance leg (ruling f)

**Run 1 — CRASHED at cycle 6 of 20. Recorded because its absence is otherwise unexplained.**

`accept-256.js` was writing its output into this directory, untracked, while the run was
in flight. A diff-verifier reviewing commit 2 ran `git stash push -u` mid-review to build
a type-checker baseline. That removed the untracked output directory from disk underneath
the running probe, which died with:

```
Error: ENOENT: no such file or directory, open '...out-5d569d7\audit-denver-warm-06.json'
```

The verifier restored the directory afterwards and left no net change on disk. **The run
was destroyed anyway** — roughly forty minutes of measurement that cannot be replayed,
because Overpass load is a property of the hour.

Two things changed as a result:

1. **The diff-verifier's definition was amended** (`.claude/agents/diff-verifier.md`,
   2026-09-16): read-only now means the strict sense — no command that writes to the
   working tree, the index, the stash or any branch, with `stash`, `checkout`, `reset` and
   `clean` named; baselines are read from git objects or from a throwaway worktree the
   agent makes and removes itself; **any write is an automatic REPAIR on its own verdict**,
   because restoring afterwards does not undo having written.
2. **Probe output no longer lives in the repo.** Run 2 writes to a directory outside the
   working tree and is copied in when it completes, so no git operation — a commit's
   pre-commit stash included — can reach a measurement in flight.

What run 1 did measure before it died, reported as the N it actually reached and not
rounded up to the bar:

| pin | cold n | refusals | mirror index reached | `check_unavailable` on ok |
|---|---|---|---|---|
| denver | 5 | 0 | `1, 3, 3, 3, 3` | 0/5 |
| lakewood | 5 | 0 | `3, 3, 1, 1, 3` | 0/5 |

**0 in 10 cold runs cannot distinguish 0/20 from 2/20**, which is exactly why ruling f
names N = 20. It is not the acceptance number and is not recorded as one.

What it *does* settle: **mirror 3 is reached in production** — 6 of 10 cold rows, against
0 of 80 before fix 1. That is the claim fix 1 had to make good, and it is independent of
the refusal count.

**Run 2 — in flight**, same build (`5d569d7`, so the fold is not in it and the numbers
stay comparable to arc-31's), same cycle shape, sha-gated at both ends so a deploy
mid-run is caught rather than silently mixing builds.

### The number that closes #256's original complaint

*Pending run 2.* It goes here when 20 cold runs per pin exist, with its start time, and
not before.

## What is still ahead

- **Commit 3 — the memo key** (ruling d). Early reading: smaller than the ruling assumes.
  `SiteScanInputs` already carries `lat`, `lng` and `bearing_deg`, so the key already
  covers the anchor and a memo hit already serves the right `road_bearing`; the bearing
  *tolerance* is applied in the derivation rather than the fetch, so it need not be in the
  key at all. To be settled at that commit's checkpoint, not assumed here.
- **The final acceptance leg** on the last sha — the same 20 × 2, plus corridor-check
  `check_unavailable` ≤ 1 in 20 on ok audits. #256 closes on that.
- **Held by ruling i:** the corridor bbox / `use_max` question is Phase 3's, not this arc's.
