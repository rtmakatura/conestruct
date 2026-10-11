# 📋 Checkpoint: R126, Step 2 to the mockup and the speed as a guess

Investigated on prod `cf13836` (this branch's base, `e47b926` on `issue-301-cross-street-entry`, adds only Mark on map and its evidence), 2026-10-10.
No code written. Rulings: `rulings.md`. Every `path:line` is at `cf13836`; frontend paths are under
`conestruct/site/`.

## Plain English

**No "D3" mockup exists.** I searched the repo, both `design-refs/` folders and Downloads.
- "D3" appears only as "Decision 3" in `setup-what-redesign/checkpoint.md:170` and as probe ids.
- The one Step 2 mockup is `WhatC5.dc.html`, the R107 pick ("Step 2 C5: guesses, no confirm").
- **Q0: please send D3, or say it means WhatC5 with R126's changes.** The plan below assumes the
  latter. Where WhatC5 and R126 disagree, R126 wins: WhatC5 itself says "Speed limit · ✓
  measured".

**The speed.** Today a road with no posted speed keeps whatever speed the scenario already had:
- the kind's default (shoulder 65, flagger 45, near-intersection 35);
- the previous road's speed;
- or a speed carried over from another kind.

The row calls it "your change · operator-set from here on" ("✓ yours"), which is false (Rule 10).
R126 makes the road-class estimate the value, marked "⚠ from the road", and records it as a guess.

Two consequences follow:
- **Every class detection returns has an estimate.** The road scan only returns 12 highway classes,
  and all 12 are in the table. So "◌ not set" in practice means **no confirmed road at the pin**.
- **The estimate now sets tapers and sign spacing with no click.** On an urban residential
  shoulder plan, 65 → 25 mph moves the advance sign spacing from 350 ft (urban high) to 100 ft
  (urban low), and the merging taper L from 780 ft to 125 ft (§3).

**N Cherry St: neither guess is wrong. The road-type label is.**
- The classifier calls every urban non-freeway road `urban_arterial`. There are only four road
  types, and none is an urban street.
- The backend never treats it as an arterial: it maps `urban_arterial` to Table 6B-1's urban row,
  low at 40 mph or less, high above.
- So N Cherry at 25 mph gets the right sign-spacing row. Its WHAT label says "Urban arterial" for a
  residential street.
- **Recommended:** relabel the option "Urban street". No wire change and no plan change (Q4).

---

## 1. Rule 3: who owns what

| Decision | Owner today | After R126 (recommended) |
|---|---|---|
| The class → mph table | backend (`src/rules/speed_estimate.py`, R123); frontend mirror | unchanged |
| Prefilling the guess | (none: Use N mph was the only writer) | **frontend**, at the same seam R108 prefills street class (`lib/scenarios/guesses.ts` `withCurrentGuesses`), from the confirmed road at the pin |
| The record on the wire | `speed_estimate: {highwayClass}` (operator_confirmed) | **`guesses.speed: {highwayClass}`**, R108's own relay-fact field (`schemas.Guesses:366`). `speed_estimate` and `input_estimates` are retired: one mechanism for every guess |
| Re-deriving and refusing a stale guess | backend `input_estimates` | backend `input_guesses` gains the speed entry: recompute, compare to `scenario.speed`, `guess_stale` 400 on mismatch |
| "Not set → can't generate" | (no such state) | Q1 |

**Why the prefill stays in the frontend:**
- The WHAT band must show the value before Generate.
- The backend still owns every claim: the table, the recompute, and the audit wording.
- This is R110 Q1's settled shape. It is unchanged here and only gains a third field.

## 2. Every kind the old default reached

| Kind (`lib/scenarios/index.ts`) | Default speed | Schema range (`schemas.py`) | WHAT options (`what-cells.ts`) | Status |
|---|---|---|---|---|
| shoulder | 65 (`:112`) | 20–75 (`:495`) | 25–75 | enabled |
| flagger_lane_closure | 45 (`:137`) | 20–55 (`:618`) | 25–55 | enabled |
| near_intersection | 35 (`:215`); each approach 30 (`:226`) | 25–55 (`:861`; approach `:783`) | 25–55 | enabled |
| lane_closure_divided | 65 | 35–75 | 25–75 | gated |
| work_beyond_shoulder | 45 | 20–75 | 25–75 | gated |
| mobile_op_2lane | 45 | 25–55 | 25–55 | gated |
| mobile_op_multilane | 65 | 45–75 | 25–75 | gated |

**How a speed reaches a plan today:**
1. **A road with `maxspeed`:** the snapped tag value (`auto-apply.ts:552-556`). Unchanged.
2. **A road without `maxspeed`:** `speedPatch` is `{}`, so the plan keeps its current speed
   (`auto-apply.ts:552`). **R126 replaces this path.**
3. **No road (manual pin, no detection):** the default. R126: "◌ not set" (Q1).
4. **A kind switch:** `snapSpeedToDomain(next.kind, prev.speed)` (`index.ts:414`). The guess
   carries with the speed, and the record drops if the snap moves it (the R123 code already does
   this).
5. **The near-intersection approach speed:** `cs.speedMph ?? 30` (`lib/road-detection/cross-street.ts:198`).
   A second silent default that R126 doesn't name. **Q8.**
6. **An unparseable `maxspeed`** ("signals", "none"): classified at medium confidence with the
   class value. The R123 offer skipped it. R126 says "no posted speed", so it is guessed too.
   **Q2.**

## 3. Which roads get which speed

From the backend table (`src/rules/speed_estimate.py`), mirrored in `classify.ts:22-35`. A ⇣ marks
a value the kind's range snaps:

| OSM class | Estimate | Shoulder (was 65) | Flagger (was 45) | Near-intersection (was 35) |
|---|---|---|---|---|
| motorway | 65 | 65 | ⇣ 55 | ⇣ 55 |
| trunk | 55 | 55 | 55 | 55 |
| primary, motorway_link, trunk_link | 45 | 45 | 45 | 45 |
| secondary | 40 | 40 | 40 | 40 |
| primary_link, tertiary | 35 | 35 | 35 | 35 |
| unclassified, secondary_link, tertiary_link | 30 | 30 | 30 | 30 |
| residential | 25 | 25 | 25 | 25 |

**A snapped value is still a guess.** When the snap moves the estimate (motorway on flagger: 65 →
55), the record would claim a value the plan doesn't carry. The R123 rule was to write no record in
that case. Q3 asks whether it reads "◌ not set" instead.

**What the estimate drives** (an urban shoulder plan, 12 ft lane; `spacing.py:38-52`,
`tables.py:101-141`):

| Estimate | Table 6B-1 row (urban) | Advance sign spacing A/B/C | Merging taper L (WS²/60 below 45, WS at 45 and up) |
|---|---|---|---|
| 25 | urban low | 100 ft | 125 ft |
| 30 | urban low | 100 ft | 180 ft |
| 35 | urban low | 100 ft | 245 ft |
| 40 | urban low | 100 ft | 320 ft |
| 45 | urban high | 350 ft | 540 ft |
| 65 (the old shoulder default) | urban high | 350 ft | 780 ft |

The shoulder taper itself is L/3 over the shoulder width (`plan_sheet.py:86`). These are the
tables' own figures; no plan was rendered for this checkpoint. The build renders N Cherry St
before and after.

**Where the estimate is wrong in the data we have:**
- `scan-refusal-rate/probes/out/pins-resolved.json`: 2 of 9 Denver arterials carry no `maxspeed`.
  E Bayaud Ave and S University Blvd are both primary, so both are guessed at 45, while their tagged
  neighbours are posted 30–35.
- So the estimate can run **higher** than the posted speed. That lengthens spacing and tapers, which
  is conservative but still wrong. The ⚠ marker and the audit line are what flag it.
- `issue-290-pin-work/probes/rb-*.json`: E 11th Ave (tertiary) is untagged and guessed at 35; W
  11th Ave, the same class, is tagged 25.

## 4. N Cherry St, road type vs street class

**Street class "Local":** residential → local (`src/rules/street_class.py`, R110). Right by the
codebase's own table.

**Road type "Urban arterial":** `classifyFromOsmTags` → `roadTypeAndDivided` maps every non-motorway
class to `isUrban ? "urban_arterial" : rural_*` (`classify.ts:183-188`).
- `isUrban` is true when there is any urban place node within the scan radius
  (`app/api/road-bearing/route.ts:361-365`).
- The four road types are rural undivided, rural divided, urban arterial and freeway
  (`what-cells.ts:119-124`; `schemas.py:442-467`). None is an urban local street.

**What the backend does with it:**
- `_map_road_type` sends `urban_arterial` to Table 6B-1 urban_low (40 mph or less) or urban_high
  (above 40) (`schemas.py:1109-1137`; `ta-mapping.md:22-23`).
- The deliverables already print "Urban (low-speed)" or "Urban (high-speed)"
  (`validators.py:291-297`).
- So the plan is right. The label is the defect: WHAT says "Urban arterial" about a residential
  street.
- It also shows the urban-arterial-only Divided toggle (`PlanDetails.tsx:62-68`), which is the row
  that renders "i about".

**Q4, recommended:** relabel the option "Urban street" everywhere it is shown:
`what-cells.ts:122`, `detected-rows.ts:42`, `band-facts.ts:98`, `HandoffNotes.tsx:45` and the two
gated forms.
- The wire enum stays `urban_arterial`, so no backend, plan or baseline moves.
- **Not recommended:** a new `urban_local` enum. It maps to the same Table 6B-1 rows, so it would
  change nothing in the plan, at the cost of a schema change.

## 5. The other R126 items, as they stand

**One marker per row (Lanes).**
- Today the row shows the count's marker plus R110 Q7's width marker ("✓ default", from `extra`,
  `WhatBand.tsx:143-145, 412-414, 506`).
- Under R126 the row shows **one** marker: the count's.
- The width's own line stays in the row's details popover, so R110 Q7's information isn't lost, just
  unmarked.
- This supersedes R110 Q7's "two markers"; R126 says so.

**Labels.**
- "Speed limit" → "Speed": `WhatBand.tsx:448`, the detection row label `detected-rows.ts:62`, and
  the refusal text at `render_api.py:549-550`.
- **Q6:** also the Setup box link ("Change Speed limit", `band-facts.ts:324`) and the revision band
  (`RevisionBand.tsx:107`)? Recommended yes, one name per field (P11).
- "Divided highway" → "Carriageway" (`PlanDetails.tsx:332, 338`). Its options stay Undivided /
  Divided.
  - The existing Carriageway row (One-way / Divided) shows only on a one-way road.
  - The divided toggle shows only on an urban road that isn't one-way (`showsDividedToggle`,
    `PlanDetails.tsx:62-68`).
  - So the two never appear together, and the label can be shared.
