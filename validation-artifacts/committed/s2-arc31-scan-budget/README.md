# s2-arc31 investigate — #256: dense corridors sit at the scan budget

**Sha gate.** `/healthz` returned `60098ae542149b9e9de106d56718d057c9c551cf`;
`git rev-parse HEAD` is the same. Prod tip is the s2-triage-2 merge, as the
prompt said — verified, not assumed. Every prod row below was taken at that
sha, 2026-09-14 17:19–18:30 UTC, and both probes gate on it and exit 2 on a
mismatch.

**Nothing in this arc changes product code.** Probes only, committed here.

## The headline: the issue is right about the symptom and wrong about the cause

#256 is titled "Dense corridors sit at the 20 s scan budget". Measured at
`60098ae`, over 80 served audits:

| pin | elements | cold refusal rate |
|---|---|---|
| denver | 396 | **7/20 (35 %)** |
| lakewood | 160 | **10/20 (50 %)** |

The *less* dense corridor refuses *more*. Density is not the variable, and the
corridor query is not slow: the shipped Denver union query measured
`total=4381.5 ms ttfb=4377.6 transfer=0.5 parse=3.4 bytes=79284 elements=396`
(`out-overpass-60098ae/log.txt`, L1). **99.9 % of the wall is TTFB.** Transfer
of 79 KB is half a millisecond; parsing 396 elements is 3 ms. Nothing about
the size of this query or its bbox is costing time.

What is costing time is that **the mirror chain never delivers a fallback**.
Across all 80 prod rows the `mirror` field reads `overpass-api.de` — 80/80.
A healthy second answer never arrives.

## Root cause, proven

Three measurements, in order:

1. **Mirror 1 is failing about half its single tries this hour.** Spaced 45–60 s
   apart from one IP, `overpass-api.de` returned a clean payload on **1 of 10**
   attempts; the other nine were HTTP 504 with a 695-byte body
   (`out-levers-60098ae/log.txt` L6 0/5, `out-levers2-60098ae/log.txt` L6 1/5).
2. **Mirror 2 hangs for the full HTTP timeout.** `overpass.kumi.systems`
   `/api/interpreter` returned `ReadTimeout` at **25.6 s** and again at
   **27.2 s** — it does not fail, it stalls (`out-overpass-60098ae/log.txt`,
   `out-levers2-60098ae/mirror23.json`).
3. **Mirror 3 is healthy, fast, and never reached.**
   `overpass.openstreetmap.fr` answered the bearing query in **1.5 s** and the
   full Denver scan query **3/3 clean in 2.8–4.4 s**, with buckets byte-identical
   to mirror 1's (`intersections 136 · sidewalks 229 · bike_facilities 18 ·
   interchanges 13`) — `out-levers2-60098ae/mirror3-scan.json`.

The mechanism that connects them is one line:

```python
# src/rules/site_detection.py:168-173
timeout = HTTP_TIMEOUT_S
if deadline is not None:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        return None, f"scan budget exceeded ({budget_s:g} s)"
    timeout = min(HTTP_TIMEOUT_S, remaining)
```

Each mirror is allowed **the entire remaining budget**. So on a refusing run:
mirror 1 504s at ~5.5 s, mirror 2 is handed the remaining ~14.5 s and stalls
through all of it, the deadline expires, and **mirror 3 — the one that would
have answered in 1.5–4.4 s — is never tried.** The refusal is `scan budget
exceeded (20 s)`, which is honest about the budget and silent about the fact
that two thirds of the fallback chain was never exercised.

The refusal rows corroborate the timing exactly: every one recorded
`scan=20.2 s` with `mirror=overpass-api.de` and `response_bytes=695`. 695 B is
mirror 1's 504 page (identified this arc by catching it with a status-aware
probe; arc 22 recorded the size but not the cause —
`s2-arc22-scan-honesty/README.md:120`). `meta` records the last mirror that
*responded*, so a stalled mirror 2 leaves no trace on the wire at all.

**This is a defect in fallback, not a case for a bigger budget.** A per-mirror
cap of ~7 s would run mirror 1 (5.5 s) → mirror 2 (capped 7 s) → mirror 3
(1.5–4.4 s) ≈ 14 s, inside the budget that already exists.

## The second 20 s: the corridor bearing check

`validate_corridor_against_osm` is a separate Overpass trip with its own
`CORRIDOR_CHECK_BUDGET_S = 20.0` and **no memo** (`site_detection.py:44`,
`audit.py:1356`). Measured rate of `check_unavailable` on audits that
otherwise succeeded:

| pin | check_unavailable on `ok` audits |
|---|---|
| denver | **13/30 (43 %)** |
| lakewood | **15/23 (65 %)** |

`#256`'s bar is ≤ 1 in 20. On memo-miss rows the residual (wall minus the site
scan — i.e. layout plus this check) has a median of **20.6 s** on Denver cold,
which is this check spending its budget and failing.

