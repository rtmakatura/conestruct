# #309 build (R112, R114): lane closure near an intersection on a one-way street

Rulings: `rulings.md` (R112, R114). Checkpoint: `checkpoint.md`. The relay and the mirror land in one commit (R114).

## What changed

**Surface C, the relay.**
- `NearIntersectionScenario` carries #308's `carriageway` facts; the backend recomputes the verdict with the one producer (`src/rules/carriageway.py`).
- The bridge sets `one_way_street` from the verdict.
- `_ensure_carriageway_decided` refuses an `undecided` near-intersection plan with the shoulder kind's 400 (R114 Q4).
- The frontend's near-intersection branch relays `carriageway: c.carriageway`, so a new road clears a stale answer.
- The refusal mirror matches `ni_carriageway` first, as the backend gates first.
- The WHAT band's Carriageway row shows for this kind. On this kind its answer writes only `confirmed`: the kind rejects `divided: true`, and a `divided` verdict keeps today's plan (R114 Q3 (a)).

**Surface A, the mirror.** `generate_near_intersection` emits every mainline sign a second time on a one-way street: same label, same station, at `-ONE_WAY_LEFT_CURB_SIGN_OFFSET_FT` = −4.0 ft. That value is CHOSEN (R114 Q1): 4 ft beyond the left lane edge, inside the drawn left curb strip. All eight mainline labels are mirrored, G20s included (R114 Q2). The cross-street sets are unchanged.

**Surface B, the check and every text that states the signing side.**
- `validate_co_signs_both_sides` needed no change: it already fires on one-way lane closures (#308), and now it passes.
- **Audit:** the narrative's "applied to …" clause and departure (2) use Q5's wording. The Note 8 row's Fig 6P-3 sentence is gated to shoulder closures, since it is about the SHOULDER WORK sign (R90).
- **Plan sheet:** page 1's fine print states departure (2) the same way as the audit. The title reads "Lane Closure Near Intersection · One-Way Street".
- **Crew sheet:** the one-way safety line for a lane closure says both sides. Steps 2, 6 and 7 say where each left-curb sign goes; step 7 was "single side … from centerline".

Every two-way text is unchanged: each change is a branch on `one_way_street`, or on `left_curb_mirror` = one-way and a lane closure.

## Before / after (`probes/r114_render.py`)

FastAPI TestClient on the checkout named on the command line, Overpass stubbed, `MAPBOX_TOKEN` empty in both runs. "Before" is the main checkout at `28ac47e`; "after" is this branch. Output: `r114_before.txt`, `r114_after.txt` and `r114_broadway_<tag>.png` (page 1).

| N Broadway SB at E 11th Ave, one-way | Before (`28ac47e`) | After |
|---|---|---|
| devices | 34 | **42** (+8 at −4.0 ft, same stations) |
| title | Lane Closure Near Intersection · Undivided | Lane Closure Near Intersection · One-Way Street |
| Note 8 row | "Signs on both sides of divided highway", "Required: False. Signs placed: 0 left, 8 right." | "Signs on both sides of one-way street", "Required: True. Signs placed: 8 left, 8 right.", pass |
| narrative | "applied to an undivided highway with single-side mainline signing …" | "applied to a one-way street with every mainline warning and regulatory sign posted on both sides of the roadway per CDOT S-630-1 Sheet 2 General Note 8" |
| departure (2), audit and page 1 | "The opposing mainline direction is not signed …" | "A one-way street has no opposing mainline direction; the plate's opposing-direction signing does not apply." |
| breakdown | G20-1 1, G20-2 1, G20-5P 1, W20-5R 1, W4-2R 1; R2-10 3, R2-11 3, W20-1 3 | 2, 2, 2, 2, 2; 4, 4, 4 |
| page 1 | a two-way road with a centerline, signs on the right | the one-way carriageway (yellow left edge, the left curb strip, arrows in the lanes), the on-page mainline signs on both curbs |

**Two-way control** (the same body with `carriageway {oneway: "no"}`, which the frontend now relays on every road) is identical before and after. Audit and device breakdown match as raw bytes. The XLSX and PDF match as content. They embed a render time (the XLSX's generated-stamp datetime cell and the PDF's metadata), so two renders of one body on one checkout differ in bytes. They're compared on every XLSX cell except datetimes, and on each PDF page's text plus page 1's pixels. The tests pin the same comparisons against the no-facts body.

## Tests

- **New, backend:** `tests/test_r114_one_way_near_intersection.py`, 19 tests. It covers the relay, the mirror (pairs, −4.0 ft, inside the drawn left strip, approach sets unchanged), the Note 8 row, the narrative and departure (2), the title, page 1's fine print, the crew safety line and steps, the breakdown counts, and the PDF and XLSX rendering. It also covers what must not change: a two-way plan (audit and breakdown bytes; XLSX and PDF content; the crew sheet), a `divided` verdict, an `undecided` road's 400, and the operator's answer deciding it.
  - **Red before the code, for the right reason (10):** the relay, the mirror, the Note 8 row, the narrative, the title, the crew safety line, the crew steps, the page-1 fine print, the undecided 400, and the operator's answer.
  - **Vacuously green at first (2):** the left-strip check and the breakdown count. The first had no left signs to check; the second used the wrong row key, so both counts were 0. Both got guards (`assert left`, and the two-way count must be 1). Their next run already had the code partly in, and failed on a missing import, so they weren't observed red for the right reason.
  - **Green from the start (7), because they pin what must not change:** the cross-street sets, the PDF and XLSX rendering, the two-way audit and breakdown bytes (2), the two-way XLSX and PDF content, the two-way crew sheet, and the `divided` verdict.
- **New, frontend:**
  - `auto-apply.test.ts`: the relay, stale facts cleared, the `ni_carriageway` refusal and its order.
  - `PlanDetails.carriageway.test.tsx`: the row on this kind, writing only the answer.
- **Unchanged and green:** `test_case_18.py`, the four `ni-grid-*` corpus snapshots, `test_near_intersection_voice.py`, `test_near_intersection_generator.py`, the crew narrative tests, every other near-intersection test, and `adv-ni-denver.json`.
- Full backend suite: 2610 passed, 2 skipped. Frontend: scenarios, bands and road-detection, 535 passed, plus `tsc` clean.

## Follow-up (R114 Q3 (a))

Divided near-intersection plans: `issue-draft-divided-ni.md`, for the chat to repost.
