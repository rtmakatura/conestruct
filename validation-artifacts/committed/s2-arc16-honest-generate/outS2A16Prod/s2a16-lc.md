# s2a16 live check — PRODUCTION
UTC: 2026-09-03T18:03:27.239Z
BASE: https://www.conestruct.com
healthz (HTTP 200): {"status":"ok","sha":"9046f1c30274d6153e449454195c259e8a575927"}
git rev-parse origin/main: 9046f1c30274d6153e449454195c259e8a575927
**PASS** — GATE — healthz sha == origin/main — 9046f1c30274d6153e449454195c259e8a575927 vs 9046f1c30274d6153e449454195c259e8a575927

**PASS** — A1 plain audit carries sections.site_scan = not_run / not_requested — HTTP 200, 8172 ms
**PASS** — B1 scanned audit answers honestly: ok, or the coded refusal — HTTP 200, 4854 ms, status=ok, error=—
**PASS** — B2 the Lakewood control detects flags — {"adjacent_intersection":true,"pedestrian_facility":true,"bicycle_facility":true}
**PASS** — C1 proceed-anyway audit always completes (200) — HTTP 200, 7471 ms, status=ok
INFO — C2 the scan succeeded, so proceed_if_unavailable was inert (proceeded_anyway false, disclosure null) — a live proceed-anyway capture needs a live failure — proceeded_anyway=false disclosure=null
**PASS** — D1 proceed-anyway audit PDF renders — HTTP 200, 7418 B, 7960 ms
INFO — D2 the PDF's own scan succeeded (scanned Site Adjustments rows present; a refused scan is never memoised, so leg C's refusal did not carry over) — no disclosure expected; the block is pinned at test level (tests/test_audit_blocks_site_scan.py) and captured live in outS2A16Local — 5479 chars extracted
**PASS** — E1 pre-generate: the manual detect button is gone
**PASS** — E2 pre-generate: the provenance sentence is the section's only scan copy
**PASS** — E3 pinned at Lakewood: the strip settles pre-generate — 11975 ms — VERIFIED · 0 validation warningsREADY FOR TCS REVIEW
**PASS** — E4 every pre-generate request is scan-free — 6 requests
**PASS** — E5 the Generate click sends site_scan {proceed_if_unavailable:false} on audit + breakdown — /api/render/device-breakdown:{"proceed_if_unavailable":false} /api/render/audit:{"proceed_if_unavailable":false}
**PASS** — E6 the strip settles after Generate — never a permanent VERIFYING — 24974 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
**PASS** — E7 the wait names the scan — seen on: strip, ribbon
F cycle 1: settled in 21033 ms — PLAN DECLINED · the site scan could not complete — retry it,
**PASS** — F1 refused: the strip says PLAN DECLINED · SERVICE UNAVAILABLE — PLAN DECLINED · the site scan could not complete — retry it, or generate without the site check, from the notice in the 
**PASS** — F2 the backend message renders exactly once, in the container — Site scan unavailable — the plan can't verify school zones, sidewalks, or signal
**PASS** — F3 the generic breakdown-failed ribbon does not also render
**PASS** — F4 Retry and the consequence-stating proceed-anyway are both offered
F retry: settled in 24649 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
INFO — F5–F8 the retry succeeded, so the proceed-anyway flow had no live refusal to act on — proven at test level (GeneratorShell.scan-refusal / scan-disclosure)
**PASS** — G axe post: 0 violation(s) ≤ baseline 2 — none
**PASS** — G axe refused: 0 violation(s) ≤ baseline 2 — none
SIZE — plain audit 5256 B; scanned audit 11500 B (HTTP 200); growth 6244 B

RESULT: ALL PASS 19/19 (+3 INFO)
