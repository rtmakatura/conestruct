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
