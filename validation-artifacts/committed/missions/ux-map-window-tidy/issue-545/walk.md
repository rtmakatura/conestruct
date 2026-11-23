# #545 local walk

`next dev` on the worktree (port 3545, the main checkout's `.env.local`, live Mapbox, live Overpass), headless Chromium, DPR 1, 2026-11-22. Script: `walk-script/walk545.mjs` (adapted from #544's `walk544.mjs`; server: `walk-script/launch-site.cjs`). It ran twice:

- **Before:** on 5737d8d2's `LocationPickerModal.tsx` and `globals.css` (the two files checked out from the base, the fix restored afterwards). Raw numbers: `before/walk.json`; the script's printed lines: `before/run.log`.
- **After:** on the fix. Raw numbers: `shots/walk.json`; printed lines: `shots/run.log`.

`walk-script/compare545.mjs` then compared the two runs' attribution crops pixel by pixel: `compare.json`.

Boxes are x, y, w, h in the dialog's own frame. Four windows per size, each opened from /sandbox with "Pick on map":

- A: no pin, then `39.7401, -104.9811` in the search box (a pin), then Cancel.
- B: a pin the same way, then the Close button.
- C: a pin the same way, then Escape.
- D: no pin; the attribution.

## The bar and its mark (ruling 1)

| Size | State | Bar text | Bar box | Mark box | Mark, before | Mark, after |
|---|---|---|---|---|---|---|
| 1440x900 | no pin | No pin yet | 1, 696, 822 x 44 | 21, 713, 10 x 10 | fill `rgb(255, 138, 46)`, border 0 | no fill (`rgba(0, 0, 0, 0)`), border 2px solid `rgb(147, 160, 176)` |
| 1440x900 | pin | Pin at 39.7401, -104.9811 | 1, 696, 822 x 44 | 21, 713, 10 x 10 | fill `rgb(255, 138, 46)`, border 0 | fill `rgb(255, 138, 46)`, border 0 |
| 1198x930 | no pin | No pin yet | 1, 723, 620.19 x 44 | 21, 740, 10 x 10 | fill `rgb(255, 138, 46)`, border 0 | no fill, border 2px solid `rgb(147, 160, 176)` |
| 1198x930 | pin | Pin at 39.7401, -104.9811 | 1, 723, 620.19 x 44 | 21, 740, 10 x 10 | fill `rgb(255, 138, 46)`, border 0 | fill `rgb(255, 138, 46)`, border 0 |
| 390x844 | no pin | No pin yet | 1, 554.86, 388 x 44 | 17, 571.86, 10 x 10 | fill `rgb(255, 138, 46)`, border 0 | no fill, border 2px solid `rgb(147, 160, 176)` |
| 390x844 | pin | Pin at 39.7401, -104.9811 | 1, 554.86, 388 x 44 | 17, 571.86, 10 x 10 | fill `rgb(255, 138, 46)`, border 0 | fill `rgb(255, 138, 46)`, border 0 |

