# #537 local walk: the coordinates bar's four states

Walked 2026-11-19 on `issue-537-coords-bar` (uncommitted work on 26df927), local `next dev` on :3537 for this worktree's site, at 1440x900, 1198x930 and 390x844 (DPR 1, Chromium via Playwright). Script `walk-script/walk537.mjs`, launcher `walk-script/launch-site.cjs` (copied from #536: the main checkout's `.env.local` read raw, nothing printed; live Overpass and the `.env.local` backend, no stubs). With a Mapbox token, so the bar starts closed. The dev server was stopped by process tree after the walk (port 3537 free, no node or Chromium left).

Order at each size: open the window (no pin) → "Enter coordinates" (editing) → "abc" / "-104.9811", Enter (error) → reopen, paste "39.7401, -104.9811" into Latitude, Enter (pin) → reopen on the pin, type 40.1 (editing over a pin) → Esc.

## The size check (`shots/walk.json`)

Boxes in the dialog's frame (viewport rect plus the body scroller's scrollTop; it stayed 0 throughout).

| Size | Map (x, y, w, h) | Rail (x, y, w, h) | Bar | Moves across the 5 states |
|---|---|---|---|---|
| 1440x900 | 1, 163.25, 822, 532.75 | 823, 86.75, 456, 653.25 | 1, 696, 822 x 44 | map 0, rail 0, bar 0 |
| 1198x930 | 1, 163.25, 620.19, 559.75 | 621.19, 86.75, 456, 680.25 | 1, 723, 620.19 x 44 | map 0, rail 0, bar 0 |
| 390x844 | 1, 183.5, 388, 371.36 | 1, 598.86, 388, (see note) | 1, 554.86, 388 x 44 | map 0, rail position 0, bar 0 |

Note at 390: the rail is stacked under the map and its height is its content's. It is 125.25 with no pin, while editing and in the error, and 341.25 once a pin has a road list (pin, and editing over that pin). Its x, y and width are the same in every state; the extra height is the road list arriving, not the bar. `walk.json` records `railMoves: 1` at 390 because its counter compares the whole box, height included; the rail's x, y and width moved 0. The two-column sizes keep the rail's whole box.

## 44 px and axe

- The bar is 44 px tall in every state at every size. Every control in it is at least 44 x 44: "Enter coordinates" 130.09 x 44, "39.7401, -104.9811" 155.06 x 44, Latitude and Longitude 264.53 / 163.63 / 88.34 x 44 (1440 / 1198 / 390), Go 44.34 x 44, Cancel 53.34 x 44.
- No box text overflows (the longitude "-104.9811" fits at 390), and no line in the bar is clipped (the no-pin line and the hint take two lines at 390, 35 px).
- axe on `[role=dialog]`: 0 violations in all 15 runs (5 states x 3 sizes). Inter loaded at every size; the bar computes Inter 13.5 px.

## Behaviour seen

- Opening editing puts focus on Latitude at every size.
- The bad entry's text is kept ("abc" is back in Latitude on reopening); the paste filled both boxes (39.7401, -104.9811).
- Esc closed the editing and left the window open at every size (the window's own Esc-to-close did not fire).
- As expected for this item, applying the pin leaves the map at the state view (#538 owns the zoom).

## Crops (committed, `shots/`)

`{1440,1198,390}-{no-pin,editing,error,pin,editing-pin}.png`: the bar with 60 px of map above it. Whole-window shots of every state are in `validation-artifacts-extra/ux-map-corner-coords/issue-537/` in the main checkout (untracked).
