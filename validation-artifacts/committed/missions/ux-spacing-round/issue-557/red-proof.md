# #557 red proof

**Cause.** On the base (`issue-556-hours-window-fixes` = `c7fc482e`), under `conestruct/site/`:

- d. `lib/scenarios/band-facts.ts:458` and `:466` write the verb "CHANGE", and `.workbench .a-lk` (`app/globals.css:4552`) draws it in mono 9.5 px, tracked and uppercase, 32 px tall.
- e. `.workbench .a-aerial-zbtn` (`app/globals.css:7381`) is 32 x 32; only the block at `:7402` (480 px and under) makes it 44.
- f. `.workbench .w-hours-row` (`app/globals.css:6268`) wraps with no space between its lines, so at 390 the link's ring crosses the row's sentence.
- g. `.workbench .w-src` (`app/globals.css:6104`) has `padding: 0`, so "Default" is as wide as its word, 42.45 px.
- The arrows: `.whd-clip` rules at `app/globals.css:6485-6513` and their spans in `components/WorkHoursDialog.tsx`, which no input can reach (rulings.md S9).

**Method.** The tests were written first and run against the base code, before any of the four source files was edited: `npx vitest run components/WorkHoursDialog.test.tsx components/BandStack.single-voice.test.tsx components/GeneratorSidebar.prepin-gating.test.tsx components/tap-targets.test.ts lib/scenarios/band-facts.test.ts`.

**Red (base code):** 7 failed, 90 passed (97). The failing names are in `red-output.txt`.

**Which tests are which.**

| Test | Kind | Red on the base? |
|---|---|---|
| `GeneratorSidebar.prepin-gating.test.tsx` "post-pin: the pending line becomes an answer, and the band opens" | Mounted (`render(<GeneratorShell … />)`): reads the Where row's link text and class from the rendered page. | Yes: it read "CHANGE". |
| `band-facts.test.ts` "#557: the collapsed rows' link reads Change" | Model: calls `deriveBands()` and reads the two verbs. | Yes. |
| `tap-targets.test.ts` "#557 … (stylesheet)" d, e, f, g (4 tests) | Source text only: they read `app/globals.css` and `components/bands/BandPrimitives.tsx` as text. They don't render a page and don't measure a size. | Yes, all four. |
| `tap-targets.test.ts` "#557 … (stylesheet)" e (S11): "under the bar, in one column over 480 px, the zoom is a row" | Source text only (`app/globals.css`). | Not in the red run: it was written with S11's rule, after the walk found the overlap. It was not run against the base. |
| `WorkHoursDialog.test.tsx` "#557 (S9) … no .whd-clip rule is left, and the window's source draws no arrow" | Source text only (`app/globals.css`, `components/WorkHoursDialog.tsx`). | Yes. |
| `WorkHoursDialog.test.tsx` "#557 (S9) … every start and end on the half hour … is placed inside 6 to 30" | Function: calls the exported `placed()` for 2,352 start and end pairs. | No, by design: it passes on the base. It is the check that the arrows could not render, made before they were removed. |
| `WorkHoursDialog.test.tsx` "#557 (S9) … no arrow in either view for hours at the scale's ends (mounted)" | Mounted (`render(<WorkHoursDialog … />)`), both views, four pairs of hours. | No: it passes on the base, for the same reason. |
| `WorkHoursDialog.test.tsx`, four older tests ("night work past midnight …", "the ruler: hours past both ends, both outside", "the ruler: night work that fits …", "the whole week: no day carries an arrow") | Mounted. Their "no arrow" assertions now read the drawn text for `◂ ▸ ▴ ▾`; they read the `.whd-clip` class and the `hours-clip-*` testids before. | No: they pass before and after. |
| `BandStack.single-voice.test.tsx` | Mounted (`render(<FactLine … />)`). Its fixtures' verb went from "CHANGE" to "Change" so they still fit `FactVerb`; the component prints whatever it is given. | No: it passes before and after. |

No test measures a rendered size. The 44 px boxes, the unchanged row heights, the 0 px moves and the focus ring's clearance are shown only by the walk (`walk.md`).

**Green (final code):** see `walk.md`, "Tests".
