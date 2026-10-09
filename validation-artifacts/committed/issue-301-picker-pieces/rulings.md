# issue-301-picker-pieces: the rulings this arc is built under

**Issue:** #301, "Picker modal migrates onto the WHERE band piece by piece — the aerial first (ruling
189)". Pieces 1 and 2 shipped 2026-09-26 (`validation-artifacts/committed/issue-301-band-aerial/`).
This arc is pieces 3 onward.

**Base:** `60bbe09` = `main` = prod (the R120 ship, SHIP VERIFIED 2026-10-09).

## R122 (Ryan, 2026-10-09), verbatim

> R120 accepted. Check both new lines on prod yourself instead of my browser check (picker line via a stale left side; refusal via a direct request), and quote what prod returns.
>
> #314 is posted (your R121 draft). execution-sequence.md is updated on disk: #301 is next, then #312.
>
> R122: start #301 (the picker modal moves onto the WHERE band, pieces 3+; ruling 189). Investigate first, with a 📋 checkpoint before code:
> - What's left of pieces 3+ on prod 60bbe09. R106–R108 already changed Step 2 and the suggestions, so list which pieces still apply, which R108 made moot (no confirm step for guesses), and which conflict with it.
> - The Rule 5 churn prediction and the P1–P22 check for what's left.
> - Proposed branches, one per surface, in ship order.
> No code until I rule.

The R120 prod check is recorded with the #300 arc: `issue-300-left-side-oneway/r120-prod/`.

## Carried in

**Ruling 189**, verbatim (`validation-artifacts/committed/issue-289-band-stack/rulings.md:40-43`):

> **189 the modal migration — phased.** Phase 2: the Where band owns the aerial and the
> outcome; the picker modal stays for the decision work (detection, candidates, bearing,
> cross-street, suggestions), opened from the band. It migrates piece by piece in Phase 3 and
> after. Nothing in the column's structure depends on the modal being gone.

**#301's piece list**, verbatim from the issue body:

> ### Piece 3 onward — the decision work, as ruling 189 orders it
>
> Ruling 189 keeps detection, candidates, bearing, cross-street and suggestions in the modal. Each later piece moves one of them with its own before → after and hand-check:
> - the road candidates;
> - road properties;
> - the near_intersection cross-street pin;
> - jurisdiction and street-class suggestions.

**#301's zoom ruling** (2026-09-26, `issue-301-band-aerial/rulings.md:214`), the clause this arc
reads: "Keep option (a) — no mapbox-gl on the band."

**R107 / R108 / R110** (2026-10-07, `validation-artifacts/committed/setup-what-redesign/rulings.md:8-27`):
Step 2 is the two-column WHAT band ("The road" / "The job"); guesses are prefilled and marked
"⚠ from the road" / "⚠ from the pin", with no confirm, dismiss or suggestion rows (R108); the
backend recomputes each guess (R110 Q1); never overwrite a value the operator set (R110 Q4); R108
governs the #279 road-type classifier too (R110 Q6).

## The ruling on the checkpoint

Not yet given. Ryan's ruling is appended here verbatim, and nothing is built until it lands.
