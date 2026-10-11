# Rule 5 prediction: `issue-301-road-properties` (R123 Q1 + Q2)

Written 2026-10-10, before the build commit, on `issue-301-road-properties` off main `e403173`.
Authority: `rulings.md` (R123 Q1, Q2). Lane: normal, `frontend-only: no` (Q2 adds an audit record).
The checkpoint's branch-2 prediction (`checkpoint.md` §4) is superseded where it differs: R123 Q2
keeps a "Use N mph" button and adds backend scope, so this file re-predicts the whole branch
(`handoff.md:114`: ruling-added scope gets its own churn row).

## Deliberate behaviour changes

1. **The picker modal loses its ROAD PROPERTIES panel (Q1).**
   - Gone: the four editable rows (speed, lanes per direction, road type, divided), their pips,
     "OSM · MEASURED / INFERRED / OPERATOR-SET", "modified", ↺ revert, and the UX-02 "Use N mph"
     accept.
   - Kept: "↻ Re-detect roads", now a slim row under the "Which road?" card.
   - Subtitle: "Drop a pin where the work starts, and review the detected road properties." →
     "Drop a pin where the work starts, and pick the road."
   - The detection card's "Set road properties manually below, or drag the pin closer to the
     roadway." → "Set road properties in Step 2, or drag the pin closer to the roadway."
2. **Save no longer carries picker overrides.**
   - `LocationPickerResult.overrides` and `ConfirmedRoad.overrides` go.
   - `GeneratorSidebar`'s picker-override apply (`lastAppliedOverridesRef`) goes.
   - Speed, lanes, road type and divided are edited on WHAT only.
   - The modal's `divided: true` on a one-way road (checkpoint §1) can no longer be produced.
   - **Kept:** the kind switch's own use of `applyOverridesToScenario` (it carries the operator's
     speed across kinds, `GeneratorSidebar.tsx:243-245`). `overrides.ts` and `handoff-summary.ts`'s
     logic stay.
3. **WHAT's Speed row offers the road-class estimate (Q2).**
   - When to show it: the road at the pin has no `maxspeed` tag at all (the old UX-02 condition)
     and its class has an estimate.
   - What shows, under the control: "⚠ no posted speed on this road · its class suggests N mph",
     with a **Use N mph** button.
   - Nothing is prefilled.
   - After the click:
     - the speed is N;
     - the row's line reads "your change · the road-class estimate (highway=…); the road has no
       posted speed" (marker "✓ yours");
     - the offer hides.
   - The handoff note "… Accept it in the picker to use it." → "… Press Use N mph on this row to
     use it."
4. **The wire gains `speed_estimate: {highwayClass}` (Q2).**
   - Present only while the speed is the estimate the operator took (`lib/scenarios/guesses.ts`
     reconciles it on every write, and the kind switch carries it with the speed).
   - The backend re-derives it (`src/rules/speed_estimate.py`, the class table moved from
     `classify.ts`, which keeps a commented mirror). A stale record is 400 `guess_stale`.
5. **The audit records it (Q2).**
   - The JSON gets `input_estimates: [{field: "speed", value, label, source: "road_class",
     evidence, operator_confirmed: true}]`.
   - The audit PDF gets an "Estimated inputs" block: "Speed limit: N mph. Estimated from the road
     class (OSM highway=…; the road carries no posted speed). Chosen by the operator. Confirm the
     posted speed on site."

## Not changing (proved at the build)

- Every scenario without `speed_estimate`: audit JSON, audit PDF, plan PDF, XLSX, crew sheet and
  quote are byte-identical. No new key, no new block; every backend baseline unmoved.
- Plan values: no speed is ever set without the click. Detection's applied fields are unchanged:
  `applyClassification` never read the panel.
- The modal's map, search, coordinates, candidates, cross-street pin and corridor panel.
- `input_guesses` (R108) is unchanged; an estimate taken by the operator is not a guess.

## Predicted test churn

**Backend:**
- New `tests/test_speed_estimate.py`: the table mirror, the audit record, the PDF line, the stale
  400 on five paths, no key without a record.
- No existing backend test changes.

