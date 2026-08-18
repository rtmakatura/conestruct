# s2-arc2 live checks — raw log

- `2026-08-18T04:57:42.254Z` healthz sha: c76dc9ce2293ebf03caced34851fff211748890d
- `2026-08-18T04:57:42.256Z` expected (git rev-parse origin/main): c76dc9ce2293ebf03caced34851fff211748890d
- `2026-08-18T04:57:57.362Z` served bundle sha: c76dc9ce2293ebf03caced34851fff211748890d
- `2026-08-18T04:57:57.362Z` **PASS** — gate. healthz == origin/main == served bundle (c76dc9c)
- `2026-08-18T04:57:57.878Z` **PASS** — P1. shoulder near-signal + mismatch refuses (HTTP 400 — A signalized intersection is about 88 ft from this location, and the map data's lane counts for this road contradict eac…)
- `2026-08-18T04:57:58.494Z` **PASS** — P2. flagger near-signal + mismatch refuses (HTTP 400 — A signalized intersection is about 88 ft from this location, and the map data's lane counts for this road contradict eac…)
- `2026-08-18T04:57:59.152Z` **PASS** — P3. mismatch without the signal fact still renders (HTTP 200)
- `2026-08-18T04:58:00.177Z` **PASS** — P4. signal fact with clean relays renders (HTTP 200)
- `2026-08-18T04:58:00.527Z` **PASS** — P5. boundary 30.00 m refuses (inclusive) (HTTP 400 — A signalized intersection is about 98 ft from this location, and the map data's lane counts for this road contradict eac…)
- `2026-08-18T04:58:01.521Z` **PASS** — P6. boundary 30.01 m passes (HTTP 200)
- `2026-08-18T04:58:21.712Z` Bayaud candidate picked (shoulder)
- `2026-08-18T04:58:22.697Z` picker saved (shoulder @ Bayaud)
- `2026-08-18T04:58:22.700Z` **PASS** — S1. shoulder refusal surfaces on the real pin (mirror pointer)
- `2026-08-18T04:58:22.702Z` **PASS** — S2. banner is the shortened mirror pointer, not the raw 400 (#180)
- `2026-08-18T04:58:23.349Z` **FAIL** — AX1. axe zero violations — page in the refusal state (1 finding(s) — axe-shoulder-refusal.json)
- `2026-08-18T04:58:23.402Z` **PASS** — S3. lane edit lifts the refusal (plan regenerates, no 400 text)
- `2026-08-18T04:58:42.207Z` Bayaud candidate picked (flagger)
- `2026-08-18T04:58:43.071Z` picker saved (flagger @ Bayaud)
- `2026-08-18T04:58:43.073Z` **PASS** — F1. flagger refusal surfaces on the real pin (mirror pointer)
- `2026-08-18T04:58:43.077Z` **PASS** — F2. the new confirm row is armed in the Road section
- `2026-08-18T04:58:43.695Z` **FAIL** — AX2. axe zero violations — armed confirm-row state (1 finding(s) — axe-flagger-armed-row.json)
- `2026-08-18T04:58:43.761Z` **PASS** — F3. tick lifts the refusal; the row stays, checked, describing the override
- `2026-08-18T04:58:44.515Z` **PASS** — N1. served NI narrative carries the rightmost-lane note (predicate single-sourced)

Failures: 2
