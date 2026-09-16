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
>
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

## What each ruling binds, in build terms

**a — the cap.** `HTTP_TIMEOUT_S = 25.0` (`src/rules/site_detection.py:33`) is never the
binding term today: `timeout = min(HTTP_TIMEOUT_S, remaining)` is `min(25, 20)`, so mirror
1 receives the whole budget. The cap must be a *separate* constant from `HTTP_TIMEOUT_S`,
because `HTTP_TIMEOUT_S` still governs unbudgeted callers (`budget_s=None`, every
pre-phase-1 caller and every stub). Read 6 s, connect 3 s, both marked CHOSEN with the
measurement and the reach-mirror-3 argument beside them (Rule 12).

**b — flat chain.** No retry within a mirror. Three mirrors × 6 s = 18 s, inside the
existing 20 s budget, which is the arithmetic that makes ruling a work and the reason no
budget is raised.

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

---

## Raised at the checkpoint, NOT covered by a–i — needs a ruling

`src/rules/site_detection.py:181-182` stops the whole chain on any 4xx:

```python
if 400 <= resp.status_code < 500:
    return None, f"{url}: {resp.status_code} {resp.reason_phrase}"
```

The docstring justifies it as *"the query itself is malformed; trying another mirror will
produce the same error"* — **true for 400, false for 429.** Each mirror is independently
rate-limited (this module's own comment, `:48-51`). So a 429 from mirror 1 defeats
ruling a on its own, and arc 31 hit exactly this: its first decomposition run
rate-limited itself, which is why that run's L3/L4/L5 rows are invalid.

This is proposed-solution 5 on #256 ("429/4xx from the first mirror stops the chain — try
the next mirror") and it is absent from a–i. **The acceptance "mirror 3 reached in
production" is not reliably achievable without it.**

Recorded here, not built. Fix 1 implements a, b, e and h as ruled; if this is ruled in, it
is a second commit or a scope addition to fix 1, and either way a Rule-5 churn row before
GO.
