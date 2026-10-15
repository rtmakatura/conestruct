# issue-239-archived-landing: the rulings this arc is built under

**Issue:** #239, "/landing copy rewrite — archived page kept but unreachable pending honest replacement".

## Ryan, 2026-10-14 (the backlog arc), verbatim excerpt

> 1. Triage. List every open issue on gh. Put each in one bucket:
>    - BUILD: you can rule it yourself under R145. Give it an order.
>
> 3. Build BUILD items one arc per branch, usual loop: plan, Rule 5 prediction before the diff, verifier, backticked result: line. Batch ready branches so one "ship ready" can take several. After each ship, check production yourself and close the issue.

The triage report put #239 at BUILD 2: "The coming-soon page at `/` replaced it. Delete the component (git keeps it)."

## #239's own Action, quoted

> When a landing page is wanted again (launch-prep cluster territory: #204/#202/#194/#203/#195), rewrite the copy against the current product's verified claims (the 2026-09-02 capability table is the source), or delete the component if the launch cluster supersedes it.

## R145 self-ruled (2026-10-14)

1. **Delete it; don't rewrite it.** The coming-soon gate (`d7c3240` and later) put the public page at `/`, which is what the launch cluster's homepage question was about. Rewriting the archived copy would add new public claims, so it's the delete option the issue names. Git keeps the page: `git show 4c52c492:"conestruct/site/app/(archived)/landing/page.tsx"`.
2. **Its components go with it.** Ten components exist only for this page (Nav, SheetMeta, Hero, DimStrip, MathSection, FinalCTA, Footer, PlanSheet, ScenarioCard, TaperViz). Measured: no other importer in `conestruct/site` or `scripts/`. Their rows in the ink and type censuses leave too, and the pins are restated.
3. **The redirect stays.** `/landing` keeps its 307 to `/`, so an old link still lands somewhere real. The redirect test stays, and its comment is updated.
4. **CSS stays.** Any `globals.css` rule that only these components used is out of scope. The census's CSS figures don't move.
