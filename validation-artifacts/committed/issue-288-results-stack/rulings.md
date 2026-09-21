# issue-288-results-stack — the rulings this arc is built under

**Ruled by Ryan, 2026-09-21**, in chat, on the Phase 1 checkpoint. Quoted verbatim below.
This file is the arc's authority: every commit on this branch cites it. Filed as this arc's
**first** commit, per the per-arc rulings convention adopted 2026-09-16.

**Issue:** #288 — "Direction A Phase 1 — the results stack (S5, S6, S8)". **Phase:** 1
(of #281 Direction A). **Priority:** high. **Labels:** enhancement, priority-high,
frontend, ux, p18, p19.

**Base:** `7885395` (= `main` = `origin/main` at the time of this commit).

---

## The ruling, verbatim

> #288 rulings — all eight as recommended, with the constraints below written into
> rulings.md.
>
> a. Every value on the stack has a wire field, as you mapped. Anything you flagged as
> missing renders nothing (Rule 10) — this phase mints no field.
> b. Component plan as tabled: verdict strip, working band, refusal container, corrections
> block (as NEEDS YOU's item rows), counts hero, cards, ribbons, quote, draft notice carry
> over; the stack container, the NEEDS YOU shell, the disclosure row are new. Section 03's
> tiered-reference component retires as a shape; its five tiers and its disclose-never-writes
> contract transfer.
> c. One derivation for the primary — NEEDS YOU count > 0 → its actions; else "↓ All (.zip)"
> — tested once, read by both surfaces, same at 380.
> d. ACKNOWLEDGE: if the wire carries nothing for it to write, it does not render as a
> button. The item shows with its provenance "surfaced, not auto-applied" and no action — an
> honest item without a control beats a control that writes nothing. Record it as a finding
> for #289 (revision mode may give it a real home).
> e. Landing target = nav-h + 8 + status-h + 24 with status-h naming the verdict strip; the
> reserved first row absorbs the settle displacement; every arc-28 leg that touched the
> results head re-points, zero-match fails loudly.
> f. TRACE renders exactly what the audit carries today, labelled; formula fields arrive with
> #286 and the rows widen then, nothing invented meanwhile.
> g. Churn as tabled; the two 380 axe findings retire under rule 15 or you say why not.
> h. Principles table accepted; every surface names its FLOW.md step and user.
>
> GO. rulings.md first; then the pageerror listener and the static nav citation as small
> early commits; then the stack; then NEEDS YOU; then disclosures + S8; then evidence in
> S5/S6/S8 at both widths, output outside the repo, bundle poll before every frontend leg.
> Stop after the stack lands with the verdict (the voice change), then after evidence with
> the ship line. Frontend-only — prove it.

---

## The second ruling, verbatim — 2026-09-21, after the first stop point was proposed

> Stop point 1 accepted. Continue through NEEDS YOU, the disclosures and S8, then evidence.
> Two standing rules for the remaining commits:
>
> - Anything you find that would change a #281 rule (not just a churn prediction) stops the
> arc with a checkpoint; I rule before it's built. Anything that's a finding but doesn't
> change a rule goes in the README and you keep going.
> - The evidence run is at both widths, S5 with three NEEDS YOU items, S5 with zero (the
> "↓ All (.zip)" primary), S6 declined, S8 with the reference open. Output outside the repo;
> bundle poll before every leg; sha-gated both ends. No ship while a leg is running.
>
> Stop with the verdict and the ship line.

### The record correction this file makes against its own ruling

"Stop point 1 accepted" was given on a stack that **had not been built**. At the moment of
that ruling this branch held exactly one commit — `15ca57a`, this file — and the message it
answered was a 📋 plan checkpoint for the two *small early commits* that precede the stack,
ending in a request to approve commit 2's scope. The stack, the verdict voice change, NEEDS
YOU, the disclosures and S8 did not exist and do not exist as of this commit.

Recorded here rather than silently accepted, per the standing caution **"don't read a report
for the arc you expect — read it for the arc it is"**. The ruling's two standing rules are
adopted in full and govern every remaining commit; what is not adopted is the premise that
the arc had reached its first stop point.

### The evidence matrix, as ruled

Five legs, each at **1440×1000 and 380×800**:

| leg | state |
|---|---|
| 1 | S5 with **three** NEEDS YOU items |
| 2 | S5 with **zero** NEEDS YOU items — the `↓ All (.zip)` primary (clause c) |
| 3 | S6 declined |
| 4 | S8 with the reference disclosure open |
| 5 | (the above at the second width) |

Output **outside the repo**. Bundle poll before every leg — healthz proves the backend sha
only and this arc is frontend-only. Sha-gated both ends. **No ship while a leg is running.**

### The finding rule

- A finding that **would change a #281 rule** → **stop the arc with a checkpoint**; Ryan
  rules before it is built.
- A finding that **does not change a rule** → goes in the arc README; the build continues.

---

## ⚠ THE CHECKPOINT THIS RULING ANSWERS IS NOT IN THE RECORD

**Read this before acting on clauses a, b, e, g and h.**

Five of the eight clauses adopt an artifact by reference rather than by content:

| clause | the phrase | what it points at |
|---|---|---|
| a | "as you mapped" | a wire-field map, per stack value, with a flagged-missing set |
| b | "as tabled" | a component table — carried over / new / retired |
| e | — | the arc-28 legs that touched the results head, enumerated |
| g | "as tabled" | a churn table, plus "the two 380 axe findings" |
| h | "accepted" | a principles table, per surface, with its FLOW.md step and user |

**None of those five tables exists on disk, in git, or on the issue.** Searched
2026-09-21 before this commit:

- no file matching `*288*` in the repo or any worktree (only `.ruff_cache` hash collisions);
- `git grep "#288"` across `main`, `docs-287-phase0-complete`, `docs-issue-citations`,
  `issue-279-classifier`, `s2-triage-2`, `s2-ui-inventory` → **zero tracked files**;
- no `#288` in `validation-artifacts/committed/s2-triage-3/findings.md`;
- `gh issue view 288` → **0 comments**;
- the only mentions anywhere are `handoff.md:21`, `handoff.md:53` and `memory.md:82`, all
  three untracked.

Per Rule 10, absence of signal renders as absence: this file does not reconstruct those
tables, because a reconstruction would read as the checkpoint's content while being this
file's guess. Rule 12 says the same in the other direction — a table that looks reasonable
is not evidence it is the table that was ruled on.

**What this blocks.** Clause **c**, **d** and **f** are self-contained and can be built from
the text above plus #288's body. Clauses **a**, **b**, **e**, **g**, **h** cannot: each
names a specific set whose membership decides the diff. The checkpoint must be committed
into this directory as `checkpoint.md` **before the first implementation commit**, and this
file amended with a pointer to it. Until then the five clauses are adopted-in-principle and
unverifiable in practice — the diff-verifier has nothing to check them against.

This notice is not a request to re-rule. The ruling stands as quoted; what is missing is the
document it adopts.

---

## Independently anchored — verified in this repo at `7885395`

These are the parts of the ruling that #288's own body corroborates, checked by opening the
files rather than by trusting the issue text:

| ruling clause | anchor, verified |
|---|---|
| b — "section 03's tiered-reference component retires as a shape" | `conestruct/site/components/TieredReference.tsx`, 744 lines |
| b — five tiers transfer | `conestruct/site/lib/tiering.ts`, `assignTiers` at :160, mirrored by `src/rendering/tier_ledger.py` (#288 body) |
| c — the primary derivation | `conestruct/site/lib/next-steps.ts`, 131 lines; rulings 182/183, overriding §8.6/7.5 |
| e — the results head | `conestruct/site/components/ResultsHead.tsx`, 94 lines; `GeneratorShell.tsx:1320-1344` |
| g — rule 15 page-wide including the footer | `conestruct/site/components/AppFooter.tsx`, 18 lines, no `min-height` (#264's verification, re-checked) |

`ResultsHead.tsx`, `TieredReference.tsx`, `lib/next-steps.ts`, `GeneratorShell.tsx` and
`AppFooter.tsx` all exist at the paths #288 names. No path in the reference list is stale.

---

## The build order, as ruled

1. **`rulings.md` first** — this commit.
2. The `pageerror` listener (#212's harness half) and the static nav citation (§8.32) as
   small early commits.
3. The stack. **Stop with the verdict** — the voice change.
4. NEEDS YOU.
5. Disclosures + S8.
6. Evidence in S5/S6/S8 at both widths (1440×1000 and 380×800), **output outside the repo**,
   bundle poll before every frontend leg. **Stop with the ship line.**

**Frontend-only — prove it.** No backend file in the diff; the proof is the diff, not the
claim. Rule 5: churn predicted before the diff, not explained after it.

## Standing constraints this arc inherits

- Rule 10 — this phase **mints no wire field**. A value without a field renders nothing.
- Rule 11 — test where the bug lives: rendered-output and mounted-flow, not pure functions.
- Rule 3 — no frontend computation of a value the backend owns; clause f holds TRACE to what
  the audit carries today, with #286 widening the rows later.
- `healthz` sha == `git rev-parse HEAD` **and** the served bundle polled — healthz proves the
  backend sha only, and this arc is frontend-only.
- Nothing ships without Ryan's explicit go.
