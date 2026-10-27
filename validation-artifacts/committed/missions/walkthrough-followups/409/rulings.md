# #409 rulings and plan (mission walkthrough-followups, #423)

Base: `issue-398-wait-cues` at `4301b86`. Branch `issue-409-default-length-audit`. Every `file:line` cite points at the base `4301b86`.

## Baseline (before the diff)

- `uv run --extra dev pytest -q`: 3593 passed, 2 skipped.
- `npx vitest run --reporter=dot` (conestruct/site): not run before the diff; the first full run on the branch had 1 failure, recorded in `full-run-fails.txt` (cause confirmed: this change).

## Plan

1. **Problem (confirmed).** The untouched starting length is marked "default" on the frontend only. `workLenIsDefault` (`conestruct/site/lib/scenarios/index.ts:401-403`) reads `meta.operatorSet`, which `types.ts:415-416` calls "Frontend bookkeeping like `confirmedRoad`: it rides the saved plan and the backend ignores it." Nothing on the wire says the length was never entered, so `input_guesses` (`src/api/render_api.py:544-708`) has nothing to record and the audit prints 1,000 ft like any entered length.
2. **Rulings.** Rule 3 (the backend owns what the audit records), Rule 10, Rule 12 (the 1,000 ft is CHOSEN), R108 / R110 Q1-Q2 (the relay-fact pattern for guesses; a guess is its own audit key, never a pending item), #397 R145-1 (option (b): the 1,000 ft stays and is marked "default"; recording it in the audit filed as this issue). No Ryan ruling is reversed; Generate is not gated (the issue's alternative is not built, see R145-409-1).
3. **Change.** (a) Wire: `guesses.work_length = { startFt }` (new `WorkLengthDefault` in `src/api/schemas.py`, mirrored in `ScenarioGuesses`). (b) Frontend: the render proxy relays it at the wire boundary, the way #140 relays the centerline, whenever `workLenIsDefault(scenario)` holds; scenario state is untouched. (c) Backend: `input_guesses` checks `startFt` against its own `WORK_LEN_START_FT` (1,000 ft, CHOSEN, mirrored from `DEFAULT_SHOULDER.workLen`) and the plan's `workLen`; a match is recorded `operator_confirmed: False`, a mismatch is an honest 400 `guess_stale`. (d) The audit PDF line reads "Work zone length: 1,000 ft. Defaulted to the tool's starting length (nobody entered a length for this plan). The operator did not confirm it. Confirm the work zone length on site."
4. **Rule 5 churn prediction** (below).
5. **Proof.** Backend: TestClient `/render/audit` payload tests (record present, absent with no relay, 400 on a stale claim or a wrong start) and the audit-PDF line; frontend: proxy payload tests (the relay rides the outgoing body for a defaulted length and not for an entered one). Red on base via `git archive`.

## Rule 5 churn prediction (written before the diff)

| File | Predicted |
|---|---|
| `src/api/schemas.py` | ~+20 / 0 |
| `src/api/render_api.py` | ~+35 / 0 |
| `src/rendering/audit_blocks.py` | ~+20 / -4 |
| `conestruct/site/lib/scenarios/types.ts` | ~+5 / 0 |
| `conestruct/site/lib/scenarios/index.ts` | ~+18 / 0 |
| `conestruct/site/lib/render-proxy.ts` | ~+12 / -8 |
| `tests/test_work_length_default.py` (new) | ~+120 |
| `conestruct/site/lib/render-proxy.work-length.test.ts` (new) | ~+70 |

Stated behaviour change: a plan rendered with the starting 1,000 ft that the operator never entered gains an `input_guesses` record (`field: "work_length"`) in the audit JSON and a line under the audit PDF's inputs heading. A plan whose length the operator entered, and every payload with no `guesses.work_length`, is byte-identical.

## Calls

