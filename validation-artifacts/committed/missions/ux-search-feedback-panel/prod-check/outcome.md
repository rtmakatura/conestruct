# #565 production check (mission #566, ux-search-feedback-panel): PASS (main fb23505)

Run 2, 2026-11-24 22:37:48 to 22:39:25 UTC (`results.json` `ranAt`, `finishedAt`), after the ship of main `fb23505`. https://www.conestruct.com/sandbox, the real backend, live Mapbox, the live geocoder and the live road lookup, **no stubs in this run**, read-only: nothing was saved and "Save and close" was never pressed. Headless Chromium, DPR 1, signed out, at 1440x900, 1198x930 and 390x844, one browser at a time. The gate token was read from `conestruct/site/.env.local` inside the script, sent by `scripts/gate.cjs` to the site's own host only, and never printed or written.

Script: `script/walk-565-prod.mjs`. Numbers: `results.json`. Log: `run.log`. Token scan: `token-scan.json`, run with `script/scan-token.mjs`.

## Two runs, and why

The check was asked for as one run. It took two, and both are kept.

- Run 1 (`run-1.log`, `results-run-1.json`; its shots are in the extras folder under `run-1/`) reported FAIL at every size on one check, `pinBoxGoneRoadsListed`, and had two faults of the script, not of the site:
  1. It compared the no-match box with a one-line expectation. The live box has two lines ("No match in Colorado for that address." / "Check the spelling."), so the script took the live answer for a miss and stubbed `/api/geocode` (404 "no match") for that state, which needed no stub. The live answer was recorded before the stub.
  2. It took the pin state from the street address `1437 Bannock St, Denver`. The live road lookup answers that pin with no road (see "Unexpected" below), so there were no road rows to check.
- Run 2 changed those two things only: the no-match comparison reads the first line, and there are two pin states (the street address, and the pair 39.7401, -104.9811). Every other number in run 1 equals run 2's.
- Geocoder requests that reached the live site: 15 in run 1 (5 per size; the 3 stubbed repeats were answered in the browser) and 15 in run 2. No HTTP 429 in either.

## Shas (checked before any browser opened)

| What | Value | Result |
|---|---|---|
| Backend `/healthz` | `fb235053e9cd73761f340174553fbcf08a4bfcae` | equals main |
| Site `/api/version` (HTTP 200) | `fb235053e9cd73761f340174553fbcf08a4bfcae` | equals main |
| Served `/_next/` scripts, each size (14 read) | 1 holds `mw-feedback`, 0 hold `mw-search-list`, the sha `fb23505` is in them | the #565 build |

## The states, and what the live site showed

One window per size, the states in this order. The text was the same at all three sizes.

| State | Typed | `/api/geocode` | Bar | The box (`[data-testid=search-feedback]`, `role="status"`) |
|---|---|---|---|---|
| no pin | (window as it opens) | 0 | No pin yet | none |
| 1 town | `Lafayette, CO` | 1 (HTTP 200) | No pin yet | "That search found a town or area, not a street." / "Tap the map on the road where the work starts. The roads near your tap show up here." |
| 2 weak match | `39 N, 44.4` | 1 (HTTP 200) | No pin yet, 0 markers | "Closest match: 39 North Main Street, Holly, Colorado 81047." / "Check the pin before you go on." |
| 3 out of range | `95.5, -104.9811` | 0 | No pin yet | "Latitude must be between -90 and 90" |
| 4 "Did you mean" | `-104.9811, 39.7401` | 0 | No pin yet | the button "Did you mean 39.7401, -104.9811?" |
| 5 no match | `zzqxv 99999 nowhere st` | 1 (HTTP 404 "check address") | No pin yet | "No match in Colorado for that address." / "Check the spelling." |
| 6 outside Colorado | `1600 Pennsylvania Ave, Washington, DC` | 1 (HTTP 422 "outside colorado") | No pin yet | "Plans cover Colorado roads only." |
| 7a pin, street address | `1437 Bannock St, Denver` | 1 (HTTP 200) | Pin at 39.7392, -104.9910, 1 marker | none (gone). Road lookup: HTTP 200, 0 roads; the panel reads "We didn't find a road at your pin." with the direction choices |
| 7b pin, the pair | 1440: `-104.9811, 39.7401` then the button pressed. 1198, 390: `39.7401, -104.9811` | 0 | Pin at 39.7401, -104.9811, 1 marker | none (gone). Road lookup: HTTP 200, 2 roads; 2 road rows listed (the first is "Pennsylvania Street at East Colfax Avenue") |

With a message and no pin the section reads: "Which road is the work on?", the box, "Tap the map to find the roads.".

The button press (1440, once): with the pin at 39.7392, -104.9910 the swapped pair was typed, the box showed the button, the button was pressed; the bar then read "Pin at 39.7401, -104.9811", 1 marker, the box gone, 0 geocoder requests.

## Result per size

