# Rule 5 outcome: `issue-297-acknowledge` (#297 step 3 of 3)

Prediction: `prediction-c-acknowledge.md` (committed `54d46a7`). Stacked on `issue-284-proposed-kind`
(`a62e6e0`), which stacks on `issue-297-stable-keys` (`abc7d7d`).

## Built as predicted

### Frontend

- **`lib/scenarios/types.ts`:**
  - `StagedAcknowledgement {acknowledge, set}` joins the `StagedCorrection` union;
  - `ScenarioMeta.acknowledged?: string[]`.
- **`lib/scenarios/site-corrections.ts`:**
  - new guards and helpers: `isAckStaged`, `isFlagStaged`, the `FlagStaged` type, and `withAcknowledged` (the
    key drops when empty);
  - `stagedKey` returns `ack:<id>`, and `unstage` accepts it;
  - `applyStaged` folds acknowledgements into `meta.acknowledged`;
  - `stagedEnumeration` names "N acknowledgement(s)".
- **Readers that treat a non-field entry as a site-condition flag** now use `isFlagStaged`:
  `lib/needs-you-conditions.ts` and `components/NeedsYouConditions.tsx` (`stagedFor`, `stagedRow`;
  `intentText` gains the acknowledgement words). `tsc` found every one.
- **`lib/needs-you.ts`:**
  - action kinds `acknowledge` / `withdraw` / `undo`;
  - `NeedsYouItem.ack`;
  - `itemProvenance` appends "acknowledgement staged" / "acknowledged" / "withdrawal staged".
- **`lib/needs-you-items.ts`:** `AckState` and `withAck`. A delta row gets the control only when the delta
  carries the backend's stable key.
- **`components/NeedsYou.tsx`:** the row button calls `onAction(id, kind)` and is disabled under the write
  lock. An `applyRow` renders only when the condition rows are absent.
- **`components/GeneratorShell.tsx`:**
  - passes `acks` (the plan's `meta.acknowledged` and the staged intents);
  - stages on a press (`onNeedsYouAction`);
  - hands NEEDS YOU an Apply row with the same sentence and the same `applyStagedAll` write.

### Backend

- **`ScenarioMeta.acknowledged`:** at most 50 ids of at most 120 characters each.
- **`_audit_build`:** resolves each id against `_jurisdiction_eval` and adds
  `acknowledged: [{id, rule, source, applies}]`, only when non-empty.
- **The audit PDF:** an "Acknowledged by the operator" block.

## Measured

- **pytest `tests/test_acknowledged.py`** (6 tests):
  - the audit lists the acknowledged rule in its own words and source;
  - a stale id is listed with `applies: false`;
  - no key when nothing is acknowledged;
  - the device breakdown and the audit (minus the new key) are identical with and without
    `meta.acknowledged`;
  - the field's bounds return 422;
  - the PDF block.
- **vitest `lib/acknowledge.test.ts`** (12 tests):
  - which rows offer it: keyed deltas only, no other row, and nothing without `acks`;
  - each state's control and words;
  - Apply writes only `meta.acknowledged`, and withdrawing drops the key;
  - one entry per item;
  - the staged sentence;
  - the flag guard.
- **vitest `components/NeedsYou.acknowledge.test.tsx`** (4 tests): the press hands up the id and kind; the
  provenance; the lock; the Apply row only without condition rows.
- **The existing ruling-d tests** (`needs-you-items.test.ts`, `NeedsYou.test.tsx`) pass unchanged. They build
  items without `acks`, which keeps the pre-#297 rendering, so no amendment was needed. The prediction expected
  to amend them.
- **Suites:**
  - pytest: 2837 passed, 2 skipped.
  - vitest: 215 files, 2216 tests.
  - `tsc` clean; `next build` clean.
  - No audit or corpus snapshot moved.

## Browser, end to end (`ack-local/`, this branch's site and backend on localhost; S Wadsworth Blvd, Lakewood; 1440 and 360)

| step | NEEDS YOU |
|---|---|
| generated | both Lakewood rule rows offer **Acknowledge**; every other row is unchanged (Dismiss / Show 5 / Apply 0) |
| Acknowledge pressed | "double-posted set": "needs attention · required by Lakewood · acknowledgement staged", button **Undo**; Apply row "1 acknowledgement staged · not yet applied", button **Apply 1 acknowledgement** |
| Apply | the regenerate sends `meta.acknowledged: ["jur:delta:lakewood:3eeee55be3"]`; the row reads "… · acknowledged", button **Withdraw**; the tier, title and header count (4) are unchanged |

The audit answered:

```json
"acknowledged": [{"id": "jur:delta:lakewood:3eeee55be3", "rule": "Double posting of signs is required on state highways with a median, optional on city streets.", "source": "Lakewood typical TCP sheet — Lane Closure on a Multi-Lane Street § note 6", "applies": true}]
```

That is the payload-level proof (Rule 11): the field is on the wire, and the audit lists it.

**Screenshots, look at this:** `wadsworth-needsyou-*` (before), `wadsworth-staged-*`, `wadsworth-acknowledged-*`.

**Observed, pre-existing, not changed:** at 1440 the "Lakewood work-method rule" title wraps to three lines,
squeezed by its long citation in the right track. It is the same on prod (`before-prod-d51832e/`), so it is
not caused by this change.
