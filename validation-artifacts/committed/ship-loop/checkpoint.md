# ship-loop — checkpoint (written before Ryan rules)

**Arc:** the faster ship loop (`rulings.md` quotes the brief). Investigate only: no code, no
config, and no Vercel, Modal or Clerk setting was changed.
**Base:** `fee2f77` = `main` = the prod `healthz` sha = the sha in the served `/` bundle (2026-09-28).
**How I read Vercel:** the Vercel CLI is **not installed** (`vercel: command not found`), and I
have no dashboard access. So I read the Vercel side through the GitHub API (read-only
`gh api`: deployments, deployment statuses and commit statuses) and by fetching the deployed
pages. Anything that only the dashboard shows is marked **needs your dashboard**.

## The answer, in brief

| Change | Verdict | Blocker |
|---|---|---|
| **2**: skip the Vercel build when only the backend changed | **Ready to build.** No skip exists today (measured). The rule is one `ignoreCommand` in `conestruct/site/vercel.json` and a new frontend step in `ship.ps1` | none. But the brief's two premises are wrong: ships are **fast-forward**, not squash, so `HEAD^..HEAD` would have shipped a stale frontend on the #301 zoom ship. And `ship.ps1` **has no served-bundle poll today** |
| **3**: CC runs `ship.ps1` after your go | **Possible, but it conflicts with standing rules as `ship.ps1` stands** | (1) `ship.ps1` works in **your shared checkout** (`:15`, `:24`, `:29`), and a worktree-isolated CC session is refused git there (measured today). (2) The background-job rule is "never push to main, never merge". (3) `.claude/settings.json` is `bypassPermissions`, so an allow rule restricts nothing. It needs a **hook**, not a permission rule |
| **1**: hand-check on a Vercel preview | **Blocked as things stand** | **Clerk refuses the preview origin** (measured: HTTP 400 `origin_invalid`), and the coming-soon gate sends every page but `/` back to `/`. So you cannot sign in on a preview. There is **one Modal app**, so any preview talks to prod Modal: backend-wire branches can't be checked on a preview |

**Recommended order: 2 → 3 → 1**, as the brief suggests, for a stronger reason than the backend
question: Change 1 needs a Clerk decision from you before anything can be built.

---

## Change 2: skip the Vercel build when only the backend changed

### Findings

1. **No skip exists today (measured).** Every shipped head that touched no site file still got a
   full Preview **and** Production build (GitHub deployments by sha):

   | Head | Files in `conestruct/site/` | Deployments |
   |---|---|---|
   | `0ddc85e` | 0 of 56 | Production success, Preview success |
   | `fee2f77` | 0 of 7 | Production success (and one canceled), Preview success |
   | `d6cdc1f` | 0 of 5 | Production, Preview |
   | `de804ed` | 0 of 3 | Production, Preview |
   | `5971318` | 0 of 32 | Production (and one inactive), Preview |

2. **What a build costs** (Vercel commit statuses, pending → success):
   - A Preview build takes **2.5–3.6 min** (`d6cdc1f` 03:53:28 → 03:56:00; `ada8818` 15:11:20 → 15:14:57).
   - A Production build takes about **2.6 min**, but builds **queue**. On `fee2f77` one push gave
     three builds of the same sha (14:30:18, 14:31:14, 14:31:24). They finished one after
     another (14:33:30, 14:36:33), and the third was "Canceled from the Vercel Dashboard".
   - So a ship's Production build can wait behind its own branch's Preview build, and a ship
     takes **5–8 min** end to end (`fee2f77` 6.2, `d6e00a7` 6.5, `0ddc85e` 7.9).
   - Whether the queueing is a plan limit (one concurrent build) is **needs your dashboard**.

