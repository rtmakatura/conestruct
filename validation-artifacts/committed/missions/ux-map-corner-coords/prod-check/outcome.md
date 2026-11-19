# Mission ux-map-corner-coords (#539) production check: PASS (main 89d5f9e)

Run 2026-11-19 after SHIP VERIFIED (healthz sha and the served frontend both `89d5f9e`). https://www.conestruct.com/sandbox, the real backend and live Overpass, no stubs, read-only: nothing was saved; the bar and the pin change only the page's own state. Headless Chromium, DPR 1, at 1440x900, 1198x930 and 390x844. The gate token was read from `conestruct/site/.env.local` inside the script, sent as a header by `scripts/gate.cjs` only, and never printed. Script: `script/walk-539-prod.mjs` (built from the items' walks `../issue-536/walk-script/walk536.mjs`, `../issue-537/walk-script/walk537.mjs`, `../issue-538/walk-script/walk538.mjs`). Results: `crops/prod-walk.json`, `run.log`.

Flow per size. Run A: Pick on map; no pin; Enter coordinates (editing); "abc" / -104.9811, Enter (error); typed 39.7401 / -104.9811, Enter (the camera is read when it stops); the pin state and its road list; editing over the pin; Esc. Run B: a fresh page, typed 39.7401 / -104.9757, the road list.

## #536: the corner in the road row's title: PASS

| Pin | Rows (title / second line), same at 1440, 1198 and 390 |
|---|---|
| Colfax and Pennsylvania (39.7401, -104.9811) | "Pennsylvania Street at East Colfax Avenue" / "Traffic both ways · 2 m from your pin"; "East Colfax Avenue at Pennsylvania Street" / "Traffic both ways · 5 m from your pin" |
| No cross street (39.7401, -104.9757) | "East Colfax Avenue" / "Traffic both ways · 6 m from your pin"; no `.road-pick-at` |

- Street name weight 600, rgb(234, 240, 247). " at <cross street>" weight 400, rgb(174, 187, 204), equal to `var(--ink-mute)` resolved in the row and to the second line's colour, at every size.
- No second line contains " · at". axe on `[role=dialog]` with each list: 0 violations.
- The readings match the local walk (`../issue-536/walk.md`) exactly.

## #537: the coordinates bar: PASS

| Size | Map (x, y, w, h) | Rail (x, y, w, h) | Bar | Min control | axe (5 states) |
|---|---|---|---|---|---|
| 1440x900 | 1, 163.25, 822, 532.75 | 823, 86.75, 456, 653.25 | 1, 696, 822 x 44 | 44 | 0/0/0/0/0 |
| 1198x930 | 1, 163.25, 620.19, 559.75 | 621.19, 86.75, 456, 680.25 | 1, 723, 620.19 x 44 | 44 | 0/0/0/0/0 |
| 390x844 | 1, 183.5, 388, 371.36 | 1, 598.86, 388, 125.25 then 341.25 | 1, 554.86, 388 x 44 | 44 | 0/0/0/0/0 |

- States: no pin ("No pin yet. Search, tap the map, or enter coordinates." + "Enter coordinates"), editing (Latitude, Longitude, Go, Cancel), error ("Use numbers in decimal degrees, like 39.7401"), pin ("Pin at 39.7401, -104.9811", "Tap the numbers to change them"), and editing over the pin.
- The map's box moved 0 px across all five states at every size; the bar's box moved 0 px and is 44 px tall in every state. The rail moved 0 px at 1440 and 1198. At 390 the rail is stacked under the map: its x, y and width moved 0 px; its height grows from 125.25 to 341.25 when the road list arrives (pin states), as the local walk recorded (`../issue-537/walk.md` note at 390). The script's whole-box counter therefore reads `railMoves: 1` at 390.
- Controls: "Enter coordinates" 130.09 x 44, "39.7401, -104.9811" 155.06 x 44, Latitude and Longitude 264.53 / 163.63 / 88.34 x 44 (1440 / 1198 / 390), Go 44.34 x 44, Cancel 53.34 x 44.
- Esc while editing over the pin closes the editor and keeps the window open (dialog count 1, bar back to "Pin at 39.7401, -104.9811").
- Same numbers as the local walk.

## #538: typed coordinates fly to the pin: PASS

| Size | Zoom when the camera stopped | Center (lat, lng) | After the road list (2.5 s later) |
|---|---|---|---|
| 1440x900 | 16 | 39.7401, -104.9811 | 16, same center |
| 1198x930 | 16 | 39.7401, -104.9811 | 16, same center |
| 390x844 | 16 | 39.7401, -104.9811 | 16, same center |

Read from the map itself (the window's mapRef through the React fiber, as in walk538). The center equals the pin to 5 decimals. `crops/prod-{size}-applied-map.png` shows the pin at the map's center at Colfax and Pennsylvania.

## Console

0 console errors at every size (both runs). No `events.mapbox.com` `ERR_NAME_NOT_RESOLVED` this time, so no telemetry errors to set apart. Failed requests: only `api.mapbox.com net::ERR_ABORTED` (tiles the map cancelled while flying and zooming): 94 / 61 / 18 at 1440 / 1198 / 390. No failed request to `www.conestruct.com`.

## Evidence

- `script/walk-539-prod.mjs`, `run.log`, `crops/prod-walk.json`.
- `crops/prod-{1440,1198,390}-bar-{no-pin,editing,error,pin,editing-pin}.png`: the bar with 60 px of map above it.
- `crops/prod-{1440,1198,390}-list-{colfax-pennsylvania,no-cross-street}.png`: the road lists.
- `crops/prod-{1440,1198,390}-applied-map.png`: the map after the fly.
- Whole-window shots of every bar state (15) are in `validation-artifacts-extra/ux-map-corner-coords/prod-check/` in the main checkout (untracked).

Not checked here: Ryan's browser check of the map window (visible design, including Question 1), per the mission report § After the ship.
