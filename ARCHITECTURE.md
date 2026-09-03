# Conestruct Architecture

This document describes the system as it actually exists today, not as
it was originally designed or as we'd like it to look. If you find
something here that doesn't match the code, the code is right and this
doc is out of date — please update it.

## Executive summary

Conestruct turns a few form fields about a road work zone into a CDOT
Section 630-compliant traffic control package: a tabloid PDF plan
sheet, an XLSX device list, a Markdown crew narrative, and a quote
spreadsheet. The user picks a point on a Mapbox map, picks the type of
closure, tweaks a handful of parameters, and the system produces all
four deliverables in one zip.

The architecture is a thin Next.js 14 frontend (Vercel) that proxies
to a Python FastAPI backend running on Modal. The frontend handles
auth (Clerk), persistence (Neon Postgres via Drizzle), and form state;
the backend owns the MUTCD math, the layout validator, and all
rendering (ReportLab for PDF, openpyxl for XLSX, Jinja2 for Markdown).
There is no shared client — the proxy layer marshals JSON in both
directions with a shared bearer token. V1 ships with only the
"shoulder" scenario kind enabled; the other five generators (flagger,
lane closure, mobile ops, work beyond shoulder) are present in the
codebase but gated off until they're verified against CDOT typical
sheets.

## Architecture diagram

```
                    ┌──────────────────────────────────────────────┐
                    │              Browser (Next.js app)           │
                    │                                              │
                    │   GeneratorShell                             │
                    │     ├─ GeneratorSidebar (scenario form)      │
                    │     ├─ LocationPickerModal (Mapbox GL)       │
                    │     ├─ OutputCards (download buttons)        │
                    │     ├─ DeviceBreakdown (Plan Details panel)  │
                    │     ├─ QuotePanel (cost estimator)           │
                    │     └─ AuditTrail (MUTCD citations)          │
                    └────────────────────┬─────────────────────────┘
                                         │ HTTPS, Clerk session
                                         ▼
        ┌────────────────────────────────────────────────────────────┐
        │            Next.js server (Vercel — conestruct.com)        │
        │                                                            │
        │   middleware.ts ──── Clerk auth gate (/app, /onboarding)   │
        │                                                            │
        │   /api/render/*       /api/plans/*       /api/road-*       │
        │   /api/render/bundle  /api/clerk/webhook /api/geocode      │
        │   (proxy to Modal)    (Neon Postgres)    (Mapbox/Overpass) │
        └─────────────┬──────────────────────┬───────────────────────┘
                      │                      │
        Bearer token  │                      │
        (RENDER_API_  │                      ▼
         SECRET)      │           ┌──────────────────────┐
                      │           │   Neon Postgres      │
                      │           │   users, companies,  │
                      │           │   plans (Drizzle)    │
                      │           └──────────────────────┘
                      ▼
        ┌────────────────────────────────────────────────────────────┐
        │      Modal — app "conestruct-render" (FastAPI ASGI)        │
        │                                                            │
        │   render_api.py ──── bearer-token middleware               │
        │     ├─ /render/pdf            ─→ rendering/plan_sheet.py   │
        │     ├─ /render/xlsx           ─→ export/device_list.py     │
        │     ├─ /render/markdown       ─→ narrative/crew_narrative  │
        │     ├─ /render/quote          ─→ export/quote_generator.py │
        │     ├─ /render/device-breakdown ─→ aggregated device count │
        │     └─ /render/quote-breakdown  ─→ itemized cost lines     │
        │        (every render route runs the in-generate site scan   │
        │         when the scenario carries site_scan — api/site_scan │
        │         → rules/site_detection)                             │
        │                                                            │
        │   rules/ ── spacing.py · devices.py · validators.py ·      │
        │             corridor.py · site_adjustments · tables.py     │
        └──────┬──────────────────────────────────────┬──────────────┘
               │                                      │
               ▼                                      ▼
      ┌───────────────────┐                ┌───────────────────────┐
      │ Mapbox Static API │                │   Overpass API (OSM)  │
      │ (aerial tile on   │                │ (site detection +     │
      │  PDF page 2)      │                │  road classify)       │
      └───────────────────┘                └───────────────────────┘
```

