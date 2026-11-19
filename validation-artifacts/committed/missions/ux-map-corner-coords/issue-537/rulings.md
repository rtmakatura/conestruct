# #537: the coordinates bar under the map (S2)

Mission `ux-map-corner-coords` (tracking #539), item 2 (the large one). Branch `issue-537-coords-bar`, stacked on `issue-536-corner-in-title` (26df927).

## The rulings

Ryan, 2026-11-12, board `Ideas2`, option S2 (`docs/prompts/cc-prompt-ux-map-corner-coords.md`, ruling 2), verbatim:

> 2. **The coordinates bar (S2).**
>    - Remove the "Or enter coordinates manually" / "Hide coordinate entry" link and its row of boxes.
>    - Under the map, add a bar that is always there, at one fixed height of 44 px: the pin mark (`--dim` dot), "Pin at", then the coordinates as a button (tabular numbers, the precision shown today).
>    - Before a pin is placed, the bar reads "No pin yet. Search, tap the map, or enter coordinates." and the button reads "Enter coordinates".
>    - **Editing:** clicking the button turns it, inside the same bar, into two labelled inputs (Latitude, Longitude), a "Go" button and a "Cancel" link. Enter applies and Esc cancels.
>    - **Bad input** (not numbers, or out of range): the bar shows a short plain error in place of the hint, and stays the same height.
>    - **Paste:** pasting "lat, long" into the first box fills both.
>    - The map and the right panel keep exactly the same size and position in every state: no pin, pin, editing, and error. Measure it.
>    - Every control is 44 px. Labels are real `<label>`s. axe clean.

Ruling 4, verbatim:

> 4. Inter only, group 1's sizes, tokens only. List every new string with its source. No new hex. Unslop. #446 tap feedback, #485 take-turns editing, #469 band height and #490 columns all stay as they are.

Not this item: ruling 3 (typed coordinates zoom the map) is #538, the next item. Applying from the bar keeps today's camera: it flies to the pin only when the pin is off screen, at the zoom the map already has.

## Plan (written before the diff)

1. **Problem.** `conestruct/site/components/LocationPickerModal.tsx:1573-1613` (26df927): the "Or enter coordinates manually" link (`.mw-coords-toggle`, `:1573-1583`) opens `.mw-coords`, a row of two boxes (`:1584-1613`) placed above the map, so opening it shrinks the map (two columns) or pushes the map and the rail down (one column). State `showManualCoords` (`:510`) defaults to `!tokenAvailable`. The boxes apply the pin on every valid keystroke (`onLatChange`/`onLngChange`, `:1267-1321`); a pasted pair applies at once (`trySplitPair`, `:1243-1257`).
2. **Rulings.** S2 and ruling 4, quoted above. #230's commit-on-Enter for the boxes was left out of scope by s2-arc14's ruling 4 (`validation-artifacts/committed/s2-arc14-predemo-fixes/README.md:81-82`); S2 now rules it in ("Enter applies and Esc cancels", a "Go" button), so this is not a reversal.
3. **Change.** Remove the link, its hint and the boxes, and `showManualCoords`. Under the map (after `.picker-map` / `.mw-map-off`, before the bearing note) add `.mw-cbar`, 44 px, `flex-shrink: 0`, in every state:
   - no pin: `--dim` dot, "No pin yet. Search, tap the map, or enter coordinates.", button "Enter coordinates";
   - pin: dot, "Pin at", button "39.7401, -104.9811" (`fmt4`, tabular numbers), hint "Tap the numbers to change them" (the S2 board's words);
   - editing: a `<form>` with `<label>` Latitude + input, `<label>` Longitude + input, "Go" (submit), "Cancel" (link-styled button). Enter submits; Esc cancels and stops there (the window's own Esc-closes handler on `document` never sees it). Focus goes to Latitude on open and back to the coordinates button on Go, Cancel or Esc;
   - error: the bar's hint slot shows the error (`--fail`, with the words), the button stays, the typed text is kept so the button reopens it.
   The two boxes become a draft: nothing moves the pin until Go or Enter, which runs the existing `applyTypedCoords` (same camera, same lookup). The paste handler keeps `onCoordPaste`/`trySplitPair`, which now fill both boxes without applying. `latError`/`lngError` become one `coordError` (bar only).
4. **Rule 5 churn prediction.** Stated behaviour changes: (a) typing in the boxes no longer moves the pin or starts a road lookup per keystroke; Go or Enter does, once; a pasted pair fills both and waits for Go/Enter. (b) A bad entry never reaches the pin, so it no longer blocks Save (the old `!latError && !lngError` terms leave `canSave`; Save follows the pin as it stands). (c) The link, its hint and the 43 px boxes are gone; the bar replaces them. (d) Without a Mapbox token the bar starts in editing (as the boxes started open), the no-pin line drops "tap the map" (there is none), and the map-off line says "below" for "above". Unchanged: every payload and API body, `applyTypedCoords`'s camera (#538 owns zoom), `normaliseCoordText`, the paste split, the search row, the rail, the road list, Save/Cancel, the tool page (#446, #485, #469, #490 are tool-page rules; no file of theirs is touched). Files: `LocationPickerModal.tsx` ~+140/-95; `globals.css` ~+95/-15; `type-exceptions.ts` +1 row (one grouped selector at `--fs-body-value`; the hint and error reuse `.mw-hint`/`.mw-note`); the six sibling picker suites' `typeCoords` helpers gain an apply step and their single-box pin moves reopen the bar first (~+45/-20); `manual-entry.test.tsx` paste and typed tests press Enter (~+15/-5); new `LocationPickerModal.coords-bar.test.tsx` ~+220.
5. **Proof.** Mounted-flow tests (Rule 11) in the new suite: the no-pin copy and button; the pin copy at today's precision; Enter applies (one lookup, the pin text); Esc cancels (no lookup, the window stays open, the old pin text back); paste of "39.7401, -104.9811" into Latitude fills both (and nothing applies until Enter); the error states (not numbers, out of range) show the words in the bar and leave the pin; labels are real `<label>`s. Red-proved on 26df927's code. Local walk on `next dev`: crops of the four states at 1440, 1198x930 and 390, the map and rail rects in all four (0 px), every bar control's box (44 px), axe on the dialog, in `shots/` here.

## Calls

1. **R145 self-ruled: no Mapbox token.** `showManualCoords` defaulted to `!tokenAvailable`; the bar's editing state now does (`coordsEditing`), so without a map the boxes are open on arrival, as before. Cancel still works and leaves the no-pin line, which drops "tap the map" when there is no map (Rule 10): "No pin yet. Search or enter coordinates." The map-off line says "below" for "above" (the boxes moved under it).
2. **R145 self-ruled: the error is its own bar state.** Go or Enter with a bad entry closes the boxes and puts the error where the hint sits (S2 board: the hint is the right-hand text beside the coordinates). The button stays ("Enter coordinates" or the pin's numbers) and reopens the boxes with the typed text kept. With the boxes open there is no room for a hint at 390 or 1198, so the boxes carry none.
3. **R145 self-ruled: the boxes are a draft.** "Enter applies and Esc cancels" plus a Go button means a keystroke no longer moves the pin (s2-arc14's ruling 4 had left commit-on-Enter out of scope; S2 rules it in). The paste split (`onCoordPaste`/`trySplitPair`) fills both boxes and waits for Go or Enter like typed numbers.
4. **R145 self-ruled: Save waits on typed numbers not yet applied (Rule 10).** While the boxes hold numbers different from the pin, Save is shut and the footer says "Press Go to use the coordinates you typed." Saving would otherwise keep the old pin under the new numbers. A bad entry, once the bar has closed, does not block Save: the pin never moved and the bar shows both the pin's numbers and the error. (The old `!latError && !lngError` Save terms go.)
5. **R145 self-ruled: Esc stops at the bar.** The window closes on Esc from a `document` listener; in the App Router React's root listener is on `document` too, so the bar's handler calls `stopImmediatePropagation` as well as `stopPropagation`. The jsdom tests mount under a div and could not see this; the walk did (the first run's Esc closed the window).
6. **R145 self-ruled: "Lat" and "Long" in a narrow bar.** At a bar width under 480 px (the phone, and two columns just past md) the labels show "Lat" and "Long"; "itude" stays in each `<label>`, hidden from sight only, so the accessible name and the label text are "Latitude" / "Longitude" (label-in-name holds: the visible text starts the name). Full words left no room for "-104.9811" at 390.
7. **R145 self-ruled: the second Cancel.** The footer has a Cancel too, so the bar's link is named "Cancel coordinate entry" (visible "Cancel", the name starts with it).
8. **CHOSEN (layout, not safety):** the bar's ground is `--da-ground` (the board's #101c29), the dashed face `--ink-faint` (the board's #6e7c8e is `--pri-off-ink`, the disabled ink, wrong for a live control), side padding 20 px (the search row's) and 16 px under 480 px, gaps 12 / 8 px (6 px editing on a phone), box padding 8 px (4 px narrow), the coordinates face 32 px inside its 44 px button (the board).

## New strings and their sources

| String | Source |
|---|---|
| "No pin yet. Search, tap the map, or enter coordinates." | S2 ruling 2 |
| "Enter coordinates" | S2 ruling 2 |
| "Pin at" | S2 ruling 2 |
| "Latitude", "Longitude" | S2 ruling 2 (they were the old boxes' aria-labels) |
| "Lat", "Long" (visible part, narrow bar) | call 6, cut from the ruled labels |
| "Go", "Cancel" | S2 ruling 2 |
| "Cancel coordinate entry" (accessible name) | call 7 |
| "Tap the numbers to change them" | the Ideas2 board's S2 drawing |
| "Use numbers in decimal degrees, like 39.7401" | call 2; S2's "not numbers"; replaces "Invalid number" and the DMS line; the example is the issue's pin |
| "Latitude must be between -90 and 90", "Longitude must be between -180 and 180" | the old boxes, word for word |
| "No pin yet. Search or enter coordinates." | call 1 |
| "Enter the coordinates below instead." | call 1 (was "above") |
| "Press Go to use the coordinates you typed." | call 4 |

Gone: "Or enter coordinates manually", "Hide coordinate entry", "Latitude and longitude, in decimal degrees", the two placeholders, "Invalid number", the two DMS lines.

## Actual churn (after the diff)

`git diff --numstat` against 26df927: `LocationPickerModal.tsx` +194/-108 (predicted ~+140/-95: over, from calls 4-7 found while building and the strings block); `globals.css` +117/-10 (predicted ~+95/-15: over, from the narrow-bar container and media blocks, call 6); `type-exceptions.ts` +7/-1 (one grouped row as predicted, plus the census pin 235 -> 236, which the prediction missed); sibling suites `coverage` +5, `map-window` +2, `preview-refusal` +4, `scan-honesty` +2, `road-pick` +11/-3, `state-contract` +15/-9 (predicted ~+45/-20 together: +39/-12); `manual-entry` +15/-3 (as predicted; its `errors()` selector, dead since #507's restyle, now reads `.mw-note-fail`); new `LocationPickerModal.coords-bar.test.tsx` 255 lines (13 tests). Behaviour seen in the walk matches the stated changes. Not predicted and stated now: Save's footer line can read "Press Go to use the coordinates you typed." (call 4). Unchanged as predicted: payloads, `applyTypedCoords`'s camera (it drops its now-unused `keepInputs` argument, and `applyPinPosition` its `keepInputs` option), the search row, the rail's contents, the road list.

Not touched, out of date: the ad-hoc live scripts `scripts/{probe,sweep,verify-phone-fit}.cjs` and `scripts/verify-{jbar-stability,whichroad-card}.mjs` still click "Or enter coordinates manually" / fill the old boxes. They are not in CI; noted for whoever runs them next.

Red proof: `red-proof.txt` (12 tests, all failing on 26df927: no bar; the 13th, Save waits, was added after the red run and needs the bar too). After: 15 files, 161 passed (the eleven picker suites, `GeneratorSidebar.manual-pin-move`, ink-literals, type-census, type-roles); `tsc --noEmit` clean. Walk: `walk.md`.
