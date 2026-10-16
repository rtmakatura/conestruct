# Rule 5 prediction: #324, the quote XLSX says when its rates are the defaults

Base: `main` `a2ef3ab`.

R145 self-ruled: Ryan's instruction (2026-10-16) is "label the defaults honestly in the XLSX (Rule 10), test with a plan saved before #202's column existed (quote_settings null), and change nothing for plans that have saved settings." The issue's Surfaces A and B. Surface C (a workbench line) is optional in the issue and not asked for, so it's not built.

## Change

**Surface A, the wire.**
- `src/api/render_api.py` `QuoteRequest` gains `settings_source: Literal["default"] | None = None`.
- `conestruct/site/lib/render-proxy.ts` `proxyRender` sends `settings_source: "default"` beside the settings only for a `quote` render of a row whose `quote_settings` is null. The proxy knows this (`row.quoteSettings == null`); the backend never guesses it.
- The public `/sandbox` quote and the bundle don't send it.

**Surface B, the XLSX.**
- `generate_quote(..., rates_are_defaults=False)`.
- When the flag is set, the Quote Summary sheet writes one line in its empty row 8, under the project lines:
  > Rates are the default settings. This plan was saved before plans kept their own rates.
- Without it, nothing is written there.

## Predicted behavior

- **Null-settings row:** the quote XLSX carries the line, and its prices are unchanged (still the defaults).
- **Row with saved settings:** byte-identical cell values to today; the request carries no `settings_source`.
- **Public quote, bundle, every other render kind, and `/render/quote-breakdown`:** unchanged.
- **No other XLSX** (the device list) changes.

## Tests (Rule 11)

- **Backend payload level:** `/render/quote` with `settings_source: "default"` has the line at Quote Summary A8. Without the field, A8 is empty and every cell equals the response for the same request today.
- **Frontend:** `app/api/plans/quote-settings.test.ts`:
  - a null row's quote request carries `settings_source: "default"`;
  - a row with settings, and every other kind, carries none.
