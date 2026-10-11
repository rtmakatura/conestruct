# r126-step2: the rulings this arc is built under

**Base:** `issue-301-cross-street-entry` at `e47b926` (stacked: that branch ships first). Prod is
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

## The ruling on the checkpoint: R127 (Ryan, 2026-10-10), verbatim

> R127, the R126 checkpoint rulings:
> - Q0: D3 is now at design-refs/SpeedD3.dc.html. It's WhatC5 with R126's changes; its Speed marker reads "⚠ from the road" on one line. Ignore its Carriageway buttons; keep the existing carriageway control and change only the label (R107).
> - Q1: (b).
> - Q2: Yes.
> - Q3: Yes.
> - Q4: Yes, "Urban street".
> - Q5: Once dates are set, the same one footer line shows the windows check's result in the backend's words (e.g. "Denver windows · ✓ fits your dates" or "⚠ ..."). Propose the exact strings in the build report.
> - Q6: Yes.
> - Q7: Yes, and the plan sheet's notes box also gets one line when the speed is guessed: "Speed guessed from the road class. Confirm the posted speed on site."
> - Q8: Yes. Draft that issue for the chat to repost.
> - The 20 mph option: add it in this arc.
> Build r126-speed-guess, then r126-step2-layout, in that order. Each reports before ship with screenshots at 1440 and 390 on N Cherry St (39.71740, -104.93380) and one tagged road.
>
> Cross-street flag: draft an issue for the WHERE fix (the side control says "Mark the cross street on the map to lay out the sides", with the Mark on map button, #315-style). The chat will repost it. I'll send the ship for issue-301-cross-street-entry as its own message after your next report.

**On the record:**
- **D3** is copied unchanged into `design-refs/SpeedD3.dc.html` beside this file. The repo root's
  `design-refs/` copy is untracked.
- **D3 and R110 Q8:** D3 shows no marker on Hours or Speed reduction, while R110 Q8 ruled "✓
  default" on both. That belongs to `r126-step2-layout` and is raised in that branch's report. It
  doesn't touch `r126-speed-guess`.
