# 📋 Checkpoint: #312, a near-intersection lane closure on a divided road signs one side only

Investigated on main `9fc9840`, 2026-10-12. No code written. Probe:
`probes/divided_ni_probe.py` → `probes/divided_ni_probe.txt` (TestClient, Overpass stubbed, no
network). R133 asked for this checkpoint; #309 (one-way streets, shipped `4c1a324`) is the approach
to reuse where it fits.

## Plain English

**What's wrong.** A lane closure near an intersection on a divided road is built as if the road were
two-way and undivided.
- **One side:** all 8 mainline signs go on the right curb and none on the median side, though S-630-1
  Note 8 requires both sides on a divided highway.
- **A false title:** the plan is titled "· Undivided".
- **A Note 8 row that says it isn't required:** "Required: False".

The audit is **byte-identical** to the same plan on a two-way road. #309 fixed this for one-way
streets; on a divided road the kind still drops the divided-ness on the floor.

**Why it happens.**
- **The schema refuses `divided: true` for this kind** (`schemas.py:914-922`: "divided intersections
  aren't supported yet. Cases 18/19 are undivided/arterial plates; a divided mainline adds the
  median-opening question (deferred)"), and the frontend always sends `divided: false`.
- **The verdict is dropped.** #308's carriageway facts do reach the backend, and the verdict there is
  `divided`. But the near-intersection bridge sets `is_divided=False` (`schemas.py:1587`) and mirrors
  signs only when `one_way_street` (`layout.py:1647-1657`).
- **#309 kept it that way on purpose** (R114 Q3 (a): "Keep today's behavior for a divided verdict on
  this kind, and draft the follow-up issue"). This is that issue.

## The rule: S-630-1 Note 8, verbatim

CDOT S-630-1 (July 2026), **Sheet 2, General Note 8** (`validation-artifacts/committed/issue-308-
oneway-read-as-divided/sources/s630-1-2026-pdf150.txt:76-80`; also quoted at `src/rules/tables.py:292-296`):

> "8. All warning and regulatory signs shall be posted on both sides of the roadway on divided
> highways, multi-lane ramps, one-way streets, and as directed by the Engineer, except where only one
> shoulder is closed (ex: Case 11 on Sheet 7)."

- **Sheet:** Note 8 is on Sheet 2, not Sheet 10.
- **The plate:** Sheet 10 holds Cases 18/19, the near-intersection plates, which draw an undivided
  arterial. They say nothing about a median opening.
- **The exception doesn't apply:** a lane closure is not "only one shoulder is closed", so on a
  divided highway Note 8 binds.

## The payload-level repro (`probes/divided_ni_probe.txt`)

**The case:** Colorado Blvd at E Exposition Ave, `39.70900, -104.94070`, a work-start
near-intersection plan, two cross-street legs. Its #308 carriageway facts are OSM way `oneway=yes`
with a same-name twin carriageway 14.8 m away, so the verdict is `divided`.

| | Divided verdict (the repro) | Same road, no twin (one-way, #309) | Two-way |
|---|---|---|---|
| Params | `is_divided=False`, `one_way_street=False` | `one_way_street=True` | as the divided row |
| Mainline signs, right curb | 8 (G20-1, G20-2, G20-5P, R2-10, R2-11, W20-1, W20-5R, W4-2R) | 8 | 8 |
| Mainline signs, median / left side | **0** | 8 at −4.0 ft | 0 |
| Placements | 34 | 42 | 34 |
| Note 8 row | "Signs on both sides of divided highway · **Required: False.** Signs placed: 0 left, 8 right." | "… one-way street · Required: True. Signs placed: 8 left, 8 right." | as the divided row |
| Title (`validators.py:450-455`) | "Lane Closure Near Intersection · **Undivided**" | "… · One-Way Street" | "… · Undivided" |

- **The divided-verdict audit is byte-identical to the two-way audit.**
- **Sending `divided: true` on the wire** answers 422 with the `_check_not_divided` message.

---

## Options

**(a) Recommended: #309's route.** A divided verdict on this kind is read as **one carriageway of a
divided road**. The carriageway is one-way, and its left curb is the median edge. It is the same
geometry #309 already builds for a one-way street, so we reuse #309 whole and change only what has to
say "divided".
- **Params:** a new `ScenarioParams.divided_carriageway`, set from the verdict. `is_divided` stays
  False, so the lane geometry, the device-spacing minimums (`layout.py:107-108`), the shoulder width
  and the drawing (no median drawn: we draw one carriageway, as for a one-way street) don't move.
- **Signs:** every mainline sign is mirrored at −4.0 ft from the median edge, #309's CHOSEN offset
  (Q2). That's 8 left, 8 right, G20s included (R114 Q2's "all eight").
- **The Note 8 check owes both sides** (`validate_co_signs_both_sides`). The audit row reads
  "Required: True. Signs placed: 8 left, 8 right." with its existing "divided highway" label.
- **Title:** "Lane Closure Near Intersection · Divided Highway". Narrative and crew sheet: the
  left-side lines #309 added, worded for a median.
- **The median opening (Q3)**, which Cases 18/19 don't cover: an audit `pending_verification` line
  plus one crew-sheet line, and nothing drawn.
- **Unchanged:** every one-way and two-way plan, byte for byte, and the cross-street approaches.

**(b) Full divided geometry.** The verdict sets `is_divided=True`.
- **What it changes:** the plan sheet draws a median, the spacing minimums change, the title follows,
  and the signs mirror at the divided generator's `−sign_offset`.
- **Against it:** #309's checkpoint measured `−sign_offset` landing past the drawn road (−46 ft on
  Broadway, `issue-309-oneway-near-intersection/checkpoint.md:46`). It also changes device counts and
  the sheet for a plate that never drew a median. That means more churn and a known placement problem.

