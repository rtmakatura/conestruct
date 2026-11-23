# #544: bracketed coordinates, and the "Did you mean" numbers stay together

Mission `ux-map-window-tidy` (tracking #546), item #544. Branch `issue-544-brackets-nowrap`, stacked on `issue-543-notices-float` (52b80674).

## The rulings

Ryan, 2026-11-22 (`docs/prompts/cc-prompt-ux-map-window-tidy.md`), verbatim:

> 3. **#544, two fixes only.**
>    - Coordinates in brackets, e.g. "(39.7401, -104.9811)" or "[39.7401, -104.9811]", parse as coordinates and never reach the geocoder. Add a test for each form.
>    - At 390, "Did you mean 39.7401, -104.9811?" keeps the numbers together on one line. The pair must not wrap in the middle.
>    - The rest of #544 goes to the spacing round list in handoff.md.

> 5. Inter only, tokens only, no new hex, 44 px targets (apart from #505's exception), axe clean. List every new string with its source. Unslop.

## Plan (the prediction below was written before the diff)

1. **Problem.**
   - `conestruct/site/lib/search-coords.ts:54` at 52b80674: the text is matched against `PAIR` as typed, so `(39.7401, -104.9811)` and `[39.7401, -104.9811]` don't match and return `address` (`:58`). Both senders (`LocationPickerModal.tsx:1170` and `:1311`) then post them to `/api/geocode`.
   - `conestruct/site/components/LocationPickerModal.tsx:1549` and `app/globals.css` (`.map-window .mw-search-pick`): the choice is one text run with ordinary spaces, so at 390 it breaks after "39.7401," (seen in `validation-artifacts/committed/missions/ux-coords-in-search/issue-541/shots/390-did-you-mean.png`).
2. **Rulings.** 3 and 5 above.
3. **Change.**
   - Parser: one pair of matching brackets round the whole text, round or square, is dropped before the text is read. Everything after that is #541's reading, unchanged.
   - Window: the two numbers in the choice (with the question mark) are their own `<span className="mw-search-pair">`, and one new CSS rule gives it `white-space: nowrap`. The words of the choice don't change.
4. **Rule 5 churn prediction.** Stated behaviour changes:
   - (a) Text that is a pair of coordinates inside `( )` or `[ ]` is read as that pair: a valid one places the pin and sends no `/api/geocode` request, at both senders (the search form and the open-time lookup of a saved address). Before: bracketed text with no degree sign was geocoded as an address; a bracketed pair with a degree sign (`(39.7401° N, 104.9811° W)`, `[104.9811° W, 39.7401° N]`) got the "Use decimal degrees" line and no pin (`red-proof.txt`: both returned `{ kind: 'unreadable' }` on 52b80674), and now places the pin.
   - (b) The same holds for the refusals: a bracketed pair that is out of range, typed the wrong way round, or not a readable pair now gets #541's line or its "Did you mean" choice. Before, with no degree sign in it, it was geocoded; with a degree sign (`(139.7401°, -104.9811°)`, `(-104.9811°, 39.7401°)`) it got the "Use decimal degrees" line. Bracketed text with a degree sign that still can't be read (`(39.7401°)`, bracketed degrees, minutes and seconds) is unchanged: the "Use decimal degrees" line before and after.
   - (d) Known consequence, added after gate round 1 (the code is unchanged): a bracketed lone degrees-and-minutes value, `(39° 44.4)` or `[39° 44.4]`, got the "Use decimal degrees" line on 52b80674 and now reads as the point lat 39, lng 44.4, a pin the user did not mean. That is what the bare form `39° 44.4` has done since #541 (#544's finding 3). Ruling 3 sends finding 3 to the spacing round, so it is not fixed here; the brackets now reach it. Confirmed by a one-off probe of `readSearchCoords` on the built code, 2026-11-22: `(39° 44.4)`, `[39° 44.4]` and `39° 44.4` each returned `{"kind":"point","lat":39,"lng":44.4}`. The probe is not a committed test.
   - (c) The "Did you mean" choice can break only between "Did you mean" and the numbers. Where the box is too narrow for the whole sentence the numbers go to the second line together.

   Unchanged, byte-identical: the reading of every string without wrapping brackets (the four ruled formats, every case in `search-coords.test.ts`, #541's mounted cases), the choice's words and its accessible name ("Did you mean 39.7401, -104.9811?"), the 44 px minimum height of the choice, the list's position and width, every API body, the pin path, the road lookup, the bar, the rail, device counts (none touched). Not changed here, by ruling 3: trailing punctuation, `;`, `lat`/`lng` prefixes, the lone degrees-and-minutes case, the ordinal sign, the hidden live region.

   Files and lines predicted:

   | File | Predicted |
   |---|---|
   | `conestruct/site/lib/search-coords.ts` | +16 / -6 |
   | `conestruct/site/lib/search-coords.test.ts` | +35 / -0 |
   | `conestruct/site/components/LocationPickerModal.tsx` | +12 / -4 |
   | `conestruct/site/app/globals.css` | +7 / -0 |
   | `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx` | +65 / -0 |
   | this evidence folder (rulings, red proof, walk script, walk notes, strings, crops) | new |

5. **Proof.** Parser tests for each bracket form (Rule 11: also the mounted flow). Mounted-flow tests on the real modal in `LocationPickerModal.coords-bar.test.tsx`: each form typed in the box places the pin with no `/api/geocode` request; a bracketed saved address does the same at the open-time sender; the choice's numbers are one element and the stylesheet forbids it to wrap. Red-proved on 52b80674's code. A local walk on `next dev` at 1440, 1198x930 and 390 (#543's walk script, adapted): both forms place the pin with 0 geocode requests; at each size the numbers of the choice are on one line, the choice is at least 44 px high, and the map, the search row, the bar and the right panel move 0 px; axe and the 44 px measure on those states. Crops in `shots/`.

## Calls

1. **R145 self-ruled: what counts as "in brackets".** One pair of matching brackets round the whole text: `( … )` or `[ … ]`, the two forms ruling 3 names. Spaces inside the brackets are allowed ("( 39.7401, -104.9811 )"). CHOSEN (Rule 12; no outside source, these are the limits of the ruled forms): not read as coordinates, so still an address as before: a mismatched pair (`(39.7401, -104.9811]`), one bracket alone (`(39.7401, -104.9811`), two pairs (`((39.7401, -104.9811))`), brackets round each number (`(39.7401), (-104.9811)`), curly, angle or full-width brackets (`（39.7401, -104.9811）`, `［39.7401, -104.9811］`), and anything outside the brackets (`(39.7401, -104.9811) Denver`). The ruling names two forms; the rest of #544's punctuation goes to the spacing round.
2. **R145 self-ruled: brackets change nothing else about the reading.** After the brackets are dropped the text goes through #541's reading as it stands, so a bracketed pair that is out of range or the wrong way round gets the same line or choice as the bare pair, and `(1600 80202)` is still an address. Nothing is clamped or swapped silently (Rule 10). Stated as behaviour change (b).
3. **R145 self-ruled: how the numbers stay together.** The numbers and the question mark after them are wrapped in one span with `white-space: nowrap` (one new rule, no token, colour or size). The text of the choice is the same characters as before, so its accessible name and #541's tests don't change. The "?" is inside the span: with it outside, the test library read the button's name as "… -104.9811 ?" (a space before the mark), so #541's test of the name failed; inside, the name is the one #541 pinned.
4. **R145 self-ruled: at 390 the choice is two lines, with the numbers whole on the second.** The floating list is the search box's width (`globals.css`, #541's comment: "The list is the box's width, so it never covers the map's zoom control"). Measured at 390 (`walk.md`, `shots/walk.json`): the whole sentence needs 237.17 px and the button has 234.16 px for text, 3.01 px short. So the line breaks after "Did you mean" and the numbers sit together on the next line, which is what ruling 3 asks ("keeps the numbers together on one line. The pair must not wrap in the middle."). The button is still 44 px high. #544's own acceptance line ("the choice is one line") is stricter than the ruling. Meeting it for this example would take 3 px off the side padding, and a longer pair ("-39.7401, -104.9811") would be two lines again; meeting it always needs a wider list (over the zoom control) or a smaller type size. None of that is ruled, so it isn't done here. For Ryan to see in the crop `shots/390-did-you-mean.png`.
5. **R145 self-ruled: where the tests live.** Parser cases in `lib/search-coords.test.ts`; mounted cases in `components/LocationPickerModal.coords-bar.test.tsx`, #541's suite, which mounts the window and records every `/api/geocode` request at both senders.
6. **R145 self-ruled: the 12 forms that stay an address are tested as controls.** They pass before and after the fix (`red-proof.txt`), and pin the CHOSEN limits of call 1.
7. **Nothing filed, nothing folded.** The rest of #544 (trailing punctuation, `;`, `lat`/`lng` prefixes, the lone degrees-and-minutes case, the ordinal sign, the hidden live region) goes to the spacing round list in handoff.md by ruling 3; the mission's orchestrator writes that entry. The Mapbox controls under 44 px that the walk lists are not this item's: the "Toggle attribution" button is ruling 4's.

## The prediction's amendments

None before the diff. One change during it, inside the predicted files and lines: the question mark went inside the nowrap span (call 3), after #541's own test of the button's name failed with the mark outside.

## Churn: predicted against actual

| File | Predicted | Actual |
|---|---|---|
| `conestruct/site/lib/search-coords.ts` | +16 / -6 | +12 / -1 |
| `conestruct/site/lib/search-coords.test.ts` | +35 / -0 | +49 / -0 |
| `conestruct/site/components/LocationPickerModal.tsx` | +12 / -4 | +10 / -4 |
| `conestruct/site/app/globals.css` | +7 / -0 | +6 / -0 |
| `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx` | +65 / -0 | +66 / -0 |
| this evidence folder | new | new |

The same files as predicted, none added. The parser's test file is 14 lines over: the 12 controls of call 6. No behaviour beyond (a) to (d) changed. In `LocationPickerModal.tsx` the exported `coordsDidYouMean` is replaced by `COORDS_DID_YOU_MEAN` and `coordsPair`; nothing else in the site used it.

## Tests

- Red proof: `red-proof.txt`. On 52b80674's code 13 of the 25 new tests fail; the 12 that pass are the controls.
- The curly-bracket form is one of the 12 controls. The angle and full-width forms were checked by the same one-off probe as (d): each returned `{"kind":"address"}`. They have no committed test.
- After the fix: `lib/search-coords.test.ts`, `components/LocationPickerModal.coords-bar.test.tsx` and `components/tap-targets.test.ts`: 123 passed. `npx tsc --noEmit`: clean.