- "i about": the marker's fallback (`provenance-marker.ts:75`). The only row that hits it is the
  divided toggle's "median present · every other road type sets this itself (#85)"
  (`PlanDetails.tsx:333`).
  - Under R126 that row's line becomes "your answer" or "default", depending on whether the
    operator set it, so the marker reads "✓ yours" or "✓ default".
  - No row can reach the fallback any more. A test pins that every WHAT row's marker is one of the
    known words.

**Denver windows into the footer.**
- The windows block (`ScheduleField.tsx:249-345`, mounted from `components/GeneratorSidebar.tsx:478` at `cf13836`, `:486` on this branch, placed
  at `WhatBand.tsx:701`) becomes one footer line: "Denver windows · set dates to check".
- Once dates are set, the same line carries the verdict, with the table opening from it like File
  details does (`WhatBand.tsx:264`).
- **Q5:** the footer line's words once dates are set. Recommended: "Denver windows · ✓ inside" /
  "⚠ outside the window", opening the table (P13).

**Header.** `whatHeader` (`WhatBand.tsx:239-244`) counts the ⚠ markers in `warnMarkers`
(`:418-426`). Speed is already a term in it; with the guess line "⚠ from the road" it counts
automatically. N Cherry St today shows 3 (road type, class, jurisdiction), and under R126 it shows
4.