**(c) An honest refusal.** A divided verdict on this kind answers 400 on the deliverables, in #317's
shape.
- **What it looks like:** the side control and the rail say the plan can't be laid out on a divided
  road yet, with a recovery ("Lane closure, divided highway" is its own kind).
- **Against it:** no plan for a real situation (work near a cross street on a divided arterial). The
  recovery kind has no cross street at all.

(d) Leave it, recorded so the plan stops claiming "Undivided" — not recommended: the sheet still
violates Note 8.

## Questions

**Q1. Which option?** Recommend **(a)**: Note 8 satisfied with #309's proven geometry, the smallest
change that stops the plan lying, and a byte-identical guarantee for every other plan.

**Q2. The median-side offset.** Recommend **−4.0 ft from the median edge**, #309's CHOSEN value (R114
Q1), marked CHOSEN again. The alternative is the divided generator's `−sign_offset`, which lands
outside the drawn carriageway.

**Q3. The median opening.** Cases 18/19 draw no median, so the plates don't say how the cross street
crosses one or what the opposing carriageway's traffic sees. Recommend that the plan state it rather
than guess:
- **Audit:** a `pending_verification` item: "Divided highway: the cross street crosses a median
  opening the S-630-1 Sheet 10 plates don't draw. Confirm the opening's signing and any turning
  traffic with the Engineer (Note 8: 'as directed by the Engineer')."
- **Crew sheet:** one line saying the same.
- **Not drawn:** nothing about the opening.

The wording would be final in the build report.

**Q4. The title words.** Recommend "Lane Closure Near Intersection · Divided Highway", in the same
form as "· One-Way Street".

## Where it lives (the build, under (a))

- **`schemas.py`, the near-intersection bridge:** `divided_carriageway = scenario.carriageway_verdict()
  == "divided"`. `is_divided` stays False. `_check_not_divided` is unchanged: the wire's
  `divided: true` still answers 422, since the verdict is what decides.
- **`validators.py`:**
  - `ScenarioParams.divided_carriageway: bool = False`;
  - the title branch;
  - `validate_co_signs_both_sides` owes both sides when `divided_carriageway`;
  - the Note 8 row label is already "divided highway".
- **`layout.py:1647`:** the mirror runs when `one_way_street or divided_carriageway`, at the same
  −4.0 ft.
- **`audit.py`:** the narrative line and the `pending_verification` item. `crew_narrative.py`, the
  template and `plan_sheet.py` reuse #309's left-side lines with the median wording.
- **Frontend:** no control changes. The verdict already rides the carriageway facts, and the
  Carriageway row already shows "divided" for the operator to answer. Only the comments that say "a
  divided verdict keeps today's plan" (`PlanDetails.tsx:393-397`, `auto-apply.ts:732-745`) are reworded.

## Rule 5: predicted churn (under (a))

**Deliberate changes:** a divided verdict on a near-intersection plan gets:
- 8 median-side mainline signs at −4.0 ft (34 → 42 placements);
- the Note 8 row "Required: True. Signs placed: 8 left, 8 right.";
- the title "· Divided Highway";
- the median-opening `pending_verification` item and crew line;
- the narrative's left-side wording for a median.

**Not changing, proved at the build:**
- Every one-way (#309) and two-way near-intersection plan: byte-identical (the existing #309 suite
  plus a new two-way identity test).
- Every other kind: byte-identical.
- The wire: `divided: true` is still refused.

| Area | Files | Rough count |
|---|---|---|
| Backend, existing | `tests/test_r114_one_way_near_intersection.py::test_a_divided_verdict_keeps_today_s_plan` pins today's behaviour and is **rewritten** to the new plan. `test_intersection_schema.py::test_divided_mainline_rejects` and `corpus/test_near_intersection.py` `ni-bound-divided` are unchanged: the wire field is still refused. `test_near_intersection_generator.py:340` (the "· Undivided" title) is unchanged: it's the two-way body | 1 |
| Backend, new | `tests/test_divided_near_intersection.py`: 8 + 8 mirrored at −4.0 ft; the Note 8 row; the title; the pending item; the crew line; the two-way and one-way identity; the wire's `divided: true` still refused | ~10 |
| Frontend | comments only; `auto-apply.test.ts:478-483` and `PlanDetails.carriageway.test.tsx:128-135` stay true (divided stays false on the wire) | 0 |

**Lane:** backend, plus frontend comments only. `frontend-only: no`.

**Evidence at the build:**
- the probe re-run;
- the plan sheet (page 1, page 2) for Colorado Blvd at E Exposition Ave;
- the audit PDF's Note 8 row and pending item;
- the crew sheet's lines.

There's no UI change, so the screenshots are of the deliverables.

## Principles

**Surfaces:** the plan sheet, the audit and the crew sheet (FLOW's deliverables, the estimator and the
crew).

- **P2: fixes a deviation.** The title said "Undivided" on a divided road, and the Note 8 row said
  "Required: False".
- **P14: honoured.** Signs are placed where the drawn road is (−4.0 ft), not past it.
- **P21: fixes a deviation**, the label #312 carries.
- **Others:** unchanged surfaces, honoured or n/a.

## What I need from you

Q1–Q4. With (a) / −4.0 ft CHOSEN / the pending item and crew line / "· Divided Highway", I'll build
`issue-312-divided-ni`:
- the Rule 5 prediction first;
- then the backend with its tests;
- then the verifier, the deliverable evidence, and a report with the ship line.
