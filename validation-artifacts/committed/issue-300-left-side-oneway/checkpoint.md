# issue-300-left-side-oneway — 📋 checkpoint (written before Ryan rules)

**Issue:** #300 — left-side work on one-way streets can't be planned. `rulings.md` is beside this file.
**Base:** `a5b4e12` = `main` = prod `healthz` (checked 2026-10-05 10:59 MDT). Investigation only: no product code.
**Prod requests made: one** (the `/healthz` read at 10:59 MDT). No request touched 12:00–12:20 or 19:00–19:20. Nothing shipped.
**Evidence:** `probes/` (the repro and its output), `sources/` (the cited MUTCD and S-630-1 pages as extracted text, plus renders of the figures whose claims come from the drawing).

## The answer, in brief

1. **Reproduced on N Broadway southbound** (39.7337, −104.98753; OSM way 131232822, `oneway=yes`, `lanes=5`, 30 mph). On `a5b4e12` the side control offers one option, "West side · southbound traffic". `side: "left"` on the legal direction gets a 400 from both `/render/corridor-geometry` and `/render/pdf`: "meta.work.side 'left' is not built yet: only right-side work is laid out." (`probes/repro_broadway.txt`)
2. **The drawn corridor is already side-agnostic.** Picker, band aerial and page 2 all build along the centerline with no lateral offset. On a one-way road both curbs share one direction of travel, so the geometry for a left option is the same as for the right.
3. **The side stops at the corridor.** `ScenarioParams` has no side field. Every generator, the audit, the crew narrative and page 1 read "positive offset = the work side = the right".
4. **Neither standard has a left-lane typical for a one-way street.** MUTCD §6N.11 names "left-lane closures" as a category, but the figures that draw one are on two-way, divided or freeway roads. For one-way streets specifically, the two rules that apply are:
   - **MUTCD TA-3 Note 1:** a left-hand SHOULDER WORK sign goes up "for a divided or one-way street only if the left-hand shoulder is affected".
   - **S-630-1 General Note 8:** every warning and regulatory sign goes on both sides of a one-way street, unless only one shoulder is closed.
