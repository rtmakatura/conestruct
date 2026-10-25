# L2 — light-lane CSS round (mission site-walkthrough-audit, #396)

Branch `mission-swa-l2-css` off `mission-swa-l1-copy` (`865aa33`). CSS/layout only, plus one className in `AppNav.tsx` and (repair cycle 1) one label `<span>` in `components/bands/FieldCell.tsx`, both for layout: no wire field, API route, middleware, gate, or scenario/audit/pricing logic.

## Baseline (before the diff)

`cd conestruct/site && npx vitest run --silent`: `Test Files 239 passed | 1 skipped (240)`, `Tests 2548 passed | 1 skipped (2549)`. Green on the first run. No Python touched, so pytest isn't run.

## Plan

1. **W12** `app/globals.css:4836-4840` (kind chip) and `:5507-5511` (segmented toggle): pressed differs from unpressed by the blue border and wash only. Add a leading ✓ as a `::before` on the kind chip's label (`.a-chip[aria-pressed] > .tr-field`) and on each segmented button, in `var(--act)`, the side chip's existing treatment (`.a-chip-check`, #290 hand-check item 3). The glyph's space is reserved on every option (`visibility: hidden` until pressed), so pressing moves nothing (P1). Alt text is empty (`content: "✓\00a0" / ""`): `aria-pressed` is what is announced, as with the side chip's `aria-hidden` ✓.
2. **W13** `app/globals.css:5220` `.a-fld`: WebKit draws a native select white and ignores the dark background, so the light ink sits on white. Add `color-scheme: dark` to `.a-fld` (the control and its option list take the dark system palette), and keep the explicit background and ink. Measure the rendered background pixel against the ink in WebKit at 390.
3. **W15** `components/bands/BandPrimitives.tsx:115`, `app/globals.css:4718`: "STEP 1 OF 4" wraps because the flex head squeezes the step label. `white-space: nowrap` on `.a-open .a-head .tr-step` (and on `.tr-section`, the one-word head beside it), `min-width: 0` on the provenance so it takes the wrap. Check scrollWidth = viewport at 360.
4. **W21** `components/AppNav.tsx:51`: below `md` only the wordmark shows, and its right border draws an empty cell beside it. Drop that border below `md` from AppNav's left group (`max-md:[&>a:first-child]:border-r-0`); `Wordmark.tsx` and the public chrome are untouched, and desktop keeps the border.
5. Evidence fold-in: correct the "Ryan's note" paragraph in `walkthrough/findings.md` per L1 R145-4.

## Rule 5 churn prediction (written before the diff)

- `app/globals.css`: about +35 lines, 0 changed or deleted: W12 two rule pairs with a comment (~18), W13 one declaration with a comment (~3), W15 two rules with a comment (~10).
- `components/AppNav.tsx`: 1 line changed (the left group's className).
- New test `lib/design/walkthrough-l2-css.test.ts` (~60 lines, 5 tests), red on the base for all 5. No existing test changes; expected count 2553 passed, 1 skipped, 241 files.
- `walkthrough/findings.md`: 1 paragraph rewritten.
- Evidence: `L2/rulings.md`, `L2/measurements.json`, `L2/red-proof.txt`, `L2/before/*.png`, `L2/after/*.png`.
- Behavior change: none to state or data. Visible changes, stated here: a ✓ leads the pressed kind chip and the pressed segmented option; native selects draw dark in WebKit; the step label stays on one line; the phone nav loses the wordmark's right border. Byte-identical: every TSX file but `AppNav.tsx`, every API route, `Wordmark.tsx`, `PublicChrome.tsx`, desktop nav.

## Calls (R145 self-ruled)

- **R145-1 (W12 hue).** The ✓ takes `var(--act)`, not rule 18's `--pass` green. Here it marks a chosen option, which is the side chip's meaning and treatment (`.a-chip-check`, "a leading ✓ in the accent", #290 hand-check item 3; `globals.css` comment above `.a-chips-side`), and R107's segmented control says the pressed option takes "the kind chip's own treatment (P11)". One look for "chosen" across the three controls. The tension with rule 18's fixed ✓ hue exists already in the side chip; this round follows that precedent rather than reopen it. ~~R145 self-ruled~~ **Withdrawn in repair cycle 1: filed for Ryan as #407, not ruled.**
- **R145-2 (W12 position).** Reserved space, not a corner mark, so pressing moves nothing (P1). The segmented option leads with the ✓, as the side chip does ("✓ North side"). The kind chip was first built leading too, but the first after-shot showed the reserved slot pulling every label one glyph in from its citation line's left edge (P4), so its ✓ ends the label instead ("Flagger lane closure ✓"). Amended before the final shots; plan bullet 1 reads "leading" for both, and this is the change. R145 self-ruled.
- **R145-3 (W13 approach).** `color-scheme: dark` rather than `appearance: none` plus a drawn caret: it keeps the native arrow and the platform's option list, adds no new hex (the caret would need one in a data URI) and no font size. A real iPhone is still unchecked; Playwright WebKit is the only WebKit leg. R145 self-ruled.
- **R145-4 (W21 scope).** The border goes only in AppNav below `md`; PublicChrome shares `Wordmark` but W21 names AppNav, and the public chrome wasn't reported. R145 self-ruled.

## Actual churn vs prediction (first pass; see Repair cycle 1 for current numbers)

- `app/globals.css`: +37 lines, 0 deleted (predicted ~+35). W12 at `:4865-4889` (comment, kind-chip `::after` rule, segmented `::before` rule, the shared pressed rule; one rule more than predicted, from R145-2's split); W15 at `:4728-4735`, whose first line is `min-width: 0` added inside the existing `.a-prov` rule (`:4725`) (an added line in an existing rule, not a new rule as plan bullet 3 implied); W13 at `:5263-5266`.
- `components/AppNav.tsx:51`: 1 line changed, as predicted.
- New `lib/design/walkthrough-l2-css.test.ts`: 72 lines, 5 tests (predicted ~60, 5).
- `walkthrough/findings.md`: 1 paragraph rewritten, as predicted.
- No existing test changed. Full run: `Test Files 240 passed | 1 skipped (241)`, `Tests 2553 passed | 1 skipped (2554)` (+1 file, +5 tests, as predicted).

## Red proof (first pass; see Repair cycle 1 for current numbers)

`red-proof.txt`: the final test file against the base `globals.css` and `AppNav.tsx` (`865aa33`), 5 failed of 5.

## Measured (measurements.json; script in `script/`) (first pass; see Repair cycle 1 for current numbers)

- **W12 (first pass, superseded):** this claimed "nothing moves" from rects and widths only; the reviewer found the in-flow toggle slot moved every centred toggle label. See Repair cycle 1 for the label-centre measurements that replace it.
- **W13:** WebKit 390, rendered select ground (pixel sample) `rgb(244,244,244)` before, ink `rgb(234,240,247)` on it 1.04:1; after `rgb(52,52,52)`, 10.85:1. Chromium draws the token ground both times (13.91:1), computed `color-scheme` `normal` → `dark`. **A real iPhone is still unchecked**; Playwright WebKit is not iOS Safari.
- **W15:** step label lines, fresh / after locating / Step 2: 1440 1/2/1 → 1/1/1; 390 2/3/2 → 1/1/1; 360 2/3/2 → 1/1/1; WebKit 390 2/3/2 → 1/1/1. `scrollWidth` equals the viewport in every run, before and after (360 = 360).
- **W21:** bordered cells in the nav at 390 and 360: the wordmark with a 1 px right border before, none after; 1440 unchanged (wordmark, DEMO crumb, citation, same borders).

## Screenshots (first pass; see Repair cycle 1 for current numbers)

Local `next dev` of this worktree, DPR 2, Chromium at 1440×900, 390×844, 360×780 and WebKit at 390×844. `before/` is the base `865aa33` (sources swapped back from `git show HEAD:`), `after/` this diff; same flow. `/api/road-bearing` stubbed with one two-way East Colfax Avenue candidate (Overpass unavailable again on 2026-10-25); geocode, corridor and the rest live. The gate ran with a throwaway token in an untracked `.env.development.local` (deleted afterwards, with the copied `.env.local`).

For each of `1440`, `390`, `360`, `390-webkit`, in `before/` and `after/`:
- `*-w15-w21-step1-head.png`: fresh `/sandbox`, nav and Step 1 head (W15, W21).
- `*-w15-step1-head-located.png`: Step 1 head with the long provenance after locating (W15).
- `*-w12-kind-chip-selected.png`: the kind chips with Flagger pressed (W12).
- `*-w12-toggle-pressed.png`: the Street class toggle, Arterial pressed (W12).
- `*-w13-select.png`: Step 2's selects in the viewport (W13; the WebKit pair is the finding).

## Repair cycle 1 (reviewer FAIL; prediction amended before this diff)

Findings: (1) the toggle's reserved ✓ slot sits in the text flow, so every centred toggle label moved right by half the slot, and "nothing moves" was claimed from widths only; (2) a Next dev error toast in `after/1440-w13-select.png`; (3) the pointer rested on the pressed chip in the shots, and `.a-chip:hover` (`globals.css:4890`) overrides the pressed border; (4) ✓ contrast measured at 1440 only; (5) the accent ✓ against Rule 18 (`globals.css:2266`, "A symbol never changes hue by context") and P9 was self-ruled and should go to Ryan.

Amended prediction:
- `components/bands/FieldCell.tsx` (`Segmented`): the label goes in `<span className="a-seg-label">`, +3 lines with a comment; markup for layout only. Button text and accessible names unchanged.
- `app/globals.css`: the segmented ✓ leaves the text flow. It becomes `.a-seg > button[aria-pressed="true"] > .a-seg-label::before`, absolutely placed just left of the label (`right: 100%`) with `.a-seg-label { position: relative; }`, so no slot is reserved and the label stays centred. The kind chip's trailing reserved ✓ is unchanged (left-aligned label; the slot sits after the text). About ±10 lines.
- Fold-in (CLAUDE.md R154: same file, no ruling or source, about 3 lines): `.a-chip:hover` becomes `.a-chip:not([aria-pressed="true"]):not([aria-checked="true"]):hover`, so a pressed or checked chip under the pointer keeps its accent border. Hover on unpressed chips is unchanged. This is a stated behaviour change.
- Test file: the W12 assertions follow the new selectors, and one more assertion pins the hover exclusion; still 5 tests.
- Shots: retaken like-for-like with the pointer parked at (0, 0) before every screenshot, browser console errors captured, label centre x and ✓ contrast measured at 1440, 390, 360 and WebKit 390.
- Rule 18 / P9: filed for Ryan's ruling (needs-spec-decision), not self-ruled. R145-1 above is withdrawn as a ruling; the accent ✓ stays as the shipped side-chip precedent pending that issue.

### Repair cycle 1: results

- **Churn, actual:** `app/globals.css` +45/-1 net over the base (first pass +37; the toggle ✓ rule replaced, `.a-seg-label` added, the hover selector changed in place); `components/bands/FieldCell.tsx` +3/-1 (`:218-220`); `AppNav.tsx` and `findings.md` unchanged from the first pass; the test file is 78 lines, still 5 tests. In line with the amended prediction.
- **Label centre x, before vs after** (`measurements.json` → `label_centre_x_before_after`): every kind chip and every toggle option (Street class, Hours) at 1440, 390, 360 and WebKit 390 has a delta of **0.00 px**. Kind chip label text starts at x 14 before and after. The first pass's in-flow slot is gone.
- **✓ contrast** against the sampled pressed ground: kind chip 5.61:1 (1440, 390, 360), 5.60:1 (WebKit 390); toggle 5.19:1 (1440, 390, 360), 5.18:1 (WebKit 390). All above AA 4.5:1.
- **W13, W15, W21:** unchanged from the first pass: WebKit select 1.04:1 → 10.85:1; step label 1 line everywhere; scrollWidth = viewport; no bordered nav cell below `md`.
- **Pointer:** parked at the viewport's bottom-right corner before every measure and shot. The first retake parked it at (0, 0), which put it over the wordmark link; that retake isn't kept. The pressed chip's computed border is `rgb(52, 169, 232)` in every before and after shot.
- **Hover fold-in:** before, `.workbench .a-chip:hover` (`globals.css:4890` on the base, same specificity and later than the pressed rule) replaced a pressed or checked chip's accent border with `--raise-hi` whenever the pointer was over it, and on touch screens hover sticks after the tap. Folded in under CLAUDE.md R154's fold-in rule (same file, no ruling, 3 lines) rather than filed, and pinned in the W12 test.
- **Dev error toast (`after/1440-w13-select.png`, first pass):** not reproduced in 8 later runs (4 base, 4 this diff); its cause wasn't captured, so where it came from is unknown. The first-pass diff was CSS plus one className. Next's dev overlay ("1 error") had already appeared on the **base** in this session's first before attempt (`1440-error.png`, road detection unavailable; overwritten on retake). Across the 8 repair-cycle runs (4 base, 4 this diff) with `pageerror`, console and overlay capture, there were no page errors and no overlay, and the console errors match before and after: `events.mapbox.com` not resolving (Mapbox telemetry, ×4 per run), aborted `api.mapbox.com` tile loads, and one `400` from `/api/render/audit` per run (the audit call on the stubbed road; the same 400 on the base). The overlay is a dev-only surface. With no reproducible error there is nothing concrete to file.
- **Rule 18 / P9:** filed for Ryan's ruling, not self-ruled: #407, https://github.com/rtmakatura/conestruct/issues/407 (`needs-spec-decision`, `priority-low`, `frontend`, `ux`, `p9`, `p11`).
- **Red proof:** `red-proof.txt` regenerated with the final test file against the base sources (`globals.css`, `AppNav.tsx`, `FieldCell.tsx` at `865aa33`): 5 failed of 5.
- **Vitest (one run):** `Test Files 240 passed | 1 skipped (241)`, `Tests 2553 passed | 1 skipped (2554)`.
- **Screenshots:** all 40 retaken like-for-like (same names as listed above). `before/` is the base sources swapped in from `git show HEAD:`, `after/` this diff. The dev server is stopped and the env files and token are deleted.
