# Rule 5 outcome: `issue-295-stale-ink` (#295, option A)

Prediction: `prediction.md` (committed `bee0fd5`, before any change).

## What changed

- **`conestruct/site/app/globals.css`:**
  - Four `--stale-*` tokens on `.workbench` (where the ink tokens are declared), beside the originals.
  - `.workbench .results-stale` drops `opacity: 0.5`, keeps `filter: grayscale(0.4)` and redefines `--ink`,
    `--ink-on-dark`, `--ink-faint`, `--ink-on-dark-faint`, `--none`, `--dim` and `--orange` (an alias of `--dim`,
    which the prediction missed).
- **`components/GeneratorShell.ribbons.test.tsx`:** the "dim unchanged" test now pins the new treatment: no
  opacity, grayscale kept, the seven remaps.
- **`components/results-stale-ink.test.tsx` (new):**
  - each stale ink clears 4.5:1 on `--canvas` and `--da-ground`;
  - each reads dimmer than its token;
  - the order ink > ink-on-dark > faint holds.

## Deviation from the prediction

`--stale-ink-on-dark` is `#98a1ae` (6.31 on `--canvas`), not the predicted `#8e98a4` (5.63). The first
local run read the zip button's 9.5 px "↓" at **4.24:1** on pixels, staged, at both widths. That glyph is a
single 1 px stroke that never renders its declared colour: undimmed it reads 9.43 against a declared 10.68.
Its target in `palette295.py` went from 5.6 to 6.3, and the rerun reads it at 4.92. The palette's order
still holds (7.01 > 6.31 > 4.74). The rerun replaced the first run's `after-local/`, so no file keeps the
4.24. It's recorded here from the run's output; the 9.43 and 4.92 are in `after-local/log.txt`.

## Measured (`probe295.js`, `after-local/`, a `next start` of the branch, device scale 2)

| width | state | text elements | under floor (pixels) | disabled (exempt) | axe `color-contrast` | lowest reading |
|---|---|---|---|---|---|---|
| 1440 | settled (calibration) | 49 | 0 | 0 | 0 | 6.19 |
| 1440 | staged | 49 | 0 | 0 | 0 (43 pass) | 4.61 (`.qty > b`, `--dim` 10 px) |
| 1440 | flight | 45 | 0 | 12 | 0 (33 pass) | 4.61 |
| 380 | settled (calibration) | 11 | 0 | 0 | 0 | 6.19 |
| 380 | staged | 11 | 0 | 0 | 0 (9 pass) | 4.72 (`.tier-cue`, faint) |
| 380 | flight | 11 | 0 | 2 | 0 (8 pass) | 4.61 (`.hero-cell .num`, floor 3) |

"Text elements" is the inventory count. Each one was sampled, exempt as disabled, or unreadable; at 380
flight, for example, 11 = 7 + 2 + 2.

The baseline on prod `6fb07f4` had 33, 28, 9 and 8 axe violations in the same four dimmed states.

- **Wrapper:** opacity 1, filter `grayscale(0.4)`, in every dimmed state.
- **Ribbons:** one in each dimmed state, none inside the wrapper.
- **The settled pass:** it calibrates the sampler. The same code on the undimmed answer reads the faint
  token at 6.19 / 6.47, which is its token math, so the dimmed readings can be trusted. At device scale 1
  the sampler under-read the 10 px labels (3.27 for a 4.74 ink), which is why the probe now samples at 2.
- **Disabled controls:** mid-flight the download buttons are disabled. WCAG 1.4.3 exempts them, and axe
  skips them too.
- **"Unreadable" rows** (1 to 2 per state): elements whose rect clipped outside the viewport. Axe covers them.

The sampler classifies every text node under the dim. Opened disclosures sit outside the wrapper, so they
were neither dimmed before nor after.

## Not-current still reads without the ribbon

In `after-local/1440-staged.png` against `before-prod-6fb07f4/1440-staged.png`:

- the numerals drop from `--dim` orange to a muted bronze;
- labels, card text and buttons step down one tier;
- `.tier-cue` reads "◌ previous answer, refreshing…" inside the region.

Nothing is hidden or skeletoned (#192, #252, P16).

## Suites

- vitest: the full suite passed (211 files, 2173 tests) before the `--stale-ink-on-dark` retarget. The
  two files that read those values passed again after it (12 tests).
- `next build`: clean.
- The prod run after ship is the gate (`after-prod-<sha>/`).
