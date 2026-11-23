# #548: user-facing strings

All in `conestruct/site/components/LocationPickerModal.tsx`. Ruling 3 (Ryan, 2026-11-23, `docs/prompts/cc-prompt-coords-wrong-pin.md`): "List every new string with its source."

## New

None.

## Changed

None.

## Removed

One line: #541's floating line for coordinates the box can't read, `COORDS_UNREADABLE`, "Use decimal degrees, like 39.7401, -104.9811". Source: Ryan's round-4 ruling (`rulings.md` § Ryan's ruling, round 4), "No new refusals; keep only #541's out-of-range and swapped-pair lines." Text that got this line goes to the geocoder now, so nothing shows it.

## Kept, word for word

- "Latitude must be between -90 and 90" (`COORDS_LAT_RANGE`)
- "Longitude must be between -180 and 180" (`COORDS_LNG_RANGE`)
- "Did you mean 39.7401, -104.9811?" (`COORDS_DID_YOU_MEAN` and the pair)

The reworded line of rounds 1 to 3 ("Can't read that as coordinates. Enter latitude and longitude, like 39.7401, -104.9811.") was never committed and is not in this change.
