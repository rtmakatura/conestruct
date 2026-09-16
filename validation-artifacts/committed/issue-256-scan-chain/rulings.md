# issue-256-scan-chain — the rulings this arc is built under

**Ruled by Ryan, 2026-09-16**, in chat, after the s2-arc31 investigate checkpoint.
Quoted verbatim below. This file is the arc's authority: every commit on this branch
cites it, and the diff-verifier checks the commits against it rather than against a
message it cannot read.

Filed as this arc's **first** commit, per the per-arc rulings convention adopted
2026-09-16 — after the verifier rejected a commit on #283 whose cited authority existed
only in chat. The same text is posted as a comment on #256 so the issue carries it too.

**Issue:** #256 — "Dense corridors sit at the 20 s scan budget". **Phase:** 0 (#287).
**Investigation:** `validation-artifacts/committed/s2-arc31-scan-budget/` (on main).

---

## The rulings, verbatim

> Build (a) the per-mirror cap and (b) the corridor-check fold as one arc, backend-first.
> No budget is raised — the measured argument says the budget is not the problem.
> Acceptance: Denver and Lakewood ≤ 1 refusal in 20 cold runs each; corridor check
> `check_unavailable` ≤ 1 in 20 on ok audits; mirror 3 reached in production (provenance
> shows it); the fold's +14.8% bytes and +9 ms recorded. Every cap traced or CHOSEN. Then
> the pre-scan-on-confirm lever as a separate arc — it is Phase 3's gate, and it stays a
> read.

> a. Per-mirror cap 6 s, CHOSEN, traced to the 3 s / 6.4 s clean-answer measurements and
> the "reach mirror 3 inside 20 s" argument. Read timeout 6 s, connect 3 s (raised from
> 2 — the arc-22 idiom). Marker beside it with both numbers and the reason.

**Ruling a was corrected the same day, before any code was written — see "Ruling a,
revised" below. The 6 s above is superseded. It is kept here verbatim because the record
is supposed to show that the ruling changed, and why.**

> b. Flat chain; no retry-on-timeout. A chain that reaches every mirror needs no retry,
> and a retry hides the mirror that stalled.
>
> c. Fold: one Overpass round trip serves the site scan and the corridor check; the
> corridor check derives from the fetched elements; its own budget retires;
> check_unavailable remains only when the whole scan fails.
>
> d. Memo key adds the corridor-check inputs (bearing tolerance, bbox radius) so a hit
> serves both. The corridor-check cache folds in, not beside.
>
> e. Commit order: fix 1 (the ReadTimeout handler at site_detection.py:169-173 + the cap)
> → the fold → the memo key. Each shippable; healthz between; stop after each with the
> verdict and the ship line.
>
> f. Acceptance leg N = 20 cold runs per pin, spaced past the memo TTL, both pins,
> sha-gated, provenance showing the mirror index reached. ≤ 1 refusal in 20 per pin.
>
> g. Yes: the scan fixtures re-record if the fold changes bucket contents; predict the
> re-baseline, do it single-leaf.
>
> h. The fallback-on-unavailable stays in fix 1; it fires only when all three mirrors
> fail.
>
> i. Hold the corridor bbox change — that is Phase 3's use_max question, not this arc's.

> Start fix 1. Stop with the verdict and the ship line.

---

## Ruling a, revised (Ryan, 2026-09-16, same day, before any code)

> a (revised). Per-mirror cap 7 s, CHOSEN, traced to the folded query's one clean
> measurement (6.83 s) and to the arc-31 README's own recommendation. My 6 s cited a
> measurement that does not exist; 7 s is the number the evidence supports and it leaves
> the fold room to land. Update rulings.md with the correction and the reason — the
> record shows the ruling changed and why.

**Why it changed.** The checkpoint could not trace the original 6 s:

- **"6.4 s" appears nowhere in the arc-31 evidence.** Every clean (HTTP 200) answer
  measured: mirror 3 on the Denver scan at **2.8–4.4 s** (README:46); `L6-run2`, the
  shipped scan query, at **4.20 s**; `L5-folded-1trip`, the folded query, at **6.83 s**
  (`out-levers2-60098ae/log.txt`). The nearest log value to 6.4 is `L3-tight` at
  **6365.3 ms** — a 504 the artifact itself labels `<-- INVALID: this leg measured
  nothing`.
- **6 s would have cut off the fold.** Ruling c folds the corridor check into one query
  in this same arc. The folded query's only clean measurement is 6.83 s, so a 6 s read
  cap would abandon the fold's own clean answer mid-flight. Rulings a and c conflicted as
  originally written.
- **7 s is the investigation's own recommendation**, from the lever table it wrote for
  this decision (README:119): *"a 7 s cap on mirror 2 leaves 7+ s for mirror 3, which
  needs 1.5–4.4 s | **The fix.** Costs no budget increase"*.

**Connect 3 s is CHOSEN with no antecedent.** The original parenthetical — "raised from
2 — the arc-22 idiom" — has nothing to raise from: there is no connect timeout anywhere
in the codebase, no `httpx.Timeout` usage at all, and no `connect=2` in any artifact.
Today `timeout=timeout` is a scalar httpx applies to every phase. So 3 s is marked CHOSEN
outright (Rule 12), not traced.

