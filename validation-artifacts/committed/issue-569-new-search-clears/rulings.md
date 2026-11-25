# #569 rulings

Session of 2026-11-25. Branch `issue-569-new-search-clears`, built on `origin/issue-568-prod-check` (`7f237e5c`, #568's production check, which ships with this).

## Ryan, 2026-11-25 (the /start instruction)

> new bug from Ryan's browser check, file it first: after searching "1437 Bannock St, Denver" and then "Lafayette, CO", the map moves to Lafayette but the Bannock state stays: the "No mapped road runs within 30 m" box, the three Denver roads and "Pin at 39.7392, -104.9910". Picking a road would place the plan in Denver. Ruling: starting a new search clears the previous pin, road list, saved choice and every message before the new result shows, exactly like a fresh window; add a test that fails on the old code. Also restyle the 30 m notice to the same --pri-off box as the town notice (no --vd-flag-ground / warn border), and hide "Tap the map to move it." while any message box shows. Build on the newest evidence branch.

## The cause

`onSubmitSearch` (`conestruct/site/components/LocationPickerModal.tsx`) cleared only the town notice before asking the geocoder. The pin's road list, pick and nearest-only flag were cleared only in `detectAt`, which runs only when a search places a pin. A search that ends with no pin (a town, a weak match, a failed search, refused coordinates) left the last pin and its roads under the new message.

## What the ruling changes that earlier work pinned

Ryan's ruling of 2026-11-25 replaces these; each test was rewritten to the new behaviour and named `(#569)`:

- #541: a refused pair left a placed pin in place ("a pin already placed stays"). Now the search clears it.
- #554: a weak match "moves nothing", which included leaving a placed pin. It still places no pin and flies nowhere; the search that found it now clears the pin placed before.
- #565 ruling 2 test: a message box over the last pin's road list. That state no longer follows a search.
- #567: "At your pin." stayed under a search's message. The pin is cleared, so the line goes too.

## R145 self-ruled

1. **Where the clear happens.** At the top of `onSubmitSearch`, before the coordinates are read or the geocoder is asked, so nothing of the old pin shows while the search is out ("before the new result shows"). An empty search box still does nothing.
2. **What "like a fresh window" clears.** The pin and its marker, the road list, the pick, the said direction (`roadAxis`), the place context, the nearest-only flag, the town/weak notice, the search's error or refusal line, and a road lookup still in flight (its token is bumped, so its late answer is dropped).
3. **The text saved as the address is cleared too.** It was the old search's text; a search that places a pin sets it again. Without this, Bannock, then Lafayette, then a tap would save a Lafayette pin under "1437 Bannock St, Denver". Not listed in the ruling; same failure, one line.
4. **A marked cross street is cleared too** (near-intersection plans). It was marked against the old pin's road. Not listed in the ruling; same failure.
5. **The pin's own numbers are not a new search.** #538's fold-in (a) stays: searching the coordinates the pin already has moves nothing and keeps the road pick. Nothing stale can show, because the place is the same.
6. **"Any message box"** for hiding "Tap the map to move it." means three: the search's box, the nearest-only notice, and the road lookup's own message (failed, or no road found). The "Finding the roads here…" line is not a box and does not hide it.
7. **The 30 m notice takes the town notice's classes** (`.mw-feedback`, first line `.mw-line.mw-feedback-what`), so it is the same box by construction. No CSS changed. Its first line goes from `.mw-sub` to the town notice's first-line style.
8. **Not the cosmetic lane.** `scripts/cosmetic_lane_check.py` answers `IN LANE: all 17 paths are frontend look-only` from the paths, but the change is a behaviour fix with an issue, so it ran the full path: the diff-verifier, local checks, the CI wait.

## For Ryan (none blocks)

- Items 3 and 4 clear two things the ruling did not name (the saved address text, a marked cross street).
- Item 5 keeps one search that does not clear (the pin's own coordinates).
- A search that fails or is refused now also removes the pin that was there. That follows from "exactly like a fresh window"; it reverses #541's "a pin already placed stays" by this ruling.
- While a search is out, the panel is the empty no-pin panel for a moment before the new result fills it.

## Proof

- Red proof on the base (`7f237e5c`'s sources with this branch's two test files): `red-proof.txt`, 14 failed of 142.
- With the fix: the 13 `LocationPickerModal.*` files, 230 passed (219 on the base).
