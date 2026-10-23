# #373 production check: 2/2 PASS

Shipped `001dcd1` (healthz `001dcd1c648c714cae2b2577e4a48e9bdff4a493`, recorded in `results.json`). `check.py` ran 2026-10-23T17:17:06Z through www.conestruct.com's `/api/render/*` proxy. It replayed the audit lane's own requests (`audit-lane/runs/<id>/request.json`) with a fresh scan token, which stayed in memory and isn't in `results.json` (#371). Raw output: `results.json`.

## F12: flagger, `pilotCar: true` (the #373 acceptance), PASS
Each surface lists exactly one `Pilot car with G20-4 "PILOT CAR/FOLLOW ME" sign`:

| Surface | What production returned |
|---|---|
| Page 1 summary | one row, qty 1; TOTAL DEVICES 53 (#370's run had 52 before the fix, `audit-lane/runs/F12/audit.json` breakdown `total_devices`) |
| Device XLSX | one row: pay item "—", EACH, 1, note cites S-630-1 Sheet 26; Total device count 53 = page 1 |
| Quote XLSX | one row: qty 1, EACH, daily "—", extended "—", note "No daily rate on file. NOT included in the quote total; price separately." |
| Quote breakdown JSON | one line with `"unpriced": true` |
| Device breakdown | `{"device": …, "code": "—", "function": "Traffic control", "qty": 1}`; `total_devices` 53 |
| Audit (`include_breakdown`) | the same breakdown row; flagger `pilot_car_text` "1 vehicle" |
| Crew sheet | one bullet, "1× Pilot car with G20-4 … mounted on the rear of the vehicle (S-630-1 Sheet 26 …)", character-for-character equal to the pre-fix line `audit-lane/runs/F12/crew.md:27` |

## F1: flagger, no pilot car (control), PASS
No pilot-car row on any surface (page 1, device XLSX, quote XLSX, quote breakdown, device breakdown, audit breakdown, crew sheet); no `pilot_car_text`. Page 1 total 38 = XLSX 38 = breakdown 38.
