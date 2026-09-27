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

## Arc 2 design rulings (Ryan, 2026-09-26, in chat)

**R5a — supersedes R5's design: B+, "The Plan Sheet," is the coming-soon page** ("Looks great", on the canvas "Conestruct — Coming soon"). Authority: `design/PlanSheet.dc.html` (1440 wide) and `design/PlanSheetPhone.dc.html` (390 wide). R5's "build it so copy and layout are easy to change" still holds. `design/TitleBlock*.dc.html` stay as the record of B.

**R9 — The drawing uses the product's corridor-zone colours** (`ZONE_COLOR`, `lib/corridor-zones.ts:32-36`: advance warning, taper/transition, buffer, work zone, downstream), each with its word in the legend (Rule 13). This page is their second consumer; one source, imported, never re-typed. *(Approved as shown; the canvas has a grey fallback if Ryan reverses it.)*

**R10 — The drawing animates once on load** (road lines draw, then signs, devices and zone bands fade in, ~1.5 s), and is static under `prefers-reduced-motion`. The only motion on any Conestruct surface; the product's no-motion rule is unchanged. *(Approved as shown; same.)*

**R11 — Access setup as actually done for Arc 1:** Clerk prod is in Access mode → Invite-only; the three users (`ryan@conestruct.com`, James, Zac) were created by hand; no Clerk allowlist (Open-mode only, paid). `GATE_ALLOWED_EMAILS` is the enforcement. C-E1's "Clerk restrictions" means this.

## Arc 2 checkpoint rulings (Ryan, 2026-09-26) — cite as A2-Qn
- **A2-Q1 — No sign-up form in Arc 2.** "Get notified" (nav, sheet, closing band) is a `mailto:ryan@conestruct.com` link with subject "Conestruct — let me know when it opens". No email provider, no `/api/waitlist`, no rate-limiter change, no Sentry change, no /privacy change. The title block keeps its rows; the form area becomes the question "Want to know when it opens?" + the mailto button + the line "Email us and we'll write back once, when Conestruct opens." R2's form moves to its own arc (provider, fail-closed limiter, Sentry scrubbing, /privacy v-bump — CC's checkpoint §§2–3, 7 carry over as its starting point).
- **A2-Q2/Q3/Q4** — moot under A2-Q1.
- **A2-Q5** — the drawing matches the product: buffer empty; channelizing devices along the lane line through the work area.
- **A2-Q6** — CC's proposed replacement wording, all items, as written in `checkpoint-arc2.md` §6. The reference chips keep only the four verified. The drawing's label names no disabled kind.
- **A2-Q7** — callout in `--ink`, not `--act`.
- **A2-Q8** — existing button and input styles.
- **A2-Q9** — two new tokens (grid line, sheet ground); the grid stays.
- **A2-Q10** — the closing "Get notified ↑" is the outlined secondary style; one primary per screen.
- **A2-T** — type-size exceptions and R10's recorded motion exception as proposed; 9/9.5 px labels become 10 px.
- **A2-I** — draft a `gh issue create` body for the unflagged lane/shoulder width assumptions (Rule 10); Ryan posts it.

## Arc 3 rulings (Ryan, 2026-09-27, on the Claude Design canvas "Conestruct — Coming soon")

**R12 — The full page is `design/FullPage.dc.html`; the 404 is `design/NotFound.dc.html`.** Reference, not source: rebuild with workbench tokens and existing components; copy is verbatim from the artboards. The hero above section 01 is unchanged from what's live.

**R13 — The milepost road.** A road drawn down the left margin beside sections 01 → close, at 70% opacity, with a milepost at each section (01, 02, 03, 04, CO) and each stretch labelled with its zone word (advance warning, taper, buffer, work zone, downstream). Its stretch colours are `ZONE_COLOR`, used here as labelled decoration (extends R9). As the visitor scrolls, the road highlights from the top down, eased (no stepping), reaching the end of the road exactly at the bottom of the page. Below the highlight, the road fades to transparent, and the fade recedes as they scroll. No vehicle. Under `prefers-reduced-motion`: fully drawn, no fade, static. Hidden below 980 px. This extends R10's motion exception; record it.

**R14 — Milepost marker.** A small fixed box top-right ("MILEPOST 02 · taper" + its colour swatch) that appears once the visitor reaches 01 and updates per stretch. Desktop only (≥ 980 px).

