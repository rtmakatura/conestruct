# Rule 5 outcome: `issue-297-stable-keys` (#297 step 1 of 3)

Prediction: `prediction-a-keys.md` (committed `c049a90`).

## Built as predicted

- **`src/rules/jurisdiction.py`:** `delta_key(jurisdiction_key, delta)` returns `"<jurisdiction>:<10 hex>"`,
  the first 10 hex of sha1 over the delta record's canonical JSON. `evaluate()` puts it on every applied delta
  as `key`.
- **The fact ids:**
  - `conestruct/site/lib/tiering.ts` has a new `deltaFactId(d, i)`: `jur:delta:<key>` when the delta has a
    key, else the old `jur:delta:<i>`.
  - `lib/needs-you-items.ts` and `lib/tiering.ts` use it.
  - `src/rendering/tier_ledger.py` mirrors the same rule.
- **The Colorado FAIL items** are now `audit:colorado:fail:<check label>`.
- **`lib/jurisdiction.ts`:** `AppliedDelta.key?: string`.
- **Fixtures:**
  - `addkeys297.py` added each recorded delta's key to the six `tests/fixtures/tiering/*.json`. It matches
    each delta to its source record by equality on the record's own fields and keeps each file's indent and
    escaping, so the diffs are just the key lines.
  - It rewrote the delta ids inside each case's block of the hand-formatted `tiering-expectations.json` as
    text, and added a provenance sentence.

## Measured

- **`tests/test_delta_keys.py`** (new, 4 tests):
  - every delta in all 14 shipped jurisdiction files gets a distinct key;
  - the key's shape;
  - the key survives another delta being removed;
  - editing a rule's words changes its key.
- **`lib/needs-you-items.test.ts`:** two new tests.
  - A keyed delta keeps its id when the delta before it stops firing.
  - A Colorado FAIL keeps its id when the check before it starts passing.
  - The existing uniqueness test now expects `audit:colorado:fail:L`.
- **`tests/test_r117_jurisdiction_raised.py`:** the live-evaluation test reads `jur:delta:<key>`. The
  recorded-block test (no keys) still reads `jur:delta:0`, as the fallback intends.
- **Suites:**
  - pytest: 2817 passed, 2 skipped.
  - vitest: 212 files, 2196 tests.
  - `tsc` clean; `next build` clean.
- **Snapshots:** the audit and corpus snapshots don't move, because the audit carries no deltas. The only wire
  change is `key` on the device-breakdown answer's applied deltas.
- **Screenshots** (`before-prod-d51832e/` vs `after-local-keys/`, S Wadsworth Blvd, Lakewood, 1440 and 360):
  - NEEDS YOU renders the same seven rows in the same order with the same buttons.
  - The two Lakewood rule rows ("double-posted set", "Lakewood work-method rule") still have no control.
    Step 3 gives them ACKNOWLEDGE.
  - The local stack ran this branch's backend on localhost.

No deviations from the prediction.

**Repair (diff-verifier, cycle 1):**

- Two fixtures (`adv-ni-denver.json`, `control-lakewood.json`) had no final newline, and the first run of
  `addkeys297.py` added one. The script now keeps each file's own ending, and the re-run diffs are key lines
  only.
- The prod baseline was re-captured in one run, so `before-prod-d51832e/rows.json` holds both widths. Its
  NEEDS YOU rows and buttons equal `after-local-keys/` at 1440 and at 360, apart from the corridor scan's
  timestamp.
- `next build` ran clean in this worktree for the local stack ("Compiled successfully").
