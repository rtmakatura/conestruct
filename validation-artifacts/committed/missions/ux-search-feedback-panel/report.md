# Mission ux-search-feedback-panel: report

2026-11-24. Tracking issue #566. Prompt: `docs/prompts/cc-prompt-ux-search-feedback-panel.md` (Ryan's rulings 1 to 4, option T1). One item, #565, done.

## Questions for Ryan

Nothing is parked. Five calls for your eye at the hand check; none blocks the ship.

1. **The town line says "a town or area, not a street."** Your example reads "a town, not a street." The notice also shows for a county, a ZIP code or a neighbourhood, where "a town" alone would be wrong. Recommended: keep "town or area". This is the one call that departs from a ruling's quoted words.
2. **Six boxes have one line, not two.** Outside Colorado, no match with no reason, "Add a city to search cross streets.", both range lines, and "Address search isn't set up here." No second line was invented for them. Recommended: keep; rule a second line for any you want.
3. **A failed search's message now goes away when a pin is placed.** Before, it stayed until the next search. Your ruling 2 says the box goes away on a pin, so this follows it; it is a behaviour change all the same.
4. **Failure lines are no longer red.** The T1 box has one look for every message.
5. **The weak-match box says "Check the pin before you go on." while the bar says "No pin yet".** The words are your #554 ruling, kept under ruling 4. They now sit right above "Tap the map to find the roads." Recommended: look at it in the preview and say if the line should change.

Also for the hand check: the crops are drawn in the fallback face, not Inter (the dev server served the fallback), so line breaks may differ slightly in the preview.

## Ready to ship

Top branch: `issue-565-search-messages-in-panel`.

