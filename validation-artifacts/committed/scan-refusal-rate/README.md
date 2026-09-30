# How often the site scan refuses on prod, and why the device breakdown 400s (2026-09-30)

Investigate only: read-only probes against prod `c055262` (= `healthz`), through the coming-soon gate.
No code. Asked after #304's ship, where three Federal attempts returned the honest refusal at ~21 s
and one device-breakdown call returned 400.

## Runs

| Probe | What | Output |
|---|---|---|
| `probes/measure_refusals.py` | 10 Denver pins (road confirmed from prod's own `/api/road-bearing`; the site's request shape), 3 rounds ≥ 130 s apart (> the scan memo's 120 s TTL), audit then breakdown, sequential | `out/run2.jsonl` (18:57–19:10Z). `out/run1.*` is the first attempt, which died resolving pins (kept, per the standing caution) |
| `probes/measure_concurrent.py` | 5 of those pins, audit + breakdown **at once**, as the site's Generate sends them | `out/concurrent.jsonl` (19:13–19:14Z) |
| `probes/road_bearing_null_points.ts` | the picker's road lookup (`app/api/road-bearing/route.ts` `POST`) fed #304's real primary and fallback captures, fetch stubbed | `probes/road-bearing-null-points.txt` |

`n-federal` never resolved in `run2`: `/api/road-bearing` answered non-JSON on 4 of 4 tries (18:57–18:59Z),
so the sequential run has 9 pins, 27 audits. A later single call resolved it in 25.9 s; the same minute,
Broadway's answered `scan_status: "unavailable"` after 18.7 s.

## Results

**Refusals: 1 of 37 cold scans (2.7%) in this window.**

| | Scans | ok | Refused | Mirror that answered |
|---|---|---|---|---|
| Sequential audits (`run2`) | 27 | 27 | 0 | `overpass-api.de` 9 (scan 2.5–4.7 s), `overpass.openstreetmap.fr` 18 (15.4–18.3 s), `kumi` 0 |
| Concurrent audits | 5 | 5 | 0 | primary 2, fr 3 |
| Concurrent breakdowns | 5 | 4 | **1** | — |

- **The margin:** two thirds of scans reached the third mirror only after two 7 s caps, and
  finished 1.7–4.6 s inside the 20 s budget (worst 18,280 ms).
- **The refusal:** `broadway-demo` breakdown, `400 site_scan_unavailable`, 21.0 s, scan 20,188 ms,
  error `https://overpass.openstreetmap.fr/api/interpreter: ReadTimeout: The read operation timed out`.
  That's #292's shape exactly.
- **Kumi:** it answered nothing all afternoon. Two direct posts of the Federal query timed out at 30 s.

**The device-breakdown 400 is its own scan refusing.**
- `/render/device-breakdown` builds the plan through `_placements_for`, which runs `run_site_scan`
  and raises the same 400 on a refusal (`src/api/render_api.py:765-766`).
- The site fires the breakdown and the audit from two effects gated on the same `fetchArmed`
  (`conestruct/site/components/GeneratorShell.tsx:455-472`, `:516-530`). They go out together.
- The memo is written only after a scan completes (`src/api/site_scan.py`), so each call runs its
  own Overpass scan.
- **Measured:** each concurrent breakdown took about as long as a scan (4.2 / 17.7 / 4.9 / 18.0 s,
  and 21.0 s refused), never the ~0.9 s of a memo hit. On `e-bayaud` the two calls took different
  mirrors (breakdown 4.9 s, audit 17.1 s).
- On `broadway-demo` the **audit answered 200 in 3.7 s** while the **breakdown refused at 21.0 s**:
  the page gets a plan beside "Device breakdown failed".

**Side finding: the picker's road lookup crashes on the fallback mirror's answer (#304's twin).**
- `buildResponse` projects every geometry segment with `a.lat` / `b.lat` unchecked
  (`conestruct/site/app/api/road-bearing/route.ts:391-394`), and it runs outside any `try` (`:571`).
- Fed #304's fallback capture, it throws `TypeError: Cannot read properties of null (reading 'lat')`.
  The primary capture gives 200 with North Federal Boulevard.
- A throw there is a non-JSON 500, which matches the 4 non-JSON answers for Federal, and the #243
  sweep's picker offering no road at Federal.

## Not measured

- The three Federal refusals at ~21 s right after #304's ship (their error text wasn't kept).
- Any hour but 18:57–19:14Z. #292's own runs show the rate moves by the hour.
