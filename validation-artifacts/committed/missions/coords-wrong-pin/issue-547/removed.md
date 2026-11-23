# #547: what was removed

Line numbers are at the base, `prompt-coords-wrong-pin` (65615703).

## The check before the delete

- `git grep -n -i bearingWarning` on the base: `LocationPickerModal.tsx:485`, `:782`, `:820`, `:1560` and `LocationPickerModal.coords-bar.test.tsx:508`, `:510`. Nothing else in the repo's code names it.
- `git log -S"setBearingWarning(" -- conestruct/site`: 9f8ba853, 3d2d017b, 609fcb54, 1c2d99db. The last is #507. Its diff removes the four calls that passed a string and leaves `setBearingWarning(null)`. No later commit adds a call.
- So no setter passes a string, and the slot's condition was always false.

## Deleted

| File:line at the base | What it was |
|---|---|
| `conestruct/site/components/LocationPickerModal.tsx:484` | the section heading comment `// ---- Bearing detection warning ----`, which headed only the state below |
| `conestruct/site/components/LocationPickerModal.tsx:485` | the state: `const [bearingWarning, setBearingWarning] = useState<string \| null>(null);` |
| `conestruct/site/components/LocationPickerModal.tsx:782` | `setBearingWarning(null);` when the pin moves |
| `conestruct/site/components/LocationPickerModal.tsx:820` | `setBearingWarning(null);` when the road lookup answers with candidates |
| `conestruct/site/components/LocationPickerModal.tsx:1560` | the slot in the floating list: `{bearingWarning && <p className="mw-note mw-search-line">{bearingWarning}</p>}` |
| `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx:498-512` | the source-text test "the bearing note's slot is in the list, not in the flow" and its three-line comment (finding 3), with the blank line above it (`:498`) |

## Reworded (comments only)

| File:line at the base | Before | After |
|---|---|---|
| `conestruct/site/components/LocationPickerModal.tsx:1537-1539` | "the coarse-match notice and the bearing note are lines here too; neither is in the column's flow. (The bearing note has had no words since #507.)" | "the coarse-match notice is a line here too, not in the column's flow." |
| `conestruct/site/app/globals.css:5490` | "#543: the coarse-match notice and the bearing note are lines in it too." | "#543: the coarse-match notice is a line in it too." |
| `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx:437-442` | the `describe` comment named both the notice and the bearing note as lines in the list | names the notice only, and says #547 deleted the bearing note |
| `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx:581-585` (finding 8, folded in) | ruling 1 of the ux-map-window-tidy prompt in quote marks, its three bullets joined | the same three points with no quote marks, pointing at the prompt for the exact text |

## Not removed

- No CSS rule. `.mw-note`, `.mw-search-line`, `.mw-search-list` and `.mw-search-list:empty` are still used by the coarse-match notice and the search's own lines.
- No string, constant or helper. The note's strings went in #507; nothing else was used only by it.
- The deleted test also read the coarse-match notice's line from the source. The mounted tests above it in the same `describe` cover that line in the real window (in the list, class `mw-note mw-search-line`, the flow unchanged).

## Churn: predicted and actual

| File | Predicted (`checkpoint.md`) | Actual |
|---|---|---|
| `conestruct/site/components/LocationPickerModal.tsx` | +2 / -8 | +2 / -8 |
| `conestruct/site/app/globals.css` | +1 / -1 | +1 / -1 |
| `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx` | about +8 / -22 | +11 / -24 |

The test file is over the estimate by three added and two deleted lines: the blank line and the test's closing line were not counted, and the reworded comments came out three lines longer between them. Nothing outside the predicted changes is in the diff. The file has one test fewer (the `LocationPickerModal.*` files ran 134 tests before and 133 after).
