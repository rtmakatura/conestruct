# Mission ux-wait-band-followups: report

Tracking issue: #478. Base: `mission-471-prod-check` `2d609b6` (the pending #470 evidence, on main `750660c`). All three items built; nothing parked; no device count moved.

## Questions for Ryan

None of these block the ship.

1. **#469, rulings 6–8.** The full text of Part 2 rulings 5–8 is not in the repo, `cc-prompt-ux-group6-wait-and-band.md` (lists rulings 1–4 only) or the issues. The item went by the subjects in your brief (one map frame, the mono line, the checks), and all three were already built: the frame is 624.3 px at top 256.5 in every two-column state and is the same element throughout; the line under the aerial sits in a reserved slot; the checks are `WhereBand.one-height.test.tsx` plus the walk. If the ruling text asks for more, it needs a look. Recommendation: no change.
2. **#479 (filed): should NEEDS YOU's Details float too?** Your ruling named only the kind question, so NEEDS YOU's Details still opens in the flow. Recommendation: yes, same popover.
3. **#477, the 40 px gap.** The reference group's top margin is `--space-section + --space-block` = 40 px, a sum of two tokens, not one token or 8/16/24. CHOSEN, to keep the group where #470 put it (was 38). Recommendation: keep.
4. **#477, two slow sentences past 14 s.** The strip says "…can take up to 30 seconds" and the outline's note still says "The road check stops after 20 seconds…". Both are true (the road check is one part of the plan), but a reader sees two numbers at once. Recommendation: keep for now; look at it in the browser check.
5. **#477, reduced motion.** With reduced motion, the map frame's stand-in shows loading only by dimming (35 %); `aria-busy` tells screen readers. This matches the outline's own treatment. Recommendation: keep.
6. **#477, Downloads height varies by 19 px between dev-server sessions** (359 in one, 340 in the next; the card grid was 201 vs 182 px with the same words). The outline stays at #470's 340. Cause not isolated; it can make the one-question outline check fail in some sessions. Recommendation: watch for it on the production check.
7. **#477, APPLY unmeasured.** That the S7 APPLY path has nothing left to scroll after removing #152 E is reasoned from the code (`GeneratorShell.tsx:833` runs the press scroll), not walked. It stays open with R145-10 / #475.
8. **#452 was reopened.** GitHub closed it at the #470 ship because ff7b9a26's body quoted ruling 8's close keyword. Per your answer it stays open; this mission reopened it with a comment. No commit in this chain carries a close keyword.

## Ready to ship

Top branch: **`issue-476-cls-prod-wait`**. Chain (each stacked on the one before, all pushed):

