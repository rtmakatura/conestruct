# 📋 #309 checkpoint (R112): lane closure near an intersection on a one-way street

Branch `issue-309-oneway-near-intersection`, off main `d6d2a49`. No code yet. Line refs are at `d6d2a49`.

## 1. Payload-level repro (first, as R112 asks)

`probes/ni_broadway_probe.py`, run on `d6d2a49` → `probes/ni_broadway_probe-d6d2a49.txt`. FastAPI TestClient, Overpass stubbed, no network. The body is the near-intersection kind on N Broadway SB at E 11th Ave (39.73370, -104.98753): urban_arterial, 30 mph, 4 lanes × 10.5 ft (the schema caps `lanes` at 4; OSM says 5, #310), 500 ft of work, two signalized E 11th approaches at station −100 ft. It carries #308's `carriageway` facts as the shoulder kind relays them for Broadway: `oneway: "yes"`, `highwayClass: "primary"`, `twinSearched: true`, no twin.

What the plan does today:
- **34 devices. All 8 mainline signs sit at +46.0 ft, the right side only:** W4-2R 957.5, W20-5R 1057.5, W20-1 1157.5, R2-10 1107.5, G20-5P 250, G20-1 600, G20-2 −311 and R2-11 −211.
- **The audit's Note 8 row passes, and says why wrongly:** `"label": "Signs on both sides of divided highway"`, `"detail": "Required: False. Signs placed: 0 left, 8 right."`, `pass: true`.
- **The narrative claims the wrong road:** "…applied to an undivided highway with single-side mainline signing (both-sides posting applies to divided highways, multi-lane ramps, and one-way streets per CDOT S-630-1 Sheet 2 General Note 8)…".
- **The one-way fact is dropped without a word.** With and without `carriageway`, every output is identical (audit, device breakdown, PDF 6599 bytes, XLSX 6659 bytes). This kind has no `carriageway` field, and pydantic drops unknown keys. That is a Rule 10 shape of its own.
- **The plan sheet draws a two-way road** (centerline, `num_lanes` lanes each way), because `params.one_way_street` is never set for this kind.

## 2. Note 8, quoted with its cite

CDOT Standard Plan S-630-1, issued July 01, 2026, Standard Sheet No. 2 of 26, General Notes, Note 8:

> "8. All warning and regulatory signs shall be posted on both sides of the roadway on divided highways, multi-lane ramps, one-way streets, and as directed by the Engineer, except where only one shoulder is closed (ex: Case 11 on Sheet 7)."

Source in the repo: `validation-artifacts/committed/issue-308-oneway-read-as-divided/sources/s630-1-2026-pdf150.txt:76-80` (the PDF's p. 150), with the sheet stamp "Standard Sheet No. 2 of 26" in the same extract. I checked the quote against that file for this checkpoint. The same text is in `src/rules/tables.py:292-296`.

A lane closure is not "where only one shoulder is closed", so the exception doesn't apply. On a one-way street, every mainline warning and regulatory sign is owed on both sides. (02-JURISDICTION-DATA.md, CLAUDE.md's fact authority, isn't in the repo; `execution-sequence.md:18` lists it as missing.)

## 3. What #308 already did (three of #309's premises are stale)

- `ScenarioParams.one_way_street` exists (`src/rules/validators.py:244-252`). The "not currently expressible" text #309 quotes is gone.
- **The check already fires for this closure type.** `validate_co_signs_both_sides` (`validators.py:947-1014`) runs on `params.is_divided or (params.one_way_street and params.closure_type != "shoulder")` (:974-976). That covers #243 R54's single-shoulder exception. This kind is `closure_type="lane"`, so the check fires as soon as `one_way_street` reaches it. It runs on mainline signs only (:1926-1931).
- **The audit's Note 8 row already counts one-way.** `audit.py:941-943` sets `note8_road = is_divided or one_way_street` and `both_sides_required = note8_road and not one_shoulder_closed`.
- Moved lines: #309's schemas 768-776 is now 862-870 and 1326-1337 is now 1453-1474. audit 1180-1188 is now 1241-1249. The near-intersection branch of `auto-apply.ts` is now 662-689.

So what's left is the relay, the generator, and text that states what the plan does. One ordering hazard follows from this: production fails closed on a validator error (`render_api.py:860-876`, a 500 `internal_layout_validation_failed`). Setting `one_way_street` before the generator mirrors would make every one-way near-intersection plan 500. Surfaces A and C land in one commit.

## 4. The build

### Surface C: relay (frontend + schema)
- `NearIntersectionScenario` gets #308's `carriageway: CarriagewayFacts | None` (`schemas.py:134-165`). The backend recomputes the verdict with the one producer (`src/rules/carriageway.py:48-74`), exactly as the shoulder kind does (`schemas.py:545-558`).
- The bridge (`schemas.py:1453-1474`) sets `one_way_street = carriageway_verdict() == "one_way_street"`.
- The frontend's near-intersection branch (`auto-apply.ts:662-689`) relays `carriageway: c.carriageway` unconditionally, copying the shoulder branch at 568-572, so a new road clears a stale answer. The TS type gets the field (`lib/scenarios/types.ts:119-146`).
- **Q4** decides the undecided verdict.

### Surface A: generator (`src/generation/layout.py:1407-1652`)
When `params.one_way_street` is set, every mainline sign is emitted a second time with the same label and station on the left curb. That's 8 on Broadway, plus one more for each additional G20-5P on longer zones. This is the pairing `generate_lane_closure_divided` uses (887-1204, same label and station at ± offset). The cross-street approach sets (step 10, 1602-1640) don't change. The docstring at 1418-1419 ("Note 8 median-side mirroring dropped") is rewritten to say when it's dropped and when it isn't.

The left offset is **Q1**. The divided generator's `-sign_offset` is −46 ft on Broadway, which would land about 38 ft beyond the drawn left curb strip. That's #308 R94's floating-barricade failure. The validator wouldn't catch it, because it only checks that the offset's sign is opposite (`validators.py:996`).

### Surface B: check + every text that states the signing side
- **The check:** no code change needed (§3). It fires once C sets the flag, and A satisfies it.
- **Audit narrative** (`audit.py:1241-1249`): on a one-way street the "applied to…" clause states what the plan does (Q5). Two-way stays byte-identical.
- **Audit departure (2)** (`audit.py:1257-1259`, "The opposing mainline direction is not signed (single-side undivided convention…)"): on a one-way street there's no opposing direction. Wording in Q5.
- **Audit Note 8 row** (`audit.py:940-972`): the label becomes "Signs on both sides of one-way street" (existing code), and the detail reads "Required: True. Signs placed: 8 left, 8 right." One fix: the row appends `FIG_6P3_NOTE1_SENTENCE` on every one-way plan (959-960). That sentence is about the SHOULDER WORK sign for a shoulder closure (`audit.py:224-228`, R90), so it's wrong on a lane closure. I'd gate it to `closure_type == "shoulder"`. Every plan that has it today is a shoulder plan, so their output is byte-identical. The Denver sentence (961-962: Denver's documents set no sign-side rule) stays; it's still true.
- **Crew sheet** (`src/narrative/templates/base.md.j2:122-124`): the one-way safety note says "signs go on the closed shoulder's side only, under the single-shoulder exception…", which would be false on this plan. It gets a lane-closure branch: "One-way street: all warning and regulatory signs are posted on BOTH sides of the roadway per CDOT S-630-1 Sheet 2 General Note 8. Offsets are measured from the left edge of the roadway." The offset-origin line (`crew_narrative.py:855-858`) already reads "the left edge of the roadway" on one-way plans; that's correct here and needs no change.
- **Plan title** (`validators.py:386-387`): the near-intersection branch is checked before the one-way branch, so a one-way plan would still read "Lane Closure Near Intersection · Undivided". It becomes "Lane Closure Near Intersection · One-Way Street", with the same no-count convention as #308's shoulder title.
- **Already right once the flag is set, no change:**
  - the plan sheet's one-way carriageway (yellow left edge, the left curb strip, arrows in the lanes: `plan_sheet.py:98-101, 263-299, 4429-4436`);
  - #308 R88's CHOSEN-widths disclosure (`audit.py:1385-1389, 1940-1955`). The 8 ft curb strip is this kind's fixed width (`schemas.py:1214-1215`), and the disclosure's numbers are this plan's.

## 5. Questions to rule

**Q1. Where does the left-curb sign go?** I recommend **−4.0 ft**: 4 ft beyond the left lane edge, inside the 8 ft left curb strip. That mirrors the right side's `lane_edge + 4.0` (`layout.py:1448`) about the carriageway rather than about offset 0, because offset 0 is the left lane edge on a one-way street (`plan_sheet.py:270-276`). The value is CHOSEN, since no source sets a lateral offset, and the audit already discloses the one-way widths as CHOSEN. The alternative, the divided generator's `-sign_offset` (−46 ft), floats off the drawn road (R94).

**Q2. What gets mirrored?** I recommend **all eight mainline labels**: W4-2R, W20-5R, W20-1, R2-10, every G20-5P, G20-1, G20-2 and R2-11. Note 8 says "all warning and regulatory signs". `note8_counts_sign` (`tables.py:328-336`) also counts the G20 guide signs, and the divided generator mirrors them, so leaving them out would fail the existing check. Cross-street sets stay as they are. W4-2R is mirrored with its own label, as the divided generator does (956-977).

**Q3. A near-intersection plan whose verdict is `divided`** (a one-way-tagged road with a same-name twin within 100 m, such as Colorado Blvd). This kind rejects `divided` (`schemas.py:862-870`), and the frontend hard-codes `divided: false` for it (`auto-apply.ts:678`). So today it's built as an undivided road with right-side signs: the same Note 8 gap, on a different road type. Options:
- **(a) Keep today's behavior** for `divided` in this arc. #309 is the one-way case. I draft a follow-up issue for divided near-intersection plans. *Recommended:* it keeps R112's scope, and nothing that renders today starts refusing.
- **(b)** An honest 400 on `divided`, until divided near-intersection plans are built. This makes the gap visible, but plans that render today would start refusing.
- **(c)** Build `divided` like the one-way carriageway, mirroring to the median side. The geometry is the same, but the title, the Note 8 label and the plan sheet would need their own divided wording. That's a bigger arc.

**Q4. The `undecided` verdict** (a one-way-tagged street-class road where the twin search didn't run). I recommend **the shoulder kind's treatment**:
- `_ensure_carriageway_decided` (`render_api.py:426-438`) covers this kind too: an honest 400 `carriageway_undecided`.
- The WHAT band's carriageway row (`PlanDetails.tsx:50`, now `kind !== "shoulder"`) shows for it.
- The pre-generate refusal mirror (`auto-apply.ts:213`) matches it.

This is the relay-fact pattern: honest 400 plus a recovery affordance. The alternative, building as not-one-way when undecided, is a silent default (Rule 10).

**Q5. Wording on a one-way street** (two-way unchanged, byte for byte):
- The narrative's "applied to …" clause: "applied to a one-way street with every mainline warning and regulatory sign posted on both sides of the roadway per CDOT S-630-1 Sheet 2 General Note 8".
- Departure (2): "(2) A one-way street has no opposing mainline direction; the plate's opposing-direction signing does not apply." This keeps the three-departure numbering.
- The crew-sheet line and the title as in §4.

## 6. Rule 5 churn prediction

| Plan | Surface | Today | After |
|---|---|---|---|
| Two-way near-intersection, no `carriageway`, or one whose verdict is `not_applicable` | everything | — | **byte-identical** (R112). Pinned by the existing corpus snapshots, plus a new fixture that sends the same body with and without `carriageway {oneway: "no"}` and compares audit, breakdown, PDF and XLSX bytes. No audit surface echoes `carriageway` (grep at `d6d2a49`). |
| Broadway SB, one-way | placements | 34 | **42**: +8 at −4.0 ft (W4-2R, W20-5R, W20-1, R2-10, G20-5P, G20-1, G20-2, R2-11), same stations |
| | device breakdown / XLSX / quote | 1 of each mainline sign | 2 of each of those 8 labels |
| | audit Note 8 row | "…of divided highway", "Required: False. Signs placed: 0 left, 8 right.", pass | "…of one-way street", "Required: True. Signs placed: 8 left, 8 right.", pass, plus the Denver sentence on Denver plans |
| | audit narrative, departure (2) | the undivided wording | Q5 |
| | audit pending list | — | + `one_way_street_widths_chosen` (#308 R88, existing) |
| | plan title | "Lane Closure Near Intersection · Undivided" | "· One-Way Street" |
| | plan sheet | two-way road, centerline | one-way carriageway: yellow left edge, left curb strip, arrows in the lanes, left-curb signs |
| | crew sheet | no one-way line; offsets "from centerline" | the lane-closure one-way line; offsets "from the left edge of the roadway" |
| One-way with pedestrian sidewalks | site adjustment | far-side Type III pair | R94's work-side-only gate (`site_adjustments.py:170`) now applies: −2 Type III, `devices_added` 6 → 4. **Zero extra churn if Part 3 (R113) ships first**, as the ship order has it: that makes work-side-only universal. |
| One-way, verdict `undecided` | API | renders as two-way | **400 `carriageway_undecided`** + the WHAT band's carriageway row (Q4) |
| Verdict `divided` | everything | — | unchanged (Q3 (a)) |
| Shoulder plans on a one-way street | audit Note 8 row | `FIG_6P3_NOTE1_SENTENCE` appended | unchanged: the new gate is `closure_type == "shoulder"`, which they all are |

Tests:
- **Unchanged, all two-way fixtures:** `tests/s630/test_case_18.py` (asserts every mainline offset is > 0 and one sign per label per approach), `tests/corpus/test_near_intersection.py` + the four `ni-grid-*` snapshots, `test_near_intersection_generator.py`, `test_near_intersection_voice.py`, `test_cross_surface_near_intersection.py`, and the endpoint, schema, work-start and gate tests. The tiering fixture `adv-ni-denver.json` is two-way and doesn't change.
- **New, backend:** a Broadway one-way fixture at the payload level, covering placements (the pairs, −4.0 ft, inside the drawn left strip), the Note 8 row, the narrative, the title, the crew line, breakdown counts and the validator passing. Plus the two-way byte-identical fixture above, the undecided 400, and the `divided` verdict unchanged.
- **New, frontend:** the near-intersection branch relays `carriageway` (template `auto-apply.test.ts:403-438`); the undecided refusal mirror; the PlanDetails row on this kind.

## 7. Principles (the one UI surface that changes)

The WHAT band's carriageway row (FLOW.md step 2, the estimator) now shows on a near-intersection plan when the road is an undecided street-class one-way (Q4). It's the same row and copy the shoulder kind has shown since R107. P2 (one control per fact) holds, because the row replaces nothing on this kind; `showsDividedToggle` is shoulder-only. P1 (nothing moves unasked): the row is present before Generate, and no new row forms after it. No other mounted surface changes. The rest of this arc is the PDF, XLSX, crew sheet and audit.

## 8. Distinct from

- **#310** (the schema's 4-lane cap): Broadway is probed at 4 lanes.
- **#300** (left-side work on one-way streets): this arc keeps the closure on the rightmost lane.
- **Part 3 / #311**: the sidewalk barricades. See the churn row.
