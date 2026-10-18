# #341 production check of 47940d6 — PASS 2/2

Run 2026-10-17 against https://www.conestruct.com/api/render/audit and /api/render/pdf (the site proxy, gate header from `.env.local`, never printed). Backend healthz: `47940d6cd411e45317edc2e3a6e8b1df6359e001` (`healthz.txt`); the deploy script reported FRONTEND CURRENT (served `ecc2306`, no site change, build skipped).

Each request is the shoulder audit's own committed request, posted unchanged: `validation-artifacts/committed/audit-shoulder/runs/<row>/request.json`. Script: `prodcheck341.py`; raw output: `replay.txt`.

| Row | Lanes drawn / road | Before (`runs/<row>/plan-text.txt`) | Now, audit item and page 1 | Result |
|---|---|---|---|---|
| `i25-r-65-night-3lanes` (the issue's repro) | 3 / 4 | `... THE ROAD HAS 4. PLANS DRAW AT MOST 4 LANES PER DIRECTION, SO ...` | `DRAWN AS 3 LANES PER DIRECTION (ENTERED); THE ROAD HAS 4. DEVICE OFFSETS ARE MEASURED AGAINST 3 LANES.` | ✓ limit not named |
| `alameda-r-35` (control) | 4 / 5 | today's sentence | `DRAWN AS 4 LANES PER DIRECTION; THE ROAD HAS 5. PLANS DRAW AT MOST 4 LANES PER DIRECTION, SO THE DEVICE OFFSETS ARE MEASURED AGAINST 4 LANES.` | ✓ unchanged |

The audit's pending item reads the same sentence in sentence case on both rows (`replay.txt`).
