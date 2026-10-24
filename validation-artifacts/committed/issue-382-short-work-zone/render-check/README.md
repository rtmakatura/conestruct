# #382 R1 step 2: render check at 50 ft

`../render_check.py` runs each body through the real render API (TestClient, worktree code with the limit dropped). It saves the audit JSON, plan PDF, crew PDF, device breakdown and XLSX per case. `drawing.png` is the plan's drawing page: page 2 in production, page 1 here because no MAPBOX_TOKEN means no aerial page. Run 2026-10-24.

| Case | Body | Speed | Old taper limit | Routes |
|---|---|---|---|---|
| flagger-50 | audit-lane F17 | 25 | 100 ft (one-lane, two-way) | all 200 |
| near-int-45-50 | audit-lane N12 | 45 | 540 ft (L) | all 200 |
| near-int-55-50 | audit-lane N14 | 55 | 660 ft (L) | all 200 |
| shoulder-divided-55-50 | tests SHOULDER_BODY | 55 | 183 ft (L/3) | all 200 |
| shoulder-undivided-50 | tests UNDIVIDED_SHOULDER_BODY | 55 | 147 ft (L/3) | all 200 |

The audit-shoulder run requests predate the current pin schema (a 400 `pin_model_input`), so the shoulder cases use the test suite's bodies.

## Findings: clean on every kind
- **Drawing (page 2):** every drawing puts the taper, then the buffer, then the 50 ft work zone, in that order, with nothing overlapping. Each dimension line reads `WORK ZONE = 50 ft` beside the taper and buffer labels, legible though close together. The downstream taper and the sign markers sit downstream of the work zone. Nothing is clipped or drawn past the frame. On N14 at 1" = 72 ft the bike-lane signs crowd the short work zone but don't overlap.
- **Device list:** in every case the breakdown's total equals the drawing's TOTAL DEVICES (36 / 40 / 36 / 26 / 19), and no quantity is zero or negative. The work-zone cones scale down with the zone: N12 has 3 cones at 25 ft over 50 ft, plus 3 buffer cones.
- **Crew sheet:** stations run in order (work zone 0–50 ft, buffer up to the taper, taper upstream of that). The only negative stations are the downstream ones (END ROAD WORK at −150 ft, the downstream taper from −50 ft, R2-11 at −250 ft), as at any length. No "nan", "None" or 0 ft values appear.
- **Audit:** `geometry_validation.all_pass` is true, and the only violation is the `WORK_ZONE_SHORT_VS_BUFFER` warning.

Observation, not a break: G20-1 reads "ROAD CONSTRUCTION (NEXT 50 FT)", the work-zone length, as it reads "NEXT 100 FT" for any 100 ft zone today.
