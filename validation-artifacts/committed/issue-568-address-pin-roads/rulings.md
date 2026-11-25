# #568 rulings

Session of 2026-11-24. Branch `issue-568-bannock-no-roads`, built on `origin/issue-566-prod-check` (`fa28f0a`, the ux-search-feedback-panel production check, which ships with this).

## Ryan, 2026-11-24 (the /start instruction)

> First trace why "1437 Bannock St, Denver" places a pin but the road lookup lists no roads, and fix it with a test that fails on the old code. Fold in #567: while a search message box shows in the right panel, hide the other "tap the map" lines ("Tap the map to find the roads.", "Search an address or tap the map to place your pin.", "Tap the map to move it.") so the box's line is the only instruction. Also fix #567's other code lows if they're small.

## The trace

Recorded 2026-11-24; the numbers are in `trace.md`, the geocoder's answer in `mapbox-answer.json`, the lookup's two Overpass answers in `conestruct/site/app/api/road-bearing/__fixtures__/bannock-1437-568.json`.

- Mapbox answers the address at 39.739247, -104.99097 with `"accuracy": "rooftop"`: the centre of the City and County Building, which fills its block.
- The nearest road open to traffic is Cherokee Street, 57.8 m away. Bannock Street in front of the building is `highway=pedestrian` in OSM (60.5 m away), a class the lookup does not read.
- The lookup asks for ways within 50 m and keeps those within 30 m (`route.ts` `SEARCH_RADIUS_M`, `SNAP_MAX_DISTANCE_M`). So 0 roads was a true answer to the question it asked. The defect is that a street address's pin is a building, and the 30 m was set for a tap on the road.

## R145 self-ruled

1. **An address search's pin tells the lookup it is one** (`reach: "address"` in the request). When no road is within 30 m of it, the lookup answers the roads within `ADDRESS_REACH_M` and flags the answer `nearest_only`. With a road within 30 m the answer is the same bytes as a tapped pin's. Tapped pins, typed coordinates and a saved pin send no `reach` and are unchanged.
2. **`ADDRESS_REACH_M` = 100 m, CHOSEN** (Rule 12; not a safety distance). No source says how far a building's centre is from its street. 100 m holds this pin's three nearest roads (57.8, 84.1, 87.3 m).
3. **A nearest-only list is said to be one and nothing is picked** (Rule 10; suggest-never-set). Two lines over the list: "No mapped road runs within 30 m of this address." and "These are the nearest. Pick one, or tap the map on the road where the work starts." A single nearest-only road is not selected for the operator (a single road at the pin still is, as before). Each row already shows its distance from the pin.
4. **Rejected: moving the pin to Mapbox's routable point.** For this address it is 39.739412, -104.991322, 27.7 m from Cherokee Street: inside 30 m by 2.3 m, on the far side of the building from the street the address names. Not a dependable fix, and it moves the pin off the address the operator typed.
5. **Rejected: reading `highway=pedestrian` ways.** Bannock Street there is closed to traffic; listing it as the road the work closes would be wrong.
6. **#567 item 1 and Ryan's fold-in.** "Tap the map to find the roads." is removed (it only ever showed under the box; with it gone, #567 item 1's no-map case is gone too). "Search an address or tap the map to place your pin." and "Tap the map to move it." are not rendered while the box shows. "At your pin." stays.
7. **#567 item 3.** After "Did you mean" is pressed, focus goes to the search box, which then holds the pair. CHOSEN.
8. **#567 item 2 is not folded in** (not small): the live region is `display: none` itself while empty, not only its section, so the fix restructures #565's box and its tests and needs a real-browser accessibility-tree check. It stays on #567.

## For Ryan (none blocks)

- A pick from a nearest-only list leaves the pin on the building; the work start is then read at the road's nearest point to it, as it is today for any pin up to 30 m off the road. The second line asks for a tap on the road instead.
- The wording of the two new lines.
- #547 item 5 (the town message's own "Tap the map" with no map) is not touched.
