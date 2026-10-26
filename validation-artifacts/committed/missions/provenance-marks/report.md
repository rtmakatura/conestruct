# Mission provenance-marks (#408), 2026-10-25

Goal: #397 (untouched values read "✓ yours" / "typed") and #407 under Ryan's 2026-10-25 ruling (no exception to Rule 18; ✓ is a provenance mark only; selected chips and toggles get their own mark, never ✓), so that every mark in the sandbox form means one thing.

**Outcome:** #407 is built and passed both gates. #397 is parked: after two repair cycles the independent reviewer still returned FAIL. The goal is only partly met. Three uses of ✓ still carry a second meaning: two rest on earlier Ryan rulings (questions 2 and 3), the third is in #411.

## Questions for Ryan

1. **#397: allow a third repair cycle?** The diff-verifier passed both repair cycles. The reviewer's cycle-2 FAIL has five findings:
   - One is a real gap: on the manual-coordinates path the WHAT header still reads "nothing detected; every value here is yours" above rows that now read "default" (`WhatBand.tsx:225`, `:506`).
   - One is a ruling note that no longer matches the code (R145-3).
   - Two are behaviour changes on near-intersection lanes that aren't stated.
   - One is a shoulder edge case: after a re-pick, a count the road lookup wrote can read "✓ yours".
   - The full list is in "#397 (parked)" below.

   The work is kept uncommitted in `.claude/worktrees/issue-397` (branch `issue-397-untouched-provenance` at `7678d0b`), with its evidence and draft commit message (`.claude/worktrees/issue-397-commit-msg.txt`).
   **Recommendation:** yes. The fixes are a header line, a rulings note, two disclosures and one edge case. `/start 397` resumes it on top of this chain; it will need a rebase onto `557868c` (both touch `WhereBand.tsx`).
   **Deviation, said plainly:** /mission § 2.5 says to remove a parked item's worktree and branch. I kept them, because removing them would have deleted about 200 lines of uncommitted work and its evidence, with no undo.
   Also on #397, its length call needs your eye: it kept the 1,000 ft default, marked "default" (option (b)), not unset (option (a)). Setting it unset breaks the side-options and cross-street lookups: the backend rejects 0 (`src/api/schemas.py:572`, `:960`), and the probe failed 18 tests. Recording the default in the audit is filed as #409.
