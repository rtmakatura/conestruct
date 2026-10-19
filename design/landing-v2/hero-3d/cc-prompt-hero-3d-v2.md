# cc-prompt-hero-3d-v2.md: hero v2 on the landing-hero-3d branch

**Lane:** light lane. Continue on `landing-hero-3d` (`ccacd32`). Rebase it onto main first if main moved. **Do not ship.** Ryan reviewed `ccacd32` and asked for these changes before shipping.

## 1. Bring the files in
Copy `%USERPROFILE%\conestruct-captures\landing-2026-10-19\hero-3d-v2\` over `design/landing-v2/hero-3d/`, replacing `iso_hero.py`, `hero-iso.svg` and `hero-iso.css`, and add `ref-v2/` next to the old `ref/`. The canvas board is "Idea 2 v2". The screenshots in `ref-v2/` are the target:
- `01-rest-1440x900.png`: the whole hero at a 1440×900 laptop size
- `02`–`06`: each key active
- `07-card-closeup-2x.png`: the compact card with "50 ft" active

## 2. What Ryan changed, and why
1. **Glow is minimal.** One thin edge (`drop-shadow(0 0 1.5px …)`) on the active part. The large soft glow is gone.
2. **Clear hover zones.** The SVG now has one invisible hit polygon per zone (`class="hit"`, `data-k`): signs, taper, buffer, work zone (two parts across the break), intersection and closed sidewalk. While a key is active, its ground outline (`class="mark k-<key>"`, dashed with a light tint) shows, so it's clear what you're pointing at. Only `.hit` polygons and the two pins (`.fl`) take the pointer. Every other `.z` group gets `pointer-events: none`.
3. **No sticky hover.** In `ccacd32`, a part stayed active after the cursor left it, and moving straight to the next part didn't switch. Replace the per-group handlers with one handler on the `<svg>`:
   - `pointerover`: `key = event.target.closest('[data-k]')?.dataset.k ?? null`, and set it only when it differs from the current key;
   - `pointerleave` on the svg: clear the key.

   Zones touch edge to edge, so moving across them switches cleanly. The card buttons keep their own enter/leave and focus/blur.
4. **Shorter scene.** The flatter camera and lower buildings make the viewBox 1200×586 (was 724).
5. **Card inside the illustration.** The NEEDS YOU card moves into the figure, absolutely positioned at the top-left (`left: 20px; top: 20px; width: 330px`) over the scene's empty corner. Below 1100px it goes back to normal flow above the drawing. The hero's top row becomes two columns: eyebrow and headline on the left, the paragraph and both CTAs on the right, aligned to the bottom (see `ref-v2/01`). Keep both existing lines under the CTAs ("Pick a job you've already permitted…" and the fine print "drafts for review by a certified tcs or pe…"). The canvas mock left them out for space, but the page keeps them.
6. **Compact card.** The flag rows and stats use 9px × 14px padding, the titles 13.5px, the meta lines 10px, the numbers 19px. The stats row sizes each cell to its content (`grid-template-columns: auto auto auto`) with 1px dividers. Stat labels are one line: `devices`, `taper · 6b-4`, `buffer · 6b-2`. The card's hint line moves into the caption: `… FROM THE OCT 17 RUN · POINT AT THE CARD OR THE ROAD`.

Phones keep the flat narrow drawing, unchanged.

## 3. Generator fix
The Windows crash on "▲" from your last report is fixed: `iso_hero.py` now writes the SVG with `encoding='utf-8'`. Regenerate with `python iso_hero.py hero-iso.svg` and check the output equals the delivered SVG. Update the provenance test.

## 4. Keep, re-check
- Every device still comes from the source record, and the camera change didn't move any device. Re-run `tests/test_landing_hero_devices.py` against the new SVG; update its parsing if the projection constants changed, not the expected feet.
- Add a test that every `data-k` value is one of the 5 keys and every key has at least one `.hit`.
- Colour tokens: add the new ones, same as before.
- Rulings from the first pass still stand.

## 5. Checks before you report
- **1440×900 viewport:** the card and the whole scene are visible together without scrolling past the figure's bottom edge. Screenshot it.
- **Hover sweep at 1440:** move the pointer along the road from the signs to G20-2 in small steps, then off the svg. Log the active key at each step. It must switch zone to zone without ever getting stuck, and clear on leave. Do the same from the card rows across to the scene.
- Screenshot each key active, matching `ref-v2/02`–`06`.
- 390: the phone hero is unchanged. axe clean, no page errors, no contrast failures.
- vitest, tsc, lint, pytest clean. diff-verifier PASS. CI green.

## Report
The sha, the screenshots, the hover-sweep log, and the test results. End with the `result:` line.
