# #541 production check (mission ux-coords-in-search, #542): PASS (main 42161dc)

Run 2026-11-23 04:28 UTC (`results.json` `ranAt`), after SHIP VERIFIED. https://www.conestruct.com/sandbox, the real backend, live Mapbox and the live road service, no stubs, read-only: nothing was saved, "Save and close" was never pressed, and all 18 windows (6 per size) were closed with Escape (dialog count 0 after each). Headless Chromium, DPR 1, signed out, at 1440x900, 1198x930 and 390x844. The gate token was read from `conestruct/site/.env.local` inside the script, sent by `scripts/gate.cjs` to the site's own host only, and never printed or written.

Script: `script/walk-541-prod.mjs` (built from `../issue-541/walk-script/walk541.mjs` and `../../ux-map-corner-coords/prod-check/script/walk-539-prod.mjs`). Numbers: `results.json`. Log: `run.log`. Every number below is from `results.json`, except the token scan's counts (§ 6).

## Shas (checked before any browser opened)

| What | Sha | Result |
|---|---|---|
| Backend `/healthz` | `42161dc88c7c0cdd74f6321e23acd37cc6c0ef27` | equals main |
| Site `/api/version` (first poll, HTTP 200) | `42161dc88c7c0cdd74f6321e23acd37cc6c0ef27` | equals main |
| Sha found inside the site's own served `/_next/static` chunks, each size | `42161dc` | the 42161dc build |

## Result per check per size

| Check | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| 1. The four formats place the pin | PASS | PASS | PASS |
| 2. Out of range | PASS | PASS | PASS |
| 3. Swapped ("Did you mean") | PASS | PASS | PASS |
| 4. The bar and the placeholder | PASS | PASS | PASS |
| 5. Address search sends one geocode request | PASS | PASS | PASS |
| 6. axe, 44 px, console | PASS | PASS | PASS |

## 1. The four ruled formats

A fresh page per format: open the map window (zoom 6), type, Enter. The same at all three sizes, for `39.7401, -104.9811`, `39.7401 -104.9811`, `39.7401,-104.9811` and `39.7401° N, 104.9811° W`:

| Measure | Value (12 of 12 runs) |
|---|---|
| Zoom | 6 -> 16 when the camera stopped, still 16 after the road list |
| Centre (lat, lng, 5 decimals) | 39.7401, -104.9811 |
| Pin markers on the map | 1 |
| Requests to `/api/geocode` | 0 |
| Requests to `/api/road-bearing` on Enter | 1 |
| Bar | "Pin at 39.7401, -104.9811" |
| Road rows | "Pennsylvania Street at East Colfax Avenue", "East Colfax Avenue at Pennsylvania Street" |
| The search box afterwards | still holds the text as typed |

The live road service did not answer once: at 1198, `39.7401, -104.9811` needed the window's own "Try again" 2 times before the list loaded (`lookupRetries` 2). The other 11 runs needed 0. The pin, the zoom and the 0 geocode requests were the same in that run.

## 2. Out of range (`139.7401, -104.9811`)

| Size | Floating list | Geocode / road requests | Map, bar, right panel, search row vs no pin | Camera |
|---|---|---|---|---|
| 1440x900 | 1 line, "Latitude must be between -90 and 90", `position: absolute`, 694.16 x 35.5 | 0 / 0 | 0 px each | zoom 6, unchanged |
| 1198x930 | 1 line, same text, 492.34 x 35.5 | 0 / 0 | 0 px each | zoom 6, unchanged |
| 390x844 | 1 line, same text, 260.16 x 35.5 | 0 / 0 | 0 px each | zoom 6, unchanged |

The bar still reads "No pin yet".

## 3. Swapped (`-104.9811, 39.7401`)

| Size | The choice | While it shows: map, bar, right panel, search row vs no pin (and vs the out-of-range state) | Requests while it shows |
|---|---|---|---|
| 1440x900 | "Did you mean 39.7401, -104.9811?", 1 line, 692.16 x 44 in a 694.16 x 46 list | 0 px each | geocode 0, road 0 |
| 1198x930 | same text, 490.34 x 44 in 492.34 x 46 | 0 px each | geocode 0, road 0 |
| 390x844 | same text, 258.16 x 44 in 260.16 x 46 | 0 px each | geocode 0, road 0 |

At 390 the choice's text wraps to two lines inside its 44 px button (`crops/prod-390-search-did-you-mean.png`); one line at 1440 and 1198.

Choosing it, at every size: the bar reads "Pin at 39.7401, -104.9811", the box reads `39.7401, -104.9811`, zoom 16 centred on 39.7401, -104.9811, geocode requests 0, road requests 1, the same two road rows, 0 retries. With the pin the map, the bar and the search row are still 0 px from the no-pin state. The right panel moved 0 px at 1440 and 1198. At 390 (one column, the panel under the bar) its x, y and width moved 0 and its height grew by 216 (125.25 to 341.25) when the road list loaded inside it, as the local walk recorded (`../issue-541/walk.md`).

