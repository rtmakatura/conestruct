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

S4. **Flagged, not changed: phone size.** (Superseded by Ryan's phone-crop ruling and S5 below.) At 390 px the drawing renders 338×121, and its labels are too small to read. The jpg it replaces had the same 2400×765 proportions. A narrow crop for phones, like the hero's `hero-plan-narrow.svg`, is an option for Ryan.

## Ryan's phone-crop ruling, 2026-10-18

"Continue issue-349-step3-art (e3250b6). Ryan's ruling: add a narrow phone crop of step3-plan.svg, the same way the hero uses hero-plan-narrow.svg. Below the hero's breakpoint, step 3 shows a tighter crop around the taper, buffer and work zone. Labels must be readable at 390 px (at least 11 px rendered). Keep the facts row matching what's shown. Re-run the 1440 and 390 browser checks. Record it as a ruling on #349. Don't ship."

S5. **R145 self-ruled: how the phone crop meets the 11 px floor.**
- **Cropping alone can't meet it.** The drawing's labels are 8.5 to 10 units. Taper through work zone spans 660 units, and the step 3 panel is about 338 px at 390. Any crop that keeps all three zones renders those labels at about 4 to 5 px. The hero's own narrow crop renders them at about 5 px.
- **So the crop re-sets its labels.** `design/landing-v2/step3-narrow.py` derives `step3-plan-narrow.svg` from `step3-plan.svg`:
  - viewBox `340 -62 760 342`: the arrow board, taper, buffer, work zone and taper-out.
  - The three dimension labels are re-set at 26 units (11.6 px at 390), on two rows so they don't collide: "L/3 50 FT" and "WORK ZONE 1,000 FT", then "BUFFER 200 FT".
  - The intersection and sidewalk flags, "E COLFAX AVE", "WILLIAMS ST" and all other small text are dropped, because none of it fits at 26 units. The panel head already names the road.
  - Everything else is the designer's, unchanged: road, lanes, cones, arrow board, zones, dimension lines and ticks.
- **The switch is the hero's.** It uses the same `lv-illus-wide` / `lv-illus-narrow` wrappers and the same `max-width: 720px` breakpoint (`app/globals.css:7683`, `:8520-8535`), so there is no new CSS.
- **The facts row is unchanged**, and it matches what the crop shows: taper 50 ft, buffer 200 ft, work zone 1,000 ft. The devices (43) aren't drawn to count in either drawing, as before.
- **Run 2:**
  - At 390 the narrow drawing is visible, 338×152, showing 3 texts, the smallest 11.6 px.
  - At 1440 the wide drawing is visible, unchanged; its smallest text renders at 8.2 px.
  - Both widths: axe 0, no small targets, no contrast failures, no page errors.
- **Flagged, not changed:** the wide drawing's 8.2 px labels at 1440 are the designer's sizing, also used in the hero. The ruling sets a floor at 390 only.
