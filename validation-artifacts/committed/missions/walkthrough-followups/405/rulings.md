# #405 rulings and plan (mission walkthrough-followups, tracking #423)

Base: `origin/lane-doubt-prod-check` 6e43fa4. Branch `issue-405-road-detection`.

## Measured before (read-only, 2026-10-27, residential connection)

`probe405.mjs` sends the route's own first query (the `buildQuery` text) to all three mirrors at once, 25 s cap each, then times the live `POST https://www.conestruct.com/api/road-bearing` for the same pin. Two runs of the issue's five searches: `before-1.json` (row 2 misgeocoded to Nebraska, so its timings are for the wrong place) and `before-2.json` (row 2 on the Colfax-at-Williams pin 39.74003, -104.96555, #411's `colfaxPin`).

| Mirror | Answered | Times |
|---|---|---|
| overpass-api.de (1st in the route's chain) | 0 of 10 | 502 in ~0.5 s (4), no answer in 25 s (6) |
| overpass.kumi.systems (2nd) | 0 of 10 | no answer in 25 s (10) |
| overpass.openstreetmap.fr (3rd) | 10 of 10 | 1.4-8.0 s, median 1.9 s |

Live route, SEARCH-free (the POST alone): before-1 26.6, 19.9, 26.0, 21.3, 26.4 s (median 26.0 s; its row 2 was timed on the wrong place, see above); before-2 28.2, 15.5, 14.8, 25.3, 19.4 s (median 19.4 s). Across all ten: median 23.3 s, which is the figure that matches the issue's 22-27 s. The comparison below uses before-2 alone (median 19.4 s), as the run whose five pins are the issue's; before-1 is set aside for its row 2. On the old chain each round trip reached .fr only after de had failed, either a 502 in about 0.5 s (4 of 10 probes) or its 6 s cap (6 of 10), and after kumi's 6 s cap (10 of 10): 6.5-12 s of waiting per round trip before .fr was asked. A second round trip (the same-name geometry query) runs only when a candidate has a name or ref; every one of the five searches here had named roads, so each paid it twice.

The live failure (#421's prod check, "Detection service unavailable" (`LocationPickerModal.tsx:703`, `:722`, `:766`) three times at 1440): the picker shows that text on a `scan_status: "unavailable"` body (`:709-725`), on any non-OK route response (`:697-706`) and on any fetch error (`:759-769`). Possible causes therefore include, among others: a 4xx from a mirror, on which the old route returned `unavailable` at once without asking .fr (6e43fa4 `route.ts:196`); every mirror failing (including a .fr answer later than its 6 s cap); the route's own rate limiter (`rateLimitOr429(req, "road-bearing", 30)`, 6e43fa4 `route.ts:577`), which the prod check's repeated Re-detect retries could have hit; and a platform timeout. The route logged nothing, so which one happened in production is not recoverable. This change addresses the first two only.

## Plan (5 bullets)

1. New `lib/road-detection/overpass.ts`: the backend's #292 race (`src/rules/site_detection.py` `_race`), partly ported. Ported: R69 (ask at once, first valid answer wins, cancel the rest), R70 (kumi dropped), R73 (429 rest), and R74's failure rule, which reads "A 4xx, 429, 5xx, remark or emptied answer from one mirror is that mirror's failure; the other's answer stays in play." (`site_detection.py:411-412`), except its emptied-answer case. Not ported: that emptied-answer case, R74's `validate` hook (an answer that #304's cleaning empties loses the race, `site_detection.py:408-410`); the route has no such check before the race, and its #305 cleaning (`usableWays`) runs after it, so a mirror whose answer cleans to nothing still wins. Also not ported: Overspan (R102) and the shared scan budget. In the port, the mirrors are asked at once, the first valid answer (200, JSON, no `remark`) wins and the other request is aborted; a 4xx, 429, 5xx, network error, invalid JSON or remark is that mirror's failure only; a 429 rests the mirror for its Retry-After, else 60 s (R73's CHOSEN value); one hard deadline per round trip.
2. The route's mirror list becomes the backend's: overpass-api.de and overpass.openstreetmap.fr; kumi dropped (R70, and 0 of 10 here). A vitest reads `site_detection.py` and fails if the two lists drift.
3. Per-mirror timings logged: one `console.info` JSON line per round trip (`trip`, winner, total ms, each mirror's ms and outcome), the route's counterpart of the scan's `mirror` meta (#251/#256).
4. `route.ts` calls the race for both round trips; its own chain, `OVERPASS_TIMEOUT_MS` and `OVERPASS_USER_AGENT` go. The wire shape, `scan_status` rules (#213), the 499 on client abort and the picker (DETECTING state, Save gating) are unchanged.
5. Tests where the bug lives (Rule 11): route-level tests for a 4xx/429 on the first mirror with .fr answering (red on base), a stalled first mirror not delaying .fr's answer (red on base), a remark failing over (red on base); lib tests for the deadline, the 429 rest, the log line and the list drift guard. Existing FIFO stubs move to per-mirror scripting (the race makes call order concurrent).

## Churn prediction (Rule 5, before the diff)

| File | Predicted |
|---|---|
| `conestruct/site/lib/road-detection/overpass.ts` (new) | about +150 |
| `conestruct/site/lib/road-detection/overpass.test.ts` (new) | about +170 |
| `conestruct/site/app/api/road-bearing/route.ts` | about +12 / -50 |
| `conestruct/site/app/api/road-bearing/route.test.ts` | about +70 / -30 |
| `conestruct/site/app/api/road-bearing/route.twin.test.ts` | about +4 / -1 |
| `conestruct/site/app/api/road-bearing/route.null-points.test.ts` | about +4 / -1 |

## Calls

1. **R145 self-ruled: race, not a reordered chain.** The backend already settled this question for the same mirrors (#292 R69/R74: asked at once, first valid answer wins). A reordered sequential chain would still pay the first mirror's cap whenever .fr is slow or down. Reusing the pattern, not the producer: the producer is Python behind Modal, and calling it from the Next route adds a cold-startable hop to the first step of every plan.
2. **R145 self-ruled: mirror list = the backend's** (R70 dropped kumi; this probe: 0 of 10).
3. **R145 self-ruled, Rule 12 CHOSEN: `OVERPASS_DEADLINE_MS` = 10,000 per round trip.** Reason: the query itself carries `[timeout:10]`, so Overpass gives up on it at 10 s server-side; past that a mirror's answer would be a timeout remark, not data. The issue's 8 s was considered and not taken as a cap: .fr answered once in 7.97 s (before-2 row 5), which an 8 s cap would have turned into "unavailable". Worst case for a two-trip search is 20 s (was 36 s: 3 x 6 s x 2); the common case is .fr's ~2 s per trip.
4. **R145 self-ruled, Rule 12 CHOSEN: the Acceptance target (a median SEARCH-to-candidate-list time under 8 s, #405 body, Acceptance) is kept as the check**, measured on the issue's five searches after the change (the route POST alone, with the same probe). Its reason: P3's Doherty threshold is far below either number; 8 s is the issue's chosen bar and the measurement below says whether it is met.
5. **R145 self-ruled: a 4xx no longer stops the chain** (Rule 5, stated). The old rule (a 4xx means the query is bad, so stop) is the backend's retired one; R74 counts a 4xx as that mirror's failure. The query text is fixed by the route, so a 4xx in practice is a mirror's 429/406, not a bad query.
6. **R145 self-ruled: a 200 with a `remark` is a mirror failure** (#251's rule, ported). Before, it was read as a payload, so a timed-out query could come back as "No road detected within 30 m" (`LocationPickerModal.tsx:730`), a false absence (Rule 10).
7. **R145 self-ruled: no cache by rounded pin.** Not needed for the target once the race lands; it would add a staleness question (Rule 10) for no measured gain.
8. **R145 self-ruled (fold, R154 test): `src/rules/site_detection.py` added to SITE_INPUTS in `conestruct/site/vercel-ignore.sh`.** The drift guard reads that file, and `tests/build-inputs.test.ts` (R2) requires every outside path a site test reads to be on the list (the first full run failed on exactly that; `full-run-fails.txt`). One line, in a file the branch's tests reach, no ruling needed. Prediction amended before that diff: `vercel-ignore.sh` +1.

## Measured after

The branch's route run locally (`next dev`, port 3405) from the same residential connection, with the same probe and the same five searches, twice (`after-1.json`, `after-2.json`; the route's own per-trip log lines in `after-route-log.jsonl`). Production can't be measured before a ship; the production check re-runs `probe405.mjs` against the live route.

| Run | Route POST times (s) | Median |
|---|---|---|
| before-1 (live, old chain; set aside: row 2 on the wrong place) | 26.6, 19.9, 26.0, 21.3, 26.4 | 26.0 |
| before-2 (live, old chain) | 28.2, 15.5, 14.8, 25.3, 19.4 | 19.4 |
| before, both runs (10) | | 23.3 |
| after-1 (local, race) | 6.1, 2.6, 2.5, 3.1, 3.8 | 3.1 |
| after-2 (local, race) | 4.2, 7.2, 2.9, 4.1, 2.8 | 4.1 |

Same candidate counts as before on every search (4, 2, 4, 4, 4). The route's log has 22 round trips, 11 `roads` and 11 `geometry` (the trip names at `route.ts:166` and `:484`): the probe's ten searches plus one warm-up POST (curl, the 39.74003, -104.96555 pin) sent before after-1 to compile the route, which made the first pair (lines 1-2). overpass.openstreetmap.fr won all 22; overpass-api.de answered HTTP 502 three times, 429 once (line 18, after-2's Wadsworth search; it was then rested, and the four later trips skipped it), and was cancelled on the rest. A 429 is one way the old chain returned `unavailable`. The 429 here was seen locally, from the residential IP, alongside the probe's own load on overpass-api.de (the probe's direct calls got 429s in after-2 too), so it says nothing about what production's Vercel traffic gets. Roads trip 1.4-2.9 s; geometry trip 0.9-6.5 s.

Against the Acceptance: the route POST's median is under 8 s on local `next dev` (3.1 and 4.1 s). The Acceptance's measure, SEARCH to the candidate list in production, isn't measured here; it is left to the production check. Per-mirror timings are logged (one JSON line per round trip). The DETECTING state and Save gating are untouched (no change under `components/`).

## Churn, predicted vs actual

| File | Predicted | Actual |
|---|---|---|
| `lib/road-detection/overpass.ts` (new) | about +150 | +213 (the comment block and the per-mirror log's outcomes; +1 from the review's comment fix) |
| `lib/road-detection/overpass.test.ts` (new) | about +170 | +192 |
| `app/api/road-bearing/route.ts` | about +12 / -50 | +10 / -46 |
| `app/api/road-bearing/route.test.ts` | about +70 / -30 | +88 / -18 |
| `app/api/road-bearing/route.twin.test.ts` | about +4 / -1 | +6 / -1 |
| `app/api/road-bearing/route.null-points.test.ts` | about +4 / -1 | +1 / -0 |
| `vercel-ignore.sh` (amended, call 8) | +1 | +1 |
