# issue-301-road-properties on prod `cf13836` (2026-10-10)

`../road-properties-d56c876/capture_rp.cjs`, run with `AUDIT_SITE=https://www.conestruct.com/sandbox`:
North Cherry Street, Hilltop, Denver (39.71740, -104.93380). It is a residential way with no
`maxspeed` tag, so its class estimates 25 mph. At 1440 and 390.

- **Picker** (`modal-<w>.png`): no road-properties panel. It shows the "Which road?" card ("✓ Road
  detected · 1 match", North Cherry Street), "↻ Re-detect roads", then the corridor panel.
- **WHAT Speed before the click** (`speed-<w>.png`):
  - the speed is 65 (the shoulder kind's default);
  - the line under it reads "⚠ no posted speed on this road · its class suggests 25 mph", with
    "Use 25 mph".
- **After the click** (`speed-used-<w>.png`): the speed is 25, the line is gone, and the row reads
  "your change · the road-class estimate (highway=residential); the road has no posted speed".
- **Checks** (`facts-<w>.json`): axe clean, no sideways scroll, no page errors.
- **Audit** (`audit_est.py`, against prod `/api/render/audit`):
  - a plan carrying `speed_estimate {highwayClass: residential}` at 25 mph answers 200 with
    `input_estimates` = `[{field: speed, value: 25, source: road_class, evidence: "OSM
    highway=residential; the road carries no posted speed", operator_confirmed: true}]`;
  - the same record at 35 mph answers 400 `guess_stale`.

Ryan's browser check passed the same day ("it works, but Step 2 looks bad"). R126 supersedes the
Use N mph button: the estimate is prefilled as a guess.
