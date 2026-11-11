# Mission move-walk-side-line: report

Tracking issue #494. 2026-11-10. Two items: #489, then #488, each on its own branch, stacked on the pending evidence branch `mission-retap-prod-check` `35aef83` (already on main `8c1f69d`).

## Questions for Ryan

None. Nothing parked, and no device count changed. Two things to know:

1. **A crop rule was broken.** Before a rerun, the #488 item agent deleted two error screenshots from its first failed local walk (`1440x900-error.png` and `390x844-error.png`; the stub backend was missing its secret and Mapbox token). That breaks "move, never delete" for crops, and the two files are gone. Every other crop was moved to `validation-artifacts-extra/move-walk-side-line/`.
2. **A secrets file was copied.** The #488 item agent copied the gitignored `conestruct/site/.env.local` from the main checkout into `.claude/worktrees/issue-488` so its local servers could run. `git check-ignore` confirms the file is ignored, and both gates found no secret in any committed file. The copy is still in that worktree.

## Ready to ship

**Top branch: `issue-488-edit-on-map-line`, tip = this report's commit.** CI is green on `bf5d12e`. The chain, all pushed:

- `35aef83` `mission-retap-prod-check`: the retap-and-cap production-check evidence, which ships with this chain
- → `173f30b` `issue-489-move-walk-pick`: #489
- → `bf5d12e` `issue-488-edit-on-map-line`: #488
- → this report

## Filed

- #504 https://github.com/rtmakatura/conestruct/issues/504: the WHERE band's `EDIT_REASKED` comment is incomplete after #488. It also asks to check the aerial caption ("Approaches lay out after you confirm the kind" while the kind is answered) and the direction in the summary after the side is cleared. These are #488's round-2 reviewer nits; the caption and summary are not caused by #488. Priority low.
- #505 https://github.com/rtmakatura/conestruct/issues/505: the 44 px checks disagree. The #489 walk counts Mapbox's logo and attribution links on the WHERE frame (7 under 44 px, up from 2). #494's earlier checks reported 0. Priority low.

## Calls I made

- I used #494 as the tracking issue instead of filing a new one. It already listed both items (R145 self-ruled).
- I ran the gates myself, as the orchestrator. #489's item agent had run its own diff-verifier, and I didn't count that run.
- I kept the commit trailer as Claude Opus 5.5, as this session's attribution instructs. #489's diff-verifier suggested "Sonnet"; I set that aside.
- #488's round-2 findings were handled as write-up fixes or follow-ups, not code changes:
  - the stale code comment went to #504 (the gate budget files round-2 findings);
  - the citation range and the untested-path note were fixed as write-up only.
- The items' own calls are in their `rulings.md`:
  - #489: fix the check, not the picker; a 90 s wait (CHOSEN, the value the check already used); copy the old walk forward instead of editing the archived one; no unit test.
  - #488: G1 (the line is decided by the cause, not the door, so "Use the big map instead" and the no-aerial "Edit on map" also show it) through G4.

## Flakes

None. No full suite ran locally. CI ran both suites on `bf5d12e`.

## Leftover processes

None found after either item: no process whose command line names the issue-489 or issue-488 worktree. #488's dev server (:3488) and stub backend (:8488) were stopped by their process trees.

---

## #489: the Move walk picks the road on live data

- **Issue:** #489. Ryan hand-checked Confirm → Edit → Move → Done on prod on 2026-11-10 and it works, so this was a test-tool bug.
- **Cause:** in Move, the picker opens with the old road still picked, so Save & Close is already enabled. The check's `search()` waited for "the road list, or an enabled Save & Close". That returned 2 ms after the SEARCH click, before the road lookup was sent, so the Colfax row was never clicked. The before-fix probe on prod is in `issue-489/logs/probe-move-pick-before.txt`.
- **Change:** `scripts/verify-columns-end-together.mjs`, `search()` only, +11/−2. It waits for this search's own `/api/road-bearing` answer, clicks the row by `role=radio`, and fails with a named error if Save & Close is still disabled 5 s later. The #486 walk was copied forward to `issue-489/script/walk-485-move-prod.mjs` with the same fix, plus step E (Edit → Move → Done after Confirm). Churn was predicted at about 15 lines in `search()`; it came to +11/−2.
- **Prod results (served `8c1f69d`):**
  - The 6 Move states of #490's check: PASS 36/36, 0 px, at 1024, 1198 and 1440, at 100% and 200% text. The states phase overall: 23 states × 6 runs, RESULT PASS.
  - #485 step C (before Confirm) and step E (after Confirm) at 1440, 1198 and 390: PASS. The side was cleared and asked again with "Your edit changed the road or the work start, so this is asked again." The kind and the length (600) were kept.
  - axe 0, console 0, token scan 0.