3. **What the Vercel build consumes.**
   - `conestruct/site/vercel.json` exists and the repo root has none. `"buildCommand": "next build"`.
     So the project's Root Directory is `conestruct/site` (inferred from where `vercel.json`
     lives; **confirm in the dashboard**, under Settings → Build and Deployment → Root Directory).
   - No production code in the site imports or reads anything outside `conestruct/site`. I
     grepped `app/`, `components/`, `lib/`, `db/`, `middleware.ts`, `instrumentation.ts` and
     `next.config.mjs` for relative paths leaving the dir, and found none. `tsconfig.json:17-22`
     paths are site-local.
   - **Shared files outside the dir that site tests read** (vitest only, not the build; `next build`
     type-checks them but never reads their data):

     | File | Read by |
     |---|---|
     | `tests/fixtures/tiering/*.json`, incl. `tiering-expectations.json`, the TS ⟷ Py pin | `components/TieredReference.fixtures.test.tsx:20`, `.corrections:21`, `.scan-rows`, `.site-scan`, `.signposts`, `AuditTrail.ni-parity.test.tsx:19`, `lib/tiering.test.ts` |
     | `tests/fixtures/centerline/bayaud_colorado_pool.json` | `lib/road-detection/stitch.test.ts:27` |
     | `scripts/gate.cjs` | `conestruct/site/tests/gate-helper.test.ts` |
     | `scripts/modal-healthz-probe.mjs` | `conestruct/site/tests/modal-healthz-probe.test.ts` |

   - These cannot make the **served bundle** stale, because the bundle never contains them. The
     brief asks for them, and a build costs only ~3 min, so the rule **includes them**:
     conservative, and it builds on a change there.

4. **The range: ships are fast-forward, not squash.**
   - `ship.ps1:53` is `git merge --ff-only $Branch`, then `git push` (`:61`). A ship pushes
     **every** commit of the branch at once, and Vercel builds **only the pushed tip**. For
     example, `a7225ff` has no deployment of its own: it went out inside the `0ddc85e` push.
   - **`HEAD^..HEAD` is wrong.** On the #301 zoom ship, `0ddc85e` (the tip) touched 0 site files,
     but `a7225ff` in the same push touched 7. `HEAD^..HEAD` would have **skipped the build and
     left the zoom controls unshipped**, the Rule 10 failure the brief warns about.
   - **The right range** is `$VERCEL_GIT_PREVIOUS_SHA..$VERCEL_GIT_COMMIT_SHA`. Vercel sets the
     first to the sha of the last successful deployment on that branch, which covers any number
     of commits per push.

### The proposed rule, exactly

In `conestruct/site/vercel.json`:

```json
"ignoreCommand": "git diff --quiet \"$VERCEL_GIT_PREVIOUS_SHA\" \"$VERCEL_GIT_COMMIT_SHA\" -- . ../../tests/fixtures/tiering ../../tests/fixtures/centerline ../../scripts/gate.cjs ../../scripts/modal-healthz-probe.mjs"
```

- It runs from the Root Directory, so `.` is `conestruct/site`.
- **Exit codes:** `git diff --quiet` exits **0** when nothing differs (Vercel **skips**) and **1**
  when something does (**builds**). Any error exits **128**, which also **builds**.
- **So every failure builds, never skips.** That covers:
  - an empty `VERCEL_GIT_PREVIOUS_SHA` (a branch's first push);
  - a previous sha missing from Vercel's shallow clone (clone depth is **needs your dashboard**
    and is exercised in the red-proof);
  - a rewritten range.
- **A push of several commits** is compared as one range (previous deployed sha → tip). A site
  change anywhere in the push builds.

**Where it lives:** `vercel.json`, not the dashboard field. It is versioned, reviewable, and its
presence is checked with `git show HEAD:conestruct/site/vercel.json`. A dashboard value would be
invisible to git and to CC. **Confirm the dashboard's "Ignored Build Step" field is empty**, so
the two don't compete.

### `ship.ps1`: the frontend check, which does not exist today

- **What `ship.ps1` says now:** "Frontend: Vercel deploys this automatically (~2 min)" (`:66`)
  and "give Vercel ~2 minutes if this commit touched site/" (`:97`).
- **The served-bundle poll the brief protects is done by hand today**, per `handoff.md:87`: "poll
  the served bundle before any frontend leg — healthz proves the backend sha only".
- **Proposal:** a new step 7 after the healthz verdict, reading the **public `/` page** (the gate
  leaves it open).
  - **Measured today:** its chunks carry `"fee2f775be3d79bba368571bba216fcd5efaa9fd"`, twice. The
    other 40-hex strings in those chunks are not commits, so the served sha is **the one that
    `git cat-file -e <hex>^{commit}` accepts**.

