# #412 — centre the four selection ● marks alike

Mission `form-marks` (#413). Branch `issue-412-select-mark-centre`, base `origin/mission-pm-prod-check` (`525c2e4`, carries the #407 production-check evidence).

## Plan (5 bullets, before the diff)

1. **Problem.** The segmented toggle's ● is an absolute `::before` at `top: 0` of the inline `.a-seg-label` (`conestruct/site/app/globals.css:4894-4904` at base). `top: 0` is the top of the inline span's content area, and the absolute box lays the glyph out in its own line box below that, so the ● lands 1.65 px below the label's x-height middle (measured, below). The side chip's ● (`components/bands/WhereBand.tsx:352`), the kind chip's `::after` and the dismiss-reason glyph (`components/NeedsYouConditions.tsx:441`) sit on their label's baseline and measure −0.12 to −0.36 px.
2. **Rulings.** Ryan 2026-10-25 (#407: one selection mark, ●, on all four controls); P11 (looks alike everywhere), P1 (pressing moves nothing), P4 (the kind label keeps the citation's left edge), Rule 13 (glyph channel, AA floor measured), Rule 5, Rule 12.
3. **Change.** One vertical rule for all four: the ● sits on its label's baseline, in the label's font. Three already do. The segmented `::before` leaves absolute positioning and hangs in the text flow as an inline-block (`width: 2em; margin-left: calc(-1 * 2em); text-align: right`), so the line advances by 0 and the centred label doesn't move; `.a-seg-label { position: relative }` (only there for the absolute mark) is deleted.
4. **Rule 5 churn prediction.** `globals.css`: the segmented `::before` rule (4 declarations swapped), the `.a-seg-label` rule deleted, the L2/#407 comment updated. `lib/design/walkthrough-l2-css.test.ts`: the segmented test amended (in flow, zero net width) and one new test (no selection mark is lifted out of the flow or shifted on its own). Stated behaviour change: the segmented ● moves up about 2 px (from 1.65 px below the x-height middle to within 0.5 px of it), 0 px sideways; every label on all four controls moves 0 px; the other three marks move 0 px; control sizes unchanged; hue and ground unchanged, so contrast unchanged. Byte-identical: every backend file, every TSX file, every other CSS rule, the ink and type censuses.
5. **Proof.** Red-on-base vitest (`red-proof.txt`); Playwright pixel probe at 1440 and 390, before and after (`measurements.json`, raw `measurements-before.json` / `measurements-after.json`); before/after shots of each control at both widths.

## Calls

1. **R145 self-ruled — the centre reference.** The ●'s ink centre is compared with the label's x-height middle, found by pixel: the label's words are swapped for x's of the same length (same font, same line) and the band is the ink that disappears when the label is made transparent. On the dismiss-reason chip the label is uppercased (`text-transform: uppercase`), so the x's render as X's and the band is the cap-height band: an all-caps label has no x-height, and the cap band is the body every letter there fills. The issue's stated reference otherwise.
2. **R145 self-ruled — the primary metric is the ink-weighted centroid** (mean row weighted by ink), with the extent centre ((top+bottom)/2) recorded beside it. The extent moves in half-device-px steps with the ink threshold; the centroid doesn't. Both agree on the direction and size of the fix (extent: +1.5 → −0.5 px; centroid: +1.65 → −0.35 px).
3. **CHOSEN — tolerance 0.5 CSS px** on each control's offset, and the four offsets within 0.5 px of each other: 1 device px at DPR 2, the smallest step the raster can show. After: −0.36, −0.35, −0.36/−0.35, −0.12 px (max |0.36|, spread 0.24). Pass.
4. **CHOSEN — ink threshold > 24 summed channel levels** for the pixel diffs: separates glyph ink from rasterisation noise; not load-bearing for the centroid.
5. **CHOSEN — the hang box is 2em wide.** Any width at least the "● " advance (about 0.9em) gives the same placement, because the box is right-aligned and its negative margin cancels it. 2em leaves room if the font falls back. The ● lands where `right: 100%` put it: measured 0 px sideways at 1440 and 390.
6. **R145 self-ruled — one rule, no nudge.** The issue says "don't nudge the toggle alone". A per-control `top` offset would hold for one font size only. Putting the ● on the label's baseline is the rule the other three already follow, and the new test fails if any of the four rules gains `position: absolute`, `top`/`bottom`, `vertical-align`, `transform`, `font-size` or `line-height`.
7. **The dismiss-reason chip was measured on an injected copy.** The real chip renders only after a live site-scan hit, so the probe injects it where NeedsYou mounts (inside `.zone.results`) with NeedsYou's element chain (`section.needs-you > ul.ny-items > li.ny-item.ny-sub.site-correction-picker > .ny-mid > .sc-picker > fieldset > label.reason-chip.chosen`), as #407's repair-1 probe did. Its sources are unchanged by this diff, and its shots are of the injected copy.
8. **A measurement artefact, recorded.** At 390 the side chip's mark row moves −0.5 px between runs. This is raster snapping, not a change: the page scrolled the chip to y 399.63 before and 445.13 after, the mark and the x band moved together (offset −0.36 in both runs), and no side-chip source changed.
9. **The probe script stays in the scratchpad** (item rules: probe scripts never go in the repo). Its method is written out in `measurements.json` → `method`.

## Measured (centroid offset, CSS px, + = ● lower than the label's middle)

| control | 1440 before → after | 390 before → after | ● moves | label moves | contrast (unchanged) |
|---|---|---|---|---|---|
| side chip | −0.36 → −0.36 | −0.36 → −0.36 | 0 | 0 | 5.60:1 |
| kind chip | −0.35 → −0.35 | −0.35 → −0.35 | 0 | 0 | 5.60:1 |
| segmented | +1.65 → −0.35 | +1.64 → −0.36 | −2.0 px (up), 0 sideways | 0 | 5.16:1 |
| dismiss reason (injected) | −0.12 → −0.12 | −0.12 → −0.12 | 0 | 0 | 5.21:1 |

## Actual churn vs prediction

As predicted: 2 tracked files (`app/globals.css`, `lib/design/walkthrough-l2-css.test.ts`), +43 / −12, plus this folder. No TSX, backend or doc file changed. vitest 2561 → 2562 passed (+1 new test, 1 amended in place), 1 skipped. pytest 3593 passed, 2 skipped (backend untouched). mypy and ruff clean. Pixel moves are as predicted: the segmented ● moves 2.0 px up, everything else 0.
