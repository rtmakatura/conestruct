# oneway-read-as-divided — 📋 checkpoint (written before Ryan rules)

**Issue:** not yet filed (the draft is in the chat). It comes from #300's checkpoint, finding 5, and is ordered first by #300 ruling R78. `rulings.md` is beside this file.
**Base:** `a5b4e12` = `main` = prod `healthz`. Investigation only: no product code.
**Prod requests made: none** by this arc (#300's one `/healthz` read at 10:59 MDT is the session's only one). Road data came from the OSM API and one Nominatim lookup. Overpass wasn't used, so the #292 windows are untouched.
**Evidence:** `probes/twin_probe.py` → `probes/twin_probe.txt` (5 Denver roads). The prod PDF render is in `../issue-300-left-side-oneway/probes/` on branch `issue-300-left-side-oneway`.

## The answer, in brief

1. **The rule is from v1, it was never sourced, and it was misnamed.** `classify.ts:130-137` makes every `primary` + `oneway` way `divided: true`. It arrived in `1603ab4` (2026-05-07, "v1") with the comment "One-way primary in either direction implies a couplet → divided". That commit's own help text says "Divided/undivided depends on couplet detection — verify against site photos."
   - In traffic engineering a *couplet* is a pair of one-way streets (Broadway and Lincoln). The rule uses the word for one carriageway of a divided road, the opposite case.
   - #123 (`4e7cbea`) changed only the rationale string ("Display-only: no classification value changes").
   - No committed ruling gives a reason for the value.
2. **OSM tags alone can't tell the two apart.** Both are `highway=primary`, `oneway=yes`. The geometry can: a divided road's other carriageway is a **same-name way running the opposite bearing close by**, and a couplet's partner has a different name a block away. `dedup.ts:3-8` already relies on this ("180°-opposed carriageways … divided same-name roads stay distinct"). Measured on 5 Denver roads (`probes/twin_probe.txt`):

   | Road (all `primary`, `oneway=yes`) | Nearest opposite-bearing way with the same name, measured from the pin's way |
   |---|---|
   | North Broadway (couplet with Lincoln) | **none** within the box (~280 m N–S) |
   | North Lincoln Street (couplet with Broadway) | **none** |
   | South Colorado Blvd (CO 2), divided | **14.8 m** |
   | North Federal Blvd (CO 88), divided | **21.8 m** |
   | North Speer Blvd (Cherry Creek between), divided | **55.0 m** |

   Five roads aren't enough to choose a threshold (Rule 12). The test also only uses data the frontend already fetches out to 50 m (`app/api/road-bearing/route.ts:35`, `SEARCH_RADIUS_M = 50`). At 50 m, Speer's twin is probably missed, and Speer would read as a one-way street. That's wrong in the other direction, and the left edge #300 offers there would be the median side.
3. **Flipping `divided` alone makes Broadway wrong in a new way.** The undivided branch draws `num_lanes` lanes **each way with a yellow centerline**. The title would become "Shoulder Closure · 8-Lane Undivided" (`validators.py:363-365`, `2 * num_lanes`). A one-way street needs its own fact on the wire and its own branch in the backend (relay-fact pattern, Rule 3).
4. **There's a live compliance gap next door.** Near-intersection rejects `divided` (`schemas.py:768-776`), hard-codes `is_divided=False` (`:1326-1337`), and narrates "single-side mainline signing (both-sides posting applies to … one-way streets per … Note 8)" (`audit.py:1180-1188`). Nothing relays one-way for this kind. So a Case 18 plan on Broadway runs today with single-side signing, and S-630-1 Note 8 requires both sides there (the shoulder exception doesn't apply).
5. **Recommendation:**
   - **(B)** One-way street becomes its own fact end to end. The backend decides `one_way_street` / `divided` / `two_way` from relayed raw facts: `oneway` plus the twin evidence, with a wider twin radius once it's measured.
   - Where the evidence is missing, the WHAT band's existing One-way row asks the operator.
   - **Split the near-intersection Note 8 gap into its own issue**, filed now, because it changes a generator's signing.

---

## 1. How the one boolean flows today

**Frontend producer**
- `conestruct/site/lib/road-detection/classify.ts`:
  - `:130-137`: primary + oneway → `divided: true, dividedFromOneway: true`; rural gets `roadType: "rural_divided"`.
  - `:122-128`: trunk is divided by class.
  - `:146-165`: secondary, tertiary and unclassified one-ways are `divided: false`, so **a secondary one-way street is already drawn today as a two-way undivided road**. That's the same defect in its other form.
  - `:364-379`: the provenance text is "OSM oneway=yes (couplet → divided)".
