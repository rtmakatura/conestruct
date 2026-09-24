# issue-289-band-stack — Direction A Phase 2

**Issue:** #289 — "Direction A Phase 2 — the band stack (S1–S4) and revision (S7)".
**Authority:** `rulings.md` (this directory) — #289's carried rulings, Ryan's ruling of
2026-09-22, and the R1–R9 dispositions. **Checkpoint:** `checkpoint.md`. **Probe:**
`prototype/`.

## State of the arc

| step | what | state |
|---|---|---|
| 1 | `rulings.md` — the carried rulings, filed first | **done** `8f843e3` |
| 2 | `checkpoint.md` + the landing probe | **done** `1c130b4` |
| — | Ryan's ruling: GO, rule 124 overridden, R1–R9 resolved | **done** `97d790f` |
| 3 | **WHERE + WHAT + the generate frame (S1–S3)** — the first visible ship | **done** (this commit) |
| 4 | S4's lock states + the fact-line mount at the settle | not started |
| 5 | S7 revision | not started |
| 6 | evidence — prod legs at both widths | not started |

Ryan's commit order, verbatim from the ruling: "rulings.md + checkpoint.md → WHERE + WHAT +
the generate frame (S1–S3, the first visible ship) → S4 lock states + the fact-line mount at
the settle → S7 revision → evidence. STOP after S1–S3."

---

## What the S1–S3 ship changed

Pre-generate, the setup panel is gone and the column is the surface. Post-generate is
**untouched** — the setup strip and the results stack are exactly what Phase 1 left, because
the post-generate surface belongs to step 4 of the order above.

### The column, row by row

| row | S1 (no pin) | S2 (pin, no confirmed road) | S3 (road confirmed) |
|---|---|---|---|
| verdict strip | unchanged | unchanged | unchanged |
| WHERE | **open**: kind chips · address + PICK ON MAP · manual fallback · project details | **open**: the same, plus the move ledger, the extent field with the corridor's five zone rows, the handoff notes, CONFIRM | collapsed: `✓ Where …… <road> · <extent> · <kind>` [CHANGE] |
| WHAT | `◌ What's the job? …… kind of work, extent, side · pending — find the work first` | `◌ … road facts prefill from <road>` | **open**: the 3 × 2 grid, each cell over its own provenance line; the street class and its suggestion slot; the schedule; the kind's own fields |
| GENERATE | the framed primary, disabled, with its reason | the same | the same, enabled when nothing blocks |
| draft notice | unchanged | unchanged | unchanged |

### The four deviations, each with its reason

Recorded here because a deviation nobody wrote down is a defect nobody can find.

