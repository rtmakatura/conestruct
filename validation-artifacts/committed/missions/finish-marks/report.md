# Mission finish-marks (#417): report

*2026-10-26. Items: #397 (fourth cycle), #411 (third cycle), per Ryan's 2026-10-26 rulings. Chain base: `form-marks-prod-check` `8b0a73f`.*

## Questions for Ryan

1. **#411 is parked after its third cycle.** The code passed both gates in every round of this cycle. The diff-verifier passed the code all three times; its final REPAIR and the reviewer's final FAIL are about the write-up only:
   - a stale branch total (+146 / −72; it is +147 / −73 after the glyph-table fold-in);
   - a +0.031 px marker move stated for 1440 only (at 390 the trigger is right-aligned, so the word stays and the glyph moves left);
   - one line of the DESIGN-SPACING #411 note ("its word keeps the marker's faint ink"; the guess tone keeps amber);
   - two self-contradictions in `mark-inventory.md`: the ✓ hue is called fixed while #414 holds it open, and `→` is listed with two uses under "each has one use".

   **Recommendation:** allow a fourth cycle limited to those doc fixes, with no code change, then both gates again. The alternative is to commit the code now with a corrected message, but that breaks the two-gate rule.
2. **#397: the WHAT header no longer counts the near-intersection lane doubt** (R145-14, self-ruled). The header counts only ⚠ marks shown on rows. Your ruling moved that ⚠ off the row and onto the doubt line in the details. So on a plan where Lanes was the only doubt, the header reads "prefilled from the road", although the lane count wasn't taken from the road and the map contradicts it (4 vs 2). With the details closed, no ⚠ shows anywhere. The reviewer judged this doesn't reverse a ruling, but it is a weaker warning than before.

   **Recommendation:** count the doubt line in the header's N, so the band still says a value needs checking. The alternative is to keep it as built and rely on the row's details.
3. **Browser checks.** These are still owed: the ● marks from #408 and #413, and #397's visible changes. After #397, untouched length, work type and lanes rows read "default", and the Lanes doubt line sits in the details.

## Ready to ship

