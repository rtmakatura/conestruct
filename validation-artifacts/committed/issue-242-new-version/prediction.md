# Rule 5 prediction: issue-242-new-version (written before any code)

Base: `main` at `824840f`.

## What changes

- **New `app/api/version/route.ts`:** `GET` returns `{ "sha": <NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA or null> }` with `cache-control: no-store`. It's gated like every other `/api` route. `middleware.test.ts` gains its row, so the completeness test names the file.
- **New `lib/new-version.ts`:** `useNewVersion(built)` polls `/api/version` every `VERSION_POLL_MS` (300 000, CHOSEN) and when the tab becomes visible. It returns true once the served sha is a different non-empty sha than `built`. With `built` null it never fetches.
- **`components/AppNav.tsx`:** when the hook says so, the right slot shows a `<button>` reading "New version. Reload". Clicking it calls `window.location.reload()`.
  - Before that, nothing renders in its place, so today's nav is byte-identical until a newer deploy exists.
  - Visible at every width; full nav height (52 px).
- **Type census:** `components/AppNav.tsx` `text-[10px]` 4 → 5; `CENSUS_PINS.tsxUses` 204 → 205 (sites and files unchanged).

## Tests

- `lib/new-version.test.ts`:
  - no built sha → no fetch;
  - same sha → false;
  - different sha → true;
  - empty or failed answer → false;
  - becoming visible triggers a check.
- `components/AppNav.new-version.test.tsx`, mounted: hidden while current; shows the button when stale; the click reloads.
- `app/api/version/route.test.ts`: the body and the no-store header.
- Site suite green, count up by the new cases.

## Prod proof

The notice can only appear when a newer frontend deploy exists. So during the same "ship ready", I open `/sandbox` on prod at 1440 and 360 right after this branch ships, and hold the tabs. The next branch in the list (#202) changes the site, so once its frontend is served, the held tabs' check should show "New version. Reload" (made visible again to trigger it). Then a click reloads onto the new build, and the notice is gone. Measured:
- nav height unchanged (52 px);
- no sideways scroll at 360;
- the button's box at least 44 px tall.
