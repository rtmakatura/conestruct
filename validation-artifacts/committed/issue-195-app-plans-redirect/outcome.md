# Rule 5 outcome: issue-195-app-plans-redirect

Prediction: `prediction.md`, committed in `6584ac51` before any code. Base: `2dd0425c`.

| Predicted | Outcome |
|---|---|
| both pages open with `if (!AUTH_UI_ENABLED) redirect("/")` | `app/app/plans/new/page.tsx` (first line of `NewPlanPage`) and `app/app/plans/[id]/page.tsx` (first line, before the UUID check, auth and the DB) |
| flag off: redirect to `/` before auth or the database | pinned in `app/app/plans/flag-redirect.test.tsx`: auth and `getDb` are mocked to throw if reached; both pages throw `REDIRECT /` |
| flag on: unchanged | pinned: `new` renders the workbench shell (`mode: "workbench"`); `[id]` goes on to auth |
| `middleware.test.ts` unchanged | 331/331, no edit |
| site suite green, +the new cases | `vitest run`: 2271 passed in 221 files (2267 + 4); `tsc --noEmit` 0 errors |

Nothing unpredicted. Prod: signed out, `/app/plans/new` still goes to sign-in (the middleware runs first); checked after the ship.
