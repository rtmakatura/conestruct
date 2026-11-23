# Mission ux-map-window-tidy (#546) production check: PASS (main 20f88a9)

#543, #544 and #545, run 2026-11-23 07:35 to 07:41 UTC (`results.json` `ranAt`, `finishedAt`), after SHIP VERIFIED. https://www.conestruct.com/sandbox, the real backend, live Mapbox and the live road service, no stubs, read-only: nothing was saved and "Save and close" was never pressed. Headless Chromium, DPR 1, signed out, at 1440x900, 1198x930 and 390x844, one size after another. The gate token was read from `conestruct/site/.env.local` inside the script, sent by `scripts/gate.cjs` to the site's own host only, and never printed or written.

Script: `script/walk-546-prod.mjs` (built from the three local walks in `../issue-543/`, `../issue-544/`, `../issue-545/` and the previous production check `../../ux-coords-in-search/prod-check/script/walk-541-prod.mjs`). Numbers: `results.json`. Log: `run.log`. Every number below is from `results.json`, except the token scan's file counts, which are in `token-scan.json`.

## Shas (checked before any browser opened)

| What | Sha | Result |
|---|---|---|
| Backend `/healthz` | `20f88a9824d3e13cad40c07e14528aa09905b1ec` | equals main |
| Site `/api/version` (first poll, HTTP 200) | `20f88a9824d3e13cad40c07e14528aa09905b1ec` | equals main |
| Sha found inside the site's own served `/_next/static` chunks, each size | `20f88a9` | the 20f88a9 build |

## Result per item per size

| Item | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| #543 the town notice floats | PASS | PASS | PASS |
| #544 brackets; the pair on one line | PASS | PASS | PASS |
| #545 ring and dot; the attribution; Cancel and Close | PASS | PASS | PASS |
| axe, 44 px, console, token in the page | PASS | PASS | PASS |

The checks behind each PASS are listed by name in `results.json` (`verdict543`, `verdict544`, `verdict545`, `verdictCommon`); none failed.

## #543: search "Lafayette, CO"

The notice "That search found a town or area. Tap the map on the road where the work starts." shows inside the search's floating list (`position: absolute`, `role="status"`), on top of the map: a point at the notice's centre reaches the notice, not the map.

| Size | Floating list | Notice | Over the map | Map, search row, right panel, bar: notice not shown vs shown |
|---|---|---|---|---|
| 1440x900 | 694.16 x 35.5 | 1 line | 23.5 px | 0 px each |
| 1198x930 | 492.34 x 53 | 2 lines | 41 px | 0 px each |
| 390x844 | 260.16 x 70.5 | 3 lines | 58.5 px | 0 px each |