2. **"✓ default"** (Hours, Speed reduction, carriageway, lane width; from your R110 Q8 ruling, 2026-10-07) gives ✓ a third meaning beyond "measured" and "yours". It is left unchanged because changing it would reverse your ruling. **Recommendation (from item 2):** drop the ✓ for defaults, e.g. "i default".
3. **"✓ proposed"** on the kind chip (your #284 ruling, 2026-10-14) gives ✓ another meaning too. It is left unchanged for the same reason. **Recommendation:** "⌁ proposed", since ⌁ already means "proposed".

## Ready to ship

- **Top branch:** `issue-407-selection-mark`.
- **Chain:** `mission-swa-prod-check` `7678d0b` (pending evidence from #396's production check) → `issue-407-selection-mark` `557868c` → this report's commit.
- CI green on `557868c` (Python tests, Frontend tests).

## Filed

- #408, the tracking issue: https://github.com/rtmakatura/conestruct/issues/408
- Ryan's #407 ruling, recorded on the issue: https://github.com/rtmakatura/conestruct/issues/407#issuecomment-6403916392
- #409, the audit doesn't record a defaulted length (from #397): https://github.com/rtmakatura/conestruct/issues/409
- #410, landing step 1 says Conestruct "finds … the extent" (from #397): https://github.com/rtmakatura/conestruct/issues/410
- #411, other marks that still carry two meanings (from #407's inventory): https://github.com/rtmakatura/conestruct/issues/411
- #412, centre the four selection marks alike (from #407): https://github.com/rtmakatura/conestruct/issues/412

## Calls I made (R145 self-ruled)

- **#407, all in `407/rulings.md`:**
  - The glyph is ●, not • (• reads as a list bullet).
  - The colour is `--act`, the same as the pressed border.
  - L2's mark positions stay.
  - `.a-chip-check` is deleted.
  - The site-condition dismiss-reason chip is in scope: your ruling says "a selected chip … never a ✓".
- **#407:** the dismiss chip's ● stays `--act`. It measures 5.21:1 on the ground NEEDS YOU paints today (`--da-ground`). The older 4.97:1 note was measured over `--canvas`, and that note is corrected in place.
- **Orchestrator, #397:** the item is parked after two repair cycles, and its worktree is kept (see question 1).
- **Orchestrator, gate note:** the diff-verifier's first #397 run said the Co-Authored-By line should name a different model. I didn't act on it: this session's attribution instruction names Claude Opus 5.5.

## Flakes

None. Every full run in this mission passed on its first try, except #397's one predicted failure, which is logged in its worktree's `full-run-failures.md`.

## #407: the chosen-option mark is ●, never ✓ (`557868c`)

- **Change:**
  - The side chip, the kind chip, the segmented toggle and the dismiss-reason chip show ● in `--act` instead of ✓. They change together (P11).
  - ● is in `symbols.ts`, DESIGN-SPACING's glyph table and P9, each with the ruling link.
  - `mark-inventory.md` lists every mark the form renders, with its single meaning.
- **Stated behaviour changes:**
  - The dismiss-reason glyph's hue moves from `--act-bright` to `--act`, so its contrast goes from 6.44 to 5.21:1.
  - The side chip's label starts 1.28 px further left when checked. Every other label moves 0 px.
- **Contrast,** measured at 1440 and 390:
  - side and kind chip: 5.60:1
  - segmented toggle: 5.16:1
  - dismiss chip: 5.21:1, measured on an injected copy, because the real chip needs a live site-scan hit
- **Screenshots:** before/after at 1440 and 390 of the side chip, kind chip and toggle, in `407/`. There are none of the dismiss chip.
- **Unresolved:** the toggle's ● sits lower than the other three marks. It inherits the ✓'s placement, and the fix is filed as #412.
- **Tests:**
  - On the top branch: pytest 3593 passed, 2 skipped. mypy: "Success: no issues found in 49 source files". ruff: "All checks passed!". vitest: Test Files 241 passed | 1 skipped (242); Tests 2561 passed | 1 skipped (2562). 4 new and 9 amended tests, all 13 red on base.
  - On the base: vitest 2557 passed, 1 skipped.
- **Gates** (two repair cycles; final verdicts quoted):
  - Diff-verifier: "VERDICT: PASS" (marker written in the issue-407 worktree).
  - Independent reviewer: "PASS", with non-blocking notes:
    - a historical "✓" quote in `WhereBand.side-control.test.tsx:101`
    - the first churn amendment's hue note, corrected by the second
    - three drifted line cites, with the subjects correct

## #397 (parked): untouched values read as the operator's

- **Built, not committed:** in `.claude/worktrees/issue-397`.
  - Untouched length, work type and lanes read "default".
  - An edit flips them to "✓ yours" through `meta.operatorSet`.
  - Near-intersection Lanes stays amber, "⚠ default", with a line saying the map count includes turn lanes.
  - The Wadsworth 2/12 vs 4/10.5 difference is by design, and the screen now says why.
- **Tests on the item's tree:** vitest 2570 passed, 1 skipped. tsc clean. Lint 0 errors.
- **Gates, cycle 2:**
  - Diff-verifier: "VERDICT: PASS" (marker hash 6fa5853227da).
  - Independent reviewer: "FAIL". Its open findings:
    1. `WhatBand.tsx:225` / `:506`: with no road detection, the header reads "nothing detected; every value here is yours" over rows that read "default" (Rule 10, the issue's acceptance).
    2. rulings.md R145-3 says `lanes` is recorded only for kinds detection never writes. Cycle 2 made shoulder record it too, and the note wasn't amended.
    3. Behaviour changes not stated:
       - (a) An edited near-intersection count was "⚠ yours" on base and is now "✓ yours", so the guesses count drops by one after an edit.
       - (b) On a near-intersection way with `lanes:forward` but no `lanes` total, the row is now always amber (+1 guess).
    4. Shoulder edge case: pick a count → a road with a `lanes` tag rewrites it → a re-pick on a road with no tag keeps the old count and the record, so a value the road lookup wrote reads "✓ yours".
    5. On a shoulder plan with no detection at all, the lanes line says "the map has none for this road", though no map was read.
