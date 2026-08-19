# s2-arc5 live checks — production at `5a06f25`, 2026-08-19

Runners: `s2a5-live-payload.py` (payload series via the public proxy,
raw log `outS2A5-live/s2a5-payload-raw.md`) and `s2a5-live-browser.js`
(browser series, raw log `outS2A5-live/s2a5-browser-raw.md`).
Read-only throughout.

Runner defect disclosed (fixed; the logged corrected run is P2r): the
first P2 assumed feature records carry raw `lat`/`lng` fields — they
carry `along_station_ft`/`lateral_offset_ft` and coordinate-bearing
labels instead, so the first run matched zero features and failed on
its own shape assumption.  The corrected method projects the
coordinate-labeled features onto the SAME served chain (the s2-arc3
consistency method); label coords are 4dp-rounded, so ±~35 ft is
inherent and the tolerance is 60 ft (disclosed in the log line).

## Gate

healthz `5a06f25…` == `git rev-parse origin/main` == served bundle
(`/_next/static/chunks/720-ce232617a7a0047b.js`).  Passed first probe.

## Results — 10 checks: 9 PASS (gate included), 1 FAIL (newly-measured pre-existing, below)

| # | check | evidence | result |
|---|---|---|---|
| gate | healthz == origin/main == served bundle | logs | PASS |
| P1 | **the served E Bayaud chain is fixed**: 68 pts, crosses S Colorado east to lon −104.92112, worst adjacent reversal 44°, station-frame coverage **5,514 ft > the 3,110 ft corridor** (pre-fix: 26 pts, 20 ft, 179° hairpin) | `p1-bayaud-road-bearing.json` | PASS |
| P2r | features east of the crossing classified in the road frame (5 beyond station 500 ft) + drawn-vs-classified agreement on 10 coordinate-labeled features: worst Δstation **14.3 ft**, worst Δlateral **17.9 ft** (inside the 4dp label-rounding envelope) | `p2-bayaud-detect-road.json` + log | PASS |
| P3a | Northglenn no-flip vs the committed s2-arc3 r2 captures: **28 matched, 0 flips, 0 drift** | `p3-northglenn-{chord,road}.json` | PASS |
| P3b | Lakewood no-flip vs the committed s2-arc4 capture: **15 matched, 0 flips, 0 drift** | `p3-lakewood-road.json` | PASS |
| P4 | the honest gap survives at S Colorado (the Ellsworth name change): coverage 995 ft < corridor, worst reversal 4° | `p4-colorado-road-bearing.json` | PASS |
| B1a | **#186 pending-pick**: no Centerline row while the Which-road card is up | browser log | PASS |
| B1b | picked E Bayaud: Centerline row reads **"OSM, full corridor"** | browser log | PASS |
| B2 | partial coverage disclosed on the served page: **"covers 0–995 ft, bearing beyond"** at the S Colorado pin; the screenshot shows the advance-warning ribbon dimming past the boundary | `b2-colorado-partial.png` + log | PASS |
| AX1 | axe, picker state | `axe-picker-state.json` | **FAIL — newly measured, pre-existing (below)** |

## The money shot

`b1-bayaud-fixed.png` vs the arc evidence's pre-fix baseline
(`../screenshots/postpick-ray-recentered.png`): the same pin, the same
pick — pre-fix the ribbons ran straight at 85.3° a block north of the
road across the residential grid; now they ride E Bayaud Ave itself
through the S Colorado crossing.  Corridor total 3,462 ft, coverage
full.

## The axe FAIL — newly measured, pre-existing

`label (critical)` on the road-properties panel's speed and lanes
`NumericFieldEditor` inputs (`input[min="5"]`, `input[step="1"]`) —
their visible `RoadFieldRow` labels are not programmatically
associated.  NOT this arc's surface: the diff touches neither input
(verifier-confirmed scope), and the node surfaced only because this
arc's axe is the first to run with the modal open on a picked road
(prior runs axed the page states).  Same missing-label family as the
a11y pile's lat/lng critical — left FAILING, flagged for the pile
(disposition Ryan's; the pile is deferred by his standing ruling).
The known `.opacity-80` node did not appear in this state (it lives on
the post-generate page surface, not the open modal).

## Verdict

The arc's live obligations close: gate green first probe; the E Bayaud
chain serves fixed (bridge across the divided crossing, no hairpin,
full-corridor coverage) and the drawing + classification demonstrably
share it (P2r sub-15-ft agreement, on the road east of the crossing);
the held behavior at clean pins provably did not move (28+15 matched
features, zero flips); the disclosure renders live in both its states
("OSM, full corridor" / "covers 0–995 ft, bearing beyond" with the
visible dimming) and stays honestly absent while a pick is pending.
One newly-measured pre-existing critical flagged to the a11y pile.
Refs #210, #211.
