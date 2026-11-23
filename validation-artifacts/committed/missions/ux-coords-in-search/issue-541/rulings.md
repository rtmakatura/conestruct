# #541: coordinates go in the search box; the bar becomes a read-only line

Mission `ux-coords-in-search` (tracking #542), its one item. Branch `issue-541-coords-in-search`, stacked on `prompt-ux-coords-in-search` (5074c98e).

## The rulings

Ryan, 2026-11-22 (`docs/prompts/cc-prompt-ux-coords-in-search.md`), verbatim:

> 1. **The search box takes coordinates.**
>    - Typing or pasting coordinates into the address search box and pressing Search or Enter places the pin there, zooms with #538's behaviour, and runs the road lookup.
>    - The placeholder reads "Address, intersection or coordinates".
>    - Accept at least:
>      - "39.7401, -104.9811"
>      - "39.7401 -104.9811"
>      - "39.7401,-104.9811"
>      - degree forms like "39.7401° N, 104.9811° W"
>    - Decide the parsing on the frontend before any geocoding call. A string that parses as coordinates never goes to the geocoder. Record the formats you accept and test each one.
>    - **Out of range or swapped:**
>      - If the numbers look like coordinates but are out of range, show one plain line in the search's existing suggestion/error list, which floats over the map. Nothing on the page may change size.
>      - If swapping them gives a valid point, that line offers "Did you mean <lat>, <long>?" as a choice.

> 2. **The coordinates bar loses its editing state.**
>    - Remove the editable Latitude/Longitude boxes, Go and Cancel, and the "Tap the numbers to change them" hint.
>    - Under the map, keep a quiet read-only line: the pin mark, then "Pin at 39.7401, -104.9811". This line holds the pin's coordinates so they can be copied (select-to-copy is enough; no button).
>    - Before a pin is placed, the line reads "No pin yet".
>    - The line keeps one fixed height. The map and the right panel move 0 px between no pin and pin.
>    - This closes #540 (the button that jumped sides); record it.

> 3. **The rest stays:** #536's row titles, #538's zoom, #525's grouping, #446, #485, #469, #490. Inter only, tokens only, no new hex, 44 px targets, axe clean. List every new string with its source. Unslop.

#540 (the "Enter coordinates" button that jumped sides on a no-pin error) is closed by this item: the button is removed.

## Plan (the prediction below was written before the component diff)

1. **Problem.** `conestruct/site/components/LocationPickerModal.tsx` at 5074c98e: the search box (`:1601-1608`, placeholder `:1606`) sends every string to `/api/geocode`. There are two senders: the open-time lookup of the saved address (`:1184`) and the search form's submit (`:1410`). The bar's editing state (`:1639-1689`), the "Enter coordinates" button (`:1699-1708`) and the hint (`:1714`) are what Ryan rejected. The search's error line (`:1617-1621`) is a `<p>` in the column's flow: it does not float, so today it shrinks the map (two columns) or pushes the map and the rail down (one column).
2. **Rulings.** 1 to 3 above.
3. **Change.**
   - New `conestruct/site/lib/search-coords.ts`: `readSearchCoords(text)` returns `address`, `point`, `out-of-range` (with the swap when it is a valid point) or `unreadable`. Both senders call it first and send only `address` to the geocoder.
   - `point`: the pin goes there through `applyTypedCoords` (#538: fly at the search zoom, road lookup). The pin's own numbers move nothing (#538 fold-in (a), kept).
   - `out-of-range` / `unreadable`: one line in a new floating list under the search box, over the map (`.mw-search-list`, `position: absolute`). With a valid swap the line is a 44 px button "Did you mean 39.7401, -104.9811?"; choosing it places the pin. The geocoder's own error line moves into the same list.
   - The bar: `.mw-cbar` keeps its 44 px and its `--dim` dot and reads "No pin yet" or "Pin at 39.7401, -104.9811" (the numbers selectable). The form, the boxes, Go, Cancel, the button, the hint, their state, handlers and CSS go.
4. **Rule 5 churn prediction.** Stated behaviour changes:
   - (a) Coordinates typed in the search box place the pin; they used to be geocoded as an address. No `/api/geocode` request is made for them, at the search form or at the open-time lookup of a saved address that is coordinates.
   - (b) The bar has no control. Coordinates can no longer be typed under the map. `SAVE_COORDS_LINE` ("Press Go to use the coordinates you typed.") and the Save hold on a typed draft go with the draft.
   - (c) The search's error line (a failed address search included) floats over the top of the map and no longer resizes the map or moves the rail. It is cleared when the pin moves or the box is edited (the coordinates line only; a geocoder error stays until the next search, as today).
   - (d) The search box's accessible name becomes "Address, intersection or coordinates search" (it was "Address or intersection search"). Two verify scripts that find it by label follow.
   - (e) Without a Mapbox token the window no longer opens on the boxes; the map-off line points at the search box.
   - (f) A pasted pair no longer splits across two boxes (#230); the search box reads the pair, the Unicode minus and NBSP itself.

   Unchanged, byte-identical: every API body and payload, `applyPinPosition`, `applyTypedCoords`, `flyToPin`, `detectAt`, the geocoder path for an address (request body, coarse notice, precision rule), the rail, the road list and its titles (#536), the grouping (#525), Save/Cancel apart from (b), the tool page (#446, #485, #469, #490: no file of theirs is touched), device counts (none touched).

   Files and lines predicted:

   | File | Predicted |
   |---|---|
   | `conestruct/site/components/LocationPickerModal.tsx` | +110 / -200 |
   | `conestruct/site/app/globals.css` | +45 / -100 |
   | `conestruct/site/lib/search-coords.ts` (new) | +95 |
   | `conestruct/site/lib/search-coords.test.ts` (new) | +110 |
   | `conestruct/site/lib/design/type-exceptions.ts` | +3 / -3 |
   | `conestruct/site/components/tap-targets.test.ts` | +15 / -25 |
   | `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx` (rewritten: the read-only line and the search-box flow) | +330 / -380 |
   | `conestruct/site/components/LocationPickerModal.manual-entry.test.tsx` (rewritten for the search box) | +70 / -110 |
   | six sibling suites' pin helpers (`coverage`, `map-window`, `preview-refusal`, `road-pick`, `scan-honesty`, `state-contract`) | +45 / -60 in all |
   | `scripts/verify-columns-end-together.mjs`, `scripts/verify-generate-cls.mjs` | 1 line each |
   | this evidence folder | new |

5. **Proof.** Parser unit tests, one per accepted format and per refusal. Mounted-flow tests (Rule 11) on the real modal: for each accepted format, Enter in the search box makes one road lookup at 39.7401, -104.9811, one `flyTo` at zoom 16 and zero `/api/geocode` requests; out of range shows the line and no pin; the swapped pair shows the choice and choosing it places the pin; an address still goes to the geocoder; a saved address that is coordinates is not geocoded on open; the bar has no input or button. Red-proved on 5074c98e's code. A local walk on `next dev` at 1440, 1198x930 and 390 for the crops, the 0 px size check, axe and the 44 px measure, in `shots/` here.

## Formats

Accepted, each tested in `conestruct/site/lib/search-coords.test.ts` and, for eight of them (the four ruled ones, letters without the degree sign, letters in front, longitude first, and the Unicode minus), in the mounted flow:

| Typed | Read as | Source |
|---|---|---|
| `39.7401, -104.9811` | 39.7401, -104.9811 | ruling 1 |
| `39.7401 -104.9811` | same | ruling 1 |
| `39.7401,-104.9811` | same | ruling 1 |
| `39.7401° N, 104.9811° W` | same | ruling 1 |
| `39.7401 N 104.9811 W`, `39.7401N, 104.9811W` | same | ruling 1 ("degree forms like"), call 3 |
| `N 39.7401, W 104.9811` | same | call 3 |
| `104.9811° W, 39.7401° N` | same (the letters name the axis) | call 3 |
| U+2212 or U+2013 for the minus, NBSP or repeated spaces | same | #230, kept |

Refused with a line, never geocoded: a pair with a number outside its range; degrees and minutes (`39°44'24"N 104°59'W`); any other text with a degree sign; two latitudes or two longitudes; a minus sign with a hemisphere letter.

An address (geocoded as before): everything else, including one number alone and two bare whole numbers with only a space between (`1600 80202`, `500 N 200 W`).

## Calls

1. **R145 self-ruled: the floating list is built here.** Ruling 1 says the line goes "in the search's existing suggestion/error list, which floats over the map". The window has no suggestion list, and its error line is in the column's flow (`LocationPickerModal.tsx:1617-1621` at 5074c98e), so it resizes the map. The ruling's requirement is the behaviour (one line, floating, nothing changes size), so this item adds the list (`.mw-search-list`, under the search box, over the top of the map) and moves the geocoder's error line into it. One place for the search's lines; a failed address search stops resizing the map too. The coarse-match notice ("That search found a town or area…") and the bearing note stay in the flow; they are filed as a follow-up.
2. **R145 self-ruled: what the one line says.** With a valid swap, the line is the choice itself: a button "Did you mean 39.7401, -104.9811?" (ruling 1's words; the issue's acceptance). With no valid swap, the line is the range error the old boxes used, word for word ("Latitude must be between -90 and 90" / "Longitude must be between -180 and 180"). Coordinates that can't be read get "Use decimal degrees, like 39.7401, -104.9811" (the old "Use numbers in decimal degrees, like 39.7401", with a pair as the example since the box now takes a pair).
3. **R145 self-ruled: the degree forms.** Ruling 1 gives one example and says "like". Accepted: a degree sign (optional), a hemisphere letter after or before the number, either order when letters name the axis. A letter and a minus sign together are refused (they can disagree), as are two letters on one axis. Nothing is swapped or clamped silently (Rule 10).
4. **R145 self-ruled, CHOSEN (not safety): what marks a pair as coordinates.** Two numbers separated by a comma, or by spaces when the text carries a decimal point, a degree sign or a sign. Two bare whole numbers with only a space (`1600 80202`, `500 N 200 W`) stay an address: house numbers, ZIP codes and grid addresses look like that, coordinates rarely do.
5. **R145 self-ruled: the swap is offered only for a bare pair.** `-104.9811, 39.7401` is out of range as typed and valid the other way round, so the choice shows. A pair with hemisphere letters already says which number is which. A swapped pair whose numbers are both under 90 (`-75.1, 39.9`) is a valid point as typed and is taken as typed: the window can't know better.
6. **R145 self-ruled: the saved address.** The open-time lookup (`:1184`) reads the saved address through the same parser. Coordinates there place the pin; a refused pair shows the line. Nothing reaches the geocoder (both senders covered).
7. **R145 self-ruled: no Mapbox token.** The window used to open on the boxes. Now the search box is the way in (it needs no map and no geocoder for coordinates). The map-off line reads "Type the coordinates in the search box instead." (it said "Enter the coordinates below instead.").
8. **R145 self-ruled: the pin's own numbers.** Submitting the pin's own coordinates (at the shown precision) centres the map and keeps the road pick, as #538's fold-in (a) did for Go.
9. **R145 self-ruled: the address field.** A coordinates search leaves the plan's address text as it was (the old bar did the same); the pin is the location.
10. **R145 self-ruled: the accessible name.** The search box's `aria-label` follows the placeholder: "Address, intersection or coordinates search".
11. **R145 self-ruled: select to copy.** The numbers carry `user-select: all`, so one click or a double tap selects the whole pair.
12. **CHOSEN (layout, not safety):** the list sits 4 px under the search box at the box's width (so it never covers the zoom control), ground `--da-ground`, edge `--rule`, 8 px / 12 px padding for the plain line, `z-index: 3` (Mapbox's controls are 2).

13. **R145 self-ruled: the pin mark.** The line keeps #537's `--dim` dot in both states (ruling 2: "the pin mark, then..."). The words carry the state; the dot is decoration (Rule 13).
14. **R145 self-ruled: when the coordinates line goes away.** Editing the box or placing a pin (search, tap, drag) withdraws a refused-coordinates line, as #537's bar error was cleared by a new pin. A geocoder error stays until the next search, as before.
15. **Filed, not folded:** #543 (https://github.com/rtmakatura/conestruct/issues/543), the coarse-match notice and the bearing note still sit in the flow and resize the map column. It needs a ruling on where they go (the coarse notice must not cover the spot the user is about to tap), so it fails the R154 fold test.

## Churn: predicted against actual

| File | Predicted | Actual |
|---|---|---|
| `conestruct/site/components/LocationPickerModal.tsx` | +110 / -200 | +141 / -270 |
| `conestruct/site/app/globals.css` | +45 / -100 | +51 / -93 |
| `conestruct/site/lib/search-coords.ts` (new) | +95 | +90 |
| `conestruct/site/lib/search-coords.test.ts` (new) | +110 | +148 |
| `conestruct/site/lib/design/type-exceptions.ts` | +3 / -3 | +4 / -6 |
| `conestruct/site/components/tap-targets.test.ts` | +15 / -25 | +19 / -24 |
| `LocationPickerModal.coords-bar.test.tsx` | +330 / -380 | +256 / -240 |
| `LocationPickerModal.manual-entry.test.tsx` | +70 / -110 | +48 / -81 |
| six sibling suites' pin helpers | +45 / -60 | +51 / -62 |
| the two verify scripts | 1 line each | 1 line each |

The same files as predicted, none added. The component came out larger on both sides than predicted (the removed handlers and state were about 70 lines more than counted; the strings block and the two small handlers about 30 more). The parser's test file is longer because each refusal got its own case. No behaviour beyond (a) to (f) changed.

One slip, stated plainly: `lib/search-coords.ts` (the new parser file) was written a few minutes before this plan and its prediction were on disk. Nothing in an existing file had been touched yet; every edit to an existing file came after the prediction.

## New strings and their sources

See `strings.md`.
