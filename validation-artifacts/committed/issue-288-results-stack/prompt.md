# s2-arc33 investigate — #288 Direction A Phase 1: the results stack (S5, S6, S8)

Context: prod tip `018165e`; confirm healthz against `git rev-parse HEAD` yourself. Phase 0: #283 shipped (nine sizes + role 5), #282 shipped (preview flag), #256 closed; #279 in its tiebreaker and **not a dependency of this phase**. Design authority: **#281** (Part 1 in the body, Part 2 rev. 2026-09-16 as comment 1 — cite as "#281, comment 1, rule N"), FLOW.md, DESIGN-PRINCIPLES.md P1–P22, INVENTORY.md, and #288's body with its "Rulings carried" and "Absorbs" lists. Branch `issue-288-results-stack` off `main`; **first commit = `rulings.md`** quoting #288's carried rulings verbatim. Investigate first; 📋 checkpoint; no code beyond probes. **Principles table P1–P22 with the FLOW.md step and user per surface — required.**

## Plain English

After Generate, the screen should answer one question: "did it work, and what does it want from me?" Today it answers "here is everything the system knows." Phase 1 rebuilds the results area as Direction A's stack — verdict, then NEEDS YOU as the heaviest block, then the two counts the estimator prices from, then the four files, then everything that passed folded behind counted disclosures. It re-presents data we already have; it builds no new classifier and no new backend. It is the fix for what made the demo painful.

## What this phase replaces and what it keeps (Part 1 §8, by number)

**Replaces:** the results head and next-steps strip (§8.29), the intro paragraph (§8.30), section 03's presentation (§8.9 — the five tiers stay, the tiered-reference component's shape goes), the zone headings in the results area (§8.28), the sheet meta on screen (§8.32 → nav citation, static, no date).
**Keeps unchanged in behaviour:** the verdict strip (§8.2), the working band (§8.3), the refusal container (§8.4, moved up), the corrections block's staging contract (§8.5 — it becomes NEEDS YOU's item rows), the counts hero (§8.7), the download cards (§8.6 except ruling 182/183), the stale ribbons (§8.8 + rule 102), the quote panel (§8.11), the draft notice (§8.12), the announcement region (§8.13).
**Does not touch:** the setup panel, rail, picker, strip — Phase 2's.

## Investigate

### 1. The data is already there — prove it
Map every value the stack renders to the wire field that carries it today: the verdict and pill (`StatusBar`'s derivation), NEEDS YOU's items (the ▲ and ⚠ rows of `assignTiers` in `lib/tiering.ts:160` ⟷ `src/rendering/tier_ledger.py`, plus the corrections block's five condition rows and the two manual keys), the counts (`deviceBreakdown`), the four cards (`BUNDLE_PART_KINDS`), the passed/pending/reference disclosures (the ✓ ◌ i tiers), the quote. Any value with no wire field is a finding — this phase mints none. Confirm the five-tier ledger is the one sorter and that lifting ▲/⚠ into NEEDS YOU is a re-grouping of the same facts, not a second classification (P2; #281's "five-tier ledger is given").

### 2. The stack's structure against Part 2
Rules 27–28 (gaps, the reserved first row), 50–55 (verdict strip, incl. the S7 clause — not this phase), 72–79 (NEEDS YOU), 80–83 (counts hero), 84–86 (cards; ruling 182/183 overrides 86), 87–89 (disclosure rows), 100–102 (ribbons), 114, 117, 119, 120, 125–129 (states S4 placeholder, S5, S6, S8). For each rule: the component that satisfies it, existing or new, with file:line where existing. Rule 7's type role 5 is not used in this phase (no step question in the results); say so. Every text node maps to a `tr-*` role, an owned exception from #283, or is a finding.

### 3. The primary (rulings 182/183)
"The primary is the next step": NEEDS YOU's actions when it has items; "↓ All (.zip)" when it has none; same at 380. Map how NEEDS YOU's count reaches the download row's treatment (one derivation, tested), what "primary" means in CSS for each (the `.pri` control, rule 130; the `.act` control, rule 133), and the S6 case (DECLINED: Retry is primary, nothing else renders — #258's discipline, unchanged).

