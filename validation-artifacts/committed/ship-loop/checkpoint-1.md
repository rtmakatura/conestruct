# ship-loop — checkpoint 1: previews Ryan can sign into (written before Ryan rules)

**Arc:** Change 1, under R6 and R7 (quoted verbatim at the top of `rulings.md`). Investigate only:
no code, no config, and no Clerk, Vercel or Modal setting was changed.
**Base:** `7dee3db` = `main` = the prod `healthz` sha (measured 2026-09-28 16:50 UTC).
**Branch:** `ship-loop-1`.

## The answer, in brief

1. **The backend-token question does not block.** Modal never sees a Clerk token. The browser
   calls Next (`/api/*`). Next checks the session. Then Next calls Modal with a **shared secret**
   (`Authorization: Bearer`), the same secret for every caller. So a preview signed in through a
   Clerk **development** instance can make real API calls to prod Modal, **as long as the
   preview has the Modal URL and secret** (a Vercel setting, checked in Ryan's step 9).
2. **R6 works as ruled. No departure.**
3. **The coming-soon gate needs no code change.** It reads only env vars. A **Preview-only**
   `GATE_ALLOWED_EMAILS` plus the dev-instance keys lets Ryan through on previews. Production's
   values are not touched, so `www.conestruct.com` stays exactly as it is.
4. **CC's build is small:** one read-only script that prints a preview URL only after proving
   the preview serves the branch tip. Most of Change 1 is Ryan's dashboard work (below).
5. **One new risk found: the repo is public.** Vercel's fork protection must stay on (step 11).

---

## 1. Where Modal checks auth, and does it reject dev-instance tokens?

- **Modal has no Clerk code at all.** No issuer, no JWKS URL, no audience, no authorized
  parties. `grep -i "clerk|jwks|issuer|azp|jwt|jose"` over `src/`, `modal_app.py` and
  `pyproject.toml` finds nothing.
- **What Modal does check:** one shared secret.
  - `src/api/render_api.py:12-14`: "Auth: `Authorization: Bearer ${RENDER_API_SECRET}` header.
    The secret is shared between this service (deployed on Modal) and the Next.js API routes that
    proxy to it."
  - `src/api/render_api.py:538-560`: the middleware returns 401 unless the header equals the
    secret. `/healthz` is the only exemption.
  - **Measured:** a POST to prod Modal `/render/markdown` with no header → **401 `unauthorized`**.
- **Who sends the secret:** the Next server, per request, from `MODAL_RENDER_URL` /
  `MODAL_RENDER_SECRET` (`conestruct/site/lib/render-proxy.ts:101-102` and the other call sites
  listed in `checkpoint.md`). The browser never calls Modal.
- **Where Clerk tokens are checked:** only in Next, by `clerkMiddleware`
  (`conestruct/site/middleware.ts:69`) and `auth()` in the API routes. Both verify against the
  **keys the deployment was built with**. A preview built with dev keys verifies dev tokens. No
  `authorizedParties` is set (`middleware.ts:69`), so there is nothing to widen.

**Plainly: prod Modal does not reject dev-instance sessions, because it never sees them.** The
hand-check is worth something, provided step 9's Modal variables are present for Preview.

## 2. Options, if (1) had blocked

(1) does not block, so none of these is needed. For the record:

- **(a) Modal also accepts the dev issuer:** not applicable. Modal accepts no Clerk issuer today.
- **(b) The production Clerk instance on previews:** **Clerk does not allow `*.vercel.app` on a
  production instance.**
  - Clerk, *Deploying a Clerk app to Vercel*
    (https://clerk.com/docs/guides/development/deployment/vercel): "you cannot use a
    `*.vercel.app` domain for production", and "you can have your production Vercel environment
    use your production Clerk API keys while having your preview and development Vercel
    deployments use your development Clerk API keys".
  - Clerk, *Development vs production instances* (https://clerk.com/docs/deployments/environments):
    production instances need "a production domain within the Clerk Dashboard" and use a
    same-site cookie. That is why the preview gets `400 origin_invalid` today.
  - The only route to prod Clerk on a preview is hosting previews on a `conestruct.com`
    subdomain (Vercel's preview-domain suffix). A Clerk search result says it is Pro/Enterprise
    only. **I could not fetch that page verbatim, so treat the plan limit as unverified.**
- **(c) The gate's bypass header in a browser extension:** rejected in `checkpoint.md` (R1.4
  keeps the token for scripts).

**Recommendation: R6 as ruled, the dev instance.** It is also what Clerk's own Vercel guide
prescribes.

## 3. The coming-soon gate

- **The redirect:** `conestruct/site/middleware.ts:57-67` (`deny()`: a page → 307 to `/`, an
  `/api` call → 401 JSON). It is called at `:84`.
- **What lets someone past:** `:74-83`. Either the bypass header matches `GATE_BYPASS_TOKEN`, or
  the signed-in user's **verified** primary email is in `GATE_ALLOWED_EMAILS`.
  - The email comes from the session claim if one is configured, else from Clerk's Backend API
    with the deployment's secret key (`:43-55`; `lib/gate.ts:75-98`). On a preview that is the dev
    instance's API, so it finds Ryan's dev-instance user.
- **Preview-only, with prod untouched:** set `GATE_ALLOWED_EMAILS` for the **Preview**
  environment only (step 8). Vercel gives each environment its own value. The gate code, the
  public-path list (`lib/gate.ts:19-27`) and every Production value stay as they are.
  - **Nobody else gets in on previews either.** A stranger who signs up on the dev instance is
    still not on the Preview allowlist. The gate "holds whatever the Clerk dashboard says"
    (`middleware.ts:22-23`). Step 3 closes dev-instance sign-up anyway, as defence in depth.
- **No code change to the gate.** The route-table spec (`middleware.test.ts`) is untouched.

## 4. Everything else a preview needs

| Item | Setting / file:line | Measured / found | Blocks a hand-check? |
|---|---|---|---|
| Clerk keys | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | preview serves **`pk_live_`** today, and Clerk answers the preview origin with **400** | **Yes** until steps 1–7 |
| Gate allowlist | `GATE_ALLOWED_EMAILS` (`middleware.ts:82`) | preview `/sandbox` → **307 to `/`**; `/api/render/audit` → **401** | **Yes** until step 8 |
| Modal URL + secret | `MODAL_RENDER_URL`, `MODAL_RENDER_SECRET` (`lib/render-proxy.ts:101-102`) | cannot be seen from outside: the gate answers 401 before Next reaches Modal. **Needs your dashboard** | **Yes, if unset for Preview.** Pages load, every render fails |
| Mapbox, server | `MAPBOX_TOKEN` (`lib/geocode.ts:13`) | needs your dashboard | yes for address search: 503 "MAPBOX_TOKEN not configured" (`:15`) |
| Mapbox, browser | `NEXT_PUBLIC_MAPBOX_TOKEN` (`LocationPickerModal.tsx:396`) | no URL restriction (`checkpoint.md`) | no, if it is set for Preview |
| Modal CORS | none exists; the browser never calls Modal | — | no |
| Rate limit | `UPSTASH_REDIS_REST_URL/TOKEN` (`lib/rate-limit.ts:80-88`) | unset → the limiter is a no-op (fail-open, logged) | no |
| Database | `DATABASE_URL` (`db/index.ts:9-10`, read lazily) | used only by `/api/plans`, `/api/me`, `/app/*`, the Clerk webhook. The `/sandbox` routes never call it | no. See the next row |
| **User-id-keyed data** | `plans.companyId` → `companies`, `plans.createdBy` → `users` (`db/schema.ts:24-29`); `proxyRender` filters on the Clerk `orgId` (`lib/render-proxy.ts:503-511`) | a dev-instance user has a different user id and no organisation, and the dev instance sends no webhook, so no mirror row | **No for `/sandbox`.** The dormant `/app` workbench (R1.6) would show nothing or fail. **Recommended:** leave `DATABASE_URL` **off** for Preview, so a preview can never write dev-instance ids into the prod database (step 10). Without it, `/app` fails with a 500 ("DATABASE_URL is not set"), not a silent empty list |
| Clerk webhook | `CLERK_WEBHOOK_SECRET` | the dev instance has no endpoint pointed at previews | no |
| Allowlists or roles keyed on the prod user id | none found: the gate keys on the **email**, not the id | — | no |
| Vercel Deployment Protection | — | preview `/` answers 200 without a Vercel login, so it is off | no |

## 5. Getting Ryan the URL

- **Approach (as in `checkpoint.md`, now measured end to end on `7dee3db`):**
  1. Read the branch tip's Preview deployment:
     `gh api "repos/rtmakatura/conestruct/deployments?sha=<tip>&environment=Preview"` →
     deployment `6714883653`.
  2. Read its status: `environment_url` =
     `https://conestruct-aidgatzw7-rtmakaturas-projects.vercel.app`, state `success`.
  3. Fetch that preview's public `/` and its chunks. They carry
     `7dee3db7716ce3c106345368b971117f3edd6eb8` **twice**, the tip.
  4. Print the URL **only if** the served sha **equals** the tip.
- **It must be a new script, `scripts/preview-url.ps1 -Branch <name>`, read-only.**
  - `ship.ps1` has the same reader (`Get-ServedShas`, `:62-81`), but **the ship_gate hook blocks
    any command naming `ship.ps1`**, even its read-only `-FrontendCheckOnly` mode. Measured
    today: a `grep` that mentioned the file name was refused ("the latest message is not exactly
    'ship <branch>'"). That is R4/R10 working as ruled, so I will not route around it.
  - **A stricter test than `ship.ps1`'s.** A preview passes **only on exact equality**. There is
    no "no frontend change since" clause, so a preview of an older commit is never shown.
  - **Bounded:** it polls 20 s at a time for up to 10 minutes, then prints
    `PREVIEW NOT VERIFIED` and exits 1.
  - **The honest no-preview answer.** Since Change 2, a branch that changes no site file gets no
    Preview build. The script then says `no preview: Vercel skipped the build (no site change)`
    and prints no URL. Under R7 such a branch keeps today's path anyway.
  - **Duplication, stated:** its sha reader copies `ship.ps1`'s method, with a comment naming the
    source. The alternative, a shared `scripts/lib/` file dot-sourced by both, would change
    `ship.ps1` and need its red-proof re-run. **Default: the copy.** Say if you want the shared file.
- **The report line.** Every CC report on a branch with a preview gains one line **directly
  above** the `result:` line:
  `preview: <url> — serves <short sha> = branch tip (checked in the bundle); frontend-only: yes|no`
  - `frontend-only` comes from git: `yes` only if the branch changes nothing outside the
    site-input list in `conestruct/site/vercel-ignore.sh`. It tells you which R7 path applies.
  - **This is a report-format change in `handoff.md`,** which is untracked and needs a foreground
    session (see Conflicts).

## 6. The R7 one-minute prod smoke, in plain words

Only for frontend-only branches, after the ship:

1. **Read CC's pasted ship output.** It must say `FRONTEND CURRENT: built at <sha>`, and the
   healthz sha must equal that same sha.
2. **Open `https://www.conestruct.com/sandbox`** in your normal browser, signed in with your
   usual account. It should load the builder. If you land on the coming-soon page, stop.
3. **Look at the one thing the branch changed.** You already checked it properly on the
   preview; this is only "is it there".
4. **Generate one plan** (any address) and see the results appear. That proves prod's Next →
   Modal link still works.

If all four hold, the ship is closed. About one minute.

---

## 📋 Plan

**What CC builds (after your ruling and your dashboard steps):**

1. `scripts/preview-url.ps1 -Branch <name>`: read-only, as in §5. `gh api` GETs and HTTPS GETs
   only.
2. A small Pester or plain-PowerShell test of its decision (exact match → URL; older sha →
   refuse; no deployment and no site change → "no preview"; timeout → `NOT VERIFIED`, exit 1),
   fed with recorded responses. That is Rule 11's payload level. The live red-proof below is
   the rendered level.
3. `validation-artifacts/committed/ship-loop/change1-redproof.md`: the evidence.
4. **No change** to `middleware.ts`, `lib/gate.ts`, `ship.ps1`, the hook, or any backend file.

**Red-proof (the proof that it works, and that prod is unchanged):**

1. CC pushes a throwaway branch, `ship-loop-1-redproof`, with **one comment line** in
   `conestruct/site/lib/`. That forces a fresh Preview build that picks up the new
   Preview-only values. It is never shipped.
2. `preview-url.ps1` prints its URL with the tip sha.
3. **You, on that URL:** open `/sign-in` and sign in with the dev-instance account. You land on
   `/sandbox`, not on `/`. Generate one plan and see results. That is a real API call through
   Next to prod Modal.
4. **CC measures, before and after, and diffs:**
   - preview, signed out: `/sandbox` still → 307 `/`, `/api/render/audit` still → 401. Strangers
     are still gated.
   - preview: the served key is `pk_test_`.
   - **prod, unchanged against today's baseline (16:50 UTC):** `www` `/sandbox` → 307 `/`;
     `/api/render/audit` → 401; Clerk accepts `Origin: https://www.conestruct.com` → 200; `www`
     serves `pk_live_`.
   - **You, on prod:** sign in at `www.conestruct.com/sign-in` as usual. It works as before.
5. **Refusals:**
   - run the script on a docs-only branch → "no preview", no URL;
   - run it with the sha of an older preview → it refuses.
6. **Clean-up:** the hook blocks remote branch deletion (R10), so **you** delete
   `origin/ship-loop-1-redproof` afterwards, as with R15. CC records its sha.

**What could go wrong:**

- **The Modal variables are Production-only.** Then pages load but every render fails. It is
  loud, not silent: the sandbox shows the render error. Step 9 checks it before the red-proof.
- **An existing Clerk variable is ticked for Preview as well as Production** (it is today: the
  preview serves `pk_live_`). Vercel won't hold two values for one environment, so step 6
  unticks Preview on the prod entry first. **The one real mistake here would be unticking
  Production.** Step 6 says what to check, and the red-proof's prod sign-in catches it.
- **`NEXT_PUBLIC_*` values are baked in at build time.** Old previews keep `pk_live_` forever.
  Only builds made after step 7 work. That is why the red-proof pushes a fresh branch.
- **The Preview scope now holds the prod Modal secret** (if step 9 ticks it). Any preview build
  can call prod Modal. The branches are yours and CC's. Fork pull requests are the gap, since the
  repo is public (measured: `visibility: public`). Vercel's **Git Fork Protection** (on by
  default) makes a fork PR wait for your authorisation before it builds with env vars. Step 11
  confirms it is on. Vercel, *Deploying GitHub Projects with Vercel*
  (https://vercel.com/docs/git/vercel-for-github): Vercel "will require authorization from you or
  a team member to deploy the pull request. This behavior protects you from leaking sensitive
  project information such as environment variables".
- **Dev-instance sessions are weaker.** Clerk passes the dev session in the URL
  (`__clerk_db_jwt`), which it calls "not secure enough for production use"
  (https://clerk.com/docs/deployments/environments). That only matters on previews, which are
  gated and hold no customer data (no `DATABASE_URL`, step 10).
- **Your dev-instance email shows as unverified.** Then the gate turns you away
  (`lib/gate.ts:94-98`). Step 4 says what to look for.

## Ryan's dashboard steps

About **25–30 minutes**. Do them in this order. 🔑 marks a secret; it goes **only** into Vercel's
**Preview** environment, **never Production**.

### Clerk (https://dashboard.clerk.com)

1. **Open the Conestruct application.** Near the top of the page is a switch between
   **Development** and **Production**. Click **Development**.
   - *You should see:* a Development label or banner. Every Clerk application is created with a
     development instance, so it very likely already exists. If there is no Development option,
     stop and tell me what you see.
2. **Check sign-in:** go to **Configure → User & authentication → Email** (the name may be
   "Email, phone, username"). Make sure **Email address** is on for sign-in, and **Password** is
   on.
   - *You should see:* email and password both enabled. You'll sign in with those in the
     red-proof.
3. **Close sign-up:** go to **Configure → Access mode** (on older dashboards: **Restrictions**).
   Choose **Invite-only** and **Save**.
   - *You should see:* Invite-only selected. Nobody can sign up on this instance by themselves
     now. (Clerk, *Restricting access*, https://clerk.com/docs/guides/secure/restricting-access:
     the modes are Open, Invite-only and Waitlist.)
4. **Create your user:** go to **Users → Create user**. Enter **your email** and a password,
   then **Create**. Use the same email you'll put in step 8.
   - *You should see:* your user in the list. Open it. The email should **not** carry an
     "Unverified" tag. If it does, stop and tell me: the gate only admits a verified email.
   - Old test users in this list are harmless (the gate turns them away), but you can delete
     them.
5. **Copy the keys:** go to **Configure → API keys** (or **Developers → API keys**). Check the
   switch still says **Development**.
   - *You should see:* a **Publishable key** starting `pk_test_` and a 🔑 **Secret key** starting
     `sk_test_`. **If either starts `pk_live_` / `sk_live_`, you are on Production. Stop and
     switch.**
   - Keep this tab open for step 7.

### Vercel (https://vercel.com → the Conestruct project → **Settings → Environment Variables**)

6. **Take Preview off the prod Clerk keys** (first, so the new rows in step 7 don't clash). Find `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, open its
   **⋯ → Edit**. Its environment boxes show which of Production / Preview / Development it
   applies to. **Untick Preview only. Leave Production ticked.** Save. Do the same for
   `CLERK_SECRET_KEY`.
   - *You should see:* both entries now list **Production** (and maybe Development), and **not
     Preview**. If a Save would leave Production unticked, cancel.
7. **Add the dev keys, Preview only.** Click **Add New** (or **Create new**):
   - Key `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, value the `pk_test_…` key, environments: **Preview
     only**. Save.
   - Key `CLERK_SECRET_KEY`, value 🔑 the `sk_test_…` key, environments: **Preview only**, and
     mark it **Sensitive** if offered. Save.
   - *You should see:* each name now has two rows: the `live` one on Production and the `test`
     one on Preview.
8. **The preview allowlist.** Check `GATE_ALLOWED_EMAILS`. If an entry covers Preview, edit it
   and untick Preview (leave Production). Then **Add New**: key `GATE_ALLOWED_EMAILS`, value
   **your email only**, environments **Preview only**.
   - *You should see:* a Production row (unchanged) and a Preview row with just your email.
9. **Check the Modal and Mapbox variables (look, and tick if needed).** For each of
   `MODAL_RENDER_URL`, 🔑 `MODAL_RENDER_SECRET`, 🔑 `MAPBOX_TOKEN` and
   `NEXT_PUBLIC_MAPBOX_TOKEN`: if its row does not include Preview, **Edit → tick Preview →
   Save**. Nothing to paste; it reuses the existing value.
   - *You should see:* all four list Preview. **Tell me which ones you had to tick.** That is
     the Preview/Production drift `checkpoint.md` could not see.
10. **`DATABASE_URL`: make sure it is NOT on Preview.** If its row includes Preview, **Edit →
    untick Preview → Save** (leave Production).
    - *You should see:* `DATABASE_URL` on Production only. (Why: §4, so a preview can never
      write dev-instance ids into the prod database.)
11. **Fork protection:** **Settings → Security** (the name may be **Deployment Protection**).
    Find **Git Fork Protection**.
    - *You should see:* it is **enabled**. If it is off, turn it on and tell me.
12. **Leave everything else alone.** Nothing on the Production rows changes except that Preview is
    unticked. **Don't redeploy anything:** CC's red-proof branch makes the fresh build.

**When you're done:** tell CC "dashboard done" plus the answer to step 9 (which variables you
ticked) and step 11 (whether fork protection was on).

## Time estimate

- **CC's build:** about 1.5 h. That is the script and its test (45 min), the red-proof evidence
  file (15 min), and the red-proof itself (about 30 min, mostly waiting on one ~3 min preview
  build and your sign-in).
- **Your dashboard time:** about 25–30 min, plus about 5 min for the red-proof sign-in and plan.

## Conflicts with standing rules (named)

1. **R6: no departure.** The recommendation is R6 as ruled.
2. **R4/R10, the ship_gate hook,** blocks any command that names `ship.ps1`, even read-only.
   That rules out reusing `-FrontendCheckOnly` for previews. It is resolved by a separate script
   (§5), not by loosening the hook.
3. **R10 blocks remote branch deletion,** so you delete the red-proof branch (as with R15).
4. **`handoff.md` needs the new `preview:` report line and the R7 smoke (§6).** The file is
   untracked, so the edit needs a **foreground session**. The CLAUDE.md "session protocol" rule
   says a background job doesn't make it.
5. **Rule 10 (honest absence):** kept. The script refuses a stale preview, says "no preview" when
   Vercel skipped the build, and fails loudly at 10 minutes. Without `DATABASE_URL`, `/app` on a
   preview fails with a 500 rather than showing an empty list.
6. **Rule 12:** the 10-minute bound and the 20 s poll are **chosen** (copied from R3), not sourced.
7. **`gh` is read-only:** kept. Every GitHub call is a GET.
8. **R7's "frontend-only" split** now rests on the `frontend-only: yes|no` line, which is
   computed from git, not judged. Rule 5: the path is stated before the hand-check, not after.

## Evidence (this session; the commands are reproducible)

- **Backend auth:** `src/api/render_api.py:538-560`; no Clerk/JWT code in `src/`, `modal_app.py`
  or `pyproject.toml`. Prod Modal `POST /render/markdown` with no header → `401 unauthorized`.
- **Preview of `7dee3db`** (`https://conestruct-aidgatzw7-rtmakaturas-projects.vercel.app`,
  deployment `6714883653`): `/` 200, `/sandbox` 307 → `/`, `/sign-in` 200 serving `pk_live_`,
  `POST /api/render/audit` → 401 `{"error":"unauthorized"}`; Clerk `/v1/environment` with the
  preview Origin → 400. Its public `/` chunks (10) carry the tip sha twice.
- **Prod baseline, 2026-09-28 16:50 UTC:** `www` `/` 200, `/sandbox` 307 → `/`, `/sign-in` 200
  serving `pk_live_`, `POST /api/render/audit` → 401; Clerk with `Origin: https://www.conestruct.com`
  → 200; `healthz` sha `7dee3db7716ce3c106345368b971117f3edd6eb8`.
- **Repo visibility:** `gh api repos/rtmakatura/conestruct` → `public`.
- **Clerk and Vercel docs:** cited inline above. The Vercel preview-domain plan limit is from a
  search summary, not a fetched page, and is marked unverified.