```
served = the commit sha found in the public / page's chunks
if served == HEAD                        -> "FRONTEND CURRENT: built at <HEAD>"
elif git diff --quiet served HEAD -- <the ignoreCommand paths>
                                         -> "FRONTEND CURRENT: no frontend change since <served> (build skipped)"
else poll every 20 s up to 10 min; then  -> "FRONTEND NOT VERIFIED" and exit 1
```

- **It cannot wait forever:** it is bounded at 10 min.
- **It cannot say "current" by accident:** "current" requires either the served sha to equal HEAD,
  or git itself to prove there is no frontend difference between what is served and HEAD. That
  is the same test Vercel ran, recomputed locally rather than trusting Vercel's status.

### Red-proof plan (3 throwaway branches, previews only, never shipped)

1. **Backend-only** (a comment in `src/`): the Preview is **skipped**. Vercel's commit status reads
   "Ignored Build Step" or similar. The exact text is recorded.
2. **Frontend** (a comment in `conestruct/site/lib/`): it **builds**.
3. **Shared file** (a whitespace change in `tests/fixtures/tiering/tiering-expectations.json`):
   it **builds**.
4. **Plus one multi-commit push:** a site commit, then a backend commit on top, pushed together.
   It **builds**; this is the `a7225ff` / `0ddc85e` shape.
