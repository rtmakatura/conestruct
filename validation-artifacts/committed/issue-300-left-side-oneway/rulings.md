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

## Ryan, 2026-10-08 (the session prompt, verbatim)

> Next arc. First check gh: is #243 still open with its checkpoint unruled? If yes, bring me that checkpoint's open questions in plain words. If it's closed, start #300 (left-side shoulder work on one-way streets, R79–R82; branch issue-300-left-side-oneway, which another session started). Restack it onto main aa6dcaa without a force push, then investigate first and checkpoint before any code.

#243 was CLOSED on gh (2026-09-30, fixed in `3fe27c3`). The branch was restacked as `issue-300-left-side-oneway-r2` (the three docs commits cherry-picked onto `aa6dcaa`; the old tip `eddf566` recorded in `scripts/superseded.txt`; R55: no force push). #308 (C, R78) is CLOSED and in main, so A is unblocked.

## R119 (Ryan, 2026-10-08), rulings on the build checkpoint (`d2437f0`), verbatim

> R119 (Ryan, 2026-10-08), rulings on the #300 checkpoint:
> Q1: Separate issue, fixed first. Draft it for the chat to repost, then build it: every shoulder arrow board in caution mode, crew sheet and page 1 to match, quoting MUTCD 11th Ed. §6L.06 ¶18 (p. 833) and S-630-1 Note 26. #300 builds after it ships.
> Q2: Yes, flip page 1 together, text upright, dimension labels to the open side, yellow line stays on the top lane edge. Marked CHOSEN under R81.
> Q3: Yes, "Case 11 (right-shoulder closure, mirrored to the left shoulder of a one-way street)", mirror marked CHOSEN, plus a pending-verification note.
> Q4: Yes, backend refuses with a message naming the fix; the side picker shows it; no frontend reset.
> Q5: Yes, offer left only when the verdict is one-way street AND the road is tagged one-way.

## R120 and R121 (Ryan, 2026-10-08, after the #300 ship `da8fce7`), verbatim

> The #300 browser check passed. I'm posting the close comment from the chat, so skip your draft.
>
> R120: one small branch off main (Refs #300). Reword #300's refusal message and the side picker's "why" line so neither uses a "not X" contrast (unslop rules apply to UI strings). Phrase it positively, e.g. "Left-side shoulder work needs a one-way street. This road is set as divided, so pick a right-side curb or change Carriageway." Keep the meaning and the named fix. Copy only: no logic, wire field or gate change. Update any test that pins the old string, run the diff-verifier, and give me the result: line and the go. No checkpoint needed.
>
> R121 (investigate only, no code): on prod plan-44 (N Broadway SB, east curb, left shoulder), the last cone of the downstream taper on page 1 sits on the sidewalk band, past the shoulder's outer edge. Check whether a right-side shoulder plan does the same, and whether it's only the page-1 drawing or the device positions too. Report what you find, and draft an issue for the chat to repost. Fold in the known arrow-board/drum overlap at the taper start if it's the same drawing code.
>
> Also: if this is a foreground session, record tonight's three ships (#313, plan-date-denver, #300) in handoff.md and execution-sequence.md, and do the Part 0 cleanup from cc-prompt-next-batch.md. If it's a background job, say "needs a foreground session" and skip both.

R120's example names one cause ("This road is set as divided"). The side control can't tell which cause made a stored left side stale (a kind change, a "divided" answer, an undecided road), so its line states the need and the fix without naming a cause.
