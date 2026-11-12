# #525 local walk: the map window at Colfax and Pennsylvania

Walked 2026-11-11 on `issue-525-one-road-entry` (uncommitted work on `e331b15`), on the local site with group 8's helpers (`../../ux-group8-map-window/walk-script/`: `launch-site.cjs`, `overpass-preload.cjs`, `stub_backend.py`), at 1440x900, 1198x930 and 390x844 (DPR 1, Chromium via Playwright). Inter loaded at every size. The script is `walk-script/walk525.mjs`. The pin was entered as 39.7401, -104.9811 in the window's coordinate boxes.

- Overpass for `/api/road-bearing` was recorded once (2 live asks), then replayed (8 replays). The stub backend answered `/render/road-travel`. Logs and fixtures are in `validation-artifacts-extra/ux-group7b-guesses-hours/issue-525/walk-run/` in the main checkout (untracked).
- **Before:** `route.ts` and `LocationPickerModal.tsx` were swapped back to base `e331b15` while the dev server ran. **After:** the fixed files were restored.
- Gate token from `conestruct/site/.env.local`, read raw and never printed. The dev server and the stub backend were stopped by process tree after the walk (ports 3000 and 8000 free, no node/python/chrome left on `issue-525`).

## Readings (walk JSON: `crops/before-walk.json`, `crops/after-walk.json`)

Gate round 2: the two JSONs were rewritten ASCII-only, with "·" written as the JSON escape `00b7`, from the same recorded readings. The bytes were already valid UTF-8, but a reader using a Windows code page showed "Â·". `walk525.mjs` now writes them that way. Round 2's code changes nothing visible at this pin (plan.md § Round 2), so the walk was not re-run.

| Size | Before (rows) | After (rows) | axe (window) | 44 px |
|---|---|---|---|---|
| 1440x900 | Pennsylvania Street · Traffic both ways · 2 m / East Colfax Avenue · Traffic both ways · 5 m / **Pennsylvania Street · Traffic both ways · 22 m** | Pennsylvania Street · Traffic both ways · 2 m from your pin · at East Colfax Avenue / East Colfax Avenue · Traffic both ways · 5 m from your pin · at Pennsylvania Street | 0 before, 0 after | 2 under: Latitude/Longitude 385x43 (D3, pre-existing); Mapbox marks excepted (#505) |
| 1198x930 | same three rows | same two rows | 0, 0 | 2 under: Latitude/Longitude 284x43 (D3); Mapbox marks excepted |
| 390x844 | same three rows | same two rows; the line wraps to two lines (it wraps at 1440 and 1198 too: "at East Colfax / Avenue", "at Pennsylvania / Street") | 0, 0 | 0 under; Mapbox logo excepted |

D3 is group 8's recorded pre-existing finding (the coordinate boxes are 43 px tall at desk widths; `.tap-44` applies at phone width only, R138). Not changed here.

Crops (committed): `crops/before-{1440,1198,390}-colfax-pennsylvania.png`, `crops/after-{1440,1198,390}-colfax-pennsylvania.png`.

## Strings

One new string pattern: " · at <cross street>", appended to the row's second line. Source: Ryan's ruling (cc-prompt-ux-group7b-guesses-hours.md item 2: 'the line under it adds "at <cross street>"'). The cross street is OSM's `name` (or `ref`). No other copy changed. Unslop: plain words, no new terms.
