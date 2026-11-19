# #536: the corner goes in the road row's title (N2)

Mission `ux-map-corner-coords` (tracking #539), item 1. Branch `issue-536-corner-in-title`, stacked on `prompt-ux-map-corner-coords` (bed68a4).

## The ruling

Ryan, 2026-11-12, board `Corner3`, option N2 (`docs/prompts/cc-prompt-ux-map-corner-coords.md`, ruling 1), verbatim:

> 1. **The corner goes in the title (N2).**
>    - When a road row has a cross street at the pin (#525's `cross_street`), its first line reads "<street> at <cross street>". The street name is 600 weight in `--ink`; " at <cross street>" is 400 weight in `--ink-mute`, on the same line, wrapping naturally.
>    - The second line drops the " · at …" part and keeps the rest: "Traffic both ways · 2 m from your pin".
>    - Rows without a cross street are unchanged.
>    - Names come from the road data (Rule 12). Nothing about which way the work runs from the corner changes.

And ruling 4: "Inter only, group 1's sizes, tokens only. List every new string with its source. No new hex. Unslop."

## Plan (written before the diff)

1. **Problem.** `roadRowLine()` at `conestruct/site/components/LocationPickerModal.tsx:1942-1945` (bed68a4) appends `· at ${c.cross_street}` to the mute second line (`.road-pick-sub`, rendered at `:1917`), so the corner is the last thing read in the row.
2. **Ruling.** N2, quoted above.
3. **Change.** The row's first line (`.road-pick-name`, `:1916`) renders the street name, then, when `c.cross_street` is set, a nested `<span className="road-pick-at"> at {c.cross_street}</span>`. `roadRowLine()` returns `travelAndDistance(c)` only. New CSS `.workbench .road-pick-at { font-weight: 400; color: var(--ink-mute); }`: no font-size (it inherits `.road-pick-name`'s `--fs-body-value`, Inter 13.5), no new hex, inline so it wraps with the name. The row's accessible name comes from its content, so it reads "Pennsylvania Street at East Colfax Avenue Traffic both ways · 2 m from your pin".
4. **Rule 5 churn prediction.** Stated behaviour change: on a row with a cross street, the first line reads "<street> at <cross street>" (was "<street>"), and the second line loses " · at <cross street>". Unchanged: rows without a cross street (byte-identical DOM), the axis rows (`mw-axis`, same `.road-pick-name` class, no cross street there), the travel and distance words, the picked-road summary, the order of rows, `cross_street`'s derivation (`lib/road-detection/same-street.ts`), every payload and API call, which way the work runs. Files: `LocationPickerModal.tsx` ~+8/-6 (row JSX, `roadRowLine`, its doc comment); `globals.css` ~+7 (the new rule with its comment); `LocationPickerModal.map-window.test.tsx` ~+15/-4 (the two #525 tests now read the title and the second line, plus the accessible name). `type-exceptions.ts` untouched (no size declared).
5. **Proof.** Mounted-flow test (Rule 11) in `LocationPickerModal.map-window.test.tsx`: at Colfax and Pennsylvania the row's `.road-pick-name` text is "Pennsylvania Street at East Colfax Avenue", `.road-pick-at` is " at East Colfax Avenue", `.road-pick-sub` is "Traffic both ways · 2 m from your pin", and the radio's accessible name contains the corner; the no-cross-street row is unchanged. Red proof on bed68a4 (the new assertions fail on the old code). Crops at 1440, 1198x930 and 390 of the road list at Colfax and Pennsylvania, Colfax and Humboldt, and a pin with no cross street, plus axe on the map window, in `shots/` here.

## Calls

1. **R145 self-ruled: " at " is a nested span inside `.road-pick-name`.** The ruling says same line, wrapping naturally; an inline child of the name span wraps as one run of text. Its leading space is in the span's text so the accessible name and `textContent` read "<street> at <cross street>" with no extra spacing rule.
2. **R145 self-ruled: no new type exception entry.** `.road-pick-at` declares no font-size and no font-family (both inherit from `.road-pick-name`, already in the census at `--fs-body-value`); it sets weight 400 and colour `--ink-mute`, an existing token.

New user-facing string: " at " (Ryan's ruling 1 text, "<street> at <cross street>"). The street names are the road data's (`c.name`/`c.ref` via `candidateLabel`, `c.cross_street` via `attachCrossStreets`, `lib/road-detection/same-street.ts:170-196`).

## Actual churn (after the diff)

`git diff --numstat` against bed68a4: `globals.css` +7/-0, `LocationPickerModal.tsx` +11/-6, `LocationPickerModal.map-window.test.tsx` +12/-7. Inside the prediction (~+8/-6, ~+7, ~+15/-4); the TSX ran 3 lines over because the row gained a 4-line comment. `type-exceptions.ts` untouched, as predicted. Behaviour seen in the walk (`walk.md`) matches the stated change; the no-cross-street row is unchanged.

Missed in the prediction (Rule 5, found by the independent reviewer): at 1440 #525's rows wrapped " · at …" onto a third line; the new rows hold two lines (64 px), so the "You'll pick the side…" hint and "Where the work starts" sit about 24 px higher in the panel than in #525's crops. It follows from ruling 1 and moves nothing while the window is open.

Red proof: `red-proof.txt` (the two #536 tests fail on bed68a4's code, 2 failed | 10 passed). After: 4 files, 71 passed (map-window test plus ink-literals, type-census, type-roles); `tsc --noEmit` clean.

`scripts/cosmetic_lane_check.py` reads OUT OF LANE, only because the base commit's `docs/prompts/cc-prompt-ux-map-corner-coords.md` is in the diff from main; this item's own paths are frontend only. The mission's gates (diff-verifier) apply.
