# 📋 Checkpoint (scope only): Phase 4, the 380 arc — rules 168–169, #153, #280

Scoped on main `8f5e482`, 2026-10-12. No code, no build plan beyond the scope. R135: "Phase 4 (the
380 arc: rules 168–169, #153, #280): checkpoint only, so I can see the scope."

## Where Phase 4 comes from

- **`execution-sequence.md:7`** (on disk): "3. **Phase 4, the 380 arc** — rules 168–169, #153, #280."
  - **The file on disk is still the 2026-10-09 version.** Its header reads "Updated 2026-10-09". It
    has no "Phase 4 next" note and no "Waiting on a foreground session" list, so the update from the
    chat didn't reach it.
  - I haven't written to it.
- **"380" is the 380 px phone width** (#281's acceptance: 380×800 beside 1440×1000).
  - `FLOW.md:98`: "**Phase 4 — the 380 px arc.** After the shape is stable."
  - The rules are #281 comment 1, "160–179 THE 380 px ARC".
  - The CSS implements it as `@media (max-width: 480px)` (`globals.css:5216`, "Rules 160–174 · the
    380 arc").
- **Already shipped from the arc:** rule 167 (`403b482`), and rules 163/164/166/173 (`globals.css:5216-5260`).
  What's left is these four items.

## The four items

### Rule 168: the download row at 380 — superseded once, then deferred as if open

> "168. The download row collapses to one primary — "↓ ALL FILES (.ZIP)", 48 px — plus a "✓ 4 files
> ready" disclosure. The four cards do not render." (`issue-288-results-stack/rulings.md:396-397`)

- **#288 superseded part of it** (2026-09-21, `rulings.md:248-251`): "The zip button renders at BOTH
  widths … Rule 86's 'not rendered at 1440' and rule 168's 'primary at 380' are both superseded by
  clause 3's one derivation."
- **#288 also declined the disclosure** (`:420`).
- **#289 then deferred it anyway** (`issue-289-band-stack/rulings.md:459`): "Q7 rule 167 now, 168–169
  to Phase 4", and `:477`: "The 380 download cards … stay until Phase 4".
- **Today:** the zip renders at both widths from R103's single derivation (`OutputCards.tsx:252-286`,
  `results-primary.ts:28-53`). The four cards stack at 380 (`globals.css:3170-3180`).
- **What's actually left:** "the four cards do not render" at 380.

### Rule 169: the counts hero at 380 — half built, blocked on a second home

> "169. The counts hero goes to 2 tracks and the numerals to 42 px; the geometry cell is not rendered
> — its four rows are reachable in the reference disclosure." (`rulings.md:349-350`)

- **Built** (#288): the two tracks and 42 px numerals (`globals.css:3141-3153`).
- **Not built:** dropping the geometry cell. #288 recorded why (`rulings.md:358-365`): "Dropping it
  would take four measured values off the phone with no way to reach them (Rule 10)."
- **Still blocked:** the reference disclosure has no geometry rows. `zone_geometry` is read only by
  `ResultsHero.tsx`, `DeviceBreakdown.tsx:30` and `RevisionPanel.tsx:67-73`.
- **#288's README names #286 for the second home.** #286 is open and on no list.

### #153: small-viewport behaviour (OPEN, priority-low)

**What #281 already took:** option (b) "taken down to 380", and the 44 px phone floor, which is largely
built (rules 15/163).

**What's left, per its third comment:**
1. **The floor below 380:** an honest message or a degraded layout. Still a ruling.
2. **The plan sheet and the corridor map on a phone:** "which no phase covers".
3. **`scripts/verify-jbar-stability.mjs:32`** still tests `[1440, 1100]`, while the live checks
   measure 1440×1000 and 380×800. Its comment says to reconcile that "before Phase 4".
4. **The dead prior-art paths** in its body, to strike.
5. **Its acceptance:** "Supported sizes named in a doc" (DESIGN-SPACING.md names none today).

### #280: "Freeway / interstate" and the 380 two-line reserve (OPEN, priority-low)

- **The detected-vs-applied block it measured is gone** (§8.23). Its second comment: "re-measure
  against the WHAT band's provenance lines … Phase 4 owns the 380 reserve question … The domain-label
  half is disjoint from every redesign file and can run now."
- **The label is presentation-only:** the wire carries the key `"freeway"`.
- **Its consumers today:** four label maps (`detected-rows.ts:39-44`, `HandoffNotes.tsx:42-46`,
  `what-cells.ts:123`, `band-facts.ts:99`) and three gated forms' option arrays. The PDF says
  "freeway/expressway" (`audit.py:1385,1404`), and `provenance.test.ts:72-120` pins the string.
- **Its sequencing gate (#279) has shipped** (`7885395`).

## Things that cut across all four

- **380 vs 390.** Every recent screenshot set, mine included (R126, #316, #317, R133), is at
  **390**, from the light lane's convention in `handoff.md:73,91`. #281, #153 and Phase 4 specify
  **380**. The arc should name one phone width and use it everywhere.
- **The WHAT band has changed since #280's and the arc's measurements.** R126 and R128 reworked it,
  and #316/R133 added the cross-street speed row. Every 380 number has to be re-measured on the
  current page.
- **The tools exist:** `issue-289-band-stack/fidelity-audit/probe.cjs` (reusable per `handoff.md:73`)
  and the `issue-288-results-stack` probes. There's no Playwright test at 380 in the suite, and
  `verify-jbar-stability.mjs` doesn't cover it.

## Questions for scope

**Q1. Rule 168:** is it (a) done, because #288's single derivation superseded it and only the cards
remain, or (b) open, so the four cards stop rendering at 380? Recommend **(b), narrowed to the cards
only**.
- **What the phone shows instead:** a "4 files" line under the zip that names them.
- **Why:** the zip already carries every file, and the four stacked cards are the longest scroll on the
  phone results page.
- **Not reopened:** the declined disclosure.

**Q2. Rule 169:** is #286 (the geometry rows' second home) part of Phase 4? Recommend **yes, first**.
Without it the rule stays a declared deviation (Rule 10 forbids dropping the rows). Otherwise strike
the geometry half of rule 169 from the arc and record the deviation as final.

**Q3. #153's floor below 380:** (a) an honest "this page needs at least 380 px" message, or (b) the
380 layout degrading. Recommend **(a)**, per its own acceptance ("an honest message rather than a
degraded layout"). And the plan sheet and corridor map on a phone: in Phase 4, or a separate issue?
Recommend **a separate issue**; they're PDF and map work, not layout.

**Q4. The phone width:** recommend **380×800 everywhere**, matching #281.
- `verify-jbar-stability.mjs` goes to `[1440×1000, 380×800]`, done first.
- The light lane's 390 convention moves to 380.
- DESIGN-SPACING.md names both sizes (#153's acceptance).

**Q5. #280:** run the label half now, separately (its comment says it's disjoint), or inside Phase 4?
Recommend **inside Phase 4**, measured on the current WHAT band, because the reserve question and the
label are one decision.

## Rough shape, if ruled as recommended (for scale, not a plan)

1. **Phone sizes:** `verify-jbar` reconciled, the sizes named in the docs (#153 acceptance). Small,
   with no UI change.
2. **#153's floor message** below 380.
3. **#286, then rule 169's geometry cell** at 380.
4. **Rule 168's cards** at 380.
5. **#280:** measured, then the label decided.

Each is its own branch, with its Rule 5 prediction and screenshots at 1440 and 380. Items 2–5 are
frontend-only; item 1 is tooling and docs.
