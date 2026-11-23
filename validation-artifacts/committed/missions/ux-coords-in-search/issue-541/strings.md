# #541: user-facing strings

All in `conestruct/site/components/LocationPickerModal.tsx`. Rulings are Ryan's of 2026-11-22 (`docs/prompts/cc-prompt-ux-coords-in-search.md`); calls are in `rulings.md` § Calls.

## New

| String | Constant | Where it shows | Source |
|---|---|---|---|
| "Address, intersection or coordinates" | `SEARCH_PLACEHOLDER` | the search box's placeholder | ruling 1, word for word |
| "Address, intersection or coordinates search" | `SEARCH_LABEL` | the search box's accessible name (not visible) | call 10 (R145): the old name "Address or intersection search" with the ruled placeholder's words |
| "Did you mean 39.7401, -104.9811?" (the numbers are the typed pair, swapped, to 4 places) | `coordsDidYouMean` | the choice in the search's floating list | ruling 1, word for word ("Did you mean <lat>, <long>?") |
| "No pin yet" | `COORDS_NO_PIN` | the line under the map, before a pin | ruling 2, word for word |
| "Use decimal degrees, like 39.7401, -104.9811" | `COORDS_UNREADABLE` | the floating list, for coordinates that can't be read (degrees and minutes, half a pair) | call 2 (R145): #537's "Use numbers in decimal degrees, like 39.7401" with a pair as the example |
| "Type the coordinates in the search box instead." | `MAP_OFF_LINE` | under "The map can't load here." when there is no map | call 7 (R145): it said "Enter the coordinates below instead." |

## Kept, word for word

| String | Constant | Where it shows now | Source |
|---|---|---|---|
| "Pin at" | `COORDS_PIN_AT` | the line under the map, before the numbers ("Pin at 39.7401, -104.9811") | #537 S2 ruling 2; ruling 2 here |
| "Latitude must be between -90 and 90" | `COORDS_LAT_RANGE` | the floating list (it was in the bar) | #537 (the old boxes' error); ruling 1's "one plain line" |
| "Longitude must be between -180 and 180" | `COORDS_LNG_RANGE` | the floating list (it was in the bar) | same |

## Removed

| String | Was |
|---|---|
| "Address or intersection (e.g., I-25 & Bijou St, Colorado Springs)" | the search box's placeholder |
| "No pin yet. Search, tap the map, or enter coordinates." / "No pin yet. Search or enter coordinates." | the bar before a pin (#537) |
| "Enter coordinates" | the bar's button (#537; #540's button) |
| "Tap the numbers to change them" | the bar's hint (#537) |
| "Latitude" / "Longitude" ("Lat" / "Long"), "Go", "Cancel" ("Cancel coordinate entry") | the bar's editing state (#537) |
| "Use numbers in decimal degrees, like 39.7401" | the bar's not-numbers error (#537) |
| "Press Go to use the coordinates you typed." | the footer line while Save waited on a typed draft (#537) |
| "Enter the coordinates below instead." | the map-off line (#537) |

Unslop check (`docs/style.md`): no em dash, no corrective antithesis, none of the listed words, no triad beyond the ruled placeholder (a list of three things the box takes, Ryan's words).
