# #554 (with #553) production check: PASS (main 5d89bb5)

Run 2026-11-24 04:12:39 to 04:14:42 UTC (`results.json` `ranAt`, `finishedAt`), after the ship of main `5d89bb5`. https://www.conestruct.com/sandbox, the real backend, live Mapbox and the live geocoder, no stubs, read-only: nothing was saved and "Save and close" was never pressed. Headless Chromium, DPR 1, signed out, at 1440x900, 1198x930 and 390x844, one size after another. The gate token was read from `conestruct/site/.env.local` inside the script, sent by `scripts/gate.cjs` to the site's own host only, and never printed or written.

Script: `script/walk-554-prod.mjs` (the sha gate, console, failed-request, axe and token code of `validation-artifacts/committed/missions/coords-wrong-pin/issue-548/prod-check/script/walk-548-prod.mjs`). Numbers: `results.json`. Log: `run.log`. Token scan: `token-scan.json`, run with `script/scan-token.mjs`. One run; the script was not changed after it.

## Shas (checked before any browser opened)

| What | Sha | Result |
|---|---|---|
| Backend `/healthz` | `5d89bb5e1a3fe4354dacefefcacdd2516ccfdb49` | equals main |
| Site `/api/version` (first poll, HTTP 200) | `5d89bb5e1a3fe4354dacefefcacdd2516ccfdb49` | equals main |
| Sha found inside the site's own served `/_next/` scripts, each size | `5d89bb5` | the 5d89bb5 build |

## What was typed, and what the live site did

One window per text, opened with "Pick on map" and closed with Escape, so every text started at "No pin yet" with 0 markers. The result was the same at all three sizes.

| Typed | `/api/geocode` | Road lookups | Bar after Enter | Search list | Markers |
|---|---|---|---|---|---|
| `39 N, 44.4` | 1 (HTTP 200) | 0 | No pin yet | "Closest match: 39 North Main Street, Holly, Colorado 81047. Check the pin before you go on." | 0 |
| `105° W, 39.7401` | 1 (HTTP 200) | 0 | No pin yet | "Closest match: W Boulevard, Walsh, Kansas 81090. Check the pin before you go on." | 0 |
| `Lafayette, CO` | 1 (HTTP 200) | 0 | No pin yet | "That search found a town or area. Tap the map on the road where the work starts." | 0 |
| `1437 Bannock St, Denver` | 1 (HTTP 200) | 1 | Pin at 39.7392, -104.9910 | empty | 1 |
| `39.7401, -104.9811` | 0 | 1 | Pin at 39.7401, -104.9811 | empty | 1 |
| `39° 44.' N, 104° 58.' W` (#553) | 1 (HTTP 404) | 0 | No pin yet | "No match in Colorado for that address. Check the spelling." | 0 |

- #554: the two texts the issue reports get the notice, word for word, with the place the probe recorded. No pin, no marker and no road lookup. Before the ship they pinned at 38.0534, -102.1227 and 37.2948, -102.0419 with an empty list (`validation-artifacts/committed/missions/coords-wrong-pin/issue-548/prod-check/outcome.md`).
- The town search keeps the town notice. The street address and the decimal pair pin as before, with no notice.
- #553: minutes written `44.` are searched, not read as a pair. The geocoder has no match, so no pin.
- The notice's words "Closest match: " are in 1 of the scripts served from the site's `/_next/` at each size (14, 14 and 13 scripts read).

## Result per size

| Check | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| axe on `[role=dialog]`, per text (6) | 0 each | 0 each | 0 each |
| Console errors | 1 | 1 | 1 |
| HTTP 429 | 0 | 0 | 0 |
| POST `/api/geocode` / `/api/road-bearing` / `/api/render/corridor-geometry` | 5 / 2 / 1 | 5 / 2 / 1 | 5 / 2 / 1 |
| Token in the page (6 checks) | 0 hits | 0 hits | 0 hits |
| Verdict (16 named checks in `results.json` `verdict`) | PASS, 0 failed | PASS, 0 failed | PASS, 0 failed |

- The 1 console error per size is Chromium's "Failed to load resource" for the geocoder's 404 answer to the #553 text. The page shows the geocoder's sentence. No page error, no other console error.
- Non-GET requests to the site: the 8 in the table. Nothing else.
- Failed requests (not console errors): `api.mapbox.com net::ERR_ABORTED` 101 / 44 / 33 (aborted map tile requests as each window closed or the map moved; the cause was not looked into). None to `www.conestruct.com`.
- The token in files (`token-scan.json`, the second scan, run after this file was written): the files in this folder and the extras folder, the PNG crops' bytes included; 0 hits for the token's value, 0 for the gate header's name.

## Not measured

- A saved address looked up when the window opens (the second sender). The mounted tests cover it; this walk is signed out and saves nothing.
- Whether the map stayed still on a weak match, and whether it recentred for the town. The bar, the marker count and the road lookups are measured; the camera is not.
- The relevance threshold on the live geocoder: no text typed here scored under 0.9 and passed #384's refusal.
- 44 px control sizes and contrast; axe outside the dialog; widths other than the three; signed-in sessions; other browsers; DPR above 1.

## Evidence

- `script/walk-554-prod.mjs`, `script/scan-token.mjs`, `run.log`, `results.json`, `token-scan.json`.
- `crops/prod-{1440,1198,390}-weak-39n.png` and `crops/prod-{1440,1198,390}-weak-105w.png`: the search row with the typed text, the notice under it, and no pin on the map below.
- 30 more crops (the other four texts' search rows, and the whole window for all six) are in `validation-artifacts-extra/issue-554/prod-check/` in the main checkout (untracked).

Every browser the script started was closed. No dev server was started.
