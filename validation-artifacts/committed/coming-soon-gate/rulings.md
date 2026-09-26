# rulings.md — the coming-soon gate
*Ryan, 2026-09-26, in chat, answering the checkpoint of `landing-inventory-2026-09-26` (CC report of the same date). Quoted as ruled. This file is the arc's first commit; every later commit cites it by number.*

## The four answers (verbatim: "1. yes 2. yes to all 3. yes 4. yes")

**R1 — Gate shape: the recommendation, as offered.**
- R1.1 The builder stays at `/sandbox` and is locked. It does not move; the tracked evidence scripts keep their URLs.
- R1.2 Public paths are exactly: `/` (coming soon), `/terms`, `/privacy`, `/sign-in`, and the Clerk webhook. Everything else requires sign-in, **`/api/*` included**.
- R1.3 Public sign-up closes. Access is an allowlist: Ryan, James, Zac.
- R1.4 Scripts get in with a secret header that middleware checks. The secret lives in an env var, never in the repo.
- R1.5 Allowlisted people enter by going directly to `/sign-in`. Nothing on the public page links to it.
- R1.6 Workbench mode (saved plans, companies, `NEXT_PUBLIC_AUTH_UI=true`) stays dormant. Reviving it is launch-prep, already parked.

**R2 — Coming-soon content: "yes to all."** Wordmark, one line on what Conestruct does, "coming soon", Built in Colorado, Terms/Privacy, **and** an email sign-up for interested companies. The sign-up needs somewhere to store addresses — its own build, second arc.

**R3 — FLOW.md names a third reader, "the prospect,"** who only ever sees the public page. FLOW.md §1 gains the line; the coming-soon page is designed for the prospect, and P17's "named person, named job" is satisfied by it (the job: decide whether to leave an address).

**R4 — Commit `validation-artifacts/committed/landing-inventory-2026-09-26/`** as this arc's evidence of the starting state.

## Derived rulings (from the above and standing rules; stated here so the verifier can check them)

- **D1 — Two arcs, gate first.** Arc 1 (this one) ships the gate with a plain placeholder at `/`; Arc 2 builds the designed coming-soon page and the email sign-up once Ryan picks a Claude Design direction. Reason: open sign-up and the anonymous `/api/*` proxies are live exposure today; they should not wait on design.
- **D2 — The placeholder is honest and small:** wordmark, "Coming soon", the one line, footer. No form, no claims, workbench tokens only, no new type sizes, no reserved hexes.
- **D3 — Meta tags are corrected in Arc 1.** "stamped-ready PDF" (`app/layout.tsx:21`) and "in under two minutes" (`app/layout.tsx:28`) go now (Rule 10/12: unmeasured, and the first contradicts the draft notice). `/sandbox`'s "Sign up to save plans…" goes too.
- **D4 — Historical evidence dirs are not rewritten.** Only the reusable helpers named in the inventory (`fidelity-audit/probe.cjs`, `issue-301-band-aerial/sweep.cjs`, `s2-audit-1/audit-lib.js`, `scripts/verify-single-nav.mjs`, the Python probe pattern) learn the bypass header. Archived one-off scripts stay as recorded ("Never amend a historical archive").
- **D5 — The Modal backend is unchanged in Arc 1.** It is already Bearer-protected; the gate closes the anonymous proxies in front of it. The other named exposures (rate limiter fails open, no origin/CSRF checks, `/api/replication-snapshot` ungated diagnostics — now gated by R1.2, plain `!=` secret compare at `render_api.py:558`) are filed as issues, not fixed here.
- **D6 — Arc 2 collects email addresses,** so it must update `/privacy` to say so before the form ships, and the page's promise ("one email when Conestruct opens · the address is used for nothing else") must be made true by the build or changed.

## Arc 2 rulings (Ryan, 2026-09-26, in chat)

**R5 — Direction B, "The Title Block," is the coming-soon design** ("I choose B"), desktop and phone artboards as drawn on the Claude Design canvas "Conestruct — Coming soon" (`TitleBlock.dc.html`, `TitleBlockPhone.dc.html`, copied into this arc dir). Ryan expects to revise it later; build it so copy and layout are easy to change.

**R6 — Sign-ups are emailed to ryan@conestruct.com, for now** ("Go with B for now, but we'll likely change it later"). One server-side function owns "record a sign-up"; swapping the destination later (database, list service) changes that function only.

**R7 — The wordmark shares the two hero sizes:** 62px (`--fs-hero-numeral`) at desktop, 42px (`--fs-hero-numeral-380`) below 520px. A second owner is recorded in the type census; no new size. *(Recommendation applied without objection; revisit on Ryan's word.)*

**R8 — Form inputs below 520px set text at 16px** so iOS does not zoom on focus. One ruled exception in the type census with that owner and reason. *(Same.)*

## Checkpoint rulings (Ryan, 2026-09-26) — cite as C-Qn
Ryan: "yes to all" on the checkpoint's recommendations.

- **C-Q1** Signed-out visitor to a gated page → redirect to `/`, no sign-in link (R1.5).
- **C-Q2** Signed-out call to `/api/*` → 401 JSON, no redirect.
- **C-Q3** Signed in but not allowlisted → treated exactly as signed out; session kept.
- **C-Q4** `/sign-up` stays behind the gate (no 404).
- **C-Q5** `/landing` and `/try` → `/` as 307. `lib/redirects.test.ts:25-36` changes with it (Rule-5 churn row).
- **C-Q6** Sign-in lands on `/sandbox` (`fallbackRedirectUrl="/sandbox"`), not the dormant `/app` (R1.6).
- **C-Q7** Supersedes D4's list. Archived helpers are never edited; they are copied forward into `scripts/` and the header is added there, through one shared `scripts/gate.cjs` + `scripts/gate.py`. `scripts/verify-single-nav.mjs` is edited in place. `audit-lib.js`'s header goes in its forward copy's callers.
- **C-Q8** `/terms` and `/privacy` take the placeholder's chrome in this arc: no "Sign in", no "Try the demo", no dead links on any public page.
- **C-S1** Yes: the gate and the placeholder ship together, one branch, one ship.
- **C-S2** Yes: the page title's "MUTCD plans in seconds" goes (untraced speed claim, D3's rule). New title: "Conestruct — coming soon".
- **C-E1** Ship waits on Ryan confirming `GATE_ALLOWED_EMAILS` and `GATE_BYPASS_TOKEN` are set in Vercel prod and locally, and the Clerk restrictions in both instances. The middleware check holds regardless of dashboard settings.
- **R5 correction:** the two design files were sent in chat, not copied; Ryan adds them to `validation-artifacts/committed/coming-soon-gate/design/` before Arc 2. Arc 1 does not need them.
