# Arc 1 — live-backend proof of the refusal bypass (and its closure)

Captured 2026-07-30 against the deployed Modal backend.

```
GET https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz
{"status":"ok","sha":"1513fbc89d9e80597810f3fbf5fd3d77293d5504"}
```

Backend at `1513fbc` — includes the #86 lane-eligible gate (`3cc4ae6`,
its ancestor), the #158 direction gate, and the #120 lane-confidence
gate at `_placements_for` (render_api.py:406-412).

All requests: `POST /render/audit`, `content-type: application/json`,
`authorization: Bearer <MODAL_RENDER_SECRET>` (redacted). Scenario JSON
posted bare (the Next proxy unwraps `{scenario}` before forwarding).

## Request 1 — the #181 bypass payload (detect on shoulder, switch to flagger; pre-fix `carryMeta` output, relays wiped)

```json
{"kind":"flagger_lane_closure","meta":{"project":"","address":"E Colfax Ave & Race St, Denver","lat":39.73997,"lng":-104.96632},"roadType":"rural_undivided","speed":45,"laneWidth":12,"workType":"utility_cut","duration":"long","workLen":400,"night":false,"pilotCar":false,"afad":false,"pedestrianAccess":false}
```

**Response: HTTP 200** — a full TA-10 plan generates:

```
{"summary":{"ta":"TA-10","cdot_sheet":"S-630-1","case_id":"MUTCD TA-10: Flagger one-lane two-way","taper_length_ft":100,"taper_label":"one-lane two-way taper","buffer_space_ft":360,"device_spacing_taper_ft":20,"device_spacing_tangent_ft":90,"step_count":16},...}
```

## Request 2 — the control payload (flagger-first, same pin, relays intact)

```json
{"kind":"flagger_lane_closure","meta":{"project":"","address":"E Colfax Ave & Race St, Denver","lat":39.73997,"lng":-104.96632},"roadType":"urban_arterial","speed":35,"laneWidth":12,"workType":"utility_cut","duration":"long","workLen":400,"night":false,"pilotCar":false,"afad":false,"pedestrianAccess":false,"detectedLanesTotal":5,"detectedLanesForward":2,"detectedLanesBackward":2,"detectedLanesBothWays":1}
```

**Response: HTTP 400** — the #86 gate refuses:

```
{"detail":"This road appears to carry more lanes than a flagger operation covers — TA-10 applies where one through lane runs in each direction. If detection is wrong, confirm 'Road has one through lane in each direction' in the form and regenerate."}
```

## Request 3 — the POST-FIX kind-switch payload (carryAcrossKinds + relay re-derivation; speed carried at 35)

```json
{"kind":"flagger_lane_closure","meta":{"project":"","address":"E Colfax Ave & Race St, Denver","lat":39.73997,"lng":-104.96632},"roadType":"urban_arterial","speed":35,"laneWidth":12,"workType":"utility_cut","duration":"long","workLen":400,"night":false,"pilotCar":false,"afad":false,"pedestrianAccess":false,"detectedLanesTotal":5,"detectedLanesForward":2,"detectedLanesBackward":2,"detectedLanesBothWays":1}
```

**Response: HTTP 400** — same refusal. The switch order no longer matters:
detect-then-switch now produces the same relay set as flagger-first, and
the backend refuses both identically.

## Reading

Same road, same pin: request 1 (relays wiped by the kind switch) returns
200 and a plan; requests 2 and 3 (relays present) return the honest 400.
The #86/#136/#158 gates were order-dependent before this arc — refusable
facts erased in flight — and are order-independent after it.
