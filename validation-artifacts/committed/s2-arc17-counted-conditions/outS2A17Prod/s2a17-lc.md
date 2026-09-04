# s2a17 live check — PRODUCTION
UTC: 2026-09-04T15:12:44.728Z
BASE: https://www.conestruct.com
healthz (HTTP 200): {"status":"ok","sha":"371ed5cf664497c3b6edfa0f4edc5d55678fb203"}
git rev-parse origin/main: 371ed5cf664497c3b6edfa0f4edc5d55678fb203
**PASS** — GATE — healthz sha == origin/main — 371ed5cf664497c3b6edfa0f4edc5d55678fb203 vs 371ed5cf664497c3b6edfa0f4edc5d55678fb203

**PASS** — A1 scanned audit answers honestly: ok, or the coded refusal — HTTP 200, 12238 ms, status=ok
**PASS** — A2 every rule-bearing bucket is on the wire — intersections, interchanges, sidewalks, bike_facilities, schools
**PASS** — A3 each detected bucket's nearest_distance_ft equals its metre value / 0.3048 to 0.1 ft — intersections: 10.4 m → 34.1 ft, sidewalks: 14.2 m → 46.6 ft, bike_facilities: 21.7 m → 71.2 ft
A detected: bike_facilities,intersections,sidewalks; flags {"adjacent_intersection":true,"pedestrian_facility":true,"bicycle_facility":true}
**PASS** — B1 scanned audit PDF renders — HTTP 200, 8945 B, 4096 ms
**PASS** — B2 the audit PDF's Site Conditions table names the five rule-bearing conditions — all five
**PASS** — B3 the audit-PDF cover line equals the classifier line over the served audit (screen == PDF == classifier) — cover "2 changes · 1 needs attention · 13 checked · 1 pending · reference" vs served "2 changes · 1 needs attention · 13 checked · 1 pending · reference"
**PASS** — C1 proceed-anyway plan sheet + narrative render (200) — sheet HTTP 200 8175 ms · md HTTP 200 493 ms
INFO — C2 both scans succeeded, so neither surface prints the disclosure — the positive is proven at test level (test_site_scan_disclosure_surfaces through the real routes)
**PASS** — C3 an ok scan prints no NOT-CHECKED anywhere (rule 10's negative)
**PASS** — D1 the retired /api/render/detect-site proxy route is gone — HTTP 404
**PASS** — E1 pre-generate: the Setup step is the slim control — "Site conditions you assert"
**PASS** — E2 pre-generate: exactly the two manual-only checkboxes; none of the five scanned labels is offered — checkboxes: Night operation+ retroreflective | Apply work-zone speed reductionLower lim | Limited sight distanceCurve, hill crest  | Driveways presentAdvisory: maintain acce
**PASS** — E3 pinned at Lakewood: the strip settles pre-generate — 12611 ms — VERIFIED · 0 validation warningsREADY FOR TCS REVIEW
**PASS** — E4 the Generate click sends site_scan on audit + breakdown — /api/render/device-breakdown:{"proceed_if_unavailable":false} /api/render/audit:{"proceed_if_unavailable":false}
**PASS** — E5 the strip settles after Generate — 5611 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
**PASS** — E6 the on-screen ledger equals the classifier line over the browser's own served audit — screen "2 changes · 1 needs attention · 13 checked · 1 pending · reference" vs classifier "2 changes · 1 needs attention · 13 checked · 1 pending · reference"
**PASS** — E7 section 03 names every scanned condition per the served audit (detected: bike_facilities,intersections,sidewalks) — all rows present
F cycle 1: settled in 25522 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
F cycle 2: settled in 9052 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
F cycle 3: settled in 2043 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
INFO — F refusal not observed in 4 Generate cycle(s) — the counted NOT-CHECKED item is proven at test level (TieredReference.scan-rows, test_tier_ledger on scanned-not-checked); never faked here
**PASS** — G axe post: 1 violation(s) ≤ baseline 2 — color-contrast
SIZE — scanned audit 11717 B (HTTP 200); scanned audit PDF 8945 B

RESULT: ALL PASS 18/18 (+2 INFO)
