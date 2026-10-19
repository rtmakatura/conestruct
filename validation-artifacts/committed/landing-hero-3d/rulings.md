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

---

# Hero v2 (Ryan's review of `ccacd32`)

The prompt is `design/landing-v2/hero-3d/cc-prompt-hero-3d-v2.md`, delivered 2026-10-19 with the v2 generator, SVG, canvas CSS ("Idea 2 v2") and `ref-v2/`. The rulings of the first pass still stand. F3 above is resolved by Ryan's generator fix.

## Ryan's rulings, 2026-10-19 (the prompt's §2 and §3, word for word)

> 1. **Glow is minimal.** One thin edge (`drop-shadow(0 0 1.5px …)`) on the active part. The large soft glow is gone.
> 2. **Clear hover zones.** The SVG now has one invisible hit polygon per zone (`class="hit"`, `data-k`): signs, taper, buffer, work zone (two parts across the break), intersection and closed sidewalk. While a key is active, its ground outline (`class="mark k-<key>"`, dashed with a light tint) shows, so it's clear what you're pointing at. Only `.hit` polygons and the two pins (`.fl`) take the pointer. Every other `.z` group gets `pointer-events: none`.
> 3. **No sticky hover.** In `ccacd32`, a part stayed active after the cursor left it, and moving straight to the next part didn't switch. Replace the per-group handlers with one handler on the `<svg>`:
>    - `pointerover`: `key = event.target.closest('[data-k]')?.dataset.k ?? null`, and set it only when it differs from the current key;
>    - `pointerleave` on the svg: clear the key.
>
>    Zones touch edge to edge, so moving across them switches cleanly. The card buttons keep their own enter/leave and focus/blur.
> 4. **Shorter scene.** The flatter camera and lower buildings make the viewBox 1200×586 (was 724).
> 5. **Card inside the illustration.** The NEEDS YOU card moves into the figure, absolutely positioned at the top-left (`left: 20px; top: 20px; width: 330px`) over the scene's empty corner. Below 1100px it goes back to normal flow above the drawing. The hero's top row becomes two columns: eyebrow and headline on the left, the paragraph and both CTAs on the right, aligned to the bottom (see `ref-v2/01`). Keep both existing lines under the CTAs ("Pick a job you've already permitted…" and the fine print "drafts for review by a certified tcs or pe…"). The canvas mock left them out for space, but the page keeps them.
> 6. **Compact card.** The flag rows and stats use 9px × 14px padding, the titles 13.5px, the meta lines 10px, the numbers 19px. The stats row sizes each cell to its content (`grid-template-columns: auto auto auto`) with 1px dividers. Stat labels are one line: `devices`, `taper · 6b-4`, `buffer · 6b-2`. The card's hint line moves into the caption: `… FROM THE OCT 17 RUN · POINT AT THE CARD OR THE ROAD`.
>
> Phones keep the flat narrow drawing, unchanged.
>
> The Windows crash on "▲" from your last report is fixed: `iso_hero.py` now writes the SVG with `encoding='utf-8'`. Regenerate with `python iso_hero.py hero-iso.svg` and check the output equals the delivered SVG. Update the provenance test.

## Checked

- **The camera change moved no device.** `tests/test_landing_hero_devices.py` passes unchanged against the v2 SVG: the same feet for every device. It reads the projection from `iso_hero.py` itself, so the flatter camera needed no parsing change.
- **Provenance.** `iso_hero.py` reproduces the delivered `hero-iso.svg` (C2PA block aside). The provenance test now runs `python iso_hero.py <out>` with a bare environment (no `PYTHONUTF8`). Red proof: the first-pass generator fails it on this machine (`UnicodeEncodeError: 'charmap' codec can't encode character '▲'`).
- **Keys.** A new test checks four things: every `data-k` is one of the 5 card keys; only `.hit` polygons and the two `.fl` pins carry one; every key has a hit zone; and the zone counts are dev 4, walk 2, int 1, taper 1, buffer 1. A mounted test (`Landing.test.tsx`) checks the same keys in the rendered page.

## Self-rulings

S7. **R145 self-ruled: the hit zones' `#000` is a token.** The ink gate allows no hex outside the token blocks, and the plan-art script refused 3-digit hexes. `--iso-hit: #000000` joins the `--iso-*` tokens, and the script now maps 3-digit hexes through the same table, so an unmapped one still stops it.

S8. **R145 self-ruled: phones read "POINT AT THE CARD".** The hint moves into the caption as ruled. Phones keep the flat drawing, which has no hover zones, so below 720 px the caption drops "OR THE ROAD".

S9. **R145 self-ruled: the scene's pointer stays mouse-only**, as in the first pass. Keyboard users reach every key through the card buttons, and a touch on a zone doesn't leave a key set.

S10. **R145 self-ruled: the type census follows the compact card.** The census rows change to `.lv-flag-title` 13.5px, `.lv-flag-meta` 10px and `.lv-stat-num` 19px, and the `.lv-hint` row goes. The census pins go 196 → 195 declarations and 36 → 35 sizes, because 26px had only the stat number. Each size the card now uses was already in the sheet.

S11. **R145 self-ruled: the card's transitions and the scene's fade stay in the landing's no-preference block**, as in S3. The canvas CSS's `.hv` and `.ring` rules are left out: v2 has no rings, and the pins' cursor comes from `.z.fl`.

## Flagged, not changed

