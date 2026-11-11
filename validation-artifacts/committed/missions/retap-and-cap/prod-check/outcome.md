# Production check: mission retap-and-cap (#494) on 8c1f69d

Date: 2026-11-10 (UTC 2026-11-11 03:49-04:02).  `/healthz` sha = `8c1f69d8267f55aa1b8ccccd9b8b3af8a1763829` = `origin/main`.
Site: https://www.conestruct.com, backend https://rtmakatura--conestruct-render-fastapi-app.modal.run.  Read-only: nothing saved, no
one signed in.  The gate token and the render secret were read from the main checkout's `conestruct/site/.env.local` into the process
environment at run time; the gate header went only to www.conestruct.com through `scripts/gate.cjs`.  Checks ran one at a time, with at
least 60 s between any two that touch `/api/needs-you-map`.

| Item | Result |
|---|---|
| #492 40 a minute, the 41st refused | **PASS**: requests 1-40 -> 400, request 41 -> 429 "Too many requests", all 41 inside one fixed window |
| #493 the tap path, test pin (2) | **Not reached**: the test's synthetic pin did not reach the tap path (both bodies answered `x-map-cross-source: lookup`, nothing drawn); see § 2 for why |
| #493 the tap path, sandbox pin (2b) | **PASS** (n=1): the sandbox's own body plus the tap record answered `x-map-cross-source: tap`, "Franklin Street" drawn, 2.44 s; see § 2b |
| #493 re-tap keeps an edited approach | **Not walked on prod** (#489: the WHERE tap/picker is not walkable headless on live data); covered by the unit tests `cross-street-apply.test.ts` |
| Generate CLS | **PASS**: CLS 0 at 1440x900, 1198x930, 390x844; outlines left 0; soft->sharp PASS |
| axe / 44 px / console | **PASS**: axe 0, under 44 px 0 on the 3 NEEDS YOU maps x 3 widths soft and sharp and Details open; console errors 0, page errors 0 at all three widths |

## 1. #492 (`script/probe-492-rate-limit.mjs`, log `logs/probe-492-rate-limit.txt`)

Precondition read in `conestruct/site/app/api/needs-you-map/route.ts` at 8c1f69d: `rateLimitOr429(req, "needs-you-map", PER_MINUTE)` with
`PER_MINUTE = 40` is the first statement of `POST`, before the body cap, `req.json()`, every validation check and `fetchNeedsYouMap`.  So
each request spends one count and an invalid body never reaches the backend or Mapbox.  The limiter is Upstash `fixedWindow(40, "60 s")`
(`lib/rate-limit.ts`), so the burst started 1 s after a minute boundary.

    GATE_BYPASS_TOKEN=... node validation-artifacts/committed/missions/retap-and-cap/prod-check/script/probe-492-rate-limit.mjs

41 POSTs with an invalid scenario and `zoom: 99`: every one of 1-40 answered 400 "Invalid scenario"; the 41st answered 429.  Window start
03:50:01Z, last request 8.9 s after the first.

    RESULT PASS: requests 1-40 -> 400 (429s: 0); request 41 -> 429

## 2. #493 (`script/map-493-tap-vs-lookup.py`, log `logs/map-493-tap-vs-lookup.txt`; diagnosis `script/diagnose-493-node.py`, log `logs/diagnose-493-node.txt`)

Two map renders straight to the backend's `POST /render/needs-you-map` (flag `adjacent_intersection`, 800x400), the body the #493 tests
build: `colfax()` from `tests/test_needs_you_map.py` with `meta.intersection` = `tests/fixtures/needs-you/colfax-franklin-tap.json`, then
the same body with `geometry` removed.

    with geometry:    200, x-map-cross-source lookup, x-map-subject none, no x-map-cross-street, wall 2.98 s
    without geometry: 200, x-map-cross-source lookup, x-map-subject none, no x-map-cross-street, wall 0.48 s
    RESULT FAIL: with geometry -> x-map-cross-source lookup in 2.98 s; without -> lookup in 0.48 s (n=1 each)

