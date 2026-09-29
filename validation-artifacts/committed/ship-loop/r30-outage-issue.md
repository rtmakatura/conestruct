# R30: the outage issue, drafted for Ryan to post

Drafted 2026-09-28 for Ryan to paste into GitHub. Sources: the `light-sheet-flip` session transcript (4d7631f7), `gh api` deployment statuses, and `vercel env ls` output (quoted in rulings.md R28 and r29-redproof.md).

**The window: Ryan's figure was 18 minutes. The record supports ~14 minutes of 500s** (≈04:18:36Z → 04:32:55Z), and 17 minutes from the push to recovery (04:15:59Z → 04:32:55Z). The draft uses the measured figures and shows the timeline. Change the title if 18 is meant from a different start.

```
Title: www.conestruct.com answered 500 on every route for ~14 min after the 7ea649d ship; CLERK_SECRET_KEY had no Production row
Labels: bug, priority-high, infrastructure, tooling

## Problem

On 2026-09-28 the ship of `ship-creds-frontend-only` (`7ea649d`) took www.conestruct.com down. Every route answered `500` with `X-Vercel-Error: MIDDLEWARE_INVOCATION_FAILED`, the public ones (`/`, `/terms`, `/privacy`) included. The backend was unaffected: healthz served `7ea649d`.

Cause: Vercel Production had no `CLERK_SECRET_KEY`. `vercel env ls` at 04:33Z showed one `CLERK_SECRET_KEY` row, created 154 days earlier, scoped **Preview** only. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` had separate Production and Preview rows, created 8 hours earlier. `clerkMiddleware` (`conestruct/site/middleware.ts:69`) cannot start without the secret key, so it threw on every request.

The Preview-only row came out of the Change 1 Clerk split, when Ryan's dashboard steps took Preview off the live keys and added dev keys for Preview (`checkpoint-1.md:255-267`). That checkpoint named the risk ("The one real mistake here would be unticking Production", `checkpoint-1.md:199-200`). The record doesn't say which click left the key Preview-only.

Two things hid it:
- Vercel env changes reach only new builds. The production build of `55c9054` predated the change and kept serving 200s.
- Change 1's prod sign-in check ran against that old build, so it passed.

The first production build after the change was this ship's.

Classification: behavior-breaking, full frontend outage. No data was lost or written wrongly. No code defect: the same `7ea649d` code answered 200 on its Preview URL, and the `55c9054` production deployment URL still answered 200. Violates Rule 10 in spirit: a config absence stayed silent until it took the site down.

## Timeline (UTC; MDT = UTC-6)

1. 04:15:45 Ryan's go, `ship ship-creds-frontend-only`. At 04:15:59 `ship.ps1` merges and pushes `46afd47..7ea649d` to `main`, then deploys Modal. Healthz reaches `7ea649d`.
2. ≈04:18:36 The first Vercel Production deployment of `7ea649d` reports `success` (`conestruct-f4007d8mq`). `ship.ps1`'s frontend poll goes from "served 55c9054" (6 polls) to `500` (22 polls) at about this point. A second production build (`conestruct-2hui456yk`, `success` at 04:21:14) also answers `500`.
3. 04:26 `ship.ps1` times out: "FRONTEND NOT VERIFIED … (500) Internal Server Error". Diagnosis: same code 200 on Preview, 500 on Production, and the old prod URL 200, so the cause is environment, not code.
4. 04:31:58 Ruling R28 authorizes the recovery steps.
5. 04:32:55 `vercel promote` of the `55c9054` deployment (`dpl_CXSGuYMzgxxYyaBJDxpMwP4EvzLQ`). `vercel rollback` had answered `402` on the Hobby plan. `/` and `/terms` answer `200`, `/sandbox` `307`. **Outage over: ≈14 min of 500s, 17 min from the push.**
6. 04:33 `vercel env ls` confirms the cause. At 04:36:54 Ryan adds `CLERK_SECRET_KEY` (the live `sk_live_` key), Production only.
7. 04:37:16 `vercel redeploy … --target production`. It aliased www itself on completion (04:40:53, `conestruct-2pknt2zfd`) before the 200 check R28 required: the recorded deviation. It came up `200`, serving `7ea649d`.
8. 04:48:33 Ryan's browser check: PASS. The ship is closed.

## Fix

- Production `CLERK_SECRET_KEY` added by Ryan in the Vercel dashboard (Production only; the Preview dev-key row unchanged). No existing Production variable was removed or changed.
- Production redeployed at `7ea649d`; www serves `7ea649d`, and healthz equals `main`.

## Prevention (R29)

The ship now checks Vercel Production before it moves anything:
- `ship.ps1` step 1c runs after the gh login check and before `git merge`.
- It runs `scripts/vercel-env-check.ps1` against `scripts/production-env.txt` at the commit being shipped. That list holds the 17 variables the site needs at runtime, each with a `file:line` cite, and a drift test fails on any env name the code reads that the list doesn't classify.
- The check runs `vercel whoami`, then `vercel env ls production`. A missing name, a Preview-only row, or a logged-out CLI stops the ship with "Nothing was merged or pushed."
- Red-proven: tonight's listing with `CLERK_SECRET_KEY` removed stops it and names the key. The real listing passes.

It closes the gap that hid this outage: a dashboard-only env change can no longer wait silently for the next ship's build.

## Acceptance

- A ship whose Vercel Production listing lacks any `required` name in `scripts/production-env.txt` stops before `git merge`, names the missing variable, and says "Nothing was merged or pushed."
- A ship with the Vercel CLI logged out stops at the same point.
- A branch that reads a new `process.env.*` fails the test suite until the name is classified in `scripts/production-env.txt`.
- The existing ship path is unchanged when every variable is present (live: "all 17 required variables present").

## Reference

- Shipped commit `7ea649d`; recovery via the `55c9054` deployment `dpl_CXSGuYMzgxxYyaBJDxpMwP4EvzLQ`; redeploy `conestruct-2pknt2zfd-rtmakaturas-projects.vercel.app`.
- `validation-artifacts/committed/ship-loop/rulings.md`: R28 (the outage ruling) plus its deviation, and R29.
- `validation-artifacts/committed/ship-loop/checkpoint-1.md:197-200, 255-267`: the Clerk split steps and the named risk.
- `conestruct/site/middleware.ts:69`: `clerkMiddleware`.
- Prevention on branch `ship-env-check`: `ac04cd4` (red), `9eebbbc` (fix); `scripts/ship.ps1` step 1c, `scripts/vercel-env-check.ps1`, `scripts/production-env.txt`, `tests/test_vercel_env_check.py`; evidence `validation-artifacts/committed/ship-loop/r29-redproof.md`.
- Priority-high. Resolved in production. The prevention takes effect from the first ship after `ship-env-check` lands (that branch's own ship runs main's pre-R29 `ship.ps1`).
```
