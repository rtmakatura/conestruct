# #556 user-facing strings

Ruling ("All items"): "List every new string with its source."

All of them live in `conestruct/site/lib/scenarios/why-lines.ts`. Dates are written by `shortDate()` (unchanged; "Mon Nov 16"). Day names are the file's own `DAYS`.

## New

| String | Where | Source |
|---|---|---|
| `No closures allowed` | The key, in the whole-week view, when a day is striped (`NO_CLOSURES_LABEL`) | Ryan, 2026-11-24, item 2a: `The key gains "No closures allowed"`. |
| `Pick a street class on the page and we'll check your hours against it.` | The top line of both views when a day with a record needs a street class (`PICK_CLASS_TO_CHECK`) | Ryan, 2026-11-24, item 2b, word for word. |

## Changed (the week note, `weekNote()`)

| Case | Before | Now | Source |
|---|---|---|---|
| Part of one week | `Your dates run Dec 7 to Dec 11, so the other days are greyed out.` | `Your dates: Mon Dec 7 to Fri Dec 11. Sat and Sun aren't in them.` | Ryan, 2026-11-24, item 2c: `"Your dates: <Mon Dec 7> to <Fri Dec 11>. <Sat and Sun> aren't in them."` |
| The same, one day left out | (as above) | `Your dates: Mon Dec 7 to Sat Dec 12. Sun isn't in them.` | The ruled sentence with one day: "isn't" (R145 S9). |
| The same, other days left out | (as above) | `Mon, Tue, Sat and Sun aren't in them.` / `Mon to Wed, Sat and Sun aren't in them.` / `Wed to Sun aren't in them.` / `Mon to Fri aren't in them.` / `Mon to Thu and Sun aren't in them.` | The ruled sentence; three or more days in a row read as a range (R145 S9). |
| The whole week | `Your dates run Dec 7 to Dec 13, the whole week.` | `Your dates: Mon Dec 7 to Sun Dec 13, the whole week.` | Ryan, 2026-11-24, item 2c: `(and "the whole week" when they are)`; the closing words are the old sentence's (R145 S8). |
| One day | `Your dates run Dec 9, so the other days are greyed out.` | `Your date: Wed Dec 9. No work on the other days.` | R145 S8: the ruled opening for one date, and a plain second sentence (days can't be "in" a date). |
| More than one week | `Your dates run Dec 7 to Dec 23. This is the first week; every week has the same hours.` | `Your dates: Mon Dec 7 to Wed Dec 23. This is the first week; every week has the same hours.` | R145 S8: the ruled opening; the second sentence is unchanged (#526). |

## Removed

| String | Where it was | Why |
|---|---|---|
| `Pick a street class on the page to see its hours here.` | The top line of the weekday view with no street class (`SET_CLASS_TO_SEE`) | Replaced by the ruled notice (R145 S5). |

## Unchanged

- `Pick work dates on the page to see your days here.` (the week note with no dates).
- Every screen-reader sentence: each day still reads "Needs a street class.", "No closures.", "No hours on record." or "Allowed …", with " Outside: …" when the backend sent outside spans. The key's swatches stay `aria-hidden`; the key entry and the notice are plain text, read in order.
- The title, subtitle, verdicts, fix button, record, weekend line, holiday line, source line and the other key labels.

## Unslop check

No em dash, no corrective antithesis, none of the listed words, contractions kept ("we'll", "aren't", "isn't"). Sentence lengths vary.
