# Deployment

Operational runbook. See [ARCHITECTURE.md](ARCHITECTURE.md) for *why*
the system is split the way it is; this doc covers *how* to ship a
change without breaking production.

The single biggest pitfall: **Vercel auto-deploys, Modal does not.**
If you change Python code and forget to run `modal deploy`, the live
site keeps calling the old backend until you do.

> **The standard ship path is now `.\scripts\ship.ps1` (as of 747f0d1).**
> Ryan ships with one command that merges `--ff-only`, pushes (Vercel
> picks up the frontend automatically), deploys the backend to Modal, and
> polls `/healthz` until the live sha matches HEAD — **SHIP VERIFIED**, or
> **SHIP NOT VERIFIED — do not close the issue**. It refuses a dirty
> working tree and refuses a non-fast-forward merge; a diverged branch
> stops the ship and goes back to the chat.
>
> Reports and prompts should reference `.\scripts\ship.ps1 -Branch
> <branch>` as the ship step, not raw merge/deploy/curl sequences.
> **Claude Code never runs the script — shipping stays Ryan's.**
>
> The manual merge/push/`modal deploy`/curl sequences below are what the
> script automates on the happy path, and the reference for the cases it
> doesn't cover: rollback, secrets, dependency changes, first-time setup,
> and troubleshooting.

---

## Section 1 — Quick reference

### "I changed only frontend code"

(Anything under `conestruct/site/`.)

1. Push to `main`.
2. `.github/workflows/vercel-deploy.yml` fires
   `curl -X POST $VERCEL_DEPLOY_HOOK`. Vercel rebuilds the Next.js
   app and ships it. ~90 seconds end-to-end.
3. Verify: hit https://conestruct.com, confirm the change is live.
   Check the Vercel dashboard for the build log if anything looks
   off.

Nothing to do on the Modal side. The render service is unchanged.

### "I changed backend Python code" (the critical one)

(Anything under `src/`, `modal_app.py`, `pyproject.toml`, or
`uv.lock`.)

1. Push to `main`. `.github/workflows/modal-deploy-check.yml`
   diff-detects the change and **opens a GitHub issue** titled
   `Modal deploy needed for <sha>` with the `modal-deploy-needed`
   label. The issue lists the changed files.
2. **You** then run, locally:
   ```bash
   modal deploy modal_app.py
   ```
   This takes 1–3 minutes. Modal rebuilds the image (cached layers
   make iterative deploys fast), copies the current `src/` directory
   into the image via `add_local_dir`, and rolls out the new
   container.
3. Verify (in order):
   ```bash
   # 1. Service is up
   curl -fsS https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz
   # → {"status":"ok"}

   # 2. Auth path still works (returns 401, not 503)
   curl -sS -o /dev/null -w '%{http_code}\n' \
     https://rtmakatura--conestruct-render-fastapi-app.modal.run/render/pdf
   # → 401

   # 3. End-to-end: generate a plan on conestruct.com and confirm
   #    the PDF downloads and the device counts match what you
   #    expect from the change you made.
   ```
4. Close the reminder issue with a comment referencing the deploy
   timestamp.

If you skip step 2, the live frontend keeps calling stale Python
code. There is no other failsafe. The reminder issue is the
failsafe.

### "I changed both frontend and backend"

This is the stale-deploy window. Vercel ships in ~90 seconds; Modal
ships when you get around to it. If the frontend depends on a new
backend endpoint or new response field, requests will 404 (or
deserialize wrong) during the gap.

**Deploy order: backend first, then push.**

