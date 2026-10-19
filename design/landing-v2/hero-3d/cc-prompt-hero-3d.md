# cc-prompt-hero-3d.md: the 3D hero for the landing page

**Lane:** light lane (`/` only: markup, CSS, SVG, one small component). Branch from `main` (`e8ee3d7` or later). Build and preview; **do not ship.** Ryan reviews the preview, then says `ship <branch>`.

## 1. Bring the files in
Copy `%USERPROFILE%\conestruct-captures\landing-2026-10-19\hero-3d\` into the repo as `design/landing-v2/hero-3d/`. Confirm these arrived:
- `iso_hero.py`: the generator. `python iso_hero.py hero-iso.svg` rebuilds the SVG. It's the source of truth for the drawing.
- `hero-iso.svg`: the generated drawing (1200×724 viewBox, ~73 KB).
- `hero-iso.css`: the highlight and linking rules from the approved canvas.
- `ref/01-rest-1440.png` … `ref/05-devices-linked.png`: what each state should look like.
- this prompt.

## 2. What changes on the page
**Desktop hero (at and above the hero's existing 720px breakpoint):**
- Replace the current wide hero drawing with `hero-iso.svg`, inlined, so its groups can be styled and hovered.
- The moving cars and their animation CSS go away completely. If nothing else uses the Motion B keyframes after that, remove them.
- Caption, left: `E COLFAX AVE EASTBOUND · SHOULDER WORK · FROM THE OCT 17 RUN`. Right: `DISTANCES TO SCALE ALONG THE ROAD · WIDTHS EXAGGERATED`.

**Phones (below the breakpoint):** keep today's flat narrow drawing (`hero-plan-narrow.svg`) exactly as it is. Ryan ruled the 3D scene is desktop only until the platform-wide mobile pass.

**Everything else on the page stays as it is.**

## 3. Linking, both ways
One piece of state, the focused key: `int | walk | taper | buffer | dev | null`.
- **Card → scene (exists today):** hovering or focusing a card row or number sets the key.
- **Scene → card (new):** pointer enter on any SVG group with `data-k` sets the key; pointer leave clears it. The groups are mouse-only. Keyboard users already reach every key through the card buttons.
- **Scene:** while a key is set, `svg.hero-iso` carries class `f-<key>`. `hero-iso.css` dims the other parts to 0.16 (roads and buildings to 0.5) and glows the focused part.
- **Card:** the matching row or number shows its active state (`data-on="1"`): rows get a 3px yellow inset bar, numbers get a 2px orange underline. See `ref/02-…` to `ref/05-…`.
- No motion is involved, so `prefers-reduced-motion` needs nothing new.

## 4. Accuracy (the reason this exists)
Every device in the drawing comes from the source record `validation-artifacts/committed/landing-source-run/README.md`. Check the SVG against it and add a test that parses `hero-iso.svg` and asserts:
- taper: 3 drums (25 ft apart) and the arrow board (caution mode) at the taper start;
- buffer: 3 cones;
- work zone: the 18 cones are 58.8 ft apart, and the drawing shows the 9 that fall outside the break (600–1,100 ft is cut and labelled "500 FT NOT SHOWN");
- downstream taper: 2 cones;
- sidewalk: 2 Type III barricades, each with an R9-9, at the two ends of the work zone;
- signs: W20-1, W20-2 and W21-5aR at 300, 200 and 100 ft before the taper, plus G20-2 at +1,400 ft.

Record these as rulings in the issue's `rulings.md`:
- **Left-side sign set omitted.** The plan places a second set on the left only because it reads Colfax as divided (#350).
- **G20-1 and G20-5P not drawn.** The plan gives them no station.
- **Williams St placement:** about 90 ft into the work zone, from "work starts 90 ft W of Williams Street" (log-1440).
- **Widths across the road are exaggerated.** Distances along the road are to scale.

Edit `iso_hero.py` only to fix a real mismatch with the source record. Regenerate the SVG with it; don't hand-edit the SVG. Say what you changed.

## 5. The flat drawings (same branch)
Steps 1 and 3 use the flat drawings from `design/landing-v2/illus.py`. Their device counts are decorative (6 taper / 4 buffer / 21 work-zone cones). Change the device loops so they show 3 drums, 3 buffer cones, 18 work-zone cones and 2 downstream cones, spaced evenly in each segment. Regenerate `step1-plan.svg`, `step3-plan.svg` and `step3-plan-narrow.svg`, and keep every label as it is. The README's "drawings differ" row then becomes "match".

## 6. Checks before you report
- Browser at 1440 and 1280: the hero renders and matches `ref/01`. Hover each card row and number, then each scene part (arrow board, a buffer cone, a sign, the intersection pin, a barricade), and screenshot both sides lighting together.
- At 390, the phone hero is unchanged (byte-identical SVG).
- axe clean, no page errors, no contrast failures. The SVG keeps its `role="img"` and `aria-label`.
- Page weight: report the hero's added bytes (inline SVG ~73 KB before gzip).
- vitest, tsc and lint clean. diff-verifier PASS. CI green.

## Report
Branch and sha, the screenshots, the device-count test result, the rulings, and anything in `iso_hero.py` you had to change. End with the `result:` line so Ryan can ship it.
