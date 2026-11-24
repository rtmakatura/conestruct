# #565 local walk

`next dev` on the worktree (port 3565, the main checkout's `.env.local`), headless Chromium, 2026-11-24. Script: `walk-script/walk565.mjs` (adapted from #543's `walk543.mjs`; server: `walk-script/launch-site.cjs`). Raw numbers: `shots/walk.json`. Boxes are x, y, w, h in the dialog's own frame.

**Stubbed in the browser:** `/api/geocode` and `/api/road-bearing` are answered by the script (`page.route`), so no geocoder and no road service was called. The geocoder stub gives each message's real answer shape (a town: `placeType: "place"`; a weak match: `weak: true` with #554's Holly place name; 404 `check spelling`; 422 `outside colorado`). The road stub answers with two roads. The map's tiles are live Mapbox.

One window per size: open /sandbox, "Pick on map" (no pin). Then ten measured states:

1. `no-pin`: no message.
2. `town`: `Lafayette, CO`.
3. `weak-match`: `39 N, 44.4`.
4. `out-of-range`: `139.7401, -104.9811` (never sent).
5. `did-you-mean`: `-104.9811, 39.7401` (never sent).
6. `no-match`: `Lafayete, CO`.
7. `outside-colorado`: `Cheyenne, WY`.
8. `searching`: a new search held open.
9. `pin`: the town again, then a tap on the middle of the map.
10. `pin-weak-match`: a weak match with the pin and its two roads there.

Last, "Did you mean" is searched again and the button pressed.

## The size check: 0 px

The largest change in any of x, y, w, h across all ten states:

| Size | Map | Search row | Bar under the map | Footer | Head | Map column | Dialog |
|---|---|---|---|---|---|---|---|
| 1440x900 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1198x930 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 390x844 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The boxes, the same in every state:

| Size | Map | Search row | Bar | Footer |
|---|---|---|---|---|
| 1440x900 | 1, 163.25, 822 x 532.75 | 1, 86.75, 822 x 76.5 | 1, 696, 822 x 44 | 1, 740, 1278 x 69 |
| 1198x930 | 1, 163.25, 620.19 x 559.75 | 1, 86.75, 620.19 x 76.5 | 1, 723, 620.19 x 44 | 1, 767, 1076.19 x 69 |
| 390x844 | 1, 183.5, 388 x 371.36 | 1, 107, 388 x 76.5 | 1, 554.86, 388 x 44 | 1, 747.25, 388 x 95.75 |

The map, search row and bar boxes are the ones #543's walk recorded (`validation-artifacts/committed/missions/ux-map-window-tidy/issue-543/walk.md`), so taking the list element out of the search box moved nothing.

The right panel: at 1440 and 1198 its own box doesn't change in any state (823, 86.75, 456 x 653.25 and 621.19, 86.75, 456 x 680.25); its content shifts down under the box, as ruling 3 expects. At 390 the panel is below the map; its x, y and width don't change, and its height grows with what it holds (125.25 with no message, 264.25 to 308.75 with a message, 450 with a message over the road list). Nothing above it moves.

## Nothing over the map

In every state at every size: no element of the window outside the map is positioned over it (the script lists every `position: absolute` or `fixed` element that overlaps the map: none), the map column holds no live region, and the box and the map overlap by 0 px². The map column's flow is `mw-search`, `picker-map`, `mw-cbar` throughout.

## The box

`[data-testid=search-feedback]`, `role="status"`, inside `.mw-rail`. Ground `rgb(29, 44, 60)` (`--pri-off`). Lines 13.5 px, in the window heading's own font family at every size. First line 600, `rgb(234, 240, 247)` (`--ink`), 12.39:1 on the ground. Second line 400, `rgb(200, 209, 221)` (`--ink-on-dark`), 9.22:1. The "Did you mean" button's text, `rgb(52, 169, 232)` (`--act`), 5.4:1.

