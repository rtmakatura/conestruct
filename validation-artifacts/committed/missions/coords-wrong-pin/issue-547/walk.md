# #547 local walk: nothing visible changes

`next dev` on the worktree (port 3547, the main checkout's `conestruct/site/.env.local`, live Mapbox, live geocoder), headless Chromium, 2026-11-23. Script: `walk-script/walk547.mjs` (adapted from #543's `walk543.mjs`; server: `walk-script/launch-site.cjs`). Numbers: `before-walk.json` (base code) and `shots/walk.json` (the fix). Boxes are x, y, w, h in the dialog's own frame.

## Before and after

- **Before** is the same worktree before the edit. It was created at the base (65615703), and the walk ran with `git status` showing no change to any tracked file.
- **After** is the same worktree with the diff, on a restarted server.
- One window per size, three states: open /sandbox and "Pick on map" (no pin, no line); search `Lafayette, CO` (the coarse-match notice); search `139.7401, -104.9811` (the out-of-range line, "Latitude must be between -90 and 90").
- In each state the script records the floating list's `outerHTML`, its `display` and box, and the boxes of the map, the search row, the right panel, the bar, the map column and the dialog, the body's scroll height, the bar's text and the column's flow. axe runs on the dialog.
- `walk547.mjs --compare` reads the two files.

## Result

| Size | Largest px difference, any box, any state | List HTML the same | Every recorded value the same | axe, before | axe, after |
|---|---|---|---|---|---|
| 1440x900 | 0 | 3 of 3 states | yes | 0, 0, 0 | 0, 0, 0 |
| 1198x930 | 0 | 3 of 3 states | yes | 0, 0, 0 | 0, 0, 0 |
| 390x844 | 0 | 3 of 3 states | yes | 0, 0, 0 | 0, 0, 0 |

18 axe runs (3 states at 3 sizes, before and after): 0 violations.

The values, the same before and after:

| Size | Map | Search row | Right panel | Bar | List with the notice | List with the out-of-range line |
|---|---|---|---|---|---|---|
| 1440x900 | 1, 163.25, 822 x 532.75 | 1, 86.75, 822 x 76.5 | 823, 86.75, 456 x 653.25 | 1, 696, 822 x 44 | 694.16 x 35.5 at 21, 151.25 | 694.16 x 35.5 at 21, 151.25 |
| 1198x930 | 1, 163.25, 620.19 x 559.75 | 1, 86.75, 620.19 x 76.5 | 621.19, 86.75, 456 x 680.25 | 1, 723, 620.19 x 44 | 492.34 x 53 at 21, 151.25 | 492.34 x 35.5 at 21, 151.25 |
| 390x844 | 1, 183.5, 388 x 371.36 | 1, 107, 388 x 76.5 | 1, 598.86, 388 x 125.25 | 1, 554.86, 388 x 44 | 260.16 x 70.5 at 21, 171.5 | 260.16 x 35.5 at 21, 171.5 |

The map, search row, right panel and bar boxes are the same in all three states at each size. With no line the list is `display: none` with no child; with a line it has one child. These are also #543's committed numbers for the no-line and notice states (`../../ux-map-window-tidy/issue-543/walk.md`).

Inter was loaded at every size in both runs. Each window made one POST to `/api/geocode` (the town search; the out-of-range input never reaches the geocoder) and none to `/api/road-bearing`.

## Which code the after run served

The after run reads every script the page loads from `/_next/` and looks for the deleted state's name (a dev build keeps variable names). At each size: 8 scripts, 0 naming `bearingWarning`, 1 naming `coarseNotice` (the state beside it, as the control that the window's script was among those read).

The before run has no such count: the check was added to the script after it. That the name survives a dev build of the base code was seen another way: after the before run, 4 compiled files under the worktree's `conestruct/site/.next` named `bearingWarning`.

## Crops (`shots/`), from the after run

| File | Shows |
|---|---|
| `<size>-coarse-notice.png` | the search row, the notice in the floating list and the top of the map |
| `<size>-out-of-range.png` | the same cut with the out-of-range line |

`<size>` is 1440, 1198 or 390.

Uncommitted, in `validation-artifacts-extra/coords-wrong-pin/issue-547/` in the main checkout:
- `before/`: the base-code run (9 crops and `walk.json`, committed here as `before-walk.json`).
- `after/`: this run (9 crops, including the three no-line ones not committed).
- `after-run1/`: a first after run on the server the before run used, without the served-code check. The same numbers.
- `after-run2/`: a second after run on the restarted server, with the `bearingWarning` count but no control. The same numbers.

The dev server and every browser were stopped after the walk (no process whose command line names `issue-547` left, port 3547 free).
