# Arc 1 — the coming-soon gate · 📋 checkpoint (investigate only)

*Written 2026-09-26 against `main` @ `0ddc85e`, before Ryan rules on the questions below. No product code. Rulings are cited by number from `rulings.md` beside this file (committed verbatim at `6a6a138`, with FLOW.md's R3 line and the R4 inventory).*

## 0. Corrections and open points
- **Q7 is unruled.** Ryan's message of 2026-09-26 says D4's helper list is "superseded by the checkpoint ruling on Q7 — see the checkpoint rulings below"; no checkpoint rulings followed, and this checkpoint is the one that asks Q7. Until Q7 is ruled, D4's list stands as written.
- **R5's artifacts are not in the arc dir.** R5 says `TitleBlock.dc.html` and `TitleBlockPhone.dc.html` are "copied into this arc dir"; they are not in `validation-artifacts/committed/coming-soon-gate/` at `6a6a138`. Arc 2 needs them; Arc 1 does not (D1: plain placeholder).
- `/api/*` has **23** route files: 22 gated + the Clerk webhook (`app/api/clerk/webhook/route.ts`). The prompt's "all 22 … except the webhook" is right; my inventory's "22 handlers" counted wrong.
- **The D4 helpers are committed evidence inside closed arcs** (`issue-289-band-stack/fidelity-audit/probe.cjs`, `issue-301-band-aerial/sweep.cjs`, `s2-audit-1/audit-lib.js` and its byte-identical copy `s2-triage-2/audit-lib.js`). handoff.md: "Never amend a historical archive." Editing them in place conflicts with that — **question Q7**.
- `audit-lib.js` exports only `mkLog`/`shaGate` (`:10`, `:20`); it launches no browser, so it has no context to put a header on. Its callers do.
- `geometry_latency.py` uses **httpx**, not requests (`issue-301-band-aerial/probes/geometry_latency.py:18,29`).

## 1. Current state (file:line)
- **Middleware:** `conestruct/site/middleware.ts:1-23`. `clerkMiddleware(async (auth, req) => …)`; `isProtectedRoute = createRouteMatcher(["/app(.*)", "/onboarding(.*)"])` (:3); signed-out → `redirectToSignIn` (:9-11); signed-in without org → `/onboarding` (:13-15). Matcher (:18-23): everything except `_next` and static file extensions, plus `/(api|trpc)(.*)`.
- **Redirects run before middleware:** `next.config.mjs:8` `/try → /sandbox`, `:13` `/landing → /sandbox`, both `permanent: true` (308).
- **Webhook path:** `/api/clerk/webhook` — svix-verified with `CLERK_WEBHOOK_SECRET` (`route.ts:7-30`); called by Clerk's servers, never with a session.
- **Session/email readers:** `auth()` at `app/api/me/route.ts:7`, `app/api/plans/route.ts:7`, `app/api/plans/[id]/route.ts:16,73`, `app/app/page.tsx:27`, `app/app/plans/[id]/page.tsx:18`, `lib/render-proxy.ts:503`, `middleware.ts:7`. **Nothing reads an email anywhere today.** Client: `SignedIn/SignedOut/UserButton` in `components/AppNav.tsx:46-112`, `components/Nav.tsx:31-46`; `SignInButton` `components/PlanSaveButton.tsx:241`; `OrganizationSwitcher`/`UserButton` `app/app/page.tsx:4,71`.
- **`NEXT_PUBLIC_AUTH_UI`:** read once, `lib/feature-flags.ts:11-12`; consumed only in `AppNav.tsx` (:45, :60, :91-106) — nav UI only, gates no route. **No conflict with the gate** (the gate is orthogonal: it decides who reaches the page; the flag decides what the nav shows). With the flag off, an allowlisted user at `/sandbox` has no sign-out control — see Q6.
- **Clerk versions:** `@clerk/nextjs` 6.39.3, `@clerk/backend` 2.33.3 (installed). `clerkClient` is `() => Promise<ClerkClient>` (`dist/types/server/clerkClient.d.ts:5`). Prod publishable key is `pk_live_` (served HTML of `/sign-in`); local `.env.local:1` is `pk_test_` (a separate dev instance — **the allowlist and dashboard settings must be set in both instances**).
- **Sign-in landing:** `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app` (`.env.local:6`, `.env.example:9`; prod value lives in Vercel, not visible). `/app` is the saved-plans list and forces `/onboarding` for a user with no org (`middleware.ts:13-15`) — not the generator.
- **Sign-in / sign-up pages:** `app/sign-in/[[...sign-in]]/page.tsx` renders bare `<SignIn />`; `app/sign-up/[[...sign-up]]/page.tsx` bare `<SignUp />`. Both inside a `.workbench` main.
- **Server-to-server callers of `/api/*`:** none. Every `/api` fetch is same-origin browser code (`lib/corridor-aerial.ts:113`, `lib/corridor-geometry.ts:230`, GeneratorShell, LocationPickerModal, QuotePanel, OutputCards, PlanSaveButton, PlanRow, DebugSnapshotButton, `app/debug/sentry-test/client.tsx:24`) — cookies travel, so an allowlisted session covers them. `app/api/replication-snapshot/route.ts:49` is outbound to Modal, not inbound. No cron (`vercel.json` has none). **The only inbound server caller is Clerk → webhook.**
- **Workflows:** `scripts/ship.ps1:16` (`$HealthUrl` = Modal `/healthz`), poll `:78-90` — Modal only, **unaffected**. `.github/workflows/modal-deploy-check.yml:55-78` → `scripts/modal-healthz-probe.mjs` against `vars.MODAL_RENDER_URL` `/healthz` — Modal only, **unaffected**. `.github/workflows/vercel-deploy.yml:12` POSTs the Vercel deploy hook (Vercel's API, not the site) — **unaffected**.

## 2. Route table (the spec for the middleware test)
Public (R1.2): `/`, `/terms`, `/privacy`, `/sign-in(.*)`, `POST /api/clerk/webhook`, `_next/*` + static extensions (already excluded by the matcher).

Gated — pages: `/sandbox`, `/app`, `/app/plans/new`, `/app/plans/[id]`, `/onboarding`, `/sign-up(.*)`, `/debug/sentry-test`, plus any unknown path (default-deny). `/landing`, `/try` never reach middleware (next.config redirects) — see Q5.

Gated — API (22): `/api/corridor-map`, `/api/debug/sentry-test`, `/api/distance`, `/api/geocode`, `/api/jurisdiction/suggest`, `/api/me`, `/api/plans`, `/api/plans/[id]`, `/api/plans/[id]/{audit-pdf,crew-pdf,markdown,pdf,quote,xlsx}`, `/api/render/[kind]`, `/api/render/{audit,bundle,corridor-geometry,device-breakdown,quote-breakdown}`, `/api/replication-snapshot`, `/api/road-bearing`.

Test matrix (each gated row × 5 identities; public rows × 5 all pass through):

| identity | gated page | gated `/api/*` |
|---|---|---|
| anonymous | 307 → `/` (Q1) | 401 JSON `{"error":"unauthorized"}`, no redirect |
| bypass header, correct value | pass through (today's behaviour) | pass through |
| bypass header, wrong value | as anonymous | as anonymous (401) |
| signed in, allowlisted, verified | pass through; existing `/app` org logic still applies | pass through |
| signed in, not allowlisted (or unverified primary email) | as anonymous (Q3) | 401 |

Plus: the bypass header is **stripped/never echoed**, and a wrong value is never logged. Plus a matcher test: the `config.matcher` regexes compiled and run against every path above (Next 14.2 has no `unstable_doesMiddlewareMatch`; that helper is Next 15.1+). Red-proved against today's `middleware.ts` first (expected red: every anonymous gated row except `/app`/`/onboarding`, which today redirect to `/sign-in`, also red).

**Test shape (Rule 11):** drive the real `middleware.ts` default export with `NextRequest`s, mocking `@clerk/nextjs/server` so `clerkMiddleware(handler)` returns `req => handler(fakeAuth, req)` — precedent `lib/render-proxy.bundle.test.ts:12`. `vitest.config.ts` is `environment: "node"`, which has `crypto.subtle` (Node 20.16 local).

## 3. Mechanism notes
- **Email check (R1.3).** The default Clerk session token carries no email. Two ways to read it in middleware:
  - (i) **Custom session-token claim** (Clerk dashboard → Sessions → Customize session token), e.g. `{"email": "{{user.primary_email_address}}", "email_verified": "{{user.email_verified}}"}` — zero latency; read from `sessionClaims`. Shortcode names **unverified** against Clerk docs (not in the installed type package); Ryan confirms in the dashboard.
  - (ii) **Backend API** `(await clerkClient()).users.getUser(userId)` → `primaryEmailAddress.emailAddress` + `.verification.status === "verified"` — works with no dashboard change; one Clerk API call per gated request (the generator fires several `/api` calls per plan; 3 users).
  - **Recommend: (i) when the claim is present, else (ii); fail closed on any error.** This satisfies "the check must hold even if the dashboard setting is never changed" — (ii) needs no dashboard, and nothing un-allowlisted ever passes.
  - Allowlist env: `GATE_ALLOWED_EMAILS` (comma-separated, trimmed, lowercased; compare lowercased). Unset/empty → **nobody** passes by session (fail closed), bypass header still works.
- **Bypass header (R1.4):** name `x-conestruct-gate`; value `GATE_BYPASS_TOKEN`. Edge runtime has no `crypto.timingSafeEqual`: compare `SHA-256(given)` vs `SHA-256(expected)` via `crypto.subtle`, then XOR-accumulate the 32 bytes (length-independent). Unset token → header never accepted.
- **Dashboard settings for Ryan to click (R1.3)** — in **both** Clerk instances (prod `pk_live_`, dev `pk_test_`):
  1. *Configure → Restrictions → Sign-up mode: Restricted* (sign-ups only via invitation). Plan availability: **cannot tell from the repo**.
  2. *Configure → Restrictions → Allowlist*: add the three emails. Plan availability: **cannot tell from the repo** (historically a paid feature — Ryan confirms in the dashboard).
  3. *Sessions → Customize session token*: the claim in (i) (optional; the gate works without it).
  4. *Users*: review existing prod users — sign-up has been open publicly (`/sign-up` 200), so accounts may already exist; the middleware denies them regardless.
- **Sign-up link on `<SignIn/>` (decision 5):** whether Clerk hides "Don't have an account? Sign up" under Restricted mode is **unverified** here. Repo-controlled either way: `/sign-up` is gated (Q4), so the link bounces even if rendered; the placeholder has no sign-in link anyway (D2).
- **`X-Robots-Tag: noindex`:** set on every gated response (redirects and 401s); `/`, `/terms`, `/privacy` stay indexable. Metadata `robots` on `/sign-in` → noindex.

## 4. Decisions to table (recommendation first)
- **Q1 — anonymous on a gated page:** **307 → `/`** (agree with your lean: reveals nothing, and `/` is the prospect's page, R3). Not `/sign-in`: redirecting there would advertise the door R1.5 keeps unlinked. Allowlisted people go to `/sign-in` directly (R1.5).
- **Q2 — anonymous on gated `/api/*`:** **401 JSON, no redirect** (as proposed). Status code only differs from a non-existent route by body; acceptable.
- **Q3 — signed in, not allowlisted:** **treat exactly as anonymous** (page → `/`, API → 401); **do not end the session** from middleware (revoking needs a Backend API call and buys nothing — no surface accepts the session). Their Clerk session simply opens nothing. Alternative: revoke via `clerkClient().sessions.revokeSession(sessionId)` — more code, one more failure mode.
- **Q4 — `/sign-up`:** R1.2 leaves it off the public list and R1.3 closes public sign-up, so it is gated either way; the question is only the response. **Behind the gate** (anonymous → `/`), not a 404 — keeps the route for the day sign-up reopens, and matches the default-deny rule. Allowlisted users never need it.
- **Q5 — `/landing`, `/try`:** change both `next.config.mjs` entries' destination to **`/`** (they run before middleware, so they apply to everyone, allowlisted included). Allowlisted users use `/sandbox` directly. Keep `permanent: true`? **Recommend `permanent: false` (307)** — browsers cache 308s hard, and `/landing`'s destination has already moved once; revisit when the parked /landing rewrite lands.
- **Q6 — where sign-in lands:** today `/app` (plans list → forced org onboarding) — workbench mode, which R1.6 keeps dormant; the builder is `/sandbox` (R1.1). **Recommend `<SignIn fallbackRedirectUrl="/sandbox" />` in `app/sign-in/[[...sign-in]]/page.tsx`** — repo-controlled, no Vercel env dependency. And the generator's wordmark links to `/` (`AppNav.tsx:37-38`) — the placeholder — for allowlisted users. Recommend leaving it (D2 says the generator no longer renders at `/`; a wordmark going home is conventional); flag only. With `NEXT_PUBLIC_AUTH_UI` off there is no sign-out control on `/sandbox` — acceptable for three people; say so.
- **Q7 — the D4 helpers vs "never amend a historical archive":** **Recommend a new shared helper outside any arc dir** — `scripts/gate.cjs` exporting `gateHeaders(site)` (returns `{ "x-conestruct-gate": token }` for `conestruct.com` hosts, throws if the token env is missing; `{}` for localhost) and `scripts/gate.py` with the same contract — then copy the reusable harnesses forward into this arc's dir (or `scripts/`) importing it. The archived originals stay byte-identical and are documented as pre-gate. Alternative: edit in place with a ruling that overrides the archive rule for these files. Per D4's list: `scripts/verify-single-nav.mjs` is **not** archive (it lives in `scripts/`) — edit in place, header on `browser.newPage({...})` at `:9` via `extraHTTPHeaders`; `fidelity-audit/probe.cjs` → `browser.newContext({ viewport })` at `:210`; `issue-301-band-aerial/sweep.cjs` → `browser.newPage({ viewport })` at `:160`; `s2-audit-1/audit-lib.js` → gains an exported `gateHeaders()` (its `shaGate` at `:20` hits Modal `/healthz`, which needs no header) — callers pass it to their contexts; "the Python probe pattern" → `httpx.post(URL, …)` at `issue-301-band-aerial/probes/geometry_latency.py:29` gains `headers=gate_headers(URL)`. Under the recommendation, the three archived ones are copied forward to `scripts/` and edited there.
- **Q8 — `/terms` and `/privacy`:** they render the old light `Nav` (`components/Nav.tsx`), which shows **"Sign in" (`:31-38`), "Try the demo → /sandbox" (`:42-48`), "How it works → /#math", "Sample plan → #"**. After the gate these public pages (R1.2) advertise a sign-in link and a route that bounces — against R1.5 ("Nothing on the public page links to it"), if "the public page" is read to include `/terms` and `/privacy`, which `/`'s footer links to (R2). **Recommend** swapping them to the placeholder's chrome (wordmark + AppFooter) in this arc — small, and otherwise the public reaches a sign-in link one click from `/`. Alternative: file it.

## 5. Placeholder (D2) — spec against tokens
- Wordmark: reuse the `AppNav.tsx:37-44` markup (Inter 600 · 14.5px · −0.01em · `--ink` · period `--dim`), as text, not a link to itself.
- "Coming soon": type role 5 `tr-question` (Inter 600, `--fs-step-question` 22px / 19px below 520). The one line: `--fs-body-value` 13.5px in `--ink-on-dark`. No new sizes (P5).
- Ground `.workbench` → `--canvas`; `AppFooter` unchanged (it already meets P10: `min-h/min-w 44px` at ≤480, `AppFooter.tsx:42,48`). No form, no sign-in link, no radius, no ✓ glyph, neither reserved overlay hex.
- Copy is exactly D2's line; every claim in it traces: "Colorado", "MUTCD 2023 or CDOT" match the generator's own citation badge (`AppNav.tsx` "MUTCD 2023 · CDOT") and the generate footer "every dimension cited to MUTCD or CDOT"; "a draft for a licensed professional to review" matches the generator's "Draft — not a sealed plan … requires review and seal by a licensed PE".

## 6. Metadata (D3) — the strings that change
- `app/layout.tsx:18-30`: `description` ("…then ships a stamped-ready PDF…") and `openGraph.description` ("…in under two minutes. Built in Colorado.") → D2's line; `title` "Conestruct — MUTCD plans in seconds" also carries an untraced speed claim ("in seconds") — **recommend** "Conestruct — coming soon" (flagging: not named in D3). Twitter card inherits from openGraph today (rendered `twitter:*` tags observed in the 2026-09-26 capture) — verify after the change.
- `app/sandbox/page.tsx:7`: "…Sign up to save plans and download real PDF, XLSX, and crew narrative outputs." → drop the sign-up sentence (the page is now allowlist-only; add `robots: { index: false }`).

## 7. Principles (P1–P22)
| P | applies to the placeholder? | how |
|---|---|---|
| P1 | yes | static page, no layout shift: fonts `display: swap` already; no late content |
| P2 | yes | the one line is the only statement of what Conestruct is; metadata repeats it verbatim (one voice) |
| P3 | partly | the prospect's next thing is "nothing yet" — said by "Coming soon"; no fake CTA |
| P4, P6 | yes | column width/padding reuse GeneratorShell's `max-w-[960px] px-10 / max-md:px-[14px]`; measured at 1440/380 |
| P5 | yes | only role 5 + ruled 13.5px + footer's existing mono 10px; no new sizes |
| P7, P8, P13–P16, P18–P22 | no | no actions, waits, disclosures, generation or revision on this page (stated, not skipped) |
| P9 | yes | no status symbols used (no ✓/◌) — nothing to pair |
| P10 | yes | footer Terms/Privacy ≥ 44×44 at 380 — measure by bounding box in the prod leg (both dimensions, per `AppFooter.tsx:24-29`) |
| P11 | yes | wordmark/footer reused, not re-drawn |
| P12 | yes | axe clean at 1440 and 380; contrast measured (`--ink` on `--canvas`, `--ink-on-dark` on `--canvas`) |
| **P17** | **yes (R3)** | the placeholder serves **the prospect** — FLOW.md §1's line landed at `6a6a138`. Arc 1's job for the prospect is only "what this is"; "a way to hear when it opens" is Arc 2's form (R2, D1), so the Arc 1 page honours R3 partially by design. The gated generator still serves the rep/estimator, now only the three allowlisted people (R1.3) |

## 8. Churn (Rule 5, predicted)
- `conestruct/site/lib/redirects.test.ts:25-31` (`/landing` → `/sandbox`, permanent) and `:34-36` (`/try` → `/sandbox`, permanent) — **both flip** (destination → `/`; `permanent` → `false` if Q5 is taken). These are the only tests pinning redirects (grep of `*.test.ts*` for redirect/next.config). No test asserts `app/page.tsx` content.
- No backend change, **no wire change** (no payload sender touched), no PDF/containment/expectation-JSON effect, no `.sys-event` string change (#198 byte-identity holds).
- Prod evidence: every existing harness targeting `www.conestruct.com/sandbox` or `/api/*` goes 307/401 without the header — by design.
- axe: new page → new baseline at 1440/380.

## 9. Commit sequence (each shippable; what the operator sees after it ships)
1. `rulings.md` + FLOW.md R3 line + `landing-inventory-2026-09-26/` (R4) — **done, `6a6a138`** — *nothing changes on the site.*
2. This `checkpoint.md` — *nothing.*
3. Red middleware table test + matcher test — *nothing (tests only).*
4. `lib/gate.ts` (pure decision + constant-time compare + email check) and `middleware.ts` rewrite; `SignIn fallbackRedirectUrl`; next.config destinations — *anonymous visitors to `/sandbox`/`/api/*` bounce/401; Ryan signs in at `/sign-in` and lands on the generator.* **Requires `GATE_ALLOWED_EMAILS` and `GATE_BYPASS_TOKEN` in Vercel prod before ship, or everyone (incl. Ryan) is locked out of the generator — fail-closed.**
5. Placeholder at `/` + metadata (D2, D3) (+ Terms/Privacy chrome if Q8 = yes) — *the public sees "Coming soon".* (Could fold into 4 so the gate never ships with the generator still at `/`: **recommend folding 4 and 5 into one ship** — shipping 4 alone leaves the anonymous public on a fully working generator at `/` whose `/api` calls all 401.)
6. `scripts/gate.cjs` / `gate.py` + forward copies of the D4 harnesses (Q7) — *nothing on the site; scripts hit prod with the header.*
7. Evidence: anonymous + bypass sweeps (output outside the repo during the run), then committed.
- D5 issue drafts: four `gh issue create` body files under Temp (rate limiter fail-open; no origin/CSRF checks; `render_api.py:558` plain `!=`; `NEXT_PUBLIC_MAPBOX_TOKEN` URL restriction). `/api/replication-snapshot` needs no issue — D5 records it as gated by R1.2. Modal is untouched (D5).

## 10. Verification plan
Red-then-green table test; `npm test` full suite; `tsc`; diff-verifier before the implementation report; ship only on Ryan's go; `/healthz` sha == HEAD **and** served bundle polled before the frontend leg; anonymous sweep (only R1.2 set answers 200; everything else 307→`/` or 401) and bypass sweep (`/sandbox`, `/api/*` answer as today); P10 bounding boxes at 380; Ryan's hand-check.