## 6. Audit and PDF wording

The speed joins R108's record (`render_api.input_guesses`, `audit_blocks._input_guesses_blocks`):

> Speed: 25 mph. Guessed from the road class (OSM highway=residential; the road carries no posted
> speed). The operator did not confirm it. Confirm the posted speed on site.

- `_GUESS_FIELD["speed"] = "Speed"`, `_GUESS_SOURCE["road_class"] = "the road class"`,
  `_GUESS_CAVEAT["road_class"] = "Confirm the posted speed on site."`
- The JSON record is
  `{field: "speed", value: 25, label: "25 mph", source: "road_class", evidence: "...", operator_confirmed: false}`.
- `input_estimates`, the "Estimated inputs" block and `speed_estimate` are retired (R126 supersedes
  R123 Q2).
- **Q7: which outputs print the qualifier.** Today:
  - the plan sheet prints "{speed} MPH" (`plan_sheet.py:2125`);
  - the XLSX prints "Speed (mph)" (`device_list.py:247`);
  - the crew sheet prints the speed with no source.
  - R110 Q3 added "(guessed from the pin, not confirmed)" to the XLSX and crew jurisdiction lines.
  - **Recommended:** the same for speed on the XLSX and crew sheet, "25 mph (guessed from the road
    class, not confirmed)". The crew in the field is who most needs to know. Leave the plan sheet's
    title block as it is, as R110 did for jurisdiction.

