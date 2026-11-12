# #525 red proof

The new tests were run against the old code: `route.ts` and `LocationPickerModal.tsx` swapped back to base `e331b15` (`git show e331b15:<path>`). The new tests and the new `same-street.ts` stayed in place. Then the fixed files were restored.

`npx vitest run --reporter=verbose app/api/road-bearing/route.colfax-pennsylvania.test.ts components/LocationPickerModal.map-window.test.tsx -t "525"`:

```
× route.colfax-pennsylvania.test.ts > lists Pennsylvania Street once, at its nearest way's distance
  → expected [ …(2) ] to have a length of 1 but got 2
× route.colfax-pennsylvania.test.ts > keeps East Colfax Avenue one grouped entry (#507 unchanged)
  → expected [ …(3) ] to have a length of 2 but got 3
× route.colfax-pennsylvania.test.ts > names the cross street on each entry
  → expected undefined to be 'East Colfax Avenue'
✓ route.colfax-pennsylvania.test.ts > reads Pennsylvania's OSM tags as two-way (Rule 12)
× LocationPickerModal.map-window.test.tsx > #525: the street met at the pin is named on the line, after the distance
  → expected 'Traffic both ways · 2 m from your pin' to be 'Traffic both ways · 2 m from your pin…'
× LocationPickerModal.map-window.test.tsx > #525: with no cross street, or no travel answer, the line is as before
  → expected 'Traffic both ways · 20 m from your pin' to be 'Traffic both ways · 20 m from your pi…'
Tests  5 failed | 1 passed | 10 skipped (16)
```

The Rule 12 test pins the recorded tags, so it passes on both. `same-street.test.ts` can't run on the old code (the module is new).

After the fix, the same command passes, along with the rest of the affected test files.

## Gate round 2: the class test and implied one-way (reviewer findings 1 and 5)

I wrote the new tests in `same-street.test.ts` first and ran them against the round 1 `same-street.ts` (no class test; a missing `oneway` read as two-way):

`npx vitest run --reporter=verbose lib/road-detection/same-street.test.ts -t "class test"`:

```
× a same-name one-way link nearer the pin never folds its mainline, which still pairs with its twin
  → expected [ 'l', 'w' ] to deeply equal [ 'l', 'e', 'w' ]
× an untagged motorway never folds as two-way (implied one-way, #514)
  → expected [ 'a' ] to deeply equal [ 'a', 'b' ]
✓ a motorway tagged oneway=no still folds its reversed piece
Tests  2 failed | 1 passed | 15 skipped (18)
```

The link folded the mainline carriageway `e` into itself, so `groupCarriageways` had nothing to pair with `w`. After the fix, all 18 pass. The changed-file set ran 20 files, 240 tests passed.
