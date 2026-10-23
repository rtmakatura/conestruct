# #372 production check: 15/15 PASS

- **When / what:** 2026-10-23T15:48:38Z, www.conestruct.com, healthz `fa93c0ee690175e8b2b101aaa947e8b3fe6fe03d` (the #372 ship).
- **How:** `check.py` replays the #370 audit-lane requests (`audit-lane/runs/<id>/request.json`) through the `/api/render/*` proxy. For each row it calls the audit (for a scan token, kept in memory and never written, #371), then the plan PDF and the device XLSX. PASS means page 1's summary quantities, in order, and its TOTAL DEVICES equal the XLSX Device List quantities and "Total device count".
- **Result** (`results.json`):

| Row | Page 1 total | XLSX total | Before the fix (page 1) |
|---|---|---|---|
| N1 | 43 | 43 | 37 |
| N2 | 44 | 44 | 38 |
| N3 | 51 | 51 | 45 |
| N4 | 42 | 42 | 36 |
| N5 | 43 | 43 | 37 |
| N6 | 49 | 49 | 46 |
| N7 | 51 | 51 | 45 |
| N8 | 51 | 51 | 45 |
| N9 | 50 | 50 | 44 |
| N10 | 54 | 54 | 48 |
| N11 | 43 | 43 | 37 |
| N12 | 44 | 44 | 38 |
| N13 | 46 | 46 | 40 |
| N14 | 45 | 45 | 42 |
| F1 (flagger control) | 38 | 38 | not run (F1 isn't in `base.json`) |

The "before" column is the base-tree run in `../base.json`. The production totals equal the offline fix run (`../fix.json`) on all 14 near-intersection rows.
