# Mission ux-group7-what-section: report

*2026-11-11. Tracking #518. Items: #517 (large: the WHAT section, UX group 7) and #516 (small: stale `work.travel` on a road-less corridor-geometry read). Base: the pending evidence branch `issue-507-prod-check` `7a77005` (#507's production check and the group 7 prompt `2152e7e`), on main `eb7cfb9`.*

## Questions for Ryan

1. **#517 is parked after two gate rounds.** Round 2's reviewer failed it on four code findings and two write-up findings, filed as #520 and #521. The most serious is #520: the new `what` phase of `scripts/verify-columns-end-together.mjs` measures stretched grid boxes, so it reads 0 px while About the work's rows end up to about 170 px apart. Ruling 1 ("The rows end together") isn't met yet.
   **Recommendation:** allow one third gate round on #517 only, as you did for #507, to fold #520 and #521 into the parked worktree and then commit. The alternative is `/start 520` and `/start 521` as separate issues once #517 commits, but #517 can't commit cleanly with #520 open, because its walk.md and commit message would claim a column result the check can't measure.
2. **#198's sentence vs group 7's ruling 5.** The road-type tip still ends "…(from detected Rural, divided, OSM detection)." #198 keeps that sentence byte-identical on every surface (`HandoffNotes.tsx:59, 63, 70, 78, 82`). Ruling 5 says to remove "OSM" from the tips. Choosing either way reverses a ruling, so #517 left it unchanged. Posted: https://github.com/rtmakatura/conestruct/issues/517#issuecomment-6804627485
   **Recommendation:** ruling 5 wins. Reword the sentence on every surface in one follow-up, e.g. "…(we read Rural, divided from the road's map record)".

### #517, parked
- **Worktree:** `C:\Users\rtmak\Documents\traffic-control-tool\.claude\worktrees\issue-517`, branch `issue-517-what-section` on base `7a77005`. 44 paths are uncommitted; new files are marked `git add -N`. Never remove this worktree. ship.ps1's cleanup leaves it because it has uncommitted changes.
- **Draft commit message:** `C:\Users\rtmak\Documents\traffic-control-tool\validation-artifacts-extra\ux-group7-what-section\issue-517\commit-msg-draft.txt`
- **Open gate findings:** #520, #521, and the #198 question above.
- **After this chain ships,** rebase it onto the new main inside its worktree. This chain changes only `WhereBand.tsx` and `corridor-geometry.ts` there, and #517 doesn't change those files.

## Ready to ship

**Top branch `issue-516-stale-travel`.** The chain, all pushed:
- `7a77005` `issue-507-prod-check`: #507's production-check evidence and the group 7 prompt. It ships with this chain.
- `f481ceb` #516: the side load-ahead reads only this scenario's geometry. CI green: Python tests and Frontend tests.
- The commit carrying this report.

#517 is not in the chain.

## Filed

- #517 What section: guesses first, plain source lines, shared listbox, styled date picker. https://github.com/rtmakatura/conestruct/issues/517
- #518 the tracking issue. https://github.com/rtmakatura/conestruct/issues/518
- #519 dead jurisdiction height reserve in `globals.css`, and the no-road lane-width tip, filed by the #517 agent. https://github.com/rtmakatura/conestruct/issues/519
- #520 the WHAT phase of the columns check can't fail. https://github.com/rtmakatura/conestruct/issues/520
- #521 measured row lists set and pin values; "each way" on one-way roads; start and end times have no source line; write-up errors. https://github.com/rtmakatura/conestruct/issues/521
- #522 the lone auto-pick in the side question reads the old road's ready geometry, a second path to #516. https://github.com/rtmakatura/conestruct/issues/522
- Comment on #517: the #198 question. https://github.com/rtmakatura/conestruct/issues/517#issuecomment-6804627485

## Calls I made

Orchestrator:
- **Kept the order you gave,** #517 then #516. When #517 parked, #516 stacked on the last committed tip, `7a77005`.
- **Did not park #517 over #198.** I treated the #198 sentence as an open question rather than a park: the build left the status quo in place, and I posted the question myself.
- **Re-ran the walk with a fresh agent.** The #517 agent's round 1 re-walk was stopped for low memory. A fresh, frugal agent recaptured all 45 crops after the repairs. The pre-repair crops were moved to `validation-artifacts-extra/ux-group7-what-section/issue-517/pre-repair/`.
- **Filed instead of repairing.**
  - #516 reviewer finding 1 is in `WhereQuestions.tsx`, which this branch doesn't touch, so it fails the fold test and became #522. Finding 4, the twin read-ahead, is in #522 too.
  - #517's round 2 findings became #520 and #521, per the two-round budget.
- **Pushed with gh's credential helper.** The plain push hung on the credential prompt, so it was stopped and retried through gh (memory: git push credentials).

The item calls are recorded in each item's `rulings.md`:
- **#516 (R145-1 to R145-4):**
  - Fix the caller, not the Save, so no backend rule is copied into the frontend (Rule 3).
  - Stamp each `ready` answer with its scenario.
  - The shape of the mounted-flow test.
  - The single prod 400: East Colfax's twin option has the same `work`, so the in-flight map sends one request.
- **#517 (S1 to S23, parked):** these are in its worktree's `rulings.md`.

## Flakes

