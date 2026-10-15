# Rule 5 prediction: issue-203-saved-downloads (written before any code)

Base: `issue-194-saved-quote` at `9ccdb623` (stacked).

## What changes (saved mode with a plan id, not dirty; flag-dormant on prod)

- **`components/OutputCards.tsx`:** each card's `<a href="/api/plans/<id>/<kind>" download>` becomes a `<button class="dl-btn">` that GETs the same URL.
  - On 200 it saves the blob under the response's `content-disposition` filename (fallback `plan.<ext>`).
  - On failure the card prints the message in its note slot (the public mode's slot), and that button reads "Try again".
  - The band names the file while it renders (`useRenderRequest`), and the write lock disables the buttons, as in public mode.
- **`components/QuotePanel.tsx`:** the saved quote anchor becomes the same kind of button. A failure prints in the panel's existing `err` line.
- **New `lib/download-error.ts`:** `extractValidationMessage` (moved, unchanged) and `downloadSavedPart(url, ext)`, which returns `null` on success or the message.
- **Unchanged:**
  - public mode (`/sandbox`);
  - the dirty-plan disabled buttons and their note;
  - the sign-up links when there's no plan id;
  - every `/api/plans/*` route, including `audit-pdf`.

## Messages (no new wording; the sandbox's own)

| response | card note / quote line | button |
|---|---|---|
| 400 with `detail.message` | that message | Try again |
| 400 without one | Invalid scenario | Try again |
| any other non-2xx (e.g. 502 "Render failed") | Render failed (502) | Try again |
| fetch throws | Network error | Try again |

## Tests

- `OutputCards.test.tsx`: "saved mode with a plan id" now asserts five buttons, not five anchor hrefs. It clicks each and checks the GET goes to `/api/plans/plan-1/<kind>`, in the same order: pdf, xlsx, crew-pdf, markdown, audit-pdf.
- New `components/saved-downloads.test.tsx`, mounted:
  - a 502 keeps the page, prints "Render failed (502)" and labels the button "Try again";
  - a 400 prints the backend's message;
  - a 200 saves under the header's filename;
  - going dirty clears the error;
  - the quote button does the same.
- `lib/download-error.test.ts` for the helper.
- Site suite: green, count up by the new cases. Type census: `OutputCards`' and `QuotePanel`'s Tailwind size uses are unchanged (buttons reuse `dl-btn` and the quote button's existing classes).

## Ship

Frontend-only. On prod the saved surface is dormant (flag off; needs a signed-in account), so the prod check is `/sandbox`'s five cards and quote download, unchanged: a Generate, then one download.
