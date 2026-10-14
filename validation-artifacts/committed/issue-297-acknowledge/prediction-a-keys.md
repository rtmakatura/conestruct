# Rule 5 prediction: `issue-297-stable-keys` (#297 step 1 of 3, stable NEEDS YOU keys)

Committed before any code change is committed. (A first edit to `src/rules/jurisdiction.py` was made in the
working tree before this file. It is not committed with this file, and is described below as predicted code.)

## Rulings

Ryan, 2026-10-14:

> #297: as you recommend. ACKNOWLEDGE only on NEEDS YOU items with no write action (the jurisdiction deltas).
> Give items stable keys first, then record acknowledgements in meta.acknowledged keyed by stable id. The
> audit lists what was acknowledged.
> Build #297's stable keys first, then #284, then #297.

## The defect this step fixes

NEEDS YOU's jurisdiction-delta items are id'd `jur:delta:${i}` (`conestruct/site/lib/needs-you-items.ts:50`).
`i` is the position among the deltas that FIRE for this scenario (`src/rules/jurisdiction.py` `evaluate()`
keeps only FIRES / CONDITIONAL / UNKNOWN). Changing the closure, the class or night can change which earlier
deltas fire, which shifts every later id. An acknowledgement keyed on that id would silently move to another
rule. The Colorado FAIL items are index-based too (`audit:colorado:fail:${i}` over the filtered fails).

## Design (R145 self-ruled)

- **The key.** Deltas carry no id: `data/jurisdiction.schema.json` forbids extra fields, and no field
  combination is unique (e470, littleton and parker repeat source, section, op and device). The backend
  therefore mints `key = "<jurisdiction key>:<first 10 hex of sha1(canonical JSON of the delta record)>"`
  (`jurisdiction.delta_key`) on every applied delta.
  - It does not move when other deltas start or stop firing.
  - It changes when the rule's own record is edited, so an acknowledgement of the old words doesn't carry
    over to new ones.
- **The item ids.**
  - Jurisdiction deltas become `jur:delta:<key>` in `needs-you-items.ts` and both tier mirrors
    (`lib/tiering.ts`, `src/rendering/tier_ledger.py`).
  - A delta without a `key` (a recorded fixture or an older backend) keeps the old `jur:delta:<i>`, so
    nothing renders without an id.
  - The Colorado FAIL items become `audit:colorado:fail:<check label>`. The label is the check's own name,
    so a passing check earlier in the list doesn't move it.
- **The fixtures.** The six recorded tiering fixtures (`tests/fixtures/tiering/*.json`) get each applied
  delta's `key`, computed by the backend's own function from the matching record (`addkeys297.py`).
  `tiering-expectations.json`'s `jur:delta:N` ids become `jur:delta:<key>`.
- **No visible change.** The ids are React keys and test handles; nothing on screen prints them.

## Predicted

- **A uniqueness test:** every delta in all 14 `data/jurisdictions/*.json` files gets a distinct key.
- **A stability test:** the same delta keeps its key between a scenario where an earlier delta fires and one
  where it doesn't.
- **Updated tests:**
  - `needs-you-items.test.ts`, `tiering.test.ts` and `needs-you-conditions.test.ts`: the new ids;
  - `test_tier_ledger.py` and `test_r117_jurisdiction_raised.py`: the new ids, through the shared
    expectations file.
- **Snapshots:**
  - The device-breakdown answer gains `key` on each applied delta. That is the only wire change.
  - The audit and corpus snapshots don't move, because the audit carries no deltas.
- **Suites:** pytest and vitest green.
- **Screenshots** at 1440 and 360 of NEEDS YOU with a jurisdiction delta, for the record. They should look
  identical before and after.
