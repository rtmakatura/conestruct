# issue-202-quote-settings: the rulings this arc is built under

**Issue:** #202, "Workbench quote XLSX always built from DEFAULT_QUOTE_SETTINGS — plan-row quote settings are never persisted or read".

## R151 (Ryan, 2026-10-15), verbatim

> Ryan's answers (2026-10-15), R151:
> 1. #204: (a) saved plans stay off on prod until a lawyer reviews /terms and /privacy.
> 2. #202: (a), with a guard: the migration is additive only (new nullable column; nothing dropped, renamed or rewritten). Put the exact SQL in your report before the ship. If it needs anything beyond an additive change, stop and ask.
> 3. Saved-plan prod checks: (b) local and mounted tests only for now. Revisit when #204 turns saved plans on.
> 4. #242: (a) one line in the nav. Unslop rules for the copy.
> 5. #28: (a) close as not planned, with the reason.
> 6. #205: (a) the four cities stay unreachable until 02-JURISDICTION-DATA.md exists.
> 7. #128: (a) parked.
> 8. #146: (a) parked.
> 9. #307: (a) downloads send back a signed copy of Generate's scan. The server verifies the signature and refuses honestly if it's invalid. Prove 20 of 20 downloads on prod with no re-scan.
> Build #202, #242 and #307 in your order, close or park the rest with a comment each, and give a backticked result: line for "ship ready".

Option (a) for #202 was "I build it, including the additive nullable column, and run `drizzle-kit migrate` on prod Neon at ship time".

## The migration (the guard's check)

`drizzle-kit generate` against the new schema produced exactly one statement, `db/migrations/0002_quote_settings.sql`:

```sql
ALTER TABLE "plans" ADD COLUMN "quote_settings" jsonb;
```

A new nullable column with no default: nothing dropped, renamed or rewritten, and no existing row touched. This is inside the guard.

## R145 self-ruled (2026-10-15)

1. **The issue's Surfaces A and B, end to end.**
   - **A:** Save (POST and PUT) persists the shell's live settings, coerced by the same `coerceQuoteSettings` every render route uses.
   - **B:** the row route prices the quote with the persisted settings.
   - **Opening:** opening a saved plan seeds the shell's settings from the row.
2. **A settings edit makes the plan dirty.** The #183 baseline pattern extends to settings: the last persisted settings object, compared by identity. Otherwise an unsaved rate edit would again be silently dropped from the row-backed XLSX, the defect itself. Downloads then ask for a save, as they do for a scenario edit.
3. **#194's hide reverses by design.** #194 hid the saved-mode fields because they reached no request, and it said so in its own close comment. Now they do, so the eight fields return in saved mode and the defaults line goes. The flagger "Auto · N from layout" caption stays public-only, since only public mode computes it. In saved mode the field shows no caption until it's edited, then "Manual override".
4. **Rows with no saved settings.** The issue asks for "defaults explicitly marked in the document". Such a row (any saved before this column) opens with `DEFAULT_QUOTE_SETTINGS` in the eight fields, and the XLSX prices those same values, which its own rate columns print. The values used are on the screen and in the document, so nothing is substituted silently, and no new document text is needed. Prod has no saved plans while #204 keeps the flag off.
5. **Order at ship.** The new schema selects the column, so the migration runs on prod before the branch ships. The column is harmless to the code already live. If the migration can't run, the ship stops.
