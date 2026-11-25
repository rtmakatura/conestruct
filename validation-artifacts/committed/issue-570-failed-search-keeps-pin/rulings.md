# #570 rulings

Session of 2026-11-25. Branch `issue-570-failed-search-keeps-pin`, built on `origin/issue-569-prod-check` (`f7b49e66`, #569's production check, which ships with this).

## Ryan, 2026-11-25 (the /start instruction)

> new small fix, file it first. Two rulings: 1) A search that finds nothing or is refused (typo, out-of-range pair, outside Colorado, no match) leaves the existing pin, road list and pick exactly as they were; only a search that returns a new place clears them (amends #569's ruling 1). 2) Hide the whole "Where the work starts" section, heading included, until a pin exists, so no empty heading shows (e.g. after a town search). Nothing else may move. Add tests that fail on the old code. Build on issue-569-prod-check.

## The cause

1. `onSubmitSearch` (`conestruct/site/components/LocationPickerModal.tsx`) called `resetForNewSearch()` before the text was read as coordinates and before the geocoder was asked (#569 self-ruling 1, "where the clear happens"). Every search cleared the pin, whatever it then found.
2. The "Where the work starts" section always rendered its heading. With no pin and the search's box showing, #567 and #569 hide both of its lines, so the heading stood alone.

## What ruling 1 changes that #569 pinned

Each test was rewritten to the new behaviour and named `(#570)`:

- #569: "it is cleared before the new result shows: while the search is still out, nothing of the old pin is left". Now the pin stays while the search is out and is cleared when a new place comes back.
- #569: a weak match, no match, no answer, an out-of-range pair and "Did you mean" after a pin each cleared it. Now each leaves the pin, the roads and the pick.
- #541 ("a pin already placed stays") and #554 ("a pin already placed stays where it is") are back as they were before #569.
- #565 ruling 2 (the box between the question and the last pin's road list) and #567 ("At your pin." stays under a message) are back for a search that found nothing.

## R145 self-ruled

1. **"Returns a new place" means three answers:** typed coordinates that are in range, a town or area (the map flies there), and a street address. The clear runs when that answer is in hand, just before it is shown.
2. **A weak match clears nothing.** #554 ruled that a weak match "moves nothing": no pin, no fly. The map is still on the old pin, so the old pin, roads and pick stay. A typo is the usual way to get one, and the ruling lists the typo first.
3. **"Did you mean" clears nothing until it is taken.** The swapped pair is refused; pressing the button places the new pin, which replaces the old one by the pin path (as a tap does).
4. **A search with no answer (network) or a failed one (502, 503) clears nothing.** Not in the ruling's list; same case, nothing was found.
5. **The previous search's message still goes when a new search starts** (#565 ruling 2, "the box goes away when ... a new search starts"). Only the pin, roads and pick wait for the answer.
6. **While a search is out, the old pin, roads and pick stay on screen and can be used.** If the answer is a new place they are cleared then. This reverses #569 self-ruling 1 and its "For Ryan" last bullet, by ruling 1.
7. **The pin's own numbers still move nothing** (#538 fold-in (a), #569 self-ruling 5). Unchanged.
8. **What the clear removes is unchanged** (#569 self-rulings 2 to 4): the pin and marker, the road list, the pick, the said direction, the place context, the nearest-only flag, the notices, the saved address text, a marked cross street, and a road lookup still out.
9. **Ruling 2 is taken as written: the section is not rendered at all without a pin**, in a fresh window too. So "Search an address or tap the map to place your pin." and, with no pin, "Tap the map to move it." no longer show there. The window's own line under its title still says "Search an address or tap the map where the work starts, then pick the road." The constant `WORK_START_NO_PIN` has no reader left and is removed.
10. **Not the cosmetic lane**, as #569 self-ruling 8: a behaviour fix with an issue runs the full path.

## For Ryan (none blocks)

- Item 2: a weak match ("Closest match: ...") keeps the old pin. If a weak match should count as a new place, it is a one-line move.
- Item 9: the fresh window loses the line "Search an address or tap the map to place your pin." along with the heading. The title's line says the same thing. To keep that line in a fresh window instead, the section would hide only when it has no line to show.
- Item 6: for the moment a search is out, the old pin's roads can still be picked and saved.
- Found by the diff-verifier: a tap on the map while a town search is still out places a pin, and the town's answer then clears it. On the base the tap stayed (the clear had already run). A street address's answer replaces the tap on both. Not changed here.

## Proof

- Red proof on the base (`f7b49e66`'s `LocationPickerModal.tsx` with this branch's two test files): `red-proof.txt`, 16 failed of 148.
- With the fix: the 13 `LocationPickerModal.*` files, 236 passed (230 on the base).
- `python scripts/cosmetic_lane_check.py`: `IN LANE: all 19 paths are frontend look-only` (from the paths; see item 10).
