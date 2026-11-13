# #535 red proof

Method: the new `WorkHoursDialog.test.tsx` run against `WhatBand.tsx` and `WorkHoursDialog.tsx` at `a1ad536` (the base), then the new sources restored.

Against the base: `Tests 3 failed | 32 passed (35)`. The three failures are the three new tests:
- `#532 P15 … > #535: Undo restores only the times; a date change made after the fix stays`
- `#532 P15 … > #535: the fix comes back while the record stands when the hours are outside again`
- `#535 (Ryan, 2026-11-12): the fix and the record together in the window > the record stands and the hours are outside: the record, Undo and the fix button all show`

With the change: `Tests 35 passed (35)`. The four affected files (WorkHoursDialog, WhatBand.guesses-first, WhatBand.step2-layout, GeneratorShell.class-stability): `Tests 80 passed (80)` (baseline 77, +3 new, 0 removed).
