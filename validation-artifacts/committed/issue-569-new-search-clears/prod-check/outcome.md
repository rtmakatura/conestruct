# #569 production check on main `029b982`

Run 2026-11-25, after SHIP VERIFIED. The real site (https://www.conestruct.com/sandbox) and backend, headless Chromium, read-only: nothing saved, nothing stubbed. Script: `script/walk-569-prod.mjs`. Results: `results.json`, `run.log`.

**PASS at 1440x900, 1198x930 and 390x844: 41 checks per size, 0 failed, one run.** Backend healthz sha and the served `/api/version` sha both equal `029b982`. Console errors 0. axe on the window, with the 30 m notice and with the town notice: 0 violations. Token scan of this folder: 12 files, 0 hits (`token-scan.json`).

## What was checked, per size

| Step | Result |
| --- | --- |
| `1437 Bannock St, Denver` | The 30 m notice's two lines over the lookup's roads; the bar "Pin at 39.7392, -104.9910"; one map marker. The notice's ground is `rgb(29, 44, 60)` (`--pri-off`, read from the page), border 0 px, first line weight 600. "Tap the map to move it." is not shown |
| A road picked | The first row is picked and "Save and close" is enabled |
| `Lafayette, CO` | The box's two town lines. The bar "No pin yet"; no 30 m notice; no road rows; no "At your pin."; Save disabled; no map marker; no road lookup sent for the town; no other "tap the map" line. The town box's ground, border and first-line weight equal the 30 m notice's |
| Bannock again, then `139.7401, -104.9811` (refused) | The box's latitude line; the same six no-pin checks pass |
| `39.7401, -104.9811` | Its own roads, no 30 m notice, the bar "Pin at 39.7401, -104.9811", the box empty, "Tap the map to move it." shown |
| The same pair again | No new lookup; the pin and the picked road stay |
| Bannock again, then a tap at the same point | 0 roads and the lookup's own message; "Tap the map to move it." not shown; "At your pin." shown |

Crops: `crops/prod-<width>-1-bannock.png` (the right panel), `crops/prod-<width>-2-lafayette.png` (the right panel), `crops/prod-<width>-2-lafayette-window.png` (the whole window).

## Notes

- The first start of the script stopped at its own sha gate before opening the site: it was given the 7-character sha and healthz answers the full one. Started again with the full sha; no check was changed.
- Failed requests recorded: `api.mapbox.com net::ERR_ABORTED` only (tile requests dropped as the camera flies), 63/63/28, as in earlier checks. The four geocode requests per size answered 200.
- Not checked live: a failed geocode (no match, no answer) and a weak match after a pin; the mounted tests cover them. A marked cross street being cleared (near-intersection plans) is not covered by a test or by this check.
- Seen, not changed: after a town search the "Where the work starts" heading has no line under it (both lines are hidden while the box shows, by #567).
