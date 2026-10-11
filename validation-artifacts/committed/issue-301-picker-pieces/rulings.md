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

## The ruling on the checkpoint: R123 and R124 (Ryan, 2026-10-09), verbatim

> The stale-left issue is posted (find it on gh by its title: "A stale left side empties the side control...").
>
> R123, #301 rulings:
> - Q1: Yes. Remove the road-properties panel from the modal; WHAT is the one place those facts are edited.
> - Q2: Move the road-class speed estimate to WHAT's Speed row as a ⚠ line, and keep a "Use N mph" button there. Nothing is prefilled; the operator's click sets it, and the audit records the speed as estimated from the road class and chosen by the operator.
> - Q3: Yes. Candidates stay in the modal. #301 closes after these three branches, with "the modal is the map" (pin, road pick, cross-street pin) as the end state.
> - Q4: Yes. Add a "Mark on map" button to the dead-end line.
> Build the three branches as proposed. Branches 1 and 3 run in the light lane; branch 2 reports before ship with screenshots at 1440 and 390.
>
> R124, the stale-left issue: option (a). Investigate first, with a 📋 checkpoint before code: the Rule 5 churn and the exact response shape.
>
> Ship order: issue-301-modal-cleanup, then the stale-left fix, then issue-301-road-properties, then issue-301-cross-street-entry. Report after each build.

**On the record:**
- The stale-left issue is **#315**. R124 is recorded again, with its own arc, in
  `validation-artifacts/committed/issue-315-stale-left/rulings.md`.
- **R123 Q2 adds backend scope to branch 2.** "The audit records the speed as estimated from the road
  class and chosen by the operator" needs a fact on the wire, so `issue-301-road-properties` is no
  longer frontend only. Its churn is predicted again before that build (`handoff.md:114`: scope a
  ruling adds gets its own churn row).
- **Branch 1 leaves the P16 pulse bar alone.** The checkpoint listed it as optional, and a visible
  change doesn't belong in a behaviour-preserving cleanup. It stays recorded in `checkpoint.md` §1.

## R126 (Ryan, 2026-10-10, after the road-properties browser check), verbatim

> Road-properties browser check passed: it works, but Step 2 looks bad. New ruling below. Hold the Rule 10 issue draft I asked for; R126 covers it.
>
> R126 (supersedes R123 Q2's "Use N mph" button): Step 2 matches the D3 mockup.
> - Speed: on a road with no posted speed, prefill the road-class estimate like R108's guesses, marked "⚠ from the road" (one line). The audit and PDF record it as guessed from the road class, not confirmed by the operator. This replaces the scenario's default speed entirely: no more silent 65 mph shown as "✓ yours". If the road has no class either, Speed reads "◌ not set" and the plan can't be generated until it's set.
> - Remove the ⚠ estimate line and the Use N mph button.
> - One marker per row (Lanes shows one, not "✓ yours ✓ default").
> - Rename the labels: "Speed limit" becomes "Speed", and "Divided highway" becomes "Carriageway" per R107. Drop "i about".
> - Fold Denver windows into the footer line beside File details ("Denver windows · set dates to check").
> - The header counts speed among the guesses: "N guesses marked ⚠ · change any that are wrong".
> - Investigate: on N Cherry St (39.71740, -104.93380) Road type guesses "Urban arterial" while Street class guesses "Local". Find out which is wrong and why.
>
> Investigate first, with a 📋 checkpoint before code: backend vs frontend ownership (Rule 3), every work kind the old default reached, the audit and PDF wording, the Rule 5 churn, and the P1–P22 check. The estimate now drives tapers and sign spacing without a click, so show which roads get which speed.
>
> Meanwhile, build issue-301-cross-street-entry (R123 Q4, light lane) with the prod_rp evidence as its first commit, and report with the go.
>
> If this is a foreground session: in CLAUDE.md's suggest-never-set line, after the R108 exception, add "R126 (ruled 2026-10-10) adds speed: on a road with no posted speed, the road-class estimate is prefilled and marked "⚠ from the road", recorded the same way." If it's a background job, say "needs a foreground session".

**On the record:**
- **R126's build is its own arc** (a checkpoint first). This branch, `issue-301-cross-street-entry`,
  builds R123 Q4 only.
- **The CLAUDE.md line needs a foreground session.** This is a background job, so the edit is not
  made here.
