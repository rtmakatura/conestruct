# Rule 5 prediction: `issue-316-approach-speed` (#316, R129 Q3–Q6)

Written 2026-10-12, before any code, off main `00e0984` (#317 shipped). Lane: backend + frontend,
`frontend-only: no`. Authority: `rulings.md` (R129), `checkpoint.md` §3.

## Deliberate changes

### The wire

1. **`guesses.approach_speed: {highwayClass}`:** one record per cross street (Q5). It reuses
   `SpeedGuess`.
2. **`input_guesses`:**
   - When the record is present, the backend recomputes `speed_estimate_from_highway(highwayClass)`
     and caps it to `IntersectionApproach.speed`'s range (25–55).
   - It requires every approach's speed to equal the capped estimate. Otherwise it answers 400
     `guess_stale`: "Cross-street speed is marked as guessed, but … Set cross-street speed in Step 2
     …".
   - The record it returns: `{"field": "approach_speed", "value", "label": "N mph", "source":
     "road_class", "evidence": "OSM highway=X on the cross street; no readable posted speed", …}`.
3. **The cross street's facts** ride `meta.intersection` as `highwayClass` / `postedSpeedMph`. They
   are frontend provenance, and the backend ignores them (`IntersectionPin`, pydantic's default
   "ignore").

### The deliverables (Q6 and R127 Q7's surfaces)

4. **`ApproachParams.speed_guessed`** and **`ScenarioParams.approach_speed_guessed`**, from the record.
5. **The guessed approach's speed reads "N mph (guessed from the road class, not confirmed)"** in:
   - the audit approach row's `key_text`;
   - the audit PDF approach line;
   - the crew sheet's two approach lines.
6. **The audit PDF's guessed-inputs block** gains "Cross-street speed: N mph. Guessed from the road
   class (OSM highway=X …). The operator did not confirm it. Confirm the posted speed on site."
7. **The plan sheet NOTES** gains "CROSS-STREET SPEED GUESSED FROM THE ROAD CLASS. CONFIRM THE POSTED
   SPEED ON SITE." only when guessed (Q6). **If the box would overflow, I stop and report (R129
   Q6).** It is measured on a near-intersection sheet with both speed lines.

### The frontend

8. **`deriveCrossStreet` keeps `highwayClass`.** Picker Save writes it and the posted speed onto
   `meta.intersection`. For a restored crossing, it carries over the facts already saved.
9. **`guesses.ts`:**
   - `approachSpeedGuessFor`: a detected cross street with no posted speed and a class with an
     estimate gives that estimate, snapped to 25–55. Residential → 25.
   - `reconcileApproachSpeed`: prefill on a new crossing; drop on the operator's write or a crossing
     change.
   - `approachSpeedSet`: measured, guessed or the operator's. True when no crossing is marked: #317's
     blocker speaks first.
   - `approachSpeedLine`: the row's line, one producer for the form and the header.
   - `OperatorSetField` gains `"approachSpeed"`. A fresh crossing clears it, because its detection
     replaces the approaches as today.
10. **The control (Q3):**
    - The slider becomes a select labelled "Cross-street speed", with "Not set" while unset.
    - Its line is one of:
      - "OSM · N mph · measured";
      - "⚠ guessed, not confirmed · OSM highway=X · from the road";
      - "not set · operator-set when picked";
      - "your change · operator-set from here on".
11. **The header (Q4):** WHAT's ⚠ count includes the cross-street speed's ⚠.
12. **Not set:**
    - The checks hold (`checksArmed` / `fetchArmed`).
    - The rail adds "Set the cross-street speed in Step 2", ranked right after the mainline speed.

## Not changing

- **No record means byte-identical output.** That covers every fixture and every tagged cross street:
  audit, PDF, XLSX, crew sheet and quote.
- **The mainline speed guess** is untouched.

## A consequence, stated

**A plan saved before #316 with a crossing marked** has no cross-street facts on `meta.intersection`.
On reload its cross-street speed reads "◌ not set" and Generate waits for the operator to pick one,
once. This is the honest reading: the plan can't tell a posted speed from the old silent 30. I'll
raise it in the report.

## Predicted churn