F5. **At 1440×900 the figure's bottom is below the fold at load.** The figure (card, scene and caption) is 592 px tall, so once scrolled to, it fits in one screen with the card and the whole scene together. At load it starts at y 479, and its bottom edge is 172 px below the fold. The canvas mock fit because it left out the two lines under the CTAs. The page keeps them as ruled, which makes the right column, and so the top row, taller (`01-rest-1440x900-at-load.png`). Fitting at load would need one of three things: dropping or moving those lines, a smaller hero top padding (96 px at 1440), or a smaller scene. Each one is Ryan's call.


## The lean page (cc-prompt-lean-page.md, 2026-10-19)

The prompt and its files are in `design/landing-v2/lean-page/` (the canvas `ref/LeanPage.canvas.html`, three reference shots, the three step SVGs and `lean-motion.css`). Light lane, no checkpoint. The items below are where the prompt and the code disagreed, or where it left a choice. Each is flagged for Ryan.

L1. **Flagged: no sample plan download exists.** The prompt says each file tile "is a link to the existing sample plan download". There is none. #350 (open) holds the download until the Colfax sheet is confirmed, and `Landing.test.tsx` asserts "Download the sample plan" is absent. Built default: `SAMPLE_HREF = null` in `Landing.tsx`. "See the audit in the sample plan →" and "Download the sample plan ↓" are not rendered, and the four tiles are plain cards with no link and no hover (Rule 10: an absent file renders as absent). Setting `SAMPLE_HREF` once #350 closes turns on the links, the `.ft` hover and the `download` attribute together.

L2. **Flagged: the problem notes have no URLs to link.** The prompt says the notes "link to the same source URLs the current section 02 cites". Section 02 cited plain text only (`denver doti pwpt-121.2`, `aurora tcp instructions`), and the repo holds no URL for either. Built default: the note line is plain text, word for word from the canvas. No URL is invented.

L3. **Flagged: the kind-of-work code was never in the submission or the emails.** The wire value is the plain name (`lib/contact/validate.ts` `KINDS`), and `lib/contact/emails.ts` prints `Kind of work: ${s.kind}`. The TA / S-630 notes were only on the page. They come off the page, and nothing in the payload or the emails changes.

L4. **R145 self-ruled: the waitlist form stays visible, under the pilot link.** A hidden waitlist behind a "Not ready? Join the waitlist" toggle broke the #346 test "the waitlist refused: the same inline error" (`findByRole` skips hidden content). The prompt says a broken #346 test means the form changed too much. So the email field and button show under the pilot link, and the label keeps the shipped copy "Not ready? Get one email the day it opens."

L5. **Flagged, legal-adjacent wording that the mock changes:**
  - The hero's second fine-print line "conestruct doesn't stamp or approve plans" goes, per the prompt. The trust row says it again: "Conestruct doesn't stamp or approve plans".
  - "What it won't do" goes with the sources section, per the prompt. Its "It won't promise approval. That's the city's call." is not restated anywhere on the page.
  - The trust row's review line is new wording, word for word from the mock.
  - Unchanged: the footer line, the Terms and Privacy links, and "used only to draft your comparison".

L6. **R145 self-ruled: tokens, not hexes.** The ink gate (#263) bars hexes in components. The step pictures' and the tile hover's colours map to existing tokens where one matches exactly. Seven `--lv-sheet-*` tokens and `--lv-tile-hover` / `--lv-tile-kind-hover` are new. The step 2 check mark uses `--lv-ok`, an alias of `--lv-work` (#3fd3a8), so it carries that token's open INK_RESERVED flag.

L7. **R145 self-ruled: the scroll-in replaces D.** The old CSS scroll-driven reveal (`.reveal`, `.rule-draw`) is gone. The lean motion lives in the landing's no-preference block. The hiding class is `.js-anim` on `.lv-outer`, not on `html`, so every selector in that block stays a landing one (`motion.test.ts`). `motion.test.ts` now lists the five new keyframes, and it allows `lv-draw` to move `stroke-dashoffset`, which is paint only and moves no layout.

L8. **R145 self-ruled: the existing scale, not the mock's.** The mock's 40 px / 700 section heads and 96 px padding are drawn at the canvas size. The page keeps `.lv-h2` (clamp 28–36, 600) and the section padding clamp(56px, 6.5vw, 88px), per "keep the existing design tokens, spacing system and components".

L9. **R145 self-ruled: the form's placeholders follow the mock.** Name, Company, Work email and City have no placeholder. Side reads "e.g. south side", and Length keeps its "ft" unit, now with no placeholder. Phone and the note keep theirs.

## Ryan's rulings before the ship (2026-10-19)

F5, resolved by ruling. "Measure the figure at 1440×900 at load. If its bottom edge is below the fold, cut the hero top padding from 96px to 56px and measure again." Measured with `measure-f5.cjs`, results in `light-<sha>/f5.txt`:
  - On the lean page with 96 px of top padding, the figure spans y 407–1000, so its bottom is **100 px** below the fold. That is already 72 px better than the 172 px on hero v2, because the lean hero dropped the CTA note.
  - With 56 px of top padding (`clamp(48px, 7vw, 56px)`, so only widths of 800 px and up change), it spans y 367–960, so its bottom is **60 px** below the fold.
  - The figure still doesn't fit at load. The other two options from F5, a smaller scene or moving more lines, weren't ruled, so nothing more changed.

L10. **Ryan's ruling: "It won't promise approval. That's the city's call." is restored word for word.** It is the last sentence of the trust row's review line, and `Landing.test.tsx` "the legal lines stay word for word" pins it. This closes the second item of L5.
