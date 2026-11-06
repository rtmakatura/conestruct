# Full vitest run failures, in the order they happened

## Run 1 (2026-11-06, source changed, before the census fix): 2 failed, 2835 passed, 1 skipped

- `lib/design/type-census.test.ts` > #263 type census: globals.css font-sizes > every other font-size site is a named exception
- `lib/design/type-census.test.ts` > #263 type census: the exceptions are the ruled set and the pins are the sources' figures > (second test; name cut in the summary)

Both also failed when `type-census.test.ts` was run alone: the census counts `font-size` sites, and the bar's Try again button adds one. See `rulings.md`, T17. The census test wasn't changed; the button now inherits its type.