The boxes (x, y, w x h, in the window's frame), the same in both states:

| Size | Map | Search row | Right panel | Bar |
|---|---|---|---|---|
| 1440x900 | 1, 163.25, 822 x 532.75 | 1, 86.75, 822 x 76.5 | 823, 86.75, 456 x 653.25 | 1, 696, 822 x 44 |
| 1198x930 | 1, 163.25, 620.19 x 559.75 | 1, 86.75, 620.19 x 76.5 | 621.19, 86.75, 456 x 680.25 | 1, 723, 620.19 x 44 |
| 390x844 | 1, 183.5, 388 x 371.36 | 1, 107, 388 x 76.5 | 1, 598.86, 388 x 125.25 | 1, 554.86, 388 x 44 |

The map column, the window and the scroll height also changed 0 px. The search sent 1 request to `/api/geocode` and the camera stopped at zoom 12.

A tap on the map 96.5 / 79 / 61.5 px under the notice (1440 / 1198 / 390): 1 pin marker, the bar reads "Pin at 40.0175, -105.0905" / "Pin at 40.0194, -105.0905" / "Pin at 40.0069, -105.0905", and the notice is gone (the floating list is no longer shown). The map, search row and bar are 0 px from the no-pin state with that pin.

## #544: brackets, and the swapped pair

| Typed | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| `(39.7401, -104.9811)` | pin, 0 geocode | pin, 0 geocode | pin, 0 geocode |
| `[39.7401, -104.9811]` | pin, 0 geocode | pin, 0 geocode | pin, 0 geocode |
| `E Colfax Ave & Pennsylvania St, Denver` (control) | 1 geocode (POST, 200) | 1 geocode (POST, 200) | 1 geocode (POST, 200) |

"Pin" means, in all 6 bracket runs: the bar reads "Pin at 39.7401, -104.9811", 1 pin marker, the camera at zoom 16 centred on 39.7401, -104.9811, 1 request to `/api/road-bearing` on Enter, the road rows "Pennsylvania Street at East Colfax Avenue" and "East Colfax Avenue at Pennsylvania Street", 0 retries. The address control's bar reads "Pin at 39.7400, -104.9811".

`-104.9811, 39.7401` shows "Did you mean 39.7401, -104.9811?":

| Size | The choice | Lines of the choice | The two numbers ("39.7401, -104.9811?", 144.13 px, no-wrap) | Sentence needs / room |
|---|---|---|---|---|
| 1440x900 | 692.16 x 44 | 1 | 1 line | 237.17 / 668.16 |
| 1198x930 | 490.34 x 44 | 1 | 1 line | 237.17 / 466.34 |
| 390x844 | 258.16 x 44 | 2 | 1 line | 237.17 / 234.16 |

At 390 the choice is two lines, "Did you mean" then the pair whole (`crops/prod-390-search-did-you-mean.png`), as the mission report's question 3 says. While the choice shows: 0 geocode and 0 road requests, and the map, search row, right panel and bar are 0 px from the no-pin state.

## #545: the mark, the attribution, Cancel and Close

**The mark beside the bar's text** (10 x 10, the same at every size):

| State | Mark | Contrast on the bar |
|---|---|---|
| "No pin yet" (5 / 6 / 6 states) | a ring: no fill (`rgba(0, 0, 0, 0)`), border 2px solid `rgb(147, 160, 176)`, which is `--ink-faint` as the browser resolves it | 6.47:1 |
| "Pin at ..." (4 / 4 / 4 states) | a dot: fill `rgb(255, 138, 46)`, which is `--dim`, no border | 7.32:1 |

The bar is 44 px high in all 9 / 10 / 10 measured states, has 0 controls inside, and its box and the mark's box are 0 px apart between no pin and a pin (bar boxes in the #543 table).

**Mapbox's attribution:**

| Size | Form | Reads | Toggle button | Tap area, line closed | Tap area, line open |
|---|---|---|---|---|---|
| 1440x900 | the full line, always shown | "© Mapbox © OpenStreetMap Improve this map © Maxar" | not shown | n/a | n/a |
| 1198x930 | compact | the same line when open | 24 x 24 | 1,936 of 1,936 | 1,816 of 1,936 |
| 390x844 | compact | the same line when open | 44 x 44 | 1,936 of 1,936 | 1,936 of 1,936 |

Tap area: the points of the 44 x 44 square centred on the button that reach it through `elementFromPoint`, one per CSS pixel. At 1198 with the line open, the other 120 points are the notch: 90 reach Mapbox's "© Maxar" link and 30 the line's own box. These are the local walk's numbers exactly, and the notch is the mission report's question 5, still Ryan's to rule. A real click 17 px up and left of the button's centre at 1198 opened the line, and one 17 px down and left closed it (at 390, a click on the centre).

At every size the attribution is inside the map; with the line shown, each of its four links (14 px high, to mapbox.com, openstreetmap.org, mapbox.com and maxar.com) is reached at its own centre; and Mapbox's logo link ("Mapbox homepage", 88 x 23) is shown. Crops: `crops/prod-1440-attrib-full-line.png`, `crops/prod-{1198,390}-attrib-{closed,open}.png`.

**Closing the window**, with a pin placed, 9 of 9 (Cancel, the Close button and Escape, at each size): the window closes, focus is on "Pick on map", the page scroll, the page height, the "Pick on map" button, the band and `main` move 0 px, 0 non-GET requests go to the site while closing, and the window opened next reads "No pin yet" with 0 markers.

## axe, 44 px, console, requests, token

- axe on `[role=dialog]`: 0 violations in 9 / 10 / 10 runs (every state, the attribution open and closed included).
- 44 px: 74 / 88 / 88 control measurements. At 1440 and 390 the smallest control is 44 x 44 and none is under 44. At 1198 the one box under 44 is Mapbox's 24 x 24 "Toggle attribution" button, whose tap area is the full 44 x 44 with the line closed; with the line open it is the notch above, set apart by name and not counted.
- Mapbox's own marks, not counted, under the ruled exception (#505, Ryan, 2026-11-10: Mapbox's logo and attribution links are Mapbox's, placed under its terms, not controls we design): the logo link 88 x 23, and the four attribution links, 14 high.
- Console errors: 0 at every size. HTTP 429 responses: 0.
- Non-GET requests to the site in the whole run, each size: 2 POST `/api/geocode` (the town search and the address control), 4 POST `/api/road-bearing`, 1 POST `/api/render/corridor-geometry`. All three are reads. Nothing else.
- Failed requests (not console errors): `api.mapbox.com net::ERR_ABORTED` 88 / 93 / 39 (tiles the map cancelled while flying or when the page was reloaded) and a Sentry ingest host `net::ERR_ABORTED` 4 / 4 / 4 (cut off by the reloads). None to `www.conestruct.com`.
- The token in the page: 5 checks per size (the page's HTML, its text, what it stored, its cookies), 0 hits for the token's value or the gate header's name.
- The token in files (`token-scan.json`, run by `script/scan-token.mjs` after this file was written): 0 hits for the token's value and 0 for the gate header's name in every file of this folder, the extras folder and the scratch folder, the PNG crops' bytes included.

## Retries and oddities

- Road-lookup retries: 0 at every size. No 429.
- At 1440 the tap for #543 landed more than 30 m from a mapped road, so the right panel showed "We didn't find a road at your pin." with the four direction choices instead of a road list (`prod-1440-window-pin-after-tap.png` in the extras). The pin was placed and the notice cleared all the same. At 1198 and 390 the tap found a road ("Powell Street", "Bass Circle").
- `/api/render/corridor-geometry` was sent once per size, after the map tap in the #543 window, and not after the typed coordinates. It is the window's corridor overlay read (`app/api/corridor-map/route.ts:16` calls it "the corridor-geometry read"). Not looked into further.
- In the first window of each size, three `localStorage` keys appeared between the page load and the close: `mapbox.eventData.uuid:`, `mapbox.eventData.uuidTimestamp:` and `mapbox.eventData:` (Mapbox's own, written when its map first loads). No other stored key changed in any close.
- Two earlier runs are not part of these numbers: a trial at 1198 only, written to the scratch folder (its 44 px and POST verdicts read FAIL because the script did not yet name the notch or the corridor-geometry read; its measures equal this run's), and a full run stopped by hand during its first size because it had been started with a wrong second sha argument. Both are kept in the extras folder (`trial-1198/`, `aborted-run-1/`).

## Defects

None found. No issue filed.

## Not measured

- The pixel comparison of the attribution with the button's `::after` on and off (the local walk's 0 differing pixels): it needs a style injected into the page, so it was left to the local walk.
- Hover on the attribution button (the reviewer's finding in #547).
- The bearing note: it cannot be made to show (mission report, question 1).
- `(39° 44.4)` and `[39° 44.4]` (mission report, question 4; the spacing round).
- Whether the strip of map under the floating notice takes taps: only a tap below the notice was made.
- Where the pin sits on the screen: read as 1 marker and the camera centre, not as pixels.
- Widths other than the three; signed-in sessions; other browsers; DPR above 1.
- Visible design: Ryan's browser check of the map window, per the mission report § After the ship.

## Evidence

- `script/walk-546-prod.mjs`, `script/scan-token.mjs`, `run.log`, `results.json`, `token-scan.json`.
- `crops/prod-{1440,1198,390}-search-town-notice.png`: the search row, the notice and 150 px under the row (cut to 700 px wide). `crops/prod-390-window-town-notice.png`: the whole window at 390 (question 2).
- `crops/prod-{1440,1198,390}-search-did-you-mean.png`: the choice (question 3 at 390).
- `crops/prod-{1440,1198,390}-bar-{no-pin,pin}.png`: the bar with 24 px of map above it (cut to 520 px wide).
- `crops/prod-1440-attrib-full-line.png`, `crops/prod-{1198,390}-attrib-{closed,open}.png` (question 5 at 1198).
- 31 more shots (whole windows of every state, the bracket searches) are in `validation-artifacts-extra/ux-map-window-tidy/prod-check/` in the main checkout (untracked), with the trial and the stopped run.

Every browser the script started was closed (no Chromium process left after the run). No dev server was started.
