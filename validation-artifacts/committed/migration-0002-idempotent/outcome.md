# Rule 5 outcome: migration-0002-idempotent

Prediction: `prediction.md`, committed in `c93d24ab` before the change. Base: `eaf5cb14`.

The change is one line in `conestruct/site/db/migrations/0002_quote_settings.sql`: `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "quote_settings" jsonb;`. No other file in the repo changed.

## Proof

`proof.mjs` ran drizzle-orm's own pg migrator (`drizzle-orm@0.45.2`, the repo's pin, via its PGlite driver) against throwaway in-memory Postgres instances (`@electric-sql/pglite@0.2.12`, installed in the job's temp folder, not the repo). Output: `proof-output.json`.

| case | predicted | outcome |
|---|---|---|
| fresh | 3 applied, the column exists | ok; 1 column; 3 recorded |
| production-like (`0000`, `0001` recorded; column added by hand), **old** `0002` | fails on the existing column | fails: `column "quote_settings" of relation "plans" already exists`; still 2 recorded |
| production-like, **new** `0002` | succeeds, recorded | ok; 1 column; 3 recorded |
| re-run | nothing applied | ok; 1 column; 3 recorded |

The production-like setup matches what was read from production on 2026-10-15: 2 migrations recorded, then the column added in the Neon console. So the next `drizzle-kit migrate` against production applies the new `0002` as a no-op and records it, where the old file would have stopped on the error above. No production database was opened or written.
