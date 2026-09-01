# s2-arc12 live checks (local)

- `2026-09-01T15:57:58.500Z` — L1: real detection at the E Bayaud pin (the #213 triage coordinate) —
- `2026-09-01T15:58:13.912Z` **PASS** — L1 candidates render (completed scan)
- `2026-09-01T15:58:13.912Z` **PASS** — L1 no absence claim beside candidates
- `2026-09-01T15:58:13.912Z` **PASS** — L1 no unavailable copy on a completed scan
- `2026-09-01T15:58:14.270Z` screenshot: l1-bayaud-candidates.png
- `2026-09-01T15:58:14.270Z` — L2: completed empty scan at the lake pin —
- `2026-09-01T15:58:35.397Z` **FAIL** — L2 absence copy renders (a measurement)
- `2026-09-01T15:58:35.397Z` **FAIL** — L2 never the unavailable copy
- `2026-09-01T15:58:35.890Z` screenshot: l2-lake-absence.png
- `2026-09-01T15:58:35.890Z` — L3: unavailable wire shape through the served modal bundle —
- `2026-09-01T15:58:37.313Z` **PASS** — L3 unavailable copy renders
- `2026-09-01T15:58:37.313Z` **PASS** — L3 the absence claim does NOT
- `2026-09-01T15:58:37.313Z` **PASS** — L3 panel names the failure
- `2026-09-01T15:58:37.370Z` **PASS** — L3 no Rural verdict claimed in the modal
- `2026-09-01T15:58:37.373Z` **PASS** — L3 ↻ Re-detect roads stands
- `2026-09-01T15:58:37.659Z` screenshot: l3-unavailable.png
- `2026-09-01T15:58:37.659Z` — L4: retry recovers to real detection —
- `2026-09-01T15:58:46.796Z` **PASS** — L4 real candidates after retry
- `2026-09-01T15:58:46.796Z` **PASS** — L4 unavailable copy cleared
- `2026-09-01T15:58:47.153Z` screenshot: l4-recovered.png
- `2026-09-01T15:58:47.154Z` 2 FAILURE(S)

## L2 re-run (Ryan's disposition, 2026-09-01)

- `2026-09-01T16:02:53.512Z` — L2 re-run, attempt 1: lake pin, real Overpass —
- `2026-09-01T16:03:07.367Z` **PASS** — L2 (attempt 1) absence copy renders (a measurement)
- `2026-09-01T16:03:07.367Z` **PASS** — L2 (attempt 1) never the unavailable copy
- `2026-09-01T16:03:07.910Z` screenshot: l2-rerun-attempt1-absence.png
- `2026-09-01T16:03:07.910Z` L2 RE-RUN PASS
