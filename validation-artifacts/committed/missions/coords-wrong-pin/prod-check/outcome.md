# Mission coords-wrong-pin (#549) production check: PASS (main db810a0)

#547, run 2026-11-23 19:25:02 to 19:25:32 UTC (`results.json` `ranAt`, `finishedAt`), with a second read at 19:25:59 to 19:26:04 UTC (`slot-count.json`), after the ship of main `db810a0`. https://www.conestruct.com/sandbox, the real backend, live Mapbox and the live geocoder, no stubs, read-only: nothing was saved and "Save and close" was never pressed. Headless Chromium, DPR 1, signed out, at 1440x900, 1198x930 and 390x844, one size after another. The gate token was read from `conestruct/site/.env.local` inside the scripts, sent by `scripts/gate.cjs` to the site's own host only, and never printed or written.

Scripts: `script/walk-547-prod.mjs` (the local walk `../issue-547/walk-script/walk547.mjs` with the same measure, axe and crop code, plus the sha gate, console, failed-request and token checks of the previous production check, `../../ux-map-window-tidy/prod-check/script/walk-546-prod.mjs`) and `script/count-slot-547-prod.mjs`. Numbers: `results.json`, `slot-count.json`. Log: `run.log`. The local numbers compared against are `../issue-547/shots/walk.json` (the local walk's after run, written up in `../issue-547/walk.md`).

#548 is parked and not shipped; nothing here is about it.

## Shas (checked before any browser opened)

| What | Sha | Result |
|---|---|---|
| Backend `/healthz` | `db810a0e3a4a100b56c1cde18f29b863bafd6921` | equals main |
| Site `/api/version` (first poll, HTTP 200) | `db810a0e3a4a100b56c1cde18f29b863bafd6921` | equals main |
| Sha found inside the site's own served `/_next/` scripts, each size | `db810a0e3a4a100b56c1cde18f29b863bafd6921` | the db810a0 build |

#547's own commit is `e51cda0`; the two commits above it on main are docs only (`git log -- conestruct/site` ends at `e51cda0`).

## Result per size

| Check | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| Largest px difference from the local walk, any box, any state | 0 | 0 | 0 |
| Floating list's HTML and `display` the same as the local walk | 3 of 3 states | 3 of 3 states | 3 of 3 states |
| Every recorded value the same as the local walk | 3 of 3 states | 3 of 3 states | 3 of 3 states |
| Map, search row, right panel and bar boxes the same in all three states | yes | yes | yes |
| axe on `[role=dialog]`, per state | 0, 0, 0 | 0, 0, 0 | 0, 0, 0 |
| Console errors | 0 | 0 | 0 |
| Verdict (17 named checks in `results.json` `verdict`) | PASS, 0 failed | PASS, 0 failed | PASS, 0 failed |

"Every recorded value" is the local walk's own set: the boxes of the map, the search row, the right panel, the bar, the map column, the dialog and the floating list (x, y, w, h in the dialog's own frame), the list's `outerHTML`, `display` and child count, the body's scroll height, the bar's text and the column's flow. The comparison is `walk547.mjs --compare`'s, run inside the script (`vsLocal` in `results.json`). Nothing differed, so there is no difference to report.

## The values measured on the live site

One window per size, three states: open /sandbox and "Pick on map" (no line); search `Lafayette, CO` (the coarse-match notice); search `139.7401, -104.9811` (the out-of-range line).

| Size | Map | Search row | Right panel | Bar | List with the notice | List with the out-of-range line |
|---|---|---|---|---|---|---|
| 1440x900 | 1, 163.25, 822 x 532.75 | 1, 86.75, 822 x 76.5 | 823, 86.75, 456 x 653.25 | 1, 696, 822 x 44 | 694.16 x 35.5 at 21, 151.25 | 694.16 x 35.5 at 21, 151.25 |
| 1198x930 | 1, 163.25, 620.19 x 559.75 | 1, 86.75, 620.19 x 76.5 | 621.19, 86.75, 456 x 680.25 | 1, 723, 620.19 x 44 | 492.34 x 53 at 21, 151.25 | 492.34 x 35.5 at 21, 151.25 |
| 390x844 | 1, 183.5, 388 x 371.36 | 1, 107, 388 x 76.5 | 1, 598.86, 388 x 125.25 | 1, 554.86, 388 x 44 | 260.16 x 70.5 at 21, 171.5 | 260.16 x 35.5 at 21, 171.5 |

These are `../issue-547/walk.md`'s numbers, cell for cell.

The floating list's HTML, the same at every size:

