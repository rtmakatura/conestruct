# migration-0002-idempotent: the rulings this arc is built under

## Ryan, 2026-10-15, verbatim

> Two follow-ups (Ryan, 2026-10-15), self-rule under R145:
> 1. Make migration 0002 idempotent (ADD COLUMN IF NOT EXISTS) so a future drizzle-kit migrate against prod passes over the console-added column. No prod DB writes from you. Show that a migrate dry-run against a copy with the column already present succeeds.
> 2. File an issue for the #202 narrowing (old saved plans' XLSX prices defaults without labelling them as defaults), tagged to land before #204 turns saved plans on.
> Also confirm #28 (closed not planned), #205, #128, #146 and #204 each got their R151 comment; give links. Backticked result: line for "ship ready" if anything ships.

## Why editing the file is safe (measured, not assumed)

drizzle-orm's pg migrator (`node_modules/drizzle-orm/pg-core/dialect.js:57-67`, the version the repo pins, `^0.45.2`) reads the last row of `drizzle.__drizzle_migrations` by `created_at`. It applies every journal entry whose `folderMillis` is newer and records `(hash, created_at)`. It never compares a stored hash with a file's. So:

- On production, whose last recorded migration is `0001` (2 applied, read 2026-10-15), a future `drizzle-kit migrate` runs `0002` once. With `IF NOT EXISTS` that's a no-op over the console-added column, and it's recorded.
- Anywhere `0002` already ran in its old form, it's recorded and not re-run, so the edit changes nothing there.

## R145 self-ruled (2026-10-15)

1. **The statement, exactly Ryan's console form:** `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "quote_settings" jsonb;`. The snapshot and journal stay as generated, since the schema they describe is unchanged.
2. **The proof runs on a throwaway in-memory Postgres (PGlite) in the job's temp folder,** through drizzle-orm's own migrator with this repo's migrations folder. No production connection is opened.
   - **Setup, built to match production:** `0000` and `0001` applied and recorded, then the column added by hand as the console did.
   - **Run:** the old `0002` must fail on it (the red), and the new one must pass and be recorded (the green).
