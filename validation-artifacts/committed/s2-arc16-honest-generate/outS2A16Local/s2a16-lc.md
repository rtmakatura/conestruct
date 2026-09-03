# s2a16 live check — LOCAL
UTC: 2026-09-03T17:22:06.964Z
BASE: http://localhost:3000
healthz (HTTP 200): {"status":"ok","sha":"unknown"}
git rev-parse HEAD: 24f79ffb4a5cf59966d6a021749593aac9e36c50 — local mode: the served build is this working tree (next dev + uvicorn at http://127.0.0.1:8765/healthz), not a deploy.

**PASS** — A1 plain audit carries sections.site_scan = not_run / not_requested — HTTP 200, 22001 ms
**PASS** — B1 scanned audit answers honestly: ok, or the coded refusal — HTTP 400, 20693 ms, status=unavailable, error=scan budget exceeded (20 s)
INFO — B2 wire refusal observed (the designed 400) — {"detail":{"error":"site_scan_unavailable","message":"Site scan unavailable — the plan can't verify school zones, sidewalks, or signals right now. Retry, or generate anyway and the plan will carry a NOT-CHECKED disclosur…
**PASS** — B3 refusal carries message + recovery pointer
**PASS** — C1 proceed-anyway audit always completes (200) — HTTP 200, 41380 ms, status=unavailable
**PASS** — C2 proceeded: the disclosure string is exact on the wire — SITE CONDITIONS NOT CHECKED — service unavailable at generation.
**PASS** — D1 proceed-anyway audit PDF renders — HTTP 200, 6574 B, 40919 ms
**PASS** — D2 the audit PDF carries the NOT-CHECKED disclosure
**PASS** — E1 pre-generate: the manual detect button is gone
**PASS** — E2 pre-generate: the provenance sentence is the section's only scan copy
**PASS** — E3 pinned at Lakewood: the strip settles pre-generate — 22271 ms — VERIFIED · 0 validation warningsREADY FOR TCS REVIEW
**PASS** — E4 every pre-generate request is scan-free — 8 requests
**PASS** — E5 the Generate click sends site_scan {proceed_if_unavailable:false} on audit + breakdown — /api/render/device-breakdown:{"proceed_if_unavailable":false} /api/render/audit:{"proceed_if_unavailable":false}
**PASS** — E6 the strip settles after Generate — never a permanent VERIFYING — 22074 ms — PLAN DECLINED · the site scan could not complete — retry it, or genera
**PASS** — E7 the wait names the scan — seen on: strip, ribbon
**PASS** — F1 refused: the strip says PLAN DECLINED · SERVICE UNAVAILABLE — PLAN DECLINED · the site scan could not complete — retry it, or generate without the site check, from the notice in the 
**PASS** — F2 the backend message renders exactly once, in the container — Site scan unavailable — the plan can't verify school zones, sidewalks, or signal
**PASS** — F3 the generic breakdown-failed ribbon does not also render
**PASS** — F4 Retry and the consequence-stating proceed-anyway are both offered
F retry: settled in 20900 ms — PLAN DECLINED · the site scan could not complete — retry it,
**PASS** — F5 proceed sends the acknowledgement on both fetches — [{"proceed_if_unavailable":true},{"proceed_if_unavailable":true}]
**PASS** — F6 the proceeded plan renders; the container clears — 41527 ms — VERIFIED · 0 validation warningsREADY FOR TCS REVIEW
**PASS** — F7 the Setup panel prints the disclosure verbatim — Site conditions⚠SITE CONDITIONS NOT CHECKED — service unavailable at generation.site scan · scan budget exceeded (20 s) 
**PASS** — F8 section 03 shows ▲ NOT CHECKED with the disclosure — disclosure occurrences: 2
**PASS** — G axe post: 1 violation(s) ≤ baseline 2 — color-contrast
**PASS** — G axe refused: 1 violation(s) ≤ baseline 2 — color-contrast
**PASS** — G axe proceeded: 0 violation(s) ≤ baseline 2 — none
SIZE — plain audit 5324 B; scanned audit 905 B (HTTP 400); growth -4419 B

RESULT: ALL PASS 25/25 (+1 INFO)
