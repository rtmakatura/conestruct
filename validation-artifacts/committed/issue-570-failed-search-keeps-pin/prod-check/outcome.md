# #570 production check on main `8df9e51`

Run 2026-11-25, after SHIP VERIFIED. The real site (https://www.conestruct.com/sandbox) and backend, headless Chromium, read-only: nothing saved, nothing stubbed. Script: `script/walk-570-prod.mjs`. Results: `results.json`, `run.log` (the second run; the first is `run-1-stopped.log`, see Notes).

**The fix holds at 1440x900, 1198x930 and 390x844: 64 checks per size, 63 passed, 1 failed, the same one at each size.** The failed check is "no console errors": the browser logs the geocoder's own 404 (no match) and 422 (outside Colorado) answers as console errors. Those two answers are what the check asked for; no other console error was recorded. Backend healthz sha and the served `/api/version` sha both equal `8df9e51`. axe on the window, with a failed search's box over the kept pin and with the town notice: 0 violations. Token scan of this folder: 21 files, 0 hits (`token-scan.json`).

## What was checked, per size

| Step | Result |
| --- | --- |
| A fresh window | No "Where the work starts" heading (not in the page). The bar "No pin yet". The line under the title still reads "Search an address or tap the map where the work starts, then pick the road." |
| `1437 Bannock St, Denver`, first road picked | The 30 m notice over three roads; the bar "Pin at 39.7392, -104.9910"; one map marker; the heading shows with "At your pin."; Save open |
| `qqzzxxqq vvkkjj` (geocoder 404) | The box "No match for that address". Kept: the bar, the same three rows, the pick, the 30 m notice, Save open, one marker, the heading and "At your pin."; "Tap the map to move it." not shown; no new road lookup |
| `Cheyenne, WY` (geocoder 422) | The box "Plans cover Colorado roads only."; the same nine kept checks pass |
| `139.7401, -104.9811` (refused, no request) | The box "Latitude must be between -90 and 90"; the same nine kept checks pass |
| `-104.9811, 39.7401` (swapped, no request) | The box is the button "Did you mean 39.7401, -104.9811?"; the same nine kept checks pass |
| `Lafayette, CO` | The box's two town lines. The bar "No pin yet"; no 30 m notice; no road rows; no "At your pin."; Save disabled; no map marker; no road lookup for the town; no "Where the work starts" heading; no other "tap the map" line |

Crops: `crops/prod-<width>-0-fresh-window.png` (the whole window), `crops/prod-<width>-1-no-match-kept.png` (the right panel) and `-window.png`, `crops/prod-<width>-2-lafayette.png` (the right panel) and `-window.png`.

## Notes

- **The first run stopped on the script's own example, not on the fix** (`run-1-stopped.log`, `results-1-stopped.json`). It searched `Lafayete` expecting no match. The live geocoder corrects that spelling to the town of Lafayette and answers 200 with a town. A town is a new place, so the pin was cleared, as ruling 1 says. The example was replaced with `qqzzxxqq vvkkjj`; no check was changed. For Ryan: a misspelt town that the geocoder can still recognise clears the pin like any town search.
- Failed requests recorded: `api.mapbox.com net::ERR_ABORTED` only (tile requests dropped as the camera flies), 22/63/28.
- Not checked live: a weak match, a search with no answer (network) and a 502 after a pin; the mounted tests cover them. A search still out with the old pin on screen, and a tap during it, are covered by the mounted tests only.
