# #347 rulings

## Ryan, 2026-10-18 (at the 📋 checkpoint)
> Ruling for #347: Option B.
> Plus, for cross streets with no city typed: if a jurisdiction is selected, search inside its area (from its data/jurisdictions record, no invented numbers). If none is selected, accept only an intersection-flagged result, else use the "Area located" fallback.
> Tests: the four inputs from the issue, the no-city case (with and without a jurisdiction selected), a plain street address (unchanged behavior), and a city that exists in two states (e.g. "Colfax & Main, Aurora"). Record what each one returns.
> No Colorado-only limit (option C) in this fix. Don't ship.

Option B: resolve the typed city first, search the bare street pair inside that city's box, accept only a result Mapbox flags `properties.accuracy: "intersection"`, else fall back.

## Ryan, 2026-10-18 (second ruling, on flag 2: Plainwell, MI)
> Ruling on flag 2: for cross streets with no city typed and no jurisdiction selected, search inside the combined area of the 31 TIGER places in data/boundaries/ (derived by the same script, no hand-picked numbers). If no intersection-flagged result lands inside it, show "Add a city to search cross streets." and drop no pin. Plain street addresses are unchanged.
> Re-run the live table: "Colfax & Main" with no city and no jurisdiction must no longer land in Michigan. Every other row should give the same result as before.
> Flags 1 and 3 are accepted as self-ruled.

Built as: `combined` in `jurisdiction-areas.json` is the extent of all 31 place boxes (same script). The search is bounded by it, and a flagged hit must also lie inside it. Otherwise the route answers **422** ("add a city"), and the picker's shared `geocodeErrorMessage` shows "Add a city to search cross streets." with no pin.

## R145 self-ruled
1. **Where a jurisdiction's area comes from.** The `data/jurisdictions/*.json` records carry no area field. The repo's sourced areas are the US Census TIGER/Line 2025 Place polygons in `data/boundaries/` (provenance in its `_meta.json`), keyed by the same jurisdiction keys. Each search box is that polygon's extent, built by `scripts/build_jurisdiction_areas.py` into `conestruct/site/lib/jurisdiction-areas.json`; `tests/test_jurisdiction_areas.py` fails on drift. No coordinate is hand-picked (Rule 12). `cdot`, `e470`, `el_paso` and `loveland` have no TIGER place, so a selected one counts as "none selected" (accepted by Ryan; under the second ruling it therefore searches the combined area).
2. **A typed city that is one of our TIGER places uses that polygon, not Mapbox's city lookup.** Live, Mapbox's `types=place` ranks Lakewood, NJ and Englewood, NJ first, so "Colfax & Kipling, Lakewood" would be searched in New Jersey. A typed city with no state, or with CO/Colorado, that exactly names one of the 31 TIGER places (8 supported + 23 in `places_unsupported.geojson`, Aurora among them) uses its box. Any other city, or one with another state named ("Aurora, IL"), goes to Mapbox. This is not a Colorado-only limit: other cities still resolve anywhere. (Accepted by Ryan.)
3. ~~**"Area located" needs an area.** With no city and no usable jurisdiction, the route answered 404.~~ Superseded by Ryan's second ruling above.
4. **What counts as a cross-street pair.** The text before the first comma, split on `&`, `@`, ` and ` or ` at ` into exactly two non-empty parts. Anything else takes the old path unchanged.
5. **A 422 for "add a city".** The picker maps failed answers by status. A distinct status keeps "No match for that address" (404) for a typed city Mapbox cannot place. Both picker branches now use one `geocodeErrorMessage` (`lib/geocode-precision.ts`).