Top branch: **`issue-397-untouched-provenance`**. The chain under it:
- `form-marks-prod-check` `8b0a73f` (pending production-check evidence from #413)
- `04b76f5` #397
- the report commit (top; its sha is in handoff.md and on #417)

CI is green on `04b76f5` (Python tests, Frontend tests).

Parked, not in the chain: #411 in `.claude/worktrees/issue-411`, branch `issue-411-mark-meanings`. Its work is uncommitted on base `04b76f5`. The draft commit message is at `C:\Users\rtmak\AppData\Local\Temp\claude\C--Users-rtmak-Documents-traffic-control-tool\34a6c6d1-c967-4789-903c-333126adf084\scratchpad\issue-411-commit-msg.txt`. If that file is gone, rebuild it from `validation-artifacts/committed/missions/form-marks/411/rulings.md`.

## Filed

- #417, the tracking issue: https://github.com/rtmakatura/conestruct/issues/417
- #418, three copy follow-ups from #397's review (the re-pick "default", the doubt line when the map reads fewer lanes, the three stacked clauses): https://github.com/rtmakatura/conestruct/issues/418
- #419, ⚠ carries two meanings ("a guess to check" and "needs attention"), with no ruling that makes them one: https://github.com/rtmakatura/conestruct/issues/419
- Bodies edited (both issues were filed by Claude Code): #414 (line cite on both bases), #415 (dismissed-grey cite by subject; ◌ "withdrawn" and "no tag" added).

## Calls I made

- **#397, R145-14:** the WHAT header counts only ⚠ marks on rows, so the near-intersection lane doubt in the details is not counted (question 2).
- **#397, R145-13 to R145-17:** the doubt line is its own amber line in the details; "can inflate"; cites by function, not line; the re-pick test proves the count instead of forcing it.
- **#397:** the reviewer's copy findings went to #418 rather than being folded in, because part (a) needs a choice between a new marker word and resetting a plan value.
- **#411:** `plainDefault` is removed rather than left as an unused option. The proposed mark and note come back when another kind is picked. The `i` row in the DESIGN-SPACING glyph table is corrected to `--act`, citing Rule 18 at `lib/design/symbols.ts:5-6` (one-line fold-in). #418 is not folded in.
- **Orchestrator:** the conflict between #397 and #411 was resolved by keeping #411's side in the three `plainDefault` files and #397's other lines, as self-ruled in #413 and recorded on #397 (issuecomment-6411650827). #411 parked under the two-repair-cycle cap rather than taking a third repair.
- **Orchestrator:** the diff-verifier flagged that the #397 trailer should name another model. I kept "Claude Opus 5.5 (1M context)", which matches this session's attribution.

## Flakes

- `Landing.test.tsx` "the job form posts exactly the route's keys…" failed in #411's first full vitest run (1 failed, 2589 passed) and passed alone (31 of 31). The name is saved in `form-marks/411/full-run-fails.txt`. Every later full run passed.

## #397 Untouched setup values read as the operator's (`04b76f5`)

**Change:** untouched setup values now say "default", never "typed", "yours" or "operator-set". Per Ryan's ruling, the near-intersection Lanes row reads plain "default", with "default · set the real count". The doubt moves to its own amber line in the details: "⚠ not confirmed · the map reads N per side, but turn lanes can inflate counts near an intersection". The four mechanical findings from the last cycle are fixed. Evidence: `validation-artifacts/committed/missions/form-marks/397/`.

**Tests:** vitest Test Files 242 passed | 1 skipped (243); Tests 2582 passed | 1 skipped (2583). Red proof: base `8b0a73f` 19 failed | 1 passed; this diff 20 passed. On the top branch: pytest 3593 passed, 2 skipped; mypy "Success: no issues found in 49 source files"; ruff "All checks passed!".

**diff-verifier:**
> VERDICT: PASS
>
> Marker written: "wrote PASS marker for 13 code file(s), hash dac532270983".

**Independent reviewer:**
> PASS
>
> No finding blocks the commit. The rulings.md entries in 2 should be marked superseded before committing, and the header question in 1 has to reach Ryan in this cycle's report.

Its findings 2, 3, 4 and 7 (stale rulings, a word in the Tests paragraph, two pre-change-plan cases under Rule 5, and a cite by subject) were fixed in the docs before the commit, with no code change. Findings 5 and 6 are filed as #418. Finding 1 is question 2.

## #411 Remaining double meanings in the form's marks (parked)

**Change, uncommitted:**
- Per Ryan's ruling, a picked proposed chip shows ● alone, with no "⚠ proposed" and no note.
- Every "default" line reads the word alone. Against `04b76f5`, Hours, Speed reduction and Carriageway change from "✓ default" to "default".
- Glyph markers take their hue span.
- The `i` hue is set to `--act` in the glyph table.
- The mark inventory is updated, with open exceptions filed as #414, #415, #416 and #419.

**Tests:** vitest Test Files 243 passed | 1 skipped (244); Tests 2590 passed | 1 skipped (2591). Red proof against `04b76f5`: 17 failed | 93 passed in the 9 changed test files.

**Round 1.** The diff-verifier returned `VERDICT: PASS` ("wrote PASS marker for 22 code file(s), hash 16645e966f4a"). The independent reviewer returned `FAIL`, with five findings:
1. The `plainDefault` "no change" claim was false against `04b76f5`.
2. Carriageway was described as measured.
3. A wording change was listed that never existed on the base.
4. #415's cite was wrong.
5. ◌ "withdrawn" and "no tag" were missing from the inventory.

**Repair 1.** The diff-verifier returned `VERDICT: PASS` (same hash; docs-only change confirmed). The independent reviewer returned `FAIL`, with seven findings:
1. ◌ was "unchanged in pixels".
2. The `i` hue conflicted with the glyph table.
3. ⚠ was counted as one meaning with no cite.
4. A self-ruling was attributed to Ryan.
5. Stale figures were not marked superseded.
6. The churn comparison mixed bases.
7. #414's line cite was stale.

**Repair 2 (final).** The diff-verifier returned:
> VERDICT: REPAIR
> 1. The message says "+146 / −72" for the whole branch, but `git diff HEAD --numstat` gives +147 / −73. Fix this in the message and at `rulings.md:156`.
> 2. (Advisory) Recompute the "+68 / −77" this-cycle delta, or state how it was derived. It cannot be verified from the tree.

The independent reviewer returned:
> FAIL
>
> All 48 shots were opened, and most of the evidence holds up. The ruled code is correct, and the quotes and their attributions check out. Four claims don't match the evidence or the diff.

Its four findings are the ones listed in question 1: the branch total, the 390-width marker move, the DESIGN-SPACING note line, and the two `mark-inventory.md` contradictions.
