# #555 red proof

**Cause.** `conestruct/site/components/WorkHoursDialog.tsx` on the base (`prompt-ux-spacing-round` = `aca2d8bd`) places every span on a 5 am to 9 pm scale (`S = 5`, `E = 21`, `:38-39`) and cuts what falls outside it (`clip()`, `:44`). An 8 pm to 5 am shift is left as the last hour of the scale (8 to 9 pm) plus two arrows.

**Test.** `conestruct/site/components/WorkHoursDialog.test.tsx`, mounted (`render(<WorkHoursDialog … />)`, Rule 11): the new describe "#555: both views run 6 am to 6 am" (11 tests) and the four older tests that pinned the clip arrows, rewritten to pin that no arrow renders. The fixtures are the backend's own shapes (`__fixtures__/what-section.ts`, untouched).

**Method.** The fixed `WorkHoursDialog.tsx` and `globals.css` were copied to the scratchpad, the base versions written over them (`git show prompt-ux-spacing-round:<path>`), only this test file run, then the fixed files copied back. sha256 (first 16 hex) before and after the swap: `75011ef8768e7c84` (`WorkHoursDialog.tsx`) and `14fae6d709a7f43d` (`globals.css`), the same both times.

**Red (base code), the test file with the new tests:** 15 failed, 31 passed (46). The failing names are in `red-output.txt`. Three of the messages:

```
#555 > the ruler, 8 pm to 5 am: one unbroken bar, and Denver's night window is one band with both ends labelled
AssertionError: expected [ [ '93.75%', '6.25%' ] ] to deeply equal [ [ '58.33%', '37.50%' ] ]

#555 > the ruler: five ticks at 6 am, noon, 6 pm, midnight, 6 am; midnight is marked and has its line
AssertionError: expected [ [ '6 am', '6.25%' ], …(4) ] to deeply equal [ [ '6 am', '0.00%' ], …(4) ]

#555 > the inside/outside split is the backend's, unchanged: 7 am to 5 pm against 8:30 to 3:30
AssertionError: expected [ [ '12.50%', '62.50%' ] ] to deeply equal [ [ '4.17%', '41.67%' ] ]
```

The first is the issue itself: on the base the 9-hour shift is one piece 6.25% long at the scale's end.

**Green (fixed code), the same file:**

```
 Test Files  1 passed (1)
      Tests  46 passed (46)
```

The 31 tests that passed on the base are untouched and still pass: the dialog's focus and keys, the verdicts, the fix and Undo, no-record days, the hollow bar on a no-record day, the screen-reader "Outside" text, and #535's record-and-fix states.

**Baseline before any edit** (`WorkHoursDialog.test.tsx` and `lib/design/type-census.test.ts`): 2 files, 47 tests passed. **Final:** 2 files, 58 tests passed. `npx tsc --noEmit`: exit 0.
