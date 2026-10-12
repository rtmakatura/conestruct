# 📋 Checkpoint: #317 (no crossing marked) and #316 (a silent 30 mph on the approaches)

Investigated on `0fafcc7` (`r128-footer-polish`'s tip; `src/` is prod `2e136ad`'s), 2026-10-11. No
code written. One report for both, as R128 asked when they share files: both change
`src/api/schemas.py` and `src/api/render_api.py`, and both reach the near-intersection screens.

- **Probe:** `probes/no_crossing_probe.py` → `probes/no_crossing_probe.txt` (TestClient, Overpass
  and the aerial fetch stubbed, no network).
- **Shape:** #317 follows #315's; #316 follows R126/R127's.

## Plain English

**#317, what's wrong.** A near-intersection plan carries its cross street as a second pin
(`meta.intersection`). Until it's marked, the backend refuses the whole scenario at the door. It's a
model validator (`schemas.py:922-926`), so FastAPI answers **422** before any endpoint's code runs, and
the site's proxy turns that into a 400. The two reads the WHERE band makes are refused the same way.
So the band says "the road's sides are unavailable" and "The aerial didn't load", and the next step
(mark the crossing) is named nowhere it can be reached.

**#317, the fix.**
- **The two reads** let the missing crossing through and answer a new status,
  `intersection_not_marked`, with the backend's line "Mark the cross street on the map to lay out
  the sides."