Worst measured wall: **38.8 s** (denver cold). The Vercel proxy's ceiling is 60 s
(`app/api/render/audit/route.ts:8`). A scan refusal (20 s) plus a corridor check
(20 s) plus layout sits close enough to that ceiling to matter.

Two further facts about this check:

- **It is a third trip on the PDF path.** `plan_sheet.py:3542` calls it again
  with the same budget, so a PDF render is scan + check + check.
- **On the picker path it largely re-asks a question already answered.** The
  operator's `meta.bearingDeg` comes from `/api/road-bearing`
  (`LocationPickerModal.tsx:822`), which derives the bearing from OSM ways at
  that anchor. The audit then spends 20 s asking OSM for the road bearing at
  the same anchor to validate it. It can only really disagree with itself when
  the bearing was typed by hand.

## Levers, each with its measured effect

| lever | measured | verdict |
|---|---|---|
| `[timeout:10]` → 20 → 25 (`site_detection.py:459`) | 7.1 s / 504 / 3.4 s — no signal; spread is mirror load. **No run in this arc ever produced a `remark`** (0 in 80 prod rows), so the query never hits its own execution limit | **No effect.** Raising it changes nothing |
| bbox `use_max` (`site_scan.py:641`) | wide **1361.4 m** × 200.5 m vs tight **1346.2 m** × 200.5 m — a 15.2 m difference on 1.36 km, **1.1 %** | **Not the problem.** And with transfer at 0.5 ms for 79 KB, a 1.1 % smaller box cannot move a TTFB-dominated wall. Recall cost **not measured** (both legs 504'd twice) — but it does not need measuring to be rejected |
| split the union into 15 per-clause queries | 15 serial trips, **88.8 s**, 0 elements recovered, most legs 429 | **Strictly worse.** Overpass reports `Rate limit: 2` per IP; fifteen serial trips is self-defeating by construction |
| mirror selection / ordering (`site_detection.py:52-56`) | mirror 1 **1/10** clean; mirror 2 stalls 25–27 s; mirror 3 **3/3** clean at 2.8–4.4 s | **The lever.** The comment claims "ordering puts the most-reliable first"; today's measurement contradicts it |
| per-mirror timeout cap (`:168-173`) | mirror 1 fails fast (5.5 s); a 7 s cap on mirror 2 leaves 7+ s for mirror 3, which needs 1.5–4.4 s | **The fix.** Costs no budget increase |
| fold the two trips into one query | one request returned **408 elements = 396 scan + 12 bearing**, separable by the presence of `geometry`; scan buckets identical; **+11,744 B (+14.8 %) and +9 ms transfer** | **Works.** Removes a whole round trip and a whole 20 s budget |
| memo the corridor check | not applicable to the first request of a session, which is the one #256 is about | Helps repeats only |
| pre-scan on pin confirmation | warm-leg memo hits **59 % denver / 69 % lakewood** — so **~1 in 3 immediate repeats lands on a different container** | **Partial at best.** See below |

## The memo, and why a pre-scan is not the answer

The memo is per container (`site_scan.py:71-76`) against `max_containers=8`
with no declared concurrency (`modal_app.py:132`). The `warm` legs fired
immediately after their `cold` twin with a byte-identical body and still
missed the memo 41 % / 31 % of the time. A pre-scan on pin confirmation warms
**one** container; roughly a third of Generates would land elsewhere and pay
full price anyway. It also does not help the corridor check, which has no memo
at all. The structural version of this lever is a **shared** memo (a Modal
Dict) rather than a per-container dict — that is a different, larger change.

Also note the scan runs from `_placements_for` (`render_api.py:460, 621`),
which is called by four endpoints (`:661, :985, :1255, :1297`). One Generate
fans out across several of them, each with its own budget and its own memo,
against a per-IP Overpass rate limit of 2. Two prod rows came back with
**703-byte** bodies — the 429 signature — so Modal is hitting that limit too.

## Rule 12 — every number traced or marked CHOSEN

| constant | where | status |
|---|---|---|
| `SCAN_BUDGET_S = 20.0` | `site_scan.py:63-69` | **CHOSEN**, reasoned (ruling 4, s2-arc15) |
| `MEMO_TTL_S = 120.0` | `site_scan.py:71-76` | **CHOSEN**, traced to the Modal request lifetime |
| `CORRIDOR_CHECK_BUDGET_S = 20.0` | `site_detection.py:36-44` | **CHOSEN, explicitly "not traced"** in its own comment |
| `DEFAULT_RADIUS_M = 500.0` | `site_detection.py:30-34` | **CHOSEN** (#16) |
| `_CORRIDOR_LATERAL_BUFFER_M = 100.0` | `site_detection.py:406-414` | **CHOSEN** (#16), with its invariant stated |
| `_CORRIDOR_LONGITUDINAL_BUFFER_M = 152.4` | `site_detection.py:400-405` | **Traced** — 500 ft ≥ the widest tolerance |
| `HTTP_TIMEOUT_S = 25.0` | `site_detection.py:35` | **GAP — bare literal, no comment, no marker** |
| `[timeout:10]` ×3 | `site_detection.py:74, 459, 650` | **GAP — no comment at any of the three sites** |
| `OVERPASS_MIRRORS` order | `site_detection.py:48-56` | **GAP — asserted "most-reliable first", never measured; today's data contradicts it** |
| `_VALIDATION_SEARCH_RADIUS_M = 50.0` | `site_detection.py:765-768` | Explained, **not marked** CHOSEN, no source |
| `_BEARING_CONFLICT_THRESHOLD_DEG = 15.0` | `site_detection.py:770-774` | Explained, **not marked** CHOSEN, no source |

**No budget needs raising.** The argument for raising one would have to be
that the work genuinely takes that long; it does not — the query answers in
2.8–4.4 s on a working mirror. The 20 s is being spent waiting on servers the
chain should already have abandoned.

## Probe defects, recorded rather than cleaned up

- `s2a31_overpass.py` **rate-limited itself.** L3, L4 and L5 fired requests
  back to back against `Rate limit: 2` and earned 429s (703-byte bodies). Those
  rows measure the probe, not the lever. `s2a31_levers.py` exists to re-run them
  spaced, and says so in its own header. L1 and L2 ran before the limiter
  engaged and stand.
- `residual_ms` is **meaningless on memo-hit rows**: it is `wall − duration_ms`,
  and on a hit `duration_ms` is the stored *original* fetch's duration. It went
  negative (−557 ms, c5 denver warm). `rows-to-table.py` reports residual over
  `memo_hit == false` rows only, and says why in its own banner.
- Both Python probes carry a standing caveat that they run from the developer's
  IP, so their **wait** terms are not Modal's waits; element counts, byte sizes
  and recall comparisons are query properties and do carry over.
- Overpass load is a property of the hour. Every table here is stamped and is
  comparable only to another run of the same shape.

## Not measured this pass

- **The recall cost of the tight bbox.** Both legs 504'd on two attempts. The
  lever is rejected on the geometry (1.1 %), not on recall.
- **The folded query's timing against the two-trip form.** The folded leg
  returned 200 but one two-trip leg 504'd in the same run, so there is no
  like-for-like pair. The *separability* result is measured and stands.
- **Whether mirror 2's stall is what consumes the budget on any specific prod
  refusal.** The wire cannot show it: `meta` records only the last mirror that
  *responded*. The inference is strong (mirror 1 504s at ~5.5 s, refusals land
  at 20.2 s, mirror 2 stalls 25–27 s from here) but it is an inference. Making
  it observable is itself a proposed change.

## Files

- `investigate/s2a31-prod.js` — 20 cold cycles × 2 pins × {cold, warm}, 80
  served audits, sha-gated. `out-prod-60098ae/`.
- `investigate/s2a31_overpass.py` — decomposition and L1/L2 (L3–L5 invalidated
  by self-inflicted 429s). `out-overpass-60098ae/`.
- `investigate/s2a31_levers.py` — spaced re-run, plus the folded query.
  `out-levers-60098ae/`, `out-levers2-60098ae/`.
- `investigate/rows-to-table.py` — the distribution tables.
