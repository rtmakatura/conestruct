# Setup box + Step 2 redesign: rulings

Ryan, 2026-10-07, from `cc-prompt-setup-what-redesign.md` (copied whole as `prompt.md`). Quoted verbatim.
The mockups Ryan picked are copied unchanged into `design-refs/` (`SetupB.dc.html`, `WhatC5.dc.html`).

R106: The Setup box after Generate becomes the title-block layout in `design-refs/SetupB.dc.html`. It's a boxed grid of label/value cells with mono caps labels, and Road spans two cells so it doesn't wrap. Every cell is a button with the target it has today. Unset values read "◌ not set".

R107: Step 2 (WHAT) becomes the two-column layout in `design-refs/WhatC5.dc.html`: The road on the left, The job on the right, and the label (with its marker under it) beside each control. Every control is 44 px tall. Segmented controls split their width evenly (this fixes the empty gap after "Arterial"). The labels shorten to Street class, Carriageway (One-way / Divided), Hours and Speed reduction.

R108: No confirm step for guesses. Street class (from the road) and jurisdiction (from the pin) are prefilled like Road type already is, each marked "⚠ from the road" / "⚠ from the pin", and the operator changes them if they're wrong. There are no confirm, dismiss or suggestion rows. The header reads "N guesses marked ⚠ · change any that are wrong", with N counted from the actual guesses.
- The audit must say each guessed value's source and that the operator didn't confirm it (Rule 10). A guess the operator changes, or leaves as is, keeps that record honest.
- If the pin has no jurisdiction guess, the field stays "◌ not set", as today.
- This supersedes the confirm/dismiss parts of R100 and any earlier ruling that requires confirming a suggestion. List each ruling it overrides in the checkpoint.

R109: Investigate first, with a 📋 checkpoint before code: what R108 changes in the backend (Rule 3: does the backend or the frontend decide that a suggestion becomes the value?), what it changes in the audit and the PDF, the Rule 5 churn prediction, and the P1–P22 principles check. Then one branch per surface, in the order R108 + R107 → R106. Each report gets screenshots at 1440 and 390.
