# Monitoring

## Sentry — error tracking

Conestruct has two Sentry projects in the `conestruct` org:

| Project | Slug | Catches |
|---|---|---|
| Next.js frontend | `javascript-nextjs` | Browser errors, Next.js API routes, edge runtime |
| Python backend | `python` | FastAPI render service running on Modal |

Performance monitoring is off (`tracesSampleRate: 0`). Only error events are captured.

### Architecture

**Frontend** (`conestruct/site/`):
- `sentry.client.config.ts` — browser SDK init
- `sentry.server.config.ts` — Node runtime init (App Router server components, API routes)
- `sentry.edge.config.ts` — edge runtime init (middleware)
- `instrumentation.ts` — wires the server/edge configs at startup
- `app/global-error.tsx` — catches React render errors in the App Router
- `next.config.mjs` — wrapped with `withSentryConfig` for source-map upload during build

**Backend** (`src/api/render_api.py`):
- `sentry_sdk.init(...)` runs once at module import if `SENTRY_DSN` is set
- `StarletteIntegration` + `FastApiIntegration` auto-capture unhandled exceptions
- `before_send` filter drops any `HTTPException` with `status_code < 500` so intentional validator 400s (geometry, gated scenarios) don't trigger Sentry alerts

### Required env vars

**Vercel** (Production + Preview + Development):
- `NEXT_PUBLIC_SENTRY_DSN` — public DSN, ships to the browser bundle

**Vercel** (Production + Preview only, not Development):
- `SENTRY_AUTH_TOKEN` — build-time only, used by `withSentryConfig` to upload source maps to Sentry so production stack traces are readable. Create in Sentry → Settings → Auth Tokens with scope `project:releases` + `project:write`.

**Modal**:
- `sentry-dsn` secret with key `SENTRY_DSN` — referenced in `modal_app.py` as `modal.Secret.from_name("sentry-dsn")`. Create with:
  ```bash
  modal secret create sentry-dsn SENTRY_DSN=<dsn-from-sentry>
  ```

### PII filtering

Both SDKs run with `sendDefaultPii: false` / `send_default_pii=False`. IPs, cookies, and request headers are not sent by default. The `beforeSend` hook in the frontend configs additionally scrubs any `Authorization` / `Cookie` headers that might otherwise leak through breadcrumbs or request capture.

Coordinates (lat/lng) and project names ARE sent — these are useful context for debugging render errors and contain no PII.

### Verification (test endpoints)

There are two gated debug endpoints, one on each side. Both default OFF and 404 in normal operation. **Never enable these in Production for normal operation.** Enable inline only when re-verifying the Sentry integration, then disable again.

**Backend** — `/debug/sentry-test/500` and `/debug/sentry-test/400`:
- Gate: env var `SENTRY_TEST_ENABLED=1`
- Not part of the standard Modal deploy; not stored as a permanent secret
- To enable temporarily, edit `modal_app.py` and add an inline secret:
  ```python
  secrets=[
      modal.Secret.from_name("conestruct-render-secret"),
      modal.Secret.from_name("mapbox-token"),
      modal.Secret.from_name("sentry-dsn"),
      modal.Secret.from_dict({"SENTRY_TEST_ENABLED": "1"}),  # temporary
  ],
  ```
  Then `modal deploy modal_app.py`, verify, then revert the diff and redeploy.
- Trigger with the same Bearer secret used for the render endpoints:
  ```bash
  curl -H "Authorization: Bearer $RENDER_API_SECRET" \
       https://rtmakatura--conestruct-render-fastapi-app.modal.run/debug/sentry-test/500
  curl -H "Authorization: Bearer $RENDER_API_SECRET" \
       https://rtmakatura--conestruct-render-fastapi-app.modal.run/debug/sentry-test/400
  ```
  - `/500` raises a `RuntimeError` → lands in Sentry (python project) with full stack trace
  - `/400` raises `HTTPException(400)` → dropped by the `before_send` filter, does NOT land in Sentry

**Frontend** — `/debug/sentry-test` (page) and `/api/debug/sentry-test` (API route):
- Page gate: env var `NEXT_PUBLIC_SENTRY_TEST=1` (build-time inline, redeploy required)
- API gate: env var `SENTRY_TEST_ENABLED=1` (runtime)
- To enable temporarily, add both to Vercel (Preview is fine for verification) and redeploy
- Visit `/debug/sentry-test` and click each button:
  - "Throw client error" → browser-side exception, lands in javascript-nextjs project
  - "Throw server error" → calls `/api/debug/sentry-test`, server-side exception, lands in javascript-nextjs project
- When done, unset both env vars in Vercel and redeploy

### Configured filter (backend)

The `_drop_expected_http_errors` function in `src/api/render_api.py`:

```python
def _drop_expected_http_errors(event, hint):
    exc_info = hint.get("exc_info")
    if exc_info:
        exc = exc_info[1]
        if isinstance(exc, HTTPException) and exc.status_code < 500:
            return None  # drop, do not send to Sentry
    return event
```

This means:
- Validator 400s (geometry_validation_failed, scenario kind gating) → DROPPED
- `/debug/sentry-test/400` → DROPPED
- Any future `HTTPException(4xx)` → DROPPED
- `HTTPException(500)` raised by existing `except Exception` wrappers → KEPT
- Unhandled `Exception` → KEPT (FastAPI integration captures before raise translates to 500)

### Known deprecation

`@sentry/nextjs` 10.x emits a build warning recommending the migration from `sentry.client.config.ts` → `instrumentation-client.ts`. That migration is only required for Turbopack. We're on Next.js 14.2.35 with webpack — the current pattern works. Revisit when we upgrade to Next.js 15+ or enable Turbopack.

### Disabling Sentry

Sentry is opt-in via DSN presence. To disable temporarily:
- Frontend: unset `NEXT_PUBLIC_SENTRY_DSN` in Vercel and redeploy
- Backend: remove the `sentry-dsn` secret from the Modal `secrets=[...]` list and redeploy

Both SDKs are wrapped in `if (dsn) { init(...) }` so absence of DSN means complete no-op — no overhead, no failed sends.
