# Rule 5 prediction: issue-195-app-plans-redirect (written before any code)

Base: `issue-203-saved-downloads` at `2dd0425c` (stacked).

## What changes

- `conestruct/site/app/app/plans/new/page.tsx` and `app/app/plans/[id]/page.tsx`: first line of the page, `if (!AUTH_UI_ENABLED) redirect("/")`.
- **Flag off (prod today):** a signed-in visit to either route gets Next's redirect to `/`. A signed-out visit is unchanged, because `middleware.ts`'s Clerk protection on `/app(.*)` runs first and sends it to sign-in. So no reachable route shows a signed-in user "Sign up to download".
- **Flag on:** both pages render exactly as today.

## Tests

- New `app/app/plans/flag-redirect.test.tsx`, a route-level test: with the flag off each page calls `redirect("/")` before touching auth or the database (both mocked to throw if reached). With the flag on, `/app/plans/new` renders the workbench shell, and `[id]` reaches auth.
- `middleware.test.ts` unchanged: the middleware's answer for these paths doesn't change, since the redirect is in the page.
- Site suite: green, count up by the new cases.

## Ship

Frontend-only. Prod check: signed out, `/app/plans/new` still goes to sign-in (middleware, unchanged). The signed-in redirect can't be driven on prod without an account; the route test pins it.
