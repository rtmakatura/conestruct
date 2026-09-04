# s2a17 live check — LOCAL
UTC: 2026-09-04T00:01:29.106Z
BASE: http://localhost:3000
healthz (HTTP 200): {"status":"ok","sha":"unknown"}
git rev-parse HEAD: ef7a95d313c1850b225078219f3bdb6d15153d68 — local mode: the served build is this working tree (next dev + uvicorn at http://127.0.0.1:8765/healthz), not a deploy.

**PASS** — A1 scanned audit answers honestly: ok, or the coded refusal — HTTP 200, 1307 ms, status=ok
**PASS** — A2 every rule-bearing bucket is on the wire — intersections, interchanges, sidewalks, bike_facilities, schools
**PASS** — A3 each detected bucket's nearest_distance_ft equals its metre value / 0.3048 to 0.1 ft — intersections: 10.4 m → 34.1 ft, sidewalks: 14.2 m → 46.6 ft, bike_facilities: 21.7 m → 71.2 ft
A detected: bike_facilities,intersections,sidewalks; flags {"adjacent_intersection":true,"pedestrian_facility":true,"bicycle_facility":true}
**PASS** — B1 scanned audit PDF renders — HTTP 200, 9116 B, 14034 ms
**PASS** — B2 the audit PDF's Site Conditions table names the five rule-bearing conditions — all five
INFO — B3 the PDF's own scan detected a different set than leg A's (another container) — cover/classifier parity is pinned at test level (test_tier_ledger PDF-cover test on the scanned fixtures) — pdf 4 vs A 3; cover "2 changes · 1 needs attention · 12 checked · 1 pending · reference"
**PASS** — C1 proceed-anyway plan sheet + narrative render (200) — sheet HTTP 200 43197 ms · md HTTP 200 20779 ms
**PASS** — C2 the proceeded plan's sheet AND narrative carry the NOT-CHECKED sentence (their scan failed) — sheet true, md true
**PASS** — D1 the retired /api/render/detect-site proxy route is gone — HTTP 404
**PASS** — E1 pre-generate: the Setup step is the slim control — "Site conditions you assert"
**PASS** — E2 pre-generate: exactly the two manual-only checkboxes; none of the five scanned labels is offered — checkboxes: Night operation+ retroreflective | Apply work-zone speed reductionLower lim | Limited sight distanceCurve, hill crest  | Driveways presentAdvisory: maintain acce
**PASS** — E3 pinned at Lakewood: the strip settles pre-generate — 20763 ms — VERIFIED · 0 validation warningsREADY FOR TCS REVIEW
**PASS** — E4 the Generate click sends site_scan on audit + breakdown — /api/render/device-breakdown:{"proceed_if_unavailable":false} /api/render/audit:{"proceed_if_unavailable":false}
**PASS** — E5 the strip settles after Generate — 22785 ms — PLAN DECLINED · the site scan could not complete — retry it, or genera
**PASS** — F1 refused: PLAN DECLINED on the strip (phase 2, unchanged)
F retry: settled in 20763 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
**PASS** — E6 (after retry) the on-screen ledger equals the classifier line over the served audit — 2 changes · 1 needs attention · 12 checked · 1 pending · reference
**PASS** — E7 (after retry) section 03 names every scanned condition per the served audit (detected: bike_facilities,intersections,sidewalks) — all rows present
INFO — F2–F4 the retry succeeded — the counted NOT-CHECKED item is proven at test level (TieredReference.scan-rows on the scanned-not-checked recording)
**PASS** — G axe post: 1 violation(s) ≤ baseline 2 — color-contrast
SIZE — scanned audit 11716 B (HTTP 200); scanned audit PDF 9116 B

RESULT: ALL PASS 17/17 (+2 INFO)