**R15 — Sections 01–04 are "One Road":** 01 the pin → job → plan strip, then the three step texts; 02 the four outputs as paper stacks that **fan out on hover** (no transition under reduced motion; static on touch); 03 the taper-and-buffer detail with dimensions *below* the road and ONE note, "source cited in the audit", with three leaders; 04 the two cards with phone and laptop drawings, text vertically centred.

**R16 — Section headers are dimension lines:** each header rule ends in drafting slash ticks.

**R17 — Section 05, the founders note, verbatim:**
Headline "Ninety years of hard-won rules." Three paragraphs as in the artboard. Sign-off column headed "The founders": Ryan · Product & engineering; James · Go-to-market & pricing; Zac · Sales & customers. Section tag "a note from the founders".

**R18 — Closing band:** the drawn Colorado map (mountains hatched west of a dashed Front Range line, I-25, I-70, five cities, Denver pinned), "Built in Colorado", outlined "Get notified" mailto.

**R19 — 404:** "Road closed" page per `NotFound.dc.html`, drawn in the site's linework (outlined hatched barricade, outlined ROAD CLOSED sign, dashed DETOUR to home). Public, like `/`.

**R20 — FLOW.md §1:** delete the sentence "Does not know MUTCD." from the field sales rep (Ryan: it's false). No replacement text.

## Arc 3 checkpoint rulings (Ryan, 2026-09-27) — cite as A3-Qn

- **A3-Q1** — R17's third paragraph becomes: "It applies the manual to your road, shows the source for every taper, buffer and spacing, and leaves the calls that need experience to the people who have it." (Matches the hero and 02; the full-number claim waits on A2-I.) The canvas artboard is updated to match; the committed `design/FullPage.dc.html` is superseded on this one sentence only.
- **A3-Q2** — `/404` joins the gate's public paths. Unknown paths still go to `/`; pin both in the middleware table test.
- **A3-Q3** — The milepost marker shows under reduced motion too, updating per stretch with no transition.
- **A3-Q4** — The map's accessible label opens "Drawing of Colorado, not a road map…". Approved.
- **Heads-up acknowledged** — 03's heading "Every dimension has a source" stays (A2-Q6); it's revisited when A2-I lands.

Build straight through to the diff-verifier, then stop before ship. Put the ship line and post-ship legs in your report.

**R21 (Ryan, 2026-09-27)** — The four stacks in 02 must stay crisp while fanning, and each gets its own hover move, tasteful and quiet:
1. **The plan sheet** — current fan, plus the front sheet's taper devices appear one after another along the taper.
2. **The count and the quote** — sheets slide apart downward (no rotation); the orange amount bars fill left to right in turn, ending on the total bar.
3. **The audit** — back sheets shift slightly behind; the citation boxes beside each § row draw their outlines one by one.
4. **The crew sheet** — the stack lifts from the top edge like a clipboard; the four numbered squares fill in turn, 1 → 4. No ✓ (reserved for verdicts).
Each ≈ 300–400 ms, ≈ 40 ms stagger, ease-out; nothing outside the card moves (P1); touch shows the static stack; reduced motion: no animation. Extends R15 and the R10 motion record.

## Light-lane rule amendments (Ryan, 2026-09-27, approving the timing audit's §3)

Recorded here because CLAUDE.md and handoff.md are gitignored (`.gitignore:79`, `.gitignore:81`); the amended copies were handed over for Ryan to put in place.

**CLAUDE.md l.8**, append after "One arc per issue.":
> **Exception — the light lane:** cosmetic rounds on public pages (`/`, `/terms`, `/privacy`, `/404`; copy, layout, CSS or SVG only; no wire field, API route, middleware, gate, or scenario/audit/pricing logic) run without a checkpoint and without their own issue. They stop only if a ruling contradicts the code or a new factual claim can't be sourced; otherwise build with the recommended default and flag it at the top of the report. Procedure: handoff.md § Light lane.

**handoff.md**, add a **§ Light lane** section with the audit's §3 steps 1–8 and its "Still gates the ship" list, word for word.

**handoff.md l.52**, append: "Light-lane rounds run the light browser check instead (1440 + 390: status, sideways scroll, axe, target floors, contrast, page errors, crop of the changed region)."

**handoff.md l.57**, append: "A light-lane round has no checkpoint; if one stops anyway, its table covers only the changed surfaces."

**handoff.md "never" list**, add:
- No local production `next build` (this machine can't finish one; Vercel builds on ship).
- One dev server per session, killed by process tree at session end.
- No scratch browser run before the committed one on the same code.
- Local test runs cover the affected files; the verifier's full-suite run is the one that counts.