- **Tests:** the scripts have no unit tests, and `node --check` passes. The red proof is the before-fix prod probe.
- **Gate round 1 (one round used):**
  - diff-verifier: "VERDICT: PASS" (marker: 0 code files, hash 2e8fb105bed6).
  - independent reviewer: "PASS".
- **Write-up-only fixes after PASS:** in `outcome.md`, the under-44 px count is now "7 per step, except 5 at 1440's D-reopened-after-confirm step". The healthz line no longer claims a logged "before and after" reading.

## #488: "Edit on map" says why the side is asked again

- **Issue:** #488, following #440 ruling 2 (`validation-artifacts/committed/ux-group4-cross-street/rulings.md:8`): "the side answer is cleared and re-asked with one line saying why". X21 is at line 44 of the same file.
- **Change:** `conestruct/site/components/bands/WhereBand.tsx`, +16 lines (one ref and one effect). The line shows when the Edit panel is closed and a single scenario write both clears an answered side and moves the pin or changes the confirmed road. The side question then shows #485's `EDIT_REASKED` line, from its one producer; `WhereQuestions.tsx` is unchanged. The line does not show for a Save that changes nothing, a move while the side is unanswered, the side's Undo, a kind change (X21's line shows instead), or the Edit panel's Cancel. No wire field, API route, backend or device count changed. Churn was predicted at `WhereBand.tsx` only, about 20 lines, plus one test; it came to +16 plus the test.
- **Cosmetic-lane check:** "OUT OF LANE: 1 of 41 paths fall outside". That path is #489's script in the chain. On the item's own 3 paths it reads "IN LANE: all 3 paths are frontend look-only". Both gates ran anyway, because the change alters when a line shows.
- **Tests:**
  - The new `WhereBand.edit-on-map-line.test.tsx` failed on the old code ("Tests 2 failed | 2 passed (4)") and passes on the fix ("Tests 4 passed (4)").
  - The affected files: "Test Files 16 passed (16), Tests 143 passed (143)".
  - Before the push: ruff "All checks passed!", mypy "Success: no issues found in 49 source files". CI is green on `bf5d12e`.
- **Walk (local, road lookup stubbed):**
  - At 1440 the band is 793.3 px in every step, before and after the fix, and the aerial frame stays 411x655. At 390 the line adds 53.5 px (843.3 → 896.8); the one-column layout has no fixed height (#485 E8).
- **Gate round 1:**
  - diff-verifier: "VERDICT: PASS" (marker hash 655d09334b57). It flagged the "#290 ruling 10" cite as non-blocking.
  - independent reviewer: "FAIL". The "#485 E5 (same file line 40)" cite should be line 41.
- **Gate round 2 (two rounds used):**
  - diff-verifier: "VERDICT: PASS" (the same hash, so the code is unchanged).
  - independent reviewer: "PASS", with nits. The stale comment went to #504; the other two were fixed as write-ups.
- **Write-up-only fixes after PASS:**
  - `rulings.md` now gives `withPin` its own range (190-197) instead of folding it into `site-corrections.ts:201-205`.
  - The commit message notes that the "Use the big map instead" path rests on its shared Save path and isn't covered by a test or the walk.

## After the ship

One `ship.ps1` run on `issue-488-edit-on-map-line`. Then:

1. Production check of #488: live E Colfax, answer the questions, then "Edit on map", move the pin and Save, at 1440 and 390.
   - Expect the side cleared with the one line, the kind kept, and the band at 1440 unchanged.
   - Then a Save with nothing changed: expect no line and the side kept.
   - axe, 44 px (noting #505), console, token scan.
   - The evidence goes on a new evidence branch off the shipped main.
2. Close #489 (its prod walk is already done, see above) and #488, with comments citing the shipped sha and the evidence.
3. Close #494: all its items are ticked.
4. Ryan's browser check: #488 (a visible line, R145).
