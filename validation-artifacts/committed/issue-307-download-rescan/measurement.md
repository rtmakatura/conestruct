# #307 measured first (option (c)): does a download reuse the Generate's scan?

Run: prod `4c52c49` (`probes/out/followups-run1.healthz.json`), 2026-10-15 05:20Z, through the gate. Read-only. Probe: `probes/measure307.py`. Output: `probes/out/followups-run1.jsonl`.

## What it does

For 5 Denver pins (the bodies `scan-refusal-rate/probes/measure_refusals.py` builds, scan on), the probe sends one `POST /api/render/audit` (the Generate). After it answers, it sends four follow-up audits at +0, +30, +90 and +150 s. The pins run in parallel.

Every download route (`/render/pdf`, `/xlsx`, `/markdown`, `/crew-pdf`, `/quote`) builds its plan through the same `_placements_for` → `run_site_scan` as the audit, on the same Modal app (`src/api/render_api.py`). So a follow-up audit makes the same scan a download makes, and its answer shows the scan's provenance. `memo_hit: true` means it reused the Generate's scan; `false` means it scanned again.

## Result

| pin | Generate | +0 s | +30 s | +90 s | +150 s |
|---|---|---|---|---|---|
| broadway-sb | scan 4.7 s | rescan | rescan | rescan | memo |
| broadway-demo | scan 9.0 s | rescan | memo | rescan | rescan |
| e-colfax | scan 8.9 s | rescan | rescan | memo | rescan |
| e-bayaud | scan 8.9 s | rescan | rescan | rescan | memo |
| colorado-blvd | scan 7.1 s | memo | rescan | memo | rescan |

- **15 of 20 follow-ups scanned again.** That includes 4 of the 5 sent the moment Generate answered, inside the 120 s memo TTL. The requests land on different containers (`max_containers=8`), and the memo is per container.
- **The five hits are scattered.** Two came after the TTL: a hit is any container that has scanned the corridor in the last 120 s, which includes an earlier follow-up's own rescan.
- **All 25 answered 200 tonight,** every scan by `overpass.openstreetmap.fr`, the rescans in 2.9–5.7 s. On a slow-mirror hour each rescan is its own chance to refuse. #292 measured 2 of 30 refusals across three windows.

## What it means for the fix

- **(b), a memo shared across containers (`modal.Dict`),** would turn most of these misses into hits. It still expires at 120 s, so a download made later in the session rescans. The issue's acceptance ("a download within the session renders from the same scan answer as the plan on screen") needs more than that.
- **(a), downloads carry the Generate's scan answer,** meets the acceptance at any delay, on any container. The backend can make it trustworthy by signing the scan result it returns with the audit and verifying the signature when a download sends it back. A client can't forge a scan, and the provenance stays the backend's. It costs one new wire field and a change to every download sender.
