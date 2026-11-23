# #544 local walk

`next dev` on the worktree (port 3544, the main checkout's `.env.local`, live Mapbox, live Overpass), headless Chromium, 2026-11-22. Script: `walk-script/walk544.mjs` (adapted from #543's `walk543.mjs`; server: `walk-script/launch-site.cjs`). Raw numbers: `shots/walk.json`. Boxes are x, y, w, h in the dialog's own frame.

Two windows per size, each opened from /sandbox with "Pick on map" (no pin):

- A: type `-104.9811, 39.7401`, Enter: the choice shows. Then type `(39.7401, -104.9811)`, Enter.
- B: type `[39.7401, -104.9811]`, Enter.

## Bracketed coordinates place the pin

| Size | Typed | Bar after Enter | Map centre, zoom | POSTs to `/api/geocode` | POSTs to `/api/road-bearing` |
|---|---|---|---|---|---|
| 1440x900 | `(39.7401, -104.9811)` | Pin at 39.7401, -104.9811 | -104.9811, 39.7401, 16 | 0 | 1 |
| 1440x900 | `[39.7401, -104.9811]` | Pin at 39.7401, -104.9811 | -104.9811, 39.7401, 16 | 0 | 1 |
| 1198x930 | `(39.7401, -104.9811)` | Pin at 39.7401, -104.9811 | -104.9811, 39.7401, 16 | 0 | 1 |
| 1198x930 | `[39.7401, -104.9811]` | Pin at 39.7401, -104.9811 | -104.9811, 39.7401, 16 | 0 | 1 |
| 390x844 | `(39.7401, -104.9811)` | Pin at 39.7401, -104.9811 | -104.9811, 39.7401, 16 | 0 | 1 |
| 390x844 | `[39.7401, -104.9811]` | Pin at 39.7401, -104.9811 | -104.9811, 39.7401, 16 | 0 | 1 |

Each size sent 0 POSTs to `/api/geocode` over both windows (`totalPosts` in `walk.json`), the swapped search included. The box keeps the text as typed, brackets and all. Window B's bar read "No pin yet" before its search.

Crops: `shots/<size>-brackets-round.png`, `shots/<size>-brackets-square.png`, and the whole window as `…-window.png`.

## The "Did you mean" choice

The numbers and the question mark are one span, `white-space: nowrap`. Lines are counted as the distinct tops of the text's rects.

| Size | Choice button | Lines in the choice | Lines the numbers take | The whole sentence, one line | Room for text in the button |
|---|---|---|---|---|---|
| 1440x900 | 692.16 x 44 | 1 | 1 | 237.17 | 668.16 |
| 1198x930 | 490.34 x 44 | 1 | 1 | 237.17 | 466.34 |
| 390x844 | 258.16 x 44 | 2 | 1 | 237.17 | 234.16 |

At 390 the whole sentence is 3.01 px wider than the room in the button (237.17 against 234.16), so the choice is two lines: "Did you mean", then "39.7401, -104.9811?" whole (`shots/390-did-you-mean.png`). The button stays 44 px high. The text is Inter 13.5 px at every size.

### The control: the same choice with the rule switched off

The walk adds `.map-window .mw-search-pair { white-space: normal !important; }` to the page, measures, and takes it out again.

| Size | Lines the numbers take, rule off | Lines the numbers take, rule back on |
|---|---|---|
| 1440x900 | 1 | 1 |
| 1198x930 | 1 | 1 |
| 390x844 | 2 | 1 |

With the rule off at 390 the numbers break after "39.7401," as they did on #541 (`shots/390-did-you-mean-rule-off.png`; #541's own crop is `validation-artifacts/committed/missions/ux-coords-in-search/issue-541/shots/390-did-you-mean.png`).

## The size check: 0 px

The largest change in any of x, y, w, h between no pin and the choice shown:

| Size | Map | Search row | Right panel | Bar | Map column | Dialog | Scroll height |
|---|---|---|---|---|---|---|---|
| 1440x900 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1198x930 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 390x844 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The boxes, the same with the choice not shown and shown:

| Size | Map | Search row | Right panel | Bar |
|---|---|---|---|---|
| 1440x900 | 1, 163.25, 822 x 532.75 | 1, 86.75, 822 x 76.5 | 823, 86.75, 456 x 653.25 | 1, 696, 822 x 44 |
| 1198x930 | 1, 163.25, 620.19 x 559.75 | 1, 86.75, 620.19 x 76.5 | 621.19, 86.75, 456 x 680.25 | 1, 723, 620.19 x 44 |
| 390x844 | 1, 183.5, 388 x 371.36 | 1, 107, 388 x 76.5 | 1, 598.86, 388 x 125.25 | 1, 554.86, 388 x 44 |

The floating list with the choice in it is `position: absolute` and 46 px high at every size.

## axe

Run on the dialog in four states per size (no pin, the choice shown, the pin from round brackets, the pin from square brackets): 0 violations in all 12.

## The 44 px measure

Every control in the search row, its floating list and the bar, over the four states: no control is under 44 px either way. The narrowest is the Search button, 79.84 x 44.5 at every size. The lowest is the choice, 44 px high at every size (692.16 x 44, 490.34 x 44 and 258.16 x 44). The search box is 44.5 px high.

The walk also lists every shown control in the dialog under 44 px either way. All are Mapbox's own, on the map, and none is touched by this item:

| Size | Under 44 px |
|---|---|
| 1440x900 | the attribution links "© Mapbox" 54.88 x 14, "© OpenStreetMap" 96.89 x 14, "Improve this map" 99.36 x 14, "© Maxar" 45.52 x 14; the "Mapbox homepage" link 88 x 23 |
| 1198x930 | the "Toggle attribution" button 24 x 24; the "Mapbox homepage" link 88 x 23 |
| 390x844 | the "Mapbox homepage" link 88 x 23 |

The "Toggle attribution" button is ruling 4's item in this mission, not this one.

## Runs

Run 1's crops and log are kept, uncommitted, in `validation-artifacts-extra/ux-map-window-tidy/issue-544/run1/` in the main checkout. Run 1 counted the numbers' lines with `getClientRects()` on the span, which gave 2 for text on one line; the script now counts distinct tops, and run 2 (the one committed here) is the whole walk again. The site's code was the same in both runs.
