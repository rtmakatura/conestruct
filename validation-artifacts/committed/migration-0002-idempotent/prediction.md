# Rule 5 prediction: migration-0002-idempotent (written before the change)

Base: `main` at `eaf5cb14`.

## Change

`conestruct/site/db/migrations/0002_quote_settings.sql`:

```diff
-ALTER TABLE "plans" ADD COLUMN "quote_settings" jsonb;
+ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "quote_settings" jsonb;
```

Nothing else in the repo changes: no snapshot, no journal, no schema, no code. Nothing is shipped to Modal or Vercel that behaves differently, since the site builds from the schema, not the SQL file. No database is written.

## Proof (`proof.mjs`, PGlite in memory, drizzle-orm migrator)

| case | setup | migrate result |
|---|---|---|
| fresh | empty database | `0000`, `0001`, `0002` applied; the column exists; 3 recorded |
| production-like, old `0002` | `0000` + `0001` applied and recorded, then the column added by hand | **fails**: `column "quote_settings" of relation "plans" already exists` (the red) |
| production-like, new `0002` | same | **succeeds**; the column exists once; 3 recorded (the green) |
| re-run | after the green | nothing applied; still 3 recorded |

## Ship

Docs and one SQL file. No frontend or backend change, so the ship shows the backend at the new sha and skips the frontend build.
