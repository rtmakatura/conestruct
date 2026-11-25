# #568 production check on main `4894ad1`

Run 2026-11-25 (UTC), after SHIP VERIFIED. The real site (https://www.conestruct.com/sandbox) and backend, headless Chromium, read-only: nothing saved, nothing stubbed. Script: `script/walk-568-prod.mjs`. Results: `results.json`, `run.log`.

**PASS at 1440x900, 1198x930 and 390x844: 32 checks per size, 0 failed.** Backend healthz sha and the served `/api/version` sha both equal `4894ad1`. Console errors 0. axe on the window with the nearest-only list: 0 violations. Token scan of this folder: 12 files, 0 hits (`token-scan.json`).

## What was checked, per size

| Step | Result |
| --- | --- |
| No pin, no message | "Search an address or tap the map to place your pin." and "Tap the map to move it." show; the box is empty |
| Town (`Lafayette, CO`) | The box's two lines; no other "tap the map" line in the panel; "Tap the map to find the roads." is gone; no road lookup |
| Swapped pair (`-104.9811, 39.7401`) | The "Did you mean" button; no other "tap the map" line. After the press: focus in the search box, "Pin at 39.7401, -104.9811", the lookup sent `{lat, lng}` with no `reach`, 2 roads (Pennsylvania Street 1.69 m, East Colfax Avenue 4.98 m), no `nearest_only`, no nearest-only lines |
| Address (`1437 Bannock St, Denver`) | The lookup sent `reach: "address"` at 39.739247, -104.99097; HTTP 200, `scan_status` "ok", `nearest_only: true`; Cherokee Street 57.76 m, West Colfax Avenue 84.02 m, West 14th Avenue 87.22 m. The panel: "No mapped road runs within 30 m of this address." / "These are the nearest. Pick one, or tap the map on the road where the work starts.", three rows in that order with "58 / 84 / 87 m from your pin", none picked; not "We didn't find a road at your pin."; the bar "Pin at 39.7392, -104.9910". A pressed row is picked |
| A tap at the map's centre (the same point) | The lookup sent no `reach`; 0 roads, no `nearest_only`; "We didn't find a road at your pin."; no nearest-only lines. As before #568 |

Crops (the right panel): `crops/prod-<width>-town.png`, `crops/prod-<width>-address-nearest.png`.

## Notes

- Run 1 (`run-1.log`, `results-run-1.json`) passed at 1440 and 1198 (32 checks, 0 failed) and stopped at 390 on two faults of the script: the tap was aimed at a map scrolled off screen (the window's body scrolls below md), and the failure line crashed on a missing value. Run 2 changed those two things only.
- Failed requests recorded: `api.mapbox.com net::ERR_ABORTED` during the map's moves (tile requests dropped as the camera flies), as in earlier checks. No 429.
- #567 item 2 (the live region hidden while empty) and whether a screen reader announces the nearest-only lines were not checked; both are on #567.