Sentry sits beside both layers as out-of-band error capture (separate
projects for `javascript-nextjs` and `python`). Clerk sits beside the
frontend for auth and orgs, syncing into Neon via webhook.

## Components

### Frontend (`conestruct/site/`)

**Pages.** Next.js 14 App Router. Public surfaces: `/`, `/sandbox`
(the public try-it generator), `/sign-in`, `/sign-up`, `/privacy`,
`/terms`. Auth-gated: `/app` (plan list), `/app/plans/new`,
`/app/plans/[id]` (workbench), `/onboarding` (forced when a user has
no `orgId`). The middleware uses Clerk route matchers to gate `/app`
and `/onboarding`; everything else is public.

**GeneratorShell** (`components/GeneratorShell.tsx`) is the
orchestrator. It owns `scenario` state, renders the sidebar form, the
output cards, the device-breakdown panel, the quote panel, and the
audit trail. State is plain `useState` — no Context, no Zustand, no
Redux. Two things happen when `scenario` changes:

1. `results = useMemo(() => compute(scenario), [scenario])` — a pure
   client-side estimator (`lib/scenarios/`) computes taper length,
   buffer space, advance-warning distances, etc. This drives the math
   panel and the audit trail display.
2. A `useEffect` fires `POST /api/render/device-breakdown` to fetch
   the authoritative device counts from the backend, which displays
   in the Plan Details panel.

These two paths produce overlapping data via different code, which is
a known weak spot (see Tech debt).

**LocationPickerModal** (`components/LocationPickerModal.tsx`,
~2000 LOC) wraps Mapbox GL. It geocodes addresses, fetches road
classification (`/api/road-classify` → speed/lanes/divided/road type)
via Mapbox + Overpass, lets the user override any classification
field, sets a bearing for direction of travel, and previews the
corridor (advance warning → taper → buffer → work zone → downstream
taper) as a colored polyline on the map.

**Proxy layer** (`lib/render-proxy.ts`) is the only place that holds
`MODAL_RENDER_SECRET`. It wraps every Modal call: injects the bearer
header, validates UUIDs for plan downloads, scopes plan-by-id reads
to `companyId == orgId`, streams the upstream body for binary
responses, and surfaces backend 400s with the original detail so the
UI can show *why* a scenario was rejected.

**API routes** (`app/api/`):
- `render/[kind]` — pass-through to `/render/{pdf|xlsx|markdown|quote}`.
- `render/bundle` — fan-out to all four kinds in parallel, zip with
  JSZip server-side, return as one download.
- `render/device-breakdown` — Plan Details panel data.
- `render/quote-breakdown` — Quote panel itemized lines.
- `plans` / `plans/[id]` — CRUD against Neon, auth-gated.
- `plans/[id]/{pdf,xlsx,markdown,quote}` — download routes for saved
  plans (loads from DB, calls proxy).
- `road-classify`, `road-bearing`, `geocode`, `distance`,
  `corridor-map` — Mapbox/Overpass helpers, server-side so the
  Mapbox token never reaches the browser.
- `clerk/webhook` — Svix-verified upserts into `users` and
  `companies`.
- `me` — current user's terms-acceptance status.

Every route does in-memory per-IP rate limiting via a local `Map`.
That catches a hot client on one Vercel instance but does nothing for
distributed floods — it's instance-local state, not Redis-backed.

### Backend (`src/`)

**`api/render_api.py`** is the FastAPI app. ~640 lines. Bearer-token
middleware on every route except `/healthz`. Sentry is initialized at
module load if `SENTRY_DSN` is set, with a `before_send` filter that
drops any `HTTPException` with status < 500 so user errors (bad
geometry, missing fields) don't page anyone. There's a
`_placements_for()` helper that unifies the path: scenario → generator
→ site adjustments → night adjustments → validator → list of
`DevicePlacement`. Every render endpoint calls this. The
`device-breakdown` endpoint and the rendering endpoints all walk the
same placement list, which is the property the system relies on for
the PDF/XLSX/panel to agree on device counts.

