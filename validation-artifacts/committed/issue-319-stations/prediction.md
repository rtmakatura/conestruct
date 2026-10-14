# Rule 5 prediction: `issue-319-stations` (#319)

Written 2026-10-14, off main `20230f1`, before any change. Authority: #319 (its Proposed solution
and Acceptance), Rule 3, R145.

## R145 self-ruled (the shape)

#319 proposes `stations_text` built from the placements, with the pilot car "from the scenario
params the generator received". `build_audit_trail` receives `ScenarioParams`, which doesn't carry
the pilot car (it's a generator kwarg, `src/api/schemas.py:1474-1476`), and the pilot car isn't a
roadside placement (`src/generation/layout.py:1969-1973`). So:

- `build_audit_trail` gains a `pilot_car: bool = False` keyword, relayed from the scenario by the
  audit endpoint (`render_api._audit_build`), the relay-fact pattern: the raw fact in, the text
  out of the backend.
- Two fields, so the row keeps today's two bold spans exactly: `stations_text` ("2 flagger
  station(s)" or "2 AFAD", counted from `FLAGGER_STATION` placements and `AFAD_*`-labelled
  `TEMPORARY_SIGNAL` placements; both kinds present joins them with " + ") and `pilot_car_text`
  ("1 vehicle", only when the pilot car is in the plan).

## Deliberate changes

1. **Backend** (`src/api/audit.py`, the flagger branch beside `sight_distance_result_text`):
   `stations_text`, and `pilot_car_text` when the pilot car is on. Additive; no existing field
   changes value.
2. **Frontend** (`AuditTrail.tsx`, `flaggerSightDistanceItem`): renders "Stations:
   **{stations_text}**" and " · Pilot car: **{pilot_car_text}**" as received. Deleted:
   `flaggerStations`, `afadDevices`, `pilotCarVehicles`, `flaggerSummary`, and the row's reads of
   `scenario.afad` / `scenario.pilotCar`. Absent field or not generated: "—" (Rule 10, `wireResult`).

## Predicted outcome

- **On screen, same plans, before vs. after:** identical text. Flagger: "Stations: 2 flagger
  station(s)"; AFAD: "Stations: 2 AFAD"; pilot car: "… · Pilot car: 1 vehicle".
- **Snapshots:** the 28 flagger snapshots change by added keys only: all 28 gain
  `sections.flagger.stations_text`; `flagger_grid_pilot_car.json` and
  `flagger_grid_all_toggles.json` also gain `pilot_car_text`. `flagger_grid_afad.json` and
  `flagger_grid_all_toggles.json` read "2 AFAD"; the other 26 read "2 flagger station(s)".
  Every other snapshot, and the archived `_pre_` files, unchanged.
- **The PDF:** unchanged (the new keys join `tests/test_audit_pdf.py`'s panel-only set, as #286's
  did).
- **Tests:** a backend test per case (flagger, AFAD, pilot car, both, not-a-flagger); a frontend
  sentinel where `stations_text` disagrees with the form's toggle and the payload wins.
