# #332 Rule 5 prediction (committed before code)

## Behavior that changes (deliberate)
1. **The backend verdict.** `carriageway_verdict(oneway=None|"no"|…, highway_class="trunk"|"motorway")` returns `undivided`. Today it returns `not_applicable`.
   - `plans_divided()` is False for it, whatever the scenario's `divided`.
   - `undivided` can only arise when facts are relayed for a two-way trunk/motorway. No client sends those today, so every existing request is unchanged.
2. **The site classifier.** For a two-way `trunk` / `motorway` way, `classifyFromOsmTags` now relays `carriageway` (`oneway` as tagged, `highwayClass`, the twin facts as found):
   - `divided: false`;
   - `roadType: "rural_undivided"` outside towns. In towns it stays `urban_arterial`.
   - One-way trunks/motorways and every street class are unchanged.
3. **The site's divided toggle** (`showsDividedToggle`) is hidden when the verdict is `undivided`.
4. **US 24 near Hartsel** (39.02175, -105.79286; audit rows `hartsel-r-65`, `hartsel-r-65-night`) plans as a two-lane undivided road:

   | | Before | After |
   |---|---|---|
   | MHT type | divided highway | undivided |
   | Median | drawn | none |
   | Left (median-side) signs | 7 | 0 |
   | Shoulder width | 10 ft | 8 ft |
   | L/3 at 65 mph | 217 ft | 173 ft |

   Device counts drop by the mirrored signs.

## Unchanged (checked)
- **Backend parity:** the 107-scenario / 963-response harness (`validation-artifacts/committed/issue-323-far-side/parity323f.py`) against `origin/main` shows 0 changed responses. No fixture relays facts for a two-way trunk.
- **One-way trunk shoulder and near-intersection plans** (S Santa Fe Dr, #322 fixture `tests/fixtures/trunk_divided/santa_fe_ni.json`) are byte-identical.
- **The left-side refusal** for a two-way trunk still names `two_way`. It trips on the raw `oneway` tag before any verdict (`render_api.py:420`).

## Tests
- **Backend** (`tests/test_carriageway.py`): the two-way trunk/motorway row moves from `not_applicable` to `undivided`. The new `tests/test_trunk_twoway_332.py` checks a US 24 shoulder scenario with relayed facts plans undivided: no median-side signs, an 8 ft shoulder.
- **Frontend** (`classify.test.ts`): a two-way trunk relays facts and reads `divided: false` (rural → `rural_undivided`). The old "two-way trunk relays nothing" case is updated. A `PlanDetails` test hides the toggle on `undivided`.