### 4. NEEDS YOU's contract
It absorbs the corrections block whole (§8.5): the staging contract, the Apply row's standing sentence, the disabled-at-zero button with its reason, the dismiss picker's always-mounted note field, "results disclose rather than lock" — all verbatim. Then it adds the ▲/⚠ tier rows as items with their actions (DISMISS/KEEP, CORRECT IN SETUP, ACKNOWLEDGE — rule 77). Say what "ACKNOWLEDGE" writes — if nothing exists for it on the wire, it is a finding, not an invented write. Ruling 185: the header count is the sum, the decomposition is provenance. Ruling 186: always expanded. Rule 78: the Apply row is the last data line.

### 5. The disclosures and the supervisor's view (S8)
Rules 87–89, 125–129: the reference disclosure expands downward in place; the five uncounted sub-disclosures; TRACE (#286 — backend-first, **not this phase's blocker**: rule 6.4's TRACE rows render only what the audit carries today, and the formula fields land when #286 does — say what renders now); the scope paragraph verbatim; read-only signposts, no buttons (rule 129 — the corrections sentinel test moves with it).

### 6. The landing and the reserved row (rulings 184, 193; #250/#271 machinery)
The results stack forms under the collapsed setup at the settle. The reserved first row (rule 28) stops it moving; `armLandingCheck()` lands it. Map: what the landing target becomes when the results head is gone (the formula from #250: `nav-h + 8 + status-h + 24` — does `status-h` still name the verdict strip? yes; say so), whether the settle displacement (#281 Part 1 §7.2) is absorbed by the reserved row, and what the arc-28 harness legs measure now (re-point per #237's rule: a suite matching zero nodes fails loudly).

### 7. The three absorbed issues' acceptances (#288's list)
- #272 → heading/row left-edge ink equality ±1 at both widths, every heading-over-row pair; no glyph clipped; the reserved first row holds at the settle.
- #264 results half → rule 15 page-wide **including the footer** (`AppFooter.tsx:8-13`, padding not visible size); TARGETS probe 0 under 32 px at 1440 / 44 px at 380; axe `target-size` 0 at 380 (retires the two named pre-existing findings).
- #259 → rule 102: the ribbon is not dimmed; ≥ 4.5:1 measured mid-flight on the composited surface; the "inside the dim" count recorded, not asserted.
- #212 harness half → the `pageerror` listener lands first, disjoint; the nav citation is static text with no date (§8.32).

### 8. Contracts
#198 (no `.sys-event` string changes; the corrections block's strings byte-identical) · rail untouched (Phase 2's) · suggest-never-set (only the enumerated writes: Dismiss/Assert/Confirm/Undo/Apply/Acknowledge-if-real) · the write-lock declarations (`data-write`/`data-read` on every new control; the honesty test extends) · spec 31 (no band + refusal co-frame) · the five-tier ledger is the one sorter · expectation-JSON pin, snapshots, containment, backend, wire: **0** — frontend-only; prove it · citation counter 19 · `getByText` direct text nodes · Rules 3/10/12/13 · P1–P22.

## Checkpoint questions
a. The value→wire map: any value with no field?
b. Component plan per rule: which existing components carry over as-is, which restructure, which are new (expect: the stack container, the NEEDS YOU shell, the disclosure row; expect the corrections block, counts hero, cards, ribbons, verdict strip to carry over).
c. The primary derivation and its test.
d. ACKNOWLEDGE — what it writes, or that it is a finding.
e. The landing target and the reserved row under the new stack; which arc-28 legs re-point.
f. What TRACE renders before #286 lands.
g. Rule 5 churn: which tests retire with the results head / strip / section-03 presentation, which transform, which arc-19/20/23/25 live-check legs re-point; the 380 axe baseline (expect the two named findings to retire under rule 15).
h. Principles table.

## Output
📋 plan: the value→wire table · the rule→component table · the primary derivation · NEEDS YOU's contract · the disclosures · the landing · the four absorbed acceptances restated · contracts · commit sequence (each shippable; `rulings.md` first; the `pageerror` listener and the nav citation as small early commits; then the stack; then NEEDS YOU; then disclosures + S8; then evidence at both widths in S5/S6/S8) · churn table · Principles table. Stop at the checkpoint.