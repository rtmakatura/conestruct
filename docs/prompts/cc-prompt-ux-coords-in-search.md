# cc-prompt: UX map window: coordinates go in the search box; the editable coordinates bar goes

Ryan ruled this on 2026-11-22, after his browser check of #537 and #538. He passed #536 (the corner in the row title) and #538 (zoom to typed coordinates). He rejected #537's editing state ("incredibly ugly": the row of Latitude/Longitude boxes with Go and Cancel in the bar under the map).

One small mission item. Follow the mission rules in CLAUDE.md: two gate rounds at most, gates one at a time, targeted tests locally, and stop only for the park list or any change to a device count. File the issue yourself (R146). Commit the crops for Ryan's hand check.

## Rulings (quote verbatim into rulings.md)

1. **The search box takes coordinates.**
   - Typing or pasting coordinates into the address search box and pressing Search or Enter places the pin there, zooms with #538's behaviour, and runs the road lookup.
   - The placeholder reads "Address, intersection or coordinates".
   - Accept at least:
     - "39.7401, -104.9811"
     - "39.7401 -104.9811"
     - "39.7401,-104.9811"
     - degree forms like "39.7401° N, 104.9811° W"
   - Decide the parsing on the frontend before any geocoding call. A string that parses as coordinates never goes to the geocoder. Record the formats you accept and test each one.
   - **Out of range or swapped:**
     - If the numbers look like coordinates but are out of range, show one plain line in the search's existing suggestion/error list, which floats over the map. Nothing on the page may change size.
     - If swapping them gives a valid point, that line offers "Did you mean <lat>, <long>?" as a choice.
2. **The coordinates bar loses its editing state.**
   - Remove the editable Latitude/Longitude boxes, Go and Cancel, and the "Tap the numbers to change them" hint.
   - Under the map, keep a quiet read-only line: the pin mark, then "Pin at 39.7401, -104.9811". This line holds the pin's coordinates so they can be copied (select-to-copy is enough; no button).
   - Before a pin is placed, the line reads "No pin yet".
   - The line keeps one fixed height. The map and the right panel move 0 px between no pin and pin.
   - This closes #540 (the button that jumped sides); record it.
3. **The rest stays:** #536's row titles, #538's zoom, #525's grouping, #446, #485, #469, #490. Inter only, tokens only, no new hex, 44 px targets, axe clean. List every new string with its source. Unslop.

## Evidence

Capture at 1440, 1198x930 and 390:
- the search box with each accepted format, then the map zoomed to the pin and the road list
- the out-of-range line, and the "Did you mean" line for swapped numbers
- the read-only line with no pin and with a pin

Run the size check (the map and the panel move 0 px), axe, and the 44 px measure. Commit the crops.