## 7. Questions

- **Q0:** the D3 file, or confirm it means WhatC5 with R126's changes.
- **Q1: "◌ not set → can't generate". Recommended (b).**
  - **(a)** Make `speed` nullable on the wire for all 7 kinds, with a backend 400 and a frontend
    gate. Cleanest for Rule 3, but it is a schema change across 7 kinds and every fixture's type.
  - **(b)** Keep the wire's required int, and add an `OperatorSetField` "speed" plus a frontend
    "speed set" predicate:
    - a speed is **set** when it is measured (a tag), guessed (`guesses.speed`), or written by the
      operator;
    - unset, the row reads "◌ not set";
    - `checksArmed` holds the live checks the way an unset side does
      (`GeneratorShell.tsx:453-463`), so no preview computes with a hidden 65;
    - the rail gains a blocker rank ("Set the speed in Step 2");
    - the wire never carries an unset speed, because nothing is sent before it is set.
    - "speed" joining `OperatorSetField` also gives R110 Q4's protection: a new detection never
      overwrites an operator's speed.
- **Q2:** guess on an unparseable `maxspeed` too? Recommended yes: R126's "no posted speed" covers
  a tag nobody can read.
- **Q3:** an estimate the kind snaps (motorway on flagger, 65 → 55). Recommended: prefill the
  snapped value, marked "⚠ from the road", with the audit evidence saying "estimated 65 mph,
  capped at 55 for this kind". The alternative, "◌ not set", makes the operator pick, which is more
  honest but blocks more plans.
- **Q4:** relabel `urban_arterial` "Urban street". Recommended yes, label only.
- **Q5:** the footer line's words once dates are set (§5).
- **Q6:** rename "Speed limit" in the Setup box and the revision band too. Recommended yes.
- **Q7:** the XLSX and crew sheet qualifier (§6). Recommended yes; the plan sheet stays as it is.
- **Q8:** the near-intersection approach speed's silent 30 (`cross-street.ts:198`). Recommended:
  out of scope here, filed as its own issue (the cross street's class is detected, so the same
  estimate could apply).
- **Also found:** WHAT's speed options start at 25, but the snap floor is 20. A road posted at 20
  (Elizabeth St and City Park Esplanade are tagged 20 mph in `issue-290-pin-work/probes/rb-colfax.json`)
  would hold a value the select can't show. Not verified in the UI. Recommended: add 20 to the
  options of the kinds whose schema range allows it, in this arc.

## 8. Rule 5: predicted churn (with Q1 (b), Q2–Q7 as recommended)

**Deliberate behaviour changes:**
1. **A road with no readable posted speed:** the plan's speed becomes the class estimate, marked
   ⚠, recorded as a guess. Plans change, which is the point of R126: the spacing and taper of every
   such plan move (§3).
2. **No confirmed road:** speed reads "◌ not set". The live checks hold and Generate is blocked until
   the operator picks one.
3. **The R123 estimate is retired:** no Use N mph, no estimate line, no `speed_estimate`, no
   `input_estimates`, no "Estimated inputs" block. Prod has carried these since `cf13836`, so a
   saved plan holding `speed_estimate` is read as a plain operator speed: the field is dropped on
   load, and the backend ignores it.
4. **Markers:** Lanes gets one marker; the divided toggle's row gets a known word, never "i about".
5. **Labels:** "Speed", "Carriageway", "Urban street" (Q4), and "Speed" in the Setup box and the
   revision band (Q6).
6. **Footer:** the windows block folds into a footer line.
7. **Header:** speed counts among the guesses.
8. **Audit:** the JSON's `input_guesses` gains speed records. The audit PDF's "Guessed inputs" block
   gets the speed line. The XLSX and crew sheet get the qualifier (Q7).

**Not changing (proved at the build):**
- Plans whose road carries a readable `maxspeed`: byte-identical.
- Plans with an operator-set speed: byte-identical.
- The plan sheet; jurisdiction and street-class guesses; every backend baseline (all fixtures
  carry an explicit speed).

**Backend tests:**
- `tests/test_speed_estimate.py` (11 run: 8 tests, one parametrised over 4 paths) is rewritten as `guesses.speed` tests: the mirror stays, and
  the record, stale 400 and PDF line move to the guess shape.
