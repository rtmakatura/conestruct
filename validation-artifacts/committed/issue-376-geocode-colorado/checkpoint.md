# #376 checkpoint: a cross-street search answers outside Colorado

*2026-10-23. Branch `issue-376-geocode-colorado`, built on #374's evidence `8955314`.*

## Why this stops (R145)
The fix the issue proposes ("bound every cross-street search to Colorado, whatever the jurisdiction") reverses #347 ruling 2, which Ryan accepted:

> Any other city, or one with another state named ("Aurora, IL"), goes to Mapbox. This is not a Colorado-only limit: other cities still resolve anywhere.
> (`validation-artifacts/committed/issue-347-geocoder/rulings.md:20`)

A reversal is an R145 stop reason.

## Where the bug is
- `conestruct/site/lib/geocode.ts:131`: a typed city that isn't one of our 31 TIGER places goes to Mapbox's city lookup (`types=place,locality&limit=1`) with no box. Mapbox reads "Lafayette, CO" as California and "Lafayette" as Louisiana.
- `geocode.ts:112`: the selected jurisdiction applies only when no city is typed, so CDOT plus a typed city skips #352's Colorado extent.
- `geocode.ts:162`: only a strict area (no city typed) checks that the corner lies inside the box. When a city comes back with no extent, the search runs on nearness alone.

## Mapbox's answers, probed 2026-10-23 (city lookup, `types=place,locality&limit=1`)
The box is cdot's TIGER Colorado extent from `lib/jurisdiction-areas.json` (`-109.060204,36.992449,-102.041522,41.003444`).

| Typed city | No box | Colorado box | relevance (box) |
|---|---|---|---|
| Lafayette, CO | Lafayette, California | Lafayette, Colorado | 1 |
| Lafayette | Lafayette, Louisiana | Lafayette, Colorado | 1 |
| Lafayette, Colorado | Lafayette, Colorado | Lafayette, Colorado | 1 |
| Springfield | Springfield, Illinois | Springfield, Colorado | 1 |
| Aurora, IL | Aurora, Illinois | **Aurora, Colorado** | **0.5** |
| Lafayette, LA | Lafayette, Louisiana | **Lafayette, Colorado** | **0.5** |

With the box, Mapbox swaps a typed other state for the Colorado place of the same name and drops relevance to 0.5. Accepting that answer would be a silent substitution (Rule 10).

## Options
**A (recommended): Colorado only, and a typed other state is refused.**
- Every city lookup carries the Colorado box. A Colorado place comes back only on a full match (Mapbox `relevance` 1, meaning every word typed matched). Anything less answers 404 "no match", so "Aurora, IL" and "Lafayette, LA" are refused instead of swapped.
- Every corner must lie inside Colorado, whatever the area, so a search on nearness alone can't land out of state.
- With CDOT selected the same bound holds, which covers the issue's third row.
- Reverses #347 R2: "Colfax & Main, Aurora, IL" goes from Aurora, Illinois (coarse) to 404.
- Side effect: a misspelled city that Mapbox only partly matches also gets 404, where today it lands on Mapbox's best guess. The operator retypes it.

**B: Colorado only, and take Mapbox's swap.** The same box with no relevance check. "Aurora, IL" lands on Aurora, Colorado. Less code, but it's the silent substitution above.

**C: keep #347 R2 for a named state.** Bound to Colorado only when no state is typed or the state is CO/Colorado, or when CDOT is selected. "Aurora, IL" still resolves in Illinois. This passes all four acceptance rows, but it keeps an out-of-state answer on a site that works only in Colorado, and it needs state parsing.

## Rule 5 prediction (option A)
- Changes: `lib/geocode.ts` (the city lookup carries the Colorado box and needs relevance 1; every corner checked against Colorado); `lib/geocode.test.ts` ("Aurora, IL" flips to 404, plus new cases for the four issue rows and the relevance refusal); `lib/geocode.live.test.ts` if it pins Aurora, IL.
- Byte-identical: the plain-address path (its one unchanged request, `geocode.test.ts:74`); typed TIGER places (Denver, Aurora, …) and no-city searches (same requests, same answers); #352's Fairplay, Pueblo, El Paso County, Loveland, e470 and no-jurisdiction 422 cases; the route and the picker.

## Out of scope (to file)
The plain-address path (`geocode.ts:195`, "123 Main St, Lafayette") has no Colorado bound either. Changing it moves the request that `geocode.test.ts:74` pins, so it gets its own issue.

## Proof
- `lib/geocode.test.ts` against the stubbed Mapbox: the four issue rows, Aurora, IL and Lafayette, LA refused, and a box-less city whose corner lies outside Colorado refused. Red against the base.
- Production check after the ship: the four issue searches plus #352's cases through `/api/geocode`, committed under `validation-artifacts/committed/issue-376-geocode-colorado/prod-check/`.
