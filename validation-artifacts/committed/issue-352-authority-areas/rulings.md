# #352 rulings: the search area for a jurisdiction with no TIGER place

Built on #368's production-check evidence `38ca7e6` (`issue-368-prod-check`), which ships with this branch.

Governing rulings, from #347 (`validation-artifacts/committed/issue-347-geocoder/rulings.md`):
- Ryan, 2026-10-18: a street pair with no city typed and a jurisdiction selected is searched "inside its area (from its data/jurisdictions record, no invented numbers)".
- Ryan, 2026-10-18, second ruling: no city and no jurisdiction searches the combined area of the 31 TIGER places. If no intersection-flagged result lands inside it, the answer is "Add a city to search cross streets." with no pin.
- #347 R145 self-ruling 1: every box is a TIGER polygon's extent, built by script, with drift tested. `cdot`, `e470`, `el_paso` and `loveland` have no TIGER place and counted as "none selected".

## Rulings

- **R1 (R145 self-ruled): each record's own `authority` picks its polygon.** For a jurisdiction record with no TIGER place in `data/boundaries/`, the search area is:
  - `authority: "state"` (cdot): the extent of all 64 Colorado counties (STATEFP 08) in TIGER/Line 2025 `tl_2025_us_county.zip`. The counties tile the state, so this is Colorado's extent.
  - `authority: "county"` (el_paso, name "El Paso County"): that county's TIGER extent (NAMELSAD match).
  - `authority: "city"` (loveland): the one incorporated TIGER place with that name.
  - any other authority (e470, `toll_authority`): no sourced polygon. It keeps the combined area and the 422 prompt. The issue's "E-470: its corridor" option has no source in the repo, so per Rule 12 it is left out.
  
  The extents are unsimplified TIGER `shape.bbox` values, written by `scripts/build_boundaries.py` to `data/boundaries/extents.json`. The `.json` name keeps them out of the backend's `*.geojson` boundary glob (`src/rules/boundaries.py:71`). `scripts/build_jurisdiction_areas.py` copies them into `jurisdiction-areas.json` as `authority_areas`, and `tests/test_jurisdiction_areas.py` keeps the drift test. No coordinate is hand-picked.
- **R2 (R145 self-ruled): the statewide box follows the combined box's rule, not a city's.** A corner found under cdot must lie inside Colorado, and a miss answers 422 ("add a city"). Recentering on the middle of Colorado would be a useless coarse match. El Paso County and Loveland follow the same rule as Denver: a miss recenters on the area as a coarse "place" match.
- **R3 (R145 self-ruled): the authority areas are searched only for a selected jurisdiction.** They are never matched as a typed city (`areaForName` is unchanged). So "X & Y, Loveland" still goes to Mapbox's place lookup as before. Typed-city behavior is out of scope.
- **R4 (R145 self-ruled): the prompt wording stays "Add a city to search cross streets."** A typed city already resolves anywhere (#347 R145 2), so the prompt names something the operator can add. The issue's acceptance accepts "a prompt that names what to add".

**Flag for Ryan:** with CDOT selected, a common pair can land on a corner in a town the operator didn't mean, because Mapbox ranks by nearness to the middle of Colorado. Live: "Colfax & Main" + CDOT now lands in Strasburg, about 34 mi east of Denver; before, it answered 422. The pin is a real Colfax & Main, and the operator sees it on the map before confirming. If Ryan would rather keep 422 for CDOT, he can reverse R2 (the statewide box) and keep El Paso and Loveland.

## Rule 5 prediction (before the diff)

- **Moves:** cross-street searches with no city typed and `cdot`, `el_paso` or `loveland` selected.
  - cdot searches Colorado's box instead of the combined box. A flagged corner inside Colorado lands. Anything else still answers 422.
  - el_paso and loveland search their own boxes. A flagged corner lands, and a miss recenters on the area (before: the combined box, then 422).
- **Byte-identical:**
  - Every other jurisdiction key, every typed-city search, every street address, and e470.
  - Every backend output and every `data/boundaries/*.geojson` and `_meta.json`; a rerun of `build_boundaries.py` rewrites them unchanged.
  - The existing lines of `jurisdiction-areas.json`, which only gains the `authority_areas` block.
- **Tests:** one #347 pin moves on purpose: `geocode.test.ts` "a jurisdiction with no TIGER place (cdot) is treated as none". It is replaced by the #352 block.
