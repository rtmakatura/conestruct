# R29 red-proof: the ship stops before the merge when Vercel Production lacks a variable

Ruling R29 (rulings.md): before the merge, the ship checks that `vercel env ls production` lists every variable the site needs at runtime. A missing one, or a logged-out CLI, stops it with "Nothing was merged or pushed." Red-prove it with a fixture listing one name short.

Branch `ship-env-check`, 2026-09-28. Everything below was run on this machine that night.

## What was built

- `scripts/production-env.txt`: the list, 17 `required` and 6 `not-required` names, each with a `file:line` cite under `conestruct/site/`.
- `scripts/vercel-env-check.ps1`: the check. It runs `vercel whoami`, then `vercel env ls production` (the CLI is pinned to `vercel@61.0.0`, `--non-interactive`, with `--cwd` set to the main checkout's `conestruct\site`, where the project link lives). A name counts only when its row's environments column says `Production`. Exit 1 means stop.
- `scripts/ship.ps1` step 1c: runs after the gh check (1b) and before `git merge` (2). It reads the list from the commit being shipped (`git show origin/<branch>:scripts/production-env.txt`), runs the check, and on exit 1 fails with "… Nothing was merged or pushed."

## How the list was derived

The derivation read every `process.env.*` in `conestruct/site` outside tests, `.next` and `node_modules`, plus every name in `conestruct/site/.env.example`. The Clerk keys and routing URLs are read by `@clerk/nextjs` itself (`middleware.ts:69` `clerkMiddleware`, `app/layout.tsx:44` `ClerkProvider`), so their cite is `.env.example`.

- **R29's nine: all `required`.**
- **Added beyond R29: `CLERK_WEBHOOK_SECRET`** (`app/api/clerk/webhook/route.ts:7`). Unset, the webhook answers 500.
- **Added beyond R29: the four `NEXT_PUBLIC_CLERK_*_URL`** (`.env.example:7-10`). Unset, Clerk routes sign-in to its hosted pages.
- **Added beyond R29: `UPSTASH_REDIS_REST_URL`/`_TOKEN`** (`lib/rate-limit.ts:80-81`). Unset, the limiter turns off silently (fail-open).
- **Added beyond R29: `NEXT_PUBLIC_SENTRY_DSN`** (`sentry.*.config.ts:3`). Unset, monitoring turns off silently.
- **`not-required`:**
  - `SENTRY_AUTH_TOKEN`: build-time only.
  - `NEXT_PUBLIC_AUTH_UI`: unset is the intended demo mode.
  - `NEXT_PUBLIC_SENTRY_TEST` and `SENTRY_TEST_ENABLED`: off by default.
  - `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`: Vercel sets it.
  - `NEXT_RUNTIME`: Next.js sets it.

`tests/test_vercel_env_check.py` holds the list to the code:
- a name the site reads that is on neither list fails the drift test;
- every cite must resolve, and at least one per name must be a line containing the name.

## Red before the fix

At `ac04cd4` (the list, the fixtures and the tests, but no check script and no wiring), the run ended `8 failed, 4 passed`. The six check tests failed on the missing script ("Windows PowerShell …" from `-File`), and the two wiring tests failed with `expected one line matching 'vercel-env-check\\.ps1', got []` and the same for the `git show` line. The four list tests passed.

## Green after the fix

Scope: `tests/test_vercel_env_check.py tests/test_ship_push.py tests/test_ship_gate.py tests/test_preview_url.py`. Result: `95 passed`.

## The live runs (real Vercel CLI, logged in as `rtmakatura`)

```
=== A. live Vercel CLI, the real list (no -Required)
Production env: all 17 required variables present.
exit=0

=== B. live Vercel CLI, the list plus one name Production lacks
MISSING from Production:
  R29_REDPROOF_NOT_IN_PRODUCTION
Add each in Vercel -> conestruct -> Settings -> Environment Variables, scoped Production, then redeploy.
PRODUCTION ENV CHECK FAILED: 1 required variable(s) missing: R29_REDPROOF_NOT_IN_PRODUCTION.
exit=1

=== C. the R29 fixture, one name short (stand-in CLI serving tests/fixtures/vercel-env/production-one-short.txt)
MISSING from Production:
  CLERK_SECRET_KEY
Add each in Vercel -> conestruct -> Settings -> Environment Variables, scoped Production, then redeploy.
PRODUCTION ENV CHECK FAILED: 1 required variable(s) missing: CLERK_SECRET_KEY.
exit=1
```

- **Case A:** the check passes on Production as it stands after the outage fix.
- **Case B:** the real CLI and the real parse, with one name Production lacks.
- **Case C:** R29's fixture. `production-full.txt` is the real `vercel env ls production` output of 2026-09-28, captured after Ryan added `CLERK_SECRET_KEY` (colour codes kept; the one visible value cell, an encrypted-config prefix, is redacted). `production-one-short.txt` is that output without the `CLERK_SECRET_KEY` row, tonight's cause. `preview-only-secret.txt` scopes that row to Preview only, the state before the fix, and it fails too (in the test suite).

The first live run of case A crashed before checking anything: Windows PowerShell 5.1 leaves `$PSScriptRoot` empty while it binds `param()` defaults. The ship always passes `-Required`, so the ship path was never affected. The default is now resolved in the body, and `test_run_alone_it_reads_the_list_beside_it` covers it.

## Logged out: why `whoami` gates the listing

Probed with an empty global config (`-Q <empty dir> --non-interactive`), `vercel@61.0.0`:
- `vercel whoami`: exit 1 after ~15 s, printing "Logged out."
- `vercel env ls production`: **does not fail.** It printed "No existing credentials found. Starting login flow...", a device-login URL, "Waiting for authentication...", then "Success! Logged in." and the listing. The CLI completed a device login on its own and wrote an `auth.json` into the probe's config directory, which was deleted straight after.

So the check runs `whoami` first and never calls `env ls` when that fails. `test_not_logged_in_stops_before_listing` asserts that the stand-in CLI saw only `whoami`.

## What this does not prove

- **No ship ran.** The ship_gate hook gates every run of `scripts/ship.ps1`, so the wiring is proven as text: step 1c sits after `gh auth status` and before `git merge`, and its failure line says "Nothing was merged or pushed." This follows the R27 precedent (`tests/test_ship_push.py`). A `-DryRun` go from Ryan would exercise step 1c live, because 1c runs before the dry-run exit.
- **The first ship won't run the check.** The ship of this branch runs main's copy of the script from before R29, so it doesn't run the check. The first ship after it does.