- `tests/test_r108_guesses.py`: about 5 additions (the speed record, its PDF line, the XLSX and crew
  qualifier).
- No existing baseline moves.

**Frontend tests:**
- **Rewritten or deleted:**
  - `lib/scenarios/speed-estimate.test.ts` (8) → guess tests;
  - `components/WhatBand.speed-estimate.test.tsx` (3) → the ⚠ line and the "◌ not set" row.
- **"Speed limit" label:** about 25 hits in 20 files (GeneratorForms.a11y, WhatBand.declutter,
  spacing-scale, seven stubbed `<label>`s, DetectedVsApplied, band-facts, value-links,
  ResultsHead.grid, revision, site-corrections, road-pick). Mostly mechanical.
- **Lanes markers / "✓ default":** about 21 hits in 9 files (mostly `WhatBand.declutter` ×7,
  `PlanDetails.test` ×3, `WhatBand.detection` ×3).
- **Windows:** `ScheduleField.windows-block.test.tsx` (6), `GeneratorShell.class-stability` (7).
- **Header:** `WhatBand.declutter` (6), `PlanDetails.test` (1), `guesses.test` (1).
- **"i about":** `provenance-marker.test.ts:42`.
- **Default-speed fixtures:** `DEFAULT_*` appears 517 times across 66 files. With Q1 (b) the wire
  type doesn't change, so these hold. Tests that mount a pin with no road and press Generate would
  now meet the speed blocker: **about 10 GeneratorShell suites, to be enumerated at the build.**
- **New:**
  - the guess prefill (a road with no tag, an unparseable tag, a snapped value, no road);
  - "◌ not set" holds the checks and blocks Generate;
  - an operator speed is never overwritten;
  - one marker per row;
  - the footer line;
  - the header count with speed.

**Lane:** normal, `frontend-only: no`. Screenshots at 1440 and 390 on N Cherry St (guessed 25) and
on a pin with no road (◌ not set).

## 9. Principles (DESIGN-PRINCIPLES.md)

The surface is the WHAT band, FLOW step 2 (What), for the rep and the estimator.

| P | Verdict | Note |
|---|---|---|
| P1 | honoured, measured at the build | The speed line replaces the alert slot's two-line estimate with a one-line marker; the footer line replaces a taller block. Rows only shrink. Rect table per state. |
| P2 | **fixes a deviation** | One mechanism for every guess (`guesses`), one marker per row. |
| P3 | honoured | "◌ not set" names the step; the rail says what blocks Generate. |
| P4 | honoured | Labels and markers keep WhatC5's column edges. |
| P5 | honoured | Marker words stay `tr-prov`. |
| P6 | honoured | The footer line wraps inside the footer at 390 (measured). |
| P7 | n/a | |
| P8 | honoured | The held checks say why (the rail), the way an unset side does. |
| P9 | **fixes a deviation** | "i about" was a symbol with no word for the row's state; every row now has one of the known words. |
| P10 | honoured | No new targets; the footer link keeps the existing 44 px floor at 390. |
| P11 | **fixes a deviation** | "Speed" everywhere (Q6); one guess vocabulary. |
| P12 | honoured | |
| P13 | honoured | The windows table opens from its footer line (the 80% case is "no dates yet"). |
| P14 | honoured | "◌ not set" shows the shape of the answer. |
| P15 | honoured | A guess the operator changes becomes theirs (R110 Q4). The record stays honest. |
| P16 | honoured | No placeholder number: the hidden 65 is exactly what R126 removes. |
| P17 | honoured | FLOW step 2, the rep and the estimator. |
| P18 | honoured | One question: "Anything we got wrong?". |
| P19 | honoured | The windows table is opt-in. |
| P20 | honoured | "The road" / "The job" stay. |
| P21 | honoured | |
| P22 | n/a | |

**Rule 10:** the silent "✓ yours" on a default is the defect R126 removes, and the plan now states
every source.

## 10. Proposed branches, in ship order

Each stacks on the one before.
1. **`r126-speed-guess`** (backend + frontend):
   - the speed guess and its record;
   - "◌ not set" with the hold and the blocker;
   - the R123 estimate retired;
   - the audit, XLSX and crew wording;
   - Q2, Q3 and the 20 mph option.
   - Reports with screenshots before ship.
2. **`r126-step2-layout`** (frontend):
   - the labels (Q4, Q6);
   - one marker per row;
   - the footer windows line;
   - the header.
   - Reports with screenshots at 1440 and 390, laid against WhatC5 (or D3).