## 4. The bar

| Size | Bar box (x, y, w, h) | Height in 9 states | Controls inside | Text |
|---|---|---|---|---|
| 1440x900 | 1, 696, 822 x 44 | 44 in all 9 | 0 | "No pin yet" (no pin, out of range, "Did you mean"), then "Pin at 39.7401, -104.9811" |
| 1198x930 | 1, 723, 620.19 x 44 | 44 in all 9 | 0 | same |
| 390x844 | 1, 554.86, 388 x 44 | 44 in all 9 | 0 | same |

The 9 states: no pin, out of range, "Did you mean", the choice taken, the four formats, the address search. "Controls inside" counts button, input, link, form, select, textarea, `[tabindex]` and `[role=button]`, in the first 8 of those states. The search placeholder is "Address, intersection or coordinates" at every size (the box's label: "Address, intersection or coordinates search").

Other boxes, for the record (same as the local walk): map 822 x 532.75 / 620.19 x 559.75 / 388 x 371.36; right panel 456 x 653.25 / 456 x 680.25 / 388 x 125.25; dialog 1280 x 810 / 1078.19 x 837 / 390 x 844, the same in all four Part A states.

## 5. An ordinary address search

`E Colfax Ave & Pennsylvania St, Denver`, a fresh page, at every size: exactly 1 request to `/api/geocode` (POST, HTTP 200), counted until 5 s after the road list. The pin is placed, zoom 16, centre 39.73999, -104.98112, the bar reads "Pin at 39.7400, -104.9811", the floating list is empty, the same two road rows, 0 retries.

Over the whole run each size sent 1 geocode request in total (this one); road requests were 6 / 8 / 6 (the 8 at 1198 includes the 2 retries).

## 6. axe, 44 px, console, token

- axe on `[role=dialog]`, 6 states per size (no pin, out of range, "Did you mean", pin, a format with its road list, the address search): 0 violations in all 18 runs.
- 44 px: 67 control measurements per size across the states. Smallest width 44, smallest height 44, 0 controls under 44 on either side. The controls: Close 44 x 44; the search box 694.16 / 492.34 / 260.16 x 44.5; Search 79.84 x 44.5; Zoom in and Zoom out 44 x 44; Cancel 79.34 x 44; Save and close 146.23 x 44; the "Did you mean" choice (above); the road rows 407 x 64 (340 x 64 at 390).
- Mapbox's own marks, set apart under the ruled exception (#505), not counted above: the logo link 88 x 23 at every size; at 1440 the four attribution links, 14 high; at 1198 and 390 Mapbox's compact "Toggle attribution" button, 24 x 24 at 1198 and 44 x 44 at 390. Note for a ruling, not filed: the exception names the logo and the attribution links; the 24 x 24 toggle at 1198 is Mapbox's attribution control but a button, not a link. #541 did not touch it.
- Console errors: 0 at every size. `events.mapbox.com` telemetry failures: 0 this run, so none to set apart.
- Failed requests (not console errors): `api.mapbox.com net::ERR_ABORTED` 180 / 154 / 51 (tiles the map cancelled while flying or when the page was reloaded) and a Sentry ingest host `net::ERR_ABORTED` 5 / 5 / 5 (cut off by the reloads). None to `www.conestruct.com`.
- Token scan: 0 hits for the token's value and 0 for the gate header's name across 51 files (this folder, the extras folder and the scratch folder), scanned again after this file was written. These scan counts are the one set of numbers here that is not in `results.json`; the scan ran separately.

## Defects

None found. No issue filed.

## Not measured

- Closing with Cancel or the Close button: every window was closed with Escape.
- The 0 px size check for the four formats and the address search: each ran on a fresh page, so there is no before-state in the same window. Their bar height (44) and the Part A size check are measured.
- The script's `dialog` entry in its `moved…` fields is `null` (the dialog box is recorded as width and height only). The dialog's size is in each state's `dialog` field and is equal across the four Part A states.
- Where the pin sits on the screen: read as 1 marker and the camera centre, not as pixels.
- Signed-in sessions, other browsers, DPR above 1, and any text other than the six typed here.
- Visible design: Ryan's browser check of the map window, per the mission report § After the ship.

## Evidence

- `script/walk-541-prod.mjs`, `run.log`, `results.json`.
- `crops/prod-{1440,1198,390}-bar-{no-pin,pin}.png`: the bar with 24 px of map above it (cut to 520 px wide).
- `crops/prod-{1440,1198,390}-search-{out-of-range,did-you-mean,address}.png`: the search row and 70 px under it (cut to 620 px wide).
- `crops/prod-{1440,1198,390}-roads-comma-space.png`: the road list after `39.7401, -104.9811`.
- 27 whole-window shots (every state, every format, the address search) are in `validation-artifacts-extra/ux-coords-in-search/prod-check/` in the main checkout (untracked).

Every browser the script started was closed (no Chromium process left after the run). No dev server was started.
