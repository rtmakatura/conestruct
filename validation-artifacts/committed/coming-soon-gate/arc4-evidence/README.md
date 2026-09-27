# R21 evidence — 02's stacks: crisp while moving, one move per card

## `diagnosis/` — why it pixelated (on the Arc 3 code, `5971318`)
`probe-pixelation.cjs <outdir> <variant>` hovers the plan card at 1440, 1× and 2×, with the transition slowed to 4 s so a frame is truly mid-fan. It reads Chrome's compositor layer tree during the move and crops mid and settled.

| Variant | Layers at rest → mid-fan (1×) | Rotated layers mid-fan | Edge mid-fan |
|---|---|---|---|
| Arc 3 as shipped (`transition: transform`) | 40 → 43 | **3 × 217×192** (the three sheets) | stair-stepped: hard 1 px steps along the sheet's top edge and the 2 px title line (`before-mid-vs-settled-1x-zoom5.png`, top) |
| + `shape-rendering: geometricPrecision` | 40 → 43 | 3 | unchanged |
| `transform-box: view-box` instead of `fill-box` | 40 → 43 | 3 | unchanged |
| + `will-change: transform` | 54 → 54 (layers exist before the hover) | 3 | unchanged; permanent layers |
| **fix: transition `--fan`, transform derived from it** | 40 → 40 | **0** | antialiased (`before-vs-fix-mid-1x-zoom5.png`, bottom) |

**Cause:** Chrome runs a CSS `transform` transition on an SVG group on the compositor. It rasterises the group once, flat, and rotates that bitmap, so edges stair-step until the transition ends. Then the settled frame repaints as vector, which is why the resting fan looked fine (`before-mid-vs-settled-1x-zoom5.png`, bottom).

Not the cause:
- `transform-box` / `transform-origin`;
- a missing `shape-rendering`;
- fractional stroke positions, which only change which pixels step.

**Fix, at the cause:** the moving values are registered custom properties (`@property --fan`, `--k`), and every transform, opacity, fill-opacity and dash offset is derived from them. A custom-property transition or animation can't go to the compositor, so every frame repaints as vector.

## `local-0420db6/` — browser leg, local **dev** server, commit `0420db6`
`AUDIT_OUT=<dir> node measure.cjs http://localhost:3100`, 1440 × 900, at 1× and 2× device pixel ratio, real speed and slowed 10×.

| Check | Result |
|---|---|
| Rotated compositor layers during each card's move | **none**, for all four cards, 1× and 2×, real and slow |
| Mid-move | every card fanned with its marks running (7 or 8 animations), `--fan` part-way (0.43–0.57) |
| Settled / after leaving | `--fan` 1 / 0, every mark back at rest |
| P1 | no box moved (sections, headers, all four cards, their texts and drawing boxes, document-relative) for any card |
| Touch (tap) | never fanned, 0 animations, marks at rest, all four cards |
| Reduced motion (hover) | the sheets take their place (`--fan` 1) with transition 0 s, 0 animations, every mark at rest, all four cards |
| axe WCAG 2.2 AA + best practice | 0 violations |

Crops:
- `<card>-<dpr>x-<real|slow>-mid.png` and `-settled.png`.
- `mid-1x-zoom3.png`: all four mid-move, enlarged 3×, nearest neighbour.
- `mid-2x-zoom2.png`: plan and crew at 2×, enlarged 2×.

Also found by this leg: `STACK_MOVES` exported from the `"use client"` `PaperStack.tsx` reached the server page as a client reference, and `/` returned 500. Moved to `components/coming-soon/stack-moves.ts`, and `PaperStack.test.tsx` now requires the `"use client"` modules to export components only.

## Owed after the ship (Ryan's go)
- `/healthz` sha == HEAD and the served bundle polled.
- `AUDIT_OUT=<dir> node measure.cjs https://www.conestruct.com`: the same table on prod (no production build was measured locally).
- Ryan's hand-check: hover each of the four cards in 02 at 1440, on a 1× and a 2× screen.
