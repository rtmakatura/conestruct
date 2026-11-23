# #544: user-facing strings

All in `conestruct/site/components/LocationPickerModal.tsx`. Ruling 5 (Ryan, 2026-11-22, `docs/prompts/cc-prompt-ux-map-window-tidy.md`): "List every new string with its source."

## New

None.

## Changed

None. No character a person reads is different, and the button's accessible name is the same.

## Kept, word for word

| String | Where it is built now | Source |
|---|---|---|
| "Did you mean 39.7401, -104.9811?" | `COORDS_DID_YOU_MEAN` ("Did you mean"), a space, then `coordsPair(lat, lng)` and "?" inside `<span className="mw-search-pair">`. It was one template string, `coordsDidYouMean`. | #541 ruling 1 (`docs/prompts/cc-prompt-ux-coords-in-search.md`); quoted again in ruling 3 here |

The mounted tests pin the button's text and its accessible name to "Did you mean 39.7401, -104.9811?" (#541's test, unchanged, and #544's).

Unslop check (`docs/style.md`) on the kept line: no em dash, no corrective antithesis, none of the listed words, no triad.