Chain, all pushed:
- `6afd9094` `issue-558-prod-check` (the ux-spacing-round production-check evidence; it ships with this)
- `e3646e0b` `prompt-ux-search-feedback-panel` (the prompt, tracked in `docs/prompts/`)
- `033176b3` `issue-565-search-messages-in-panel` (#565)
- this report, on the same branch

## Filed

- #565 the item: https://github.com/rtmakatura/conestruct/issues/565
- #566 the tracking issue: https://github.com/rtmakatura/conestruct/issues/566
- #567 the reviewer's three code lows: https://github.com/rtmakatura/conestruct/issues/567

## Calls I made

Orchestrator:
- The item is `OUT OF LANE` (it edits `lib/geocode-precision.ts`), so both gates ran.
- The reviewer's code lows (its findings 1, 2 and 6) are filed as #567, not repaired, so the gates' PASS stands on the code they read.
- The untracked prompt copy in the main checkout moved to `validation-artifacts-extra/ux-search-feedback-panel/cc-prompt-untracked-copy.md` after a byte comparison with the committed one.

Item #565 (each recorded as "R145 self-ruled" in `issue-565/rulings.md`):
1. The heading and the tap line show only together with the box; with no pin and no message the panel is as it was.
2. Town line 1 is "a town or area, not a street" (question 1 above).
3. No invented second lines (question 2).
4. Three jargon lines reworded: "Geocoding not configured" is "Address search isn't set up here."; "Geocoding failed (N)" is "Address search failed (N). Try again."; the raw network error text is "The address search didn't answer. Try again."
5. The "Did you mean" box holds the button alone, as #541 had it.
6. A failed search's message clears on a pin (question 3).
7. Failure lines are not red (question 4).
8. The live region keeps the old list's pattern: always mounted, not displayed while empty.
9. Box spacing is CHOSEN: `.mw-status`'s padding and 12 px below, `.mw-head-text`'s 4 px line gap.
10. The design canvas was not opened (an outside service); the build follows the ruling's text.
11. No automatic scroll to the box at 390; the whole box is on screen without scrolling there.
12. With no map the lines still say "Tap the map" (#547). Corrected after the review: this change widens it to every message (#567).

## Flakes

None. No test run failed after the build was finished.

## Item #565: search messages move into the right panel

**Change.** The floating list under the search box is gone. Every message it held shows in a box at the top of the right panel, under "Which road is the work on?" and above the road list (or "Tap the map to find the roads." with no pin). The box is on `--pri-off`, first line 13.5/600, second line 13.5 `--ink-on-dark`. "Did you mean …" is a button, 44 px high. The box is one `role="status"` element. It goes away on a pin or a new search.

**Messages moved:** the town notice, the weak match, no match (city, address, no reason), outside Colorado, "Add a city to search cross streets.", both range lines, the "Did you mean" choice, search not set up, search failed, no answer. Old and new words: `issue-565/strings.md`.

**Churn.** 10 files under `conestruct/site`, +750/−151. Predicted: `LocationPickerModal.tsx`, `globals.css`, `lib/geocode-precision.ts`, and the tests in coords-bar, state-contract, tap-targets and geocode-precision, plus the new test file. Not predicted, recorded in `rulings.md`: the dead `.mw-note-fail` rule deleted; `manual-entry.test.tsx`'s helper moved to the box; one comment in `lib/design/type-exceptions.ts`. No API route, backend file, `lib/geocode.ts` or `lib/search-coords.ts` changed.

**Tests** (changed files only):
- Baseline on the base sources: 23 files, 311 passed.
- Red proof: the new test file on the base sources: 35 failed, 1 passed of 36 (`issue-565/red-proof.txt`).
- After: 24 files, 356 passed. `tsc --noEmit` exit 0. ruff "All checks passed!"; mypy "Success: no issues found in 49 source files".
- CI on `033176b3`: Frontend tests and Python tests both green.

**Walk** at 1440x900, 1198x930 and 390x844, ten states each, geocoder and road lookup stubbed in the browser (`issue-565/walk.md`, `shots/walk.json`):
- The map, the search row, the bar under the map and the footer moved 0 px.
- Nothing is positioned over the map.
- axe 0 in all 30 runs.
- No control of ours under 44 px. Mapbox's own attribution button is 24 x 24 at 1198 (the open question in #505).
- At 390 the panel only grows in height (125.25 to at most 450) and the whole box is on screen without scrolling.
- Crops: `issue-565/shots/` (30 PNGs).

**Gates: one round.**
- Lane check, first line: `OUT OF LANE: 3 of 86 paths fall outside`
- Diff-verifier: "VERDICT: PASS" (marker `6015ef88d776`). Two write-up lows: check the commit trailer (checked; it is the right one for this session); it could not prove from git that the churn prediction was written before the diff.
- Independent reviewer: "REVIEW: PASS". It opened all 30 crops. Seven lows:
  1. With no map, "Tap the map to find the roads." follows every message. Code half filed as #567; write-ups corrected.
  2. The live region's section is hidden while empty. Filed as #567.
  3. The crops are in the fallback face and the script's Inter check proves nothing. Write-up corrected.
  4. #505 is an open question, not a ruled exception. Write-up corrected.
  5. The search box's narrower width while "Searching…" shows was not in the table. Write-up corrected.
  6. Focus after "Did you mean" is not pinned by a test. Filed as #567.
  7. "Check the pin before you go on." beside "No pin yet" (question 5 above).

**Write-up-only fixes made after PASS** (no gate re-run; no code file touched):
- `issue-565/walk.md`: #505 named as an open question; the search box's "Searching…" width added; the fallback-face note added.
- `issue-565/rulings.md` call 12 and `issue-565/strings.md` "Not in the box": corrected to say the change widens #547, with #567 linked.
- The commit message: "no control of ours under 44 px" with the Mapbox button named; the fallback-face line; the three known lows with #567.

## After the ship

Production check at 1440x900, 1198x930 and 390x844 on the real site, read-only: the six states (town `Lafayette, CO`; weak match `39 N, 44.4`; out of range; "Did you mean" `-104.9811, 39.7401`; no match; outside Colorado) each show the box in the right panel and nothing over the map; the 0 px measure; axe; the 44 px measure; the box gone after a pin. Evidence goes on a new evidence branch. Then close #565 and #566. Browser check for Ryan: the map window (visible design).
