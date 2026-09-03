# s2a15 live check — LOCAL
UTC: 2026-09-03T14:49:08.671Z
BASE: http://127.0.0.1:8765
git rev-parse HEAD: fd45ba3bc9da43a8f88176c609612c9e283e7793 — local mode: the served build is this working tree (uvicorn), not a deploy.
local healthz (HTTP 200): {"status":"ok","sha":"unknown"}

**PASS** — A1 plain audit carries sections.site_scan = not_run / not_requested — HTTP 200, 1282 ms
**PASS** — A2 not_run claims nothing (no buckets, no flags)
**PASS** — B1 scanned audit → status ok — HTTP 200, status=ok, 18372 ms, duration_ms=2606
**PASS** — B2 mode corridor, measured_at present — 2026-09-03T14:49:10+00:00
**PASS** — B3 inputs echo the plan's own params (ruling 3) — {"lat":39.7113,"lng":-105.0815,"bearing_deg":180,"speed_mph":45,"work_zone_ft":1000,"closure_type":"shoulder","road_type":"urban_high","lane_width_ft":12,"shoulder_width_ft":10,"centerline_vertices":0,"bbox":[39.70263801621456,-105.08266907628115,39.71267056612742,-105.08033092371886]}
**PASS** — B4 flags == detected buckets mapped — {"adjacent_intersection":true,"pedestrian_facility":true,"bicycle_facility":true}
**PASS** — B5 site_adjustments fires one record per applied flag — adjacent_intersection, pedestrian_facility, bicycle_facility
**PASS** — B6 no disclosure on an ok scan
**PASS** — C1 manual detect-site (same corridor inputs) answered in corridor mode — HTTP 200, 2494 ms
**PASS** — C2 parity: manual-then-generate site_adjustments == auto-scan site_adjustments — manual flags {"adjacent_intersection":true,"pedestrian_facility":true,"bicycle_facility":true} vs scan flags {"adjacent_intersection":true,"pedestrian_facility":true,"bicycle_facility":true}
**PASS** — C3 parity: device rows equal — 41 vs 41 devices
**PASS** — D1 second scanned audit is a memo hit with the same measured_at — 2026-09-03T14:49:10+00:00, 1213 ms
**PASS** — E1 no bearing → not_run / no_bearing (no point-mode fallback)
**PASS** — E2 no coords → not_run / no_coords
INFO — F forced failure not run — Overpass cannot be downed on demand against a real backend; the honest-400 shape (error site_scan_unavailable + provenance + recovery pointer) and proceed-anyway are proven in tests/test_site_scan_ingenerate.py
SIZE — plain audit 5256 B; scanned audit 11500 B; growth 6244 B
TIMING — plain audit 1282 ms; first scanned audit 18372 ms; second (memo) 1213 ms; manual detect-site 2494 ms

RESULT: ALL PASS 14/14 (+1 INFO)
