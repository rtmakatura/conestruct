# s2-arc22 — #251: an Overpass "remark" is not an answer

Same inputs, two verdicts (Ryan, prod `4443ccf`, 2026-09-07): Generate → Note 8
FAIL; Regenerate → no FAIL, and the second plan carried **no** NOT-CHECKED
disclosure, so the proceed-anyway path is excluded. The only path that returns
`status: ok` with a truncated feature set is an HTTP 200 whose body carries an
Overpass `remark`. This arc closes it.

## The defect, measured

`remark-query.overpassql` is the corridor query shape (footway / sidewalk /
cycleway union) over a large bbox with `[timeout:1]`, sent to overpass-api.de
on 2026-09-07 with the project User-Agent. `remark.json` is the answer:

```
HTTP 200   371 bytes   3.07 s
remark   = runtime error: Query timed out in "query" at line 3 after 2 seconds.
elements = []
```

Before this arc `_overpass_request_with_fallback` returned that body as a
payload (`site_detection.py`, the `resp.json(), None` return), every bucket
scored absent, `run_site_scan` stamped `ok`, memoised it for 120 s and fanned it
out. Nothing in the repo read `remark`. On a divided road that makes the
sidewalk and bike adjustments vanish, and with them the 7-left / 11-right Note 8
FAIL (`remark-measurement.txt`).

## What shipped

