# Rule 5 prediction: `issue-295-stale-ink` (#295, option A)

Committed before any change to `conestruct/site`.

## Ruling

Ryan, 2026-10-14: "#295: (A), raise the ink inside the dim. Build it."

## R145 self-rulings inside (A)

1. **The mechanism is a token remap on the wrapper.** `.workbench .results-stale` drops `opacity: 0.5` and
   redefines the ink tokens its text reads to paired stale values. Every descendant that reads a token
   follows it, so no per-selector list has to be kept. `filter: grayscale(0.4)` stays as the wash: it drains
   the hue from everything under the wrapper, graphics included, at close to no luminance cost.
2. **Which tokens:** the four colours the baseline found under the dim (`before-prod-6fb07f4/`):
   `--ink`, `--ink-on-dark`, `--ink-faint` / `--ink-on-dark-faint` / `--none` (one value) and `--dim`.
   Not remapped:
   - `--act` paints solid controls behind `--on-act` ink, so dimming it would lower that pair.
   - `--pass` paints the audit body's check tile.
   - `--warn` and `--fail` are left alone with `--pass`, so the verdict colours stay one family.

   All of these stay at their full values, which clear the floor, and the grayscale wash still covers them.
3. **The values** come from `palette295.py`. Each token is composited over `--canvas` (the lighter ground)
   at the alpha that first reaches a target. That is what `opacity` did, stopped at a measured floor rather
   than a fixed .5:

   | token | stale | on `--canvas` | on `--da-ground` | opacity .5 gave |
   |---|---|---|---|---|
   | `--ink` | `#a2aab3` | 7.01 | 7.32 | 4.58 |
   | `--ink-on-dark` | `#8e98a4` | 5.63 | 5.88 | 3.68 |
   | `--ink-faint` / `--ink-on-dark-faint` / `--none` | `#7e8b9a` | 4.74 | 4.96 | 2.57 |
   | `--dim` | `#cb732e` | 4.73 | 4.94 | 2.68 |

   The targets keep the palette's order and clear 4.5:1 even where `--dim` is 10 px (`.qty > b`).
   The new values are declared as `--stale-*` tokens on `:root` beside the originals (rule 12).
4. **Not-current still reads without the ribbon.** The ink steps down and the hue drains, and the region
   keeps its own glyph and word: `.tier-cue` reads "◌ previous answer, refreshing…". The ribbons stay
   outside the wrapper (#288 clause 6), so rule 102 is unchanged.

## Baseline (prod `6fb07f4`, `probe295.js`, today's opacity dim)

| width | state | text elements | axe `color-contrast` in the dim |
|---|---|---|---|
| 1440 | staged | 49 | 33 violations |
| 1440 | flight | 45 | 28 violations |
| 380 | staged | 11 | 9 violations |
| 380 | flight | 11 | 8 violations |

The readings match the issue's: `--ink-on-dark-faint` at 2.62:1 and `--dim` at 2.74:1.

## Predicted

- `probe295.js` on a `next start` of the branch, and on prod after the ship, at 1440 and 380, staged and
  flight:
  - 0 text elements under their floor on composited pixels (disabled controls exempt per WCAG 1.4.3);
  - 0 axe `color-contrast` violations inside the dim;
  - wrapper opacity 1 and filter `grayscale(0.4)`;
  - ribbons 1, inside the dim 0.
- The grayscale wash moves each ratio a little off the table above, so the composited figures won't equal it
  exactly. None should fall below 4.5:1.
- `GeneratorShell.ribbons.test.tsx` "the dim itself is unchanged" is rewritten to pin the new treatment: no
  `opacity`, grayscale kept, the four remaps present. A token test pins each stale value's ratio on both
  grounds.
- No change outside `.results-stale`: the settled page is untouched (0 colour-contrast violations, as leg 6
  measured).
- `next build` clean; vitest suite green.