None. Two test results looked like flakes and weren't, both in #517's worktree:
- `DetectedVsApplied.confidence` reads `globals.css` relative to the working directory, so it fails only when run from outside `conestruct/site`.
- Four `GeneratorForms.a11y` failures were real. The suite still pointed at the native lists and was moved to the new listbox.

The failing names were saved before the re-runs, in `test-failures-*.txt` in #517's evidence folder.

## Process slips

- **The `cd`-with-a-write rule was broken several times by the #517 agent and its helpers.** It was once in the builder, once in a test fork, three times in the agent itself, and once more in round 1 with `cd /c;` before a test run that writes a report. Every path was absolute and nothing else was affected. These are recorded in #517's `rulings.md`.
- **Two test forks saved failing names after a re-run instead of before.**
- **Leftover processes:** none after any item. The orchestrator checked after each. The walk agents killed their site, backend and Chromium trees by tree, and ports 3000 and 8000 were free.

## #516: the side load-ahead reads only this scenario's geometry

- **Cause:** after "Edit on map" moves a plan from a road onto a direction (the road lookup fails), the WHERE band's side load-ahead (`WhereBand.tsx:782-792`, sent by `BandAerial.tsx:323` `prefetchGeometry`) built its reads from the old road's `side_options`. `useCorridorGeometry` still held the old road's answer at that point. The prod 400 `pin_model_input` came from that read. The four suspected callers were clean: the sidebar Save already drops `work`, and the picker preview keeps the old `roadAxis`.
- **Change:** in `lib/corridor-geometry.ts`, a `ready` answer carries `for`, the JSON of the scenario it answers. In `WhereBand.tsx`, the load-ahead uses the options only when `geometry.for === JSON.stringify(scenario)`. 2 source files, +15/−3, the same as predicted.
- **Not changed:** the backend, the `pin_model_input` contract, device counts, `GeneratorSidebar.tsx`, `LocationPickerModal.tsx`, `BandAerial.tsx` and `WhereQuestions.tsx` (#506's Save gate and #488's line).
- **Not covered:** the lone auto-pick, #522.
- **Test:** the new mounted-flow test `components/bands/WhereBand.stale-travel.test.tsx` runs road → Edit on map → 504 → North–south → Save. On `7a77005` it is red with two stale reads; with the fix it is green.
- **Tests run:**
  - Baseline: `Test Files 14 passed (14)`, `Tests 104 passed (104)`.
  - After: `Test Files 15 passed (15)`, `Tests 105 passed (105)`.
  - `tsc --noEmit` clean; ruff and mypy clean ("Success: no issues found in 49 source files").
  - CI green on `f481ceb` (Python tests, Frontend tests).
- **Gates, one round:**
  - Diff-verifier: "VERDICT: PASS" (marker `548c31591219`).
  - Independent reviewer: "REVIEW: PASS".
- **Write-up fixes after PASS** (no gate re-run):
  - `rulings.md` R145-4 now gives the twin/in-flight reason for the single prod 400.
  - The commit title is scoped to the side load-ahead, with a "Not covered: … #522" line.

## #517: the WHAT section, guesses first (parked)

- **Change, uncommitted:**
  - The section follows board B: "What's the job?" and its intro, then the "Check these <n> guesses" box, About the work in two columns, then one measured row and one File details row.
  - Guess reasons come from each guess's real basis, or "Our guess" alone when there is none.
  - A checked guess stays put and reads "✓ Checked".
  - Source lines and tips are in plain Inter.
  - A new shared `components/ui/Listbox.tsx` and `components/ui/DateRangePicker.tsx` replace the native lists and the date input.
  - The old "Denver windows · set dates to check" row is gone.
  - Not changed: no backend file, wire field or device count.
- **Churn:** code 10 files +2533/−1103, tests 32 files +1565/−427, script +141/−2. The prediction was about +1750/−450 code and about +1000/−600 tests, a miss recorded in `rulings.md`.
- **Tests:**
  - Targeted vitest passed: round 2's diff-verifier ran 31 files, 279 tests, all passed.
  - `tsc` clean.
  - Post-repair walk at 1024, 1198, 1440 and 390: axe 0, 0 controls under 44 px, the permanent check RESULT PASS. The column part of that PASS is vacuous; see #520.
- **Gates:**
  - Round 1: diff-verifier "VERDICT: PASS"; reviewer "REVIEW: FAIL" on 8 findings, all repaired.
  - Round 2: diff-verifier "VERDICT: PASS" (marker `d1e25353bf9e`); reviewer "REVIEW: FAIL" on 6 findings, filed as #520 and #521.
- **Parked.** See Questions for Ryan.

## After the ship

Production check for #516 on a new evidence branch built on the shipped main, at 1440, 1198x930 and 390. It reruns #516's reproduction using `validation-artifacts/committed/missions/ux-group8-map-window/prod-check/script/walk-507-prod.mjs`: E Colfax at 39.73997, −104.96632, then Edit on map to 39.7501, −104.9601 with `/api/road-bearing` forced to 504, then North–south, then Save.
- Pass means no `corridor-geometry` request carries `work.travel` with `confirmedRoad: null`, and there is no 400 `pin_model_input`.
- #506's Save gate and #488's re-ask line must be unchanged.
- axe, 44 px (Mapbox excepted, #505) and the console are clean.

Then close #516 citing the shipped sha and the evidence, and leave #518 open for #517. No browser check is needed from Ryan: #516 is not a visible change.
