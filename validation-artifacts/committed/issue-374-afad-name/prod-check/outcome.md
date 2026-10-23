# #374 production check: 2/2 PASS

Shipped `5249455` (healthz `5249455cd12826de57f52b43d35a64ed49d09816`, recorded in `results.json`). `check.py` ran 2026-10-23T20:02:07Z through www.conestruct.com's `/api/render/*` proxy. It replayed the audit lane's own requests (`audit-lane/runs/<id>/request.json`) with a fresh scan token. The token stayed in memory and isn't in `results.json` (#371). Raw output: `results.json`.

## F16: flagger, `afad: true` (the #374 acceptance), PASS
Every surface names the device "Automated Flagger Assistance Device (AFAD)", two of them. None carries "Portable traffic signal", "Temporary Traffic Signal" or "Temporary Signal" (#370's run had all three: `audit-lane/runs/F16/`).

| Surface | What production returned |
|---|---|
| Page 1 summary | one row, qty 2 |
| Page 1 legend | one row, the name in full |
| Device XLSX | one TEMPORARY_SIGNAL row: the name, pay item 630-86810, EACH, 2 |
| Quote XLSX | one row: the name, 2, EACH, $200/day, extended $400 |
| Quote breakdown JSON | one line: the name, 2, EACH, $200/day, $400 |
| Device breakdown | `{"device": …, "code": "—", "function": "Traffic control", "qty": 2}` |
| Audit (`include_breakdown`) | the same breakdown row; flagger `stations_text` "2 AFAD" |
| Crew sheet | one bullet, "- 2× Automated Flagger Assistance Device (AFAD)" (was "- 2× Temporary Traffic Signal", `audit-lane/runs/F16/crew.md:24`) |

## F1: flagger, no AFAD (control), PASS
No AFAD name and no temporary-signal row on any surface (page 1 summary and legend, device XLSX, quote XLSX, quote breakdown, device breakdown, audit breakdown, crew sheet), and none of the old names.
