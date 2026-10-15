# Rule 5 outcome: `issue-322-trunk-divided` (#322)

Prediction: `prediction.md` (committed `25fd750`, with the prod capture `before-prod-ef8f573-scenario.json`).

## Built

- **The verdict.** `src/rules/carriageway.py` gains `DIVIDED_BY_CLASS = {"trunk", "motorway"}`. A one-way
  carriageway of those classes is `divided` (rule 2, before the twin test); the operator's answer still wins
  (rule 1).
- **The mirror.** `conestruct/site/lib/road-detection/carriageway.ts` gains `dividedByClass()`, and
  `carriagewayVerdict` applies the same rule.
- **The relay.** `classify.ts` builds the carriageway facts for those classes too, so a near-intersection
  request carries them.
  - `carriagewayApplies` (the twin question and the PlanDetails carriageway row) is unchanged, so a trunk road
    shows no "same-name carriageway … m away" row.
- **The left-side refusal** (`render_api` `_side_refusal`): a trunk or motorway keeps cause `highway` and its
  pre-#322 words.

## Deviation from the prediction

The prediction said a left side asked for on a trunk shoulder plan would be refused for cause `divided`
instead of `no_facts`. The first full run showed that message would end "or change Carriageway", and a trunk
road shows no Carriageway row. So divided-by-class roads keep the `highway` cause and words they had. That
message is unchanged, which is better than predicted (`tests/test_stale_left_side.py` passes as it was).

## Before and after: S Santa Fe Dr, trunk stretch (`39.69322, -104.99425`, way 16981493, US 85)

The scenario is the one each site sent (`capture322.cjs`):

- **Before (prod `ef8f573`):** `carriageway: null`.
- **After (branch):** `carriageway: {oneway: "yes", highwayClass: "trunk", twinDistanceM: 153.97}`.

The twin is beyond 100 m, so only the class rule makes it divided.

`gen322.py` then added the cross street the picker marks by a map click: the nearest named one from #285's
read, South Platte River Drive (OSM node 176064824), "120 ft SW of South Platte River Drive". It also added
the right side. The plan was generated through each site's proxy.

| | Note 8 row | signs placed | page 1 MHT type |
|---|---|---|---|
| **before** | Signs on both sides of divided highway · **Required: False** | **0 left, 9 right** | LANE CLOSURE NEAR INTERSECTION · UNDIVIDED |
| **after** | Signs on both sides of divided highway · **Required: True** | **9 left, 9 right** | LANE CLOSURE NEAR INTERSECTION · DIVIDED HIGHWAY |

The after audit's narrative reads:

> applied to one carriageway of a divided highway with every mainline warning and regulatory sign posted on
> both sides of the roadway, the median side included, per CDOT S-630-1 Sheet 2 General Note 8

Evidence: `before-prod-ef8f573/` and `after-local/` (`audit.json`, `plan.pdf`, `plan-p1.png`,
`scenario-generated.json`).

## Byte-identical (`same322.py`)

| plan | scenario the site sent | generated scenario | audit JSON | page 1 pixels |
|---|---|---|---|---|
| Lafayette St, two-way undivided | identical | identical | identical | no difference |
| N Broadway SB, one-way street (Note 8 "one-way street", 8 left, 8 right) | identical | identical | identical | no difference |

That is prod `ef8f573` against the branch. The PDF bytes carry a creation stamp, so page 1 is compared as
pixels.

Also:

- **Shoulder on the trunk** (`tests/test_trunk_divided.py`): the audit and device breakdown are equal with
  and without the new carriageway relay.
- **Snapshots:** every audit and corpus snapshot is unchanged (none moved).

## Tests

- **`tests/test_carriageway.py`:**
  - a one-way trunk or motorway is `divided` (also with no twin search, and with `-1`);
  - a two-way trunk is `not_applicable`;
  - ramps keep their rule;
  - the operator's answer wins.
- **`tests/test_trunk_divided.py`:**
  - the Santa Fe fixture plans "Required: True, 9 left, 9 right";
  - without the relay it was "Required: False, 0 left, 9 right";
  - shoulder is unchanged.
- **`lib/road-detection/classify.test.ts`:** the one test that pinned the old behaviour, "trunk one-way …
  no carriageway facts relayed", now pins the relay. A two-way trunk relays nothing.
- **Suites:**
  - vitest: 215 files, 2217 tests.
  - `tsc` clean; `next build` clean.
  - pytest: 2844 passed, 2 skipped.

## #322's own repro was wrong

#322 named `39.70000, -104.98770`. That point is S Santa Fe Dr's **primary** stretch (a same-name twin at
14.5 m, verdict `divided`), which #312 already planned. The trunk stretch is further south.

- **Evidence:** `issue-pin-prod-ef8f573-scenario.json`, prod's request at that pin, captured by
  `capture322.cjs`. It carries
  `carriageway: {oneway: "yes", highwayClass: "primary", twinDistanceM: 14.53, twinSearched: true}`. The
  first capture at that pin was overwritten by the trunk capture and re-taken for this file.
- **Correction posted:** https://github.com/rtmakatura/conestruct/issues/322#issuecomment-6181904047

**Repair (diff-verifier, cycle 1):** the primary-stretch claim had no committed evidence. It now has the
capture above.

**Notes:**

- `prediction.md` cites `trunk322.py` for the list of one-way trunk carriageways (Santa Fe, Hampden,
  Vasquez). That one-off Overpass query was run from the session's scratch folder and is not in this
  folder. Its result is quoted in the prediction.
- The cross street's identity (South Platte River Drive, OSM node 176064824) is recorded in each
  `scenario-generated.json` (`meta.intersection`). The "120 ft SW of" text was gen322's printed output.
