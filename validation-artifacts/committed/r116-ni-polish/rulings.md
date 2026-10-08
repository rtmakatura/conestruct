# R116 rulings (verbatim)

## R116 (Ryan, 2026-10-08), investigate first, screenshots before code

> R116 (Ryan, 2026-10-08), investigate first, screenshots before code:
>
> 1. Needs You on a near-intersection plan at N Broadway SB / E 11th Ave (39.73370, -104.98753), Denver: the jurisdiction-delta row renders raw keys ("add_device", "1", "arrow_board"), its sentence overlaps the title, and its detail text wraps one word per line. It also has an em dash. Find why (likely a row type the R99/R103 redesign never styled, now common because R108 prefills Denver). Make it match the other Needs You rows: plain title ("Arrow board added"), one detail line, its cite on the right. No raw keys anywhere in the UI.
> 2. Under "Work zone length (ft)" on the near-intersection kind, a block reads "typed · the extent the plan is built for" then Advance warning / Taper / Buffer / Work zone / Downstream. Ryan hasn't seen it before and finds it ugly. Report when it shipped (sha), which kinds show it, and propose either removing it or a tidy version that matches the WHAT band. Mock both.
> 3. On that plan's PDF page 1, the Notes & Sign Schedule box is overcrowded: "Speed limit" collides with PARAMETERS, and the advance-warning table prints its CODE/DESCRIPTION/DISTANCE headers twice on one line. Find the cause and propose the fix.
>
> Checkpoint with before/after screenshots for all three. No code until I rule.

## R117 (Ryan, 2026-10-08), rulings on checkpoint.md

> R117 (Ryan, 2026-10-08), rulings on the R116 checkpoint:
> Q1a: Yes, "Arrow board required" when the layout already places it; "added" only when a count was raised.
> Q1b: Yes, the backend records whether each rule raised a count; only then "changed this plan" or "+N jurisdiction-required".
> Q1c: Yes, "{Jurisdiction} work-method rule".
> Q1d: Yes, leave the sourced data as is; Needs You stops showing that sentence.
> Q2: B, the WHAT-style row with the five lengths in its popover.
> Q3a: The one line naming all 4 cut codes.
> Q3b: Yes, fold into "PLATE DEPARTURES: SEE AUDIT".
> Q3c: Yes, extra spacing only on one-column tables; Case 27 keeps its 4 rows.
> Build 1, then 3, then 2, one branch each.
