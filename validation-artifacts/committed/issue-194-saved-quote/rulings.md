# issue-194-saved-quote: the rulings this arc is built under

**Issue:** #194, "Workbench quote panel renders eight dead rate inputs and a false "Auto · 0 from layout" caption".

## Ryan, 2026-10-14 (the backlog arc), verbatim excerpt

> Include the parked launch-prep chain (#204 → #202 → #194 → #203 → #195) unless an item needs money, legal or an outside service.
>
> 3. Build BUILD items one arc per branch, usual loop: plan, Rule 5 prediction before the diff, verifier, backticked result: line. Batch ready branches so one "ship ready" can take several. After each ship, check production yourself and close the issue.

The triage report put #194 at BUILD 4: "Hide the rate fields in saved mode and print the auto caption only when it was computed (the issue's no-migration option). Flag stays off."

## #194's Proposed solution, quoted

> POST settings through the saved-plan quote route as sandbox mode does — or hide the fields in saved mode until that lands. Either honest; the plan picks.

## R145 self-ruled (2026-10-14)

1. **Hide the fields in saved mode.** Sending the settings needs them persisted on the plan row, which is #202's migration, and #202 waits on Ryan. Hiding is the issue's other honest option, and it needs no schema change.
2. **Say what the saved quote prices at.** With the fields gone, the panel states the settings the saved-plan route actually uses: `DEFAULT_QUOTE_SETTINGS` (`lib/quote-settings.ts:14`), which `proxyRender` applies when no settings are sent (`lib/render-proxy.ts:112`). The line reads them from that one source, so it can't drift from the price (Rule 10: a default is labelled as the default, never presented as the user's input). It uses the existing provenance type role `tr-prov`, so the type census doesn't move.
3. **Public mode is unchanged.** The issue's principles comment notes that the sandbox's "Auto · 0 from layout" is true there: the count was computed from the layout. It stays.
