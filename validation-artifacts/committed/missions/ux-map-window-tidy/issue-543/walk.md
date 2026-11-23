# #543 local walk

`next dev` on the worktree (port 3543, the main checkout's `.env.local`, live Mapbox, live geocoder, live Overpass), headless Chromium, 2026-11-22. Script: `walk-script/walk543.mjs` (adapted from #541's `walk541.mjs`; server: `walk-script/launch-site.cjs`). Raw numbers: `shots/walk.json`. Boxes are x, y, w, h in the dialog's own frame.

One window per size: open /sandbox, "Pick on map" (no pin). Type `Lafayette, CO`, Enter: one POST to `/api/geocode`, the geocoder answers with a town, the map flies to zoom 12 and the notice shows. Tap the map under the notice: a pin, one road lookup, the notice goes.

## The size check: 0 px

The largest change in any of x, y, w, h between the notice not shown (no pin) and shown:

| Size | Map | Search row | Right panel | Bar | Map column | Dialog | Scroll height |
|---|---|---|---|---|---|---|---|
| 1440x900 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1198x930 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 390x844 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The boxes, the same with the notice not shown and shown:

| Size | Map | Search row | Right panel | Bar |
|---|---|---|---|---|
| 1440x900 | 1, 163.25, 822 x 532.75 | 1, 86.75, 822 x 76.5 | 823, 86.75, 456 x 653.25 | 1, 696, 822 x 44 |
| 1198x930 | 1, 163.25, 620.19 x 559.75 | 1, 86.75, 620.19 x 76.5 | 621.19, 86.75, 456 x 680.25 | 1, 723, 620.19 x 44 |
| 390x844 | 1, 183.5, 388 x 371.36 | 1, 107, 388 x 76.5 | 1, 598.86, 388 x 125.25 | 1, 554.86, 388 x 44 |

After the tap (pin placed, notice gone) every box is the same again, except the right panel's height at 390 (125.25 to 269.25): the road list loads inside it, as on the base code and in #541's walk. Its x, y and width don't change, and nothing above it moves.

### The same walk on the base code (5ab10324), for comparison

Run before the fix, with the same script. Its output is uncommitted in `validation-artifacts-extra/ux-map-window-tidy/issue-543/before/` in the main checkout. Its numbers are committed beside this file as `before-walk.json`.

| Size | Map | Right panel | Bar | Notice |
|---|---|---|---|---|
| 1440x900 | moved 17.5 (y 163.25 to 180.75, h 532.75 to 515.25) | 0 | 0 | in the flow, 822 x 17.5 |
| 1198x930 | moved 17.5 (y 163.25 to 180.75, h 559.75 to 542.25) | 0 | 0 | in the flow, 620.19 x 17.5 |
| 390x844 | moved 35 (y 183.5 to 218.5) | moved 35 (y 598.86 to 633.86) | moved 35 (y 554.86 to 589.86) | in the flow, 388 x 35 |

## The notice in the floating list

| Size | List (`position: absolute`) | Notice | Lines | Over the top of the map |
|---|---|---|---|---|
| 1440x900 | 694.16 x 35.5 at 21, 151.25 | 692.16 x 33.5 | 1 | 23.5 px |
| 1198x930 | 492.34 x 53 at 21, 151.25 | 490.34 x 51 | 2 | 41 px |
| 390x844 | 260.16 x 70.5 at 21, 171.5 | 258.16 x 68.5 | 3 | 58.5 px |

The notice is inside `[data-testid=search-list]` at every size, in Inter at 12.5 px, colour `rgb(147, 160, 176)` (the same computed colour as on the base code). The map column's flow is `mw-search`, `picker-map`, `mw-cbar` with the notice shown and not shown. With no line the list is not rendered (`display: none`). The list is the search box's width, so it stops short of the map's zoom control.

The tap under the notice placed the pin at every size ("Pin at 40.0175, -105.0905" at 1440, "Pin at 40.0194, -105.0905" at 1198, "Pin at 40.0069, -105.0905" at 390), made one POST to `/api/road-bearing`, and the notice was gone.

## 44 px

Every control in the search row and its list, in all three states (the notice is a line of text; it adds no control):

| Control | 1440 | 1198 | 390 |
|---|---|---|---|
| search box | 694.16 x 44.5 | 492.34 x 44.5 | 260.16 x 44.5 |
| "Search" | 79.84 x 44.5 | 79.84 x 44.5 | 79.84 x 44.5 |

No control is under 44. The bar has no control.

## axe

On the dialog, in each state at each size: 0 violations (9 runs: no pin, the notice, the pin, at 3 sizes).

## The bearing note

Not walked. Nothing in the window gives it words (`rulings.md` call 1), so there is no state to open, crop or measure. Its slot's place in the list is pinned by the source test in `LocationPickerModal.coords-bar.test.tsx`.

## Crops (`shots/`)

| File | Shows |
|---|---|
| `<size>-no-notice.png` | the search row and the top of the map, no notice |
| `<size>-coarse-notice.png` | the same cut with the notice in the floating list; the map's top edge is at the same place |
| `<size>-coarse-notice-window.png` | the whole window with the notice |

`<size>` is 1440, 1198 or 390. Uncommitted, in `validation-artifacts-extra/ux-map-window-tidy/issue-543/` in the main checkout: `before/` (the base-code run), `after-run1/` (a first run on the fix whose line count wrongly included the padding; the same boxes), `after/` (whole-window shots of this run).

The dev server and every browser were stopped after the walk (no `node` process naming the worktree left, port 3543 free).