- **R145-409-1 (relay, not gate).** The issue offers two fixes. Gating Generate until a length is committed would change the flow #397 R145-1 kept working on the 1,000 ft (the WHERE reads validate `workLen` with `Field(gt=0.0)`), and Generate blocking is a product behaviour nobody ruled on. The relay records the fact without blocking anything. R145 self-ruled.
- **R145-409-2 (relayed at the proxy, not kept in scenario state).** `withRelayedCenterline` (`lib/scenarios/centerline-relay.ts:1-12`) already derives a wire field at serialization time so no state has to track it. The same applies here: `workLenIsDefault` is already the one predicate the ledger and the field read, so the wire reads it too, and no stored entry can go stale. R145 self-ruled.
- **R145-409-3 (the backend owns the start).** Rule 3: `WORK_LEN_START_FT` lives in `src/api/schemas.py`, CHOSEN (Rule 12: no source; picked to clear the buffer/2 soft rule at 65 mph, per the comment on `DEFAULT_SHOULDER.workLen`). The frontend's `DEFAULT_SHOULDER.workLen` is commented as its mirror. The relayed `startFt` is checked against it, so a frontend whose start drifted gets an honest 400, never a record of a value the backend didn't recognise. R145 self-ruled.
- **R145-409-4 (one key, its own words).** The record joins `input_guesses` (one audit key, one block), on R110 Q2: never a `pending_verification` item, so the strip stays as clean as for an entered length. Its line says "Defaulted to", not "Guessed from", per the issue's "defaulted, not confirmed". The block heading reads "Guessed inputs" when every record is a guess (unchanged), "Defaulted inputs" when every record is a default, and "Guessed and defaulted inputs" when both are present. R145 self-ruled.

## Actual churn vs prediction (Rule 5)

| File | Predicted | Actual (+/-) |
|---|---|---|
| `src/api/schemas.py` | ~+20 / 0 | +18 / 0 |
| `src/api/render_api.py` | ~+35 / 0 | +39 / 0 (the refusal got its own helper: `_guess_refusal`'s "Set ... in Step 2" sentence names the wrong step for a length) |
| `src/rendering/audit_blocks.py` | ~+20 / -4 | +42 / -8 (over: the guess line moved into `_guess_line` beside the new `_default_line`, and the heading helper) |
| `conestruct/site/lib/scenarios/types.ts` | ~+5 / 0 | +4 / 0 |
| `conestruct/site/lib/scenarios/index.ts` | ~+18 / 0 | +20 / -1 |
| `conestruct/site/lib/render-proxy.ts` | ~+12 / -8 | +16 / -9 (8 call sites and the import) |
| `tests/test_work_length_default.py` (new) | ~+120 | +159 |
| `conestruct/site/lib/render-proxy.work-length.test.ts` (new) | ~+70 | +115 |
| `conestruct/site/lib/render-proxy.corridor-map.test.ts` | not predicted | +5 / -1 |

Unpredicted: `render-proxy.corridor-map.test.ts` asserted the exact body sent for `DEFAULT_SHOULDER`, whose untouched 1,000 ft now carries the record. Its expectation now includes it; that is the stated behaviour change, not a regression.

## Tests

- pytest: 3603 passed, 2 skipped (baseline 3593 + the 10 new); mypy: no issues in 49 source files; ruff check: all passed; ruff format applied to the new test file.
- vitest: 246 files passed, 1 skipped; 2618 tests passed, 1 skipped. tsc clean.
- Red proof: `red-proof.txt` (7 backend and 4 frontend tests red on 4301b86; the rest are guards).
- `audit-sample.txt`: the audit JSON record, the proof that every other audit key is identical, and the audit PDF block.

## Open edges (noted, not built)

- Mobile-operation wording, not reachable today. `workLenIsDefault` compares with the shoulder's 1,000 ft on every kind (`index.ts:401-403`), because a kind switch carries the length, and a mobile-operation plan's `workLen` is the trailing distance to the shadow vehicle (the mobile kinds' `workLen` comment in `src/api/schemas.py`). An untouched mobile plan can't be recorded today: `mobile_op_2lane` and `mobile_op_multilane` aren't in `ENABLED_SCENARIOS` (`src/api/render_api.py:152-154`, `{"shoulder", "flagger_lane_closure", "near_intersection"}`), so `_ensure_scenario_enabled` refuses them with a 400. It becomes reachable only if a mobile kind is enabled (Rule 8); the wording "Work zone length" would need a look then.
- Pre-#397 saved plans. "nobody entered a length for this plan" is inferred from `meta.operatorSet`. A plan saved before #397 whose operator typed 1,000 ft has no `workLen` record, so it would be listed as defaulted. This is the same R110 Q8 assumption #397's "default" marker makes on the form.
