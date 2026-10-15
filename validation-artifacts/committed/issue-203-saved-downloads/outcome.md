# Rule 5 outcome: issue-203-saved-downloads

Prediction: `prediction.md`, committed in `31fb5053` before any code. Base: `9ccdb623`.

## Predicted and found

| Predicted | Outcome |
|---|---|
| the five cards' saved anchors become buttons that GET `/api/plans/<id>/<kind>` | `OutputCards.tsx` `onSavedDownload`. Pinned: five buttons, no anchors, fetched in card order pdf, xlsx, crew-pdf, markdown, audit-pdf |
| the saved quote anchor becomes a button | `QuotePanel.tsx` `onSavedDownload`; GETs `/api/plans/plan-1/quote` (pinned) |
| messages are the sandbox's own: 400 → `detail.message`; other → `Render failed (<status>)`; thrown → `Network error`; button "Try again" | `lib/download-error.ts`. Pinned in `saved-downloads.test.tsx` (502, 400, thrown) and `download-error.test.ts` (503, string detail, non-JSON) |
| a 200 saves under the route's `content-disposition` name, fallback `plan.<ext>` | pinned: `Broadway_SB.pdf`, `Broadway_SB.xlsx`, `plan.xlsx` |
| an edit (dirty) drops the error | pinned. See below for the save-again case |
| `extractValidationMessage` moves unchanged to `lib/download-error.ts` | moved; the public card path imports it |
| public mode, the dirty-plan disabled buttons, the sign-up links and every route unchanged (`audit-pdf` stays) | the public card and quote tests pass unchanged; no route file in the diff |
| type census unchanged | `lib/design` passes with no pin moved. The error note is still one `text-[12px]` div, shared by both modes |
| site suite green, count up by the new cases | 2267 passed in 220 files (2257 at the base, +10: 7 in `saved-downloads.test.tsx`, 3 in `download-error.test.ts`); `tsc --noEmit` clean |

## Not predicted

- **Two more test files pinned the anchors.** The prediction named only `OutputCards.test.tsx`'s "saved mode with a plan id". These also found the download by its anchor and were moved to the button:
  - `OutputCards.test.tsx`'s "breakdown failed, saved mode": five disabled buttons now, where it checked five `aria-disabled` anchors;
  - #194's `QuotePanel.saved-mode.test.tsx` "keeps the row-backed download", which this stack added one commit earlier;
  - `GeneratorShell.saved-dirty.test.tsx` (#183).
- **`data-download` on the saved buttons.** The #183 test finds "the clean saved download" by its route, as it did by the anchor's `href`, and the dirty-state buttons carry none. So each saved button carries `data-download="<route it fetches>"`, and the test's `pdfAnchor()` reads that. Its four assertions are otherwise unchanged and pass.
- **Clearing on dirty, not just stamping.** The stamp (plan id, not dirty) alone would bring an old error back after the plan is saved again (same id, clean). So `DlCard` and `QuotePanel` also clear the error when the plan goes dirty. Pinned: dirty, then clean again, shows no error and no "Try again".

Prod: the saved surface is dormant (flag off; needs a signed-in account), so the prod check after the ship is `/sandbox`'s cards and quote download, unchanged.
