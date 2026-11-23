# #548 production check: PASS (main 284cc8e), one finding filed as #554

Run 2026-11-23 21:27:44 to 21:30:18 UTC (`results.json` `ranAt`, `finishedAt`), after the ship of main `284cc8e`. https://www.conestruct.com/sandbox, the real backend, live Mapbox and the live geocoder, no stubs, read-only: nothing was saved and "Save and close" was never pressed. Headless Chromium, DPR 1, signed out, at 1440x900, 1198x930 and 390x844, one size after another. The gate token was read from `conestruct/site/.env.local` inside the script, sent by `scripts/gate.cjs` to the site's own host only, and never printed or written.

Script: `script/walk-548-prod.mjs` (the sha gate, console, failed-request, axe and token code of `../../prod-check/script/walk-547-prod.mjs`). Numbers: `results.json`. Log: `run.log`. Token scan: `token-scan.json`, run with `../../prod-check/script/scan-token.mjs`.

## Shas (checked before any browser opened)

| What | Sha | Result |
|---|---|---|
| Backend `/healthz` | `284cc8ecd7e8728c651a99cc338b559c9c204788` | equals main |
| Site `/api/version` (first poll, HTTP 200) | `284cc8ecd7e8728c651a99cc338b559c9c204788` | equals main |
| Sha found inside the site's own served `/_next/` scripts, each size | `284cc8e` | the 284cc8e build |

## What was typed, and what the live site did

One window per text, opened with "Pick on map" and closed with Escape, so every text started at "No pin yet" with 0 markers. The result was the same at all three sizes.

| Typed | `/api/geocode` requests | Bar after Enter | Search list | Markers |
|---|---|---|---|---|
| `39° 44.4` | 1 (HTTP 422) | No pin yet | "Plans cover Colorado roads only." | 0 |
| `39 N, 44.4` | 1 (HTTP 200) | Pin at 38.0534, -102.1227 | empty | 1 |
| `105° W, 39.7401` | 1 (HTTP 200) | Pin at 37.2948, -102.0419 | empty | 1 |
| `E 470 N` | 1 (HTTP 404) | No pin yet | "No match in Colorado for that address. Check the spelling." | 0 |
| `39.7401, -104.9811` | 0 | Pin at 39.7401, -104.9811 | empty | 1 |
| `39° 44.406' N, 104° 58.866' W` | 0 | Pin at 39.7401, -104.9811 | empty | 1 |
| `-104.9811, 39.7401` | 0 | No pin yet | the choice "Did you mean 39.7401, -104.9811?" | 0 |

- `39° 44.4` is searched and places no pin. On the base it was a pin at 39, 44.4 with no warning. This is #548's fix, seen on the live site.
- The four searched texts each sent exactly one geocode request. None got one of the search box's own lines (a range line, the choice, or the deleted "Use decimal degrees" line).
- The two full pairs placed the pin with no geocode request. The swapped pair offered the choice and placed no pin.
- The deleted line's words "Use decimal degrees" are in 0 of the 14 scripts served from the site's `/_next/` at each size. The control, "Did you mean", is in 1 of 14.

## Finding (filed as #554, not a #548 defect)

`39 N, 44.4` and `105° W, 39.7401` go to the geocoder as ruled, and the live geocoder answers each with a place in southeast Colorado, which the window pins with an empty search list: no notice that the match is a guess. Neither pin is at the old wrong place (39, 44.4 or 39.7401, -105). What the geocoder returned for them (match type, place name) was not recorded here. #554 asks Ryan for a ruling.

## Result per size

| Check | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| axe on `[role=dialog]`, per text (7) | 0 each | 0 each | 0 each |
| Console errors | 2 | 2 | 2 |
| HTTP 429 | 0 | 0 | 0 |
| POST `/api/geocode` / POST `/api/road-bearing` | 4 / 4 | 4 / 4 | 4 / 4 |
| Token in the page (7 checks) | 0 hits | 0 hits | 0 hits |
| Verdict (18 named checks in `results.json` `verdict`) | PASS, 0 failed | PASS, 0 failed | PASS, 0 failed |

- The 2 console errors per size are Chromium's "Failed to load resource" for the two geocoder answers that are not HTTP 200 (the 422 for `39° 44.4`, the 404 for `E 470 N`). Any search with no match in Colorado logs the same line; the page shows the geocoder's sentence. No page error, no other console error.
- Non-GET requests to the site: the 4 geocode requests and 4 road lookups (one per pin placed). Nothing else.
- Failed requests (not console errors): `api.mapbox.com net::ERR_ABORTED` 89 / 120 / 52 (aborted map tile requests as each window closed or the map moved; the cause was not looked into). None to `www.conestruct.com`.
- The token in files (`token-scan.json`, the second scan, run after this file was written): 49 files in this folder and the extras folder, the PNG crops' bytes included; 0 hits for the token's value, 0 for the gate header's name.

## Runs

Two runs. The first (`run-1.log`, `results-1.json`, 21:24:40 to 21:27:19 UTC) measured the same things on the page and ended "overall: FAIL" on three of the script's own checks, which were wrong: they required HTTP 200 from the geocoder, counted the geocoder's "no match" sentence as a refusal line, and counted the two "Failed to load resource" lines as console errors. The script was corrected to accept the geocoder's 404 and 422 answers, to look for the search box's own lines only, and to count those two console lines separately and match them to the statuses. No other change. The second run is the one reported above. The page's behaviour was the same in both runs, row for row.

## Not measured

- The base on the live site: there is no "before" here. The base's reading of each text is in `../red-proof.txt` and `../rulings.md`.
- Box positions and pixel comparisons: #548 adds nothing visible, so there was no local walk to compare with.
- Every other example in #548, #550, #551 and #552: the parser and mounted tests cover them; this walk typed seven texts.
- What the geocoder returned for the two loose matches (see #554).
- 44 px control sizes and contrast; axe outside the dialog; widths other than the three; signed-in sessions; other browsers; DPR above 1.

## Evidence

- `script/walk-548-prod.mjs`, `run.log`, `results.json`, `run-1.log`, `results-1.json`, `token-scan.json`.
- `crops/prod-{1440,1198,390}-half-coord.png`: the search row with `39° 44.4`, the geocoder's line under it, and no pin on the map below.
- `crops/prod-{1440,1198,390}-dms-pair.png`: the search row with the degrees-minutes pair and the map moved to its place (the pin itself is below the cut; the bar text and marker count are in `results.json`).
- 36 more crops (the other five texts' search rows, and the whole window for all seven) are in `validation-artifacts-extra/coords-wrong-pin/issue-548/prod-check/` in the main checkout (untracked).

Every browser the script started was closed (no Playwright process left after the runs). No dev server was started.
