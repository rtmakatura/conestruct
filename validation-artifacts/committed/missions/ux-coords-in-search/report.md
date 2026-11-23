# Mission ux-coords-in-search: report

*2026-11-22. Tracking issue #542. Prompt: `docs/prompts/cc-prompt-ux-coords-in-search.md` (Ryan's rulings of 2026-11-22). One item, #541.*

## Questions for Ryan

Nothing is parked. Three things to judge in the preview or browser check:

1. **The dot beside "No pin yet".** The bar keeps #537's mark in both states, and it renders in the pin's orange even with no pin. Recommended: judge it in the hand check; a one-line follow-up if you want it grey before a pin.
2. **The "Did you mean" choice at 390 wraps** between latitude and longitude (`issue-541/shots/390-did-you-mean.png`). Filed in #544. Recommended: fix it in the spacing round.
3. **#543 needs your ruling:** the coarse-match notice and the bearing note still sit in the flow and resize the map column. Where should they go? Recommended: into the same floating list.

## Ready to ship

Top branch: **`issue-541-coords-in-search`**.

Chain, all on main `89d5f9e`:

1. `c4f29bd` `issue-539-prod-check` (the ux-map-corner-coords production-check evidence; ships with this)
2. `5074c98` `prompt-ux-coords-in-search` (the prompt, now tracked in `docs/prompts/`)
3. `53f802b` `issue-541-coords-in-search` (#541)
4. this report, on the same branch

## Filed

- #541 the item: https://github.com/rtmakatura/conestruct/issues/541
- #542 tracking: https://github.com/rtmakatura/conestruct/issues/542
- #543 follow-up (item sub-agent): the coarse-match notice and the bearing note resize the map column; needs a ruling. https://github.com/rtmakatura/conestruct/issues/543
- #544 follow-up (reviewer's low code findings): the 390 wrap, three parser edges, the hidden live region. https://github.com/rtmakatura/conestruct/issues/544

## Calls I made

Orchestrator:

- **Base:** `issue-539-prod-check` `c4f29bd`, as asked; `origin/main` is its ancestor, so no rebase.
- **The prompt** is committed alone on `prompt-ux-coords-in-search`; the untracked copy moved to `validation-artifacts-extra/ux-coords-in-search/cc-prompt-untracked-copy.md` in the main checkout (byte-identical, checked with `cmp` before the move).
- **No round two.** Both gates passed in round 1. The reviewer's low code findings (1 to 4 and 10) are filed as #544 and not repaired, to stay inside the gate budget. None breaks a ruling.
- **#540** is not closed yet; it closes with #541 after the ship, since its button ships out with this branch.

Item #541 (each recorded as "R145 self-ruled" in `issue-541/rulings.md`):

1. The floating list did not exist (the ruling calls it "existing"; the old error line sat in the flow and resized the map). It is built here, and the geocoder's error line moved into it too.
2. What the one line says: the swap choice when a swap is valid; otherwise the range line; unreadable coordinates get "Use decimal degrees, like 39.7401, -104.9811".
3. Degree forms: the sign is optional, the hemisphere letter may come before or after, either order when letters name the axis. A minus sign with a letter, or two letters on one axis, is refused with a line.
4. CHOSEN: what counts as coordinates. A comma, decimal point, degree sign or sign marks a pair; two bare whole numbers with a space (`1600 80202`) stay an address.
5. The swap is offered only for a bare pair that is out of range as typed.
6. A saved address that is coordinates places the pin on open and is not geocoded.
7. With no Mapbox token, the search box is the way in.
8. The pin's own numbers keep the road pick (#538's fold-in).
9. A coordinates search leaves the plan's address text alone.
10. The search box's accessible name follows the placeholder; two verify scripts that find the box by label were updated.
11. `user-select: all` on the numbers.
12. CHOSEN layout: the list sits 4 px under the box at the box's width, `--da-ground`, `--rule`, `z-index: 3`.
13. The dot stays in both states (question 1 above).
14. A refused-coordinates line clears on edit or on any new pin; a geocoder error stays until the next search, as before.

## Flakes

- One of twelve live road lookups went unanswered in the first walk run (1440, `39.7401 -104.9811`). The second run was clean; the walk script now presses Try again and records it.
- No test flakes.

## Item #541: coordinates in the search box; read-only coordinates line

**Change** (`53f802b`):

- Coordinates typed or pasted in the search box place the pin, zoom as #538 does and run the road lookup. The new parser `conestruct/site/lib/search-coords.ts` runs before both geocode senders in `LocationPickerModal.tsx`; nothing coordinate-shaped goes to `/api/geocode`.
- Out of range: one line in a floating list over the map. A valid swap shows as a 44 px choice, "Did you mean 39.7401, -104.9811?".
- The bar under the map only reads: "No pin yet" or "Pin at 39.7401, -104.9811", 44 px. The boxes, Go, Cancel, the hint and the "Enter coordinates" button are gone (#540's button with them).
- Placeholder: "Address, intersection or coordinates".

**Lane check:** `OUT OF LANE: 5 of 77 paths fall outside`, so both gates ran.

**Tests** (changed files only; the full suites run in CI):

- Item sub-agent: baseline 18 files / 205 passed; after, 35 files / 354 passed; `tsc --noEmit` exit 0.
- Red proof: 26 of the 30 new mounted-flow tests fail on `5074c98` (`issue-541/red-proof.txt`).
- Diff-verifier's run: "Test Files 23 passed (23)", "Tests 289 passed (289)"; tsc clean.
- The commit hook's ESLint and TypeScript passed.

**Measurements** (`issue-541/walk.md`, `shots/walk.json`): the map, bar, search row and dialog move 0 px across no pin, out of range, "Did you mean" and pin at 1440, 1198x930 and 390. The bar is 44 px in all four states. axe 0 in 12 runs. No control under 44 px. At 390 the right panel grows in height (125.25 to 341.25) when the road list loads; nothing above it moves.

**Gates, round 1 of 1:**

- Diff-verifier: "VERDICT: PASS" (marker `d233c29cd28f`). Findings: none blocking.
- Independent reviewer: "REVIEW: PASS". No blockers; eleven low notes.

**Write-up-only fixes after PASS** (no gate re-run):

- `issue-541/rulings.md:72`: the mounted flow covers eight formats, not six.
- `issue-541/walk.md:45`: the smallest width and the smallest height are from different controls; said so.
- `issue-541/walk.md:75`: the six 1440 and 1198 format crops are cut above the pin; said so, with the camera in `walk.json`.
- The commit message: "#540 closes with this" reworded to "is done with this", so GitHub can't read it as a closing keyword.

**Rule slips by the item sub-agent:**

- The parser file was written a few minutes before the churn prediction was on disk (Rule 5; recorded in `rulings.md`).
- It combined `cd` with a write three times (two red-proof runs, one `rulings.md` update). No `rm`; the files landed where intended.
- The committed crops are 6.0 MB, about three times the last mission's.
- The red proof used a temporary directory junction to the worktree's `node_modules`, removed after each run.

**Leftover processes:** none after the item (checked by command line).

## After the ship

Production check for #541 at 1440, 1198x930 and 390, read-only, on a new evidence branch:

- each of the four ruled formats places the pin, zooms to 16 and loads the road list, with no `/api/geocode` request;
- the out-of-range line and the "Did you mean" choice float; the map and the panel move 0 px;
- the bar reads "No pin yet" / "Pin at …" at 44 px;
- axe, 44 px, console.

Then close #541, #540 and #542. Browser check for Ryan: the map window (visible design).
