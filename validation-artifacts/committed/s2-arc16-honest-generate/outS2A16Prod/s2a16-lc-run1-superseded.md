# s2a16 live check — PRODUCTION
UTC: 2026-09-03T18:00:28.276Z
BASE: https://www.conestruct.com
healthz (HTTP 200): {"status":"ok","sha":"9046f1c30274d6153e449454195c259e8a575927"}
git rev-parse origin/main: 9046f1c30274d6153e449454195c259e8a575927
**PASS** — GATE — healthz sha == origin/main — 9046f1c30274d6153e449454195c259e8a575927 vs 9046f1c30274d6153e449454195c259e8a575927

**PASS** — A1 plain audit carries sections.site_scan = not_run / not_requested — HTTP 200, 22576 ms
**PASS** — B1 scanned audit answers honestly: ok, or the coded refusal — HTTP 200, 7256 ms, status=ok, error=—
**PASS** — B2 the Lakewood control detects flags — {"adjacent_intersection":true,"pedestrian_facility":true,"bicycle_facility":true}
**PASS** — C1 proceed-anyway audit always completes (200) — HTTP 200, 22635 ms, status=unavailable
**PASS** — C2 proceeded: the disclosure string is exact on the wire — SITE CONDITIONS NOT CHECKED — service unavailable at generation.
**PASS** — D1 proceed-anyway audit PDF renders — HTTP 200, 7418 B, 8551 ms
**FAIL** — D2 the audit PDF carries the NOT-CHECKED disclosure
**PASS** — E1 pre-generate: the manual detect button is gone
**PASS** — E2 pre-generate: the provenance sentence is the section's only scan copy
**PASS** — E3 pinned at Lakewood: the strip settles pre-generate — 13820 ms — VERIFIED · 0 validation warningsREADY FOR TCS REVIEW
**PASS** — E4 every pre-generate request is scan-free — 6 requests
**PASS** — E5 the Generate click sends site_scan {proceed_if_unavailable:false} on audit + breakdown — /api/render/device-breakdown:{"proceed_if_unavailable":false} /api/render/audit:{"proceed_if_unavailable":false}
**PASS** — E6 the strip settles after Generate — never a permanent VERIFYING — 8087 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
**PASS** — E7 the wait names the scan — seen on: strip, ribbon
F cycle 1: settled in 4699 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
F cycle 2: settled in 2048 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
F cycle 3: settled in 1583 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
INFO — F refusal not observed in 4 Generate cycle(s) on this run — the refusal container, proceed-anyway and the three disclosures are proven at test level (GeneratorShell.scan-refusal, scan-disclosure, SetupStrip.disclosure, TieredReference.site-scan, test_audit_blocks_site_scan); never faked here
**PASS** — G axe post: 0 violation(s) ≤ baseline 2 — none
SIZE — plain audit 5324 B; scanned audit 11500 B (HTTP 200); growth 6176 B

RESULT: FAILURES 15/16 (+1 INFO)
