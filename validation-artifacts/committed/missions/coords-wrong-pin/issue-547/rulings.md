# #547: rulings and calls

Mission `coords-wrong-pin` (tracking #549), item #547, findings 1 to 3.

## The rulings

Ryan, 2026-11-23 (`docs/prompts/cc-prompt-coords-wrong-pin.md`), verbatim:

> 2. **The dead bearing note (#547).** Delete the bearing-note state, its empty slot and any code that can no longer run (it has had no setter since #507). Record what was removed. Nothing visible changes.

> 3. Inter only, tokens only, no new hex. List every new string with its source. Unslop.

Ruling 3 here: no string is new or changed, no hex is new, no font or token changes. There is nothing to list.

## Calls

1. **R145 self-ruled: the note is dead, so the delete goes ahead.** Checked before the diff, on the base (65615703): `git grep -n -i bearingWarning` finds the declaration (`LocationPickerModal.tsx:485`), two `setBearingWarning(null)` calls (`:782`, `:820`), the slot (`:1560`) and the source-text test, and nothing else in the repo's code. `git log -S"setBearingWarning(" -- conestruct/site` lists four commits; the last is #507 (1c2d99db), whose diff removes the four calls that passed a string ("Couldn't reach road-detection service." twice, and two longer lines) and keeps the two `null` calls. No setter passes a string, so nothing was parked.
2. **R145 self-ruled: the section heading goes with the state.** `LocationPickerModal.tsx:484` (`// ---- Bearing detection warning ----`) headed only the deleted state. Left in place it would head `roadAxis`, which is not a warning.
3. **R145 self-ruled: no CSS rule is removed.** The slot used `.mw-note` and `.mw-search-line`, and sat in `.mw-search-list`. All three are still used by the coarse-match notice and the search's own lines (`LocationPickerModal.tsx:1541-1559`). Only the comment at `globals.css:5490` changes. No helper, constant or string was used only by the note (its strings went in #507).
4. **R145 self-ruled: the `describe` comment in the test file is reworded.** `LocationPickerModal.coords-bar.test.tsx:437-438` says "the coarse-match notice and the bearing note are lines in the search's floating list". Same claim as finding 2, in the file finding 3 already touches.
5. **R145 self-ruled: finding 8 is folded in (R154 fold test).** `LocationPickerModal.coords-bar.test.tsx:581-585` puts quote marks round ruling 1 of `docs/prompts/cc-prompt-ux-map-window-tidy.md` with its three bullets joined into one sentence. It is in a file this branch touches, needs no ruling or source, is a comment of about six lines, and was added to the churn prediction before the diff. The comment now gives the three bullets in its own words with no quote marks, and points at the prompt for the exact text.
6. **R145 self-ruled: finding 4 is not folded in.** The issue says the title at `:475` says "tap". At the base the title is "a pin placed after the notice takes the line away; the flow is still the same", and the test places the pin by searching coordinates, so the title is true as worded. The gap the finding names (no mounted test for the map tap) is finding 7's kind of work, not a title fix. It stays with #547's open findings.
7. **R145 self-ruled: the before run is the same worktree before the edit.** The worktree was created at the base, so the walk ran on it first (base code), then again after the edit, with the same script, server and sizes. No `git archive` copy was needed, and #543's committed numbers were not reused because they have no out-of-range state.
8. **R145 self-ruled: the `describe` title stays.** "#543: the notices float in the search's list" (`LocationPickerModal.coords-bar.test.tsx:443`) still says "notices". It is a test name that #543's evidence cites, and the comment above it now says which notice is left.

## The cosmetic lane check

`python scripts/cosmetic_lane_check.py` in the worktree, with the diff uncommitted. Its default range starts at `origin/main`, so it also reads the two commits this branch is stacked on:

> OUT OF LANE: 1 of 42 paths fall outside
>   docs/prompts/cc-prompt-coords-wrong-pin.md -- outside the frontend (backend, tests, scripts or repo config)

The one path outside is the prompt file from the base commit (65615703), not this item's diff. With `--base HEAD` (this item's files only): "IN LANE: all 17 paths are frontend look-only".

## Not in this item

#547 findings 4 to 7 stay open on the issue. Nothing was parked.
