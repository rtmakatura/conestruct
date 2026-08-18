# s2-arc2 corridor sweep — finding a real refusing pin (2026-08-18)

Goal: a production pin whose PRIMARY candidate carries a genuine OSM
lane-arithmetic mismatch within 30 m of a traffic signal — so the
browser flow measures the gate on real data, no synthetic relays.

## Pass 1 — Colfax signalized crossings (our detection API, read-only)

Six pins along E/W Colfax (incl. the reference pin). Every primary
candidate carries `lanes` but NO per-direction tags, so the mismatch
predicate cannot fire (sparse tags never gate, by design):

| pin | primary | lanes/f/b | signal_m | verdict |
|---|---|---|---|---|
| 39.74008,-104.97847 | East Colfax Avenue | 2/–/– | 24.94 | clean |
| 39.73997,-104.96632 | East Colfax Avenue | 2/–/– | 26.84 | clean |
| 39.74005,-104.95361 | Fillmore Street | 2/–/– | 0 | clean |
| 39.74007,-104.94123 | East Colfax Avenue | 3/–/– | 22.98 | clean |
| 39.7402,-104.9886 | West Colfax Avenue | 3/–/– | 32.69 | clean |
| 39.74005,-104.95995 | East Colfax Avenue | 2/–/– | 8.64 | clean |

Also probed N Federal Blvd at Colfax (the 2026-07-27 survey's 8/2/4
defect family): now `lanes=4`, no per-direction tags, no nearby signal
node — the survey-era tagging has churned.

## Pass 2 — Overpass scan for fully-tagged mismatched ways

One Overpass query (mirror: overpass.kumi.systems) over central Denver
(39.68,-105.05,39.78,-104.90), `highway ∈ {primary…trunk}` carrying all
three of `lanes`/`lanes:forward`/`lanes:backward`: **300 fully-tagged
ways, 2 mismatched** —

- **East Bayaud Avenue**, way `39508704` — `lanes=2, forward=2,
  backward=2` (2 ≠ 4)
- **North York Street**, way `277950725` — same shape

## Pass 3 — confirm through our own detection API

| pin | primary | lanes/f/b | oneway | signal_m | snap_m |
|---|---|---|---|---|---|
| 39.71466,-104.94071 | East Bayaud Avenue (way 39508704) | 2/2/2 | no | **13.75** | 0.05 |
| 39.75808,-104.95977 | North York Street (way 277950725) | 2/2/2 | no | **16.30** | 0.41 |

Both are REAL refusing shapes: genuine arithmetic mismatch, signal
within the 30 m threshold, two-way (so no earlier flagger gate
preempts), primary candidate at trivial snap distance. E Bayaud's
`turn:lanes:forward = left|through` / `turn:lanes:backward =
left|through` tags show exactly the turn-pocket double-counting the
gate exists for.

**Chosen pin: E Bayaud Ave, 39.71466,-104.94071** (used by S1–S3 /
F1–F3 in `s2a2-live-checks.js`).