| State | Lines | Box at 1440 and 1198 | Box at 390 |
|---|---|---|---|
| town | "That search found a town or area, not a street." / "Tap the map on the road where the work starts. The roads near your tap show up here." | 407 x 88.75 | 340 x 88.75 |
| weak match | "Closest match: 39 North Main Street, Holly, Colorado 81047." / "Check the pin before you go on." | 407 x 88.75 | 340 x 88.75 |
| out of range | "Latitude must be between -90 and 90" | 407 x 44.25 | 340 x 44.25 |
| "Did you mean" | the button "Did you mean 39.7401, -104.9811?" | 407 x 68 | 340 x 68 |
| no match | "No match in Colorado for that city." / "Check the spelling." | 407 x 68.5 | 340 x 68.5 |
| outside Colorado | "Plans cover Colorado roads only." | 407 x 44.25 | 340 x 44.25 |

The text in the box equals the expected lines in all six states at all three sizes. The box is at y 137.25 in the panel at 1440 and 1198, under "Which road is the work on?". With no pin the section reads: the question, the box, "Tap the map to find the roads.". With a pin: the question, the box, the road list.

At 390 the box is at y 650.36 to 739.11 on the screen with the window not scrolled, above the footer's top edge (747.25): the whole box shows without scrolling in all six states.

The box goes away: while a new search runs (`searching`: no box, and at 390 the panel is back to 125.25), after the tap on the map (`pin`: "Pin at ...", the two roads listed, no box), and after the "Did you mean" button is pressed (the pin at 39.7401, -104.9811, no box).

Requests the stubs saw per size: 6 to `/api/geocode` (town, weak match, no match, outside Colorado, the held search, the weak match with the pin) and 2 to `/api/road-bearing` (the tap, the button). Out of range and "Did you mean" sent none.

## 44 px

Every control in the window outside the map, in all ten states: none under 44 in either direction (smallest 44 x 44, the Close button).

| Control | 1440 | 1198 | 390 |
|---|---|---|---|
| "Did you mean 39.7401, -104.9811?" | 375 x 44 | 375 x 44 | 308 x 44 |
| search box | 694.2 x 44.5 | 492.39 x 44.5 | 260.2 x 44.5 |
| "Search" | 79.8 x 44.5 | 79.8 x 44.5 | 79.8 x 44.5 |
| road rows | 407 x 64 | 407 x 64 | 340 x 64 |
| "Cancel" / "Save and close" | 78.98 x 44 / 146.81 x 44 | the same | the same |

On the map: zoom in and zoom out are 44 x 44 at every size. Mapbox's own attribution button measured 0 x 0 (not shown) at 1440, 24 x 24 at 1198 and 44 x 44 at 390; it is Mapbox's, not changed here, and is the open question in #505 (not a ruled exception).

The search box's width above is its resting width. While "Searching…" shows it is narrower (660.47 / 458.66 / 226.47 in `shots/walk.json`); the search row's outer box doesn't move, and this is the same before this change.

The crops are in the fallback face, not Inter: the dev server served `__Inter_Fallback`, and the script's `inter: true` check matches that name, so it proves nothing about Inter. Wrap points may differ under the real face; Ryan's preview check is the Inter check.

## axe

On the dialog, in each of the ten states at each size: 0 violations (30 runs).

## Crops (`shots/`)

Each `<size>-<state>.png` is the right panel alone; `<size>` is 1440, 1198 or 390.

| File | Shows |
|---|---|
| `<size>-no-pin.png` | the panel with no message: as before, no road section |
| `<size>-town.png` | the question, the town box, "Tap the map to find the roads." |
| `<size>-town-window.png` | the whole window with the town box: nothing over the map (at 390, the screen as the window opens, not scrolled) |
| `<size>-weak-match.png` | the weak-match box |
| `<size>-out-of-range.png` | the out-of-range box, one line |
| `<size>-did-you-mean.png` | the "Did you mean" button in the box |
| `<size>-no-match.png` | the no-match box |
| `<size>-outside-colorado.png` | the outside-Colorado box, one line |
| `<size>-pin-box-gone.png` | after the tap: the pin's roads, no box |
| `<size>-pin-weak-match.png` | a weak match with a pin: the box between the question and the road list |

Uncommitted, in `validation-artifacts-extra/ux-search-feedback-panel/issue-565/` in the main checkout: `run1/` (the first run, the same numbers) and `run2/` (whole-window shots of every state of this run).

The dev server and every browser were stopped after the walk (no `node` process naming the worktree left, port 3565 free, no Playwright Chromium left).