| State | `display` | HTML |
|---|---|---|
| No line | `none` (no box) | `<div class="mw-search-list" role="status" data-testid="search-list"></div>` |
| The notice | shown, 1 child | `<div class="mw-search-list" role="status" data-testid="search-list"><p class="mw-note mw-search-line">That search found a town or area. Tap the map on the road where the work starts.</p></div>` |
| Out of range | shown, 1 child | `<div class="mw-search-list" role="status" data-testid="search-list"><p class="mw-note mw-note-fail mw-search-line">Latitude must be between -90 and 90</p></div>` |

Also the same in all three states at each size: the dialog (1280 x 810, 1078.19 x 837, 390 x 844), the body's scroll height (653, 680, 640), the bar's text ("No pin yet") and the column's flow (search row, map, bar). Inter was loaded at every size.

## Which code the live site served

- Scripts naming `bearingWarning`: 0 of 14 at each size (14 loaded from the site's `/_next/`, 14 read).
- That count alone does not tell the builds apart on the live site. A production build renames local variables: `coarseNotice`, the state beside the deleted one and still in the source, is also named in 0 of 14. The local walk's control (`coarseNotice` in 1 script) worked only because a dev build keeps names.
- The controls used here are two string literals, which a production build keeps: the notice's text "That search found a town or area" is in 1 of 14 scripts at each size, and the class `mw-search-list` in 1 of 14. So the map window's script was among those read.
- A string that does tell the builds apart (`slot-count.json`, `script/count-slot-547-prod.mjs`, 1440x900, the window opened, no search): the deleted slot was `<p className="mw-note mw-search-line">`, the same class string as the notice's line, so `LocationPickerModal.tsx` holds `"mw-note mw-search-line"` twice at `e51cda0~1` and once at `e51cda0` (counted with `git show`). The one served script that holds the notice's text holds that string 1 time, and the 14 scripts together hold it 1 time.
- The deleted state had had no words since #507, so its line could not be made to show before the fix either; the live walk cannot show its absence on the screen, only that the three states that can show are unchanged.

## Console, requests, token

- Console errors and page errors: 0 at every size. No Mapbox telemetry `ERR_NAME_NOT_RESOLVED` in this run.
- HTTP 429 responses: 0.
- Non-GET requests to the site in the walk, each size: 1 POST `/api/geocode` (the town search; the out-of-range input never reached the geocoder). 0 POST `/api/road-bearing`. Nothing else. 3 geocode requests in all. The second read sent 0 non-GET requests.
- Failed requests (not console errors): `api.mapbox.com net::ERR_ABORTED` 22 / 16 / 5 (aborted Mapbox requests; the cause was not looked into). None to `www.conestruct.com`. Failed requests were not recorded in the second read.
- The token in the page: 3 checks per size (the page's HTML, its text, what it stored, its cookies, once per state), 0 hits for the token's value or the gate header's name.
- The token in files (`token-scan.json`, run by `script/scan-token.mjs` after this file was written): 0 hits for the token's value and 0 for the gate header's name in every file of this folder, the extras folder and the scratch folder, the PNG crops' bytes included.

## Retries and oddities

- One run of each script; no retry, no earlier run.
- `/api/version` answered `db810a0` on the first poll.

## Defects

None found. No issue filed.

## Not measured

- The base code on the live site: there is no "before" here. The comparison is with the local walk's after run, whose numbers equal its before run (`../issue-547/walk.md`).
- The bearing note itself: nothing sets it, before or after.
- A pin, the road lookup, the "Did you mean" choice, bracketed coordinates, the attribution, closing the window: not part of #547; the previous production check (`../../ux-map-window-tidy/prod-check/outcome.md`) covers them on `20f88a9`.
- 44 px control sizes and contrast: not re-measured.
- axe outside the dialog.
- Pixel comparison of the crops with the local walk's crops: the boxes and HTML were compared, not the images (live map tiles differ run to run).
- Console and failed requests in the second read (`count-slot-547-prod.mjs` records only the scripts and the non-GET count).
- Widths other than the three; signed-in sessions; other browsers; DPR above 1.

## Evidence

- `script/walk-547-prod.mjs`, `script/count-slot-547-prod.mjs`, `script/scan-token.mjs`, `run.log`, `results.json`, `slot-count.json`, `token-scan.json`.
- `crops/prod-{1440,1198,390}-coarse-notice.png`: the search row, the notice in the floating list and 150 px under the row.
- `crops/prod-{1440,1198,390}-out-of-range.png`: the same cut with the out-of-range line.
- 3 more crops (`prod-{1440,1198,390}-no-line.png`, the same cut with no line) are in `validation-artifacts-extra/coords-wrong-pin/prod-check/` in the main checkout (untracked).

Every browser the scripts started was closed (no Chromium process left after the runs). No dev server was started.