1. **No aerial in the WHERE band** (ruling 189's first clause). There is no aerial component
   outside `LocationPickerModal.tsx`'s 3,293 lines; rule 14 forbids a placeholder bar in its
   place; and `lib/corridor-map.ts`'s static-image builder names a route
   (`app/api/corridor-map/route.ts`) that **does not exist**. The band owns the OUTCOME — the
   ledger, the extent, the kind, the road's provenance — and the modal keeps the map, which is
   the migration ruling 189 phases. Full reasoning at the head of
   `components/bands/WhereBand.tsx`.
2. **A pin opens WHAT; the CONFIRM press does not have to.** Part 1 §2.3 collapses WHERE on
   the confirm, because in Part 1 that press confirms a kind the system PROPOSED. This phase
   has no proposal producer — #281's own audit ruling — so a mandatory confirm would be a
   confirmation of a decision nobody made. The button stays; Phase 3 gives it back its
   proposal. Reasoned at `lib/scenarios/band-facts.ts`, `deriveBands`.
3. **The kind chips sit above the pin, not below the move ledger** (§2.2's order). The kind is
   upstream of the pin because it decides the picker's capture flow — `near_intersection` asks
   for a second pin — and the setup panel's own comment said so. Below the ledger the kind
   would be unreachable until after the capture it governs.
4. **The GENERATE row is always the frame, never a pending fact line** (§2.1 item 5). #260
   ruled, with a browser leg behind it, that the disabled primary's `cta-reason` alert is the
   ONE live region carrying the gate sentence. A pending line in its place unmounts the only
   speaker and leaves the column saying "pending" without saying why.

### R7, still unruled and now visible

`--nav-h` is 52 px and rule 21 says 48. Proceeding under the stated assumption (52 stays,
rule 21 is the wrong number) because every arc-28 landing leg and every `scroll-margin-top` in
`globals.css` is measured against 52, and the checkpoint probe was too. It inverts on a word,
at the cost of re-measuring every landing leg.

---

## The local render, and the three things it caught

`s1-s3-local/` — a probe, not the evidence leg, and it says so in its own header. It walks
S1 and S3 at both widths on a `next dev` build and measures what a suite cannot see:
**0 pageerrors, 0 targets under rule 15's floor at either width, role 5 at 22/19 px, six
44 px cells each with a provenance line, one step tag on screen.**

It caught three things the 1,227 green tests did not:

1. **The verdict strip was below the band stack.** §1.2 puts it second in source order in
   every state. Moved, and the gap set to rule 26's 18 px (it was 24 — a figure that
   predates Part 2).
2. **Eight sub-floor targets inside the column**, every one a carried surface rather than the
   band's own — including the suggestion slot's Confirm / Dismiss at 24 px, under the floor
   at BOTH widths. Floored; re-measured at zero.
3. **Panel step numbers with nothing behind them** — `STEP 4` / `STEP 5` / `STEP 6` tags
   beside a column that counts to four. Dropped.

Full table and method in `s1-s3-local/LOCAL.md`.

## Findings

1. **Rule 68 was violated by this arc's own first draft, and this arc's own sentinel caught
   it.** `deriveMoveLedger`'s extent row offered neither a link nor a provenance word when the
   extent was set. `BandStack.single-voice.test.tsx` asserts the invariant on the MODEL rather
   than on a render, which is why it fired on an input no rendered case covered.
2. **`#289` is valid hex.** The `≤480px` comment I added inside #258's no-new-hex window
   matched `/#[0-9a-f]{3,6}\b/i` and failed the scan-refusal guard — the same trap the
   neighbouring "Issue 288" comment was written to avoid. Now spelled "Issue 289" there, with
   the reason.
3. **`atScrollEnd` cannot read an unlaid-out document.** R8's reachability predicate made
   every arc-28 unit test a no-op, because happy-dom reports `scrollHeight` 0 and "0 − 768 ≤ 0"
   reads as "the page cannot scroll". Guarded: no layout, no layout conclusions.
4. **`lib/corridor-map.ts`'s header names a consumer that does not exist.** Not fixed here —
   it is a comment about a route, and deleting or building the route is its own commit.
5. **`GeneratorSidebar` shed 21 of its 22 Tailwind size utilities** with the panel's section
   components. The census records the drop; the two that MOVED are declared in the files they
   moved to.
6. **R9's measurement holds on the real surface.** The WHERE fact line renders 60.00 px at
   1440 and 97.56 px at 380 — against rule 56's stated 44. The prototype predicted 60.00 /
   130.63 for #281's own longer S5 string.

---

## Churn, as predicted and as it landed

The checkpoint predicted 35 unit files. **51 tracked files changed, 11 new, 7 deleted**, and
the suite went 134 failures → 0 (1227 tests, 152 files).

| group | disposition |
|---|---|
| `DetectedVsApplied.{confidence,lanes,oneway}` | **transferred as facts** — they read `deriveDetectedRows` directly now; every clause assertion is unchanged |
| `DetectedVsApplied.test` → `WhatBand.detection.test` | **re-pointed** to where the clauses render |
| `DetectedVsApplied.{layout,slot}` | **retired as layout**, with the reason in the commit |
| `ProgressRail.single-voice` → `BandStack.single-voice` | **transferred** — the sentinel now covers the fact lines and the move ledger |
| `ProgressRail.test` | **retired**; `lib/scenarios/rail.test.ts` is untouched, which is the point |
| `rail-single-source` | **rewritten for rule 139 as it now stands**: the blocker string reaches the surface exactly ONCE, and a second surface would now be the defect |
| `prepin-gating`, `fact-strip`, `jurisdiction-band`, `corridor-bar` | **transferred as facts, retired as layout**, each with its reason in the file |
| ~20 mounted suites | **re-pointed** through `components/__fixtures__/band-helpers.ts` — the column keeps one band open, so reaching a control in another is a click on its fact line, exactly as a user does it |

`lib/scenarios/rail.test.ts` needed no edit. That was the prediction and it held.

---

## Live checks (#237) — zero matches fail loudly

#237's defect was a helper that selected the rail's Generate entry by name
(`.first()`) and, when its real target was absent, read an empty list as "0 checked". As
checkpoint.md §G.2 scoped it, the fix is this phase's, once, here:

- **`live-check.cjs`** — `one` (exactly one, or throw), `some` (one or more), `hook`
  (`[data-testid="…"]`, exactly one), `nonEmpty` (an in-page list that came back empty
  throws). `node --test live-check.test.cjs` proves the throws against a fake page.
- **The three live rigs** — `fidelity-audit/probe.cjs`, `strip-reserve/measure-strip.cjs`,
  `fidelity-after/measure-gutter.cjs` — select the band controls through `hook()`
  (`where-open-picker`, `kind-chip-shoulder`, `where-confirm`, `generate-plan`,
  `setup-link-speed`) and pass their collected lists through `nonEmpty()`. The picker's
  own controls stay by accessible name: a click on a missing control already times out
  loudly, and the modal is ruling 189's to migrate.
- **A declared hook for Generate** — `data-testid="generate-plan"` on `GenerateButton`, so no
  probe finds it by a name another control could share.
- **The older legs stay as they are.** The 85 files under `validation-artifacts/committed/`
  that select the setup panel, rail, strip or zone headings (arc-1 … arc-32, s2-arc1 …
  s2-arc32) are committed evidence of finished runs against a surface that no longer
  exists; they are not re-pointed.