- The bar's box and the mark's box are the same with and without a pin at every size, and the same before and after the fix. So are the map, the search row, the column and the dialog; the rail is the same at 1440 and 1198 and at 390 grows from 125.25 to 341.25 high when the road list loads inside it, before and after alike.
- The tokens, as the mark reads them: `--ink-faint` `#93a0b0` (= `rgb(147, 160, 176)`), `--dim` `#ff8a2e` (= `rgb(255, 138, 46)`), `--da-ground` `#101c29` (= `rgb(16, 28, 41)`, the bar's ground).
- **Contrast, from the computed colours (WCAG formula): the ring's outline on the bar's ground is 6.47:1; the dot's fill on it is 7.32:1.** The non-text floor is 3:1.
- Ring against dot is a shape (a 6 px hole or none), with the hue as a second channel.
- The bar holds 0 controls in both states. Its font is Inter (`__Inter_176161`, loaded).
- Crops: `shots/<size>-bar-no-pin.png`, `shots/<size>-bar-pin.png` (the bar with 24 px of map above, 520 px wide; 388 at 390), `shots/<size>-mark-no-pin.png`, `shots/<size>-mark-pin.png` (the mark with 6 px round it, 22 x 22), and the whole window as `shots/<size>-window-no-pin.png`, `shots/<size>-window-pin.png`. The same bar and mark crops from the base are in `before/`.

## The "Toggle attribution" button (ruling 4)

Mapbox shows the compact button when the map is 640 px wide or less (`offsetWidth<=640` in `mapbox-gl` 3.23.1's `dist/mapbox-gl.js`). The map is 822 wide at 1440 (the full line, no button), 620.19 at 1198 and 388 at 390.

The tap area is probed: one `elementFromPoint` per CSS pixel of the 44 x 44 square centred on the button, 1,936 points.

| Size | Line | Button's box | Points reaching the button, before | after | The rest reach, after |
|---|---|---|---|---|---|
| 1198x930 | closed | 24 x 24 | 625 of 1,936 | 1,936 of 1,936 | nothing |
| 1198x930 | open | 24 x 24 | 625 of 1,936 | 1,816 of 1,936 | Mapbox's "© Maxar" link 90, the line's own box 30 |
| 390x844 | closed | 44 x 44 | 1,936 of 1,936 | 1,936 of 1,936 | nothing |
| 390x844 | open | 44 x 44 | 1,936 of 1,936 | 1,936 of 1,936 | nothing |
| 1440x900 | full line | not shown | no button | no button | |

- Before, at 1198 the 625 points span 25 x 25 (the 24 px box's two edges both land on probe points); the other 1,311 reached the map with the line closed.
- At 1198 with the line open, 120 of the 1,936 points do not reach the button: they are the notch, where Mapbox's line lies under the square. Mapbox's line ends 4 px left of its 24 px button, the square reaches 10 px left of it, so 6 px of the line are inside the square. Before the fix those same points reached the line and the link too ("© Maxar" link 90, the line's box 36).
- A real click 17 px up and left of the button's centre (inside the square, outside the 24 px box) at 1198: before, the attribution stayed closed and the click placed a pin on the map (the bar read "Pin at 36.9195, -102.5246"); after, the attribution opened and the bar still read "No pin yet". A second click 17 px down and left closed it again (after), and did not (before).
- The button's computed `::after`: none before; after, `44px` x `44px`, `position: absolute`, background `rgba(0, 0, 0, 0)`.

### What the attribution looks like and says

- The text is "© Mapbox © OpenStreetMap Improve this map © Maxar" before and after, at every size. The four links' text, addresses and boxes (54.88, 96.89, 99.36 and 45.52 wide, 14 high), the logo (88 x 23, shown), the attribution's box (318.67 x 20 at 1440; 24 x 24 closed and 344.67 x 24 open at 1198; 44 x 48 closed and 360.67 x 48 open at 390), the button's box, its ground (`rgba(255, 255, 255, 0.5)` closed, `rgba(0, 0, 0, 0.05)` open) and its icon size are equal field for field between `before/walk.json` and `shots/walk.json`.
- Each link's centre reaches the link, before and after. The last pixel column of "© OpenStreetMap" reaches the line's box, not the link, before and after alike.
- Pixels, same page, the `::after` on against off against on again (the fix's run): 0 differ at every size and state (crops of 12,024 px at 1440; 2,500 and 18,500 px at 1198; 5,180 and 28,564 px at 390).
- Pixels, the base's run against the fix's run (`compare.json`):

| Size | Line | Inside the attribution's box | Whole crop |
|---|---|---|---|
| 1198x930 | closed | (the 24 x 24 box is all rounded corner; see the whole crop) | 0 of 2,500 |
| 1198x930 | open | 0 of 7,680 | 579 of 18,500 |
| 390x844 | closed | 0 of 176 | 0 of 5,180 |
| 390x844 | open | 0 of 15,344 | 0 of 28,564 |
| 1440x900 | full line | 1 of 6,360, by 1 of 255 on one channel | 1 of 12,024 |

- "Inside the box" leaves out the squares of the box's rounded corners, where the map shows through.
- 1198 open, whole crop: the 579 px are map round the box. In the base's run the off-centre click had placed a pin and the map had moved; in the fix's run it had not.
- 1440: no rule of #545 draws anything there (the button is `display: none`, and the same-page comparison is 0 of 12,024). The line's ground at 1440 is Mapbox's half-transparent white over the live map. I did not find which of the two runs' pixels moved by that one step.
- Crops: `shots/1198-attrib-collapsed.png`, `shots/1198-attrib-expanded.png`, `shots/390-attrib-collapsed.png`, `shots/390-attrib-expanded.png`, `shots/1440-attrib-full-line.png`; the base's in `before/` under the same names. The open crops show Mapbox's own blue focus ring on the button, which the click that opened it left there.

### The first build, set aside

The first build also raised the links above the `::after` (`rulings.md`, Amendment 1). Its walk against the base's (`first-build/compare.json`, `first-build/walk.json`, crops in `first-build/`): inside the attribution's box, 13 of 15,344 px differed at 390 open (largest channel step 10 of 255), 1 of 7,680 at 1198 open (step 1), 1 of 6,360 at 1440 (step 1); its tap area at 1198 open was 1,846 of 1,936. That rule was removed.

## 44 px

The check counts every shown button, input, link, select, `[role=radio]` and `[role=button]` in the dialog. A control is under 44 when its box is under 44 either way and some point of the 44 x 44 square centred on it reaches neither the control nor one of Mapbox's marks. It ran in the no-pin and pin states, where the attribution is closed.

| Size | Controls counted (no pin / pin) | Under 44, before | Under 44, after |
|---|---|---|---|
| 1440x900 | 7 / 9 | none | none |
| 1198x930 | 8 / 10 | button "Toggle attribution" 24 x 24 (its square reaches it at 625 of 1,936) | none (the button's box is 24 x 24; its square reaches it at 1,936 of 1,936) |
| 390x844 | 8 / 10 | none | none |

Skipped by selector and listed, under #505's exception (Ryan, 2026-11-10: Mapbox's logo and attribution links are Mapbox's, placed under its terms, not controls we design): at 1440 the four attribution links (14 high) and the logo link "Mapbox homepage" (88 x 23); at 1198 and 390 the logo link. The "Toggle attribution" button is not in the exception; it is counted.

## axe

`[role=dialog]`, no pin and pin, three sizes: 0 violations in all 6 runs, before and after.

## Closing the window

Each close was made with a pin placed ("Pin at 39.7401, -104.9811" in the bar). The page behind was read before the window opened and 1.5 s after it closed; then the window was opened again to read its bar. Results are from the fix's run; the base's run reads the same.

| Size | Closed with | Window closed | Focus after | Scroll moved | Page height changed | Opener, band and main boxes | WHERE band's text | Requests the close sent | Next window's bar |
|---|---|---|---|---|---|---|---|---|---|
| 1440x900 | Cancel | yes | the "Pick on map" button that opened it | 0 px | 0 px | same | same | none | No pin yet |
| 1440x900 | Close | yes | the same button | 0 px | 0 px | same | same | none | No pin yet |
| 1440x900 | Escape | yes | the same button | 0 px | 0 px | same | same | none | No pin yet |
| 1198x930 | Cancel | yes | the same button | 0 px | 0 px | same | same | none | No pin yet |
| 1198x930 | Close | yes | the same button | 0 px | 0 px | same | same | none | No pin yet |
| 1198x930 | Escape | yes | the same button | 0 px | 0 px | same | same | none | No pin yet |
| 390x844 | Cancel | yes | the same button | 0 px | 0 px | same | same | none | No pin yet |
| 390x844 | Close | yes | the same button | 0 px | 0 px | same | same | none | No pin yet |
| 390x844 | Escape | yes | the same button | 0 px | 0 px | same | same | none | No pin yet |

- "Requests the close sent": every non-GET request to the site in the 1.5 s after the close.
- Nothing saved: the WHERE band's text is unchanged, no request went out, and the next window opened with no pin.
- Stored keys (names and a checksum of each value; values never read out): `sessionStorage` unchanged in all 9. `localStorage` unchanged for Close and Escape. For Cancel three keys changed, `mapbox.eventData.uuid:`, `mapbox.eventData.uuidTimestamp:` and `mapbox.eventData:`; Cancel is each page's first window, and its "before" was read before that window built the page's first map. No key of ours changed.

## Not measured

- The order is fixed: Cancel closes the page's first window, Close the second, Escape the third.
- Closing by a click on the backdrop.
- A window closed with no pin, or with a road picked.
- Touch input: the tap area is probed with `elementFromPoint` and a mouse click, not a touch.
- Production, signed-in sessions, other browsers, DPR above 1.
- The base's run used the script as it stood one edit earlier: its "`::after` off" switch also reset the links' `position`. The base has no `::after` and no rule on the links, so that switch did nothing there.

## Added after the gates (write-up only, code unchanged)

- Hover, found by the independent reviewer and not measured in this walk: with a mouse in the 10 px band round the 24 px button, Mapbox's own `button:hover` ground (`#eee`) now shows, because the `::after` is part of the button. At rest nothing drawn changes. The reviewer saw `rgb(238, 238, 238)` with the rule on and `rgba(255, 255, 255, 0.5)` with it off, on a static copy, pointer 17 px up-left of centre.
- Widths between the three walked sizes were not walked. The reviewer's static probe (626 width and state cases, map widths 232 to 640 px) found no link or zoom tap taken by the square at any width.