**`rules/`** is the calculator layer. `spacing.py` implements MUTCD
§6C.08 (taper length, the 40 mph threshold formula switch), §6C.09
(channelizer spacing — in-taper = speed in feet, on-tangent = 2×
that), and Tables 6B-1/6B-2 (advance warning, buffer space).
`devices.py` is the device taxonomy: a `DeviceType` enum, a
`DeviceSpec` dataclass with CDOT pay item numbers, and a `cone_display_name(speed_mph)`
helper that returns "36-inch" at ≥45 mph and "28-inch" below.
`validators.py` (~1000 LOC) lints generated layouts against MUTCD
tolerances (taper ±10%/+20%, spacing ±10%, advance warning ±15%) and
emits `Violation` records. `corridor.py` does station ↔ lat/lng
transforms and polyline encoding. `site_adjustments.py` and
`night_adjustments.py` add devices for things like adjacent
intersections and night work. `site_detection.py` queries Overpass for
the features that drive those adjustments.

**`rendering/plan_sheet.py`** is ~3000 lines of ReportLab drawing
code. No SVG, no matplotlib — direct canvas primitives (rectangles,
lines, glyphs). It builds the corridor geometry, applies a piecewise
x-mapping that compresses the buffer region while leaving taper/work
zone at scale, draws lanes and shoulders, draws every device as a
geometric symbol (cones = orange circles, drums = striped circles,
signs = green boxes, etc.), adds dimension callouts and a title block.
Optionally fetches a Mapbox satellite tile and embeds it as page 2 of
the PDF (silent fallback if the token is missing or the network call
fails).

**`export/device_list.py`** generates the XLSX with openpyxl: rows
aggregated by `(device_type, label)`, columns for CDOT pay item
number, unit, quantity. Pay item numbers are looked up from
`DEVICE_CATALOG`; if a device's `cdot_pay_item_number` is unset, the
cell renders as the literal string `"TODO"`, and there's a test
asserting this fails so we don't ship placeholders.

**`export/quote_generator.py`** computes itemized cost: equipment
(daily rate × project days × qty), labor (flagger hours, overtime,
night multiplier), delivery (distance + min charge), overhead 15%,
profit 25%. Rate tables are inline constants with a TODO to replace
once a real contractor invoice is available.

**`narrative/crew_narrative.py`** has two modes. Default: pure Jinja2
template (`templates/base.md.j2`) producing Setup/Takedown/Safety
sections. Optional (`use_llm=True`): runs the template output through
Claude Haiku 4.5 with a "preserve every number, citation, and table
heading" prompt to make the prose more readable for field crews.
Silently falls back to the template if the Anthropic SDK call fails.

### Database (Neon Postgres via Drizzle)

Three tables, schema in `conestruct/site/db/schema.ts`:

- `users` — keyed by Clerk user ID. Mirror of Clerk identity, plus
  `accepted_terms_at` / `accepted_terms_version`.
- `companies` — keyed by Clerk org ID. Mirror of Clerk organizations.
- `plans` — UUID PK, `company_id` FK (cascade delete), `created_by_user_id`
  FK (restrict), `name`, `data` (jsonb — the full `Scenario` object),
  timestamps. Indexed on `company_id` for the dashboard list.

Migrations live in `conestruct/site/db/migrations/`. Drizzle Kit
manages them.

## Data flow: generating a plan

This is the part most likely to drift. Walk through it next to the
code; flag anything that's wrong.

**User opens conestruct.com.** Vercel serves `app/page.tsx`, which
directly renders `<GeneratorShell mode="sandbox" />` with
`DEFAULT_SHOULDER` as the initial scenario. The root `/` *is* the
sandbox UI — there's no redirect, and `/sandbox` is a separate route
that mounts the same component. No auth required for either.

**User picks a location.** They click the location field in
`GeneratorSidebar`, which opens `LocationPickerModal`. The modal:

1. Geocodes the typed address via `POST /api/geocode`, which calls
   Mapbox forward geocoding server-side (the Mapbox token never
   touches the browser).
2. On pin drop, calls `POST /api/road-classify { lat, lng }`. The
   server hits Mapbox + Overpass to determine speed, lanes per
   direction, road type (rural undivided / urban arterial / freeway),
   and divided yes/no.
3. The user can override any field, set a bearing (direction of
   travel) and work zone length. Bearing has multi-candidate UI
   because OSM-derived bearing is often ambiguous at intersections.