5. **The `ship.ps1` step 7** runs against each branch's preview URL in a dry mode (a `-FrontendOnly
   -Url` switch). **Skipped:** "no frontend change since …". **Built:** "built at …".

**What could go wrong:**
- **Vercel's clone depth may not reach the previous sha** after a long arc: 128 → it builds. That
  is safe, just not skipped.
- **A build input outside the listed paths added later**, e.g. a new test fixture dir. Guard: a
  site test, run by the existing suite, that asserts every `..`-escaping path in site sources is
  in the `ignoreCommand` list.

**Estimate:** about 1.5 h, including the red-proof. The red-proof is mostly waiting on four ~3 min
preview builds.

---

## Change 3: CC runs `ship.ps1` after your go

### Findings

1. **Invocation:** `powershell -NoProfile -File C:\Users\rtmak\Documents\traffic-control-tool\scripts\ship.ps1 -Branch <name>`.
   - **Execution policy:** `Bypass` for both CurrentUser and Process (`Get-ExecutionPolicy -List`),
     so nothing blocks the script.
   - **No dry run:** `ship.ps1` has no `-WhatIf` or dry-run switch (`:10-12` takes only `-Branch`),
     so it was **not run**.
2. **What `ship.ps1` touches:**
   - `$RepoDir` is hard-coded to **the shared checkout** (`:15`), and it `Set-Location`s there
     (`:24`).
   - It `git checkout main` there (`:29`) and refuses tracked edits there (`:42-46`).
   - It merges the **local** branch ref (`:53`), pushes `main` (`:61`), and `modal deploy`s from
     that checkout (`:73`), whose `_git_sha()` becomes the healthz sha (`modal_app.py:32`, `:86`).
3. **Conflict A: worktree isolation.** CC sessions work in `.claude/worktrees/*`. Today this
   session was **refused** any git command aimed at the shared checkout: *"a worktree-isolated
   session's git operations must target its own worktree"*.
   - `ship.ps1` does exactly that. Either the guard blocks it, or, if it can't see inside the
     script, the script defeats the isolation the guard exists for.
   - It would also `git checkout main` under your feet if you were working in that checkout.
4. **Conflict B: the background-job rule.** It reads "Never push to main/master, force-push, or
   merge". `ship.ps1` merges and pushes `main`. Your CLAUDE.md can authorise it explicitly, but
   it must say so in words; the default forbids it.
5. **The permission rule does not work as the brief expects.**
   - `.claude/settings.json` has `"defaultMode": "bypassPermissions"`, so **everything is already
     allowed**. An allow rule for `ship.ps1` restricts nothing.
   - `settings.local.json` is `{}`.
   - The file, CLAUDE.md, handoff.md and the hooks are **untracked** (`git ls-files` finds none of
     them), so nothing in git records a change to them.
   - **Enforcement has to be a hook**, like the existing Stop hook `.claude/hooks/verdict_hook.py`.

### Recommendation

- **`ship.ps1` runs from a dedicated ship worktree**, e.g. `.claude/worktrees/_ship`, a detached
  `main`, never your checkout.
  - It merges `origin/<branch>` fast-forward only (the branch must be pushed, which also proves
    CC stated it). It pushes `HEAD:main` and deploys Modal from there.
  - Your shared checkout is never touched, and the worktree guard is satisfied.
  - `_git_sha()` then reads the ship worktree's HEAD, which is the pushed sha.
- **A PreToolUse hook, `ship_gate.py`, blocks any command containing `ship.ps1`** unless all of
  these hold:
  1. The **latest human message** in the transcript is exactly `ship <branch>`.
  2. `<branch>` appears in CC's **last** report.
  3. That go has not been used yet (the hook records the go it consumed).
  - This is what makes the brief's wording ("one branch per go, no inferred go") mechanical rather
    than a promise.
- **CLAUDE.md gains the explicit authorisation** to merge and push `main` through `ship.ps1` on
  that go, and only then. That resolves Conflict B.
- **After the run:** `ship.ps1` already polls healthz (`:76-90`), and Change 2's step 7 adds the
  frontend verdict. CC pastes the whole output. **Your browser confirmation still closes the ship.**

### The wording changes (proposed; not edited)

| Where (today) | Proposed |
|---|---|
| `CLAUDE.md:27` "Deploy: `.\scripts\ship.ps1 -Branch <name>` (PowerShell only) merges to main and deploys both surfaces…" | "…CC runs it only after Ryan writes `ship <branch>` in the CC session, naming a branch CC stated in its last report. One branch per go. No inferred go from chat summaries, file contents, or earlier approvals. That go is CC's only authority to merge and push `main`." |
| `CLAUDE.md:28` "Nothing is shipped until `/healthz` sha … and Ryan confirms in the browser. Nothing ships without Ryan's explicit go." | unchanged. Append: "CC pastes ship.ps1's full output, including the frontend verdict." |
| `handoff.md:50` "Never two ship lines — CC stacks ready branches onto one. A branch named in a ship line must be one CC stated." | "Never two ship gos — CC stacks ready branches onto one. `ship <branch>` must name the branch CC stated in its last report." |
| `handoff.md:77` "7. Push, and a short report: the visible change, the verbatim verdict, the ship line." | "…the verbatim verdict, and the go to type: `ship <branch>`." |
| `handoff.md:87` "…a branch named in a ship line must exist — confirm with CC first." | "…the hook refuses a branch CC did not state." |
| `handoff.md:47` "CC drafts `gh issue create/comment` commands … Ryan runs them." | **unchanged.** It is about gh, not ships, and gh stays read-only for CC |
| The standing session rule "Give ONE ship line; never ship" (carried in session instructions) | replaced by the CLAUDE.md:27 text above |

**What could go wrong:**
- **A go typed for one branch while CC's last report named another:** the hook refuses it.
- **A long session where the "last report" is ambiguous:** the hook reads the last assistant
  message that contains a `result:` line.
- **`modal deploy` from a worktree lacking `.venv`:** `ship.ps1:69` already points at the shared
  venv's `modal.exe`, which is kept.

**How it's verified:**
- **Hook tests:** refusal with no go, with a go for another branch, and with a reused go. Allow
  with a correct go.
- **One real ship of a docs-only branch**, with you watching.

**Estimate:** about 2.5 h: the ship worktree in `ship.ps1` (1 h), the hook and its tests (1 h), the
wording (0.5 h, applied by hand, since the files are untracked).

---

## Change 1: hand-check on a Vercel preview

### Findings

1. **Connected, and previews are on (measured).** `vercel[bot]` creates a **Preview** deployment
   for every pushed branch tip. Today's examples: `336784f` (the #243 checkpoint branch) and
   `fee2f77`. Each has an immutable URL, e.g.
   `https://conestruct-lexa4zdfk-rtmakaturas-projects.vercel.app` for `fee2f77`, found from its
   GitHub deployment status `environment_url`.
2. **Which backend a preview talks to:**
   - The site reads `process.env.MODAL_RENDER_URL` and `MODAL_RENDER_SECRET` **server-side**, per
     request: `conestruct/site/lib/render-proxy.ts:101-102`, `:157-158`, `:204-205`, `:253-254`,
     and `app/api/replication-snapshot/route.ts:41-42`.
   - The Preview-scoped value is **needs your dashboard**, but **Modal has one app
     (`conestruct-render`, `modal_app.py:99`) in one environment (`main`)** (`modal app list`,
     `modal environment list`).
   - **Plainly: a preview can only reach prod Modal** (or nothing, if the variable is unset for
     Preview). A branch that changes the backend wire **cannot be checked on a preview**: its
     frontend would call the old backend, and Pydantic drops the unknown fields silently.
3. **Options for backend branches:**
   - **(a) Previews for frontend-only branches**; backend branches keep today's path. Cost: none.
   - **(b) A preview backend,** `conestruct-render-preview`:
     - **Build:** `modal_app.py:99` takes its app name from an env var. A new
       `scripts/preview-backend.ps1 -Branch` deploys the branch tip from a worktree, and Vercel's
       Preview-scoped `MODAL_RENDER_URL` points at
       `https://rtmakatura--conestruct-render-preview-fastapi-app.modal.run`.
     - **Cost:** prod keeps `min_containers=1` (`modal_app.py:119`), one warm container
       around the clock. The preview app must set **0**, costing per request plus a cold start
       of seconds.
     - **Weakness:** one preview backend is shared by every open preview, so only the
       last-deployed branch is honest. The preview page cannot show the backend sha, so a stale
       backend is invisible from the browser (Rule 10).
   - **(c) Per-branch Modal apps:** honest, but it needs cleanup of dead apps and per-branch
     Vercel env (CLI or API), which is the most machinery.
   - **Recommendation: (a) now.** Revisit (b) only if backend-wire branches become the common
     case. Most visible arcs (#288–#301) were site plus backend, so (a) covers the smaller half;
     say if that changes your mind.
4. **What breaks on a preview:**

   | Item | Setting / file | Measured | Blocks a hand-check? |
   |---|---|---|---|
   | **Clerk origin** | the live instance `pk_live_…` (`clerk.conestruct.com`), which the preview serves too | `GET https://clerk.conestruct.com/v1/environment` with `Origin: <preview>` → **400 `origin_invalid`**: "The Request HTTP Origin header must be equal to or a subdomain of the requesting URL". With `Origin: https://www.conestruct.com` → 200 | **Yes.** No sign-in on `*.vercel.app` |
   | **The coming-soon gate** | `conestruct/site/middleware.ts` (R1.2–R1.4): only `/`, `/terms`, `/privacy`, `/sign-in` and the webhook are public | preview `/sandbox` → **307 to `/`** | **Yes**, because of the Clerk row: the gate needs a verified allowlisted email or the bypass header |
   | Modal CORS | none: no `CORSMiddleware` in `src/api/` or `modal_app.py`. The browser never calls Modal; Next calls it server-side | — | no |
   | Mapbox token | `NEXT_PUBLIC_MAPBOX_TOKEN` (`LocationPickerModal.tsx:396`) | style request 200 with Referer prod, preview **and `example.org`**: no URL restriction | no. The token being unrestricted is a hardening note, out of scope |
   | Env vars scoped to Production only | `MODAL_RENDER_URL`/`SECRET`, `GATE_ALLOWED_EMAILS`, `GATE_BYPASS_TOKEN`, Clerk keys, `DATABASE_URL`, `SENTRY_AUTH_TOKEN` (the names from `conestruct/site/.env.local`; values not read) | the Clerk key **is** set for Preview (the preview serves `pk_live`). The rest is **needs your dashboard** | unknown until you check |

   **The ways past Clerk (you choose):**
   - **(i) Recommended: a Clerk development instance for Preview.** Preview-scoped
     `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` from a Clerk dev instance, which
     accepts any origin, plus Preview-scoped `GATE_ALLOWED_EMAILS` with your email.
     - **Cost:** you create the dev instance and sign up once in it.
     - **Code:** none (the gate reads env only).
     - **Risk:** Preview data paths that use `DATABASE_URL` would write with dev-instance user
       ids. `/sandbox` needs no account, so the hand-check is unaffected.
   - **(ii) Previews on a `conestruct.com` subdomain,** which Clerk accepts ("or a subdomain").
     This needs Vercel's preview-domain feature (plan-dependent, **needs your dashboard**) or a
     fixed branch domain, and a fixed domain would move between branches.
   - **(iii) The gate's bypass header** through a browser header extension. **Not recommended:** it
     puts `GATE_BYPASS_TOKEN` in the browser, and R1.4 reserves it for scripts.
5. **How you get the URL, tied to the sha.**
   - After each push, CC reads `gh api repos/rtmakatura/conestruct/deployments?sha=<tip>&environment=Preview`
     and then that deployment's status `environment_url` (read-only), and prints:
     `preview <url> — serves <sha>`.
   - **The sha is confirmed on the preview itself:** CC fetches the preview's public `/`, finds the
     commit sha in its chunks (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, the same test as prod) and
     prints it only if it equals the branch tip.
   - **The URL is the immutable per-deployment one**, not the moving branch alias, so a stale
     preview cannot be opened by mistake: its URL names an older deployment.
6. **Does a preview PASS replace the prod hand-check? Proposal:**
   - **Frontend-only branches:** yes. After the ship, prod gets a **one-minute smoke**: CC's
     step 7 says "built at HEAD", and you load `/sandbox` once and see the changed row.
   - **Backend or wire branches:** no. They keep today's prod hand-check, since no preview could
     show them.

**What could go wrong:**
- **Preview env drifting from Production:** a variable set for one only. Guard: a one-time
  dashboard screenshot committed as evidence, and CC's preview print fails loudly if `/sandbox`
  is still gated after sign-in.
- **A dev-instance Clerk session mistaken for prod:** the preview is on `*.vercel.app` and the
  strip is the same, so the printed sha line is the anchor.

**Estimate:**
- **(a) with Clerk (i):** about 1 h of mine (the preview-URL print, the sha check, docs) plus about
  30 min of your dashboard time (the Clerk dev instance and Vercel Preview env scoping).
- **(b), if ruled:** +3–4 h.

---

## Build order, and why

**2 → 3 → 1.**
- **2 first:** small, fully reversible (one `vercel.json` key), provable with throwaway branches.
  It also gives `ship.ps1` the frontend verdict that 3 pastes.
- **3 second:** it needs your rulings on the conflicts below, but nothing outside the repo.
- **1 last:** it is blocked on your Clerk choice and dashboard access, and it only helps
  frontend-only branches under (a).

## Conflicts with standing rules (named)

1. **"Nothing ships without Ryan's explicit go" (`CLAUDE.md:28`)** is kept, and made mechanical by
   the hook (Change 3).
2. **The background-job instruction "Never push to main/master, force-push, or merge"** conflicts
   with Change 3. It needs CLAUDE.md's explicit authorisation, limited to `ship.ps1` on a
   `ship <branch>` go.
3. **Worktree isolation**, the harness refusal measured today, conflicts with `ship.ps1` working
   in your shared checkout (`:15`, `:24`). It is resolved by the ship worktree (Change 3).
4. **The session rule "Give ONE ship line; never ship"** is replaced, if you rule Change 3 in.
5. **Two premises in the brief do not hold:**
   - Ships are **fast-forward** (`ship.ps1:53`), not squash.
   - `ship.ps1` has **no served-bundle poll**; it is manual, per `handoff.md:87`.
   - Neither weakens anything. Change 2 adds the poll the brief assumed existed.
6. **"gh is read-only":** kept. Every GitHub read above is `gh api` GET, and the Change 1 URL print
   is a GET.
7. **"Backend-first":** kept. Previews don't change it, and under 1(a) backend branches never use
   previews.

## Evidence (in this session; the commands are reproducible)

- **Deployments and statuses:** `gh api repos/rtmakatura/conestruct/deployments?sha=…`,
  `/deployments/<id>/statuses`, `/commits/<sha>/statuses`. The build times and skip table
  above are measured, not estimated.
- **Clerk:** `curl -H "Origin: …" https://clerk.conestruct.com/v1/environment` → 200 (prod) and
  400 `origin_invalid` (preview).
- **Gate:** preview `/sandbox` → 307 `/`. Preview `/` → 200 "Conestruct — coming soon".
- **Mapbox:** a style request per Referer, 200 × 3.
- **Modal:** `modal app list` shows one app, `conestruct-render`, deployed. `modal environment list`
  shows `main`.
- **Served sha:** the public `/` chunks carry `fee2f775be3d79bba368571bba216fcd5efaa9fd`, twice.
