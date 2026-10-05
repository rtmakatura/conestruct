# issue-308-oneway-read-as-divided — the rulings this arc is built under

**Issue:** #308 — "A one-way street on a primary road is read as a divided highway; page 1 draws a median and opposing traffic that aren't there" (filed 2026-10-05 21:31Z). The branch and this folder were renamed from `oneway-read-as-divided` once it was filed. The old branch is listed in `scripts/superseded.txt`.
**Arc:** investigate first; a checkpoint (`checkpoint.md`) before any code.
**Base:** `a5b4e12` = `main` = prod `healthz` (checked 2026-10-05 10:59 MDT).
**Origin:** #300's checkpoint (`0c4628f` on `issue-300-left-side-oneway`), finding 5.

This file is the arc's authority; every commit on this branch cites it.

---

## Ryan, 2026-10-05 — rulings on #300's checkpoint, verbatim (also in `issue-300-left-side-oneway/rulings.md`)

> Rulings on #300 (quote verbatim):
> R78. Order: C first (one-way read as divided), as its own issue. Draft the issue for the chat to repost; investigate it next, checkpoint first. Then A.
> R79. Scope of A: left-side SHOULDER work only. Near-intersection (Case 18) left side and left lane closures are split out and wait for Rule 8 evidence.
> R80. The left edge is offered only on confirmed one-way roads.
> R81. Page 1 mirroring: take your recommendation; note it in the checkpoint as CHOSEN against P1/P21.
> R82. Field name: work_side, default "right".
> No ships until after tonight's 19:07 #292 window has finished.

## Carried from the #300 session prompt (Ryan, 2026-10-05)

> - Don't ship anything today; prod must stay at a5b4e12 until tonight's #292 evening window is done.
> - Keep any prod requests out of 12:00–12:20 and 19:00–19:20 so they don't skew the #292 measurements.

## Ryan, 2026-10-05 — rulings on the checkpoint (`fd662dc`), verbatim

> Rulings on issue C (Ryan, 2026-10-05). Quote each verbatim in rulings.md on oneway-read-as-divided.
>
> R83: Approach (b). One-way is its own fact. Divided = a same-name twin runs the opposite direction within the radius. If the test can't decide, the operator confirms; the plan doesn't guess.
>
> R84: Right-curb-only signing on one-way streets, on one condition. Before any device is removed from a plan, quote the S-630-1 Note 8 text and any Denver jurisdiction rule that applies, with page cites. If either calls for left-side signing on multi-lane one-ways, keep it and report back.
>
> R85: Include secondary one-way streets.
>
> R86: Measure at least 20 Denver roads (divided and one-way) before you pick the twin radius. Report the table and the chosen number marked CHOSEN, with the reason.
>
> R87: Split the near-intersection Note 8 gap into its own issue. Draft it; I'll repost it here before posting.
>
> R88: Shoulder and lane widths on one-ways have no source. Mark them CHOSEN in code and in the audit (Rule 12), and list them in the report.
>
> R89: Retire the word "couplet" in code, tests and comments.
>
> R80 reading confirmed: C's test applies to one-way streets. Each carriageway of a truly divided road stays divided.
>
> No ships until after the 19:07 #292 window.

## Ryan, 2026-10-05 — answers on the R84 report-back (`e70069c`), verbatim

> Answers on #308 (Ryan, 2026-10-05). Quote verbatim in rulings.md on issue-308-oneway-read-as-divided.
>
> R90: Shoulder plans on one-way streets sign one side under Note 8's single-shoulder exception. Use the side of the closed shoulder, which isn't always the right curb: a left-shoulder closure on a one-way signs the left. Quote MUTCD Fig 6P-3 Note 1 (p. 864) in the build. If the figure says otherwise, stop and report.
>
> R91: Don't block #308 on the DOTI standards and details. Record it in execution-sequence.md as a missing authority file, parked with 02-JURISDICTION-DATA.md and MUTCD-SELECTION.md. Each audit row that leans on Denver-defers-to-MUTCD names PT-116.1 and Rule 22.3 as read, and DOTI standards as not read.
>
> R92: The 4-lanes-per-direction clamp (validation.ts:27) turning Broadway's 5 lanes into 4: report whether it changes any device on Broadway plans. If it does, draft an issue for me to repost. Don't fix it inside #308.
>
> The near-intersection issue is #___. Link it from #308's checkpoint.
>
> Start the #308 build. No ship before the 19:07 #292 window finishes.

**Filled from gh (2026-10-05 21:54Z):** the near-intersection issue is **#309**, "Lane closure near an intersection on a one-way street signs one side only; S-630-1 Note 8 requires both sides", filed 21:53:35Z.

## Ryan, 2026-10-05 — the fix before ship (after `d49a3e2`), verbatim

> #308 fix before ship (Ryan, 2026-10-05). Quote verbatim as R93 in rulings.md on issue-308-oneway-read-as-divided.
>
> R93: The left edge line on a one-way street is yellow. MUTCD: left edge lines on one-way streets and divided highways are yellow (Section 3B.06 in the 2009 edition). Find the matching 11th Edition Part 3 section, commit its text to the repo, cite it with the page, and drop the CHOSEN mark. If the 11th Edition text says otherwise, stop and report. Re-run the checks and the verifier, then give me the result: line.
>
> R83 reading approved: the "One-way street or divided road?" cell, refusing with a 400 when the twin search can't decide, and replacing the Divided toggle on one-way roads.
>
> The R92 issue is #310. Link it from #308's checkpoint.
>
> execution-sequence.md is already updated (DOTI line under Parked; #308 → #309 → #300 in the order). Don't redo it.
