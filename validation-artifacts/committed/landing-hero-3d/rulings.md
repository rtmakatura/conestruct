# Landing hero in 3D (light lane, `/` only)

The prompt is `design/landing-v2/hero-3d/cc-prompt-hero-3d.md`, delivered 2026-10-19 with the generator, the SVG, the canvas CSS and five reference shots. This round has no issue of its own (light lane), so its rulings live here.

## Ryan's rulings, 2026-10-19 (the prompt, word for word)

"**Phones (below the breakpoint):** keep today's flat narrow drawing (`hero-plan-narrow.svg`) exactly as it is. Ryan ruled the 3D scene is desktop only until the platform-wide mobile pass."

"Record these as rulings in the issue's `rulings.md`:
- **Left-side sign set omitted.** The plan places a second set on the left only because it reads Colfax as divided (#350).
- **G20-1 and G20-5P not drawn.** The plan gives them no station.
- **Williams St placement:** about 90 ft into the work zone, from "work starts 90 ft W of Williams Street" (log-1440).
- **Widths across the road are exaggerated.** Distances along the road are to scale."

## Checked against the source record

- Every device in `hero-iso.svg` matches `validation-artifacts/committed/landing-source-run/README.md`, "Where each device sits in this run". `tests/test_landing_hero_devices.py` reads the SVG and maps each drawn device back to feet along the road. It checks:
  - the taper's 3 drums at 0, 25 and 50 ft, and the arrow board's 5-lamp caution bar at −20 ft;
  - 3 buffer cones, 50 ft apart, between +50 and +250;
  - the 9 of 18 work-zone cones that fall outside the 600–1,100 ft cut, at 250 + 58.8k ft, and "500 FT NOT SHOWN";
  - 2 downstream cones, 25 ft apart, between +1,250 and +1,300;
  - 2 Type III barricades at +250 and +1,250, with one R9-9 face drawn from the front and one from the back;
  - W20-1, W20-2 and W21-5aR at −300, −200 and −100 ft, and G20-2 at +1,400 ft.
- Williams St is drawn 320–360 ft from the taper start, so its centre (the intersection pin, x = 340) is 90 ft past the work zone's start at +250.
- **`iso_hero.py` is unchanged.** It found no mismatch with the source record. Its output equals the delivered `hero-iso.svg` once the SVG's C2PA `<metadata>` block is set aside, and the test pins that equality.

## Self-rulings

S1. **R145 self-ruled: the Motion B keyframes stay.** The phone hero (`hero-plan-narrow.svg`) still draws the moving cars and blinking arrow board, and it stays as it is. The desktop scene has no cars and no `mB` class, so nothing animates on desktop.

S2. **R145 self-ruled: the scene's colours are workbench tokens.** The ink gate (#263, `lib/design/ink-literals.test.ts`) fails any hex outside the `:root` / `.workbench` token blocks. `scripts/landing-plan-art.mjs` swaps each of the scene's 58 new hexes for an `--iso-*` token in the `.workbench` block. The 8 shared with the flat drawings keep their existing tokens. The canvas CSS's glow colours use `color-mix()` on `--dim` and `--warn`, and the card's active state uses `--lv-hover`, `--warn` and `--dim`. The canvas's `.bub`, `.xh` and `.drawing-wrap` rules are left out: the scene has no such elements.

S3. **R145 self-ruled: the scene's fade sits in the landing's no-preference block.** The canvas CSS put the opacity/filter transition outside any motion query. The site keeps every landing transition inside `@media (prefers-reduced-motion: no-preference)`, so this one goes there too. Under reduced motion the scene dims and glows without the fade.

S4. **R145 self-ruled: the phone caption stays.** The desktop caption's right side reads "DISTANCES TO SCALE ALONG THE ROAD · WIDTHS EXAGGERATED". Below 720 px the flat drawing is still not to scale, so its caption keeps "ILLUSTRATION · NOT TO SCALE".

S5. **R145 self-ruled: `illus.py` keeps the canvas counts behind a switch.** Section 5 changes the device loops to the run's 3 / 3 / 18 / 2. The phone hero is ruled unchanged, so `illus.py` takes `devices='canvas'` for its old 6 / 4 / 21 / 2. With that switch it still reproduces `hero-plan-narrow.svg` byte for byte. Its `__main__` now writes `step1-plan.svg` and `step3-plan.svg` (it wrote a test page before). The regenerated SVGs equal what the old loops made, except for the cone groups and their `--i` indices, and they no longer carry the C2PA block. Every label is unchanged (19 / 19 / 3 text elements, identical).

S6. **R145 self-ruled: `HERO_WIDE` leaves `plan-art.ts`.** Nothing renders it now. `design/landing-v2/hero-plan.svg` stays as the record of the replaced drawing.

## Flagged, not changed

F1. **The work truck.** The scene parks a work truck in the work zone (`iso_hero.py:419-427`). The plan doesn't place one. It is scenery, not a traffic control device, and the prompt allows `iso_hero.py` edits only for a mismatch with the source record. Ryan can rule it out.

F2. **The flat drawings' drums.** Step 1 and step 3 draw the taper's 3 drums with the same cone mark as every other device. The drawings have no legend, so the mark doesn't claim a device type. A drum mark would be a new design element.

F3. **`iso_hero.py` on Windows.** `python iso_hero.py hero-iso.svg` crashes on a cp1252 console: `write_text` has no `encoding=` and the labels carry "▲". Run it with `PYTHONUTF8=1`. Not changed, because the prompt limits edits to source-record mismatches.

F4. **The cursor.** The canvas CSS gives the scene's linked groups `cursor: pointer`. They aren't clickable. It's kept as approved.
