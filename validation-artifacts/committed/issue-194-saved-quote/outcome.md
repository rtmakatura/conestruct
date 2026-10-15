# Rule 5 outcome: issue-194-saved-quote

Prediction: `prediction.md`, committed in `8392cf58` before any code. Base: `88e26001`.

| Predicted | Outcome |
|---|---|
| saved mode: the eight `NumberField`s and the "Auto · 0 from layout" caption go | `QuotePanel.tsx`: the grid renders only when `mode.kind !== "saved"`. Pinned: 0 spinbuttons, no "Auto ·" text |
| saved mode: one `tr-prov` line from `DEFAULT_QUOTE_SETTINGS`, with the predicted wording | `savedDefaultsLine(DEFAULT_QUOTE_SETTINGS)`. The test pins the exact string: "This saved plan's quote uses the default settings: 1 day, 0 flaggers, 20 mi delivery, 10% overhead, 10% profit, and $55 flagger, $75 TCS and $45 crew per hour. Custom rates can't be saved with a plan yet." |
| the download control unchanged | the anchor still points at `/api/plans/plan-1/quote` (pinned) |
| public mode unchanged | 8 spinbuttons and "Auto · N from layout" (pinned); `QuotePanel.invalidation.test.tsx` 4/4 unchanged |
| type census unchanged | `lib/design` 77 tests pass with no pin moved |
| new mounted test file | `components/QuotePanel.saved-mode.test.tsx`, 5 tests |
| site suite +the new cases | `vitest run`: 2257 passed (2252 at the base + 5); `tsc --noEmit` clean |

The diff to `QuotePanel.tsx` is larger than the change (104+/81−) because the grid moved one level into the new conditional and was reindented. Its fields and props are unchanged.

Prod: the saved surface is dormant (flag off; seeing it needs a signed-in account), so the prod check after the ship is `/sandbox`'s quote panel: eight fields and the flagger caption, unchanged.