5. **Broadway, the motivating example, is not a one-way street to the backend. It's a divided highway.** Detection marks every primary one-way as `divided: true` ("couplet → divided"), and nothing on the wire tells a couplet from a true median carriageway. The prod PDF for this very pin (2026-09-25) draws a median and an **opposing carriageway with a left-pointing traffic arrow**: 4 lanes each way on a 5-lane one-way street (`probes/broadway-prod-2026-09-25-page1.png`). That's a defect in today's right-side plans, upstream of #300.
6. **Of the three live kinds, only shoulder can take left-side work on a one-way road today.**
   - The flagger is refused on one-way roads.
   - Near-intersection forces `is_divided=False` and is Case 18, which is right-side only and has no left variant.
   - A mid-block lane closure that keeps the divided flag routes to `lane_closure_divided`, which is gated.

   So "close the left curb lane" (#300's own example) can't be planned on either side today.
7. **Recommendation, in order:**
   - **(C) File the couplet defect as its own issue and fix it first.**
   - **Then build #300 as option (A): left-side shoulder work on confirmed one-way roads.** The side reaches the generators as a new field that defaults to `"right"`. Labels and words flip. Page 1 mirrors vertically.
   - **Hold near-intersection left-lane work (B) behind a Rule 8 evidence bar.**

   Under (A), every right-side output stays byte-identical. The test churn is 3–4 named assertions plus new tests.

---

## 1. Reproduction

**The pin.** It's the #290 evidence sweep's shoulder pin (`validation-artifacts/committed/issue-290-evidence-sweep/README.md:9`), captured as `tests/fixtures/corridor/broadway-sb.json`. I read OSM way 131232822 today from the OSM API (v43, edited 2026-03-23), not from Overpass:
- `highway=primary`, `name=North Broadway`, `oneway=yes`, `lanes=5`, `maxspeed=30 mph`
- `turn:lanes=||||right`, `sidewalk:both=separate`

The rightmost lane is a turn lane, so closing the left curb lane is a realistic job here.

**The probe.** `probes/repro_broadway.py` sends the fixture, with the confirmed road relayed the way the site proxy relays it, through FastAPI's TestClient on this checkout. Overpass is stubbed and nothing touches the network. Output (`probes/repro_broadway.txt`):

```
HEAD a5b4e1227023cf649d1e382e3750ee6bb5893a04
pin 39.7337, -104.98753  way 131232822  oneway=yes  divided=True  kind=shoulder  lanes=4  speed=30
1. corridor-geometry, no side -> 200 status=side_not_confirmed
   offered: 'West side · southbound traffic'  work={'side': 'right', 'travel': 'with_geometry'}  built=True
2. /render/corridor-geometry side=left travel=with_geometry -> 400  {"detail":{"error":"pin_model_input","message":"meta.work.side 'left' is not built yet: only right-side work is laid out."}}
3. /render/pdf side=left travel=with_geometry -> 400  (same message)
4. /render/corridor-geometry side=right travel=with_geometry -> 200  status=laid_out approaches=1
```

**Why not on prod.** Local HEAD is the sha prod's `/healthz` serves, so this is the code prod runs. The backend needs the render secret and prod's `/sandbox` sits behind the coming-soon gate. The #290 sweep already captured prod's UI for this pin (`issue-290-evidence-sweep/prod/shoulder-1440-04-side-chosen-kind-owed.json`: "West side · southbound traffic"). If you want a fresh prod Playwright run, it fits between 12:20 and 18:55 today.

**The prod PDF for this pin** (`issue-290-evidence-sweep/prod/shoulder-1440-plan.pdf`, page 1, rendered to `probes/broadway-prod-2026-09-25-page1.png`) shows:
- the title "SHOULDER CLOSURE — DIVIDED HIGHWAY";
- a hatched MEDIAN between yellow lines;
- 4 lanes on each side of it;
- a left-pointing traffic arrow above the far shoulder (`plan_sheet.py:4335-4342`: "when divided", the opposing arrow).

North Broadway carries no opposing traffic. That's finding 5.

## 2. Where the code assumes right-side work (all at `a5b4e12`)

**Wire and API**

| file:line | What it assumes | What left-side work needs |
|---|---|---|
| `src/api/schemas.py:104-117` | `side: Literal["right","left","median"]`; the docstring says only `"right"` is built | Nothing. `"left"` is already on the wire |
| `src/api/render_api.py:262-265` | 400 for any `side != "right"` | Allow `"left"` on a confirmed one-way road. Keep the 400 for left on a two-way road, left with no road, and median |
| `src/api/render_api.py:286-295` | 400 when the travel runs against the legal direction | Nothing (it's side-agnostic) |
| `src/api/render_api.py:1044-1052` | Docstring: "A confirmed one-way road: only the legal direction's right edge" | Becomes both edges |
| `src/api/render_api.py:1069-1076` | `right_side = _cardinal(bearing + 90.0)`; writes `{"side": "right", "travel": ...}` only | On one-way roads, a second option: `_cardinal(bearing - 90.0)`, `"side": "left"`, same `travel` |
| `src/api/schemas.py:1047` | `if work is None or work.side != "right" ...: return None` (no bearing) | Left gets the same `travel_bearing_at` call. One-way means the same bearing for both curbs |
| `src/rules/validators.py:167-239` (`ScenarioParams`) | No side field | A new field, `work_side: Literal["right","left"] = "right"` (name CHOSEN, for the ruling) |
| `src/api/render_api.py:113-115` | Live kinds: shoulder, flagger, near_intersection | (scope, §4) |

**Corridor and layout math.** No change needed:
- `src/rules/corridor.py:944-979` (`travel_bearing_at`), `:982-1002` (`against_legal_direction`) and `:1064-1155` (`_corridor_from_work_start`) don't depend on the side.
- `src/rules/corridor_layout.py:62-70` and `:118-230` don't either. Its opposing approach is for the flagger only.
- The ±90° in `corridor.py:597-618` is a symmetric bbox widening.
- No code anywhere computes a left-of-travel vector.

**Device placement**

| file:line | What it assumes | What left-side work needs |
|---|---|---|
| `src/generation/layout.py:120-134` | "The closed lane is the RIGHTMOST … CHOSEN … This tool models right-side work only"; "Offsets are positive right of the centerline (the work side)" | Keep "positive = the work side" as the model, and state that it no longer means right |
| `layout.py:200-201, :235, :381` (shoulder, divided) | Signs at ±offset (both sides, a house choice per #243 R54); `"W21-5aR"`; `label="RIGHT_ARROW"` | `W21-5aL`; the arrow-board label mirrors (today `RIGHT_ARROW` for the right shoulder). Which mode a left-shoulder board shows is **not sourced here**. TA-38 Note 6 ("an arrow pointing to the right … on the left-hand shoulder") is a different TA, so the build checkpoint needs to cite it before the choice is made |
| `layout.py:662, :671ff, :746` (shoulder, undivided) | `W21-5aR`, signs at `sign_offset_right`, `RIGHT_ARROW` | Same flip. Signs on the left go with the work side (TA-3 Note 1) |
| `layout.py:957-958, :1004` (lane_closure_divided, gated) and `:1455-1456, :1491` (near_intersection, live) | `W4-2R` / `W20-5R`, `LEFT_ARROW` | `W4-2L` / `W20-5L` (§6H.07 ¶02, TA-33 Note 1), but see §4 and option B |
| `src/rules/site_adjustments.py:160, :192-197` | R9-9 at `+_ped_offset`, M4-9a at `+sign_offset` (the right) | Fine as long as + still means the work side (`issue-243-note-8/checkpoint.md:156-159` already noted these) |
| `src/rules/sign_codes.py:41` | `W21-5aL` is the only L entry | Add `W20-5L` and `W4-2L` if B is built |

**PDF and narrative**

| file:line | What it assumes | What left-side work needs |
|---|---|---|
| `src/rendering/plan_sheet.py:8-16, :236-251` (`_y_of`) | The work side is drawn at the BOTTOM, with traffic flowing left to right | **A vertical mirror for left work.** With traffic drawn left to right, the bottom is the *right* of traffic, so drawing left work at the bottom would put it on the wrong side. The data model stays the same and `_y_of` flips. (The code sweep suggested keeping the bottom. That would draw a mirror image, so I don't adopt it.) |
| `plan_sheet.py:4329-4342` | The work-side arrow, plus an opposing arrow when divided | Left work moves both with the flip. The couplet case is finding 5 |
| `plan_sheet.py:2955-2960` | Hard-coded `("W4-2R","RIGHT LANE ENDS")`, `("W20-5R","RIGHT LANE CLOSED AHEAD")` | Derive both from the side (B only) |
| `plan_sheet.py:3282` | "CLOSED LANE DRAWN AS THE RIGHTMOST LANE…" (#176) | The wording follows the side |
| `plan_sheet.py:1604` | The arrow glyph direction follows the label | Flips with the label |
| `src/narrative/crew_narrative.py:195, :218-239, :399` and `templates/base.md.j2:43, 46, 56, 61, 69, 123` | "right side", "RIGHT ARROW mode (for right shoulder closure)", "Place matching sign on left side", "closing the right lane" | The words follow the side. The `offset_ft > 0` filters still hold if + means the work side |
| `src/rendering/static_aerial.py` | No side logic | Nothing |

**Audit and checks**

| file:line | What it assumes | Notes |
|---|---|---|
| `src/api/audit.py:895-900` | Counts by the sign of the offset; the row reads "Signs on both sides of divided highway" | Symmetric. The label is a separate matter |
| `audit.py:914-918, :958-964`; `validators.py:1803`; `audit.py:1332` | `offset_ft > 0` means the work or approach side | **These break if left work negates offsets.** That's why option D is rejected |
| `audit.py:1181-1188` | The near-intersection narrative claims "single-side mainline signing (both-sides posting applies to … one-way streets …)" | That's false for a near-intersection plan on a one-way road. It's an existing gap on the right side too |
| `src/rules/tables.py:292-304`; `validators.py:930-934` | Note 8's "one-way streets" is quoted, but "not currently expressible through `ScenarioParams`" | The both-sides check never runs on one-way streets. It's an existing gap (shoulder is exempt anyway) |

**Frontend**
- `conestruct/site/lib/scenarios/index.ts:478-481`: `hasConfirmedSide` returns `meta.work?.side === "right"`. This is a frontend copy of a backend decision; the rail blocker, the check gate, ledger row 4 and the verdict strip all read it. It has to accept `"left"`, and the backend stays authoritative (Rule 3).
- `components/bands/WhereBand.tsx:177-230` (`SideControl`) renders the backend's `side_options` filtered by `built` and builds no direction itself. A left option shows up without any change.
- `lib/corridor-geometry.ts:47-57, :83-96` already tells options apart by side plus travel, and `lib/scenarios/types.ts:340-342` already types `"left"`. The picker and aerial draw the backend's centerline with no side.
- `lib/road-detection/classify.ts:130-137` is the couplet rule: `primary` + `oneway` gives `divided: true, dividedFromOneway: true`. `dividedFromOneway` only reaches a provenance string (`:373`). It is **not** on the wire, and the backend never reads `confirmedRoad`.

**History.** The #290 commits are `2c1ba25`, `c11aeb2`, `659d800` and `0e1528c` (greyed option removed, right-hand side only), with the rulings in `df71086`. No code comment cites #300.

## 3. What the standards say

Sources are MUTCD 11th Ed. Part 6 (`validation-artifacts/ta10_flagger/mutcd_part6.pdf`, sha256 `d8ead248…c9b0`; printed page = PDF index + 764) and CDOT S-630-1, July 1, 2026 (`validation-artifacts/s630-1-2026.pdf`, sha256 `e6cc37b1…2971`; S-630-1 is PDF pp. 149–174). **Both PDFs are untracked** (#160), so the quoted pages are committed as text under `sources/`. I re-extracted every quote marked ✔ from the PDF and matched it word for word. Claims read from drawings are marked *(drawing)*, with the render in `sources/`.

**MUTCD 11th Ed.**
- ✔ **§6N.11 ¶02, p. 847:** "Work on multi-lane (two or more lanes of moving motor vehicle traffic in one direction) highways is divided into right-lane closures, left-lane closures, interior-lane closures, multiple-lane closures, and closures on five-lane roadways."
- **§6N.11 ¶09 (Option), p. 848:** "When closing a left-hand lane on a multi-lane undivided road, as vehicular traffic flow permits, the two interior lanes may be closed, as shown in Figure 6P-30…"
- ✔ **§6N.11 ¶10 (Standard), p. 848:** "When only the left-hand lane is closed on undivided roads, channelizing devices shall be placed along the center line as well as along the adjacent lane." This is about two-way roads, where the center line separates the directions. On a one-way street the left curb takes that role, so whether ¶10 applies is a reading, not a quote.
- ✔ **§6F.02 ¶01 (Guidance), p. 789:** "Signs should be located on the right-hand side of the roadway unless otherwise provided in this Manual." **¶02 (Option):** "Where special emphasis is needed, signs may be placed on both the left-hand and right-hand sides of the roadway."
- ✔ **§6H.07 ¶02 (Standard), p. 805:** "For a single lane closure, the Lane Closed (W20-5) sign (see Figure 6H-1) shall use the legend RIGHT (LEFT) LANE CLOSED."
- ✔ **Notes for Fig 6P-3 (TA-3, Work on the Shoulders), Note 1 (Guidance), p. 864:** "A SHOULDER WORK sign should be placed on the left-hand side of the roadway for a divided or one-way street only if the left-hand shoulder is affected." **This is the only Part 6 note that names one-way streets for sign side, and it covers the live kind (A) builds on.**
- **Notes for Fig 6P-1 (TA-1), Note 1, p. 860:** "If the work space is in the median of a divided highway, an advance warning sign should also be placed on the left-hand side of the directional roadway." **Fig 6P-2 (TA-2) Note 5, p. 862:** "On a divided highway, the signs should be mounted on both sides of the directional roadways."
- **Notes for Fig 6P-21 (TA-21), Note 1 (Standard), p. 900:** "The merging taper shall direct vehicular traffic into either the right-hand or left-hand lane, but not both."
- **Fig 6P-23, "Left-Hand Lane Closure on the Far Side of an Intersection (TA-23)",** notes p. 904, figure p. 905 *(drawing)*. It's a two-way street. W20-1, W20-5L and W4-2L stand on the right only, and R3-7L appears on both sides.
- **Fig 6P-30, "Interior Lane Closure on a Multi-Lane Street (TA-30)",** p. 918–919 *(drawing)*. A two-way four-lane street, with W20-5L and W4-2L on the right for each direction.
- ✔ **Notes for Fig 6P-33 (TA-33, Stationary Lane Closure on a Divided Highway), Note 1 (Standard), p. 924:** "This information also shall be used when work is being performed in the lane adjacent to the median on a divided highway. In this case, the LEFT LANE CLOSED signs and the corresponding Lane Ends signs shall be substituted." *(drawing, p. 925)*: every sign is posted on both edges.
- **Notes for Fig 6P-38 (TA-38), Note 8, p. 934:** "…The Interior Lane Shift Ahead symbol sign may be mirrored to indicate a right lane shift." This is the only "mirrored" wording in Part 6.

**S-630-1 (July 2026)**
- ✔ **Sheet 2, General Note 8 (PDF p. 150):** "All warning and regulatory signs shall be posted on both sides of the roadway on divided highways, multi-lane ramps, one-way streets, and as directed by the Engineer, except where only one shoulder is closed (ex: Case 11 on Sheet 7)."
- **Sheet 2, under Note 7:** "W20-5 warning signs shall be furnished with exchangeable plaques reading "Right", "Left", "Center", "Right 2", etc. at no additional cost."
- **Sheet 5, Case 5, "Lane #1 Closure, Multi-Lane Freeway" (PDF p. 153)** *(drawing, which I viewed)*. Lane #1 is the leftmost. W20-5(L) "LEFT LANE CLOSED ½ MILE" and W4-2(L) are posted on both edges. The taper comes off the left with a "TEMPORARY YELLOW EDGE LINE", and the arrow panel is on the left.
- **Sheet 7 (PDF p. 155)** *(drawing)*. Case 10 is the right lane closed on a divided highway: W20-5(R) and W4-2(R) on both sides, with a temporary white edge line. Case 11 is right shoulder work, signed on the right only (Note 8's exception).
- **Sheet 10, Case 18 (PDF p. 158):** a right-lane closure near an intersection on a two-way street. **There is no left variant.**
- **Sheet 22, Case 36 (PDF p. 170):** "…vehicle/sign sequence is the same for the left side of highway, while taper is mirrored about the center lane, when mobile work zone is located on the left side of highway." This is the only mirror note in S-630-1, and it covers mobile striping.

**Colorado Supplement (Jan 2026):** nothing found. Its Part 6 revises only §6D.03, §6D.04, §6J.01 and §6J.03. I searched: one-way, one way, left lane, left side, left-hand, both sides, 6N.11, 6F.02, Figure 6P, lane closure.

**Looked for and not found, in either manual:**
- a figure titled for a one-way street;
- any "may be adapted for a left lane" or "signs reversed" note;
- an S-630-1 one-way case;
- a buffer or shoulder-taper length difference for left closures.

**What this means:**
- Left-side work on a one-way street is never drawn as its own typical application.
- The left layouts that do exist (Case 5, TA-33 Note 1, TA-23) show what changes. L codes replace R codes. The taper and arrow panel move left. The temporary edge line is yellow on the left. The lengths stay the same.
- Every Colorado one-way-street plan except single-shoulder work needs signs on both sides (Note 8), whichever side the work is on.

## 4. Scope as it stands

| Kind | Live? | On a confirmed one-way road today | Left side under the standards |
|---|---|---|---|
| shoulder | yes | Plans the right shoulder. Broadway runs it through the *divided* generator | TA-3 Note 1, a direct quote. Note 8 exempts a single shoulder |
| near_intersection | yes | Forced undivided, with single-side signing. That breaks Note 8 for one-way streets on the right side too | Case 18 has no left variant. TA-23 is far side on a two-way street. No near-side left figure |
| flagger_lane_closure | yes | Refused (`render_api.py:396, :441-455`) | n/a |
| lane_closure_divided | gated | Gated (Rule 8) | TA-33 Note 1 and Case 5 cover it on directional roadways |

**The couplet problem.** Detection marks every primary one-way as divided. The backend only sees `divided` + `roadDirection.oneway`, so Broadway and a true divided carriageway look identical to it. That makes "offer left only on one-way, non-divided roads" a wrong rule: Broadway would still get West only. Two rules would be correct:
- **(i) For shoulder only:** offer left on any one-way carriageway, divided or not. TA-3 Note 1 treats "a divided or one-way street" the same for the left shoulder. On a true divided road this is the median-side shoulder, which #300 scoped out, so it needs a ruling.
- **(ii) Relay the raw OSM facts** (`highway_class` is already on the picker's candidate) so the backend owns a "one-way street versus divided carriageway" predicate. This is the relay-fact pattern (#136/#158/#86/#177), and it's also what fixes finding 5.

## 5. Options

**A. Left-side shoulder work on confirmed one-way roads, with labels flipping and page 1 mirroring.** *(Recommended, after C.)*
- **Backend:**
  - `_side_options` adds the left edge on a confirmed one-way road.
  - `render_api.py:262` allows `"left"` there and keeps the 400 everywhere else. Left with a non-shoulder kind gets an honest 400 that names the recovery (pick the right side, or the kind).
  - `ScenarioParams.work_side` defaults to `"right"`, and the model keeps "positive offset = work side".
  - The shoulder generators emit `W21-5aL` and the mirrored arrow-board label.
  - Page 1 flips `_y_of` vertically for left work. The narrative and PDF words follow the side.
- **Frontend:** `hasConfirmedSide` accepts `"left"`, as a mirror commented as a mirror. Nothing else; the control already renders whatever the backend offers.
- **Pros:**
  - It covers the one live kind with a direct MUTCD quote (TA-3 Note 1).
  - Right-side output stays byte-identical.
  - The `offset_ft > 0` checks stay valid.
  - It's the smallest diff that delivers a usable left option.
- **Cons:**
  - It doesn't deliver #300's own example, closing the left curb *lane*, because no live lane kind runs on one-way roads (§4).
  - Until C lands, Broadway's left plan is drawn on the phantom divided layout, the same defect its right plan has today.

**B. A, plus left-lane closures for near_intersection.**
- **Pros:** it's the lane case #300 names.
- **Cons:**
  - No source draws it: Case 18 is right-only, TA-23 is far side on a two-way street, and there is no near-side left figure.
  - It needs W20-5L / W4-2L in `sign_codes.py`, and the hard-coded R legends in `plan_sheet.py:2955-2960` derived from the side.
  - The §6N.11 ¶10 centerline-device question needs a reading.
  - Rule 8 says no enabling on faith, so this is an enablement arc with its own evidence bar, not a mirror.
  - Its right-side twin already violates Note 8 on one-way streets (`audit.py:1181-1188`), so that should be fixed first.

**C. Fix the couplet first, as a separate issue.**
- **What:**
  - Relay the road class (or a carriageway fact) and let the backend decide "one-way street" versus "divided".
  - Page 1 stops drawing a median and opposing traffic on one-way streets.
  - Note 8's both-sides check runs on one-way streets, which `ScenarioParams` gains a flag for, as `validators.py:930-934` already asks.
- **Pros:**
  - It fixes a wrong drawing in today's right-side plans on every primary one-way. That's the larger honesty defect (Rule 10, P21).
  - After it, (A)'s offering rule is a clean predicate instead of a shoulder-only special case.
- **Cons:**
  - It changes right-side output on primary one-ways: the title, page 1, the device counts, and possibly sign posting through Note 8. So it gets its own checkpoint and Rule 5 table.
  - It delays #300.

**D. A true geometric mirror (negate offsets for left work).** *(Not recommended.)* It breaks every `offset_ft > 0` check (`audit.py:917, :963, :1332`; `validators.py:1803`; `crew_narrative.py:239, :399`) for left plans, and it changes signatures across 53 call sites in 17 files (the code sweep's count, not recounted), for no visible gain over A's page-1 flip.

**E. Status quo, documented.** Keep right-only and say so. #290's hand-check ruling already removed the greyed left option as noise (P13, P18), so this changes nothing and leaves #300 open.

## 6. Rule 5: the churn prediction (for A, built on `a5b4e12`)

**Behavior changes, deliberate and stated:**
1. The side control on every confirmed one-way road offers **two** rows instead of one. Broadway will show "West side · southbound traffic" and "East side · southbound traffic", with labels from the existing producer. Two-way roads and the no-road headings don't change.
2. `side: "left"` on a confirmed one-way road with the shoulder kind lays out and generates, where it used to 400. Left on a two-way road, left with no road, median, and left with any other kind still 400.
3. A left-shoulder plan prints `W21-5aL`, the mirrored arrow-board label (its mode is cited at build time), words that say left, and page 1 mirrored vertically. These are new outputs; nothing existing changes.

**Assertions predicted to change** (each stated in its commit):
- `tests/test_corridor_geometry.py:235-249`: one-way offers `[right]` → `[right, left]`.
- `tests/test_corridor_geometry.py:252-261`: divided one-way offers `[right]` → `[right, left]` **under rule (i).** It doesn't change under rule (ii) with C landed, because a true divided road still offers right only.
- `conestruct/site/lib/scenarios/pin-model.test.ts:142`: `side: "left"` → `true`.
- `conestruct/site/lib/scenarios/rail.test.ts:146-149`: left no longer holds the side blocker.

**Predicted unchanged:**
- `tests/test_work_start_wire.py:100-103`, because its left case has no road (`heading: "N"`) and stays refused.
- `WhereBand.side-control.test.tsx`; `test_corridor_geometry.py:227-232, :264-273`.
- **Every recorded baseline:**
  - the 90 JSON files under `tests/snapshots/`;
  - the 7 tiering fixtures, including `tiering-expectations.json`;
  - the 12 `pdf_worst_case` fixtures;
  - the 4 `cdot_s630_typicals`;
  - the 2 `corridor` fixtures;
  - the `tests/s630` harness.

  All of them carry `side: "right"` or no side, and `work_side` defaults to `"right"`. **Standing predictor check:** `work_side` is a new field that is always present, so if it is serialized into any snapshot or wire payload, every baseline above moves. To prevent that, A keeps it off the wire response and out of the snapshot serializers. If it can't, this row flips to "all baselines move" before the diff.

**New tests** (Rule 11, where the bug lives):
- payload level: Broadway left shoulder → `W21-5aL` and the arrow label;
- rendered output: page 1 with the work at the top for left work;
- mounted flow: the side control with two options on a one-way road, plus the left-with-near-intersection 400 with its recovery.

The tiering pin needs no new fixture unless the ruling adds one.

**For C, roughly, until its own checkpoint:** primary one-way plans move off divided. Expect `broadway-sb` fixture consumers, `classify` tests, `test_note8_both_sides.py` and any snapshot recorded on a primary one-way to change. I haven't counted these; C's checkpoint counts them.

## 7. Rulings needed

1. **Order:** C (the couplet) first as its own issue, then A? Or A alone now under rule (i)? *Recommended: C, then A.*
2. **Scope of #300:** shoulder only (A), with near-intersection left lanes split to an enablement issue (B)? *Recommended: yes.*
3. **Rule (i) versus (ii)** for which roads offer the left edge. Under (i), left would also appear on true divided carriageways for shoulder work (the median side, which #300 scoped out). *Recommended: (ii), via C.*
4. **Page 1 for left work:** a vertical mirror (work at the top, traffic still flowing left to right). *Recommended,* because drawing it at the bottom would show the work on the right of traffic.
5. **Field name** `work_side` (CHOSEN) and the default `"right"`.

If you rule C first, its issue draft goes to the chat in house style. I haven't filed or drafted anything on gh.

---

## Addendum after the rulings (R78–R82, 2026-10-05; `rulings.md`)

Everything above this line is the checkpoint as ruled on (`0c4628f`). It is left as written.

- **R78:** C goes first as its own issue (drafted in chat for the repost). Its investigation runs next, checkpoint first. A follows on top of C.
- **R79:** A is left-side shoulder work only. Near-intersection left side and left lane closures wait for Rule 8 evidence.
- **R80, and how I read it:** the left edge is offered only on confirmed one-way roads. In OSM each carriageway of a true divided road is also tagged `oneway=yes`. So I read R80 through C's predicate: the left edge goes to a confirmed one-way *street*, not to one carriageway of a divided road, which would be its median side (#300 scoped that out). If R80 means every `oneway=yes` way, C's checkpoint flags it and §6's row for `test_corridor_geometry.py:252-261` flips.
- **R81, page 1 mirroring for left work: CHOSEN.** A left-side plan draws the work band at the **top** of page 1, with traffic still flowing left to right, so the drawing puts the work on the left of traffic.
  - **Against P1** ("Nothing moves that the user did not ask to move"): the work band changes position between a right plan and a left plan. That move is the visible result of the user's own side choice, on a printed sheet rather than a live layout shift, so P1's concern (content displaced by late arrivals) doesn't apply.
  - **For P21** ("The model matches the mental model"): a rep who says "the left curb" sees the work on the left of the travel arrow.
  - **The alternative not taken:** keep the work at the bottom and reverse the arrow. That means mirroring the whole page horizontally, which moves every station.
  - This is a choice, not a manual requirement. Neither MUTCD nor S-630-1 says how a generated sheet is oriented.
- **R82:** `ScenarioParams.work_side: Literal["right", "left"] = "right"`.

---

## Build checkpoint for A (2026-10-08, on main `aa6dcaa`; written before any product code)

**Base:** `aa6dcaa` = `main` = prod `/healthz` (read 2026-10-08). #308 (C), #309 and #311 are in main. Every file:line above this section is at `a5b4e12` and many have moved ("a rebase orphans citations"); the lines below are re-read at `aa6dcaa`. **Prod requests made: one** (the `/healthz` read). No product code.

### The answer, in brief

1. **Still reproduces after #308.** `probes/repro_broadway_r2.py` relays #308's carriageway facts the way the site does for a one-way candidate, so the backend now reads N Broadway as a one-way *street* (`one_way_street=True`, not divided). It still offers one row, "West side · southbound traffic"; `side: "left"` is still a 400 from `/render/corridor-geometry` and `/render/pdf`; the right-side PDF generates (`probes/repro_broadway_r2.txt`).
2. **R80's gate exists now.** #308's `carriageway_verdict()` (`src/rules/carriageway.py:48-74`) returns `"one_way_street"` for exactly the roads R80 means (the R80 reading confirmed in #308's rulings: each carriageway of a true divided road stays divided). `_side_options` doesn't read it yet.
3. **The one-way frame makes the generator side-free.** On a one-way street, offset 0 is a lane edge and every device sits at a positive offset toward the work (`layout.py:635-638`; `plan_sheet.py:263-276`). A left-shoulder plan is the right-shoulder plan measured from the other curb: **the same offsets, byte for byte**. Only the labels, the words and page 1's drawing change. That is option A's "positive = the work side", and it needs no negated offsets (option D stays rejected).
4. **New finding, upstream of #300: the arrow board on every shoulder plan breaks a Standard.** Both shoulder generators place an arrow board labelled `RIGHT_ARROW` (`layout.py:381`, `:746`), and the crew sheet tells the crew "Set to RIGHT ARROW mode (for right shoulder closure)" (`templates/base.md.j2:43`). MUTCD and S-630-1 allow only caution mode for shoulder work, on either shoulder (quotes in the next section). Mirroring it to `LEFT_ARROW` would repeat the violation on the left. This needs a ruling (Q1).
5. **Page 1's mirror is more than flipping `_y_of`.** #308's one-way road drawing, the dimension band and four de-overlap/callout rules place things in fixed page positions, not through `_y_of`. The yellow left edge line must stay on the page-top lane edge, not flip with the drawing (details below; Q2).

### What the standards add (re-extracted at `aa6dcaa`; pages committed under `sources/`)

Page numbering: printed page = 1-based PDF page + 764 (filenames `mutcd11-pdfNNN-printedPPP.txt` use the 1-based page).

**Arrow board mode for shoulder work**
- ✔ **MUTCD 11th Ed. §6L.06 ¶18 (Standard), p. 833** (`sources/mutcd11-pdf069-printed833.txt:66-67`; the section heading "Section 6L.06 Arrow Boards" is on p. 832, `mutcd11-pdf068-printed832.txt:63`): "For shoulder work, for blocking the shoulder, for roadside work near the shoulder, or for temporarily closing one lane on a two-lane, two-way roadway, an arrow board shall be used only in the caution mode."
- ✔ **§6L.06 ¶17 (Standard), p. 833** (`:63-64`): "An arrow board in the arrow or chevron mode shall be used only for stationary or moving lane closures on multi-lane roadways."
- ✔ **§6N.06 ¶09 (Standard), p. 845** (`mutcd11-pdf081-printed845.txt`): "When used for shoulder work, arrow boards shall operate only in the caution mode."
- ✔ **Notes for Fig 6P-4 (TA-4), Note 8 (Standard), p. 866** (`mutcd11-pdf102-printed866.txt`): "If an arrow board is used for an operation on the shoulder, the caution mode shall be used."
- ✔ **S-630-1 Sheet 2, General Note 26** (`sources/s630-1-2026-pdf150.txt:62-63`): "If arrow boards are used for shoulder work, blocking the shoulder, for roadside work near the shoulder, or for temporarily closing one lane on a two-lane, two-wayroadway, use the arrow boards only in the caution mode." ("two-wayroadway" is the source's typo.)
- **Whether a board is used at all:** TA-3 (pp. 864-865), TA-5 (pp. 868-869) and S-630-1 Case 11 (Sheet 7) draw none. TA-4 (p. 867) draws one marked "(optional)" in caution display. Every rule above is "if used" / "when used". *(drawing; the figure claims come from the research sweep's renders, not re-viewed by me.)*
- **TA-38 Note 6, p. 934** ("an arrow pointing to the right … on the left-hand shoulder") is a lane closure (interior lane, freeway), so it doesn't apply. That settles the item §2 above left open.

**The left legend on the shoulder signs**
- ✔ **§6H.22 ¶02 (Standard), p. 807** (`mutcd11-pdf043-printed807.txt:37-38`): "The Shoulder Work sign shall have the legend SHOULDER WORK (W21-5), RIGHT (LEFT) SHOULDER CLOSED (W21-5a), or RIGHT (LEFT) SHOULDER CLOSED XX FT or AHEAD (W21-5b)." So `W21-5aL` is a MUTCD legend (`sign_codes.py:41` already describes it: "LEFT SHOULDER CLOSED AHEAD").
- ✔ **Notes for Fig 6P-5 (TA-5), Note 1 (Guidance), p. 868** (`mutcd11-pdf104-printed868.txt:8-9`): "RIGHT (LEFT) SHOULDER CLOSED signs should be used on limited-access highways where there is no opportunity for disabled vehicles to pull off the roadway."
- **§6N.06 ¶03 (Guidance), p. 845:** "…followed by a RIGHT or LEFT SHOULDER CLOSED (W21-5a) sign." and "On multi-lane, divided highways, signs advising of shoulder work or the condition of the shoulder should be placed only on the side of the affected shoulder." This agrees with R90 and TA-3 Note 1 (sign the closed shoulder's side).
- ✔ **S-630-1 Sheet 22** (`sources/s630-1-2026-pdf170.txt:14`): "When the VMS is used, the "Shoulder Closed" W21-5a(R/L) …". That's the only place S-630-1 names a left W21-5a. **No S-630-1 sheet draws a left shoulder closure**, so the Case 11 layout mirrored to the left is a reading (CHOSEN), not a drawn case.

### Where the build touches (at `aa6dcaa`)

**Wire and API**
| file:line | Today | Under A |
|---|---|---|
| `src/api/render_api.py:268-271` | 400 for any `side != "right"` | Allow `"left"` when the gate below holds; otherwise keep the 400. The message keeps `'left'` (pinned by `tests/test_work_start_wire.py:100-103`) and names the recovery: pick the right curb, or a one-way street with shoulder work |
| `render_api.py:1167-1219` `_side_options` | Right edge only; docstring "Its left edge … is NOT offered" | Add the left edge, `_cardinal(bearing - 90.0)`, same `travel`, when the gate holds. Label from the same producer: Broadway gets "East side · southbound traffic" |
| **The gate (R79 + R80)** | (none) | `scenario` is a `ShoulderScenario` **and** `carriageway_verdict() == "one_way_street"` **and** `meta.roadDirection.oneway` is a one-way tag **and** a confirmed centerline. The tag check is belt-and-braces: an operator's answer returns from the verdict before the tag is read (`carriageway.py:66-67`) |
| `src/api/schemas.py:107-120`, `:1154` | Docstring "Only `"right"` is built"; `_corridor_bearing` returns None unless right | Docstring updated; left gets the same bearing (one-way: one travel direction for both curbs) |
| `src/rules/validators.py:168-252` `ScenarioParams` | No side field | `work_side: Literal["right", "left"] = "right"` (R82) |
| `schemas.py:1322-1346` (shoulder mapping) | — | Sets `work_side` from `meta.work.side`; still the undivided generator |

**Generator** (`src/generation/layout.py`, `generate_shoulder_closure_undivided` `:609-886`)
- `W21-5aR` → `W21-5aL` for a left plan (`:662`, and the freeway second sign `:698-699`).
- The arrow board: per Q1.
- Offsets: **unchanged**. Docstrings at `:121-134` and `:613-627` restated as "positive = toward the work side" instead of "right".

**Audit and checks**
- `src/api/audit.py:947-957`, the Note 8 row counts by the sign of the offset and prints "Signs placed: {left} left, {right} right". For a left plan that would print "0 left, 6 right". Under A, the row counts the physical side (`work_side` swaps the two). A right plan's row is unchanged ("0 left, 6 right", `tests/test_oneway_street_audit.py:129`).
- `audit.py:428-438`, the taper reference "CDOT S-630-1 Case 11 (right-shoulder closure, applied to one-way street)". A left plan needs its own words (Q3).
- `src/rules/validators.py:1690-1722` `validate_shoulder_warning_pair` counts only `W21-5AR`, freeway only. It counts the work side's code under A. No right-side change.
- G20-5P (`audit.py:978-982`), W3-5 (`:1023-1028`) and the site adjustments (`site_adjustments.py:173-210`, R9-9 / M4-9a at `+offset`) stay correct while + means the work side. #311's work-side sidewalk pair lands on the left sidewalk for a left plan, which is right.

**PDF page 1** (`src/rendering/plan_sheet.py`, R81's vertical mirror)
- `_y_of` `:240-255` is the only offset → y mapping, and these bypass it:
  - `_draw_one_way_street` `:263-338`: every y is fixed from `PLAN_Y_CENTER`. For a left plan the lanes run up from center to the work shoulder at the top, and the open curb strip goes below.
  - **The yellow line must not mirror.** Traffic flows left to right, so the page top is always the left of traffic. In a right plan the yellow line is the top lane edge (offset 0); in a left plan it's the work-side lane edge, which is now also at the top. A plain flip would put yellow on the right edge, against §3B.09 ¶03 (#308 R93).
  - `_road_y_extent` `:98-101`, one-way branch, fixed asymmetric extent.
  - `_deoverlap_items` `:1373`, `_deoverlap_signs_pairwise` `:1432`, the callout circle `:1715`: "offset ≥ 0 pushes down". Left plans would push the work-side stacks into the lanes.
  - The off-road clamp `:1610`: "offset > 0 → below the road".
  - The dimension band `:1839-1844` sits above the road, clamped under the banner, and the school marker (`:1263-1264`) sits near it. In a left plan the work side's sign and callout stacks are at the top, so they would collide.
- **What I'd build:** one `work_side`-aware reflection used by every one of those sites, with text kept upright. The dimension band and school marker move to the open side, which is the bottom for a left plan. In a right plan the band is already on the open side (the top), so the rule "the band sits on the open side" holds for both. Edge colours are set by physical side: the top lane edge is yellow, whichever side the work is on.
- Arrows: the one-way lane arrows go through `_y_of` (`:4436-4443`) and keep pointing right, which is correct. No opposing arrow is drawn on a one-way street (`:4446`).
- The arrow-board glyph (`:868-896`, picked at `:1690-1691`) draws only left or right. A `"CAUTION"` label today falls through to a right arrow, so a caution glyph is needed if Q1 goes that way.
- Unaffected: the legend, notes and title-block boxes; the banner ("Shoulder Closure · One-Way Street" has no side word); page 2 and the static aerial (no side logic; "Direction of travel" is the same for both curbs).

**Crew sheet**
- `src/narrative/crew_narrative.py:197` "…, right side." becomes the work side's word.
- `:864-866` `offset_origin` "the left edge of the roadway" becomes "the right edge of the roadway" for a left plan.
- `templates/base.md.j2:43` (the arrow-board mode; per Q1), `:46` and `:53` (the side words), `:128` ("Offsets are measured from the left edge of the roadway").

**Frontend** (the only change)
- `conestruct/site/lib/scenarios/index.ts:496-499` `hasConfirmedSide` accepts `"left"` as well as `"right"`, commented as a mirror (the backend stays authoritative, Rule 3).
- `components/bands/WhereBand.tsx:221-287` `SideControl` already renders whatever the backend offers and writes `o.work` verbatim. `lib/corridor-geometry.ts:83-96` already tells left from right. R108's "⚠ from the road" prefill doesn't touch the side.
- A stale left side (the kind switched away from shoulder, or the operator answers "divided") gets the backend's 400 and a refusal affordance pointing at the side control (Q4). No frontend reset.

### Rule 5: the churn prediction (A built on `aa6dcaa`; Q1 decides one row)

**Behavior changes, deliberate and stated:**
1. On a confirmed one-way street with shoulder work, the side control offers **two** rows. Broadway shows "West side · southbound traffic" and "East side · southbound traffic". Every other road (two-way, divided carriageway, undecided, no road) is unchanged.
2. `side: "left"` there lays out and generates. Left anywhere else is still a 400, now naming the recovery.
3. A left plan: `W21-5aL`, the same offsets as the right plan, the arrow board per Q1, the crew sheet in left words measured from the right edge, the Note 8 row reading "6 left, 0 right", page 1 mirrored per R81/Q2.
4. **If Q1 is fixed inside #300:** every shoulder plan's arrow board changes from a right arrow to caution, on page 1, in the crew sheet line, and in the device label. Device counts don't change. If it's split out (recommended), #300 changes no right-side output.

**Assertions predicted to change:**
- `conestruct/site/lib/scenarios/pin-model.test.ts:142`: left → `true`.
- `conestruct/site/lib/scenarios/rail.test.ts:146-148`: left no longer holds the side blocker.
- Only if Q1 is fixed inside #300: `tests/test_rules.py:2010` (skips `RIGHT_ARROW` as a synthetic label) and the seven `test_verification_*.md` notes that name it (documents, not tests).

**Predicted unchanged:**
- `tests/test_corridor_geometry.py:226-273`: none of these send carriageway facts, so the verdict is `not_applicable` and they stay right-only. That includes `:252-261`, the divided carriageway: that row in §6 above was conditional on rule (i), and R80 took (ii).
- `tests/test_work_start_wire.py:100-103`: no road, still refused, `'left'` still in the message.
- `WhereBand.side-control.test.tsx`; `tests/test_oneway_street_shoulder.py`, `test_oneway_street_audit.py`, `test_r94_one_way_page1.py` (all right plans).
- **Every recorded baseline:** the 90 files under `tests/snapshots/` (16 + 74 corpus), the tiering fixtures, the `pdf_worst_case` fixtures, the S-630 typicals and the `tests/s630` harness. **Standing predictor check:** `work_side` is a new field that's always present. It reaches no baseline, because no snapshot serializes `ScenarioParams`: `tests/_snapshot_helper.py` dumps the audit dict, and every wire or narrative dict picks its fields by hand (`audit.py:444-449`, `crew_narrative.py:853-866`, `corridor_layout.py:180-183`, `render_api.py:1263`). If the build adds `work_side` to any of those dicts, this row flips to "every baseline moves" before the diff.

**New tests (Rule 11, where the bug lives):**
- **Payload:** Broadway left shoulder → every device at the right plan's offsets, `W21-5aL` in place of `W21-5aR`, the Note 8 row "6 left, 0 right", the arrow board per Q1. The gate: left refused on a two-way road, on a divided carriageway, on undecided, and with near-intersection.
- **Rendered output:** page 1 of a left plan has the closed shoulder above the lanes, the yellow line on the top lane edge, and no label escapes or collides: a new Broadway-left fixture in `tests/fixtures/pdf_worst_case/`, measured by `tests/test_pdf_containment.py` (#216's edge / box-cross / collision counts, asserted zero). This adds a fixture; it moves none of the existing 12.
- **Mounted flow:** the side control shows two rows on a one-way street. A stale left after a kind switch shows the 400's affordance.

### Questions for Ryan

1. **The arrow board (new finding).** Shoulder plans show a right arrow today, against MUTCD §6L.06 ¶18 (Standard) and S-630-1 Note 26. *Recommended:* file it as its own issue and fix it first, the way C went before A. Every shoulder board becomes caution mode, with a caution glyph on page 1 and the crew-sheet line rewritten. #300's left plans then inherit caution and nothing needs mirroring.
   - Alternative (b): fix it inside #300 as the first commit, with its churn row (Rule 5 item 4).
   - Alternative (c): drop the board from shoulder plans, since TA-3 and Case 11 draw none. That changes device counts.
   - Not offered: `LEFT_ARROW` on left plans, which would knowingly break a Standard.
2. **Page 1 for a left plan.** *Recommended:* one reflection applied to every placement rule listed above, text upright. The dimension band moves to the open side. Edge colours follow the physical side (yellow stays on the top lane edge). Marked CHOSEN under R81.
3. **The audit's Case 11 words for a left plan.** *Recommended:* "CDOT S-630-1 Case 11 (right-shoulder closure, mirrored to the left shoulder of a one-way street)", with the mirror marked CHOSEN (S-630-1 draws no left shoulder case; the left legend is MUTCD §6H.22 ¶02). Plus one `pending_verification` item on left plans saying so (Rule 12).
4. **A stale left side.** *Recommended:* the backend refuses with a 400 that names the fix, and the frontend shows its affordance at the side control. No frontend reset (Rule 3; the relay-fact pattern).
5. **The gate.** *Recommended:* R80 through #308's verdict plus the one-way tag (the belt-and-braces check above). The alternative, the verdict alone, would let an operator's "One-way street" answer on an untagged road offer a left edge.

---

## Build plan and Rule 5 prediction for A (2026-10-08, on main `11c81b4`; written before any product code)

Rulings: R78-R82, R90 (via #308), R119 Q2-Q5. #313 (the arrow board) shipped in `11c81b4`. Every shoulder board is now `CAUTION`, so a left plan has no arrow to mirror. Line numbers below are at `11c81b4`.

### Backend

- **The gate, one producer** (`src/api/schemas.py`): `left_side_built(scenario) -> bool`. True only when all of these hold:
  - the scenario is a `ShoulderScenario`;
  - `carriageway_verdict() == "one_way_street"`;
  - `meta.roadDirection.oneway` is a one-way tag (`yes` / `-1`);
  - `meta.centerline` has two or more points (R79, R80, R119 Q5).
- **Gate readers:**
  - `render_api._ensure_pin_model_complete` (`:268-271`): `"left"` passes when the gate holds. Otherwise it's a 400 `pin_model_input` that keeps `'left'` in its message and names the fix (R119 Q4).
  - `"median"` keeps today's refusal.
  - `_side_options` (`:1167-1219`) adds the left edge, `_cardinal(bearing - 90.0)`, same `travel`, when the gate holds. Its docstring is restated.
- **Bearing:** `schemas._corridor_bearing` (`:1154`) derives the bearing for `"left"` too. Both curbs of a one-way street share one travel direction.
- **The field:** `ScenarioParams.work_side: Literal["right", "left"] = "right"` (R82), appended with its default. The shoulder bridge (`schemas.py:1322-1346`) sets it from `meta.work.side`. Still the undivided generator.
- **One sign-code producer:** `shoulder_closed_sign_code(params)` → `"W21-5aL"` on a left plan, otherwise `"W21-5aR"`. Read by:
  - `generate_shoulder_closure_undivided` (`layout.py:672`, `:709`);
  - the audit's sign codes and position labels (`audit.py:733`, `:767-768`, `:815`, `:893-907`);
  - `validate_shoulder_warning_pair` (`validators.py:1718`).

  Every existing right plan gets `"W21-5aR"` from it, byte for byte.
- **Offsets: unchanged.** On a one-way street, offset 0 is the lane edge opposite the work, and positive points toward the work. That's the model's existing "positive = work side".
- **Audit:**
  - The Note 8 row counts by physical side: a left plan's positive offsets are its left signs (`audit.py:947-957`).
  - The Case 11 reference on a left plan reads "CDOT S-630-1 Case 11 (right-shoulder closure, mirrored to the left shoulder of a one-way street)" (R119 Q3), with the mirror marked CHOSEN.
  - One `pending_verification` item on left plans says so (R119 Q3; Rule 12).
- **Crew sheet:**
  - `crew_narrative.py:197` "right side." follows the side.
  - `offset_origin` on a left plan is "the right edge of the roadway".
  - `base.md.j2:48` ("right side of road") and `:55` ("along the right lane edge") read a `work_side_word` that is "right" unless the plan is left.
  - `:128` ("Offsets are measured from the left edge of the roadway") prints `offset_origin`.

### Page 1 (R81, R119 Q2: CHOSEN)

- **The switch:** one context switch, set for the schematic page only when `work_side == "left"`. `_y_of` and a new `_ry(y)` (y mirrored about `PLAN_Y_CENTER`, the plan frame's exact midpoint, so the frame maps onto itself) read it. Text stays upright, so there's no canvas flip.
- **Sites placed by position or direction rather than `_y_of`** (lines at `11c81b4`):
  - `_road_y_extent` `:98-101`: reflected and swapped.
  - `_draw_one_way_street` `:263-338`: every y reflected. **The yellow line goes on the TOP lane edge** (the left of traffic, R119 Q2). In a right plan that's offset 0; in a left plan it's the work-side lane edge.
  - `_deoverlap_items` `:1390`, `_deoverlap_signs_pairwise` `:1449`, the off-road clamp `:1627`, the callout circle `:1731`: "offset ≥ 0 pushes down" becomes "pushes toward the device's own side". Right plans are unchanged.
  - The dimension band `:1860` moves to the open side, below the road on a left plan (R119 Q2). `_draw_dim` gains `below=True`, which hangs the label and raised tiers under the line, mirrored. Its floor is `PLAN_BOTTOM + 26`, the mirror of today's ceiling.
  - The school marker `:1281` goes to the open side as well.
- **Unchanged:** the lane arrows (through `_y_of`, still pointing right), the scale break (reads the reflected extent), the site strips (through `_strip_y_range` → `_y_of`), the frame clamp (symmetric), the legend, notes and title block.

### Frontend

- `lib/scenarios/index.ts:496-499` `hasConfirmedSide` accepts `"left"`. It's a mirror, commented as one; the backend stays authoritative (Rule 3).
- `lib/scenarios/auto-apply.ts` `matchRefusalAffordance`: a `work_side` row mirrors the gate. A stored `"left"` without the gate's facts points at the side control (R119 Q4).
- `components/bands/WhereBand.tsx` `SideControl`: when the stored side is none of the backend's offered options, one line under the control says why. It's derived from the backend's options, not a frontend predicate. No reset (R119 Q4).

### Rule 5: the churn prediction

**Behavior changes, deliberate and stated:**
1. On a confirmed one-way street with shoulder work, the side control offers two rows. On Broadway: "West side · southbound traffic" and "East side · southbound traffic". Every other road, kind and state (two-way, divided carriageway, undecided, no road) is unchanged.
2. `side: "left"` passes the gate, then lays out and generates. Left anywhere else is still a 400 `pin_model_input` with `'left'` in it, now naming the fix.
3. A left plan (all new output):
   - `W21-5aL` wherever a right plan prints `W21-5aR`;
   - every device at the right plan's offsets;
   - the Note 8 row "6 left, 0 right";
   - the Case 11 words, plus the `pending_verification` item;
   - the crew sheet in left words, measured from the right edge;
   - page 1 mirrored.
4. The frontend lets a left side count as confirmed, and a stale left side shows its pointer at the side control.

**Assertions predicted to change:**
- `conestruct/site/lib/scenarios/pin-model.test.ts:142`: `side: "left"` → `true`.
- `conestruct/site/lib/scenarios/rail.test.ts:146-148`: a left side no longer holds the side blocker.

**Predicted unchanged:**
- `tests/test_corridor_geometry.py:226-273`: none of these send carriageway facts, so the verdict is `not_applicable` and they stay right-only.
- `tests/test_work_start_wire.py:100-103`: no road, still refused, `'left'` still in the message.
- `WhereBand.side-control.test.tsx`.
- `tests/test_oneway_street_shoulder.py`, `test_oneway_street_audit.py`, `test_r94_one_way_page1.py`, `test_shoulder_arrow_caution.py`: all right plans.
- **Every recorded baseline:** the 90 snapshot files, the tiering fixtures, the 12 `pdf_worst_case` fixtures and their containment counts, and the S-630 typicals. **Predictor check:** `work_side` is always present, and no snapshot or wire dict serializes `ScenarioParams` wholesale. If the build adds it to one, this row flips before the commit.

**New tests (Rule 11):**
- **Payload:** Broadway left: the two side options; the gate's refusals (two-way, divided carriageway, undecided, no oneway tag, near-intersection, median); the left plan's devices at the right plan's offsets with `W21-5aL`; the Note 8 row, Case 11 words and `pending_verification` item; the crew sheet's left words and origin.
- **Rendered:** a left plan's page 1 has the closed shoulder above the lanes and the yellow line on the top lane edge (read from the drawing calls); dimension labels below the road. A new `pdf_worst_case` fixture, `broadway-left.json`, runs through `test_pdf_containment.py` with zero edge / box-cross / collisions. It adds a fixture and moves none.
- **Mounted flow:** the side control renders two rows from a two-option geometry; a stored left that isn't offered shows the line; the rail's `work_side` pointer.

### Build outcome against the prediction (build `3ae4925`)

**Evidence:** `probes/capture_left.py after` on `3ae4925` → `probes/after/` (summary, both page 1s, Broadway right and left).

| Prediction | Outcome |
|---|---|
| 1. Two side rows on a confirmed one-way street; everything else unchanged | ✔ Broadway: "West side · southbound traffic", "East side · southbound traffic". `tests/test_left_side_oneway.py` pins right-only for no facts, a divided carriageway and undecided |
| 2. Left passes the gate and generates; elsewhere a 400 naming the fix | ✔ The left plan lays out and generates. Divided, untagged-with-answer, near-intersection and no-facts cases are each a 400 `pin_model_input` with `'left'` and the fix; `median` is still refused |
| 3. A left plan: `W21-5aL`, the right plan's offsets, Note 8 "6 left, 0 right", the Case 11 words and pending item, crew sheet left words from the right edge, page 1 mirrored | ✔ All seven, in `after/summary.txt` and the tests. Page 1 (`after/left-page1.png`): the closed shoulder and signs above the lanes, yellow on the top lane edge, arrows pointing right, the dimension band and its labels under the road |
| 4. Frontend: left counts as a side; a stale left's pointer at WHERE; the side-control line | ✔ `left-side.test.ts`, `rail.test.ts` (new case), `WhereBand.left-side.test.tsx` |
| Changed assertions: `pin-model.test.ts`, `rail.test.ts` only | ✔ The verifier found no other existing assertion changed |
| No recorded baseline moves; `work_side` serialized nowhere | ✔ No snapshot, tiering fixture or existing `pdf_worst_case` count changed; `work_side` appears in no serialized dict |
| A new `broadway-left` fixture at zero edge / box-cross / collisions | ✔ Plan sheet, audit PDF and crew PDF all at zero |

**Suites:** backend 2660 passed, 2 skipped; frontend 2072 passed; `tsc` clean. Verifier: PASS.

**Misses:** none found. **Recorded, not a miss:** with every site condition on, the right plan fans signs 4 and 5 sideways at the page floor, while the mirrored left plan stacks them upward into its taller top margin (the frame clamp is symmetric; the space above and below the road isn't). Neither collides.

**Not done here:** a prod check. That waits for Ryan's go and the ship, then a Broadway left plan on prod and Ryan's browser check (frontend-only: no).
