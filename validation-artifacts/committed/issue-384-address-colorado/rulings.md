# #384 rulings: a plain address search answers outside Colorado

*Checkpoint: `checkpoint.md` beside this file (2026-10-23). Probe: `probe.txt`. Live run: `live-run.txt`.*

## R1 (Ryan, 2026-10-23): option C, with one change
Ryan, verbatim:

> C, with one change: "Plans cover Colorado roads only." only when the typed text names another state, or Mapbox has no Colorado candidate at all. When Mapbox returns a Colorado candidate for the typed city but not a usable address (the "100 Main St, Aurora" case), say "No match in Colorado for that address. Check the spelling." Add Aurora to the live run. Then build.

## How a plain address resolves (`lib/geocode.ts`, `geocodePlain`)
A trailing `CO` is spelled out as `Colorado` in both lookups, the way the cross-street path does.
1. The lookup runs inside cdot's TIGER Colorado box (`COLORADO_BBOX`, the #376 extent, no new number). A full match (`relevance` 1) stands at once when the text has no comma or ends in Colorado (one request).
2. Otherwise the same lookup runs with no box. Its answer lies outside Colorado and either the text names that answer's state (the last comma part, zip dropped, equals the state's name or postal code from Mapbox's `region` context) or the box found nothing → **422 "outside colorado"** ("Plans cover Colorado roads only.").
3. Box found nothing, nothing outside either → 404 "no match", unchanged.
4. A full match in the box → the answer.
5. A partial match in the box stands when its city (Mapbox's `place` context) is a word in the typed text and, when the text starts with a house number, the hit carries one (`address`).
6. Otherwise → **404 "check address"** ("No match in Colorado for that address. Check the spelling.").

## R2 (R145 self-ruled): a full match in the box is held when another place is last
The live run showed Mapbox fully matching text that names another state inside the box: "Lafayette, LA" → Lafayette Street, Leadville (relevance 1); "Denver, PA" → Parkfield, Denver (relevance 1, `probe` in this session). So step 1 accepts a full match at once only when the text has no comma or ends in Colorado. Otherwise step 2's state check runs first. This costs a second request for an address typed with a city and no state ("1437 Bannock St, Denver"). It's the same trade-off as #376 R2: a second lookup only where the first can't settle the answer. It fits R1 (another state named → 422) and adds no number.

## Rule 5, amended before the commit
On top of `checkpoint.md`'s prediction (option C):
- `scripts/production-env.txt`: the `MAPBOX_TOKEN` cite moves from `lib/geocode.ts:210` to `:221`. The checkpoint predicted no move, but the `MapboxFeature` fields (`id`, `text`, `address`, `context`, `short_code`) were added above that line.
- `lib/geocode-precision.test.ts` gains the `check address` row.
- `lib/geocode.live.test.ts` gains 11 #384 rows (Aurora included, per R1) and the Bannock row's note.
- The plain-address answer for `1437 Bannock St, Denver, CO` is unchanged (same point). Only its request URL changed (`Colorado` spelled out, `&bbox=`).

## Evidence
- `live-run.txt`: real Mapbox on this branch's code, 35 rows. Every cross-street row matches `issue-376-geocode-colorado/live-run.txt`. The #384 rows: the three issue searches answer 404 `check address`; New York, DC, "Lafayette, LA" and "Denver, PA" answer 422 `outside colorado`; Bannock (with and without CO, and misspelled), Longmont and "200 S Public Rd, Lafayette" answer the Colorado address.
- `lib/geocode.test.ts`: 12 stub cases for steps 1–6. 9 of the first 10 were red on the base code (the 10th, "nothing anywhere", reads the same on both).
