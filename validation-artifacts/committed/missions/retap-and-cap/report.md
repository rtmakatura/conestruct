# Mission retap-and-cap (tracking #494)

Ryan's brief, 2026-11-10: two items, one report and one `result:` line, stacked on the pending evidence branch `mission-494-prod-check` `f912608`. (1) `/start 493`: commit its worktree, rebase, apply the re-tap fix from the last report. (2) #492: Ryan approves raising the map cap in `route.ts` from 30 to 40 a minute.

## Questions for Ryan

None. Nothing parked, no device count changed.

Two things to know (not blocking):

1. **#493's timing is a stubbed count plus one live sample, not a prod before/after on the same pin.** The issue asked for "before vs after, same pin". The evidence shows stubbed Overpass reads going from 1 to 0 on the tap path, plus one live sample of the read that is now skipped: 2,649 ms. R145-6 in #493's `rulings.md` says so. A before/after on prod can run in the production check after the ship.
2. **The 40 cap is per IP.** The margin of 10 covers one worst-case walk per IP. Two walks behind one shared IP, such as an office network, can still reach 60 in a minute (#492 `checkpoint.md`).

## Ready to ship

Top branch **`issue-492-map-cap-40`**. Chain (all pushed):

- `f912608` `mission-494-prod-check` (the #494 production-check evidence, ships with it)
- `60f4a1c` `issue-493-cross-street-reuse` #493
- `76146bc` `issue-492-map-cap-40` #492
- this report, on the top branch

CI on `76146bc`: Frontend tests success, Python tests success.

## Filed

None. Tracking stays #494 (https://github.com/rtmakatura/conestruct/issues/494), which already listed #492 and #493.

## Calls I made

- Reused #494 as the tracking issue instead of filing a new one. It already lists #492 and #493 as open.
- Kept #493's evidence in its original folder, `missions/ux-columns-copy-maps/issue-493/`, where its rulings and red proofs already were.
- Counted the gate rounds fresh for this mission. The prior mission's two cycles on #493 ended in a park, and Ryan's brief resumed the item.
- #493 R145-9: the re-tap guard in `cross-street-apply.ts` leaves `geometry` out of its comparison and out of the stored `appliedJson`.
- #493 R145-10: the tap path's not-the-worked-road check uses `_street_key`, the same check #487 uses on the lookup path (from the round 1 reviewer finding).
- #492, R145 self-ruled: the issue's second bullet (load the next question's soft image early) is not built. Its premise was wrong: only the open card mounts, so 1 soft image loads before any answer. It isn't in Ryan's approval.
- A diff-verifier note said the commit trailer should name a different model. I kept `Claude Opus 5.5`, as this session's attribution says.

## Flakes

None. No full suite ran locally (R154 budget); CI ran both suites green.

## Process notes

- The first `git push` hung on Git Credential Manager's prompt. I stopped it and pushed again through `gh auth git-credential`, which worked.
- No dev servers or browsers were started. I found 0 node processes naming the item worktrees after the items.

## #493: the intersection map reuses the WHERE tap's cross street

- **Change:** the NEEDS YOU intersection map draws the cross street from the line the WHERE tap already fetched, so there is no second Overpass read on the tap path (stubbed reads 1 → 0). This mission resumed the parked work, committed it, rebased it onto `f912608` (no conflicts), then:
  - **Re-tap fix (R145-9):** re-tapping the same street no longer replaces the operator's edited approaches or overrides, or puts the lane hold back on (#112). A different street still replaces.
  - **Round 1 repair (R145-10):** `tapped_cross_street` judges "this is the worked road" with `_street_key`, so "E Colfax Ave" at a bend on "East Colfax Avenue" is not drawn as the cross street.
- **Commit:** `60f4a1c` on `issue-493-cross-street-reuse`. Worktree `.claude/worktrees/issue-493`.
- **Churn (Rule 5):** predicted before each diff in `checkpoint.md`.
  - `cross-street-apply.ts`: about +6 −2 predicted, +9 −2 actual.
  - `cross-street-apply.test.ts`: about +40 predicted, +55 actual (6 → 9 cases).
  - `site_detection.py`: about +3 −3 predicted, +6 −4 actual.
  - `test_needs_you_map.py`: about +25 predicted, +21 actual.
- **Red proofs:** `red-proof-retap.txt` (2 of 3 new tests fail on the unfixed guard); `red-proof-tap-street-key.txt` (2 of 3 cases fail on the old `.lower()` check).
- **Tests (changed files only):** pytest `tests/test_needs_you_map.py` 80 passed; vitest `cross-street-apply`, `cross-street-mark.answer`, `cross-street-tap-record` 16 passed; vitest `render-proxy.needs-you-map`, `cross-street-lookup`, `cross-street` 23 passed; ruff, mypy, tsc clean.
- **Gate rounds:** 2.
  - Round 1, diff-verifier: `VERDICT: PASS`
  - Round 1, independent reviewer: `FAIL`. Finding 1: `site_detection.py` `tapped_cross_street` compared names with `.lower()` while #487's lookup path uses `_street_key`. Findings 2–3 (write-up): stale base sha and #487 wording in `evidence.md` and `checkpoint.md`; a note was needed that `full-run-failures.txt` predates the 2026-11-10 full-suite ruling. All three fixed.
  - Round 2, diff-verifier: `VERDICT: PASS` (marker hash 45f12352fe87)
  - Round 2, independent reviewer: `PASS`
- **Write-up-only fixes after PASS:** none.

## #492: the NEEDS YOU map cap is 40 a minute

- **Change:** `conestruct/site/app/api/needs-you-map/route.ts` passes `PER_MINUTE = 40` (was 30) to `rateLimitOr429`. A `CHOSEN` comment (Rule 12) names Ryan's approval on 2026-11-10 and the worst case. The worst case is 5 questions × (1 soft + 5 zoom steps) = 30, so the margin is 10. Inputs: only the open card mounts (`QuestionSteps.tsx:177-199`); a soft image only at step 0 (`NeedsYouMap.tsx:81-82`); zoom −1..+3 (`corridor-aerial.ts:45-46`); 5 flags (`types.ts:245-250`).
- **Commit:** `76146bc` on `issue-492-map-cap-40`. Worktree `.claude/worktrees/issue-492`.
- **Acceptance:**
  - 1 soft image is requested before any answer, which meets "only 2".
  - The margin is 10, recorded.
  - #483's soft-then-sharp behavior is unchanged: `NeedsYouMap.tsx`, `lib/needs-you-map.ts` and `QuestionSteps.tsx` are untouched.
- **Churn (Rule 5):** `route.ts` 1 line plus a 5–7 line comment predicted, +8 −1 actual. Test about 60 lines predicted, 75 actual.
- **Test:** `route.rate.test.ts` drives the real `POST` and limiter, with only the Upstash SDK stubbed. The 40th request is allowed and the 41st refused. Red proof: against 30 it fails with `expected 30 to be 40`.
- **Tests (changed files only):** vitest `route.rate`, `route`, `lib/rate-limit`: 3 files, 18 passed; tsc clean.
- **Gate rounds:** 1.
  - Diff-verifier: `VERDICT: PASS` (marker hash 47eaa4a11aa0)
  - Independent reviewer: `PASS`, with a non-blocking note: the margin covers one walk per IP, and a shared IP can reach 60.
- **Write-up-only fixes after PASS:** `checkpoint.md` now names the shared-IP case in its "outside the count" list.

## After the ship

Run the production check on a new evidence branch built on the shipped main:

- **#492:** the 41st request to `/api/needs-you-map` from one IP in a minute gets 429, and the 40th does not. Use a read-only probe and keep it under the cap for real walks.
- **#493:** on E Colfax, an intersection NEEDS YOU map after a WHERE tap carries the `x-map-cross-source` header naming the tap path. Re-tapping the same cross street keeps an edited approach. Before/after timing on the same pin if it can be measured.
- Generate CLS, axe, 44 px and the console, as usual.

Then close #493 and #492 with comments citing the shipped sha and the evidence. #494 stays open for #488 and #489. No browser check is needed (no visible design change).