1. Make and commit the changes locally.
2. **Run `modal deploy modal_app.py` BEFORE pushing.** This puts the
   new backend live while the old frontend is still serving — that's
   safe (the old frontend doesn't know about the new endpoint, so
   it doesn't call it).
3. Verify Modal is serving the new code (same `/healthz` +
   curl-against-the-new-endpoint pattern as above).
4. Push to `main`. Vercel rebuilds and ships. By the time the new
   frontend is live, the backend it depends on is already in place.

If you forgot and pushed first, just run `modal deploy` as soon as
possible. The reminder issue will still be open as your prompt.

### "I added a Python dependency"

1. Add to `pyproject.toml` under `[project] dependencies`. Run
   `uv sync` locally so `uv.lock` updates.
2. **Also add to `RENDER_DEPS` in `modal_app.py`** — that list is
   what Modal uses to build the image. `pyproject.toml` is for local
   dev; `RENDER_DEPS` is for production. If you only update one,
   either local dev or production will be missing the package.
3. Commit both files.
4. Push (triggers reminder issue).
5. `modal deploy modal_app.py` — Modal rebuilds the image with the
   new dep. The first deploy after a dep change is slower (~3–5
   min) because the pip layer cache is invalidated.

### "I added a frontend dependency"

1. `cd conestruct/site && npm install <package>`.
2. Commit `package.json` and `package-lock.json`.
3. Push. Vercel rebuilds with the new dep. No manual action.

### "I need to add or rotate a secret"

Three locations, depending on what kind:

**Modal secrets** (backend env vars). Used by the render service.
```bash
# Create
modal secret create <name> KEY1=value1 KEY2=value2

# Update (delete + recreate)
modal secret delete <name>
modal secret create <name> KEY1=newvalue
```
After updating a Modal secret, **redeploy the app** so the function
picks up the new value: `modal deploy modal_app.py`. Modal secrets
are bound at deploy time, not request time.

**Vercel env vars** (frontend, both server-side and `NEXT_PUBLIC_*`).
Dashboard: Project → Settings → Environment Variables. Set the
scope (Production / Preview / Development — usually all three).
After saving, **trigger a redeploy** for the change to apply.
`NEXT_PUBLIC_*` vars are baked at build time, so they require a
fresh build — not a re-promote of an existing build.

**Paired secrets** (must match across the boundary):
- `RENDER_API_SECRET` (Modal, `conestruct-render-secret`) ↔
  `MODAL_RENDER_SECRET` (Vercel). The proxy sends the latter as a
  bearer token; the middleware compares it to the former. They must
  be byte-for-byte identical. Rotating means updating both, then
  redeploying both (Modal first, then Vercel — same logic as the
  frontend+backend deploy).

---

## Section 2 — First-time setup

### Tools

- **Python**: 3.12 (matches the Modal image). Local dev works on
  3.11+ but 3.12 is canonical.
- **[uv](https://docs.astral.sh/uv/)**: Python package manager.
  Install per their docs.
- **Node**: 20.x (matches Vercel default). Use whatever version
  manager you like (nvm, fnm, volta).
- **npm**: ships with Node. Used for the frontend.
- **[Modal CLI](https://modal.com/docs/guide/installation)**:
  ```bash
  uv tool install modal
  modal token new   # opens browser, authenticates against your Modal workspace
  ```
- **git** and a checkout of the repo.

### Python deps

```bash
uv sync --extra dev
```

The `--extra dev` is important — without it, you lose `pytest`,
`ruff`, and `pre-commit`. Plain `uv sync` only installs runtime deps.

### Pre-commit hooks

```bash
uv run pre-commit install
```

This wires git's `pre-commit` hook to run ruff (Python lint +
format), ESLint, and `tsc` (frontend) on every commit. **Honor
system** — there is no server-side CI enforcing these, so a
contributor who skips this step can land unvetted code on `main`.
See [CONTRIBUTING.md](CONTRIBUTING.md).

### Frontend deps

```bash
cd conestruct/site
npm install
```

### Modal authentication

```bash
modal token new
```

You need permission on the `conestruct-render` Modal app to deploy.
If you're not the workspace owner, ask for the right scope.

### Local dev

**Backend (Streamlit harness, NOT the render server):**
```bash
uv run streamlit run src/api/app.py
```
This is a developer-oriented UI that exercises the rules engine,
renderers, and exporters directly. It does *not* run the FastAPI
render service — there's no local FastAPI in normal workflow.

**Frontend:**
```bash
cd conestruct/site
npm run dev
```
Runs Next.js at http://localhost:3000.

### ⚠️ Local frontend dev hits production Modal

This is important. The local Next.js dev server reads
`MODAL_RENDER_URL` from `conestruct/site/.env.local` (copied from
`.env.example`). The default value in `.env.example` points at the
**live production Modal endpoint**. That means:

- Every plan you generate locally is rendered by the production
  backend.
- If you're testing a backend code change, your local frontend
  will *not* see it unless you first `modal deploy` — but doing so
  also pushes the change to production users.
- For backend changes you don't want users to see yet, work in the
  Streamlit harness instead of through the frontend.

There is currently no local FastAPI run target. If this becomes a
problem, the fix is to add a `make backend-local` target that runs
`uvicorn src.api.render_api:app` and points `MODAL_RENDER_URL` at
`http://localhost:8000`.

### Vercel

If you need preview deploys, push to a branch. Vercel's GitHub App
integration (separate from `vercel-deploy.yml`, which only triggers
on `main`) creates per-branch preview URLs automatically. Branch
previews share Vercel's Preview-scoped env vars.

---

## Section 3 — Detailed deployment flow

### Production deploy of a mixed change

Scenario: you've added a new backend endpoint and a frontend feature
that calls it. The change spans `src/` and `conestruct/site/`.

1. **Commit locally.** Pre-commit hooks run; fix anything they
   flag. Don't push yet.
2. **Run the backend tests.**
   ```bash
   uv run pytest
   ```
   All 228+ tests should pass.
3. **Deploy Modal first.**
   ```bash
   modal deploy modal_app.py
   ```
   Watch the output for the public URL — it should match what's in
   `conestruct/site/.env.example`'s `MODAL_RENDER_URL`. If Modal
   prints a different URL (unlikely, but possible if you renamed the
   app), update the Vercel env var.
4. **Verify Modal is serving the new endpoint.**
   ```bash
   curl -fsS https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz
   curl -H "authorization: Bearer $MODAL_RENDER_SECRET" \
     -H "content-type: application/json" \
     -d '{"scenario":...}' \
     https://rtmakatura--conestruct-render-fastapi-app.modal.run/render/<new-endpoint>
   ```
5. **Push to `main`.** Vercel build kicks off. Watch the build log
   on the Vercel dashboard.
6. **Verify the live site.** Generate a plan that exercises the new
   code path. Confirm the deliverable looks right.
7. **Close the reminder issue** (`modal-deploy-needed`) with a
   comment naming the deploy.

### Why deploy order matters: `add_local_dir` is immutable

In `modal_app.py`:

```python
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("libcairo2", "fontconfig")
    .pip_install(*RENDER_DEPS)
    .add_local_dir("src", remote_path="/root/src")
)
```

`add_local_dir` copies the contents of `src/` into the Modal image
**at deploy time**. The image is immutable once built — nothing
reads from local disk at request time. This means:

- "I committed but didn't redeploy" leaves the old `src/` baked
  into the running image. The new commit on `main` has no effect on
  live behavior.
- Pushing to git does not, by itself, do anything to Modal. The
  reminder issue from `modal-deploy-check.yml` is the only nudge.
- `modal deploy` is a synchronous operation. When it returns, the
  new container is serving traffic. There's no separate "promote"
  step.

### Rollback

**Frontend rollback (Vercel):**

Vercel dashboard → Project → Deployments → find a known-good prior
deployment → "..." menu → "Promote to Production". Takes ~10
seconds. Doesn't require a git revert. Use this when a Vercel
deploy ships a bug and you need the site working *now*; then revert
the offending commit in git so the next deploy doesn't re-ship the
bug.

**Backend rollback (Modal):**

Modal doesn't have a one-click rollback. You roll back by
re-deploying from a prior code state:

```bash
git checkout <last-known-good-sha> -- src/ modal_app.py
modal deploy modal_app.py
git checkout HEAD -- src/ modal_app.py    # restore working tree
```

Or, if you want the rollback to persist as a commit:

```bash
git revert <bad-sha>
modal deploy modal_app.py
git push
```

The revert push will trigger another `modal-deploy-needed` reminder
issue. Close both.

---

## Section 4 — Common issues and fixes

### Modal endpoint 404s

**Symptom:** Frontend logs `render upstream 404` or a new endpoint
returns "Not Found".

**Cause:** You changed `src/api/render_api.py` (added a route, renamed
one) but didn't run `modal deploy`.

**Fix:** `modal deploy modal_app.py`. Verify with the `/healthz` +
curl sequence above. Check the open `modal-deploy-needed` issue and
close it.

We hit this twice in the past week. The reminder workflow exists
specifically because of this class of bug.

### Mapbox aerial missing from the production PDF

**Symptom:** Generated PDF only has page 1 (schematic); the page 2
aerial photo is gone.

**Cause:** `mapbox-token` Modal secret is unbound or the token
expired. The renderer silently falls back to schematic-only when
the Mapbox API call fails or the token is missing — by design, so a
token issue never breaks the whole render. See
`src/rendering/plan_sheet.py` (`_fetch_mapbox_aerial`).

**Fix:**
```bash
modal secret list | grep mapbox-token   # confirm it exists
# Rotate if needed:
modal secret delete mapbox-token
modal secret create mapbox-token MAPBOX_TOKEN=<new-token>
modal deploy modal_app.py               # rebind to the new secret
```

Test by generating a plan and confirming the PDF is 2 pages.

### Frontend env var change not taking effect

**Symptom:** You updated a Vercel env var (e.g., `NEXT_PUBLIC_SENTRY_DSN`),
saved, redeployed — but the running site still uses the old value.

**Cause:** `NEXT_PUBLIC_*` env vars are inlined into the JavaScript
bundle at **build** time, not read at runtime. If you re-promoted
an existing build instead of triggering a fresh build, the bundle
still has the old value baked in.

**Fix:** Trigger a fresh build. Vercel dashboard → Deployments →
"Redeploy" → **uncheck "Use existing Build Cache"** → confirm. Or
push an empty commit (`git commit --allow-empty -m "rebuild"`) to
force a new build.

Server-only env vars (no `NEXT_PUBLIC_` prefix) are read at runtime,
so they don't have this problem — but `NEXT_PUBLIC_*` ones always
do.

We hit this during Sentry setup.

### Sentry events not landing

**Symptom:** You triggered an error (real or via the debug
endpoint), but nothing shows up in the Sentry dashboard.

**Possible causes, in order of likelihood:**

1. **Ad blocker eating the request.** uBlock Origin and similar
   block `*.sentry.io`. Confirm by opening the page in an
   incognito window with extensions disabled, then triggering the
   error again. **This was the root cause of a frontend-events-not-landing
   incident this week.**
2. **DSN not in the built bundle.** Open the Network tab, find
   the main app JS chunk, search the response body for "sentry.io".
   If the DSN isn't there, it wasn't set at build time — see
   "Frontend env var change not taking effect" above.
3. **DSN in the wrong Vercel scope.** Check the env var is set
   for the environment you're testing (Production / Preview /
   Development). A var set only for Production will not appear in
   a Preview build.
4. **Backend: `SENTRY_DSN` not bound.** `modal secret list | grep
   sentry-dsn`. If missing, create it and redeploy.

See [MONITORING.md](MONITORING.md) for the full Sentry setup and
verification procedure.

### Backend returns 401 Unauthorized

**Symptom:** Every render request fails. Vercel function logs show
`render upstream 401`.

**Cause:** `RENDER_API_SECRET` (in the `conestruct-render-secret`
Modal secret) and `MODAL_RENDER_SECRET` (Vercel env var) don't
match. The proxy sends one bearer token; the backend middleware
compares it against a different one.

**Fix:** Decide which value should be canonical. Update the other
side. Then:
- If you changed the Modal secret: `modal deploy modal_app.py`.
- If you changed the Vercel env var: trigger a redeploy (no need to
  clear cache since it's a server-side var, not `NEXT_PUBLIC_`).

If both sides agree and you still get 401, check that the proxy is
actually sending an `Authorization: Bearer ...` header — bugs in
`conestruct/site/lib/render-proxy.ts` could drop it.

### Cleaning up untracked files: never `rm -rf` a directory

If you've created a one-off script or temp file inside an existing
directory, delete it by exact path: `rm path/to/that_one_file.py`.
**Do not** `rm -rf path/to/directory/` to clean up an untracked
file — it will wipe every tracked file in that directory too. Git
will let you restore them with `git checkout HEAD -- path/`, but
only if you catch it before doing anything destructive on top.
Real near-miss while writing this doc: a one-off Modal verification
script inside `scripts/` was cleaned up with `rm -rf scripts/`,
which silently deleted eight pre-existing tracked scripts. The
checkout restore worked, but the lesson is cheap: delete by file,
not by directory.

### Backend returns 503 Service Unavailable

**Cause:** `RENDER_API_SECRET` env var is unset on the Modal side
entirely. The `require_bearer_secret` middleware fails closed (it
will never run unauthenticated) and returns 503.

**Fix:**
```bash
modal secret list | grep conestruct-render-secret
# If missing:
modal secret create conestruct-render-secret RENDER_API_SECRET=<value>
modal deploy modal_app.py
```

---

## Section 5 — Environment variables and secrets reference

### Modal secrets (backend)

Bound to the function via `modal.Secret.from_name(...)` in
`modal_app.py`. Created/updated via `modal secret create` /
`modal secret delete`.

| Secret name (Modal) | Provides env var | Purpose |
|---|---|---|
| `conestruct-render-secret` | `RENDER_API_SECRET` | Bearer-token check on every render request. Must match Vercel's `MODAL_RENDER_SECRET`. |
| `mapbox-token` | `MAPBOX_TOKEN` | Mapbox Static Images token for the page-2 aerial on rendered PDFs. Missing → silent fallback to 1-page schematic. |
| `sentry-dsn` | `SENTRY_DSN` | Backend Sentry project DSN. Missing → Sentry stays inert; service runs normally. |

To verify what's bound: `modal secret list`. To inspect (without
revealing values): the secret name being present is what matters;
Modal won't print the values back to you.

### Vercel environment variables (frontend)

Set in the Vercel dashboard: Project → Settings → Environment
Variables. Each var can be scoped to Production, Preview,
Development, or all three.

| Variable | Scope | Public? | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | All | Browser | Clerk frontend SDK. |
| `CLERK_SECRET_KEY` | All | Server | Clerk backend API calls. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | All | Browser | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | All | Browser | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | All | Browser | Post-signin landing (`/app`). |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | All | Browser | Post-signup landing (`/app`). |
| `CLERK_WEBHOOK_SECRET` | All | Server | Svix signing secret for `/api/clerk/webhook`. |
| `DATABASE_URL` | All | Server | Neon Postgres connection string (pooled). |
| `MODAL_RENDER_URL` | All | Server | Public URL of the Modal render service. |
| `MODAL_RENDER_SECRET` | All | Server | Bearer token. **Must match the `RENDER_API_SECRET` inside the `conestruct-render-secret` Modal secret.** |
| `NEXT_PUBLIC_AUTH_UI` | All | Browser | Demo-mode toggle. Unset (or anything ≠ `"true"`) = demo mode: homepage is the generator, no Sign In / Save / org switcher visible, downloads via public `/api/render/[kind]`. Set to `"true"` to expose the auth-gated workbench flow. Currently unset in Production. |
| `MAPBOX_TOKEN` | All | Server | Mapbox token used by `/api/geocode`, `/api/road-classify`, `/api/distance`. Server-only — never expose as `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SENTRY_DSN` | All | Browser | Frontend Sentry project DSN. Baked into the JS bundle at build time. |
| `SENTRY_AUTH_TOKEN` | Production + Preview | Build-time only | Used by the Sentry Next.js plugin to upload source maps. Not needed in Development. |
| `NEXT_PUBLIC_SENTRY_TEST` | Off in Production | Browser | Debug flag — gates `/debug/sentry-test` page. **Default off. Set to `"1"` only for one-off Sentry verification, then unset.** |
| `SENTRY_TEST_ENABLED` | Off in Production | Server | Companion to the above — gates the test API route and the backend `/debug/sentry-test/*` endpoints. Same rule: temporary verification only. |

### Paired-secret invariants

| Vercel | Modal | Must match? |
|---|---|---|
| `MODAL_RENDER_SECRET` | `conestruct-render-secret` → `RENDER_API_SECRET` | **Yes** — byte-for-byte. Mismatch → 401 on every render. |
| `MAPBOX_TOKEN` | `mapbox-token` → `MAPBOX_TOKEN` | No. Different surfaces (Vercel proxies geocoding; Modal fetches satellite tiles). Both should be valid Mapbox tokens but can be different tokens with different rate limits if you want. |

### Debug-flag invariants

`NEXT_PUBLIC_SENTRY_TEST` and `SENTRY_TEST_ENABLED` are designed to
default off and stay off in Production. The verification procedure
in [MONITORING.md](MONITORING.md) covers the rare one-off case
where you set them to `"1"` to confirm Sentry plumbing, then
immediately unset them and redeploy.

---

## Related docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — what the system looks like
  and why.
- [MONITORING.md](MONITORING.md) — Sentry setup and verification.
- [CONTRIBUTING.md](CONTRIBUTING.md) — pre-commit hook behavior
  and first-time contributor setup.
