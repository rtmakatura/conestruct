# R116 rulings (verbatim)

## R116 (Ryan, 2026-10-08), investigate first, screenshots before code

> R116 (Ryan, 2026-10-08), investigate first, screenshots before code:
>
> 1. Needs You on a near-intersection plan at N Broadway SB / E 11th Ave (39.73370, -104.98753), Denver: the jurisdiction-delta row renders raw keys ("add_device", "1", "arrow_board"), its sentence overlaps the title, and its detail text wraps one word per line. It also has an em dash. Find why (likely a row type the R99/R103 redesign never styled, now common because R108 prefills Denver). Make it match the other Needs You rows: plain title ("Arrow board added"), one detail line, its cite on the right. No raw keys anywhere in the UI.
> 2. Under "Work zone length (ft)" on the near-intersection kind, a block reads "typed · the extent the plan is built for" then Advance warning / Taper / Buffer / Work zone / Downstream. Ryan hasn't seen it before and finds it ugly. Report when it shipped (sha), which kinds show it, and propose either removing it or a tidy version that matches the WHAT band. Mock both.
> 3. On that plan's PDF page 1, the Notes & Sign Schedule box is overcrowded: "Speed limit" collides with PARAMETERS, and the advance-warning table prints its CODE/DESCRIPTION/DISTANCE headers twice on one line. Find the cause and propose the fix.
>
> Checkpoint with before/after screenshots for all three. No code until I rule.