4. On confirm, the modal returns a `LocationPickerResult` to
   `GeneratorSidebar` which calls `setScenario({ ... overrides })`.

**User tweaks form fields.** Every keystroke calls `setScenario(...)`.
Two things fire on every change:

- `results = useMemo(() => compute(scenario), [scenario])` runs
  `lib/scenarios/shoulder.ts:computeShoulder()` (or the equivalent
  for the scenario kind). This is a pure TypeScript estimator that
  produces taper length, buffer space, advance warning distances,
  device count estimates. Used by `MathSection`, `AuditTrail`, and
  `OutputCards`'s preview stats.
- The `useEffect` in `GeneratorShell` aborts any in-flight request
  and fires `POST /api/render/device-breakdown { scenario }`. The
  proxy route forwards (no transform) to Modal at
  `/render/device-breakdown`. The backend runs the full pipeline
  (generator → site/night adjustments → validator) and returns
  `{ devices: [...], total_devices, unique_types }`. This populates
  the `DeviceBreakdown` (Plan Details) panel.

**The dual-path matters.** The math/audit panel reads from the
TypeScript estimator; the Plan Details panel reads from the
authoritative backend pipeline. These two paths should agree on
counts but in principle can drift. The intended end state is for the
TypeScript estimator to be retired in favor of the backend — the
Plan Details migration is the first step; the AuditTrail and Math
displays are the still-to-migrate consumers.

**User clicks Generate (sandbox mode).** `GeneratorShell.onGenerate()`
fires `POST /api/render/bundle { scenario }`. The bundle route
(`app/api/render/bundle/route.ts`):

1. Calls `fetchAllRenderParts(scenario, quoteSettings)` which fans
   out four parallel `POST` calls to Modal: `/render/pdf`,
   `/render/xlsx`, `/render/markdown`, `/render/quote`. Each request
   carries the bearer token.
2. Each Modal handler runs `_placements_for(scenario)` → its
   respective renderer:
   - `/render/pdf` calls `render_plan_sheet()`, which optionally
     fetches a Mapbox satellite tile and returns a 1- or 2-page PDF.
   - `/render/xlsx` calls `export_device_list()`.
   - `/render/markdown` calls `generate_crew_narrative()`.
   - `/render/quote` calls `generate_quote()`.
3. The bundle route collects the four byte buffers and assembles a
   ZIP using JSZip with the names `plan_sheet.pdf`, `device_list.xlsx`,
   `crew_narrative.md`, `quote.xlsx`.
4. Streams the ZIP back to the browser with `content-disposition:
   attachment`.

