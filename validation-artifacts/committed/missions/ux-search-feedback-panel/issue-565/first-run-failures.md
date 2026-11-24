# #565: the first test run after the source change

2026-11-24, in `conestruct/site`, the source changed and no test yet updated:
`npx vitest run --reporter=dot components/LocationPickerModal components/tap-targets.test.ts lib/geocode-precision.test.ts lib/design`

Baseline on the base sources (`e3646e0b`, the same command): 23 files, 311 passed.
This run: 5 files failed, 54 tests failed, 257 passed (311). Every failure is a test that pinned the floating list, the old wording, or the type census; none was re-run until its file was updated.

## The 54, by file

`components/LocationPickerModal.coords-bar.test.tsx` (47; all read `search-list`, which is gone), by describe block:
- "#541 ruling 1: the search box takes coordinates": 9 (the eight "Enter places the pin; nothing goes to /api/geocode" formats, and "a failed address search says so in the floating list, not in the page's flow")
- "#541 ruling 1: out of range or swapped": 5
- "#541 ruling 1: the open-time lookup of a saved address (the other geocode sender)": 1 ("a saved address that is out-of-range coordinates shows the line and is not geocoded")
- "#543: the notices float in the search's list": 4
- "#544: bracketed coordinates, and the choice's numbers": 4
- "#545 ruling 1: the bar's mark is a ring until a pin exists": 1 ("out-of-range coordinates place no pin, and the mark keeps data-pin=\"false\"")
- "#548: half a coordinate goes to the geocoder and places no pin": 16 (the fifteen "typed and Enter" cases, and "a full pair out of range keeps #541's range line and is not geocoded")
- "#554: a weak match is named in the list and nothing moves": 7

`components/LocationPickerModal.state-contract.test.tsx` (2; the town line's old words):
- "#347 cross-street search > the corner not found inside the area: the area answer recenters and asks for a pin"
- "stale suggestions: pin moves invalidate instantly > a coarse geocode (locality) fires ZERO detect calls and asks for a pin"

`components/tap-targets.test.ts` (1; it pinned `.mw-search-list { position: absolute`):
- "R138 tap targets > #541: the coordinates line is 44 px and holds no control; the 'Did you mean' choice is 44 px"

`lib/geocode-precision.test.ts` (2; the two reworded lines):
- "geocodeErrorMessage (#347) > 502 reads Geocoding failed (502)"
- "geocodeErrorMessage (#347) > 503 reads Geocoding not configured"

`lib/design/type-census.test.ts` (2; the first draft gave `.mw-feedback-what` its own `font-size`, a new census site):
- "#263 type census - globals.css font-sizes > every other font-size site is a named exception or a declared-debt row (new size/site fails)"
- "#263 type census - the exceptions are the ruled set and the pins are the sources' figures > CENSUS_PINS equal the figures read from the sources (the README quotes these)"

## After

- The type census pair: fixed in the source (the first line is a `.mw-line` with a modifier that sets no size), not by editing a pin. Passed in the next run.
- The other 52: each test updated to read the box (`search-feedback`) or the new words. All passed in the next run.
- Final run, the same command: 24 files, 356 passed (the new `LocationPickerModal.search-feedback.test.tsx` adds 36, `geocode-precision.test.ts` adds 9).

No test failed for a reason other than the predicted churn, so none was re-run on its own.
