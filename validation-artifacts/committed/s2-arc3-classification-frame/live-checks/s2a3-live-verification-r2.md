# s2-arc3 live checks, round 2 — production at `0420ca2`, 2026-08-18

Round 1 found the proxy blocking the relay; the fix
(`issue-207-proxy-relay`, shipped in `0420ca2`) made the served
classification frame reachable. Round 2 measures it. Runners:
`s2a3-consistency-r2.py` (payload series, raw log
`outS2A3/r2-payload-raw.md`) and `s2a3-browser-r2.js` (browser series,
raw log `outS2A3/r2-browser-raw.md`). Read-only throughout.

Runner defects disclosed (fixed in the scripts; the logged runs are the
complete ones): the first complete payload run matched features by
first-4-dp-hit (ambiguous in dense urban data — phantom few-ft deltas)
and expected literal set equality through the response's 5-record
evidence cap; the browser runner's response wait was 30 s against a
detect that legitimately runs ~40 s (Overpass + Modal cold start).

One declared expectation correction (not a silent re-baseline): the
plan's straight-control bound — "zones identical, stations within
±0.2 ft" — assumed a geometrically straight control. S Wadsworth Blvd
carries real gentle curvature (measured A/B station delta up to
14.0 ft across matched features). The S-series therefore verifies the
claim the control actually supports: **served == local per frame** for
identical inputs (the ±0.2 ft bound now applied where it belongs,
served-vs-local), with the A/B delta reported as the road's measured
curvature.

## Gate

healthz `0420ca2…` == `git rev-parse origin/main` == served-bundle sha
(`/_next/static/chunks/720-23f440739b5033dc.js`). Passed first probe.

## Results — 11 checks: 10 PASS (gate included), 1 FAIL (the known pre-existing node)

| # | check | evidence | result |
|---|---|---|---|
| gate | healthz == origin/main == served bundle | browser log | PASS |
| D2' | the 166-vertex fixture relay serves (round 1: 413) | `r2-d2-with-centerline.json` | PASS |
| D3' | inverted from round 1: the bent sub-1 KB centerline CHANGES the classification | `r2-d3-bent-small.json` vs round 1 | PASS |
| C1 | **curved-pin consistency**: served station/zone == the local road frame for every matched feature — 6 features on Lookout Mountain Rd (way 1432422179, 262-vertex geometry), max Δ **0.04 ft**, zero zone mismatches | `r2-c1-curved-detect.json` + log | PASS |
| C2 | the chord frame materially disagrees on that curve — up to **454 ft** station error on the same features (non-vacuity) | log | PASS |
| S1 | straight control: served == local per frame, 6 uniquely-matched shared features, max served-vs-local Δ **0.049 ft**, zero zone mismatches; A/B curvature delta up to 14.0 ft (the road's, declared) | `r2-s-straight-*.json` + log | PASS |
| S2 | set-membership on uncapped buckets (Northglenn / Washington Way): every feature-set difference between the chord and road responses is a predicted bbox-membership difference — chord-only 2, road-only 0, unexplained 0. (Lakewood's populated buckets all sit at the 5-record evidence cap — counts 11–25 — so membership is structurally not evaluable there; recorded.) | `r2-s2-northglenn-*.json` + log | PASS |
| B1' | the browser's detect body carries the confirmed road's 59-vertex centerline | log | PASS |
| B2' | the relay-bearing browser detect succeeds end-to-end (round 1: 413) | log | PASS |
| B3' | the corridor-scan result surfaces — "Corridor scan: 3 flag(s) auto-checked" | `02-r2-post-detect-state.png` | PASS |
| AX1' | axe, post-detect state | `axe-r2-post-detect.json` | **FAIL — the known node (below)** |

## The C-series in one line

A real OSM feature cluster mid-mountain-road: the served corridor
classification now agrees with the drawing's frame to hundredths of a
foot, where the chord frame — measured live on the same features —
would misplace them by up to 454 ft and misfile every mid-bend one.
That is #207's acceptance criterion, measured on production.

## The axe FAIL — the known node

`color-contrast (serious)` on `.opacity-80` — the recorded
faint-register family, byte-identical to the s2-arc1/s2-arc2/round-1
records. Zero diff hits for `opacity-80` in either arc branch; left
FAILING rather than exempted — disposition Ryan's, already pile-bound.
Nothing new on any touched surface.

## Notes for the record

- The road-bearing candidate for the Lookout cluster reports way
  `1432422179` (the reference pin note says `17070828` — OSM has since
  split/renumbered the way; same road, verified by name and geometry).
- The Lookout corridor at the ORIGINAL fixture anchor carries no
  in-corridor features (round 1's honest gap); the C-series anchored at
  the road's real feature cluster ~3,100 ft upstream instead, so the
  consistency claim is measured on real relevant features (2 relevant
  sidewalks + 4 classified-irrelevant records, all matched).

## Verdict

Round 2 closes the arc's live obligations: gate green first probe, the
relay serves end-to-end from the browser (413 dead), the silent strip
is measurably gone (D3' inverted), drawn-vs-classified agreement holds
on production to 0.04 ft on a real curve with the chord's 454 ft error
beside it, the compat chord path still serves byte-consistently with
the local frame, and every verifiable set difference is exactly the
bbox change the model predicts. One known pre-existing axe node on
record. Refs #207.
