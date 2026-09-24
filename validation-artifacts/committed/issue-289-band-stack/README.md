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
| 3 | **WHERE + WHAT + the generate frame (S1–S3)** — the first visible ship | **done** `b5de343` (+ fixes `5d198af`…`7b22aac`) |
| 4 | S4's lock states + the fact-line mount at the settle | **done** `6724c7f` (+ fixes `4e314aa`…`3647c06`) |
| 5 | S7 revision | **done** `fd86079` |
| 6 | evidence — prod legs at both widths | **done** S7: `9ddbea3` (`s7-prod/`); S1–S3, S5, S7: `74d96b7` (`fidelity-after/`); S4: `s4-prod/` (prod `8e2761e`, 2026-09-24; one delta open: no placeholder on a first Generate) |
| — | hand-check 2026-09-23 — two defects, one gap | **done** `b80bdeb`, `17b419b`, `67156f8`, `193faab`, `a04bd73` |
| — | the fidelity audit (165 deltas) and pass F1–F8 | **done** `7137a6f`, `85c865c`, `9e8c7bb`, `9dc1a14`…`403b482`; measured `74d96b7` (18 left, triaged) |
| — | the fidelity follow-up (S7 details, spinner, rule 165, gutter) | **done** `19076b3` |
| — | the strip reserve re-measured (80 / 57, landing 141 / 164) | **done** `9e28383`, `d41d410` |
| — | post-fidelity hand-check on `19076b3` — passes, two findings | **done** `d41d410` (recorded), `1d5cd58`, `7b88507` |
| — | #289's remaining acceptance and absorbed issues | **done** — see below |

Ryan's commit order, verbatim from the ruling: "rulings.md + checkpoint.md → WHERE + WHAT +
the generate frame (S1–S3, the first visible ship) → S4 lock states + the fact-line mount at
the settle → S7 revision → evidence. STOP after S1–S3."

### #289's acceptance, item by item

| acceptance | where it is met |
|---|---|
| Every S1–S4 and S7 state measured on prod at both widths | S1–S3, S5, S7: `fidelity-after/`; S7's four situations: `s7-prod/`; S4: `s4-prod/`, measured in flight at both widths. Rule 117 is met except the results placeholder: a first Generate shows the pre-Generate breakdown as a "Previous answer" (recorded, awaiting a ruling) |
| Exactly one band open; the rest fact or pending lines | `BandStack.one-open.test.tsx` (`3a2502b`) |
| A preview writes nothing — no band, no lock, no memo — payload level | `GeneratorShell.revision.test.tsx` (`dcb8ab4`, and the one-request cases) |
| Escape cancels with zero requests; APPLY the only writer; the sentence enumerates | Escape `39dd7ec`; enumeration `67156f8`; APPLY `fd86079` |
| 7b/7d blind-apply sentences; 7a quiet | `revision.test.ts`, `s7-prod/` |
| Jurisdiction field: three states, no skeleton, no height change | `3333846` (#276) |
| Every collapse/re-open lands counted; focus targets re-homed | `BandStack.landing.test.tsx` (`ce661e7`) |
| The picker modal still works; each moved piece named (§8.40) | WhatBand / WhereBand headers; picker suites green |
| #214 survives; #198 byte-identical; suggest-never-set green; live checks re-pointed | `WhatBand.detection.test.tsx`; `b5de343`; the suggest suites; #237 `a0f9753` |
| Ryan hand-check | 2026-09-23 (`rulings.md`), and post-fidelity on `19076b3`: passes (`d41d410`) |

| absorbed | disposition |
|---|---|
| #276 | built `3333846` — the words, no skeleton, the reserved line |
| #209 | WHAT grid with Phase 2; picker `43938a7` — 1–4, refusal not clamp |
| #215 | built `496ab0b` — every boundary labelled; markup tested at desk and ≤md |
| #234 | built `71d892c` — the intersection persists; fact line and picker read one label |
| #267 | built `db7571f` — widths relayed, the backend derives the plan's shoulder width |
| #277 | tested `7cf3743` — the grid mounts for every live kind |
| #235 A/B/C | superseded — #214's disclosure survives, restyled |
| #237 | built `a0f9753` — the zero-match throw, hooks, CI guard |

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
