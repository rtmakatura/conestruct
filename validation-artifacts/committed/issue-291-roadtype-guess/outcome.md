# Rule 5 outcome: `issue-291-roadtype-guess` (#291, R148)

Prediction: `prediction.md` (committed `77de2fa`, with the prod check `before-prod-6c25fed/`).

## Built as predicted

### Frontend

- `ScenarioGuesses.road_type = {highwayClass, urban, divided}`.
- **`lib/scenarios/guesses.ts`:**
  - `roadTypeGuessFor` returns the facts and value when detection **inferred** the type, and null when it
    measured it (motorway → freeway) or there's no road at the pin.
  - `reconcileRoadType` runs last in `withCurrentGuesses`. It keeps the record only while the plan's road type
    holds the inferred value and the operator hasn't set it, and it never writes `roadType`.

### Backend

- **`src/api/schemas.py`:** `RoadTypeGuess`, `Guesses.road_type`, and `road_type_from_facts` (urban → urban
  street; rural → rural divided or undivided by the divided verdict).
- **`input_guesses`:**
  - a field that doesn't hold the guess is a 400 `guess_stale`;
  - otherwise it records:

    > `{field: "road_type", value, label: "Urban street", source: "road_places", evidence: "OSM highway=<class>; <urban|rural>, inferred from nearby places", operator_confirmed: false}`
- **The audit PDF's "Guessed inputs" block:**
  - "Road type: Urban street. Guessed from the road and nearby places (…). The operator did not confirm it."
  - its own caveat, "Confirm on site whether the work is in an urban or rural setting."
  - The record has its own `source` so it doesn't take street class's caveat ("The jurisdiction's adopted
    classification map governs").

No threshold changed, and the urban/rural predicate is untouched. Lookout Mountain still comes out Urban
street; it is now recorded as a guess.

## Churn: predicted vs measured

| | predicted | measured |
|---|---|---|
| screen | none | none: the field and its "⚠ from the road" marker are byte-identical in text (`before-prod-6c25fed/` vs `after-local/`) |
| frontend tests | candidates `GeneratorShell.class-suggest`, `GeneratorShell.suggest-contract`, `guesses.test.ts` might move | **none moved**: 216 files, 2251 tests, all green with no edits. None asserts the wire's exact `guesses` after a road confirm with an inferred road type. |
| backend tests | `test_r108_guesses.py` unchanged | unchanged |
| audit / corpus snapshots | none move | none moved |
| deliverables | the audit PDF's guessed-inputs block gains a line on those plans | as predicted; plan PDF, XLSX and crew sheet untouched |

## Measured in the browser (`after-local/`, the branch's site and backend on localhost; Lookout Mountain Rd `39.7326, -105.2405`; 1440 and 360)

| | Road type field | request `guesses` | audit `input_guesses` |
|---|---|---|---|
| prod before (`6c25fed`) | "⚠ from the road", editable, Urban street, "⚠ OSM · Urban street · inferred" | `{street_class}` | street class only |
| branch | **same** | `{street_class, road_type: {highwayClass: "tertiary", urban: true, divided: false}}` | street class **and road type "Urban street", operator_confirmed false** |
| branch, after the operator picks Rural, undivided | "yours", "… · operator-set" | `{street_class}` (the record dropped) | street class only |

Screenshots: `before-prod-6c25fed/road-group-1440.png`, `after-local/road-group-1440.png` and
`after-local/road-group-360.png`.

## Tests

- **`tests/test_road_type_guess.py`** (5 tests):
  - the mapping;
  - Lookout Mountain's record, exact;
  - a stale road type gives 400 `guess_stale`;
  - no guess, no record;
  - the PDF line and its caveat.
- **`lib/scenarios/road-type-guess.test.ts`** (34 tests):
  - the record's six states;
  - a mirror over 7 classes × urban/rural × oneway, holding the backend mapping to `classify.ts` for every
    inferred road type (28 cases).
- **Suites:** pytest 2849 passed, 2 skipped; vitest 216 files, 2251 tests; `tsc` clean; `next build` clean.

## For #291

The field half of R148 was already true on prod, as the before evidence shows. This branch adds the audit
half. Close #291 after the ship, with the evidence.
