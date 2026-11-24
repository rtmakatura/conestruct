# #565 strings

Every user-facing string the change touches. "Line 1" is the box's 600 line (what happened), "line 2" its second line (what to do next). Base: `e3646e0b`.

## Moved, wording kept

Each was one line in the floating list over the map; each is now in the right panel's box. A two-sentence message is split at its last sentence (`searchMessageLines`, `conestruct/site/lib/geocode-precision.ts`); no word changes.

| Message | Line 1 | Line 2 | Source |
|---|---|---|---|
| Weak match (#554) | Closest match: `<place>`. | Check the pin before you go on. | `weakMatchNotice`, `lib/geocode-precision.ts`; Ryan's #554 ruling |
| No match, city (#376) | No match in Colorado for that city. | Check the spelling. | `geocodeErrorMessage`, 404 `check spelling` |
| No match, address (#376) | No match in Colorado for that address. | Check the spelling. | `geocodeErrorMessage`, 404 `check address` |
| Outside Colorado (#376) | Plans cover Colorado roads only. | none | `geocodeErrorMessage`, 422 `outside colorado` |
| No match, no reason | No match for that address | none | `geocodeErrorMessage`, 404 |
| Cross streets with no city (#347) | Add a city to search cross streets. | none | `geocodeErrorMessage`, 422 |
| Latitude out of range (#537, #541) | Latitude must be between -90 and 90 | none | `COORDS_LAT_RANGE`, `components/LocationPickerModal.tsx` |
| Longitude out of range (#537, #541) | Longitude must be between -180 and 180 | none | `COORDS_LNG_RANGE` |
| The swap choice (#541) | the button "Did you mean `<lat>`, `<long>`?" alone | none | `COORDS_DID_YOU_MEAN`; #541 ruled the choice is the line |

The five text rows with "none" for line 2, and "Address search isn't set up here." below, are a box with one line (R145 call 3: no second line is made up). Ryan can rule a "what to do next" line for any of them.

## Changed

| Message | Old | New | Why |
|---|---|---|---|
| Town or area (#513, #543) | That search found a town or area. Tap the map on the road where the work starts. | Line 1: That search found a town or area, not a street. Line 2: Tap the map on the road where the work starts. The roads near your tap show up here. | Ruling 2's example. Line 2 is the ruling's, word for word. Line 1 keeps "town or area" (R145 call 2: the notice also shows for a county, a ZIP code or a neighbourhood) and takes the ruling's "not a street". |
| Search not set up (503) | Geocoding not configured | Address search isn't set up here. | Ruling 4: "Geocoding" and "configured" are jargon. Same meaning. |
| Search failed (any other status) | Geocoding failed (`<status>`) | Line 1: Address search failed (`<status>`). Line 2: Try again. | Ruling 4: "Geocoding" is jargon. The status number stays, for support. |
| No answer (the request itself failed) | the browser's raw error text, for example "Failed to fetch" | Line 1: The address search didn't answer. Line 2: Try again. | Ruling 4: raw error text is jargon. "didn't answer" is `LOOKUP_FAILED_LINE`'s phrase ("The road data service didn't answer."). `SEARCH_NO_ANSWER`, `lib/geocode-precision.ts`. |

## New

| String | Where | Source |
|---|---|---|
| Tap the map to find the roads. | under the box while there is no pin (`ROADS_NO_PIN`, `components/LocationPickerModal.tsx`) | Ruling 2, word for word |

## Shown in a new place, wording unchanged

| String | Where | Source |
|---|---|---|
| Which road is the work on? | over the box when a message shows and there is no pin or no road list (before: only over the road list and the running lookup) | `ROAD_QUESTION`; ruling 1 |

## Not in the box

- "Searching…" stays on the Search button.
- With no map (#547, open) the town lines still say "Tap the map"; not touched here. Since this change, "Tap the map to find the roads." also follows every other search message with no map (#567).
