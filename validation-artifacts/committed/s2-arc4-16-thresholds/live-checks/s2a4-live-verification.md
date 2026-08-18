# s2-arc4 live checks — production at `3f021a9`, 2026-08-18

Runners: `s2a4-payload-checks.py` (payload series via the public proxy,
raw log `outS2A4/s2a4-payload-raw.md`) and `s2a4-browser.js` (browser
series, raw log `outS2A4/s2a4-browser-raw.md`).  Read-only throughout.

Runner defects disclosed (fixed in the scripts; the logged runs are the
complete ones): the first payload run (1) applied the details-format
regex to bracket-less placeholder strings (road_curvature's "not
implemented" sentence) and failed P2 on them, and (2) sent
`workType: "utility_cut"` to the shoulder audit/narrative routes — the
proxy's honest 400 answered with the validator's own enum
(`utility_locate`/`survey`/…), corrected.

## Gate

healthz `3f021a9…` == `git rev-parse origin/main` == served-bundle sha
(`/_next/static/chunks/720-248436c07ff20f46.js`).  Passed first probe.

## Results — 8 checks: 7 PASS (gate included), 1 FAIL (the known pre-existing node)

| # | check | evidence | result |
|---|---|---|---|
| gate | healthz == origin/main == served bundle | browser log | PASS |
| P1 | **the no-flip sameness check**: zero threshold values changed, so every feature present in BOTH the committed s2-arc3 r2 Northglenn responses and today's (matched by label, chord and road frames) must keep zone + relevant — **28 matched features, 0 flips, 0 OSM-drift-only** | `p1-northglenn-{chord,road}.json` + log | PASS |
| P2 | the served lateral-details format: 6 lateral-zone lines all read `[lateral N ft off centerline]`, zero pre-fix `[lateral @` forms, 9 other-zone lines keep `[zone @ N ft]` (Lakewood/Wadsworth) | `p2-lakewood-road.json` + log | PASS |
| P3 | served audit strings page-cited: both rules verbatim (`MUTCD §6N.12 p. 848 — Work within the Traveled Way at an Intersection (11th Ed.)`, `MUTCD §6N.16 p. 851 — Interchanges (11th Ed.)`), both derived chips, both pending labels with page cites, `Ch. 6H` nowhere in the response | `p3-audit-served.json` | PASS |
| P4 | served crew narrative (Site-Specific Notes) carries both page-cited rules; `Ch. 6H` absent | `p4-narrative-served.md` | PASS |
| B1 | **#186 absent case** on the real sandbox: before any detect, no `N found` / `nearest ~` text exists | browser log | PASS |
| B2 | **the margin, rendered**: after a real Lakewood detect, the auto-checked rows carry `10 found, nearest ~10.4 m` / `17 found, nearest ~14.2 m` / `24 found, nearest ~21.7 m` plus 6 visible backend detail lines — including 2 in the new lateral format (`[lateral 96 ft off centerline]`) | `01-post-detect-margin.png` + log | PASS |
| AX1 | axe, post-detect state | `axe-post-detect.json` | **FAIL — the known node (below)** |

Scope note (declared): the GO named Northglenn for the margin lines;
the browser margin check runs at the Lakewood control pin instead
(the picker flow proven across arcs 12–16, and its buckets carry
relevant lateral-zone features — the display's hardest case).
Northglenn is covered payload-level by P1, whose bucket JSON is the
exact source the rows render from (`count`/`nearest_distance_m`/
`details` verbatim, asserted mounted in the arc's rendered-row tests).

## The margin in one line

A row that yesterday said only "Pedestrian sidewalks present ✓" now
says `17 found, nearest ~14.2 m` and shows the path 96 ft off the
road's centerline as exactly that — measured on production, every
number a backend value relayed verbatim.

## The axe FAIL — the known node

`color-contrast (serious)` on `.opacity-80` — the recorded
faint-register family, byte-identical to the s2-arc1/s2-arc2/s2-arc3
records.  The arc's new evidence lines render via the existing
`check-desc` class and are not the flagged node.  Left FAILING rather
than exempted — disposition Ryan's, already pile-bound.  Nothing new
on any touched surface.

## Verdict

The arc's live obligations close: gate green first probe; the
attribution strings serve page-cited by real subject on both rendered
surfaces with the Ch. 6H rider gone; the held thresholds provably did
not move (28/28 matched features unchanged across the two-day gap,
drift zero); and the margin is rendered on production under the
auto-checked rows, absent-case honest, lateral case included.  One
known pre-existing axe node on record.  Refs #16.
