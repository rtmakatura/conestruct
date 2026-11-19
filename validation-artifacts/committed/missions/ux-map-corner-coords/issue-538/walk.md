# #538 local walk

`next dev` on the worktree (port 3538, the main checkout's `.env.local`, live Mapbox and the local backend), headless Chromium, 2026-11-19. Script: `walk-script/walk538.mjs` (server: `walk-script/launch-site.cjs`). The camera is read from the map object itself (`getZoom()` / `getCenter()` on the window's `mapRef`, found through React's fiber tree from the `.picker-map` node), after the fly has stopped (`isMoving()` false). Raw numbers: `shots/walk.json`.

Steps at each size: open /sandbox, "Pick on map" (the state view), "Enter coordinates", Latitude 39.7401, Longitude -104.9811, Enter. Then fold-in (a): reopen the bar on the pin and press Enter with the pin's own numbers, counting `POST /api/road-bearing`.

| Size | Opening zoom / center | After Enter: zoom / center | Lookups after apply | Lookups after Enter with the pin's numbers | Bar after that Enter |
|---|---|---|---|---|---|
| 1440x900 | 6 / [-105.5, 39] | 16 / [-104.9811, 39.7401] | 1 | 1 | closed |
| 1198x930 | 6 / [-105.5, 39] | 16 / [-104.9811, 39.7401] | 1 | 1 | closed |
| 390x844 | 6 / [-105.5, 39] | 16 / [-104.9811, 39.7401] | 1 | 1 | closed |

Center is [lng, lat] to 4 places. 16 is `PIN_ZOOM`, the zoom a precise search result flies to.

Crops (the map and the bar under it): `shots/1440-applied.png`, `shots/1198-applied.png`, `shots/390-applied.png`. Full-window shots are uncommitted, in `validation-artifacts-extra/ux-map-corner-coords/issue-538/` in the main checkout.

The dev server and every browser were stopped after the walk (no `node` process naming the worktree left, port 3538 free).
