# issue-195-app-plans-redirect: the rulings this arc is built under

**Issue:** #195, "Signed-in users on /app/plans/new are told to "Sign up" everywhere, with no save control".

## Ryan, 2026-10-14 (the backlog arc), verbatim excerpt

> Include the parked launch-prep chain (#204 → #202 → #194 → #203 → #195) unless an item needs money, legal or an outside service.
>
> 3. Build BUILD items one arc per branch, usual loop: plan, Rule 5 prediction before the diff, verifier, backticked result: line. Batch ready branches so one "ship ready" can take several. After each ship, check production yourself and close the issue.

The triage report put #195 at BUILD 6: "Redirect `/app/plans/*` to `/` while the flag is off."

## #195's Proposed solution and Acceptance, quoted

> Redirect `/app/plans/*` to `/` while the flag is off. If the flag-off state is intentional scaffolding, the redirect is the honest minimum; enabling the flag is a separate product decision.

> - No reachable route renders sign-up prompts to an authenticated user.
> - The redirect (or the enabled flag) covered by a route test.

## R145 self-ruled (2026-10-14)

1. **The issue's redirect, as written.** Both `/app/plans/new` and `/app/plans/[id]` redirect to `/` when `AUTH_UI_ENABLED` is false (`lib/feature-flags.ts`, `NEXT_PUBLIC_AUTH_UI`). The redirect runs first, before auth or the database. With the flag on, both pages are byte-identical to today. Turning the flag on is #204's decision and waits on Ryan.
2. **`/app`'s "+ New plan" links stay.** Hiding them is out of the issue's scope, and it would move the type census for `app/app/page.tsx`. Until the flip, those two links land on `/`. That's honest (no sign-up prompt, no dead workbench), and #204's flip checklist covers re-linking.
