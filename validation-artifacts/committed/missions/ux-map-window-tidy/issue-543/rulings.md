# #543: the map window's notices float

Mission `ux-map-window-tidy` (tracking #546), item #543. Branch `issue-543-notices-float`, stacked on `prompt-ux-map-window-tidy` (5ab10324).

## The rulings

Ryan, 2026-11-22 (`docs/prompts/cc-prompt-ux-map-window-tidy.md`), verbatim:

> 2. **#543: notices float.** The coarse-match notice and the bearing note move into the search's floating list over the map, the same place as #541's out-of-range line. The map column, the search row and the right panel move 0 px whenever either one shows. Measure it. Their wording stays the same unless it uses jargon; list any change.

> 5. Inter only, tokens only, no new hex, 44 px targets (apart from #505's exception), axe clean. List every new string with its source. Unslop.

## Plan (the prediction below was written before the component diff)

1. **Problem.** `conestruct/site/components/LocationPickerModal.tsx` at 5ab10324: the coarse-match notice (`:1560`, `{coarseNotice && <p className="mw-note">…`) sits in the map column's flow between the search row and the map, and the bearing note (`:1589`, `{bearingWarning && <p className="mw-note">…`) sits in the flow under the coordinates line. A line that appears in the flow takes height from the map (two columns) or pushes the map, the coordinates line and the right panel down (one column).
2. **Rulings.** 2 and 5 above.
3. **Change.** Both lines render inside #541's floating list (`.mw-search-list`, `position: absolute`, under the search box, over the top of the map), each as `<p className="mw-note mw-search-line">`. The two in-flow `<p>`s go. The CSS comment above the list names the notices. No new CSS rule is expected: the list, its ground, its edge and the line's padding are #541's.
4. **Rule 5 churn prediction.** Stated behaviour changes:
   - (a) The coarse-match notice shows in the floating list over the top of the map. It no longer takes any height in the map column.
   - (b) The list is `role="status"`, so the coarse-match notice is now announced to a screen reader when it arrives (in the flow it was a plain paragraph).
   - (c) The bearing note's slot moves into the same list. See call 1: it has had no words since #507, so nothing visible changes for it.

   Unchanged, byte-identical: the notice's words (`COARSE_NOTICE`), when it shows and when it goes (both geocode paths set it; a new search or a placed pin clears it), every API body and payload, the coarse zoom, the pin, the road lookup, the bar, the rail, the search's error line and the "Did you mean" choice, device counts (none touched).

   Files and lines predicted:

   | File | Predicted |
   |---|---|
   | `conestruct/site/components/LocationPickerModal.tsx` | +12 / -5 |
   | `conestruct/site/app/globals.css` | +4 / -3 (the comment only) |
   | `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx` | +75 / -0 |
   | this evidence folder (rulings, red proof, walk script, walk notes, strings, crops) | new |

5. **Proof.** Mounted-flow tests (Rule 11) on the real modal in `LocationPickerModal.coords-bar.test.tsx` (#541's suite: it mounts the window with a map and answers both geocode senders): after a coarse search, and after the open-time lookup of a coarse saved address, the notice is inside the search's floating list and the map column has no note of its own in the flow; a source pin for the bearing note's slot (it can't be mounted, call 1). Red-proved on 5ab10324's component. A local walk on `next dev` at 1440, 1198x930 and 390 (the #541 walk script, adapted): the boxes of the map, the search row, the bar and the right panel with the notice not shown and shown, axe on the dialog in each state, the 44 px measure, and the crops, in `shots/` here.

## Calls

1. **R145 self-ruled: the bearing note has no words, so only its slot moves.** `bearingWarning` is state that nothing sets to a string. #507 (1c2d99db) removed its four setters ("Couldn't reach road-detection service.", "Road detection is unavailable right now…", "No road detected within 30 m…") and put those messages in the right panel's road question ("the panel's plain message and Try again say it", `LocationPickerModal.tsx:803`). At 5ab10324 the only calls are `setBearingWarning(null)` (`:779`, `:817`). So the note can't show in the window, in the flow or anywhere else, and it can't be walked, cropped or measured. This item moves its render into the floating list as ruled, so if a later change gives it words they float. The acceptance "the same for the bearing note" holds trivially: a line that never shows moves nothing. The state is not deleted here: the ruling says move, and deleting is a different change. No crop or measure of the bearing note is faked.
2. **R145 self-ruled: the wording stays.** "That search found a town or area. Tap the map on the road where the work starts." has no jargon and breaks no unslop rule (`docs/style.md`), so ruling 2 keeps it word for word. No string is new or changed (`strings.md`).
3. **R145 self-ruled: the notice keeps its quiet colour and comes first.** It is guidance and not an error, so it stays `.mw-note` (`--ink-faint`) and does not take `.mw-note-fail`; in the list it gets `.mw-search-line`, #541's 8 px / 12 px padding. It renders first in the list, the bearing note's slot last. No new CSS rule, token or colour.
4. **R145 self-ruled: the notice is announced.** The list is `role="status"` (#541), so a screen reader now hears the notice when it arrives. In the flow it was a silent paragraph. Stated as behaviour change (b).
5. **R145 self-ruled: what the notice covers.** The list is the search box's width and starts 4 px under it, so the notice lies over the top of the map: 23.5 px at 1440 (one line), 41 px at 1198 (two lines), 58.5 px at 390 (three lines), measured. That strip can't be tapped while the notice shows; the rest of the map can, and the walk's tap under it placed the pin at all three sizes. The notice goes when a pin is placed or a new search runs, as before. It never reaches the zoom control (the list stops at the search box's right edge). The issue named this cost; ruling 2 chose the floating list with it.
6. **R145 self-ruled: where the tests live.** `LocationPickerModal.coords-bar.test.tsx`, #541's suite for the floating list, because it mounts the window with a map and answers both geocode senders. The existing coarse-search tests in `LocationPickerModal.state-contract.test.tsx` find the notice by its words and pass unchanged.
7. **Nothing filed, nothing folded.** No follow-up came out of this item. One thing for Ryan to see in the report: the bearing note is dead state (call 1). Deleting it (`bearingWarning`, two `setBearingWarning(null)` calls, the slot) is about 5 lines and needs his word, since ruling 2 says move.

## The prediction's one amendment

Made before the diff: the tests go in `LocationPickerModal.coords-bar.test.tsx`, not `LocationPickerModal.state-contract.test.tsx` as first written. The state-contract suite runs without a map, so it can't reach the open-time lookup; the coords-bar suite covers both senders.

## Churn: predicted against actual

| File | Predicted | Actual |
|---|---|---|
| `conestruct/site/components/LocationPickerModal.tsx` | +12 / -5 | +6 / -3 |
| `conestruct/site/app/globals.css` | +4 / -3 (the comment only) | +2 / -1 (the comment only) |
| `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx` | +75 / -0 | +78 / -0 |
| this evidence folder | new | new |

The same files as predicted, none added. No behaviour beyond (a) to (c) changed.

## Strings

See `strings.md`: none new, none changed.
