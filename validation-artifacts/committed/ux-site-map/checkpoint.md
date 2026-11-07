# #447 checkpoint: the investigation the issue asks for

Worktree `.claude/worktrees/issue-447`, branch `issue-447-needs-you-site-map`, on `issue-446-prod-check` (`dfb3a9c`, #446's production-check evidence, which ships with this).

## 1. Which questions exist, and what each carries on the wire

`buildQuestions` (`lib/needs-you-items.ts:372`) makes a question of a DETECTED scanned flag. There are five:

| Flag | Bucket | OSM elements (`_SCAN_SELECTORS`) | Location on the wire | Geometry on the wire |
|---|---|---|---|---|
| `pedestrian_facility` | `sidewalks` | ways | none | none |
| `bicycle_facility` | `bike_facilities` | ways | none | none |
| `adjacent_intersection` | `intersections` | nodes (signals, crossings) | none | none (a point at most) |
| `adjacent_interchange` | `interchanges` | nodes and ways | none | none |
| `school_zone` | `schools` | nodes and ways | none | none |

The bucket on the wire carries `detected`, `count`, `nearest_distance_m/ft`, `details` and up to 5 `features` (`label`, `zone`, stations, offsets, `distance_to_anchor_m`), no coordinate. The scan set is `out center tags`: Overpass sends a centre point and the scan discards it after classifying. Hence X1.

## 2. Can `static_aerial.py` take a frame and overlays per question?

Not yet. `band_image_url` knows the pin and the corridor. A new `question_image_url` beside it uses the same helpers (`fit_view`, `zone_parts`, `pin_marker`, `_TILE_PX`). A path can't dash (X2). A failed fetch answers the same JSON shape as `/render/corridor-map`.

## 3. Mapbox Static Images per plan

Price: "Up to 50,000" requests a month free, then $1.00 per 1,000 (mapbox.com/pricing, read 2026-11-06; matches #301's checkpoint). The existing band asks 3 to 6 per plan session.

New: one image per question viewed, one more per zoom step not seen yet. Answers don't change the request's key, so answering doesn't ask again. Applying changes the scenario, so a re-opened question asks once more.

| Case | Questions | Images added per plan |
|---|---|---|
| Typical | 2 | 2 |
| Every question, each zoom step, then re-viewed after Apply | 5 | 5 x 5 x 2 = 50 |

Worst case the free 50,000 covers about 900 plans a month (56 images each with the band's 6); typical, about 6,000 (8 each). Past that it would cost $1.00 per 1,000 images: 5 cents per worst-case plan. **No change in spend until then**, so this isn't a park-list stop (X8). This counts the repo's numbers only; the Mapbox account's actual monthly use isn't visible from here. Ryan should read it there.

The new Overpass read is free, and 1 call per question per 600 s at most in a container.

## 4. Rule 5 churn prediction

**Changes (stated):**
- Backend: new `POST /render/needs-you-map`; `static_aerial.question_image_url` and its dash helpers; `site_detection.subject_geometry`; `run_site_scan`'s corridor building moves into a helper with no change in behaviour.
- Frontend: new `/api/needs-you-map`, `fetchNeedsYouMap`, `lib/needs-you-map.ts`, `components/NeedsYouMap.tsx`; `QuestionSteps` gains an optional `media` slot; `QuestionFlow` gains an optional `scenario`; `NeedsYouQuestion` gains `mapLabel` and `mapKey`; `useFrameSize` is exported from `BandAerial`; CSS for the map; `middleware.test.ts` gets the new route's row (amended before the diff: its table test requires it).
- Every NEEDS YOU card is taller by the map and its key.
- `issue-446-prod-check`'s evidence commit `dfb3a9c` ships with this.

**Phone fix round (amended before its diff):** below 480 px the frame is 4:3, so the image is requested at 4:3 (one Mapbox request as before, a taller picture at the same price); the label and link leave the frame there; the intersection question's picture draws one ring and frames on it, at every width. `NeedsYouMap` gains a wrapper element around the frame at every width. At 480 px and up the card looks the same except for the intersection picture. Nothing else moves.

**Stays byte-identical:**
- The scan's query, buckets, memo key and token; the audit JSON; the PDF; `/render/corridor-map`'s answers; the WHERE band and its CONFIRM card (no `media`).
- The questions, their order, answers, consequences, and what each answer writes.

## 5. P1 to P22 on the changed surface

P1: the frame holds its height through an `aspect-ratio`, loaded or not. P11: the map's vocabulary (`--dim`, the `--lv-work` hex) is the map keys'. P13: the zoom and street-level controls are reads and stay live under the write lock. P16: while a zoom step is drawn the previous picture stays. Rule 13: the two lines differ by dash as well as hue; the key says it in words.
