# #538: typed coordinates zoom the map to the pin

Mission `ux-map-corner-coords` (tracking #539), item 3. Branch `issue-538-typed-coords-zoom`, stacked on `issue-537-coords-bar` (b621c72).

## The ruling

Ryan, 2026-11-12 (`docs/prompts/cc-prompt-ux-map-corner-coords.md`, ruling 3), verbatim:

> 3. **Typed coordinates zoom the map.** Trace why entering coordinates leaves the map at the state view. Applying coordinates (from the bar, or any other path that sets the pin by number) centers the map on the pin at the same zoom a search result uses. Add a test that fails on the old code.

Ruling 4 (Inter only, tokens only, no new hex, unslop; #446, #485, #469, #490 unchanged) holds; this item adds no string, no style and no colour.

## Root cause (traced on b621c72)

`applyCoordsEditing` (`conestruct/site/components/LocationPickerModal.tsx:1339-1354`) calls `applyTypedCoords` (`:1009-1023`), which calls `applyPinPosition` (`:959-1004`). Two gaps, both in `applyTypedCoords`:

1. **No fly when the pin is already on screen.** `applyTypedCoords` sets `needFly = false` when `map.getBounds()` contains the new point (`:1012-1015`). The window opens on the state view of Colorado (`DEFAULT_CENTER` / `DEFAULT_ZOOM`), whose bounds contain every Colorado coordinate, so 39.7401, -104.9811 is "on screen" and the camera never moves. This is the case Ryan hit on 2026-11-12.
2. **No zoom when it does fly.** Even off screen, `applyTypedCoords` passes no `targetZoom`, and `applyPinPosition` keeps `map.getZoom()` when `targetZoom` is absent (`:984-988`). So a pin typed outside the state view flew to the pin at the state view's zoom. The comment at `:954-958` says this was on purpose ("Omit it for pin drags / typed-coord moves so the camera *preserves* whatever zoom the operator landed on"); ruling 3 overrides it for typed moves.

A search result passes `fly: true, targetZoom: PIN_ZOOM` (`:1216-1220`, `:1437-1441`), and `applyPinPosition` raises the zoom to `PIN_ZOOM` (16) only when the map is further out (`z < targetZoom`), so a closer view is kept.

## Every path that sets the pin by number

| Path | Before | After |
|---|---|---|
| The bar's Go / Enter (`applyCoordsEditing` → `applyTypedCoords`) | flies only off screen, at the current zoom | always flies to the pin, at `PIN_ZOOM` or closer |
| A pasted "lat, long" (`onCoordPaste` / `trySplitPair`) | fills both boxes, then Go / Enter (#537) | same path as the row above |
| The window opening on a saved pin (`initial.lat` / `initial.lng`) | the map is built centred on the pin at `PIN_ZOOM` (`:1044-1047`) | unchanged |
| A precise search result (both search paths) | `fly: true, targetZoom: PIN_ZOOM` | unchanged |

A map tap and a pin drag set the pin by position, not by number; they keep `fly: false` (the issue's acceptance: "Search, map tap and pin drag behave as today").

## Plan (written before the diff)

1. **Problem.** Applying typed coordinates leaves the map on the state view (root cause above).
2. **Ruling.** Ruling 3, quoted above. Two fold-ins from #537's independent reviewer pass the R154 fold test (same files, no ruling, small): (a) Go / Enter with numbers unchanged from the pin re-runs the lookup and throws away the road pick and the road direction, against the comment at `:997-998` ("a reopen or Try again at the same pin keeps it"); (b) the "Save waits" test only checks the footer wording while Save is already shut for another reason.
3. **Change.** `applyTypedCoords` drops the on-screen check and always passes `fly: true, targetZoom: PIN_ZOOM`; the comment at `:954-958` says typed moves now zoom like a search. `applyCoordsEditing`: when both boxes parse and match the pin at the shown precision (`fmt4`), the bar closes, the boxes go back to the pin's text, and the map centres on the pin at `PIN_ZOOM` or closer, with no lookup and no change to the pin, the road pick or the direction (call 1). The camera move is one small helper shared with `applyPinPosition`.
4. **Rule 5 churn prediction.** Stated behaviour changes: (i) Go / Enter with new numbers always moves the camera to the pin, and raises the zoom to 16 when the map is further out (before: no move when the point was on screen; the current zoom when it was not). A view already closer than 16 keeps its zoom. (ii) Go / Enter with the pin's own numbers no longer runs a lookup or clears the road pick or the direction; it closes the bar and centres the map on the pin at 16 or closer. Unchanged: search, map tap, pin drag, the opening view, every payload and API body, Save's rules, the bar's look and every string. Files: `LocationPickerModal.tsx` ~+25/-15; `LocationPickerModal.coords-bar.test.tsx` ~+120/-10 (the `mapbox-gl` stub records `flyTo` and answers `getZoom` / `getBounds`; three new tests: the zoom, the unchanged numbers, Save shut by typed numbers alone after a road pick). The other picker suites run without a token (no map, no camera) or with the any-call stub; none is predicted to change.
5. **Proof.** Mounted-flow tests (Rule 11) in `LocationPickerModal.coords-bar.test.tsx`, red-proved on b621c72 for the zoom and for fold-in (a) (`red-proof.txt` here). Local walk on `next dev`: apply 39.7401, -104.9811 from the bar on the state view, read the map's zoom and centre from the map, crops at 1440, 1198x930 and 390 in `shots/` here.

## Calls

1. **R145 self-ruled: unchanged numbers still centre the map.** Fold-in (a) leaves the camera open. Go means "show me this point" whichever numbers are in the boxes, and ruling 3 says applying coordinates centres the map on the pin at the search zoom; a camera move changes nothing the plan is built on. So unchanged numbers close the bar and fly to the pin at `PIN_ZOOM` or closer, with no lookup and no state change. "Unchanged" is judged at the shown precision (`fmt4` of the parsed boxes against `fmt4` of the pin), the same precision the bar prints, so "39.74010" counts as the pin's own latitude.
2. **R145 self-ruled: `PIN_ZOOM` or closer, never further out.** "The same zoom a search result uses" is `applyPinPosition`'s `targetZoom` rule, which raises to 16 and never pulls a closer view out. Typed moves use that same rule, not a fixed 16.

## Actual churn (against the prediction)

- `LocationPickerModal.tsx` +33/-28 (predicted ~+25/-15). The camera move became `flyToPin` (shared by `applyPinPosition` and the unchanged-numbers path); `applyTypedCoords` lost its on-screen check; `applyCoordsEditing` gained the unchanged-numbers branch. No string, style or payload changed.
- `LocationPickerModal.coords-bar.test.tsx` +168/-4 (predicted ~+120/-10). The stub records `flyTo` and answers `getZoom` / `getBounds`; four new tests (the zoom from the state view; a closer view kept; fold-in (a); fold-in (b)) plus a two-road lookup fixture. Larger than predicted by the fixture (~45 lines).
- The other picker suites: unchanged and green, as predicted.

## Tests

- Red proof on b621c72's component: `red-proof.txt` (3 failed | 14 passed; the zoom twice, fold-in (a) once).
- After the fix: `npx vitest run components/LocationPickerModal` 12 files, 107 passed; `npx tsc --noEmit` clean.
- Walk: `walk.md` (zoom 6 to 16, centre [-104.9811, 39.7401] at all three sizes; Enter with the pin's numbers ran no lookup).
