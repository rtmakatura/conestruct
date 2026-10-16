# Rule 5 outcome: #324, the quote XLSX says when its rates are the defaults

The prediction is `prediction.md`, committed before any code.

## Ryan's instruction (2026-10-16), verbatim
> Next: #324 (old saved plans' quote XLSX prices default settings without saying so). Build it now so it's done before #204. Self-rule under R145: label the defaults honestly in the XLSX (Rule 10), test with a plan saved before #202's column existed (quote_settings null), and change nothing for plans that have saved settings. Usual loop to a backticked result: line.

## Predicted and found

| Predicted | Outcome |
|---|---|
| `QuoteRequest.settings_source: Literal["default"] \| None` | Done. Any other value gets a 422 (pinned) |
| `proxyRender` sends `settings_source: "default"` only for a `quote` of a row whose `quote_settings` is null | Pinned in `app/api/plans/quote-settings.test.ts`: a null row's quote carries it; a row with settings carries none; other kinds of either row carry none. Red without the proxy change (1 failed), green with it |
| The XLSX line at Quote Summary A8: "Rates are the default settings. This plan was saved before plans kept their own rates." | Pinned in `tests/test_quote_default_rates_324.py`. With the flag, A8 is the line; without it, A8 is empty. Every other cell of every sheet, the prices included, is equal with and without it |
| A plan with saved settings, the public quote, the bundle and every other render: unchanged | `parity323f.py` (every corpus case and the TA-23 bodies, 9 routes including `/render/quote`) at `a2ef3ab` and after: 963 responses, **none changed**. No request there sends the flag, which is every request but a null row's |

## Not built
Surface C, a workbench provenance line for null-settings rows. The issue marks it optional, and the instruction names the XLSX.

## Suites
- **pytest:** 2,918 passed, 2 skipped.
- **mypy:** 0 issues.
- **ruff:** clean.
- **vitest:** 2,309 passed.
- **tsc:** clean.

## Not live until #204
Saved plans are off on production (#204, R151), so no customer can reach a null-settings row yet. A production check of the row route waits for #204's flip (R151 point 3: local and mounted tests only for saved-plan flows until then).
