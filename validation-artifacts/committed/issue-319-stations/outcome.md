# Rule 5 outcome: `issue-319-stations` (#319)

Prediction: `prediction.md` (committed `b055822`, before any change).

## The wire

Snapshots regenerated through the tests that read them; a key-by-key diff against the saved
copies:

| Predicted | Outcome |
|---|---|
| 28 flagger snapshots change by added keys only | ✓ 28 changed, 0 removed or changed values; 62 unchanged (every non-flagger snapshot and the `_pre_` archives) |
| All 28 gain `sections.flagger.stations_text` | ✓ |
| `flagger_grid_pilot_car`, `flagger_grid_all_toggles` also gain `pilot_car_text` ("1 vehicle") | ✓ exactly those two |
| `flagger_grid_afad`, `flagger_grid_all_toggles` read "2 AFAD"; the other 26 "2 flagger station(s)" | ✓ 25 + the reduction snapshot read "2 flagger station(s)"; the two AFAD files "2 AFAD" |
| The PDF unchanged | ✓ `tests/test_audit_pdf.py` passes with the two keys in its panel-only set |

**On screen:** the row renders "Stations: **{stations_text}**" and " · Pilot car:
**{pilot_car_text}**". The strings on the wire are the ones the panel used to write ("2 flagger" +
" station(s)", "2 AFAD", "1 vehicle"), so the text is identical for the same plans. The browser
check is on production after the ship: a Vercel Preview runs on the production backend, which
doesn't send the fields before it.

## Tests

- `tests/test_flagger_stations.py` (7): flagger, AFAD, pilot car, both, a sentinel that drops one
  placed flagger station and reads "1 flagger station(s)" (a count from the AFAD switch would
  still say two), not on other kinds, and the endpoint relaying `pilotCar`.
- `AuditTrail.test.tsx` (+2): a payload whose line disagrees with the form's switches renders the
  payload's ("3 AFAD", "1 vehicle"); an absent field, or a plan not yet generated, renders "—".
- Python suite: 2780 passed, 2 skipped. Site suite: 2162 passed.
