# Branch 1 — `setup-what-r108` (R108 + R107)

Built to `../rulings.md` (R106–R110) and `../checkpoint.md`. Base: main `4ae98aa`.

## What shipped

### R108: guesses, never confirmed

**Backend (D1 / R110 Q1):**
- **Wire field.** `guesses` is optional and carries the raw fact behind each untouched guess:
  - `street_class: {highwayClass}`;
  - `jurisdiction_key: {lat, lng}`.

  Its home is `src/api/schemas.py` (`Guesses`, on `JurisdictionScenarioFields`).
- **The tag table** now lives in `src/rules/street_class.py`. The frontend's `STREET_CLASS_BY_HIGHWAY` is its commented mirror, held equal by `tests/test_street_class_mirror.py`.
- **The check.** `render_api.input_guesses` recomputes each guess at the one chokepoint every endpoint shares (`_ensure_scenario_enabled`):
  - the class comes from the tag;
  - the jurisdiction comes from `boundaries.suggest` at the relayed pin, which must also be the plan's own pin.
  - A claim that no longer holds is an honest 400 `guess_stale`.
- **The audit JSON** gets `input_guesses: [{field, value, label, source, evidence, operator_confirmed: false}]`. It is its own key, never a `pending_verification` item (Q2), and it appears only when a guess exists.
- **The audit PDF** gets a "Guessed inputs" block after the summary, one line per guess, each with its caveat.
- **The XLSX Summary and the crew sheet** print "Denver (guessed from the pin, not confirmed)" (Q3). One producer serves both, `validators.jurisdiction_display`.
- **The `boundaries.py` docstring** (Endeavor B's prime directive) is reworded to match R108.

**Frontend (`lib/scenarios/guesses.ts`, one module for the bookkeeping):**
- **Every scenario write goes through `withCurrentGuesses`** (`GeneratorShell`'s `setScenario`):
  - a moved pin drops its jurisdiction guess in the same write;
  - a newly confirmed road guesses the street class;
  - a write over a guessed field makes it the operator's.
- **The pin lookup's answer** lands through `applyJurisdictionGuess`. It fills an empty field only, and only for the pin it ran at.
- **The operator's writers** (`setStreetClassByOperator`, `setJurisdictionByOperator`) drop the guess's record (Q4). The WHAT select, the street-class control and S7's staged jurisdiction all use them.
- **Q4 for road type.** `meta.operatorSet` records the fields the operator wrote. `applyClassification` keeps an operator-set road type over a fresh detection, with the #85 divided pairing following it.
- **What R108 removed:**
  - the Confirm/Dismiss/Undo rows and the #227 records;
  - `JurisdictionControls` and the suggestion slots;
  - R100's record slot;
  - the "N to confirm" plumbing.
- **What stays:** the evidence (`JurisdictionEvidence`, `JurisdictionWarnings`, `StreetClassEvidence`) sits in each row's details, and the boundary warnings stay on show (P3).

### R107: the two-column Step 2

- **Layout.** "The road" sits left (Speed limit, Lanes, Road type, Street class, Carriageway / Divided highway). "The job" sits right (Work type, Hours, Speed reduction, Jurisdiction, Work dates).
- **Rows.** Each row is a label with its marker under it, beside a 44 px control. `FieldCell` holds the row; the CSS is `.a-cols` / `.a-col` in `app/globals.css`.
- **Segmented controls** are `Segmented` in `bands/FieldCell.tsx`: one track per option, split evenly.
- **Labels:** "Street class", "Carriageway" (One-way / Divided), "Hours", "Speed reduction" (None / Reduced, Q8).
- **Lanes row (Q7).** It holds two controls with two markers: the count's ("✓ measured") and the width's own source ("✓ default" until the operator picks one, then "✓ yours").
- **Hours and Speed reduction (Q8)** read "✓ default" until changed, then "✓ yours".
- **The header (R108, Q5)** reads "N guesses marked ⚠ · change any that are wrong", counted from the ⚠ markers on show. With nothing guessed it reads "prefilled from the road".

## Screenshots (local build of this branch, prod backend, E Colfax)

- `what-1440.png`: two columns.
- `what-390.png`: one column, each label above its control.
- `what-1440-details.png`: the jurisdiction row's details open, showing the guess line, the evaluation sentence, the pin's evidence and the TIGER caveat.
- `what-<w>-facts.json`: what the page said at each width.
  - header: "3 guesses marked ⚠ · change any that are wrong" (road type, street class, jurisdiction);
  - street class "⚠ from the road" and jurisdiction "⚠ from the pin" (value `denver`);
  - every control 44 px (11 of 11);
  - 0 Confirm/Dismiss/Undo buttons.
- `capture_what.cjs`: the capture.

## Rule 5: outcomes against checkpoint §4

`../probes/r108_churn.py` (output in `r108_churn.out.txt`) renders one E Colfax shoulder plan three ways: (A) nothing set, (B) Denver + Arterial set by the operator, (C) the same two as R108 guesses.

| Prediction | Outcome |
|---|---|
| 1. A guessed jurisdiction turns its evaluation on | **Yes.** A→C: the jurisdiction block appears, hours evaluate (`unknown`, no dates set), and the XLSX and crew line name Denver. **On this plan Denver applies 0 deltas, and the device count is unchanged (31).** The prediction said counts *can* move; on this road they don't. |
| 2. Street class resolves class-scoped triggers | Rides in with the jurisdiction (B = C on every evaluated field). Denver's record returns no permit tier (null in B and C alike). |
| 3. New text: `input_guesses`, audit PDF lines, the Q3 clause | **Exactly these and nothing else.** B→C differs only in `input_guesses`, the "Guessed inputs" block, and the XLSX and crew clause. `pending_verification` and `plan_flags` are equal (Q2). |
| 4. The state-highway caveat survives | Yes: the TIGER caveat is in the jurisdiction row's details and on the audit PDF line. |
| No `guesses`, byte-identical | `test_an_explicit_null_guesses_is_the_same_as_none`, `test_no_guesses_means_no_input_guesses_key`. The full suite passes with every expectation pin and snapshot unchanged (2588 passed, 2 skipped). |
| 0 device moves | Street class and jurisdiction feed counts and text only; no geometry test moved. |

Tests churned as predicted (§4 table). Two suites are retired: `GeneratorShell.suggestion-records` (the records are gone) and `JurisdictionSection.placement` (#201's strips are gone). The rest are re-pointed or rewritten to the inverse contract. The #198 strings deleted are the four the checkpoint named.

## Deviations and decisions to flag

1. **D3, after Generate.** A pin move after Generate is a WHERE-band write that re-generates, as before; it is not an S7 field. The jurisdiction guess for the new pin lands about 0.4 s later as a second write, so the dimmed results refetch twice, under the ribbon. No silent change, but it is one more request than D3 implied.
2. **Q4's reach.** Q4 is applied to street class, jurisdiction and road type, the three fields D3 named. A fresh detection still re-applies speed and lanes as before.
3. **Saved plans open as saved (P1).** The lookup for a saved plan's own pin is evidence only, and an edit that doesn't touch the road never fills in its street class. A pin placed or moved in the session is guessed from.
4. **`meta.operatorSet` rides the wire.** Like `confirmedRoad`, it is frontend bookkeeping; Pydantic ignores unknown `meta` keys.
5. **The #308 refusal is reworded** to name R107's row: "Under Carriageway in Step 2, choose “One-way” or “Divided”". Otherwise it would have pointed at button labels that no longer exist (Rule 10).
6. **"⚠ inferred" now reads "⚠ from the road"** for every inferred road value, as the mockup marks road type.
7. **Lanes options** read "2 per side", as the mockup shows.
8. **Contrast.** The TIGER caveat has been drawn in the popover (on `--raise`) since R96 A, but its test measured it on `--canvas-tint`. It is now measured where it sits: 4.76:1, above the 4.5:1 floor.
9. **Dead CSS left in place:** `.classpick`, `.jctl*` and the old `.jbar-suggest` strip rules. Nothing renders them now, but `.classpick` is pinned in the type census's exception list, so they come out in a follow-up rather than in this diff.
