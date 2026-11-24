# #565: the map window's search messages move into the right panel

Branch `issue-565-search-messages-in-panel` on `prompt-ux-search-feedback-panel` (`e3646e0b`), which sits on `issue-558-prod-check` (`6afd9094`, the ux-spacing-round production-check evidence commit; it ships with this branch). Mission `ux-search-feedback-panel`, tracking issue #566.

## Ryan's rulings

Ryan, 2026-11-24, `docs/prompts/cc-prompt-ux-search-feedback-panel.md`, verbatim:

> 1. **Nothing floats over the map.** Every message that today shows in the search's floating list moves to the top of the right panel, under "Which road is the work on?":
>    - the town notice (#543)
>    - the weak-match "Closest match…" notice (#554)
>    - the out-of-range line and the "Did you mean <lat>, <long>?" choice (#541)
>    - "No match in Colorado…"
>    - "Plans cover Colorado roads only."
>    - any other line in that list (list each one you move)
> 2. **The look (T1).**
>    - A box on `--pri-off`: one 13.5/600 line saying what happened, then one 13.5 `--ink-on-dark` line saying what to do next.
>    - For a town, for example: "That search found a town, not a street." / "Tap the map on the road where the work starts. The roads near your tap show up here."
>    - "Did you mean …" stays a real button inside the box, at least 44 px.
>    - The road list (or "Tap the map to find the roads.") follows below it.
>    - The box goes away when a pin is placed or a new search starts.
> 3. **Nothing moves.**
>    - The map, the search row, the bar under the map and the footer move 0 px in every state.
>    - The right panel's own content may shift down under the box; that's expected.
>    - At 390, where the panel sits below the map, the box shows at the top of that section and the map still doesn't move.
>    - Screen readers still hear the message (keep a live region).
> 4. Keep the wording of each message unless it's jargon, and list any change. Inter only, tokens only, no new hex, 44 px targets, axe clean. Unslop.

## R145 self-ruled

1. **R145 self-ruled: the heading and "Tap the map to find the roads." show with the box, not on their own.** With no pin the right panel has no road section today. When a message shows and there is no pin, the panel gets "Which road is the work on?", the box, then "Tap the map to find the roads." (ruling 2's words). With no message and no pin the panel is as it was. The other reading (the heading and the tap line always there before a pin) adds words to a state the ruling doesn't name, so it is not built; it is one condition to flip if Ryan wants it.
2. **R145 self-ruled: the town line is "That search found a town or area, not a street."** Ruling 2 gives "a town, not a street" as an example; ruling 4 keeps wording. The notice also shows for a county, a ZIP code or a neighbourhood (`lib/geocode-precision.ts`: every place type but address, poi, intersection, street), where "a town" alone would be wrong. The line keeps #513's "town or area" and takes the ruling's "not a street". The second line is the ruling's, word for word.
3. **R145 self-ruled: a message with two sentences splits at its last sentence; a message with one sentence is the 600 line alone.** No "what to do next" line is invented (ruling 4 keeps the wording). The one-line boxes are listed in `strings.md` so Ryan can rule a second line for any of them.
4. **R145 self-ruled: three jargon lines are reworded (ruling 4).** "Geocoding not configured", "Geocoding failed (<status>)" and the raw network error text (for example "Failed to fetch"). New words in `strings.md`. "didn't answer" follows `LOOKUP_FAILED_LINE` ("The road data service didn't answer.").
5. **R145 self-ruled: the "Did you mean" box holds the button and nothing else.** #541 ruled that for a swapped pair the line is the choice; that is kept. The out-of-range line shows only when there is no swap to offer, as today.
6. **R145 self-ruled: a failed search's box goes away when a pin is placed.** Ruling 2: "The box goes away when a pin is placed or a new search starts." Before, a geocoder error stayed until the next search. Deliberate behaviour change (Rule 5).
7. **R145 self-ruled: failure lines are no longer red.** T1 is one box: the first line 600 in `--ink`, the second in `--ink-on-dark`. Nothing was signalled by the red alone (Rule 13): the words say what failed.
8. **R145 self-ruled: the live region is one `role="status"` element, always mounted in the right panel, not displayed while empty.** The same pattern as the floating list it replaces (`.mw-search-list:empty { display: none }`).
9. **R145 self-ruled, CHOSEN (Rule 12): the box's spacing.** Padding `12px var(--space-block)` and `margin-bottom: 12px` are `.mw-status`'s (the panel's other message box, #507 F1); the 4 px between the two lines is `.mw-head-text`'s gap. No new token, no new size.
10. **R145 self-ruled: the design canvas was not opened.** It is on claude.ai (an outside service); the build follows the ruling's text.
11. **R145 self-ruled: at 390 the window does not scroll itself to the box.** Ruling 3: nothing moves. The walk records where the box sits in the viewport.
12. **R145 self-ruled: with no map the lines still say "Tap the map".** That is #547 (open, named distinct in #565). Not touched. Corrected after the review: this change widens it. With no map, "Tap the map to find the roads." now follows every search message, not only the town notice (`LocationPickerModal.tsx:1674`). Filed as #567.

## Rule 5 churn prediction (written before the diff)

Base: `e3646e0b` (carries `6afd9094`, the #558 production-check evidence commit).

Changes:
- `conestruct/site/components/LocationPickerModal.tsx`: the floating list leaves the search box. The right panel's first section holds the road heading, the live region with the box, and the road list or the tap line. `RoadQuestion` loses its own `<section>` and `<h3>` (hoisted so the box sits between the heading and the list). `COARSE_NOTICE` becomes two lines. New string "Tap the map to find the roads.". A pin clears a failed search's message. The two `catch` blocks show a fixed line, not the raw error text.
- `conestruct/site/app/globals.css`: `.mw-search-list`, its `:empty` rule and `.mw-search-line` go; `.mw-feedback` and its first line come in; `.mw-search-pick` loses its side padding (the box has its own); `.mw-search-box` loses `position: relative`; one rule hides the empty road section.
- `conestruct/site/lib/geocode-precision.ts`: two reworded lines, the no-answer line, and the function that splits a message into its two lines. (This file takes the change out of the cosmetic lane.)
- Tests moved: `LocationPickerModal.coords-bar.test.tsx` (every assertion on `search-list`), `LocationPickerModal.state-contract.test.tsx` (the town line, 3 places), `tap-targets.test.ts` (the floating-list pin), `lib/geocode-precision.test.ts` (the two reworded lines). New: `LocationPickerModal.search-feedback.test.tsx`. Other LocationPickerModal tests may need a selector moved if they pin the road section's markup; any such is listed in the report.

Stays byte-identical:
- Every request: which searches reach `/api/geocode`, which place a pin, when the road lookup runs, the camera. No API route, no backend file, `lib/geocode.ts`, `lib/search-coords.ts`.
- The map column with no message apart from the removed (empty, not displayed) list element: search row, map, bar. The footer. Save's rules.
- The right panel's look with no message. Its markup changes only in that the road heading is the section's child, not the list panel's.
- The meaning of every message. No device count, no distance, no number on a plan.

## Prediction against the diff

Every predicted change happened as written. Three things were not predicted; each was found while building and is inside files the prediction names or is a comment:

- `conestruct/site/app/globals.css`: the `.mw-note-fail` rule is deleted. Its only users were the floating list's failure lines (call 7), so it was dead.
- `conestruct/site/components/LocationPickerModal.manual-entry.test.tsx`: its `errors()` helper read `.mw-note-fail`; with that class gone its four "no error" checks would have passed on anything. It reads the box's lines now.
- `conestruct/site/lib/design/type-exceptions.ts`: one comment ("The search's floating lines reuse .mw-note / .mw-link") now names the box and `.mw-line`. No census row and no pin changes: the box's first line is a `.mw-line` with a modifier that sets no size, so `cssDeclarations` stays 235.

`lib/geocode-precision.test.ts` also gains the tests for `searchMessageLines` (the prediction named only the two reworded lines).

Actual: 10 files under `conestruct/site` (3 source, 1 census comment, 5 tests moved, 1 new test file), 750 insertions and 151 deletions. Tests moved: 54 on the first run after the source change (47 in `coords-bar`, 2 in `state-contract`, 1 in `tap-targets`, 2 in `geocode-precision`, 2 in the type census; the census pair went green by reusing `.mw-line`, not by editing a pin). No other LocationPickerModal test file needed a change. The names are in `first-run-failures.md`.

Nothing predicted to stay byte-identical changed: no API route, no backend file, `lib/geocode.ts` and `lib/search-coords.ts` are untouched.