| commit | change |
|---|---|
| `db2c748` | a body with `remark` is a mirror failure: recorded as the mirror's error, next mirror inside the budget; no clean mirror ⇒ `unavailable` with `error = "<mirror>: overpass remark: <first line>"`, never memoised. A clean 200 with `elements: []` and no remark stays `ok` (an empty corridor is a measurement). |
| `cc837f9` | `SiteScanProvenance` gains `mirror`, `overpass_remark`, `response_bytes`, `element_count` (null when nothing was fetched; the original fetch's values on a memo hit; the last mirror + its remark on a refusal). The detector's `overpass` key is excluded from `buckets` **by name**. Audit PDF prints the mirror after duration / memoised. 78 snapshots re-baselined, single leaf (four null keys each, 312 insertions, 0 deletions). |
| `15d30d9` | The block footer prints `· 2.7 s` (the wire's `duration_ms` as seconds, one decimal — display formatting) and `· memoised` when `memo_hit`. |

Untouched, by ruling: `[timeout:10]` in the query, `SCAN_BUDGET_S`, `MEMO_TTL_S`,
`CORRIDOR_CHECK_BUDGET_S`, mirror order, 4xx/429 handling.

## Red proofs and suites

- `red-run-c1-remark.txt` — 3 failed, 1 passed (the clean-empty pin is green at
  baseline by design).
- `red-run-c2-provenance.txt` — 4 failed.
- `red-run-c3-footer.txt` — 2 failed | 23 passed.
- `pytest-c2.txt` — 2044 passed, 2 skipped (was 2036). `vitest-c3.txt` — 946
  passed across 129 files (was 944).

## Prod measurement — method

`s2a22-runs.js`: drive the real /sandbox once per pin (manual pin, bearing 180,
work zone 1000 ft — the arc-21 idiom; this gives the form defaults
`rural_divided` / 65 mph / no centerline, where Ryan's search-pin would carry
the road-detected classification and a centerline), capture the exact body the
browser POSTs to `/api/render/audit` with `site_scan`, then replay that
byte-identical body ten times per pin, 31 s apart, reading the served audit
(never the replication snapshot, #244). Every audit is in the run directory;
`rows.json` is the extraction, `table.md` the rendering (`rows-to-table.py`).
`wall` is the proxy round trip; `dur ms` the scan's own `duration_ms`.

### Before the fix — prod `dae2298`, 2026-09-07 14:18–14:26 UTC (`outS2A22Prod-pre/`)

| run | pin | HTTP | wall | scan | memo | dur ms | measured_at | int/ich/sw/bike | mirror | bytes | elem | corridor | Note 8 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | denver | 200 | 10.2 s | ok | no | 6131 | 14:18:48 | 46/10/103/11 | — | — | — | checked | FAIL |
| 1 | lakewood | 200 | 9.7 s | ok | no | 8942 | 14:18:55 | 19/0/22/37 | — | — | — | checked | FAIL |
| 2 | denver | 200 | 5.0 s | ok | yes | 2624 | 14:18:36 | 46/10/103/11 | — | — | — | checked | FAIL |
| 2 | lakewood | 200 | 0.8 s | ok | yes | 8942 | 14:18:55 | 19/0/22/37 | — | — | — | checked | FAIL |
| 3 | denver | 200 | 20.6 s | ok | yes | 2624 | 14:18:36 | 46/10/103/11 | — | — | — | not-checked/check_unavailable | FAIL |
| 3 | lakewood | 200 | 6.9 s | ok | no | 3773 | 14:20:34 | 19/0/22/37 | — | — | — | checked | FAIL |
| 4 | denver | 200 | 3.5 s | ok | no | 2227 | 14:21:11 | 46/10/103/11 | — | — | — | checked | FAIL |
| 4 | lakewood | 200 | 11.0 s | ok | yes | 3773 | 14:20:34 | 19/0/22/37 | — | — | — | not-checked/check_unavailable | FAIL |
| 5 | denver | 200 | 1.8 s | ok | yes | 2227 | 14:21:11 | 46/10/103/11 | — | — | — | checked | FAIL |
| 5 | lakewood | 200 | 20.7 s | ok | yes | 3773 | 14:20:34 | 19/0/22/37 | — | — | — | not-checked/check_unavailable | FAIL |
| 6 | denver | 200 | 1.4 s | ok | yes | 2227 | 14:21:11 | 46/10/103/11 | — | — | — | checked | FAIL |
| 6 | lakewood | 200 | 4.2 s | ok | no | 2810 | 14:22:52 | 19/0/22/37 | — | — | — | checked | FAIL |
| 7 | denver | 400 | 20.8 s | **HTTP 400** site_scan_unavailable | no | — |  | — | — | — | — | — | — |
| 7 | lakewood | 200 | 3.0 s | ok | yes | 2810 | 14:22:52 | 19/0/22/37 | — | — | — | checked | FAIL |
| 8 | denver | 200 | 23.6 s | ok | no | 2739 | 14:24:22 | 46/10/103/11 | — | — | — | not-checked/check_unavailable | FAIL |
| 8 | lakewood | 200 | 0.9 s | ok | yes | 2810 | 14:22:52 | 19/0/22/37 | — | — | — | checked | FAIL |
| 9 | denver | 200 | 1.5 s | ok | yes | 2739 | 14:24:22 | 46/10/103/11 | — | — | — | checked | FAIL |
| 9 | lakewood | 200 | 27.7 s | ok | no | 7070 | 14:25:19 | 19/0/22/37 | — | — | — | not-checked/check_unavailable | FAIL |
| 10 | denver | 200 | 20.9 s | ok | yes | 2739 | 14:24:22 | 46/10/103/11 | — | — | — | not-checked/check_unavailable | FAIL |
| 10 | lakewood | 200 | 1.4 s | ok | yes | 7070 | 14:25:19 | 19/0/22/37 | — | — | — | checked | FAIL |

19 of 19 `ok` runs identical per pin; 1 honest refusal (denver #7, budget);
6 of 19 audits carried `check_unavailable` on the corridor check while the site
scan said `ok`. The flip itself was not reproduced in this window — the path is
proven at the Overpass boundary, its rate at this corridor is not measured.
Mirror / bytes / elements are absent: the wire did not carry them.

### After the fix — prod `cc837f9` (healthz == origin/main), 2026-09-07 15:03–15:12 UTC (`outS2A22Prod-post/`)

| run | pin | HTTP | wall | scan | memo | dur ms | measured_at | int/ich/sw/bike | mirror | bytes | elem | corridor | Note 8 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | denver | 200 | 14.5 s | ok | no | 3202 | 15:03:39 | 46/10/103/11 | overpass-api.de | 79284 | 396 | checked | FAIL |
| 1 | lakewood | 200 | 25.1 s | ok | no | 3148 | 15:03:51 | 19/0/22/37 | overpass-api.de | 46404 | 160 | not-checked/check_unavailable | FAIL |
| 2 | denver | 200 | 24.7 s | ok | no | 3681 | 15:04:48 | 46/10/103/11 | overpass-api.de | 79284 | 396 | not-checked/check_unavailable | FAIL |
| 2 | lakewood | 200 | 3.8 s | ok | no | 2251 | 15:05:12 | 19/0/22/37 | overpass-api.de | 46404 | 160 | checked | FAIL |
| 3 | denver | 200 | 24.6 s | ok | no | 3834 | 15:05:47 | 46/10/103/11 | overpass-api.de | 79284 | 396 | not-checked/check_unavailable | FAIL |
| 3 | lakewood | 200 | 20.6 s | ok | yes | 2251 | 15:05:12 | 19/0/22/37 | overpass-api.de | 46404 | 160 | not-checked/check_unavailable | FAIL |
| 4 | denver | 200 | 6.8 s | ok | yes | 3834 | 15:05:47 | 46/10/103/11 | overpass-api.de | 79284 | 396 | checked | FAIL |
| 4 | lakewood | 200 | 20.5 s | ok | yes | 2251 | 15:05:12 | 19/0/22/37 | overpass-api.de | 46404 | 160 | not-checked/check_unavailable | FAIL |
| 5 | denver | 200 | 23.4 s | ok | no | 2685 | 15:08:02 | 46/10/103/11 | overpass-api.de | 79284 | 396 | not-checked/check_unavailable | FAIL |
| 5 | lakewood | 200 | 2.5 s | ok | no | 1625 | 15:08:25 | 19/0/22/37 | overpass-api.de | 46404 | 160 | checked | FAIL |
| 6 | denver | 200 | 10.0 s | ok | yes | 2685 | 15:08:02 | 46/10/103/11 | overpass-api.de | 79284 | 396 | checked | FAIL |
| 6 | lakewood | 200 | 13.5 s | ok | yes | 1625 | 15:08:25 | 19/0/22/37 | overpass-api.de | 46404 | 160 | checked | FAIL |
| 7 | denver | 200 | 13.2 s | ok | yes | 2685 | 15:08:02 | 46/10/103/11 | overpass-api.de | 79284 | 396 | checked | FAIL |
| 7 | lakewood | 200 | 1.8 s | ok | yes | 1625 | 15:08:25 | 19/0/22/37 | overpass-api.de | 46404 | 160 | checked | FAIL |
| 8 | denver | 200 | 25.2 s | ok | no | 4461 | 15:10:39 | 46/10/103/11 | overpass-api.de | 79284 | 396 | not-checked/check_unavailable | FAIL |
| 8 | lakewood | 400 | 20.6 s | **HTTP 400** site_scan_unavailable — scan budget exceeded (20 s) | no | 20241 | 15:11:04 | — | overpass-api.de | 695 | — | — | — |
| 9 | denver | 200 | 4.3 s | ok | yes | 4461 | 15:10:39 | 46/10/103/11 | overpass-api.de | 79284 | 396 | checked | FAIL |
| 9 | lakewood | 200 | 8.1 s | ok | no | 5880 | 15:12:00 | 19/0/22/37 | overpass-api.de | 46404 | 160 | checked | FAIL |
| 10 | denver | 200 | 20.7 s | ok | yes | 4461 | 15:10:39 | 46/10/103/11 | overpass-api.de | 79284 | 396 | not-checked/check_unavailable | FAIL |
| 10 | lakewood | 200 | 20.5 s | ok | yes | 5880 | 15:12:00 | 19/0/22/37 | overpass-api.de | 46404 | 160 | not-checked/check_unavailable | FAIL |

19 of 19 `ok` runs identical per pin and identical to the pre-fix counts; every
answer came from overpass-api.de with a stable body (Denver 79 284 B / 396
elements, Lakewood 46 404 B / 160 elements) and no remark; memo hits re-serve
the same fetch. One honest refusal (lakewood #8: the first mirror answered
695 B that was not a payload (a 5xx or a non-JSON body; the wire records size, not status) and the chain ran out of budget; `mirror` names it,
`overpass_remark` null, `element_count` null). Nothing in either table is a
remark case: the fix's own branch is proven at test level (a stubbed
`httpx.post`), not on demand against a live server.

## #243 after this arc

With a detected sidewalk (2× R9-9 at +offset) or bike facility (2× M4-9a at
+offset) on a divided road, Note 8 counts 7 left / 11 right and fails — on all
38 `ok` runs above, deterministically. A no-FAIL plan now requires an honest
non-`ok` status with its disclosure; a scan can no longer silently come back
empty. #243's fix (exclude the adjustment signs from the per-side count) can be
verified against stable facts. Sequence: #251 → #243, as ruled.

## Findings for follow-up (not this arc)

- **Corridor check outages while the scan is ok** — 6 of 19 before, 9 of 19
  after: `validate_corridor_against_osm` is a second Overpass round trip with its
  own 20 s budget and no memo, so it fails independently and adds up to 20 s to
  the audit (the 20–25 s walls above). Candidate: memoise it like the scan, or
  fold the bearing check into the scan's payload.
- The memo is per container (`max_containers=8`): run 1 missed while run 2 hit a
  scan the browser's own Generate had warmed on another container 12 s earlier
  (visible in the pre table's `measured_at`). Honest on the wire (`memo_hit`,
  `measured_at`), now also on the footer.
- 4xx from the first mirror (incl. 429) still stops the chain without trying the
  others — an avoidable refusal, not a wrong answer.

## Contracts

Rule 10 — remark never scores ok; clean empty still ok; both tested. Rule 3 —
status and the four fields backend-owned; the footer formats a backend number.
Rule 12 — no new threshold. Pins — 78 snapshots moved with the wire in the same
commit; tiering fixtures unchanged (fact-level compare). #198 — read; the
frontend auto-apply handoff notes; nothing here touches it. Suggest-never-set —
response side only, no request field, no payload sender enumeration needed.
Citation counter — 19, no new citations.
