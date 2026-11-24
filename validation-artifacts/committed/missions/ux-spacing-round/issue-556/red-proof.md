# #556 red proof

**Cause.** On the base (`issue-555-six-to-six-chart` = `d46b0914`):

- a. `Legend` in `conestruct/site/components/WorkHoursDialog.tsx:294-317` has no entry for the striped days.
- b. Your hours take the hollow class only on a no-record day (`:423`, `:564`), so with `allowed: null` they draw solid; the top line is `SET_CLASS_TO_SEE` (`:371`).
- c. `weekNote()` (`conestruct/site/lib/scenarios/why-lines.ts:880-889`) writes "Your dates run … so the other days are greyed out.", and `.workbench .whd` is 600 px tall at every width (`conestruct/site/app/globals.css:6306`).

**Tests.** Mounted (`render(<WorkHoursDialog … />)`, Rule 11), in `conestruct/site/components/WorkHoursDialog.test.tsx`: the new describe "#556: the no-closures key, hours with no street class, the week note" (9 tests), and one older assertion on the week note rewritten to the new sentence. The fixtures are the backend's own shapes (`__fixtures__/what-section.ts`, untouched): `weekend_closed` for the no-closures weekend, `street_class` for `missing: street_class`. In `conestruct/site/lib/scenarios/why-lines.test.ts`: the "S5: the week note" test rewritten, and one new test for the note's other cases.

**Method.** The tests were written first and run against the base code, before any of the three code files was edited: `npx vitest run components/WorkHoursDialog.test.tsx lib/scenarios/why-lines.test.ts`.

**Red (base code):** 9 failed, 68 passed (77). The failing names are in `red-output.txt`. Four of the messages:

```
#556 > a: the key names the stripes, with a striped swatch, in a week with a no-closures day
TestingLibraryElementError: Unable to find an element by: [data-testid="hours-key-no-closures"]

#556 > b: the weekday view with no street class: the notice on top, a hollow bar, no inside or outside ink
TestingLibraryElementError: Unable to find an element by: [data-testid="hours-class-notice"]

#556 > c: the week note, part of a week and the whole week
AssertionError: expected 'Your dates run Nov 16 to Nov 20, so t…' to be 'Your dates: Mon Nov 16 to Fri Nov 20.…'

#556: the week note names the days that aren't in the dates (S8, S9)
Expected: "Your dates: Mon Nov 16 to Sat Nov 21. Sun isn't in them."
Received: "Your dates run Nov 16 to Nov 21, so the other days are greyed out."
```

Three of the nine new `#556` tests pass on the base, as they should: "a: no entry in a week with no no-closures day", "b: with a street class there is no notice, and checked hours keep the inside and outside ink" and "b: the hollow bar is dashed and unfilled" pin what must not change.

**Green (the fix), the same two files:** 77 passed (77).

Gate round 2 added no test. It renamed one ("c: the note is the last line of a body that scrolls, and the window is taller at 600 px wide and under (globals.css)" now reads "… a body that scrolls and stays at its bottom edge; the window is taller …") and added two assertions to it, so `red-output.txt` carries the round-1 name. The one-day sentence in the `why-lines.test.ts` test changed with the string.
