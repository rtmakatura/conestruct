# issue-304-scan-null-geometry — the rulings this arc is built under

**Issue:** #304 — "Site scan crash returns 500 for the whole plan when Overpass returns an empty road point (N Federal Blvd)".
**Arc:** investigate first; a checkpoint (`checkpoint.md`, beside this file) before any code.
**Base:** `3fe27c3` = `origin/main` = the prod backend `healthz` sha, 2026-09-30.

This file is the arc's authority; every commit on this branch cites it.

---

## #304's body, verbatim (fetched 2026-09-30 with `gh issue view 304`; open; 0 comments)

Labels: bug, priority-high, backend. Opened 2026-09-30.

> ## Problem
>
> A plan on N Federal Blvd (#243's repro pin) fails on prod (`2f27be3`) with a server error, 3 of 3 attempts. The cause is a crash in the site scan at `src/rules/site_detection.py:981`: Overpass returns a road point with no coordinates, and the code reads it as if it had them.
>
> The scan is an optional input to the plan. When it can't produce an answer, the plan should still generate and say the scan didn't answer. Today the exception takes down the whole render instead.
>
> Classification: behavior-breaking on any road where Overpass returns an empty point. Violates Rule 10: an honest refusal beats a crash, and the missing signal should render as absence.
>
> ## Reproduction
>
> 1. On prod `/sandbox`, drop the pin at #243's repro location on N Federal Blvd.
> 2. Confirm the road and the side, pick the kind, and Generate.
> 3. Expected: a plan, with the site scan reporting that it didn't answer. Actual: a 500, and no plan.
>
> When Overpass does return full geometry, the same pin generates and the sign count reads 7 left, 11 right (the #243 numbers), so the input is valid.
>
> ## Impact
>
> - The estimator gets no plan and no reason. The screen gives them nothing to act on.
> - One bad point in a third-party response blocks every plan on that stretch of road for as long as Overpass keeps returning it.
>
> ## Acceptance
>
> - An Overpass response with an empty or partial road point never raises out of the scan. The scan returns its "didn't answer" state, and the plan renders.
> - The results show that the site scan didn't answer, per the existing no-answer wording.
> - A regression fixture replays the empty-point response and asserts a 200 plan.
> - Existing scan behavior is unchanged when geometry is complete.
>
> ## Reference
>
> - `src/rules/site_detection.py:981`
> - Found during the #243 re-check on `2f27be3`; evidence in `validation-artifacts/committed/issue-243-note-8/recheck-2f27be3/`.
> - Priority-high: a live 500 on a real Denver arterial.

---

## Rulings carried on this branch, verbatim (Ryan, 2026-09-30, after #243's browser check)

> Browser check PASS. #243 closed.
>
> R58 (Ryan): if CI is still running on the tip, ship.ps1 waits for it (up to 15 min) instead of failing. Red still stops the ship.
> R59 (Ryan): after SHIP VERIFIED, ship.ps1 fast-forwards the main checkout's local main to origin/main (ff-only, only if that checkout is clean; otherwise it prints one line and skips). I never run git by hand.
> Both ride along on the #304 branch. Start #304's investigation now, checkpoint first.

---

## The ruling on the checkpoint, verbatim (Ryan, 2026-09-30, on `checkpoint.md` at `b62e1bf`)

> Rulings on #304 (quote verbatim in rulings.md):
> R60. Q1: (a) approved, plus (d): the scan drops any element whose geometry falls outside its own query box (a Denver scan never uses a road in Kazakhstan). Count dropped elements and skipped points internally. Prove (d) with the real fallback capture: the stray way is dropped, and the result matches the primary's.
> R61. Q2: yes, internal only, no wire change.
> R62. Q3: commit the two .gitignore lines on this branch. After the ship, restore the main checkout's .gitignore so it's clean. You have my word for that one restore.
> R63. Q4: missing CI run stops at once. Q5: order (a), (d), (b), (c), R58, R59, each red-first.
> Artifacts are never deleted until the re-run that replaces them is proven (standing caution); note it in the report, no further action.
> Build, verify, give me the go.
