# #339 proof — a freeway plan counts no sidewalk from the site scan

Fix `6205411` (rulings.md S1), shipped 2026-10-17: SHIP VERIFIED, healthz = `62054116a70a83385e06737b3bcb43127ccb28fa`; frontend build skipped (no site change in `8bbdc42..6205411`).

## Tests
- `tests/test_site_scan_freeway_sidewalks.py`: 4 payload-level tests over the recorded Lakewood scan. Red on `770e101` (2 fail: the freeway test and the assert test), green on `6205411`.
- Suite: 3009 passed, 2 skipped (baseline 3005 passed, 2 skipped). mypy and `ruff check .` clean. diff-verifier: VERDICT: PASS.

## Production check (`prod-6205411/`)
`replay339.py` replays three audit-shoulder rows through production's `/api/render/audit` (with `include_breakdown`) and `/api/render/markdown`.

| Row | Result (run 4, `results.json`) |
|---|---|
| `i25-r-65-night-3lanes` (freeway) | PASS: scan ok; no `pedestrian_facility`; sidewalks not detected, with "43 sidewalk paths near the freeway not counted: …"; no R9-9 in the breakdown; no sidewalk site adjustment; the crew sheet says "No pedestrian or bicycle facility is flagged as affected by this closure." |
| `bway-r-30` (N Broadway, the issue's named control) | PASS: `pedestrian_facility` set, R9-9 placed, the crew sheet says "A pedestrian facility is affected by this closure." |
| `colfax-r-35` (urban_low control) | PASS: `pedestrian_facility` set, R9-9 placed, the crew sheet says "A pedestrian facility is affected by this closure." |

Runs 1 and 2 failed on the checker, not the plan; run 3 passed with Colfax as the only control. All three are kept (`results-run1.json` to `results-run3.json`) and the script's docstring records each correction. The crew sheet's "Pedestrian and Bicycle Accommodation" section stays on every Denver plan for the Denver TCP sheet requirement (`src/narrative/crew_narrative.py`), with or without a sidewalk; the I-25 section as served is in `i25-crew-ped-section.md`.

Run 4 adds N Broadway (`bway-r-30`), the control the issue names, beside E Colfax.