**Workbench mode (signed-in user with a saved plan)** uses per-file
download routes instead: `/api/plans/[id]/pdf`, etc. Each downloads
the plan from Neon by UUID (scoped to the user's `orgId`),
deserializes the stored `data` jsonb into a `Scenario`, and calls
`renderScenarioToResponse(scenario, kind)` against Modal.

**Save flow.** `PlanSaveButton` calls `POST /api/plans { name, data,
acceptedTerms, acceptedTermsVersion }`. The route checks Clerk auth
(`userId`, `orgId`), updates the user's terms-acceptance timestamp if
this is the first save against the current `TERMS_VERSION`, and
inserts into `plans`. Returns the new UUID, which `GeneratorShell`
stores in state so subsequent edits go through `PUT
/api/plans/[id]`.

## Deployment topology

**Frontend.** Pushes to `main` trigger
`.github/workflows/vercel-deploy.yml`, which curls a Vercel deploy
hook. Vercel builds and ships `conestruct.com`. Feature branches get
preview URLs automatically. No tests gate deploys; `vercel.json` just
defines build/dev/install commands.

**Backend.** Pushes to `main` trigger
`.github/workflows/modal-deploy-check.yml`, which detects Python file
changes and **opens a GitHub issue** labeled `modal-deploy-needed`.
That's it — the issue is a reminder. Nobody runs `modal deploy`
automatically; a human has to do it locally and close the issue.

This produces a **stale deploy window** any time the frontend and
backend land related changes: Vercel ships in ~2 minutes, Modal ships
when the human gets around to it. If the frontend depends on a new
backend endpoint, that endpoint 404s until someone runs `modal
deploy modal_app.py`. We accept this for now because the operator is
also the only developer, but it's a real footgun for anyone joining
the project.

**The Modal deploy itself** is `add_local_dir("src", remote_path="/root/src")`
inside the image definition. That copy happens at deploy time, not at
runtime — the image is immutable once built. There are no Modal
volumes mounted, so nothing persists between deploys except what's in
Modal's secret store.

**Modal secrets** (three, all referenced via
`modal.Secret.from_name(...)`):

- `conestruct-render-secret` → `RENDER_API_SECRET` (must equal the
  Vercel `MODAL_RENDER_SECRET`).
- `mapbox-token` → `MAPBOX_TOKEN` for satellite tiles.
- `sentry-dsn` → `SENTRY_DSN` for backend error capture.

**Vercel env vars** (per `conestruct/site/.env.example`):

- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
  routing URLs, `CLERK_WEBHOOK_SECRET`.
- DB: `DATABASE_URL` (Neon connection string).
- Backend: `MODAL_RENDER_URL`, `MODAL_RENDER_SECRET` (paired with
  Modal's `conestruct-render-secret`).
- Mapbox: `MAPBOX_TOKEN` (server-side, for the Next.js Mapbox
  routes).
- Sentry: `NEXT_PUBLIC_SENTRY_DSN` (shipped to browser),
  `SENTRY_AUTH_TOKEN` (build-time only, for source map upload).
- Debug toggles (both default off, never set in Production except for
  one-off verification): `NEXT_PUBLIC_SENTRY_TEST`,
  `SENTRY_TEST_ENABLED`.

**Local dev.** Backend runs as a Streamlit harness:
`uv run streamlit run src/api/app.py` (a local UI for developers, not
a render server). Frontend runs `cd conestruct/site && npm run dev`
and **hits the live Modal backend** via `MODAL_RENDER_URL` — there's
no local FastAPI server. This means local frontend dev can stomp the
prod render service if you forget to point it elsewhere.

**Pre-commit hooks** (`.pre-commit-config.yaml`) run ruff
(lint + format) on Python, ESLint and `tsc --noEmit` on the frontend
(scoped to `conestruct/site/**` via `files:` regex). They're an
honor system — no server-side CI enforces them, so a contributor who
hasn't run `pre-commit install` can land unvetted code on `main`.
`CONTRIBUTING.md` explains this explicitly.

## Auth and authorization

**Identity is Clerk.** `ClerkProvider` wraps the root layout. Sign-in
and sign-up are at `/sign-in` and `/sign-up` (Clerk's catch-all
routes). `middleware.ts` uses `clerkMiddleware` with a route matcher
for `/app(.*)` and `/onboarding(.*)`. Unauthenticated requests to
those routes redirect to `/sign-in` with the original URL preserved.
A signed-in user with no `orgId` (no company) gets redirected to
`/onboarding`, where Clerk's `OrganizationList` lets them create or
join one.

**Authorization is per-org, not per-user.** `companyId == orgId`. The
plans table FKs to `companies.id`, and every protected query (read,
update, delete, download) scopes by `eq(plans.companyId, orgId)`. A
user who switches orgs in Clerk's `OrganizationSwitcher` sees a
different plan list.

**User sync.** Clerk emits webhook events to
`/api/clerk/webhook`. Svix verifies the signature, and the handler
upserts into `users` (on `user.created` / `user.updated`) or
`companies` (on `organization.created` / `organization.updated`).
Clerk is the source of truth; Postgres is a mirror.

**Backend auth is a shared bearer token.** Every Modal request from
the proxy carries `Authorization: Bearer ${RENDER_API_SECRET}`. The
`require_bearer_secret` middleware in `src/api/render_api.py` rejects
anything else with 401, and fails closed with 503 if the secret env
var is unset. `/healthz` is exempt for Modal's internal probes. There is no per-user auth at the backend — Modal trusts that
anything carrying the secret is the legitimate Vercel proxy. This is
intentional but worth naming: a leaked `RENDER_API_SECRET` gives an
attacker full unrestricted access to all render endpoints. There's no
rate limit and no per-user audit on the backend side.

**Public surfaces** are `/sandbox` (the public generator),
`/api/render/*` (rate-limited per IP, but not user-authenticated —
anyone can hit them), and the legal pages. The save flow is gated
because it writes to Postgres; the generate flow is open because we
want the public demo to work.

**Debug endpoints** (`/api/debug/sentry-test`,
`/debug/sentry-test/{500,400}` on backend, `/debug/sentry-test/page`
on frontend) are gated behind `SENTRY_TEST_ENABLED=1` and
`NEXT_PUBLIC_SENTRY_TEST=1` env flags respectively. They return 404
when the flags aren't set, which is the default in Production.

## External dependencies

**Mapbox** is used three ways: forward geocoding (`/api/geocode`),
satellite tiles for the PDF page 2 (Mapbox Static Images API, called
from `plan_sheet.py`), and the interactive map in
`LocationPickerModal` (Mapbox GL JS in the browser, which uses
`NEXT_PUBLIC_MAPBOX_TOKEN`). The browser-facing token is public; the
server-side `MAPBOX_TOKEN` is what gets called for road classify and
geocode.

**Overpass API** (OSM) is hit from the backend by `site_detection.py`
to count nearby intersections, interchanges, schools, sidewalks, bike
facilities. Used by the in-generate site scan (`src/api/site_scan.py`,
run by every render route when the scenario carries `site_scan`; the
manual `/render/detect-site` endpoint retired in s2-arc17) and
indirectly by `/api/road-classify`. No API key; rate limit is best-effort per-IP on
Overpass's side. If Overpass is down, site detection returns an
error object and the renderer skips the corresponding adjustments.

**Sentry** is two separate projects under the `conestruct` org:
`python` for the backend, `javascript-nextjs` for the frontend. Both
have `tracesSampleRate: 0` (errors only, no perf monitoring),
`sendDefaultPii: false`, and `before_send` / `beforeSend` hooks that
strip Authorization/Cookie headers and ignore HTTPException<500 on
the backend. See `MONITORING.md` for the full setup.

**Clerk** is the auth provider. Orgs are companies; users belong to
companies; default Clerk roles apply (no custom roles yet). Webhook
events sync into Postgres.

**Neon** is serverless Postgres. Connection via
`@neondatabase/serverless` (HTTP-based, no connection pooling
needed). Drizzle for queries and migrations.

**Anthropic Claude Haiku** is optional, used only when
`generate_crew_narrative(use_llm=True)` is called. The render
endpoint doesn't pass `use_llm=True` today, so this is dormant.

## Known weak spots and tech debt

**Dual source of truth for device counts.** The TypeScript
`compute()` estimator in `conestruct/site/lib/scenarios/` runs on
every keystroke to populate the math panel, audit trail, and output
card preview stats. The backend `/render/device-breakdown` runs in
parallel to populate the Plan Details panel and feeds the PDF/XLSX.
These two paths should agree but in principle can drift — there's
nothing structurally preventing them from disagreeing on, say, the
number of cones in a taper. The Plan Details panel was moved to the
backend recently (commit `c534ce5`) as the first step toward
retiring the TypeScript estimator entirely. The AuditTrail and the
Math section still read from `compute()`. Until those migrate,
"AuditTrail says 14 cones but Plan Details says 15" is a possible
failure mode that nothing in the code catches.

**LocationPicker state inconsistency.** Inside the location picker,
Road Properties (speed, lanes per direction, road type, divided) and
Direction of Travel (bearing) are managed as independent state.
Bearing isn't part of `RoadFieldOverrides`; it sits in its own
`useState`. The two can disagree on the same pin — for example, if
you classify a road as undivided then set a bearing that only makes
sense on a divided highway, nothing reconciles them. Surfaced
2026-05-19 and deferred. See `memory/project_locationpicker_state_bug.md`.

**MUTCD §6C.09 spacing edge cases.** The §6C.09 rules (in-taper
spacing = posted speed in feet, on-tangent = 2× that) are implemented
in `spacing.py` and enforced by `validators.py`, but there's a known
open item around what to do when the ceil-rounded device count
produces actual spacing slightly above the tolerance. The current
behavior prefers more devices (safer) but there are edge cases where
the validator emits a warning even though the layout is acceptable
by CDOT review. Tracked as a follow-up; not a blocking issue for V1.

**Stale Modal deploys.** Covered above — Vercel auto-deploys, Modal
doesn't. The reminder issue from `modal-deploy-check.yml` mitigates
this but relies on a human. If the frontend depends on a new backend
endpoint or schema change, there's a window where the live system is
broken. Realistic fix: a GitHub Action that runs `modal deploy` with
an API token. Not done yet.

**Pre-commit honor system.** No CI enforces lint, type check, or
tests. A contributor who skips `pre-commit install` can land
unformatted, unlinted, type-broken code on `main`. The Vercel build
will catch type errors (it runs `next build` which runs `tsc`), but
ESLint warnings and Python lint/format will not block anything.

**Rate limiting is instance-local.** Every Vercel API route has its
own in-memory `Map<ip, { count, reset }>`. Vercel's serverless
functions can scale horizontally, so each instance has its own
counter — true rate limit is `n_instances × per_instance_limit`. Fine
for a hobby-traffic public demo; needs Redis or Upstash if the
sandbox gets popular.

**Backend bearer token is the only auth boundary.** A leaked
`RENDER_API_SECRET` gives full access to every render endpoint with
no per-user attribution. Mitigations would be JWT-per-user (signed by
the proxy, verified by Modal) or per-org rate limiting on the
backend. Neither exists today.

**CDOT Case number TODOs.** `src/api/audit.py` has several `TODO:
verify exact Case # in 26-sheet S-630-1 set` comments. The audit trail
displays Case references that haven't all been cross-checked against
the official template set. Cosmetic for a contractor reviewer who
knows the rules, but a real reviewer's confidence dings if the Case
label is wrong.

**Pay item placeholders.** `device_list.py` emits the literal string
`"TODO"` in the pay item column when a `DeviceSpec` doesn't have a
CDOT pay item number. There's a test asserting this so we don't ship
placeholders; the implication is that any new device added without a
pay item will fail tests, which is the correct behavior.

**Quote rates are placeholders.** `EQUIPMENT_DAILY_RATES` in
`src/export/quote_generator.py` carries a `TODO` flagging that the
daily rates and labor rates are not from a real Colorado contractor
invoice. The math is right; the inputs are guesses. Marked for
replacement before the first paid pilot.

**V1 scenario gating.** Three kinds are enabled today — `"shoulder"`
(S-630-1 Cases 11/26/27), `"flagger_lane_closure"` (TA-10 + Cases
17/42), and `"near_intersection"` (Case 18, Arc 11 / #117) — gated by
two parallel constants: `ENABLED_SCENARIOS` in
`src/api/render_api.py` (backend rejects anything else with 400 via
`_ensure_scenario_enabled`) and `ENABLED_SCENARIO_KINDS` in
`conestruct/site/lib/scenarios/index.ts` (frontend hides the
disabled options from the picker). The lane closure, mobile
op, and work-beyond-shoulder generators all exist and have tests but
are not exposed to users. They'll re-enable individually as each is
verified against the CDOT S-630 typical sheets — both constants need
to be updated in lockstep.

**Plan Sheet renderer complexity.** `plan_sheet.py` is ~3000 lines of
imperative ReportLab canvas code. It works, but it's the single
largest module in the codebase and the hardest to modify safely.
There's no visual regression testing — changes are eyeballed against
expected PDFs by the operator. Refactoring this into a layer-based
DSL is a known long-term ask; not scheduled.

## Pointers to deeper docs

- **MONITORING.md** — Sentry setup details (env vars, what's
  filtered, verification procedure, known deprecations).
- **CONTRIBUTING.md** — first-time setup, pre-commit behavior,
  emergency bypass.
- **DEPLOYMENT.md** — operational runbook for shipping changes:
  per-change-type checklists, first-time setup, the rollback
  procedure for both Vercel and Modal, common production issues
  (stale Modal deploy, NEXT_PUBLIC_ rebuild gotcha, Sentry not
  landing, 401/503 from the backend), and a full secrets/env-var
  reference with paired-secret invariants.
- **README.md** — quick-start commands.
- **`memory/` (in user's Claude profile)** — project context not
  captured here: account model decisions, auth provider rationale,
  legal posture, the LocationPicker state bug context.
