# Rule 5 prediction: `issue-291-roadtype-guess` (#291, R148)

Committed before any code. Branched from main `6c25fed`.

## Ruling (R148)

> option (c). Urban/rural is a guess and is shown as one: "⚠ from the road", same as R108's road type and
> street class, and the audit records it as guessed, not confirmed. First check whether the urban/rural call
> already reaches the operator through the road-type field with that marker. If it does, it's already covered
> [...] If it doesn't, add the marker. No new threshold, no change to which pins come out urban. Rule 5:
> predict churn before the diff.

## The check, measured on prod `6c25fed` (Lookout Mountain Rd, `39.7326, -105.2405`; `before-prod-6c25fed/`)

| half of R148 | covered today? | evidence |
|---|---|---|
| shown as a guess, "⚠ from the road", editable | **yes** | the WHAT band's Road type row reads "⚠ from the road"; the select (`#what-road-type`, enabled) offers Rural undivided / Rural divided / Urban street / Freeway; the provenance reads "⚠ OSM · Urban street · inferred" |
| the audit records it as guessed, not confirmed | **no** | the request carries `guesses: {street_class: {highwayClass: "tertiary"}}` only; the audit's `input_guesses` lists only `street_class ... operator_confirmed: false`. Road type is recorded as if confirmed. |

So the field half is covered and the audit half is not. This branch adds the audit half on R108's own pattern
(R110 Q1: the wire carries the raw fact of each untouched guess; the backend re-derives it and refuses a stale
one).

## What gets built (R145 inside R148)

1. **The wire.** `ScenarioGuesses.road_type = {highwayClass, urban, divided}`: the raw facts the detected road
   type came from (the class, the urban/rural verdict, the divided verdict).
   - It is recorded by `withCurrentGuesses` iff the road type is **inferred** (not `motorway → freeway`,
     which is measured), the road is confirmed at the pin, the plan's `roadType` still equals the detected
     value, and the operator has not set it.
   - Otherwise it drops: an operator change, a new road, or a moved pin. That's R108's invariant.
   - Nothing writes `roadType` itself, which stays detection's.
2. **The backend.**
   - `Guesses.road_type`, with the mapping re-derived from the raw facts: urban → Urban street; rural and
     divided → Rural, divided; rural → Rural, undivided. A field that doesn't hold it is a 400 `guess_stale`.
   - `input_guesses` adds `{field: "road_type", value, label, source: "road", evidence: "OSM highway=<class>
     · <urban|rural> from nearby places", operator_confirmed: false}`.
   - The audit PDF's "Guessed inputs" block gains the line, through its existing renderer (`_GUESS_FIELD`
     gets "Road type").
3. **No threshold, no classification change.** The urban/rural predicate is untouched. Lookout Mountain still
   comes out Urban street; it is now recorded as a guess.

## Churn predicted before the diff

- **Screen: none.** The field's marker and the WHAT band's "N guesses marked ⚠" already count road type
  (they read the detection's `inferred` markers). `guessCount` is not rendered anywhere.
- **Wire:** a plan whose road type is inferred gains `guesses.road_type`. Expected test churn:
  - frontend tests that assert the wire's exact `guesses` after a road confirm with an inferred road type
    (candidates: `GeneratorShell.class-suggest`, `GeneratorShell.suggest-contract`, `guesses.test.ts`);
    each is named in the outcome;
  - `tests/test_r108_guesses.py` is unchanged (its scenarios carry no `road_type`), plus new tests.
- **Audit:** `input_guesses` gains a road-type record only where the request carries the guess. No
  audit/corpus snapshot carries one, so **none move**.
- **Deliverables:** the audit PDF's "Guessed inputs" block gains a line on those plans. The plan PDF, XLSX
  and crew sheet are unchanged.

## Predicted

- Lookout Mountain on the branch:
  - the same Road type row ("⚠ from the road", editable, Urban street);
  - the request carries `guesses.road_type: {highwayClass: "tertiary", urban: true, divided: false}`;
  - the audit's `input_guesses` lists road type, "Urban street", guessed, not confirmed.
- Changing Road type in the select drops the record: the next audit lists street class only.
- Screenshots at 1440 and 360.
