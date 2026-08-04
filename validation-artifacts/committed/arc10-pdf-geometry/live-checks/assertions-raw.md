- `2026-08-04T01:24:45.547Z` healthz sha: 4fee6b88cce4b51c5588f20a665014e66cf32ed5
- `2026-08-04T01:24:45.549Z` expected (git rev-parse origin/main): 4fee6b88cce4b51c5588f20a665014e66cf32ed5
- `2026-08-04T01:24:47.393Z` served bundle sha: 4fee6b88cce4b51c5588f20a665014e66cf32ed5
- `2026-08-04T01:24:47.393Z` **PASS** — gate. healthz == origin/main == served bundle (4fee6b88cce4b51c5588f20a665014e66cf32ed5)

## Context A — Lookout Mountain Rd (curved), shoulder

- `2026-08-04T01:24:47.937Z` kind: shoulder work
- `2026-08-04T01:24:47.984Z` location description typed: "Lookout Mountain Road, Golden, CO"
- `2026-08-04T01:24:51.350Z` candidate picked: "Lookout Mountain Road southbound (tertiary, 172°)0 m from pin · way 17070828"
- `2026-08-04T01:24:51.351Z` **PASS** — 1a. detection resolves Lookout Mountain Road at the fixture pin (Lookout Mountain Road southbound (tertiary, 172°)0 m from pin · way 17070828)
- `2026-08-04T01:24:55.105Z` screenshot: 01-picker-corridor-lookout.png (preview ribbon on the curve)
- `2026-08-04T01:24:56.077Z` **PASS** — 1b. picker saved at the Lookout pin
- `2026-08-04T01:25:12.469Z` **PASS** — 1c. strip settles without refusal/invalid-input (VERIFIED · 1 validation warning ▸REVIEW WARNINGS)
- `2026-08-04T01:25:12.541Z` generated — output cards on screen
- `2026-08-04T01:25:15.671Z` downloaded: served-lookout-shoulder.pdf (768642 B)
- `2026-08-04T01:25:15.672Z` **PASS** — 1d. plan-sheet PDF downloaded through the page's own control

## Context B — off-road pin, manual bearing (compat control)

- `2026-08-04T01:25:21.462Z` **PASS** — 2a. detection finds no road at the lake pin (zero candidates)
- `2026-08-04T01:25:21.475Z` bearing typed manually: 90
- `2026-08-04T01:25:22.404Z` **PASS** — 2b. zero-candidate picker still saves
- `2026-08-04T01:25:23.134Z` **PASS** — 2c. strip settles without refusal/invalid-input (VERIFIED · 1 validation warning ▸REVIEW WARNINGS)
- `2026-08-04T01:25:27.545Z` downloaded: served-offroad-shoulder.pdf (853726 B)
- `2026-08-04T01:25:27.545Z` **PASS** — 2d. compat PDF downloaded (no confirmed road, no error)