**Frontend, deleted:**
- `LocationPickerModal.provenance.test.tsx`: all 7, it pins the panel.
- `lib/road-detection/provenance.test.ts`: 1 test ("the picker composes from the producer…"
  reads the modal's source for `sourceToken`). The picker no longer composes a provenance token.

**Frontend, rewritten or edited:**
- `LocationPickerModal.road-pick` (5): "Speed limit (mph)" row assertions go; the empty-state
  copy assertions follow the new sentence.
- `LocationPickerModal.state-contract` (7): road-property row and "Classifying road…" assertions
  go; "Re-detect roads" clicks find the moved button.
- `LocationPickerModal.scan-honesty` (2): the Re-detect clicks find the moved button.
- `GeneratorShell.picker-reapply` (2): the two #190 picker-override tests go; the
  `APPLY_PIN_A_SPEED40/45` stubs lose their overrides.
- `GeneratorShell.handoff-provenance` (1): "family 2: picker lanes/divided overrides …" goes.
- `lib/scenarios/operator-set.test` (1): "a picker override …" is kept for the S7 staged half and
  loses the picker half.
- `handoff-summary.test`: unchanged. `summarizeHandoff`'s overrides argument stays, since the
  kind switch uses it.
- `lib/design/type-exceptions.ts` census: the modal's font-size counts drop. The census entry is
  updated, so its test moves.

**Frontend, type-only edits (fixtures typed `ConfirmedRoad` lose `overrides`):** `class-suggest`,
`confirmed-road`, `state-contract`, `centerline-relay.test`, `guesses.test`. Untyped stubs
(`kind-confirm`, `kind-switch`, the three `GeneratorSidebar.*`) keep passing.

**Frontend, new:**
- WHAT Speed row (3):
  - no tag shows the offer with "Use N mph";
  - the click sets the speed and the record, and hides the offer;
  - a tagged road shows no offer.
- `guesses` reconcile (2): another speed write drops the record; a moved road drops it.
- Modal (1): no road-property editor renders, and Re-detect is still there.

**Copy changes:** the modal subtitle, the detection card's empty-state sentence, the
`skipped_low_confidence` handoff note, and the new Speed-row line and button.

## Outcome (the build, `d56c876` + the verifier's repairs)

| Prediction | Outcome |
|---|---|
| Behaviour changes 1-5 | As predicted. The Speed row's marker after the click is "✓ yours", now asserted in `WhatBand.speed-estimate.test.tsx`. |
| Byte-identical without `speed_estimate` | Held: no backend test or baseline changed. The backend suite went from 2688 to 2699 passed; the 11 new tests are all in `test_speed_estimate.py`. |
| `LocationPickerModal.provenance` deleted (7) | Deleted (7). |
| `provenance.test` source-read test deleted (1) | **Deviation:** rewritten, not deleted. It now asserts the picker mints no provenance token at all, keeping its "no second voice" guard. |
| `road-pick` (5) | 5 rewritten: the detection card replaces the panel as the "road classified" signal, and the copy follows. Plus 1 new (the modal case below). |
| `state-contract` (7) | 6 rewritten. The vacuous null check passed as it was. |
| `scan-honesty` (2) | **Deviation:** unchanged. The moved Re-detect button keeps its name. |
| `picker-reapply` (2 go) | 2 removed; 1 new #301 case added (a stray override key is ignored, and the detected 75 mph stands). |
| `handoff-provenance` (1 goes) | 1 removed. |
| `operator-set.test` (1) | **Deviation:** unchanged. Its S7 half never read the picker. |
| `handoff-summary.test` unchanged | Unchanged. |
| Type census moves | Moved: 4 rows, and `tsxUses` 268 → 252. |
| Type-only fixtures (5) | 5, as named. |
| New tests: WHAT row (3), reconcile (2), modal (1) | WHAT row 3; reconcile **8** (in a new `lib/scenarios/speed-estimate.test.ts`, covering the offer, the click, the snapped no-record case and the drop rules); modal 1. |
| Not predicted | The Re-detect row shows exactly where the panel's button did (a pin, and detection not in flight); the build first hid it at idle too, and the re-verify caught it (fixed). It gained `data-testid="picker-redetect"`. |

**Frontend:** 2064 → 2076 passed (197 → 198 files). `tsc` clean.
