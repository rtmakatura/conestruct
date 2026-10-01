# issue-305-picker-null-points — the rulings this arc is built under

**Issue:** #305 — "Picker road lookup throws on an Overpass way with a null point: Federal returns non-JSON and the picker offers no road".
**Arc:** a small fix arc, red-first on the real fallback capture; no checkpoint (Ryan, below).
**Base:** `c055262` = `origin/main` = prod `healthz`, 2026-10-01.

This file is the arc's authority; every commit on this branch cites it.

---

## #305's body, verbatim (fetched 2026-10-01 with `gh issue view 305`; open; 0 comments)

Labels: bug, priority-high, frontend. Opened 2026-10-01.

> ## Problem
>
> `buildResponse` in `conestruct/site/app/api/road-bearing/route.ts:391-394` projects every geometry segment with `a.lat`, `b.lat` unchecked, and runs outside any `try` (`:571`). When the fallback mirror `overpass.openstreetmap.fr` answers with way 42125193 (Pavlodar, KZ; null points at 15 and 39, the answer behind #304), the route throws:
>
> > TypeError: Cannot read properties of null (reading 'lat')
>
> Next.js returns a non-JSON 500 and the picker shows no candidate, so the operator can't confirm the road. Same defect as #304, on the TypeScript side. The route's own point reads at `:305` and `:372` already check `typeof ... === "number"`; this one doesn't.
>
> Classification: behavior-breaking on any stretch where the fallback mirror answers. Violates Rule 10: the failure gives the operator no reason.
>
> ## Reproduction
>
> 1. `probes/road_bearing_null_points.ts` (`validation-artifacts/committed/scan-refusal-rate/`) calls the route's `POST` with fetch stubbed to #304's captures: the primary capture returns HTTP 200 (North Federal Boulevard); the fallback capture throws the TypeError.
> 2. On prod, `/api/road-bearing` at 39.7342642691076, −105.02504468168067 returned non-JSON on 4 of 4 tries (18:57–18:59Z, 2026-09-30); the #243 sweep's picker offered no road at that pin.
>
> ## Impact
>
> - The operator can't pick the road at all on affected stretches, and gets no reason.
>
> ## Proposed solution
>
> Skip any segment whose endpoints lack numeric `lat`/`lon`, as #304 (a) did in `site_detection.py`, and drop ways whose extent misses the query's `around:` circle, as #304 (d). Regression test on `tests/fixtures/site_scan/federal_fallback_null_points.json`.
>
> ## Acceptance
>
> - The fallback capture yields 200 with the same candidates as the primary capture.
> - Complete geometry: candidates unchanged (existing `route.test.ts` green).
>
> ## Reference
>
> - `conestruct/site/app/api/road-bearing/route.ts:391-394`, `:571`
> - #304 (`69ef64d`, `849a06b`), the backend twin.
> - Priority-high: blocks road confirmation on affected stretches.

---

## Ryan's instruction, verbatim (2026-10-01)

> Filed: picker crash #305 (priority-high), double scan #306. #292 commented.
>
> Fix #305 first: small arc, red-first on the real fallback capture (tests/fixtures/site_scan/federal_fallback_null_points.json), same pattern as #304 (a) and (d). Give me the go.
> Then investigate #306 with a checkpoint. No code until I rule.