- `2d609b6` `mission-471-prod-check` (pending #470 evidence)
- `a239a0e` #469 `issue-469-band-one-height`
- `2c16bcc` #477 `issue-477-generate-wait-answers`
- `5a5114b` #476 `issue-476-cls-prod-wait`
- this report, on `issue-476-cls-prod-wait`

## Filed

- #477 Generate wait: Ryan's answers to #470's open questions: https://github.com/rtmakatura/conestruct/issues/477
- #478 mission tracking: https://github.com/rtmakatura/conestruct/issues/478
- #479 NEEDS YOU Details as a floating tooltip too (from #469): https://github.com/rtmakatura/conestruct/issues/479
- #480 the check's `STUB_ROAD=0` run comes back DECLINED (from #476): https://github.com/rtmakatura/conestruct/issues/480
- Reopened #452 with a comment: https://github.com/rtmakatura/conestruct/issues/452

## Calls I made

- **#469** (rulings.md R1–R6): "step 2's tooltip" is the WHAT band's details popover (`useDetailsToggle` + `.a-info.a-pop`), reused, not copied; the toggle keeps the word "Details" and its look; only the WHERE kind question changes, NEEDS YOU stays; the panel opens downward over the next band (two columns) or the rows below (390); it closes when the question changes; rulings 6–8 judged by subject.
- **#477** (rulings.md R145-1 to R145-8): the outline holds one question's measured room less 2 px (934 / 1082); only the strip's 14 s line takes your sentence, the outline notes stay; the stand-in is the outline's own dimmed WHERE aerial, or a grey block when the band never showed one; spacing 14→16, 38→40 (token sum), 10→8, spinner 12→16; the settle keeps the focus move (#193) and drops the scroll; R145-8 (Downloads 340→359) was made and then withdrawn when the 359 didn't repeat.
- **#476** (rulings.md R145 1–4 + fold-in): the wait ends on "PICK THE ROAD · N FOUND" / "Which road" or an enabled Save & Close, the same as the prod-check variant; a SKIPPED line when `HOLD_MS < 2000`; the red is cited from `cls-permanent-asis.txt` (wait code byte-identical, line 161→165) rather than re-run; R154 fold-in: a WARN line when the Colfax road isn't the picked road, read from the road-picked row.
- **Orchestrator:** reopened #452; filed #480; kept the `Co-Authored-By: Claude Opus 5.5` trailer (this session's attribution line), though the diff-verifier flagged it against an older reminder.

## Flakes

None. #477's first full vitest run had 2 failures (saved to `issue-477/full-run-1-failures.txt` before the re-run). Both also failed on their own; they were real pins of the removed scroll and bar, and were updated.

## Per item

### #469 Details on the kind question floats; band height never changes
- **Change:** `QuestionSteps.tsx` gets a `detailsTip` prop, set only by `WhereQuestions.tsx`; Details uses step 2's popover; the parked option (d) CSS is gone and one anchor rule (`.nyq-tip-box`) is added. Band with Details closed / open: 762.5 / 762.5 at 1440 and 1198; 875.8 / 875.8 and 920.8 / 920.8 at 390. axe 0; toggle 49.5 x 44.
- **Lane:** `IN LANE: all 83 paths are frontend look-only` (cosmetic lane: reviewer only, affected vitest).
- **Tests:** red 2 failed | 5 passed; `WhereBand.one-height.test.tsx` 7 passed; affected 25 files, 256 passed; full vitest 2989 passed | 1 skipped; tsc clean.
- **Independent reviewer:** `PASS` (marker beb4505cb6bc), then two write-up findings fixed (the 390 frame-top move, "identical content" wording), re-check `PASS`.
- Evidence: `issue-469/`.

### #477 the Generate wait, built to Ryan's answers
- **Change:** NEEDS YOU outline 934 / 1082 px (one question), closes with none; no bar, no "Step N of M"; the 14 s line is your sentence, byte for byte; the WHERE aerial stands in the map frame until the map loads; #470 spacing on tokens; the #152 E settle scroll removed, focus kept; #452 open.
- **Lane:** `OUT OF LANE: 1 of 116 paths fall outside` (`scripts/verify-generate-cls.mjs`).
- **Layout shift on Generate (stub, 1440 / 1198 / 390):** 3 questions 0 / 0 / 0; 1 question 0 / 0 / 0; none 0 / 0 / 0, no outline left; reduced motion 0.0019 / 0.0024 / 0.0007; held 16 s 0 / 0.0001 / 0.0002. axe 0, nothing under 44 px.
- **Tests:** red 13 failed on the base; full vitest 2994 passed | 1 skipped; tsc, eslint clean.
- **diff-verifier:** `VERDICT: PASS` (marker 5d3e04ddfe06); after repair 1 `VERDICT: PASS` (marker 5f3e7be227d1).
- **Independent reviewer:** `FAIL` (#452 closed; 3-question row on old CSS; card-count label; APPLY claim), repair cycle 1, then `FAIL` (two stale citations, write-up only), fixed, `PASS`.
- Evidence: `issue-477/`.

### #476 the permanent check runs on production
- **Change:** `scripts/verify-generate-cls.mjs` +19 / −2: the road-pick wait waits for the road list or an enabled Save & Close; a SKIPPED line when the outline box check can't run; a WARN line when the picked road isn't Colfax.
- **Lane:** `OUT OF LANE: 1 of 122 paths fall outside`.
- **Red:** `cls-permanent-asis.txt`: timeout on the disabled Save & Close at all three widths. **Green on production `750660c`:** CLS 0 / 0 / 0, box check SKIPPED, outlines left 0, exit 0 (production lacks #469 and #477). **Green locally with #477's code:** CLS 0 / 0 / 0, box check PASS, no WARN, exit 0. The token appears in no evidence file.
- **Tests:** no suite covers the script; `node --check` passes.
- **diff-verifier:** `VERDICT: PASS`; after the fold-in `VERDICT: PASS`; after repair 1 `VERDICT: PASS`.
- **Independent reviewer:** `PASS` (quote fix, fold-in suggested), then `FAIL` (the fold-in's WARN fired falsely on an auto-picked single road), repair cycle 1, `PASS`, then two evidence lines added and `PASS`.
- Evidence: `issue-476/`.

## Top branch, before push

ruff `All checks passed!`; mypy `Success: no issues found in 49 source files`; pytest `3908 passed, 3 skipped`; vitest `Test Files 277 passed | 1 skipped (278)`, `Tests 2994 passed | 1 skipped (2995)`.
