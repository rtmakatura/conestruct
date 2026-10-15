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
