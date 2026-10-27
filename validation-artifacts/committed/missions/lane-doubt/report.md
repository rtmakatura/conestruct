# Mission lane-doubt (#421): report

*2026-10-27. Items: #411 (fourth cycle, doc fixes only) and #420. Base: `finish-marks-prod-check` `54b8182` (pending evidence from #417).*

## Questions for Ryan

Nothing is parked. Two items for you to see:

1. **#411 has one code-file edit, and it changes a comment only.** Your 2026-10-27 ruling says "There is no code change." The fourth cycle fixed the DESIGN-SPACING note on the marker's word ink. The same wrong sentence was also in a code comment at `conestruct/site/components/bands/FieldCell.tsx:122-125`, so I had it corrected as a doc fix: 3 comment lines became 4, and no code line changed (R145 self-ruled, recorded in `form-marks/411/rulings.md` Cycle 4). Recommendation: keep it. Leaving a comment I knew was wrong would have been the worse option. If you'd rather the code files stay untouched, the 4 lines can be reverted on top of the branch.
2. **An open edge on #420 (not built).** A near-intersection plan with no map lane count and no other guess still has a header reading "prefilled from the road" over a lane count that is a default. Your ruling counts the doubt line, and with no map count there is no doubt line, so this case is outside it (#420 call 1). R145-14 recorded the same case as already there before #397 (R110 Q5). Recommendation: leave it unless you want it filed.

## Ready to ship

Top branch: **`issue-420-lane-doubt-count`**, which carries this report.

Chain (stacked, pushed, fast-forward from main `5794056`):
- `finish-marks-prod-check` `54b8182` (#417's production-check evidence)
- `issue-411-mark-meanings` `8f9ba12` (#411)
- `issue-420-lane-doubt-count` `e08676b` (#420), then this report (top)

## Filed

- #421, the mission tracking issue: https://github.com/rtmakatura/conestruct/issues/421

## Calls I made

All recorded as R145 self-ruled in the item's `rulings.md`.
- #411: the FieldCell.tsx comment correction counted as a doc fix (orchestrator; see question 1).
- #411: `→` has one meaning ("becomes") and two uses, `RevisionPanel.tsx:221` and `NeedsYouConditions.tsx:260` (mark-inventory.md).
- #411: the cycle-3 per-file churn (+68 / −77) is marked as not recomputable from the repo, because it was taken on a scratchpad tree that was never committed. The branch total is the checkable figure: 17 tracked files, +150 / −73 against `54b8182`.
- #420: the doubt counts only while its line shows. An edited count or no map count adds no guess.
- #420: no wording change. The header names a ⚠ that sits in the row's collapsed details. R145-14 named that cost and your ruling went past it, so I filed no follow-up.
- #420: the count stays in `WhatBand.tsx`, because it's display logic, not MUTCD math (Rule 3 doesn't apply).
- #420: #397's `rulings.md` is left as written. #420's rulings.md and commit record that the ruling replaces R145-14.

## Flakes

None. Every full run in this mission passed on its first try.

## #411 Sandbox form marks carry one meaning each (`8f9ba12`)

**Change (cycle 4, doc fixes only):** the base moved to `54b8182` (`git reset --keep`; `04b76f5..54b8182` touches no `conestruct/` file). The four reviewer findings from finish-marks § #411 and the stale branch total are fixed in the write-up:
- the branch total is recomputed;
- the 0.031 px glyph-span move is stated per width;
- the DESIGN-SPACING note now says the word stays faint on every tone but the guess, which stays amber (`app/globals.css:5379-5399`);
- the mark-inventory contradictions on ✓ and `→` are resolved.

Two more write-up fixes came from round 1: a stray 0x08 byte in rulings.md:35, and the "no code or test file changed" line. The code is as built in cycle 3. Full change: the commit message of `8f9ba12`.

**Tests:** vitest Test Files 243 passed | 1 skipped (244); Tests 2590 passed | 1 skipped (2591). pytest 3593 passed, 2 skipped. Red proof unchanged (17 failed | 93 passed on `04b76f5`).

**Gates, round 1:**
- diff-verifier: `VERDICT: PASS` ("wrote PASS marker for 16 code file(s), hash 97231a59f201")
- independent reviewer: `FAIL`: "rulings.md:178 says the backspace byte in "§ Calls 1" is "Fixed". It isn't: rulings.md:35 still has a 0x08 byte" and "rulings.md:170 says "No code or test file changed in this cycle." rulings.md:175 then records a cycle-4 edit to `components/bands/FieldCell.tsx:122-125`". Write-up only, so no cycle was used.

**Gates, round 2:**
- diff-verifier: `VERDICT: PASS` ("wrote PASS marker for 16 code file(s), hash 97231a59f201")
- independent reviewer: `PASS`, with the advisory "The FieldCell comment edit may need Ryan's sign-off" (question 1).

## #420 WHAT header counts the near-intersection lane doubt (`e08676b`)

**Change:** in `WhatBand.tsx`, the header's N is now the ⚠ marks on the rows plus the lane doubt line when it shows. It reads the same `lanesDoubt` array the Lanes row renders, so the count can't drift from the display. On Wadsworth & W 10th the header reads "3 guesses marked ⚠" (was 2) at 1440 and 390, and the header box is the same size. Stated behaviour change: a near-intersection plan whose only doubt is the lane count reads "1 guess marked ⚠ · change any that are wrong" instead of "prefilled from the road". The Lanes row still reads plain "default".

**Churn:**
- `WhatBand.tsx`: predicted about +6 / −4, actual +6 / −4.
- `untouched-provenance.test.tsx`: predicted about +15 / −8, actual +29 / −9. The plural test needed its own road fixture; this is recorded in rulings.md.

**Tests:** red proof 3 failed, 18 passed on `8f9ba12`; 21 passed on the branch. vitest Test Files 243 passed | 1 skipped (244); Tests 2591 passed | 1 skipped (2592).

**Gates, round 1:**
- diff-verifier: `VERDICT: PASS` ("wrote PASS marker for 17 code file(s), hash ea8b90782dbb")
- independent reviewer: `FAIL`: two line cites in rulings.md off by one ("The R145-14 comment is at :467-469, not ":466-468"", "`warnMarkers` runs :505-518, not ":505-517"") and "rulings.md ("Actual churn" note) says the new plural test is "+17". The diff shows 16 added lines". Write-up only, so no cycle was used.

**Gates, round 2:**
- diff-verifier: `VERDICT: PASS` ("wrote PASS marker for 17 code file(s), hash ea8b90782dbb")
- independent reviewer: `PASS`

## Top branch checks

Run on `e08676b` before the push:
- pytest 3593 passed, 2 skipped
- mypy "Success: no issues found in 49 source files"
- ruff "All checks passed!"
- vitest Test Files 243 passed | 1 skipped (244); Tests 2591 passed | 1 skipped (2592)

CI is green on `e08676b` (Python tests and Frontend tests).
