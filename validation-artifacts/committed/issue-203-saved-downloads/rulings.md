# issue-203-saved-downloads: the rulings this arc is built under

**Issue:** #203, "Saved-mode download anchors navigate to raw "Render failed" text on error + /api/plans/[id]/audit-pdf is dead code".

## Ryan, 2026-10-14 (the backlog arc), verbatim excerpt

> Include the parked launch-prep chain (#204 → #202 → #194 → #203 → #195) unless an item needs money, legal or an outside service.
>
> 3. Build BUILD items one arc per branch, usual loop: plan, Rule 5 prediction before the diff, verifier, backticked result: line. Batch ready branches so one "ship ready" can take several. After each ship, check production yourself and close the issue.

The triage report put #203 at BUILD 5: "Downloads fetched in-app with an error state and Try again (#180 wording); delete the dead `audit-pdf` route."

## #203's Proposed solution, quoted

> - Anchors become fetch-driven downloads with an in-app error state using the #180 vocabulary + retry affordance (and the #197 stamp so a stale error dies on edit, per the OutputCards instance `c0b87df`).
> - Decide route B: delete `/api/plans/[id]/audit-pdf`, or wire it behind the same dirty gate. Either is fine; silence is not.

## R145 self-ruled (2026-10-14)

1. **A: the six saved-mode anchors become fetch-driven buttons.** These are the five download cards (pdf, xlsx, crew-pdf, markdown, audit-pdf) and the quote. A failure stays on the page: the card's note prints the same message the sandbox prints for the same response (400 → the backend's `detail.message`; otherwise `Render failed (<status>)`; a thrown fetch → `Network error`), and the button reads "Try again". A success saves the file under the route's own `content-disposition` name, as the anchor did.
2. **The stamp.** A saved-mode error is stamped with the plan id and shows only while the plan is that id and not dirty. An edit makes the plan dirty, which already disables the downloads and prints "Unsaved edits…", so the error dies on edit.
3. **B is already decided, by the code since the issue was filed.** `/api/plans/[id]/audit-pdf` isn't dead. The audit card renders it as the fifth saved anchor (`components/OutputCards.tsx`, `kinds.map` over the five cards; pinned in `OutputCards.test.tsx`), and the dirty gate covers it like the others. The route stays. Deleting it would remove a working download. The triage report's "delete the dead `audit-pdf` route" was written before this was checked, and it is corrected here.
4. **One helper.** `extractValidationMessage` moves from `OutputCards.tsx` to `lib/download-error.ts` with the new `downloadSavedPart`, so both components read a failed download the same way.