| Check | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| Named checks run / failed (`results.json` `verdict`) | 25 / 0 | 24 / 0 | 24 / 0 |
| Map, search row, bar under the map, footer: largest move across the 9 states | 0 / 0 / 0 / 0 px | 0 / 0 / 0 / 0 px | 0 / 0 / 0 / 0 px |
| Window head, map column, dialog: largest move | 0 / 0 / 0 px | 0 / 0 / 0 px | 0 / 0 / 0 px |
| Map box (x, y, w x h in the dialog) | 1, 163.25, 822 x 532.75 | 1, 163.25, 620.19 x 559.75 | 1, 183.5, 388 x 371.36 |
| Search row | 1, 86.75, 822 x 76.5 | 1, 86.75, 620.19 x 76.5 | 1, 107, 388 x 76.5 |
| Bar under the map | 1, 696, 822 x 44 | 1, 723, 620.19 x 44 | 1, 554.86, 388 x 44 |
| Footer | 1, 740, 1278 x 69 | 1, 767, 1076.19 x 69 | 1, 747.25, 388 x 95.75 |
| Message elements over the map (box / map overlap; any live region, alert or old list overlapping it; anything positioned over it; a status element in the map column) | 0 px2, 0, 0, 0 in all 9 states | the same | the same |
| The box: inside the right panel's box, under the question, above "Tap the map to find the roads." (6 message states) | yes; 8 px under the question, 20 px above the line | the same | the same |
| Box size: two lines / "Did you mean" / no match / one line | 407 x 88.75 / 407 x 68 / 407 x 68.5 / 407 x 44.25 | the same | 340 x 88.75 / 340 x 68 / 340 x 68.5 / 340 x 44.25 |
| "Did you mean" button | 375 x 44 | 375 x 44 | 308 x 44 |
| axe on `[role=dialog]`, 9 states | 0 each | 0 each | 0 each |
| Controls outside the map under 44 px (52 measurements over 9 states) | none; smallest 44 x 44 | none; smallest 44 x 44 | none; smallest 44 x 44 |
| Console errors | 2 | 2 | 2 |
| HTTP 429 | 0 | 0 | 0 |
| POST `/api/geocode` / `/api/road-bearing` | 5 / 2 | 5 / 2 | 5 / 2 |
| Token in the page (9 checks) | 0 hits | 0 hits | 0 hits |

- The 2 console errors per size are Chromium's "Failed to load resource" for the geocoder's own 404 (no match) and 422 (outside Colorado) answers. The page shows the geocoder's sentence for each. No page error, no other console error.
- The right panel itself: at 1440 and 1198 its box moves 0 px across the states. At 390 it is below the map and its height changes with what it holds (largest change 354.75 px); nothing above it moves. It was not one of the four boxes the check names.
- Non-GET requests to the site: 8 per size, all POST to `/api/geocode`, `/api/road-bearing` or `/api/render/corridor-geometry`. Nothing else.
- Failed requests (not console errors): `api.mapbox.com net::ERR_ABORTED` 39 / 31 / 22 (map tile requests cut off as the map moved; the cause was not looked into). None to `www.conestruct.com`.

## Mapbox's own marks (recorded, not counted; the open question in #505)

| Mark | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| "Zoom in", "Zoom out" | 44 x 44 | 44 x 44 | 44 x 44 |
| Mapbox logo link ("Mapbox homepage") | 88 x 23 | 88 x 23 | 88 x 23 |
| Attribution links ("© Mapbox", "© OpenStreetMap", "Improve this map", "© Maxar") | 54.88 x 14, 96.89 x 14, 99.36 x 14, 45.52 x 14 | folded into the button below | folded into the button below |
| "Toggle attribution" button | not shown | 24 x 24 | 44 x 44 |

## What was stubbed

- Run 2 (the result above): nothing.
- Run 1 only: `/api/geocode` answered in the browser with 404 "no match" for the repeat of the no-match search, once per size (the script fault above). The box then read "No match for that address". That state is not part of the result.

## Unexpected

- `1437 Bannock St, Denver` pins at 39.7392, -104.9910 and the live road lookup answers HTTP 200, `scan_status` "ok", 0 roads, in both runs at all three sizes (6 of 6). The window shows "We didn't find a road at your pin." and the direction choices. This is the road lookup at that point, not the search box of #565: the box is gone as ruled. Whether a street address should land where no road is found was not looked into. Nothing was filed.
- The live geocoder's no-match answer for the nonsense address is 404 "check address" (two lines in the box), not the bare one-line "No match for that address".
- "Toggle attribution" is 24 x 24 at 1198x930 and 44 x 44 at 390x844 (Mapbox's own control; #505).

## Not measured

- A pin placed by a tap on the map. The pins here came from the search box (an address, a pair, the "Did you mean" button).
- The box over a road list (a message while a pin with roads is there) at 1198 and 390. At 1440 it was seen once (the button, before the press), not measured for position.
- The box going away while a new search runs (the "Searching…" moment); the local walk held a stubbed search open for that, and nothing is stubbed here. It is seen only as each next state's box replacing the last.
- The "Did you mean" press at 1198 and 390 (asked for at one size).
- Contrast and fonts of the box (measured in the local walk, `../issue-565/walk.md`); axe's own contrast rule ran and found nothing.
- The map's camera; a screen reader's announcement of the live region; axe outside the dialog; widths other than the three; signed-in sessions; other browsers; DPR above 1.

## Evidence

- `script/walk-565-prod.mjs`, `script/scan-token.mjs`, `run.log`, `results.json`, `token-scan.json`; run 1's `run-1.log`, `results-run-1.json`.
- `crops/prod-{1440,1198,390}-{no-pin,town,weak-match,out-of-range,did-you-mean,no-match,outside-colorado,pin-address,pin}.png`: the right panel in each state (27).
- `crops/prod-{1440,1198,390}-town-window.png`: the whole window with the town message (3).
- Extras (untracked, main checkout): `validation-artifacts-extra/ux-search-feedback-panel/prod-check/`: run 2's whole-window shot for every state (27), and `run-1/` with run 1's crops (27) and window shots (28).

Every browser the script started was closed. No dev server was started.
