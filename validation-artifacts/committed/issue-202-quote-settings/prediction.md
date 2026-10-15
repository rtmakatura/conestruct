# Rule 5 prediction: issue-202-quote-settings (written before any code)

Base: `issue-242-new-version` at `97b24c8c` (stacked).

## Database

- `db/schema.ts`: `plans.quoteSettings = jsonb("quote_settings")`, nullable.
- `db/migrations/0002_quote_settings.sql` (generated): `ALTER TABLE "plans" ADD COLUMN "quote_settings" jsonb;`. Plus drizzle's `meta/0002_snapshot.json` and a journal entry.

## Code (saved mode only; the flag is off on prod, so nothing a prod user can reach changes)

- **`app/api/plans/route.ts` (POST) and `app/api/plans/[id]/route.ts` (PUT):** accept an optional `quoteSettings`. When present it's stored as `coerceQuoteSettings(quoteSettings)`; a PUT without it leaves the column alone.
- **`components/PlanSaveButton.tsx`:** sends the shell's `settings` as `quoteSettings` on both and hands them back through `onSaved`.
- **`app/app/plans/[id]/page.tsx`:** passes `row.quoteSettings` (coerced, or `DEFAULT_QUOTE_SETTINGS` when null) as `initialQuoteSettings`.
- **`components/GeneratorShell.tsx`:**
  - settings start from `initialQuoteSettings`;
  - a `savedSettings` baseline sits beside `savedScenario`;
  - `planDirty` also holds when `settings !== savedSettings` (identity, as #183);
  - `onSaved` takes the saved settings.
- **`lib/render-proxy.ts` `proxyRender`:** for `kind === "quote"`, passes `coerceQuoteSettings(row.quoteSettings)` when the row has settings. Every other kind is unchanged.
- **`components/QuotePanel.tsx`:**
  - saved mode renders the eight fields again (#194's defaults line goes);
  - the flagger caption shows "Auto · N from layout" in public mode only, and in saved mode only "Manual override" once edited;
  - the saved download still goes through #203's `downloadSavedPart`.

Public mode (/sandbox) is byte-identical.

## Tests

- `QuotePanel.saved-mode.test.tsx` (#194's) changes: saved mode shows 8 fields and no defaults line, and no "Auto ·" caption in saved mode.
- New tests:
  - the plan routes store coerced settings (POST, PUT with and without them);
  - `proxyRender` sends the row's settings for the quote and nothing new for other kinds;
  - the shell goes dirty on a settings edit and clean after a save that returns those settings, mounted.
- `GeneratorShell.saved-dirty.test.tsx` (#183) stays green.
- Site suite green, count up by the new cases.

## Ship order

1. Run `0002_quote_settings.sql` on the prod database first, with `drizzle-kit migrate` from the main checkout's `.env.local`, after confirming read-only that it's the production database.
2. Then ship.
3. Prod check: `/sandbox` unchanged. Saved-mode checks are local and mounted only (R151 item 3).
