# #543: user-facing strings

All in `conestruct/site/components/LocationPickerModal.tsx`. Ruling 2 (Ryan, 2026-11-22, `docs/prompts/cc-prompt-ux-map-window-tidy.md`): "Their wording stays the same unless it uses jargon; list any change."

## New

None.

## Changed

None.

## Kept, word for word

| String | Constant | Where it shows now | Source |
|---|---|---|---|
| "That search found a town or area. Tap the map on the road where the work starts." | `COARSE_NOTICE` | the search's floating list, over the top of the map (it was a paragraph between the search row and the map) | ruling 2; the words are the ones on 5ab10324 |

## The bearing note

It has no string. Nothing has set `bearingWarning` to words since #507 (1c2d99db), which moved its messages into the right panel (`rulings.md` call 1). Only its empty slot moved.

Unslop check (`docs/style.md`) on the kept line: no em dash, no corrective antithesis, none of the listed words, no triad, no jargon.
