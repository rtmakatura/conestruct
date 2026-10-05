# issue-300-left-side-oneway — the rulings this arc is built under

**Issue:** #300 — "Left-side work on one-way streets can't be planned — the layout models right-side work only".
**Arc:** investigate first; a checkpoint (`checkpoint.md`) before any code.
**Base:** `a5b4e12` = `main` = prod `healthz` (checked 2026-10-05 10:59 MDT).

This file is the arc's authority; every commit on this branch cites it.

---

## #300's body, verbatim (fetched 2026-10-05 with `gh issue view 300`; open; labels enhancement, priority-medium, backend, p21; no comments)

> On a one-way street both edges are curbs, and crews close the left curb lane as often as the right. The #290 side control offers only the right-hand side of traffic (N Broadway southbound: West only), because the layout models right-side work only. MUTCD's typical applications include left-lane closures on one-way and divided roads; the tool can't produce them. Scope: the layout, device placement mirrored for left-side work, the side control offering both curbs on one-way roads (the median side on divided roads is a separate case). Found on Ryan's #290 hand-check 2026-09-25. Refs #290, #281.

## Ryan, 2026-10-05 (the session prompt, verbatim)

> Start #300 (left-side work on one-way streets): investigate only, 📋 checkpoint first, no code.
> - Don't ship anything today; prod must stay at a5b4e12 until tonight's #292 evening window is done.
> - Keep any prod requests out of 12:00–12:20 and 19:00–19:20 so they don't skew the #292 measurements.
> - Checkpoint should cover: where the layout assumes right-side work (file:line), what MUTCD and S-630-1 say about left-side closures on one-way streets (quoted with page cites), a real Denver one-way pin to reproduce on, options with tradeoffs, and the Rule 5 churn prediction.

## Ryan, 2026-10-05 — rulings on the checkpoint (`0c4628f`), verbatim

> Rulings on #300 (quote verbatim):
> R78. Order: C first (one-way read as divided), as its own issue. Draft the issue for the chat to repost; investigate it next, checkpoint first. Then A.
> R79. Scope of A: left-side SHOULDER work only. Near-intersection (Case 18) left side and left lane closures are split out and wait for Rule 8 evidence.
> R80. The left edge is offered only on confirmed one-way roads.
> R81. Page 1 mirroring: take your recommendation; note it in the checkpoint as CHOSEN against P1/P21.
> R82. Field name: work_side, default "right".
> No ships until after tonight's 19:07 #292 window has finished.
