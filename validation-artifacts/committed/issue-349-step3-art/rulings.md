# #349: step 3's plan image (landing page only)

## Ryan's ruling, 2026-10-18 (the `/start 349` message)

"Scope cut from Ryan: this session fixes only the landing page. Replace design/landing-v2/public/colfax-plan-dark.jpg in step 3 with an image that shows no median and no "DIVIDED HIGHWAY" (use the step1-plan.svg drawing style, or propose an option at the checkpoint). Split the backend sample-sheet bug ("DIVIDED HIGHWAY", "Untitled Project") into a new issue that doesn't block the landing ship. Re-word #349 to match. Don't ship."

## Self-rulings

S1. **R145 self-ruled: step 3 uses the designer's own drawing, uncropped, not a new one.**
- `design/landing-v2/step3-plan.svg` is `step1-plan.svg` with two changes: viewBox `370 128 780 150` became `0 0 1200 430`, and its three pattern ids were renamed `step1` → `step3`, so both drawings can sit on one page without duplicate ids. Nothing else differs.
- The drawing was already approved for the page. It draws E Colfax with a double yellow centerline and no median. Its dimension bar matches the facts row below it: L/3 50 ft, buffer 200 ft, work zone 1,000 ft.
- `illus.py` was not re-run. The committed SVGs don't match its current output byte for byte, so regenerating from it would have changed the designer's drawing.

S2. **Static.** The new `<svg>` has no `.plan` class. The spotlight and motion rules are scoped to `.plan.mC` (`app/globals.css:7698-7712`), so step 3 doesn't animate.

S3. **The jpg leaves the site.** `conestruct/site/public/landing/colfax-plan-dark.jpg` had one reference, step 3, and it is deleted. The designer's source copy `design/landing-v2/public/colfax-plan-dark.jpg` stays, as the record of what was replaced. The "Download the sample plan" button stays hidden: the sample sheet's backend bug is split out into its own issue.

S4. **Flagged, not changed: phone size.** At 390 px the drawing renders 338×121, and its labels are too small to read. The jpg it replaces had the same 2400×765 proportions. A narrow crop for phones, like the hero's `hero-plan-narrow.svg`, is an option for Ryan.
