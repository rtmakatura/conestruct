# #554 checkpoint: a weak geocoder match gets a notice and no pin

`/start 554`, 2026-11-23. Branch `issue-554-weak-match-notice` on `origin/issue-548-prod-check` (`94a7d95`, which is on main `284cc8e`). The branch carries the evidence commit `94a7d95` (production check for #548), so it ships with this fix. #553 is folded in as a second item, as Ryan ruled.

Baseline, before any change: `lib/geocode.test.ts`, `lib/geocode-precision.test.ts`, `app/api/geocode/route.test.ts`, `lib/search-coords.test.ts`, `components/LocationPickerModal.coords-bar.test.tsx`, `components/LocationPickerModal.state-contract.test.tsx`: 376 passed.

## Plan

1. **The problem.** `conestruct/site/lib/geocode.ts:234-242` hands back any Mapbox answer of type `address` that `geocodePlain` lets through, and `conestruct/site/components/LocationPickerModal.tsx:1337-1355` (the search form) and `:1191-1206` (the open-time lookup of a saved address) pin it. `39 N, 44.4` pins Holly and `105° W, 39.7401` pins Walsh, with no notice.
2. **The ruling.** Ryan, 2026-11-23, in the `/start 554` message (verbatim in `rulings.md`). No R-number.
3. **The change.** The server marks an answer weak; the window shows "Closest match: <place>. Check the pin before you go on." in the search's floating list and moves nothing. #553: the coordinate parser reads at most 100 characters, and minutes or seconds need a digit after the point.
4. **Rule 5 prediction.** Below.
5. **The proof.** The recorded Mapbox answers (`probe/`), unit tests on the recorded shapes (`lib/geocode.test.ts`), the route test, mounted tests at both senders (Rule 11), a red proof. After the ship, the production check types the two texts on the real site.

## Rule 5 prediction (written before the diff)

| File | Predicted |
|---|---|
| `conestruct/site/lib/geocode.ts` | +50 / -3 |
| `conestruct/site/lib/geocode.test.ts` | +70 / -1 |
| `conestruct/site/app/api/geocode/route.ts` | +6 / -1 |
| `conestruct/site/app/api/geocode/route.test.ts` | +12 / -0 |
| `conestruct/site/lib/geocode-precision.ts` | +8 / -0 |
| `conestruct/site/lib/geocode-precision.test.ts` | +8 / -1 |
| `conestruct/site/components/LocationPickerModal.tsx` | +22 / -4 |
| `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx` | +65 / -1 |
| `conestruct/site/lib/search-coords.ts` (#553) | +10 / -3 |
| `conestruct/site/lib/search-coords.test.ts` (#553) | +30 / -0 |
| this folder | new |

Behaviour changes, each deliberate:

- (A) A street-address answer that is weak (relevance under 0.9, or a typed number the answer doesn't hold) shows the weak-match notice at both senders. No pin, no camera move, no road lookup, and the saved address text is not set. Before: a pin, a fly and a road lookup.
- (B) An answer whose type is neither a street address nor an area (a place of interest, an unknown or missing type) shows the weak-match notice and moves nothing. Before: a place of interest pinned; an unknown type showed the town notice and recentred.
- (C) #553: text longer than 100 characters is never read as coordinates (it is an address). Minutes or seconds written `44.` are not a number, so that pair is an address. Before: both were read.

Stays byte-identical: a town or area answer (the town notice and the recentre, #513/#543); the cross-street path; every 4xx answer and its line; every other answer of the coordinate parser; `globals.css` (the notice reuses `mw-note mw-search-line`, no new hex); `/api/distance`; all Python.

The `/api/geocode` answer gains two fields, present only on a weak answer: `weak: true` and `placeName`. Every other answer is byte-identical.
