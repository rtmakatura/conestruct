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
