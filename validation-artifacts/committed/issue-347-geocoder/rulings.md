# #347 rulings

## Ryan, 2026-10-18 (at the 📋 checkpoint)
> Ruling for #347: Option B.
> Plus, for cross streets with no city typed: if a jurisdiction is selected, search inside its area (from its data/jurisdictions record, no invented numbers). If none is selected, accept only an intersection-flagged result, else use the "Area located" fallback.
> Tests: the four inputs from the issue, the no-city case (with and without a jurisdiction selected), a plain street address (unchanged behavior), and a city that exists in two states (e.g. "Colfax & Main, Aurora"). Record what each one returns.
> No Colorado-only limit (option C) in this fix. Don't ship.

Option B: resolve the typed city first, search the bare street pair inside that city's box, accept only a result Mapbox flags `properties.accuracy: "intersection"`, else fall back.

## R145 self-ruled
1. **Where a jurisdiction's area comes from.** The `data/jurisdictions/*.json` records carry no area field. The repo's sourced areas are the US Census TIGER/Line 2025 Place polygons in `data/boundaries/` (provenance in its `_meta.json`), keyed by the same jurisdiction keys. Each search box is that polygon's extent, built by `scripts/build_jurisdiction_areas.py` into `conestruct/site/lib/jurisdiction-areas.json`; `tests/test_jurisdiction_areas.py` fails on drift. No coordinate is hand-picked (Rule 12). `cdot`, `e470`, `el_paso` and `loveland` have no TIGER place, so a selected one counts as "none selected".
2. **A typed city that is one of our TIGER places uses that polygon, not Mapbox's city lookup.** Live, Mapbox's `types=place` ranks Lakewood, NJ and Englewood, NJ first, so "Colfax & Kipling, Lakewood" would be searched in New Jersey. A typed city with no state, or with CO/Colorado, that exactly names one of the 31 TIGER places (8 supported + 23 in `places_unsupported.geojson`, Aurora among them) uses its box. Any other city, or one with another state named ("Aurora, IL"), goes to Mapbox. This is not a Colorado-only limit: other cities still resolve anywhere.
3. **"Area located" needs an area.** With no city and no usable jurisdiction, an unflagged result has no area to recenter on, so the route answers 404 ("no intersection match") and the picker shows its existing "No match for that address". No pin is placed either way (Rule 10).
4. **What counts as a cross-street pair.** The text before the first comma, split on `&`, `@`, ` and ` or ` at ` into exactly two non-empty parts. Anything else takes the old path unchanged.
