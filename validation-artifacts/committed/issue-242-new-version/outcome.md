# Rule 5 outcome: issue-242-new-version (pre-ship; the prod proof is appended after the ship)

Prediction: `prediction.md`, committed in `70ac4de1` before any code. Base: `824840f`.

| Predicted | Outcome |
|---|---|
| `GET /api/version` returns `{sha}` from the inlined `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, `no-store` | `app/api/version/route.ts`; pinned in `route.test.ts` (sha, null when none, header) |
| gated like every `/api` route; middleware completeness names it | `middleware.test.ts` gains `/api/version` in `GATED_API` |
| `useNewVersion` polls every 300 000 ms and on visible; true once a different non-empty sha is served; never asks without a built sha | `lib/new-version.ts`; pinned in `new-version.test.ts` (5) |
| AppNav shows "New version. Reload" only when stale; the click reloads; byte-identical before | the button renders only when stale (pinned: absent, present, reloads on click only) |
| census AppNav `text-[10px]` 4 → 5; `tsxUses` 204 → 205 | as predicted; `lib/design` passes |
| site suite green, +new cases | 2288 passed (2271 at the base, +17); `tsc` 0 errors. Python `test_vercel_env_check.py` 14/14: the env name read is already classified |

## Not predicted

The prediction said the nav is "byte-identical until a newer deploy exists". It isn't quite. The polite live region (`<span role="status">`) is mounted always and stays empty until the button appears inside it. A live region has to exist before its content changes to be announced, and putting `role="status"` on the button itself would have replaced its button role. The empty span has no content, padding or border, so it takes no width. The prod proof measures the nav either way.

## Prod proof (shipped `97b24c8`, then `11443c3` deployed over it)

`prod/held242.cjs` opened `/sandbox` at 1440 and 360 on the `97b24c8` build and held the tabs. It told each tab every 20 s that it became visible, across the `issue-202-quote-settings` frontend deploy (`11443c3`). Two independent runs (`prod/held242.json`, `prod/held242b.json`):

| run, width | built | notice at (UTC) | live | text | nav | button | scrollWidth | after Reload |
|---|---|---|---|---|---|---|---|---|
| 1, 1440 | `97b24c8` | 15:09:43 | `11443c3` | New version. Reload | 52 px | 51 px | 1440 | notice gone |
| 1, 360 | `97b24c8` | 15:09:51 | `11443c3` | New version. Reload | 52 px | 51 px | 360 | notice gone |
| 2, 1440 | `97b24c8` | 15:09:53 | `11443c3` | New version. Reload | 52 px | 51 px | 1440 | notice gone |
| 2, 360 | `97b24c8` | 15:10:01 | `11443c3` | New version. Reload | 52 px | 51 px | 360 | notice gone |

No tab showed the notice at open, while the live build was its own. The nav height didn't change (52 px). The button fills it, minus the nav's 1 px border, which is above the 44 px floor. There's no sideways scroll at 360. Crops of the nav: `prod/held242*-1440.png`, `prod/held242*-360.png`.
