# #449 local walk (2026-11-08)

`next dev` on the issue-449 worktree (port 3449) and the replay backend (`ux-group3-where/evidence/script/serve_replay.py`, port 8449, Overpass replayed from a scratchpad copy of `ux-group3-where/evidence/overpass-fixture/`), started by `script/launch.ps1`, which reads the main checkout's `.env.local` into the process environment and sets a walk-only `GATE_BYPASS_TOKEN`. The gate header went through `scripts/gate.cjs` `newGatedContext` (the site's own origin only). `/api/road-bearing` stubbed from the fixture. Pin 1600 E Colfax Ave, Denver (the recorded Colfax pin; its bike lane is Franklin St, crossing the end of the work, as at #449's 1550 E Colfax). Shoulder, one-way, Generate. NEEDS YOU stepped with the first answer until the bike lane question. Chromium, DPR 1, one viewport per run: 1440x900, then 390x844. Script: `script/walk.mjs`. Both servers were killed by process tree afterwards; 0 processes left.

| | before (`0cd02e8` + test only) | after |
|---|---|---|
| Bike lane heading, 1440 and 390 | "Is there a bike lane along the work zone?" | "Is there a bike lane at or near the work zone?" |
| Next line on the sidewalk question | "Next: a bike lane along the work zone" | "Next: a bike lane at or near the work zone" |
| Sidewalk question | "Are there sidewalks along the work zone?" | unchanged |
| axe on `.needs-you` (bike question open) | 0, 0 | 0, 0 |
| Targets under 44 px in `.needs-you` | 0, 0 | 0, 0 |
| Horizontal overflow | 0, 0 | 0, 0 |

`after/<width>-bike-question.png`: the bike lane question card, sticky bars set static for the crop only. The map shows the lane running up Franklin St across the end of the work; the heading no longer says "along". The explanation ("The map shows a bike lane 58.1 ft from the work, so we added 2 devices for people on bikes."), the answers and "The 2 devices stay / come off the plan." are as before. Before crops were taken with the sticky header over the heading and aren't kept; the before text is in `before/walk-<width>.json`.
