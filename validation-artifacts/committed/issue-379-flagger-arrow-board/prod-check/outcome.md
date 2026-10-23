# #379 production check: 7/7 PASS

Checked 2026-10-23T05:20:03Z against www.conestruct.com, healthz sha `951e67b70d32bb189e3e472c986dfd35ca9b9e6e` (the ship of `951e67b`). Script: `check.py`; answers: `results.json` (no scan token is written).

The script replays the #370 audit lane's own requests (`audit-lane/runs/<id>/request.json`). For each row it sends the audit with `include_breakdown` and a scan token, then the five downloads carrying that token.

| Row | Plan | Result |
|---|---|---|
| F1, F2, F6 | Denver flagger, local | PASS |
| F3, F4, F18 | Denver flagger, collector | PASS |
| N1 | Denver near-intersection, arterial (control) | PASS |

What PASS means on a flagger row (all six):
- **Page 1:** the device summary reads `Arrow Board (caution mode only) 1`.
- **Device XLSX and quote:** one row named `Arrow Board (caution mode only)`, with a note that cites "MUTCD 11th Ed. §6L.06 ¶18, p. 833".
- **Crew sheet:** the equipment list has `1× Arrow Board (caution mode only)`, setup has the caution-mode paragraph with the cite, and takedown removes the board. The sheet never says "ARROW mode" or "chevron mode", and the crew PDF says "caution mode only".
- **Audit:** the breakdown row is `Arrow Board (caution mode only)`, and the Denver rule carries `mode_note` with the cite.

The N1 control:
- The audit's Denver rule reads `device_label` "Arrow board" with no `mode_note` (`raised` false: the layout places the board). No surface says "caution mode only", and the crew sheet has no caution paragraph.
- Limit: N1's XLSX and quote rows didn't match the script's "Arrow" filter on the name column (the placed board is named from the catalog), so on those two surfaces the control shows only that "caution mode only" is absent. Byte-identity for N1 was shown before the ship (`../churn.json`, near-intersection Denver identical).