**What 7 s buys, stated as the trade it is.** Prod Denver cold, `ok` rows (n=13): scan
duration median 4.28 s, p75 10.35 s, p90 14.36 s, max 18.09 s. Those are *successes*
today, on a chain where mirror 1 receives the whole budget. A 7 s per-mirror cap converts
the slow ones into mirror-advances. That is the intended trade — mirror 3 answers in
2.8–4.4 s and 3 × 7 s = 21 s is bounded by the 20 s budget, so the chain still reaches
mirror 3 — but it is a bet that a later mirror is fast, not a free win, and the acceptance
leg (ruling f) is what settles it.

## Ruling j (Ryan, 2026-09-16) — the 429 chain-stop

Raised at the checkpoint as absent from a–i, and ruled:

> 429 chain-stop (new ruling, j): a 429 from one mirror is that mirror's answer, not the
> chain's. Treat it as a mirror failure — move to the next mirror inside the budget,
> exactly as a ReadTimeout now does. Record it as a CHOSEN behaviour with the arc-22 note
> as its trace. Without this, "mirror 3 reached in production" is unachievable and the
> acceptance would be false.

**What it fixes.** `src/rules/site_detection.py:181-182` stops the whole chain on any 4xx:

```python
if 400 <= resp.status_code < 500:
    return None, f"{url}: {resp.status_code} {resp.reason_phrase}"
```

The docstring justifies it as *"the query itself is malformed; trying another mirror will
produce the same error"* — **true for 400, false for 429.** Each mirror is independently
rate-limited, by this module's own comment at `:48-51`. A 429 from mirror 1 therefore
defeats ruling a on its own. Arc 31 hit exactly this: its first decomposition run
rate-limited itself, which is why that run's L3/L4/L5 rows are marked invalid.

**Scope.** 429 only. A genuine 400 still stops the chain — the query really is malformed
and the next mirror really will say the same thing. The distinction is the ruling.

---

## What each ruling binds, in build terms

**a — the cap (7 s, as revised).** `HTTP_TIMEOUT_S = 25.0`
(`src/rules/site_detection.py:33`) is never the binding term today:
`timeout = min(HTTP_TIMEOUT_S, remaining)` is `min(25, 20)`, so mirror 1 receives the
whole budget. The cap must be a *separate* constant from `HTTP_TIMEOUT_S`, because
`HTTP_TIMEOUT_S` still governs unbudgeted callers (`budget_s=None`, every pre-phase-1
caller and every stub). **Read 7 s, connect 3 s**, both marked CHOSEN with their traces
beside them (Rule 12): read 7 s to the folded query's 6.83 s and the README's lever table,
connect 3 s outright.

**b — flat chain.** No retry within a mirror. The budget, not the cap count, bounds the
chain: 7 + 7 leaves 6 s for mirror 3, which needs 1.5–4.4 s. That is the arithmetic that
makes ruling a work and the reason no budget is raised.

**c — the fold.** One round trip; the corridor check reads the fetched elements;
`CORRIDOR_CHECK_BUDGET_S` retires. `check_unavailable` narrows to "the whole scan failed".
This is the ruling with the widest blast radius — see g.

**d — the memo key.** Bearing tolerance and bbox radius join the key so one hit serves
both consumers. Folds in, not beside: there is one cache, not two.

**e — commit order.** fix 1 → fold → memo key, each shippable, healthz between, a verdict
and a ship line after each. **This arc's first code commit is fix 1 only.**

**f — the acceptance leg.** 20 cold runs *per pin*, both pins, spaced past the memo TTL
(120 s), sha-gated, provenance showing the mirror index reached. Note `provenance.mirror`
already crosses the wire (#251, `src/api/site_scan.py:102`) — **no new wire field is
needed for this acceptance**, so no payload-sender enumeration is triggered by it.

**g — the fixture re-baseline, predicted now.** `tests/fixtures/site_scan/
lakewood_overpass.json` is a 45 KB live capture; `lakewood_overpass.meta.json` records
`query`, `elements: 146` and `buckets_detected`. The fold changes the query, so the
payload re-records: `query`, `elements`, `captured_at_utc`, `source` all move.
**`buckets_detected` must NOT move** — arc 31 measured the bearing elements as separable
by geometry, so if a bucket count changes, the fold changed the scan and that is a
behaviour change needing its own ruling, not a refactor. Four downstream fixtures
(`tiering/scanned-lakewood.json`, `scanned-asserted`, `scanned-dismissed`,
`pdf_worst_case/scanned-ok.json`) and six test files record scan *output*, so they hold
if and only if the buckets hold. Single-leaf, per the ruling. **None of this lands in
fix 1** — fix 1 changes timeout arithmetic only and must re-record nothing.

**h — the fallback.** Stays in fix 1; fires only when all three mirrors fail.

**i — held.** The corridor bbox / `use_max` question is Phase 3's, not this arc's.

**j — the 429.** 429 is treated as a mirror failure and the chain continues to the next
mirror inside the budget, exactly as a read timeout does. 400 is unchanged: it still stops
the chain, because a malformed query really will get the same answer everywhere. This is
proposed-solution 5 on #256, and without it ruling f's "mirror 3 reached in production"
is not reliably achievable.

---

## Fix 1's scope, from the rulings above

Fix 1 is **a, b, e, h and j**: the per-mirror cap (7 s read / 3 s connect), the read-timeout
handling that advances the chain, the 429 handling that advances the chain, and the
fallback-on-unavailable that fires only when all three mirrors fail.

**Not in fix 1:** the fold (c), the memo key (d), the fixture re-baseline (g — nothing
re-records here, because fix 1 changes timeout arithmetic and error classification only,
never the query), and the bbox (i, held entirely).
