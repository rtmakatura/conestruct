# cc-prompt: UX map window: corner in the row title, a steady coordinates bar, and zoom to typed coordinates

Ryan ruled this on 2026-11-12, on the "Tool page: the map window" design canvas (https://claude.ai/artifact/TbdFDMmjqJpsUkqsT5wpFL), after his browser check of #525.
- Board `Corner3`, option **N2**: the corner goes in the row's title.
- Board `Ideas2`, option **S2**: the pin's coordinates always sit in a bar under the map.
- The rest of the map window stays as #507 and #525 left it.

Three mission items: item 2 is the large one. Follow the mission rules in CLAUDE.md: two gate rounds at most, gates one at a time, targeted tests locally, and stop only for the park list or any change to a device count. File the issues yourself (R146). Commit the crops for Ryan's hand check.

## Why

- **The corner is easy to miss.** #525 put " · at East Colfax Avenue" at the end of each row's second line.
- **Coordinate entry moves things.** "Or enter coordinates manually" opens a row of two boxes that shrinks the map and shifts the right panel. That breaks P1. The boxes are also 43 px (a known spacing-round item).
- **Typed coordinates don't zoom.** After Ryan entered 39.7401, -104.9811, the pin landed but the map stayed zoomed out on all of Colorado.

## Rulings (quote verbatim into rulings.md)

1. **The corner goes in the title (N2).**
   - When a road row has a cross street at the pin (#525's `cross_street`), its first line reads "<street> at <cross street>". The street name is 600 weight in `--ink`; " at <cross street>" is 400 weight in `--ink-mute`, on the same line, wrapping naturally.
   - The second line drops the " · at …" part and keeps the rest: "Traffic both ways · 2 m from your pin".
   - Rows without a cross street are unchanged.
   - Names come from the road data (Rule 12). Nothing about which way the work runs from the corner changes.
2. **The coordinates bar (S2).**
   - Remove the "Or enter coordinates manually" / "Hide coordinate entry" link and its row of boxes.
   - Under the map, add a bar that is always there, at one fixed height of 44 px: the pin mark (`--dim` dot), "Pin at", then the coordinates as a button (tabular numbers, the precision shown today).
   - Before a pin is placed, the bar reads "No pin yet. Search, tap the map, or enter coordinates." and the button reads "Enter coordinates".
   - **Editing:** clicking the button turns it, inside the same bar, into two labelled inputs (Latitude, Longitude), a "Go" button and a "Cancel" link. Enter applies and Esc cancels.
   - **Bad input** (not numbers, or out of range): the bar shows a short plain error in place of the hint, and stays the same height.
   - **Paste:** pasting "lat, long" into the first box fills both.
   - The map and the right panel keep exactly the same size and position in every state: no pin, pin, editing, and error. Measure it.
   - Every control is 44 px. Labels are real `<label>`s. axe clean.
3. **Typed coordinates zoom the map.** Trace why entering coordinates leaves the map at the state view. Applying coordinates (from the bar, or any other path that sets the pin by number) centers the map on the pin at the same zoom a search result uses. Add a test that fails on the old code.
4. Inter only, group 1's sizes, tokens only. List every new string with its source. No new hex. Unslop. #446 tap feedback, #485 take-turns editing, #469 band height and #490 columns all stay as they are.

## Out of scope

#526 (it has its own mission), the spacing round's other items, and #514, #522, #523.

## Evidence

Capture at 1440, 1198x930 and 390:
- the road list at Colfax and Pennsylvania (39.7401, -104.9811) and at Colfax and Humboldt, plus one pin with no cross street
- the coordinates bar with no pin, with a pin, while editing, and with an error
- the map after applying 39.7401, -104.9811, zoomed to the pin

Run the size check across the four bar states (the map and the panel move 0 px), axe, and the 44 px measure. Commit the crops.
