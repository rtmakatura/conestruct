# #330 outcome: TA-23 page 1's dimension labels don't crowd

## Ryan's ruling (2026-10-16), verbatim
> 2. Plan page 1 dimension labels: on TA-23 left far-side plans, "CROSS STREET" and "CLOSED = N ft" crowd each other and their tick marks (see #328's after images). Stagger or reposition them so no label touches another label or a tick. Containment 0/0/0; every other plan's page byte-identical. Post before/after.

R145 self-ruled. It's a drawing fix inside the rule; no plan value changes.

## Cause
`_draw_landmarks`' greedy rows keep raised labels apart within a row but ignore leaders. On E 11th (131 ft/in), "CLOSED = 24 ft" sat one row under "CROSS STREET", and its leader ran through that text. With only centred labels, no row assignment avoids it: the two spans are narrower than either label, so CLOSED's leader always falls inside CROSS STREET's text.

## Built (`src/rendering/plan_sheet.py`)

**`_place_dim_labels`**, used only on TA-23's frame (`_TURN_BAY_FRAME`). An exhaustive search, with pruning, gives each raised label a row (1 to 4) and an anchor: centred on its leader, hanging right of it, or hanging left. It picks the least-raised, then least-shifted, layout in which:
- **labels in a row:** no two come within 4 pt;
- **leaders:** none passes within 3 pt of a label in a row it crosses, raised or in-line;
- **page:** every label stays on the plan.

The gaps (`_LABEL_GAP_PT`, `_LEADER_GAP_PT`) are chosen for legibility at 7 pt; a drawing convention, not a plan value. When no layout exists, the greedy rows stand.

**`_draw_dim`** takes `anchor` (default `"center"`, drawn exactly as before); `_draw_anchored` and `_anchored_extent` draw and measure it.

## Before and after (`page1/`; before = #328's after images at `41c74cc`)

| plan | before | after |
|---|---|---|
| E 11th, 1,000 ft work zone, 300 ft bay | `before-e11th-300-dims.png`: CLOSED's leader through CROSS STREET | `after-e11th-300-dims.png`: CROSS STREET hangs left of its leader, CLOSED right of its own, one row |
| E 14th, 2,000 ft work zone, 300 ft bay | `before-e14th-300-dims.png` | `after-e14th-300-dims.png` |

Whole pages are beside them.

## Rule 5
`parity323f.py` at `41c74cc` and after: of 963 responses, only `ni-left-far-300` `/render/pdf` changed (`p330-before.json`, `p330-after.json`).

## Tests
**`tests/test_ta23_dim_labels.py`** records every `_draw_dim` call of a real render and checks the drawn geometry at E 11th and E 14th with 50, 300 and 1,200 ft bays:
- no two labels in a row within 4 pt;
- no leader within 3 pt of a label it crosses;
- no in-line label over a tick;
- everything on the plan.

**Red proof:** with the search disabled (`_place_dim_labels` returning None, the greedy rows), the E 11th / 300 case fails: `('CLOSED = 24 ft', 'leader through', 'CROSS STREET')`.

**Containment:** 0/0/0, via `test_ta23_page1.py`'s existing cases and the renders above.

## Suites
- **pytest:** 2,915 passed, 2 skipped.
- **mypy:** 0 issues.
- **ruff:** clean.