The two images are byte-identical (`map-493/needs-you-map-both.png`).  n=1 each; the wall-time gap is the first call's cold Overpass
read (the second answers from the backend's memo), not a tap-vs-lookup measure.

Why the sample missed the tap path: the diagnosis runs the same handler in-process on the same body with **live** Overpass and Mapbox
stubbed (no paid call).  On live OSM data the crossing the subject read picks for this pin (39.7400504, -104.9691757) is the node
(39.7401374, -104.969176), 9.7 m north of the pin and **72.7 m from the tapped Franklin point**, beyond `CROSS_STREET_RADIUS_M` = 30.
So `tapped_cross_street` correctly declines (R145-2), the lookup runs, and it finds no vehicular cross street within 30 m of that node, so
nothing is drawn (Rule 10).  The test's pin was built for the recorded Overpass fixture, where Franklin is the nearest crossing; on live
data a nearer node wins.  This is a property of the synthetic pin, not evidence about the tap path.  The real sandbox pin (1600 E Colfax,
§ 3) frames its intersection question at 39.739906,-104.968453, about 9 m from the Franklin node, and draws "Franklin Street" (by the
lookup: a search pin carries no tap record).

A sample that reaches the tap path needs a third render with the sandbox's own pin and the tap record; the coordinator approved one more
render for that (§ 2b).  What the live node at (39.7401374, -104.969176) is (no motorized cross street
within 30 m) was not identified: the one direct Overpass query sent for it returned no JSON.

## 2b. #493 on the sandbox pin (`script/map-493b-sandbox-pin.mjs`, log `logs/map-493b-sandbox-pin.txt`, body and image `map-493/`)

Approved by the coordinator 2026-11-10: one more map render.

    OUT=<extras> GATE_BYPASS_TOKEN=... node validation-artifacts/committed/missions/retap-and-cap/prod-check/script/map-493b-sandbox-pin.mjs

Capture, with no map render: the script drives /sandbox at 1440x900 as `verify-generate-cls.mjs` does (1600 E Colfax Ave, road "East
Colfax Avenue, eastbound", shoulder, first side, Generate) and captures the body the page POSTs to `/api/needs-you-map`.  Every
`/api/needs-you-map` and `/api/corridor-map` request in that browser was aborted, so the walk drew no NEEDS YOU or corridor map.  The
captured body: kind `shoulder`, pin 39.739781,-104.968249, no `meta.intersection` (a search pin carries no tap record).

The one render: that body with flag `adjacent_intersection`, 846x423, no soft, and `meta.intersection` set to the committed tap record
(`tests/fixtures/needs-you/colfax-franklin-tap.json`, Franklin Street with its 20-point line, written by the real producer), POSTed once
to the site's `/api/needs-you-map` (body saved as `map-493/map-493b-body.json`).

    render: status 200, 268625 bytes, wall 2.44 s
      x-map-cross-source: tap
      x-map-subject: drawn
      x-map-cross-tag: 434,367
      x-map-frame: 39.739906,-104.968453,18.00
      x-map-cross-street: Franklin Street
    RESULT PASS: x-map-cross-source tap, cross street Franklin Street, subject drawn, wall 2.44 s (n=1)

The frame is the same one the sandbox's own intersection question uses (§ 4, 39.739906,-104.968453), about 9 m from the Franklin node.
The image (`map-493/needs-you-map-493b.png`) shows Franklin Street dashed through the crossing.  The tag sits at 434,367 here; the
lookup-drawn map in § 4 puts it at 434,329.  Both are inside the frame, and the tag's placement was not part of this check.

Overpass: `x-map-cross-source: tap` means the backend took the branch that skips `cross_street_geometry` (render_api.py, #493), so no
cross-street Overpass read ran on this render.  Whether the subject (crossing) read was an Overpass read or a memo hit is not in any log
here: the backend's `print` lines go to Modal's logs, which this check did not read.  The 2.44 s wall time is n=1 and is not compared
against a lookup sample on the same pin.

## 3. Generate CLS (`scripts/verify-generate-cls.mjs`, unmodified; log `logs/verify-generate-cls.txt`)

    SITE=https://www.conestruct.com HOLD_MS=0 GATE_BYPASS_TOKEN=... node scripts/verify-generate-cls.mjs

    1440x900 generate CLS 0 PASS (< 0.1) | NEEDS YOU 1025 px
    1198x930 generate CLS 0 PASS (< 0.1) | NEEDS YOU 1025 px
    390x844 generate CLS 0 PASS (< 0.1) | NEEDS YOU 1135 px

Outline box check SKIPPED (HOLD_MS 0, as the script prints on production), outlines left 0 PASS, soft->sharp PASS at every width.  Exit 0.

## 4. axe, 44 px, console (`script/walk-results-prod.mjs`, copied unchanged from ux-columns-copy-maps/prod-check; log `logs/walk-results-prod.txt`, JSON `walk/`)

    SITE=https://www.conestruct.com HOLD_MS=4000 OUT=<extras>/walk GATE_BYPASS_TOKEN=... node .../script/walk-results-prod.mjs

At 1440x900, 1198x930 and 390x844: each NEEDS YOU question (3) soft then sharp, axe 0/0, under 44 px 0/0; Details closed/open axe 0/0, <44
none; console errors 0, page errors 0.  Exit 0.  The intersection question draws "Franklin Street" with its tag at 434,329 (two-column
widths) and 26,17 (390), as on beca76f.  Its `at 14.5 s undefined` line needs HOLD_MS >= 15000 and is not part of this check.

## 5. Re-tap (#493 R145-9)

Not walked on prod: the WHERE tap and picker are not walkable headless on live data (#489).  Covered by the unit tests
`conestruct/site/lib/scenarios/cross-street-apply.test.ts` (shipped in 8c1f69d's chain).

## Not committed

27 walk crops and the two #493 images are in `validation-artifacts-extra/retap-and-cap/` in the main checkout (untracked).  Committed here:
`walk/walk.json`, `walk/extra.json`, `walk/1440x900-q3-sharp.png`, `map-493/needs-you-map-both.png`, `map-493/map-493b-body.json`,
`map-493/needs-you-map-493b.png`.

Processes: every browser was closed by its script; no dev server was started; 0 node processes left after the runs.

Token scan of every output from this check (this folder, the extras folder, the scratchpad, the walk's task output; 54 files, re-run after § 2b on 61 files): **0**
hits of the gate token value, **0** of the render secret value, **0** log lines naming the gate header.