- **The side control** shows that line with ⚠ and a **Mark on map** button. It's the same button
  WHAT already has (#301), and it opens the picker ready to mark.
- **The aerial** shows the pin picture.
- **Every deliverable** keeps today's refusal, byte for byte.

**#316, what's wrong.** The approaches take the cross street's posted speed, or 30 when it has none
(`cross-street.ts:198`). The same 30 stands when the crossing is marked but no cross street is
detected: the picker leaves the default approaches alone (`GeneratorSidebar.tsx:335`). Either way
it's a silent default, and it moves real signs: each approach's W20-1 sits at 2A and its R2-10 at A,
from that speed (`layout.py:1395-1405`).

**#316, the fix (R126's rule, per approach).**
- **No posted speed, a known class:** the cross street's class estimate becomes the approach speed,
  marked "⚠ from the road" and recorded as a guess. The backend recomputes it, and it's stated in the
  audit, the crew sheet and the plan sheet's notes.
- **No class at all:** the approach speed is "◌ not set", and Generate waits for it (R127 Q1 (b)).

### Measured today (`probes/no_crossing_probe.txt`, the Broadway SB road, near-intersection, work-start)

| Case | Geometry | Aerial `pin` | Aerial `work` | Audit / PDF |
|---|---|---|---|---|
| No side, no crossing (the #317 repro) | **422** "needs meta.intersection" | **422** | **422** | 422 |
| ↳ the read, if let through | 200 `side_not_confirmed`, West side · southbound | 200 PNG | 409 `side_not_confirmed` | (unchanged) |
| Right side stored, no crossing | **422** | **422** | **422** | 422 |
| ↳ the read, if let through | 200 **`laid_out`** | 200 PNG | **200 PNG: a corridor with no cross street in it** | (unchanged) |

The last row is why the new status is needed, not just #315's "treat it as unset". Once a side
stands, the reads would lay out and draw a corridor that leaves out the approaches: a wrong
picture (P14). The new status holds both reads at the pin until the crossing is marked.

---

## 1. #317: the exact response shape

### `POST /render/corridor-geometry`

**Unchanged** for every scenario but a work-start near-intersection with no `meta.intersection`
(byte for byte; no new key anywhere else).

**A work-start `near_intersection` with `meta.intersection` absent:**

```json
{
  "status": "intersection_not_marked",
  "pin_model": "work_start",
  "pin": [39.7337, -104.98753],
  "travel_bearing_deg": null,
  "work": null,
  "approaches": [],
  "coverage_ft": null,
  "coverage_start_ft": null,
  "message": "Mark the cross street on the map to lay out the sides.",
  "side_options": [
    {"work": {"side": "right", "travel": "with_geometry"},
     "label": "West side · southbound traffic", "built": true}
  ]
}
```

- **The rest of the keys** are what the probe measured with the crossing let through.
  - `travel_bearing_deg`, `work` and `coverage_*` stay null even with a side stored: nothing is laid
    out without the crossing (the probe's second case).
  - `side_options` are listed, because they're true, but the UI doesn't offer them yet (Q1).
- **`message`** is the existing key `corridor_unbuildable` already uses for its sentence. The side
  control renders it verbatim, so the frontend composes nothing (one voice, P2).
- **The no-pin answer wins:** a plan with no pin still answers `no_pin`, as today.

### `POST /render/corridor-map`

- `stage: "pin"` → 200 PNG (the pin).
- `"work"` / `"laid_out"` → 409 `{"status": "intersection_not_marked", "message": "Mark the cross
  street on the map to lay out the sides."}`, the same 409 shape as `side_not_confirmed`.

### Every deliverable endpoint

**Unchanged, byte for byte:** `/render/audit`, `/audit-pdf`, `/pdf`, `/xlsx`, `/markdown`,
`/crew-pdf`, `/quote`, `/device-breakdown`, `/quote-breakdown`, `/replication-snapshot` and the site's
bundle route. Each still answers today's 422, which the site's proxy turns into a 400 with the same
"needs meta.intersection" text.

### Where it lives (the build)

The check stays in the model validator, so every deliverable is untouched. It skips only when the
two reads ask it to:
- **The validator:** `_check_station_producer` reads pydantic's validation context. It skips the
  crossing check when `info.context == {"reads": "crossing_optional"}`. With no context (FastAPI's
  normal body parsing, every deliverable, every `TypeAdapter` call in the tests), it raises exactly
  as now. `test_work_start_needs_the_marked_intersection` stays green unchanged.
- **The reads:**
  - `/render/corridor-geometry` and `/render/corridor-map` take their body as JSON and validate it
    themselves, with that context.
  - A validation error is re-raised as FastAPI's `RequestValidationError` with the same `loc`
    prefix, so any other bad body answers the same 422 as today.
  - The station check that remains (`drop alongStationFt`) is unaffected.
- **One predicate:** `_intersection_not_marked(scenario)`, a work-start near-intersection with no
  `meta.intersection`. The geometry read answers the status before laying out. The map read refuses
  `work`/`laid_out` with it.

## 2. #317: the frontend

- **`lib/corridor-geometry.ts`:** `GeometryStatus` gains `"intersection_not_marked"`.
- **`lib/corridor-aerial.ts` `aerialStage`:** `intersection_not_marked` → `"pin"`.
- **`components/bands/WhereBand.tsx` `SideControl`:** on that status it shows "⚠ " +
  `geometry.message` and a **Mark on map** button (`data-testid="side-control-mark"`), in place of
  the chips (Q1).
- **`onMarkIntersection`** is threaded GeneratorSidebar → BandStack → WhereBand, and calls the
  existing `openPicker(true)`. WhereBand has no way to open the picker ready to mark today; its
  `onOpenPicker` takes no argument.
- **`components/bands/BandAerial.tsx`:** at the pin stage, this status's note is `geometry.message`,
  not the side sentence "Say which side is occupied…" (Q2).
- **The rail:** its WHERE row points to the side control as today. That control now says what to
  do, so the rail adds no second voice.
- **Unchanged:** WHAT's own "not marked · Mark on map" line in the cross-street group (#301 Q4). It
  stays, for a plan whose WHERE is already confirmed.

## 3. #316: the shape

### The wire

- **The relay (frontend → backend), like the mainline's:**
  - `guesses.approach_speed: {highwayClass}` is one record for the cross street. Both legs are the
    same street, and the form sets them with one control.
  - The backend validates it with the same `SpeedGuess` model.
- **`input_guesses` (`render_api.py:457`):**
  - When the record is present, the backend recomputes `speed_estimate_from_highway(highwayClass)`.
  - It caps the estimate to `IntersectionApproach.speed`'s own range (25–55, read from the schema
    like `_speed_bounds`).
  - It requires every approach's `speed` to equal the capped estimate. Otherwise it answers 400
    `guess_stale`: "… Set Cross-street speed in Step 2 …". The cross-street group is in Step 2's band.
  - The record it returns: `{"field": "approach_speed", "value": 25, "label": "25 mph", "source":
    "road_class", "evidence": "OSM highway=residential on the cross street; no readable posted speed",
    "operator_confirmed": false}`.
- **`ApproachParams.speed_guessed: bool`:** set from the record.
- **No record: unchanged byte for byte.** That covers every saved plan, every fixture, and every
  approach with a posted speed or an operator's speed.

### The deliverables (R127 Q7's surfaces, for the approaches)

| Surface | Today | Guessed |
|---|---|---|
| Audit, approach row (`audit.py:1577-1583`) | "… at 25 mph (urban_low)" | the same, plus "(guessed from the road class, not confirmed)" |
| Audit PDF, guessed inputs block (`audit_blocks.py:612`) | none | "Cross-street speed: 25 mph. Guessed from the road class (OSM highway=residential). The operator did not confirm it. Confirm the posted speed on site." |
| Audit PDF, approach line (`audit_blocks.py:539`) | "Approach 'cross_a': 25 mph, …" | "… 25 mph (guessed from the road class, not confirmed), …" |
| Crew sheet, approach lines (`base.md.j2:29-30, 86-87`) | "**cross_a approach** (25 mph, …)" | "(25 mph (guessed from the road class, not confirmed), …)" |
| Plan sheet NOTES | none | "CROSS-STREET SPEED GUESSED FROM THE ROAD CLASS. CONFIRM THE POSTED SPEED ON SITE." (Q6) |
| XLSX | does not print approach speed | unchanged |

### The frontend

- **The cross street's facts stay on the plan.**
  - `deriveCrossStreet` keeps the candidate's `highway_class` and a parsed `postedSpeedMph` (null
    when the tag is missing or unreadable). Today it drops the class (`cross-street.ts:229-268`).
  - They ride `meta.intersection` as `highwayClass` / `postedSpeedMph`. The backend ignores both:
    `IntersectionPin` takes pydantic's default "ignore" for extra keys, so the payload validates as
    today. The frontend needs them to say "measured" vs "from the road" after a reload.
- **The rule, in `lib/scenarios/guesses.ts`** (the mainline's functions, approach-keyed):
  - **`approachSpeedGuessFor`:**
    - A detected cross street with no posted speed and a class gives the class estimate, snapped to
      the kind's domain.
    - Residential → 25. A higher class can't land below the floor, because 25 is both the floor and
      the lowest estimate.
  - **`reconcileApproachSpeed`:** prefill on a new cross street; drop on the operator's change or a
    new crossing.
  - **`approachSpeedSet`:** measured, guessed or the operator's.
  - **`OperatorSetField`** gains `"approachSpeed"`, and the control's write marks it.
- **The control (`NearIntersectionForm.tsx:364-377`, Q3):**
  - The 25–55 range slider can't show "not set". It becomes the same select WHAT's Speed row uses,
    with a "Not set" option while unset.
  - Its line and marker:

    | State | Line | Marker |
    |---|---|---|
    | measured | "OSM · 30 mph · measured" | ✓ measured |
    | guessed | "guessed, not confirmed · OSM highway=residential · from the road" | ⚠ from the road |
    | not set | "not set · operator-set when picked" | ◌ not set |
    | the operator's | "your change · operator-set from here on" | ✓ yours |

  - Label: "Cross-street speed" (Q3, R126's "Speed").
- **The hold:**
  - Not set holds `checksArmed` / `fetchArmed` exactly as the mainline's does.
  - The rail adds "Set the cross-street speed in Step 2", ranked after the mainline's speed.
- **The header:** WHAT's "N guesses marked ⚠" counts the cross-street speed's ⚠ (Q4). The group
  renders inside the WHAT band, and R128 ruled the row's ⚠ and the header agree (P2).

### Measured candidates (from the code, verified at the build on a local stack)

- **N Broadway SB with E 17th Ave marked:** 17th carries `maxspeed`, so it stays "✓ measured",
  unchanged.
- **An untagged residential cross street** (the issue's acceptance) gives 25, "⚠ from the road".
- **A crossing marked where no cross street is detected:** "◌ not set". Today that plan silently
  plans 30.

The build report names the exact screenshot locations.

---

## 4. Questions

**Q1. #317: what the side control shows before the crossing is marked.** Recommend **(a)**.
- **(a)** Only the line and **Mark on map**, with no chips. The issue's acceptance says "once the
  crossing is marked, the sides appear as today", and the side can't be laid out before then anyway.
  One next step on screen (P3, P18).
- **(b)** The chips as well, so a side can be chosen first. Nothing gets laid out either way, but
  the band then offers two things to do, one of which can't finish.

**Q2. #317: the aerial's line.** Recommend the backend's message, the same one as the side control.
The pin stage's usual "Say which side is occupied…" would send the operator to a control that, under
(a), isn't offered yet.

**Q3. #316: the control and its label.** Recommend the **select** (with "Not set") in place of the
slider, labelled **"Cross-street speed"** (R126's rename). Alternative: keep the slider and put "not
set" only on the line. But a slider always shows a position, so it would show a value the plan
doesn't have (P16).

**Q4. #316: does WHAT's header count it?** Recommend **yes**, per R128's reason. The ⚠ renders
inside the WHAT band, so the header that counts the band's ⚠ markers counts it too.

**Q5. #316: one record per cross street, or one per approach?** Recommend **one per cross street**:
both legs are the same street and the form sets them together. A per-leg record would only matter if
the legs could differ, and they can't today.

**Q6. #316: the plan sheet's notes line.** R127 Q7 gave the mainline guess its NOTES line. Recommend
the cross-street line above, printed only when the approach speed is guessed. One risk to measure at
the build: the NOTES box's row ceiling. The flagger box is already at tier 2's 12-row ceiling, and
the near-intersection box's count will be measured on the build's own plan sheet. If it would
overflow, I stop and report rather than drop a row.

---

## 5. Rule 5: predicted churn

**#317, deliberate changes:**
1. **Geometry read:** a work-start near-intersection with no crossing answers 200
   `intersection_not_marked` with the line, instead of 422.
2. **Aerial read:** that scenario answers `pin` 200 PNG and `work`/`laid_out` 409
   `intersection_not_marked`, instead of 422.
3. **The band:** the side control shows the line and Mark on map, and the aerial shows the pin with
   the same line. Before, it showed "the road's sides are unavailable" and "The aerial didn't load."

**#316, deliberate changes:**
1. An untagged cross street's approaches get the class estimate as a marked guess, instead of a
   silent 30.
2. No cross street detected means "not set": Generate waits.
3. The control becomes a select labelled "Cross-street speed".
4. The guess is stated in the audit, the audit PDF, the crew sheet and the plan sheet NOTES.

**Not changing, proved at the build:**
- Every deliverable's answer to a scenario with no crossing: today's 422, byte for byte.
- Every geometry and aerial response for any other scenario: byte-identical.
- Every plan with no `approach_speed` record (every fixture, every tagged cross street): its audit,
  PDF, XLSX, crew sheet and quote, byte-identical. A tagged cross street's approach speed isn't
  touched.

| Area | Files | Rough count |
|---|---|---|
| #317 backend | new `tests/test_no_crossing_marked.py` (geometry 200 + shape; map pin/work; deliverables still 422 by the same bytes; other kinds unchanged; context only on the reads) | ~10 new; `test_work_start_near_intersection.py` unchanged |
| #317 frontend | `WhereBand` (new cases for the line + button + the click → `openPicker(true)`), `BandAerial` (the pin note for this status), `corridor-aerial.test` (the stage) | ~6 new; existing cases unchanged (no test pins "sides are unavailable") |
| #316 backend | new `tests/test_approach_speed_guess.py` (the record, `guess_stale`, the cap, the audit row, the audit PDF block, the crew line, the NOTES line, no-record byte-identity) | ~14 new; approach fixtures carry no record, so unchanged |
| #316 frontend | `cross-street.test.ts` :239-246 (pins `speed` 30 on a missing tag → rewritten to the guess); `GeneratorShell.near-intersection` (its cross street has `speedMph: 30`, so it's measured and unchanged; any case that marks a crossing with no detection now waits on the speed); `NearIntersectionForm`-driving tests via `#ni-cross-speed` (none found); `confirmed-road`, `intersection-rehydrate`, `kind-confirm`, `kind-switch` (cross-street fixtures, checked case by case) | ~5–15 updated; ~15 new (guesses, the control's four states, the hold, the rail rank, the header count) |

**Lane:** backend + frontend, `frontend-only: no`. Screenshots at 1440 and 390 on a local stack:
- the #317 repro (Broadway, near-intersection, no crossing);
- a crossing on an untagged residential street (the guess);
- a crossing with no cross street detected (not set);
- Broadway with E 17th Ave (measured, unchanged).

**Order:** one branch per issue, #317 first (smaller, no wire field), stacked: `issue-317-no-crossing`,
then `issue-316-approach-speed` on its tip. Both stack on `r128-footer-polish`.

## 6. Principles, for the changed surfaces

The surfaces are the WHERE band's side control and aerial (#317), the cross-street group in WHAT,
the rail, and the deliverables (#316). These are FLOW steps 1 and 2, for the rep and the estimator.

| P | #317 | #316 |
|---|---|---|
| P1 | honoured: the line renders in the same response as today's note, in its slot | honoured: the select keeps the slider's row |
| P2 | honoured: one voice, the backend's `message`, shared by the control and the aerial (Q2) | honoured: the header counts the row's ⚠ (Q4) |
| P3 | **fixes a deviation**: the next step (Mark on map) is on screen | honoured: "not set" names the rail row and the row |
| P8 | **fixes a deviation**: "unavailable" and "didn't load" were false failures | n/a |
| P9 | honoured: ⚠ and a word | honoured: the four markers above |
| P14 | honoured: no corridor drawn without the crossing (the probe's second case) | honoured |
| P16 | honoured | **fixes a deviation**: no default shown as fact (the slider's 30) |
| P18 | honoured: one question, mark the crossing (Q1 a) | honoured |
| others | honoured / n/a, as #315 | honoured / n/a, as R126 |

## 7. What I need from you

Q1–Q6. With (a) / the backend's line / the select and "Cross-street speed" / yes / one per cross
street / the NOTES line, I build `issue-317-no-crossing` first, then `issue-316-approach-speed` on
its tip. For each: Rule 5 prediction, code, verifier, screenshots, then a report with the ship line.
