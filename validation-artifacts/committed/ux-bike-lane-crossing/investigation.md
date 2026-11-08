# #449 investigation: a bike lane that crosses the end of the work

Ryan's ruling (cc-queue-ux.md item 6) asks three things first. Answers below, each with its source. Code refs are on `issue-449-bike-lane-crossing` at `0cd02e8`.

Sources: MUTCD 11th Edition (December 2023) Part 6, `validation-artifacts/ta10_flagger/mutcd_part6.pdf` (untracked, #160; sha256 `d8ead2489932fbb742dbbe6213ed6ccb9720e84fd1f21206956469ce4772c9b0`; printed page = 1-based PDF page + 764). The pages quoted are committed as text under `evidence/sources/`. CDOT S-630-1, July 2026 edition, `validation-artifacts/s630-1-2026.pdf` (untracked; sha256 `e6cc37b164be198eaeddd77eabad48ad004d861cd33a072aa768fc7883502971`). Colorado Supplement to the MUTCD, `validation-artifacts/committed/arc12-citation-tail/colorado-supplement-mutcd_final-12302025.pdf` (tracked; sha256 `cd5a778fd5d637d43b0c54dc6f63bf91d76ad028db9fe1e5a32c9992ca0377fd`). Denver DOTI PT-116.1 (2022), committed page text under `validation-artifacts/committed/issue-308-oneway-read-as-divided/sources/`. 02-JURISDICTION-DATA.md is not in this checkout or the main one, so no claim here rests on it.

## 1. What the scan counts as "along"

Nothing. The scan has no notion of direction.

- The scan query asks Overpass for one point per way: `out center tags;` (`src/rules/site_detection.py:151`, and the corridor templates at `:735` and `:784`). `_element_coord` (`site_detection.py:155-163`) keeps that one point, the way's center.
- A cycleway counts when that point lands in a corridor zone, or in the lateral zone within 150 ft of the centerline (`_BUCKET_RELEVANCE_OVERRIDES["bike_facilities"] = {"accept_lateral_within_ft": 150.0}`, `site_detection.py:620`; `_is_feature_relevant`, `:639`). The query box reaches 152.4 m past each end and 100 m to each side (`:627`, `:636`).
- The bucket carries `zone`, `along_station_ft` and `lateral_offset_ft` for that point (`_classified`, `site_detection.py:827`). A way's center point has no bearing, so the bucket can't say whether the way runs with the corridor or across it. A way tagged `cycleway=*` that crosses the end of the work (Franklin St at 1550 E Colfax) and one that runs beside it can produce the same point.
- The NEEDS YOU map (#447, `POST /render/needs-you-map`) does read way geometry, but that is a separate read for the picture; the question words come from fixed strings in `conestruct/site/lib/needs-you-items.ts:311-319` and nothing in the scan bucket feeds them a direction.

So the scan can't tell "crosses the end" from "runs alongside" from data it already has. Under Rule 10 the words must claim neither.

## 2. What MUTCD and CDOT say: crossing versus alongside

MUTCD 11th Ed. Part 6 has no separate provision for a bike lane that crosses the end of a work zone. Its bicycle provisions turn on whether the work affects or closes the bikeway, not on its direction:

- §6N.04 ¶10 (Guidance), p. 844 (`evidence/sources/mutcd11-pdf080-printed844.txt`): "The continuity of a bikeway should be maintained through the TTC zone if practical."
- §6N.04 ¶16 (Guidance), p. 844: "If a portion of a bikeway is to be closed due to construction activities and the detoured bikeway follows a complex path not in the original bikeway corridor, then a full detour plan should be developed and implemented."
- §6N.04 ¶17 (Support), p. 844: "Figures 6P-47 through 6P-51 provide examples and contain additional information for accommodating bicycles through or around typical TTC zones." The two bike-lane typicals are closures: Figure 6P-47 "Bicycle Lane Closure without a Detour (TA-47)", notes p. 952 (`mutcd11-pdf188-printed952.txt`), and Figure 6P-48 "Bicycle Lane Closure with an On-Road Detour (TA-48)", notes p. 954 (`mutcd11-pdf190-printed954.txt`).
- §6I.02 ¶10 (Guidance), p. 812 (`mutcd11-pdf048-printed812.txt`): "The Pedestrian/Bicyclist Detour (M4-9a) sign (see Figure 6I-1) should be used where a pedestrian/bicyclist detour route has been established because of the closing of a pedestrian/bicycle facility to through traffic."
- §6N.12 ¶01 (Support), p. 848 (`validation-artifacts/committed/issue-300-left-side-oneway/sources/mutcd11-pdf084-printed848.txt:57-58`), work at an intersection: "Chapter 6C and Sections 6M.04 and 6N.04 contain additional information regarding the steps to follow when pedestrian or bicycle facilities are affected by the worksite."

CDOT: a text search of S-630-1 (PDF pp. 149-174) finds no bicycle provision; drawings were not read, so a sign on a drawing could be missed. The Colorado Supplement's only Part 9 change is §9E.13 (shared-use path crossing markings, PDF p. 42), not work zones. Neither speaks to crossing versus alongside.

Denver (the 1550 E Colfax jurisdiction), DOTI PT-116.1 (2022): its bike rules also turn on a closure. p. 4 (`denver-pt-116.1-2022-p04.txt:1-4`): "Where a bicycle lane closure is approved, advance signage shall be placed 125 feet or more upstream of the closure taper ..."; p. 6 (`denver-pt-116.1-2022-p06.txt:14`): "Bicycle detour signage (M4-9c) shall be provided at all decision points along a bicycle detour route." Its flowchart asks "What pedestrian/bicycle facilities exist adjacent to project?" (p. 7, `denver-pt-116.1-2022-p07.txt:12`).

Plainly: the sources ask "does the work close or affect the bike lane?", and say nothing specific about which way it runs. Not found in any repo source: a rule for a bike lane that only crosses the end of the work.

## 3. Does the plan add devices for the crossing case today

Yes. Any relevant `bike_facilities` feature sets `bicycle_facility` (`src/api/site_scan.py:116`), and the flag adds 2 M4-9a signs, one at each end of the work, whatever the lane's direction (`src/rules/site_adjustments.py:305-323`, called at `:398-400`). The record's rule line is "MUTCD §9C.101: bicycle facility work zone signing" (`:321`). The question's "No" takes the 2 signs off the plan (`needs-you-items.ts`, the `noLine` consequence).

So at 1550 E Colfax the plan already carries the 2 signs for the crossing lane. The old words invite a careful TCS to answer "No" and remove them; "at or near" keeps the question true to what the scan found, and an honest "Yes" keeps the plan as it is.

## Decision

The words fix changes no device count, spacing or placement: the backend is untouched and Yes/No do what they did. Built under the ruling's second branch.

Not changed, filed for Ryan (device count, his call under Rule 8): whether the 2 M4-9a signs belong on a plan whose bike lane only crosses the end. §6I.02 ¶10 ties M4-9a to an established detour for a closed facility; the plan adds them for any bike lane in the box. The rule line "MUTCD §9C.101" can't be checked: Part 9 isn't in the repo. The sign name "BIKE DETOUR" in the record's action belongs to M4-9c in Table 6I-1, p. 811 (`evidence/sources/mutcd11-pdf047-printed811.txt`: "Bike/Pedestrian Detour" M4-9a, "Bike Detour (with arrow)" M4-9c). Options in the follow-up issue.

## Same gap elsewhere (issue acceptance bullet 2)

- Sidewalks, "Are there sidewalks along the work zone?" (`needs-you-items.ts:286-287`): same gap. Footways count by the same one-point rule with the same 150 ft lateral override (`site_detection.py:619`), so a crossing footway can count. The plan adds barricades and R9-9 signs for it (`site_adjustments.py`, `_adjust_pedestrian_facility`). Not changed here (outside item 6's ruling); in the follow-up.
- School zone, "Is there a school zone along the work?" (`needs-you-items.ts:322-323`): a school is a node or area, not a line, so "along" claims a direction the scan doesn't measure either. In the follow-up.
