# r126-step2: the rulings this arc is built under

**Base:** `issue-301-cross-street-entry` at `9df9525` (stacked: that branch ships first). Prod is
`cf13836`.

## R126 (Ryan, 2026-10-10), verbatim

Recorded first in `validation-artifacts/committed/issue-301-picker-pieces/rulings.md` (on
`issue-301-cross-street-entry`); quoted here as this arc's authority.

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

## Carried in

- **R108 / R110** (`validation-artifacts/committed/setup-what-redesign/rulings.md:10-27`): guesses
  are prefilled, marked, and recorded with the raw fact they came from; the backend recomputes
  each one (Q1); never overwrite a value the operator set (Q4); "prefilled from the road" when
  nothing is guessed (Q5); Lanes' two markers (Q7); Hours and Speed reduction "✓ default" (Q8).
- **R123 Q2** (superseded by R126): `speed_estimate`, `input_estimates`, Use N mph (shipped
  `cf13836`).

## The ruling on the checkpoint

Not yet given. Appended here verbatim when it lands; nothing is built before it.
