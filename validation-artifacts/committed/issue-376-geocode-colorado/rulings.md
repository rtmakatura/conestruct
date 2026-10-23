# #376 rulings: a cross-street search answers outside Colorado

*Checkpoint: `checkpoint.md` beside this file (2026-10-23).*

## R1 (Ryan, 2026-10-23): option A, Colorado only. This reverses #347 ruling 2.
Ryan, verbatim:

> A. It reverses #347 ruling 2; record that. When the typed text names another state (or Mapbox's best answer lies outside Colorado), the message says plans cover Colorado roads only, not "no match". A half match inside Colorado says no match and asks the operator to check the spelling. File the plain-address issue as planned. Then build.

**Reversal recorded.** #347 ruling 2 (`issue-347-geocoder/rulings.md:20`) said: "This is not a Colorado-only limit: other cities still resolve anywhere." From #376 on, a typed city in a cross-street search resolves only inside Colorado. "Colfax & Main, Aurora, IL" used to land on Aurora, Illinois (coarse). Now it answers 422 with "Plans cover Colorado roads only."

The box is cdot's TIGER Colorado extent from `lib/jurisdiction-areas.json` (built from `data/boundaries/`, same source as #352). No new number.

## How a typed city that isn't one of our TIGER places resolves
1. Mapbox's city lookup runs inside the Colorado box. A full match (`relevance` 1: every word typed matched) inside the box is the city, as before.
2. Otherwise the same lookup runs with no box (Mapbox's best answer):
   - a full match outside Colorado, meaning the text names a place elsewhere ("Aurora, IL", "Lafayette, LA"): **422 "outside colorado"**;
   - or, when the box found nothing at all, any answer outside Colorado (R1's "Mapbox's best answer lies outside Colorado"): **422 "outside colorado"**.
3. A partial match inside the box (R1's "half match inside Colorado", e.g. a misspelling): **404 "check spelling"**.
4. Nothing anywhere: 404 "no match", unchanged.

Every corner found must lie inside the Colorado box, whatever the area. That covers a city that comes back with no extent, which is searched on nearness alone.

## Messages (search bar, `lib/geocode-precision.ts`)
- 422 "outside colorado" → "Plans cover Colorado roads only."
- 404 "check spelling" → "No match in Colorado for that city. Check the spelling."
- Every other status and reason reads as before ("Add a city to search cross streets.", "No match for that address", …).

The route already sends the reason as the response body (`app/api/geocode/route.ts:35`). The picker now reads it.

## R2 (R145 self-ruled): two Mapbox requests only when the boxed lookup isn't a full match
The no-box lookup in step 2 runs only after the boxed lookup fails to fully match. A Colorado city costs one request, as before.

## Rule 5, amended before the commit
On top of `checkpoint.md`'s prediction:
- the picker (`components/LocationPickerModal.tsx`) reads the reason body through `geocodeFailureMessage`, and `lib/geocode-precision.ts` gains the two lines (R1's messages);
- `lib/jurisdiction-areas.ts` exports `COLORADO_BBOX` (the existing cdot extent, no new number);
- `scripts/production-env.txt`: the `MAPBOX_TOKEN` cite moves from `lib/geocode.ts:182` to `:210` because the edit shifted the line (`tests/test_vercel_env_check.py` checks it);
- `lib/geocode.live.test.ts` gains the six #376 cases. Its run is `live-run.txt` beside this file.

## Evidence
- `live-run.txt`: real Mapbox on the branch's code. The four issue searches answer the Lafayette, Colorado corner (39.957998, -105.090397). "Aurora, IL" and "Lafayette, LA" answer 422 `outside colorado`. Every other #347/#352 row matches `issue-352-authority-areas/outcome.md`. Live, Mapbox fully matched the misspelled "Lafayete" to Lafayette, Colorado, so the `check spelling` path is proved only against the stub (`lib/geocode.test.ts`).

## Filed
- #384: the plain-address path (`geocode.ts:223`) has no Colorado bound either ("100 Main St, Lafayette, CO" lands in Darlington, Wisconsin). https://github.com/rtmakatura/conestruct/issues/384
