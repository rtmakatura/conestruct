# Arc 9 evidence — Rule-13 grayscale trio (#144 / #159 / #132)

Capture scripts committed alongside: `capture-144-glyph-pair.py`,
`capture-159-shoulder-contrast.py` (both run against the repo venv;
pypdfium2 + Pillow, no fitz/AGPL), `capture-132-nav.js` (Playwright,
read-only prod screenshot).  The SAME scripts produced pre- and
post-fix outputs, so each pair's diff is the evidence.

Pre-fix captured 2026-08-03 at `a344784` (main); post-fix at
`04bd2c7`/`96882e0` (issue-144-grayscale-trio).

| Issue | Pre-fix (measured) | Post-fix (measured) |
|---|---|---|
| #144 PCMS ≡ arrow board | Both device types mapped to the same function object; grayscale pixel-diff bbox `None`, max delta 0 — byte-identical patches (`pre-fix-144-glyph-pair-grayscale.png`: two identical arrow boards) | Distinct functions; diff bbox (242,266,358,334), max delta 184; PCMS panel mean < 96, arrow panel mean > 128 (polarity split) (`post-fix-144-glyph-pair-grayscale.png`: light arrow panel vs dark message-row panel) |
| #159 closed-shoulder pink | Modal band pixels (232,208,208) vs (208,208,208) → contrast **1.055 color / 1.072 grayscale** on the rendered divided shoulder-closure sheet — matches the issue's 1.06 (`pre-fix-159-bands-grayscale-pair.png`: two flat bands, indistinguishable) | Hatch strokes cross >90% of closed-band columns, <5% of open-band; modal fills unchanged 215/208 — additive, pink kept (`post-fix-159-bands-grayscale-pair.png`: open flat, closed hatched) |
| #132 nav status dot | Prod computed style: `rgb(79,215,135)` (`--pass`), 6×6px, `animation: pulse`, empty text — a permanent green pulse derived from nothing; grayscales to a meaningless dot (`pre-fix-132-nav-color.png` / `-grayscale.png`). **Premise drift**: the issue's "other states" never existed | Dot deleted (Ryan's ruling, GO #1). Badge text "MUTCD 2023 · CDOT" stands alone, measured 5.61:1 (#93a0b0 on #1b2838). Post-fix DOM asserted by `AppNav.rule13.test.tsx`; post-fix prod screenshot + axe land with the live checks after ship |

Band-pair images: top = open shoulder, bottom = closed.  Full-sheet
context: `pre-fix-159-sheet-grayscale.png` / `post-fix-159-sheet-grayscale.png`.

Regressions live in `tests/test_plan_sheet_grayscale.py` (rendered-
output level: rasterize and measure) and
`conestruct/site/components/AppNav.rule13.test.tsx` (mounted).

Honesty notes: PCMS emission is retired (#142) — no production PDF can
contain one; #144's fix is the latent render path, verified glyph-level
through the production mapping.  The closed-LANE pink (lane closures)
is the same fill family and stays out of scope by ruling (GO #2) —
carried in grayscale by taper devices + zone text.
