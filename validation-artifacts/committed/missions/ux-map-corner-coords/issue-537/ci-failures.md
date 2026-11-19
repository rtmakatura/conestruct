# CI failures on the pushed chain (2026-11-19)

Saved before any re-run (CLAUDE.md § Session budget).

- Run 44571788768 (Frontend tests, `cb850bf`, top branch `issue-538-typed-coords-zoom`), and the Frontend run on `b621c72` (`issue-537-coords-bar`): 1 failed | 296 passed | 1 skipped (298).
- `components/tap-targets.test.ts > R138 tap targets > every picker control the census found under 44 carries tap-44`: `AssertionError: expected 7 to be 10`.
- `issue-536-corner-in-title` (`26df927`) is green, so the failure comes from #537: the bar removed the old "Or enter coordinates manually" link and its two boxes, which carried three of the picker's ten `tap-44` classes.
- Not a flake: see the run on its own below.

## Run on its own

`npx vitest run components/tap-targets.test.ts` in the issue-538 worktree at `cb850bf`: 1 failed (1), `expected 7 to be 10`. It fails alone too, so it is a real failure, not a flake.

## Fix

Gate round 2 for #537. Test-only: `conestruct/site/components/tap-targets.test.ts`. `LocationPickerModal.tsx` and `globals.css` are unchanged; no bar control is under 44 px (walk.md § 44 px and axe).

- The tap-44 count is 7, and the comment names them: Close, the search box and its search button, Cancel, Save & Close, the intersection pin's Clear, Re-detect. The three that went with #537 were the toggle and its Latitude and Longitude fields.
- The same test had a second stale assertion that CI never reached: `not.toMatch(/className="field-input/)`. The bar's two boxes are `field-input mw-cbar-input` with no tap-44. It now says exactly two field-inputs lack tap-44, and both are `mw-cbar-input`.
- New test, "#537: the coordinates bar's controls are 44 px by .mw-cbar rules, at every width". It checks that the picker uses `mw-cbar-coords`, `mw-cbar-go` and `mw-cbar-cancel`. It then reads the top-level rules in globals.css, which sit outside any media or container query: `.mw-cbar` height 44px; `.mw-cbar-coords` height 44px and min-width 44px; `.mw-cbar-input` height 44px; the shared `.mw-cbar-go, .mw-cbar-cancel` rule, height 44px and min-width 44px. Last, it checks that the `@container (max-width: 479px)` and `@media (max-width: 479px)` rules change no control's height or width: only padding, gap and the hidden "itude" suffix of the Latitude and Longitude labels (`.mw-cbar-more`).
- Other tests: no other frontend test asserts on the removed text ("Or enter coordinates manually", "Hide coordinate entry", "mw-coords", "showManualCoords"). The only other hit was `LocationPickerModal.coords-bar.test.tsx`. In `tests/`, the files that name these paths (`test_cosmetic_lane_check.py`, `test_preview_url.py`) use them as path strings only and never read the source.

Run: `npx vitest run` on tap-targets, LocationPickerModal.coords-bar, LocationPickerModal.spacing, LocationPickerModal.map-window, DetectedVsApplied.confidence, floor-320, walkthrough-l3-picker, ink-literals, type-census, provenance:

```
 Test Files  10 passed (10)
      Tests  102 passed (102)
```
