# s2-arc5 — #210 (the stitch) + #211 (the disclosure), evidence

Arc branch `issue-210-centerline-chain`, commits:
`8ec0b8e` (extraction, Refs #210) → `d27299b` (the fix, Refs #210) →
`d4fbfbf` (the disclosure set, Refs #211).  Base `118b3e5`.

## The six-site table (raw pools in `pools/`, replay `s2a5-sites.py` — deterministic given the pools)

Corridor 3,110 ft; "current" = the pre-fix endpoint-identity stitch,
replay-verified vertex-for-vertex against production's served geometry.

| site | pin | current stitch | new stitch | class |
|---|---|---|---|---|
| E Bayaud @ S Colorado | 39.71466, −104.94071 | **20 ft** coverage, 1 hairpin (179°) | **6,164 ft**, 0 hairpins, one 29 m bridge (way 1175151991) | divided crossing + couplet — **fixed** |
| pin on the Bayaud couplet half | 39.71468, −104.94380 | 1,406 ft, **2 hairpins** | 1,729 ft, 0 hairpins | couplet — **fixed** |
| S Colorado Blvd (on the divided arterial) | 39.7135, −104.94055 | 995 ft, clean | unchanged | name changes to "North Colorado Boulevard" at the Ellsworth divide (verified by probe) — honest gap, #211 renders it |
| E 6th Ave @ Colorado | 39.7259, −104.9415 | 197 ft, clean | unchanged | name changes to "E 6th Avenue Parkway" — honest gap |
| E Cedar @ Colorado (corrected pin 39.71307, −104.94080) | — | gap eastward | unchanged | nearest same-name endpoint **197 m** away — genuine discontinuity, correctly refused (> STITCH_GAP_MAX_M) |
| Lookout Mountain Rd (clean control) | 39.74231, −105.23925 | 683 pts, clean | **byte-identical, zero bridges** | none — zero churn |

## Pre-code chain-sameness check (GO ruling 6; `s2a5-sameness.py`, `s2a5-ts-sameness.test.ts`, `ts-sameness-run.txt`)

The REAL TypeScript stitcher (commit `d27299b`'s code) replayed against
the recorded pools and compared vertex-for-vertex with production's
served geometry (`pools/served-*.json`):

- Northglenn (Washington Way, way 16971963, 24 pts): **IDENTICAL**
- Lakewood (S Wadsworth Blvd, way 132831821, 59 pts): **IDENTICAL**
- E Colfax (way 600545936, 191 pts): **IDENTICAL**
- Lookout: **IDENTICAL** (683-pt chain, zero bridges)
- E Bayaud: **differs deliberately** — the 29 m Colorado-crossing bridge
  (the arc's purpose; `pools/bayaud-rb1.json` records the pre-fix served
  response, also embedded in the committed fixture
  `tests/fixtures/centerline/bayaud_colorado_pool.json` as
  `pre_fix_served_geometry`)

Observation (pre-existing, out of scope): one Colfax probe served a
17-pt own-way-only chain — the best-effort extension query transiently
failed at serve time; two immediate re-probes served the full 191 pts.
Serve-time extension variance predates this arc.

## Red runs

- `red-run-stitch-frontend.txt` — the commit-B tests against the
  pre-fix algorithm (shimmed under the new API): **6 failed / 3 passed**
  (no bridge, hairpin present, output equal to pre-fix, guard inert,
  couplet return half consumed).
- `red-run-211-frontend.txt` — the #211 tests against pre-C code:
  **6 failed / 2 passed**.
- `red-run-211-python.txt` — the split/overlay tests against pre-C
  backend: **6 failed / 20 passed** (the 20 are the file's pre-existing
  tests).

## Screenshots (production at `118b3e5`, pre-fix)

- `screenshots/postpick-ray-recentered.png` — the money-shot baseline:
  the zone ribbons at E Bayaud running straight at 85.3° a block north
  of the road across the residential grid.
- `screenshots/prepick-chord.png` — the awaiting-pick state.
- Post-fix live captures land in `live-checks/` after the ship.

## Thresholds (all CHOSEN, GO ruling 3; docstrings at the definitions in `lib/road-detection/stitch.ts`)

`STITCH_GAP_MAX_M = 60` · `STITCH_HEADING_TOL_DEG = 60` ·
`STITCH_REVERSAL_DEG = 150` · extended-footage opacity 0.35 vs 0.9 ·
PDF extension overlay 1 px / 0.4 (display-only).

## Declared churn (Rule 5)

- Clean pins: **byte-identical** (measured above — Lookout, Northglenn,
  Lakewood, Colfax).
- Gap/couplet pins: chains change deliberately (E Bayaud 26 → 68 pts
  trimmed; drawings follow the road; detection buckets there change —
  live checks capture before/after).
- New visible UI: the Centerline row in the modal extent panel (all
  states incl. "OSM, full corridor" on clean pins — deliberate
  provenance symmetry with the PDF row); extended footage dims to 0.35;
  resolving/awaiting-pick states draw NO corridor (previously a
  bearing-0 chord that described nothing).
- PDF aerial: byte-identical without a centerline or at full coverage
  (asserted); splits into two overlays only at partial coverage.
- Suites: backend 1907 passed / 2 skipped (+6 new); frontend 700
  (+9 stitch, +8 disclosure); zero regressions.
- Wire: none — same `geometry` array; worst-case relayed geometry ~8 KB
  vs the 32 KB proxy cap.

## Premise correction recorded (#175 discipline)

#211's "sidebar preview never joined the centerline" acceptance line
was refuted during this arc's investigation: `GeneratorSidebar` renders
zone-length text rows only (no geometry is drawn;
`buildCorridorPolyline` is used purely as a backend-length summer).
Dropped by GO ruling 1; the scope note now lives as a comment at the
use site.
