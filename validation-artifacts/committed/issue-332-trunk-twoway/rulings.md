# #332 rulings

Arc ordered by Ryan's audit review (2026-10-16): "fix in this order, one branch each … F2 first. Self-rule under R145."

## S1 (R145 self-ruled): a two-way trunk is undivided, decided by the backend's predicate
- **What it says:** a `trunk` or `motorway` way that isn't tagged one-way (`oneway` not `yes`/`-1`) is one undivided road. The backend's `carriageway_verdict` returns a new verdict, `undivided`, for it, and `plans_divided()` returns False.
- **Why it fits existing rules:**
  - It's the relay-fact pattern of #308/#322: the site relays the raw tag and class, and the backend owns the verdict (Rule 3).
  - Its evidence is the same kind #322 used. A one-way trunk way is one carriageway of a divided road (divided by class). A single two-way way carries both directions, so no median separates them.
  - No plan number or safety value is involved.
- **Classes:** `trunk` and `motorway`, matching `DIVIDED_BY_CLASS`. `*_link` stays out (Note 8's "multi-lane ramps", as in #322).

## S2 (R145 self-ruled): the site relays carriageway facts for every trunk/motorway
`classify.ts` relays `CarriagewayFacts` when the class is in `DIVIDED_BY_CLASS`, whatever the `oneway` tag. Its existing carriageway block then sets `divided` from the verdict, and outside towns sets `roadType` to `rural_undivided`. The frontend mirror (`carriageway.ts`) gains the same `undivided` verdict.

## S3 (R145 self-ruled): no divided toggle where the road decided
`showsDividedToggle` hides the urban divided toggle when the verdict is `undivided`. Otherwise it would be a control the backend ignores (P2, one control per fact). The same dead toggle exists today on an urban one-way trunk (divided by class, #322). It's left as is here and noted in the report, because it's outside #332.

## Not in scope
- An operator who picks `rural_divided` on a two-way trunk still gets an undivided plan, because the verdict wins. The road-type select keeps its label.
- Lamar's US 50/287 ways are tagged `oneway=yes` (divided by class) and stay divided.