- `classify.ts:78-90` `lanesPerDirectionFromTags`: a one-way returns the total (Broadway 5). The fixture's `lanes: 4` comes from `clampLanesToDomain` (`lib/scenarios/validation.ts:69-72`, `MAX_LANES_PER_DIRECTION`), called at `auto-apply.ts:460`. It's not a turn-lane subtraction.
- `auto-apply.ts:489-514` (shoulder) writes `divided` + `roadType` and no one-way fact. Only the flagger relays `oneway` (`:539`). Near-intersection (`:597-624`) relays neither.
- **Operator controls:**
  - `PlanDetails.tsx:297-322`: the "Divided highway" toggle shows only for `urban_arterial`, and flipping it forces `lanes: v ? 2 : 1` (`:317`).
  - `detected-rows.ts:301-315`: the One-way row exists for the flagger only. Its comment says the other kinds "fold one-way into `divided`/`roadType`".
- `lib/scenarios/centerline-relay.ts:26-34`: `meta.roadDirection {osmBearingDeg, oneway}` is relayed **only under `pinModel === "work_start"`**. `highway_class` and the raw `lanes` tag are never relayed.

**Backend consumers of `divided`.** Only shoulder reads `scenario.divided`; every other kind hard-codes it.
- `src/api/schemas.py:1186-1198`: `is_divided`, shoulder width (`plan_shoulder_width_ft`, 10 ft divided vs 8 ft), and the choice of the divided or undivided generator. Also `:484`, the drawable-width check.
- `src/generation/layout.py:102-103`: taper and tangent minimums keyed on `is_divided`. `:171-600`: the divided shoulder mirrors every sign to the left (house choice, #243 R54).
- `src/rendering/plan_sheet.py`:
  - `:98-100`, `_y_of :236-251`, `_draw_road :264-298`: the median, or a two-way road with a yellow centerline.
  - `:4335-4342`: the opposing arrow.
  - `:941-951, 1418-1423`: signs snapped to the median.
  - `:1121`: site strips.
  - `:2538-2542`: the legend's ROAD GEOMETRY.
  - `:1794-1802`: the title.
- `src/rules/validators.py`:
  - `:363-365`: the title (`"Shoulder Closure · Divided Highway"` or `"… {2*num_lanes}-Lane Undivided"`).
  - `:910-937` `validate_co_signs_both_sides`: returns early when not divided. Its docstring says to re-add one-way streets as their own flag.
  - `:1691`: the W21-5aR count.
- `src/api/audit.py`:
  - `:890-911`: the Note 8 row, labelled "Signs on both sides of divided highway". The single-shoulder exception is read only when divided.
  - `:381-395, :1257-1295`: the Case 11 wording, "on divided highway" / "single-side signing per Note 8".
- `src/api/render_api.py:372-374`: the single-lane gate is skipped when divided ("Divided carriageways tag `lanes` per-carriageway"). **If primary one-ways stop being divided, a `lanes=1` one-way primary (common on `primary_link`) starts drawing that 400.** It needs a one-way exemption.
- `src/rules/tables.py:292-304`: `both_sides_signage_required_on = ("multi_lane_ramp", "one_way_street")`. **Nothing reads it.**
- XLSX, device list and quote have no divided logic; they follow the placements.

**Prior approval of the conflation.** `validation-artifacts/committed/issue-243-note-8/checkpoint.md:139-141`: "So a one-way street reaches Note 8 as 'divided', which is right for Note 8, since the note names one-way streets." That holds for Note 8 alone. It doesn't hold for the drawing, the title, the generator or the shoulder width, so this arc supersedes it with a stated reason.

## 2. What the sources say

- **CDOT S-630-1 (July 2026), Sheet 2, General Note 8** (verified in #300's checkpoint, `sources/s630-1-2026-pdf150.txt` on that branch): "All warning and regulatory signs shall be posted on both sides of the roadway on divided highways, multi-lane ramps, one-way streets, and as directed by the Engineer, except where only one shoulder is closed (ex: Case 11 on Sheet 7)."

  So *divided highway* and *one-way street* are named separately, and both owe both-sides posting. A one-way street isn't a divided highway in the standard's own words, which is why one boolean can't carry both.
- **MUTCD 11th Ed., Notes for Fig 6P-3 (TA-3), Note 1, p. 864:** "A SHOULDER WORK sign should be placed on the left-hand side of the roadway for a divided or one-way street only if the left-hand shoulder is affected." For a right-shoulder closure on a one-way street, the sources call for **no left-side mirror**. Today's divided generator mirrors every sign (R54's house choice).
- **Not found:** any MUTCD or S-630-1 definition that equates a one-way street with a divided highway. A shoulder width or lane-width rule specific to one-way streets. (The 10 ft / 8 ft split in `plan_shoulder_width_ft` is a project value; its source wasn't traced in this checkpoint.)

## 3. Options

**A. Classify-only flip** (primary + oneway → `divided: false`). *Not recommended.*
- **Pros:** two lines of change.
- **Cons:**
  - Broadway's page 1 becomes a two-way 8-lane road with a yellow centerline, titled "8-Lane Undivided".
  - The shoulder narrows 10 → 8 ft, the lane width moves 10.5 → 11, the taper shortens, and the single-lane gate starts firing on `lanes=1` one-ways.
  - Real divided primaries such as Colorado, Federal and Speer silently become undivided.

**B. One-way street as its own fact, end to end.** *(Recommended.)*
- **The wire relays raw facts, never the verdict:**
  - `oneway` (already in `roadDirection`, relayed whatever the `pinModel`);
  - the highway class;
  - **the twin evidence**: the distance to the nearest same-name way at the opposite bearing within a twin radius, or "none found".
- **The backend predicate** (one producer) returns `carriageway: "one_way_street" | "divided" | "two_way"`, plus `"unknown"` when a primary one-way's evidence is missing (no twin search ran).
- **`ScenarioParams` gains `one_way_street: bool = False`.**
- **Downstream:**
  - page 1 gets a one-way branch: lanes all in one direction, two curbs, one arrow, no centerline or median;
  - the title reads "Shoulder Closure · One-Way Street";
  - Note 8's validator and audit row trigger on `divided or one_way_street`, minus the single-shoulder exception, and the row is relabelled;
  - the single-lane gate exempts one-way streets;
  - the Case 11 wording is corrected.
- **Operator:** the One-way provenance row (`detected-rows.ts:301-315`) shows on every kind. When the backend says `unknown`, it's a needs-you confirmation ("One-way street / One side of a divided road"), never a silent default (Rule 10). This costs a question, but only on primary one-ways with no twin evidence (P18).
- **Twin radius:** 50 m comes free from the existing fetch but misses Speer-class medians. Widening it adds payload to `road-bearing`'s Overpass call. The number must come from a measured sample (Rule 12; see ruling 4).
- **Pros:** the drawing and title match the street (P21). Note 8 runs on one-way streets as written. #300's R80 gets a real predicate. Right-side plans on two-way roads, motorways and trunks stay unchanged.
- **Cons:** frontend, wire and backend all change. It changes prod output on every primary one-way, and with ruling 3 on secondary one-ways too.

**C. Operator only:** every primary one-way is `unknown` and gets asked. *An alternative to B's twin test.*
- **Pros:** no threshold to measure.
- **Cons:** one more question on every downtown one-way (P18). Colorado and Federal, which the evidence settles, get asked anyway.

**D. Status quo plus a disclosure line** on the sheet. *Not recommended.* It leaves a wrong drawing in place, and that's what Rule 10 forbids.

## 4. Rule 5: the churn prediction (for B)

**Behavior changes, deliberate and stated:**
1. **Primary one-way streets with no twin** (Broadway, Lincoln, and Stout St in the existing test):
   - the page-1 drawing becomes one-way;
   - the title changes to "One-Way Street";
   - the audit's Case 11 wording and the Note 8 row label change;
   - the shoulder width and the lane width fit follow the one-way branch's value (the ruling to set);
   - the taper and tangent minimums follow `is_divided=false`;
   - the left mirror signs drop if ruling 2 says right curb only, which lowers device counts. Broadway's prod plan totals 42 devices; the exact delta is computed before the diff, not after.
2. **Primary one-ways with a twin** (Colorado, Federal): unchanged, still divided.
3. **Secondary, tertiary and unclassified one-way streets** (today two-way undivided): under ruling 3 they also take the one-way branch.
4. **The flagger** keeps its one-way refusal. **Near-intersection** is unchanged in C if ruling 5 splits it out.

**Assertions predicted to change:**
- `conestruct/site/lib/road-detection/classify.test.ts:183-196`: "classifies primary + oneway as divided (couplet)" (Stout St) flips.
- `classify.test.ts:482-486`: the couplet source string changes.
- `classify.test.ts:503-518`: the invariant goes vacuous and gets rewritten.
- `tests/test_note8_both_sides.py:151-186`: "The N Broadway SB shape… divided". The numbers don't change (it builds `ScenarioParams` directly), but the docstring describes Broadway wrongly and is corrected.

**Predicted byte-identical:**
- all 90 JSON files under `tests/snapshots/` (16 audit + 74 corpus; recounted, and none encodes a one-way street);
- the tiering, `pdf_worst_case` and `cdot_s630_typicals` fixtures;
- `tests/fixtures/corridor/broadway-sb.json` and `components/__fixtures__/audit-shoulder-full.json` (recorded bodies; not re-recorded unless ruled);
- every committed evidence directory.

This holds because `one_way_street` defaults to `False` and no existing request sends the new relay fields. **Standing predictor check:** if the new `carriageway` verdict is echoed into the audit JSON or any snapshot serializer for *every* plan, every baseline above moves. B keeps it out of the response for non-one-way plans, or this row flips before the diff.

**If `broadway-sb.json` is re-recorded** (ruling 6): it's consumed by `test_corridor_agreement.py` (7 cases) and `test_corridor_map.py` (~20 calls). These are agreement checks, so expect green except the zone lengths that depend on the taper. The buffer pins (570/650/645) don't depend on divided.

**New tests** (Rule 11):
- the predicate, one regression fixture per gate: twin found → divided; none found → one-way street; no search → unknown → needs-you;
- payload level: Broadway shoulder → one-way branch, no median placements, title;
- rendered output: page 1 has no median band or opposing arrow;
- mounted flow: the One-way row on a shoulder plan, plus the unknown confirmation.

## 5. Rulings needed

1. **Approach:** B (one-way as its own fact, twin evidence, operator on unknown)? Or C (operator always)? *Recommended: B.*
2. **Signing for a one-way-street shoulder closure:** right curb only, per Note 8's single-shoulder exception and TA-3 Note 1? Or keep R54's house mirror? *Recommended: right curb only.* It's what the sources say, and it removes devices from today's Broadway plans (stated in §4).
3. **Secondary, tertiary and unclassified one-way streets:** bring them onto the one-way branch in C? Today they're drawn as two-way. *Recommended: yes.* Same defect, same fix.
4. **Twin radius:** measure a sample first, at least 20 Denver-area primary one-ways (couplets and divided roads), before choosing the number, which will be CHOSEN with its measurement (Rule 12)? Or ship at the free 50 m and send misses to the operator? *Recommended: measure first.* The 50 m default would read Speer as a one-way street.
5. **Near-intersection Note 8 on one-way streets:** split it into its own issue now (draft to chat)? *Recommended: split.* It's a live gap, and closing it changes the Case 18 generator's signing.
6. **Shoulder width and lane-width fit** on a one-way street: today's 10 ft (divided) / 8 ft (undivided) values aren't traced to a source here. Which applies, and does the build checkpoint trace it?
7. **Vocabulary:** retire "couplet" in the code for this case; it means the opposite in the field.

## 6. Not done

- No product code. No prod request. No Overpass.
- The twin probe covers 5 roads; a ruling-4 sample would extend it.
- The #300 branch's evidence (its PDF render, cited source pages) stays on `issue-300-left-side-oneway`. This arc links to it rather than copying it.

---

## Addendum after the rulings (R83–R89 and the R80 confirmation, 2026-10-05; `rulings.md`)

Everything above this line is the checkpoint as ruled on (`fd662dc`). It is left as written. This addendum covers the three rulings that call for evidence before any code: R86, R84 and R88. No product code has been written.

### R86: the twin-radius sample (30 roads asked, 28 measured)

`probes/twin_sample.py` → `twin_sample.txt` / `twin_sample.json`; the three surprises are checked in `probes/twin_sample_inspect.txt`. Method:
1. Nominatim, inside Denver's bounding box, lists candidate OSM ways for each road name.
2. The OSM API keeps the first one tagged `oneway=yes`.
3. From that way's middle node, the OSM API map call (±0.0035°: about ±390 m N–S and ±300 m E–W) gives the nearest **same-name (or same-ref) one-way way at the opposite bearing (Δ ≥ 150°)**, measured from the pin way.

No Overpass, no prod. "Expected" is the label I wrote before measuring, with its basis in the probe's source.

| Road (OSM name) | Class | Expected | Twin | Note |
|---|---|---|---|---|
| North Broadway | primary | one-way street | none | |
| North Lincoln Street | primary | one-way street | none | |
| East 8th Avenue | primary | one-way street | none | |
| Stout Street | secondary | one-way street | none | |
| Champa Street | secondary | one-way street | none | |
| 17th Street | secondary | one-way street | none | |
| 18th Street | secondary | one-way street | none | |
| East 13th Avenue | secondary | one-way street | none | |
| East 14th Avenue | secondary | one-way street | none | |
| Grant Street | secondary | one-way street | none | |
| North Downing Street | secondary | one-way street | none | |
| California Street | tertiary | one-way street | none | |
| Curtis Street | tertiary | one-way street | none | |
| Welton Street | tertiary | one-way street | none | |
| 15th Street | secondary | one-way street | **10.0 m** | At this pin (39.75329, −105.00506) a 103 m same-name twin branches back from the pin way's own end node. Locally two carriageways. The test is right here, and my street-level label wasn't |
| Logan Street | secondary | one-way street | **8.6 m** | At this pin (39.71935, −104.98268) two one-lane `oneway=yes` ways run between the same two nodes for 228 m, a local split. The test is right here, and my label wasn't |
| East 6th Avenue **Parkway** | secondary | ~~one-way street~~ **divided** | **32.5 m** | **My label error.** Nominatim matched 6th Avenue *Parkway*, a different road from the 6th Avenue one-way, and it has two carriageways (2,584 m and 1,895 m long) |
| Pennsylvania Street | — | one-way street | — | no one-way way found by Nominatim; not substituted |
| North Sheridan Boulevard | primary | divided | 7.3 m | |
| North Brighton Boulevard | secondary | divided | 9.6 m | |
| South University Boulevard | primary | divided | 11.8 m | |
| East Leetsdale Drive | primary | divided | 12.2 m | |
| North Federal Boulevard | primary | divided | 13.0 m | |
| East Evans Avenue | primary | divided | 14.1 m | |
| East Hampden Avenue | trunk | divided | 15.0 m | |
| East Martin Luther King Jr Boulevard | secondary | divided | 17.2 m | |
| South Colorado Boulevard | primary | divided | 21.7 m | |
| North Monaco Street Parkway | primary | divided | 29.4 m | |
| North Speer Boulevard | primary | divided | **55.4 m** | the widest; Cherry Creek between |
| Montview Boulevard | — | divided | — | no one-way way found; not substituted |

**What it shows:**
- **Divided, 12 roads** (the 11 labelled plus 6th Avenue Parkway): every one has a twin, at **7.3–55.4 m**.
- **One-way streets, 14 pins:** none has a twin anywhere in the box (about ±300 m across the road).
- **Locally split one-way segments, 2 pins** (15th St, Logan): twins at 8.6 m and 10.0 m. There the test says *divided* for that segment, which matches what OSM maps there. That's the R80 confirmation working as ruled ("each carriageway of a truly divided road stays divided").

**Twin radius = 100 m — CHOSEN.** The reason:
- The sample's widest twin is Speer's 55.4 m, so 100 m covers it with about 1.8× margin for medians wider than any sampled.
- In the same sample, no one-way street had a same-name opposite way anywhere within the box. So nothing measured sits between 55.4 m and the box edge for 100 m to misclassify.
- Couplet partners have different names (Broadway/Lincoln, 13th/14th, Grant/Logan), so the name match, not the distance, keeps them apart.
- A larger radius gains nothing measured and costs payload on the road lookup.
- **The known limit:** a divided road with a median wider than 100 m would read as a one-way street, and none was found in this sample. Per R83, the operator confirms when the lookup can't decide (no twin search ran).

### R84: the quotes, before any device is removed

**CDOT S-630-1 (July 2026), Sheet 2, General Note 8** (PDF p. 150; text committed beside this file as `sources/s630-1-2026-pdf150.txt`, copied from `issue-300-left-side-oneway`, verified word for word 2026-10-05):

> "All warning and regulatory signs shall be posted on both sides of the roadway on divided highways, multi-lane ramps, one-way streets, and as directed by the Engineer, except where only one shoulder is closed (ex: Case 11 on Sheet 7)."

**Denver: DOTI PT-116.1, General Traffic Control Procedures (April 2022)** (7 pages, sha256 `5a7bc4971d57ba97b75b5c2161553567ad1df30f3cc1442609d11ca3bb8d97c0`; every page extracted to `sources/denver-pt-116.1-2022-pNN.txt`). Its authority list, p. 1:

> "U.S. Department of Transportation, Federal Highway Administration: 2009 Edition of MUTCD, Revision 2, May 2012"

Its sign rules cover sidewalk closures (p. 3), bike lanes and parking lanes (p. 4), and detours (p. 6). **It has no rule on sign side, one-way streets or multi-lane roads.** I searched all 7 pages (every page has extractable text) for: one-way, both sides, left-hand, left side, each side, sides of the road/street, sign placement, signs shall be placed/posted/installed/located, duplicate, multi-lane, median, divided.

**Denver: DOTI Rule 22.3, Issuance of Permits by the City Traffic Engineer (2022)** (12 PDF pages, sha256 `c3b11fa1653809ccb1adf700decaa8843f0378120e6f0a1f8bc65a8c2637d181`; pages in `sources/denver-rule-22.3-2022-pNN.txt`), PDF pp. 10–11 (printed "Page 9 of 11" on PDF p. 10):

> "All barricades and signage as specified on any permit will be the responsibility of the applicant and will be in accordance with the following standards: a. DOTI standards and details, current editions … b. MUTCD, as revised by the Colorado Supplement, current edition c. ADAAG, current edition"

Same search: **no rule on sign side or one-way streets.**

**Not consulted:** "DOTI standards and details, current editions", which Rule 22.3 names as standard (a). There's no copy in the repo or in Downloads. It's the one Denver source not read, and the one place a Denver left-side rule could still live.

**How the quotes bear on R84's condition:**
- **Note 8 does call for both-sides signing on one-way streets,** for every closure except "where only one shoulder is closed". By R84's own words ("If either calls for left-side signing on multi-lane one-ways, keep it and report back") that's the trigger. **So no device is removed, and this is the report back.**
- For **#308's affected plans, shoulder closures on one-way streets,** Note 8's exception applies by its own text: one shoulder is closed. Right-curb-only signing is what the note prescribes there, and MUTCD 11th Ed. TA-3 Note 1 (p. 864) agrees (`sources/mutcd11-pdf100-printed864.txt`): the left SHOULDER WORK sign goes "for a divided or one-way street only if the left-hand shoulder is affected".
- For **every other closure on a one-way street** (lane closures, near-intersection), Note 8 requires both sides. That's #308's split-out issue (R87), and nothing in #308 removes a device from those plans.
- **Denver adds nothing either way** in the two documents read. The third (DOTI standards and details) is unread.

### R88: the widths with no source (to be marked CHOSEN in code and in the audit at build time)

- **Shoulder width on a one-way street:** `plan_shoulder_width_ft` (`src/api/schemas.py:1086-1087`) returns 10 ft divided and 8 ft undivided. A one-way street takes one of them, or a value of its own, and none is sourced.
- **Lane-width ceiling:** `fitLaneWidth` → `laneWidthCeilingFt` (`conestruct/site/lib/scenarios/auto-apply.ts:408-416`) caps the lane width from the drawable width, and the cap depends on `divided` through the shoulder. Broadway today is 10.5 ft; undivided would be 11 ft.
- **Related, but not a width (listed so it isn't lost):** `MAX_LANES_PER_DIRECTION = 4` (`conestruct/site/lib/scenarios/validation.ts:27`) clamps Broadway's OSM `lanes=5` to 4. It's a schema domain limit, not a #308 change.

### After R90–R92 (2026-10-05)

- **The near-intersection Note 8 gap is #309** ("Lane closure near an intersection on a one-way street signs one side only; S-630-1 Note 8 requires both sides"), split out by R87. #308 changes no near-intersection device.
- **R90 is checked against the figure:** MUTCD 11th Ed., Notes for Fig 6P-3, Note 1, p. 864 (`sources/mutcd11-pdf100-printed864.txt`): "A SHOULDER WORK sign should be placed on the left-hand side of the roadway for a divided or one-way street only if the left-hand shoulder is affected." That agrees with R90 (sign the side of the closed shoulder), so no stop. In #308 only right-shoulder plans exist; the left-shoulder case arrives with #300 (`work_side`, R82).

---

## Build plan and Rule 5 prediction (written 2026-10-05, before any product code)

Rulings applied: R83–R92, the R80 confirmation, and R89's rename. **Scope:** the shoulder kind only. Near-intersection is #309. The flagger already refuses one-way roads. `lane_closure_divided` is gated.

### One interpretation, flagged

R83 says "If the test can't decide, the operator confirms." The twin evidence comes from the picker's **second** Overpass round trip, `extendCandidateGeometry` (`app/api/road-bearing/route.ts`). It fetches every same-name or same-ref way within `GEOMETRY_RADIUS_M` = 1,700 m to stitch the centerline. It's best-effort: when it fails, the candidate keeps its own-way geometry and the twin is unknown. That's the "can't decide" state. It also covers a one-way way with neither name nor ref, since there's nothing to match a twin on. In both cases the backend refuses with a 400, using the relay-fact pattern (#136/#158/#86/#177), and the WHAT band shows a confirm row whose answer is relayed back. Nothing is guessed.

### The wire (relay raw facts; the backend owns the predicate)

`ShoulderScenario.carriageway: CarriagewayFacts | None` (absent ⇒ today's behaviour, byte-identical):
- `oneway: str | None`: the raw OSM tag.
- `highwayClass: str`: raw. The predicate applies only to street classes: primary, secondary, tertiary, unclassified, residential. Motorway, trunk and every `*_link` keep today's class rule; a ramp is not a one-way street (Note 8 names multi-lane ramps separately).
- `twinDistanceM: float | None`: metres from the snapped point to the nearest same-name (or same-ref) `oneway` way whose travel bearing runs opposite (Δ ≥ 150°). `None` = none in the pool.
- `twinSearched: bool`: whether the same-name pool answered.
- `confirmed: "one_way_street" | "divided" | None`: the operator's answer.

### The predicate (`src/rules/carriageway.py`, the one producer)

`TWIN_RADIUS_M = 100.0`, CHOSEN, citing the R86 table. Rules are applied in order:
1. `confirmed` set → that answer.
2. Not a street class, or the oneway tag isn't `yes`/`-1` → `not_applicable` (today's path).
3. `twinDistanceM ≤ TWIN_RADIUS_M` → `divided`.
4. Not `twinSearched` → `undecided`.
5. Otherwise → `one_way_street`.

The frontend's copy in `classify.ts` is a mirror, commented as a mirror; the backend is authoritative (Rule 3). The mirror only decides the auto-applied `divided`, the lane-width fit, the provenance line, and when the confirm row arms.

### The layers

| Layer | Change |
|---|---|
| `schemas.py` | `CarriagewayFacts`. The drawable-width validator reads the shoulder from the same predicate |
| `validators.py` | `ScenarioParams.one_way_street: bool = False` (appended with a default, so every constructor is untouched). Title "Shoulder Closure · One-Way Street". Note 8 trigger `is_divided or one_way_street`, minus the single-shoulder exception |
| bridge `schemas.py:1170-1198` | one-way street → `is_divided=False`, `one_way_street=True`, the undivided generator (single side, right shoulder, R90), shoulder `ONE_WAY_STREET_SHOULDER_WIDTH_FT = 8.0` **CHOSEN** (R88). Divided → the divided generator, 10 ft |
| `render_api.py` | `_ensure_carriageway_decided`: undecided → 400 `carriageway_undecided` with the recovery sentence. Single-lane gate (`:372-374`): a one-way street is exempt (its `lanes` tag counts every lane, all in one direction) |
| `audit.py` | Case 11 wording for a one-way street. Note 8 row: label "Signs on both sides of one-way street", detail citing Note 8's single-shoulder exception and MUTCD Fig 6P-3 Note 1 (p. 864, R90), plus the Denver sentence on Denver plans (R91: "PT-116.1 (2022) and Rule 22.3 (2022) read; both defer sign placement to MUTCD; DOTI standards and details not read"). One `pending_verification` item on one-way plans: the 8 ft shoulder and the lane-width ceiling are CHOSEN (R88) |
| `plan_sheet.py` | A one-way branch in `_draw_road`: `num_lanes` lanes in one direction, white dashed separators, no centerline, no median, the left curb's shoulder strip above, two right-pointing arrows. The left edge is drawn white like the outer edge, **CHOSEN**: MUTCD Part 3's edge-line colour rule isn't in the repo, so I don't cite it |
| `classify.ts` | The `primary + oneway ⇒ divided` rule is replaced by the twin rule, for every street class (R85), as a mirror. "couplet" is retired (R89). Provenance: "OSM oneway=yes; same-name carriageway N m away → divided" / "…none within 100 m → one-way street" / "…the same-name search didn't run → confirm" |
| `route.ts` + `lib/road-detection/twin.ts` | `twin_distance_m` / `twin_searched` per candidate, computed from the stitch pool (pure function, unit-tested) |
| `auto-apply.ts` | Shoulder relays `carriageway` **only when the candidate is one-way**, so two-way payloads are byte-identical. `divided` comes from the mirror |
| `PlanDetails.tsx` | The confirm row, armed only when the mirror says undecided: "One-way street" / "One side of a divided road" writes `carriageway.confirmed` (and `divided`). The Divided toggle on a one-way road writes `confirmed` too, so the operator stays the authority. `matchRefusalAffordance` gains `shoulder_carriageway` |
| R89 | "couplet" leaves code, tests and comments: `classify.ts`, `classify.test.ts`, `dedup.ts`, `dedup.test.ts`, `stitch.ts`, `stitch.test.ts`, and the script `scripts/test_dedup_couplet.mjs` (renamed) |

**The one new visible surface** is the confirm row, in the WHAT band's PlanDetails, for the field rep at FLOW.md step 2 (WHAT).
- **P18:** one question, asked only when the test can't decide.
- **P1:** it mounts only in the refused state, like its #136/#158 siblings.
- **P13:** no hue-only signal; it uses the ⚠ glyph and text.
- **P21:** the words are the rep's own: "One-way street" / "One side of a divided road".

### Rule 5: churn predicted before the diff

**Behaviour changes in prod, deliberate:**
1. **Primary one-way, no twin** (Broadway, Lincoln, 8th Ave):
   - page 1 is drawn one-way;
   - the title is "Shoulder Closure · One-Way Street";
   - the generator moves from divided to undivided. Measured on Broadway (`probes/r92_lane_clamp.txt`): **36 → 31 generator devices, signs 12 → 6, drums 3 → 4**, cones 20 and arrow board 1 unchanged. Site-adjustment devices are unchanged;
   - shoulder 10 → 8 ft (CHOSEN), lane width 10.5 → 11 ft (fit);
   - audit: the Case 11 wording, the Note 8 row label, a Denver sentence, and **+1 pending item**, so the verdict strip gains a pending count.
2. **Secondary, tertiary and unclassified one-way, no twin** (Stout, 15th, 13th/14th…): today drawn as a two-way road with a yellow centerline and titled "{2×lanes}-Lane Undivided". Now: the one-way drawing and title, the same generator and device count, the audit wording, and +1 pending item.
3. **Secondary one-way with a twin** (MLK 17.2 m, Brighton 9.6 m): today `divided: false`; now divided (the R83 definition). That brings the divided generator with its mirrored signs, a 10 ft shoulder and the median drawing.
4. **Primary one-way with a twin** (Colorado, Federal, Speer): unchanged.
5. **A one-way road whose twin search didn't run:** a 400 plus the confirm row (new).
6. **Single-lane gate:** a one-way street with `lanes=1` is no longer refused on shoulder plans. Today a secondary one-way with `lanes=1` is refused as "single-lane".
7. **Two-way roads, motorways, trunks and links:** unchanged.

**Assertions predicted to change:**
- `lib/road-detection/classify.test.ts:183-196` (Stout primary + oneway → divided) flips. With no twin data the candidate is undecided, so divided is `false` with the confirm source.
- `classify.test.ts:482-486` (the couplet source string) is rewritten.
- `classify.test.ts:503-518` (the invariant) is rewritten for the twin rule.
- `dedup.test.ts`, `stitch.test.ts`: test names and comments only (R89).
- `tests/test_note8_both_sides.py:151-186`: the docstring's "N Broadway SB shape… divided" is corrected. Its numbers don't change, because it builds `ScenarioParams` directly.

**Predicted byte-identical:**
- all 90 JSON files under `tests/snapshots/`;
- the 7 tiering fixtures, the 12 `pdf_worst_case`, the 4 `cdot_s630_typicals` and the 2 `corridor` fixtures;
- the `tests/s630` harness;
- `components/__fixtures__/audit-shoulder-full.json`;
- every committed evidence directory.

No existing request or fixture carries `carriageway`, and the field is absent unless the road is one-way. `route.test.ts` deep-compares only `[]` and `geometry`, not whole candidates, so the two new candidate fields move nothing.

**Standing predictor check:** `carriageway` is optional and absent on two-way roads; `one_way_street` defaults `False` and nothing serializes it. If either turns out to appear on every payload or audit, every baseline above moves, and this row is wrong. The verifier's diff is checked for exactly that.

**New tests** (Rule 11), one regression fixture per gate:
- the predicate's five rules;
- the payload level through TestClient: Broadway one-way → title, no negative-offset signs, 8 ft; Colorado twin → divided as today; undecided → 400 `carriageway_undecided`; confirmed → plans; absent → byte-identical; single-lane exemption;
- the audit rows: one-way Note 8 row, Case 11, the Denver sentence on a Denver plan, and the pending item;
- rendered output: page 1 one-way draws no centerline or median (recorded canvas calls);
- frontend: `twin.ts` units, route twin fields, classify mirror cases, the auto-apply relay (present on one-way, absent on two-way), and the PlanDetails confirm row mounted.

---

## Build outcome against the Rule 5 prediction (2026-10-05, after the diff)

**Commits:** `02ac980` (predicate, wire, bridge, gate), `4bd7c99` (title, page 1, audit, crew sheet), `c875ea4` (picker twin evidence, mirror, relay, confirm cell), `7e06136` (R89).

**Suites:** backend 2541 passed, 2 skipped (2523 before plus 18 new; no existing test changed outcome). Frontend 1938 passed in 187 files. `tsc` is clean, and ESLint and ruff pass in the pre-commit hook.

**Predicted and held:**
- Every recorded baseline is byte-identical: 90 snapshot JSONs, the tiering, `pdf_worst_case`, `cdot_s630_typicals` and `corridor` fixtures, `tests/s630`, and `audit-shoulder-full.json`. No existing request carries `carriageway`.
- The `classify.test.ts` Stout case, the old source-string case and the invariant were rewritten.
- The `dedup`/`stitch` test names and comments changed (R89).
- The `test_note8_both_sides.py` docstrings were corrected.

**Missed, recorded honestly:**
1. **`classify.test.ts`, the `it.each` over secondary/tertiary/unclassified one-ways,** asserted the provenance string `inferred from class=…`. With no twin evidence those roads now read "the same-name search didn't run → confirm …". `divided` stays `false`; the sentence changed. It's a fourth classify assertion the table didn't list.
2. **`tests/fixtures/centerline/bayaud_colorado_pool.json`:** R89 reached its `_provenance.purpose` sentence ("couplet" → "carriageway pair"). The recorded geometry is untouched. The table had called every fixture byte-identical.
3. **The table's R89 row named `scripts/test_dedup_couplet.mjs` as renamed.** The script doesn't exist; `dedup.ts` cited a missing file. The comment now cites `d83470d` instead.

**Built differently from the plan, stated:**
- **The confirm surface is one cell that is always present on a one-way road**, not a row that appears only when undecided. It shows the current answer with its provenance, says ⚠ needs you when the test couldn't decide, and replaces the Divided toggle on those roads (one control per fact, P2). That also gives the operator an override for a wide median the twin test misses.
- **`TwoWay` takes `value: boolean | null`** for the undecided state.

**Not verified in a browser.** Nothing here has run against prod, and no local dev server was started this session. The prod browser check comes after the ship (memory: the production browser is the verification gate).

---

## After R93 (2026-10-05): the left edge line is yellow, cited

- **R93 applied.** The left edge line on a one-way street's page 1 is now solid yellow (the sheet's existing yellow, `MEDIAN_EDGE`), normal width (2 pt, like the other edge lines). The right edge stays white. The CHOSEN mark is gone from `plan_sheet._draw_one_way_street`. The "white, CHOSEN" lines in the build plan and the build outcome above are superseded by this.
- **The source, matched by subject, not number.** MUTCD 11th Edition (December 2023), **Section 3B.09 Edge Line Pavement Markings, ¶03 (Standard), printed p. 562** (PDF p. 602 of `mutcd11theditionhl.pdf`, 1,162 pages, sha256 `ea935e42…6f88`). The page text is committed as `sources/mutcd11-full-pdf602-printed562-sec3B09.txt`:

  > "If used on the roadways of divided highways or one-way streets, or on any ramp in the direction of travel, left edge line pavement markings shall consist of a normal width solid yellow line to delineate the left-hand edge of a roadway or to indicate driving or passing restrictions left of these markings, except as provided in Section 3E.04."

  ¶02 on the same page gives the right edge: "a normal width solid white line". This matches R93's 2009-edition §3B.06. The 11th Edition renumbered it §3B.09 and doesn't say otherwise, so there's no stop.
- **Test:** `tests/test_plan_sheet_one_way.py::test_the_left_edge_line_is_solid_yellow` (red before the change, green after). The no-centerline test now asserts no *dashed* yellow line, because the solid yellow left edge is the one yellow line.
- **R83's reading is approved** (Ryan, R93's message): the "One-way street or divided road?" cell, the 400 when the twin search can't decide, and the cell replacing the Divided toggle on one-way roads.
- **The R92 issue is #310** ("A 5-lane road is planned as 4 lanes; the per-direction clamp also sets the lane width, which moves every device 1.5–2 ft").
