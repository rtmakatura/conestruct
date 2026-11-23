# #541 local walk

`next dev` on the worktree (port 3541, the main checkout's `.env.local`, live Mapbox, live Overpass and the local backend), headless Chromium, 2026-11-22. Script: `walk-script/walk541.mjs` (server: `walk-script/launch-site.cjs`). Raw numbers: `shots/walk.json`. Boxes are in the dialog's own frame. The camera is read from the map object itself (`getZoom()` / `getCenter()` on the window's `mapRef`, as #538's walk did) after the fly has stopped.

## Part A: the states, one window per size

Open /sandbox, "Pick on map" (no pin). Type `139.7401, -104.9811`, Enter (out of range). Type `-104.9811, 39.7401`, Enter ("Did you mean"). Press the choice (pin).

### The size check: nothing moves

Distinct boxes after the first, across the four states (no pin, out of range, "Did you mean", pin). 0 means every state has the same x, y, w and h.

| Size | Map | Right panel | Bar | Search row | Dialog |
|---|---|---|---|---|---|
| 1440x900 | 0 (822 x 532.75 at 1, 163.25) | 0 (456 x 653.25 at 823, 86.75) | 0 (822 x 44 at 1, 696) | 0 | 0 |
| 1198x930 | 0 (620.19 x 559.75 at 1, 163.25) | 0 (456 x 680.25 at 621.19, 86.75) | 0 (620.19 x 44 at 1, 723) | 0 | 0 |
| 390x844 | 0 (388 x 371.36 at 1, 183.5) | position 0 (at 1, 598.86, 388 wide); see below | 0 (388 x 44 at 1, 554.86) | 0 | 0 |

At 390 the window is one column and the right panel sits under the bar. Its x, y and width are the same in all four states. Its height is 125.25 in the three states with no pin and 341.25 with the pin, because the road list loads inside it (the same on the base code); nothing above it moves. With the error line or the choice showing, every box at every size is the same as with no pin.

The bar is 44 px in every state at every size, in Inter at 13.5 px (`--fs-body-value`). It holds 0 controls (no button, input, link, form or tab stop) in every state. With a pin the numbers have `user-select: all`.

### The floating list

| Size | Out of range | "Did you mean" |
|---|---|---|
| 1440x900 | `position: absolute`, 694.16 x 35.5 at 21, 151.25: "Latitude must be between -90 and 90" | 694.16 x 46: "Did you mean 39.7401, -104.9811?" |
| 1198x930 | 492.34 x 35.5 at 21, 151.25 | 492.34 x 46 |
| 390x844 | 260.16 x 35.5 at 21, 171.5 | 260.16 x 46 |

The list is the search box's width and starts 4 px under it, over the top 23.5 px (34 px with the choice) of the map; it does not reach the map's zoom control. With no line it is not rendered (`display: none`).

Taking the choice: 0 POSTs to `/api/geocode`, `/api/road-bearing` POSTs 0 -> 1, the map at zoom 16, the box reads `39.7401, -104.9811`, the bar "Pin at 39.7401, -104.9811", at all three sizes.

### 44 px

Every control in the search row and its list, in all four states:

| Control | 1440 | 1198 | 390 |
|---|---|---|---|
| search box | 694.16 x 44.5 | 492.34 x 44.5 | 260.16 x 44.5 |
| "Search" | 79.84 x 44.5 | 79.84 x 44.5 | 79.84 x 44.5 |
| "Did you mean 39.7401, -104.9811?" | 692.16 x 44 | 490.34 x 44 | 258.16 x 44 |

Smallest width: 79.84 (the Search button, 79.84 x 44.5). Smallest height: 44 (the "Did you mean" choice). No control is under 44. The bar has no control to measure.

### axe

On the dialog, in each state at each size: 0 violations (12 runs: no pin, out of range, "Did you mean", pin x 3 sizes).

## Part B: each accepted format, a fresh page each

Open /sandbox, "Pick on map" (the state view, zoom 6), type the text, Enter. The same result for every format at every size:

| Typed | Zoom | Center [lng, lat] | Road rows | POSTs to `/api/geocode` | `/api/road-bearing` POSTs on Enter | Bar |
|---|---|---|---|---|---|---|
| `39.7401, -104.9811` | 6 -> 16 | [-104.9811, 39.7401] | 2 | 0 | 1 | Pin at 39.7401, -104.9811 |
| `39.7401 -104.9811` | 6 -> 16 | [-104.9811, 39.7401] | 2 | 0 | 1 | Pin at 39.7401, -104.9811 |
| `39.7401,-104.9811` | 6 -> 16 | [-104.9811, 39.7401] | 2 | 0 | 1 | Pin at 39.7401, -104.9811 |
| `39.7401° N, 104.9811° W` | 6 -> 16 | [-104.9811, 39.7401] | 2 | 0 | 1 | Pin at 39.7401, -104.9811 |

12 runs (4 formats x 3 sizes), no lookup retry needed in this run. The two rows are "Pennsylvania Street at East Colfax Avenue" and "East Colfax Avenue at Pennsylvania Street" (#536's titles). 16 is `PIN_ZOOM`, #538's zoom.

An earlier run of the same walk (its crops are in `validation-artifacts-extra/ux-coords-in-search/issue-541/run1/` in the main checkout) had one of the twelve lookups unanswered by the live road service (1440, `39.7401 -104.9811`: the window showed "We couldn't look up the roads here." with Try again). The pin, the zoom and the 0 geocode POSTs were the same. The script now presses Try again when that happens and records it.

## Crops (`shots/`)

| File | Shows |
|---|---|
| `<size>-no-pin.png` | the read-only line with no pin: "No pin yet" |
| `<size>-pin.png` | the line with a pin: "Pin at 39.7401, -104.9811" |
| `<size>-out-of-range.png` | the search row and the floating line over the map |
| `<size>-did-you-mean.png` | the search row and the choice |
| `<size>-format-comma-space.png` | the whole window after `39.7401, -104.9811`: the box, the map at the pin, the road list (at 390 the list is in `390-format-comma-space-roads.png`) |
| `<size>-format-space.png`, `-format-comma.png`, `-format-degrees.png` | the same window for the other three formats, cut to the search row, the map and (two columns) the road rows; at 390 the map down past the pin. At 1440 and 1198 these six crops are cut above the pin, so the pin itself is not in them; the camera for each is in `walk.json` (zoom 16 at [-104.9811, 39.7401]) |

`<size>` is 1440, 1198 or 390. The whole-window shot of every state and every format, and at 390 the road list for the other three formats, are uncommitted in `validation-artifacts-extra/ux-coords-in-search/issue-541/` in the main checkout.

The dev server and every browser were stopped after the walk (no `node` process naming the worktree left, port 3541 free).
