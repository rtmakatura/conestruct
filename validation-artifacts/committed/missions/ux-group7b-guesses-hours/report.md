# Mission ux-group7b-guesses-hours — report

Tracking issue #527. Prompt `docs/prompts/cc-prompt-ux-group7b-guesses-hours.md` (Ryan's rulings, 2026-11-11). Two items, one large. Run 2026-11-11 to 2026-11-12.

## Questions for Ryan

1. **#526 is parked after two gate rounds.** Allow a third gate round that folds in #531 and #532?
   - **Recommended:** yes, the same way #507 and #517 got one.
   - Round 2's diff-verifier passed. Round 2's reviewer failed it on two points:
     - the week view's "No record" captions collide and get clipped at 390;
     - the night-work trace doesn't record how the backend scores hours after midnight. This is write-up only.
   - Everything else held. The Work dates row reads 0 px across 10 states at 1440, 1198x930 and 390, axe is 0, and no day without hours on record reads as allowed.
   - Alternative: `/start 531` and `/start 532` in the same worktree.
2. **P15 and the Undo record (#532).** The "Hours changed … Undo" line disappears as soon as the operator edits the times by hand. P15 says the record stays until it is undone or the pin moves. This was self-ruled as S9.
   - **Recommended:** keep the record until Undo or a pin move, per P15.
3. **#528 (money).** The old `hours_eval` reads only the first work date's day kind. A date range that crosses a weekend can therefore get a different verdict on the PDF and in the exposure estimate than on the page, which now uses `hours_days`. #526 deliberately left `hours_eval` alone.
   - **Recommended:** move the PDF and the ledger onto `hours_days` in its own arc, once you rule on the exposure-estimate effect.
4. **Still open from #507's report (question 2):** is it OK that the road list's grouping runs in the Next route `/api/road-bearing` (group 8, R145-1)? #525 builds its merge in the same place, and reads "the backend" in your ruling as that server route.
   - **Recommended:** yes. The picker stays render-only and no MUTCD value is computed there.

## Ready to ship

**Top branch: `issue-525-one-road-entry`.** The chain, oldest first:
- `fbd0230` — `issue-517-prod-check`: #517's production evidence. It ships with this.
- `e331b15` — `prompt-ux-group7b`: the group 7b prompt.
- `8bd1d51` — #525: the map window lists a street once.
- The report commit on top.

#526 is NOT in the chain. It is uncommitted in `.claude/worktrees/issue-526`.

## Filed

- #525, #526: the mission items.
- #527: the tracking issue.
- #528: the old hours check reads only the first date's day kind. Needs a money ruling.
- #529: holiday rules are never evaluated.
- #530: weekend rules stated only in the records' prose.
- #531: the work-hours dialog at 390 (round-2 reviewer findings).
- #532: the #526 write-up and the P15 Undo question.

Links: https://github.com/rtmakatura/conestruct/issues/525 through https://github.com/rtmakatura/conestruct/issues/532.

## Calls I made

**Orchestrator:**
- Committed the prompt on its own branch, `prompt-ux-group7b`, stacked on `issue-517-prod-check`. Moved the untracked copy to `validation-artifacts-extra/ux-group7b-guesses-hours/cc-prompt-untracked-copy.md`.
- Sent #526 back before round 2: its self-ruled S20 (reserve three lines at desktop) reversed ruling 2, which reserves two lines. S20 was withdrawn.
- #525 stacks on `e331b15`, the last committed tip, not on the parked #526.

**#526** (S1–S22 in its rulings.md):
- an additive per-day-kind `hours_days` backend block, with `hours_eval` unchanged;
- a sixth state, "Pick a street class to finish the check.";
- the window the fix button offers (CHOSEN);
- a Monday-start week (CHOSEN);
- holidays shown as a rule only;
- weekends with no record shown as absence, with `record: "none"` from the backend.

**#525** (R145-1 to R145-12 in its rulings.md):
- the merge runs in the road list's server route;
- same name (or ref), same `highway_class`, same travel;
- the 3 m same-line offset is CHOSEN, measured between Pennsylvania's 1.4 m wobble and half of Colfax's 6.6 m carriageway gap;
- 25°, 30 m and 60° are reused from existing constants;
- untagged `motorway`/`motorway_link` never fold (a commented mirror of `corridor.py:1035`; roundabouts are a stated limit, cites #514);
- cross streets are attached before carriageway grouping.

## Flakes

None. No full suite was run locally (budget rule 3).

## #526 — What section: guesses box 3c, steady Work dates row, "set dates to check", work-hours dialog (PARKED)

- **Worktree and branch:** `.claude/worktrees/issue-526`, branch `issue-526-guesses-hours`, base `e331b15`. 24 paths, uncommitted. Never remove it.
- **Draft commit message:** `validation-artifacts-extra/ux-group7b-guesses-hours/issue-526/commit-msg-draft.txt`.
- **The change:**
  - the guesses box in look 3c;
  - the Work dates cell with two lines reserved, in the five ruled states plus street class;
  - the hours row under the grid;
  - `WorkHoursDialog.tsx`, with day and week views, the fix button and Undo;
  - backend `evaluate_hours_days`;
  - #490's columns check extended.
- **Cause of "set dates to check":** the line covered every backend `unknown`. That meant two cases: dates with no times, and a street class not set where the windows depend on class. The second has a red proof.
- **Tests (round 2):** vitest 9 files / 116 passed, plus 14 nearby suites; pytest 14 + 57 passed; tsc, ruff, mypy clean. Columns check: Work dates 106 px in 10 states at 1440/1198, 173.5 px at 390, 0 px change; axe 0, 44 px 0 across 63 readings.
- **Gate round 1:**
  - diff-verifier: "VERDICT: PASS", marker `85e402ff9232`.
  - reviewer: "REVIEW: FAIL", 2 blocking (outside line over two lines; no-record weekend read as allowed) and 6 low. All were repaired.
- **Gate round 2:**
  - diff-verifier: "VERDICT: PASS", marker `5aad59b77f76`.
  - reviewer: "REVIEW: FAIL", 2 blocking (390 "No record" captions; night-work trace) and 9 low. Filed as #531 and #532.
- **Rounds used:** 2. Parked.

## #525 — the map window lists a street once

- **Commit:** `8bd1d51` on `issue-525-one-road-entry`.
- **The change:** `lib/road-detection/same-street.ts` merges same-name, same-class, same-travel ways that connect or run along the same line, keeping the nearest. Each entry gets " · at <cross street>" when it meets another listed street within 30 m of the pin.
- **The trace:** way 812978772 is drawn N→S and the other Pennsylvania pieces S→N, so the old bearing-octant dedup kept it as its own row. Its 26 m comes from a pin reconstructed to the same rounded coordinates; the actual pin wasn't recorded. "Traffic both ways" matches `oneway=no`, `lanes=2` on every piece in reach (Rule 12; not checked on the ground). Which way the work runs from the corner is decided by the side choice (`WorkPlacement.side`/`travel`) and `meta.intersection`; this change doesn't touch it.
- **Tests:** red proof 5 failed on `e331b15`; round 2's link and motorway tests 2 of 3 failed on the round-1 code. vitest 20 files / 240 passed; tsc clean; ruff and mypy clean (no Python changed). The churn replay at Colfax/Williams, Lincoln, Speer and Colfax/Pennsylvania matches: only the duplicate row goes, plus the new `cross_street`. Walk at 1440, 1198x930 and 390: 3 rows before, 2 after; axe 0; 44 px only D3 and Mapbox (#505).
- **Gate round 1:**
  - diff-verifier: "VERDICT: PASS", marker `ff565026560e`.
  - reviewer: "REVIEW: FAIL", 1 blocking (the merge ignored `highway_class`; the R145-2 quote dropped the class condition) and 4 low. All were repaired.
- **Gate round 2:**
  - diff-verifier: "VERDICT: PASS", marker `a1e7b77dd772`.
  - reviewer: "REVIEW: PASS", 5 low.
- **Rounds used:** 2.
- **Write-up-only fixes after PASS** (budget rule 1, no gate re-run):
  - plan.md step 2 now reads "R145-1..12";
  - walk.md says the JSONs hold the `·` escape, and notes the line wraps at 1440 and 1198 too;
  - trace.md notes that its distances use a flat frame, while the route's haversine gives 21.75 m and 4.98 m.
- **Not fixed:** the `same-street.ts:11` comment still says "R145-1..9". Editing it would change the code hash and need a marker re-write. Left for the next edit of that file.

## After the ship

- **Production check for #525** at 1440, 1198x930 and 390 on `/sandbox`, on a new evidence branch:
  - pin 39.7401, -104.9811: one "Pennsylvania Street" row, " · at East Colfax Avenue";
  - Colfax, Lincoln and Speer still list once;
  - axe and the 44 px measure.
- Close #525, then #527 if #526 is resolved; otherwise leave #527 open with #526 parked.
- **Browser check for Ryan:** the map window row lines (a visible change).