| Area | Files | Rough count |
|---|---|---|
| Backend existing | approach fixtures carry no record | 0 |
| Backend new | `tests/test_approach_speed_guess.py` | ~14 |
| Frontend existing | `cross-street.test.ts` (the `?? 30` pin, :239-246); `GeneratorShell.near-intersection` / `intersection-rehydrate` / `kind-switch` / `kind-confirm` / `confirmed-road` (crossing fixtures without the new facts now read "not set" and hold) | ~5–20 |
| Frontend new | guesses (approach), the control's four states, the hold, the rail rank, the header count | ~15 |

**Screenshots** (R129): N Broadway SB at E 11th Ave, near-intersection, at 1440 and 390.
- **An untagged residential cross street:** the guess. I'll find one by measurement near the pin.
- **A tagged one:** measured.

## Outcome (after the build: `84b4418` backend, `c812af6` frontend, `f942ae4` amber)

| Predicted | Actual |
|---|---|
| NOTES: stop and report if the box overflows | **Stopped** (`2239658`). With both lines, two SIGN SCHEDULE rows left the sheet for "+2 MORE SIGNS". Under R132, one line is printed whichever speeds are guessed, and all 4 rows stay. Crops: `notes-box/` (before R132) and `notes-box-r132/` (neither, road, cross street, both) |
| Backend existing: 0 | **0.** 2721 → 2738 passed: the 17 new tests and nothing else |
| Backend new: ~14 | 17 (`tests/test_approach_speed_guess.py`). They include R132's test: one NOTES line and all 4 schedule rows for each of the four combinations |
| Frontend existing: ~5–20 | **9 failures in 3 files.** <ul><li>The near-intersection shell test's picker stub: it now saves what the modal saves.</li><li>Its manual-entry case: it now picks a cross-street speed before Generate. This is the not-set case.</li><li>The picker-restore test: fixed in the code, not the test. A restored crossing now goes back exactly as saved.</li><li>3 rail cases.</li></ul> |
| The rail rank right after the mainline speed | **Moved.** It is now right after the cross street's own two ranks (its approaches check, then the lane-count hold). The first placement put it ahead of those, which broke 3 rail tests whose fixtures mark a crossing without the new facts. The new place keeps the existing chain order, and both new blockers sit in the cross-street group |
| Frontend new: ~15 | 13 (`approach-speed.test.ts` 8, `NearIntersectionForm.approach-speed.test.tsx` 5). Final: 203 files, 2120 passed |
| **Not predicted** | The guess line rendered **grey**: the amber rule was scoped to WHAT's own cells. Fixed in `f942ae4` with `.ni-prov`, and a test pins it. `production-env.txt:26` also moved again, to `LocationPickerModal.tsx:314` |

**Evidence:** `approach-speed-f942ae4/`, on a local stack of `f942ae4`, at 1440 and 390, with the
crossing marked from WHERE's Mark on map. The facts are per case and width.

| Case | Cross street (OSM) | Cross-street speed | Mainline speed | Header |
|---|---|---|---|---|
| N Broadway SB at **E 11th Ave** | tertiary, no maxspeed | **35**, "⚠ guessed, not confirmed · OSM highway=tertiary · from the road" | 30 ✓ measured | 5 guesses |
| N Broadway SB at **W 11th Ave** | tertiary, maxspeed 25 mph | **25**, "OSM · 25 mph · measured" | 30 ✓ measured | 4 guesses |
| **N Cherry St at E Ellsworth Ave** (residential meets residential, both untagged) | residential, no maxspeed | **25**, "⚠ guessed, not confirmed · OSM highway=residential · from the road" | 25 ⚠ from the road | 5 guesses |

- **E 11th Ave is `tertiary`, not residential.** So Broadway's untagged cross street guesses 35.
  The residential guess (25) is the Cherry case.
- **Every case** has no horizontal scroll, no page errors and no token hits. The CTA reason is the
  lane-count hold, which ranks before the speed.
- **A capture that clicked Save before the cross-street lookup answered** saved the crossing with no
  detection. It showed "Not set" and "Set the cross-street speed in Step 2", which is correct for that
  state. That first run was replaced; the capture now waits for the lookup.
