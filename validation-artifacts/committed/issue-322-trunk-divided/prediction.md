# Rule 5 prediction: `issue-322-trunk-divided` (#322)

Committed before any code change. Branched from main `ef8f573`.

## Ruling

Ryan, 2026-10-14:

> #322: same fix as #312 (R134), extended to divided trunk roads. This fits the existing ruling, so self-rule it
> under R145. Before and after: generate the S Santa Fe Dr near-intersection plan, show the audit's Note 8 row
> and the sign count on both sides, and confirm undivided and one-way plans stay byte-identical.

## A correction to #322's own repro

#322 named `39.70000, -104.98770` as S Santa Fe Dr on a trunk. A capture of the scenario prod sends there
(`capture322.cjs`) shows it is the **primary** stretch: way class `primary`, a same-name twin at 14.5 m,
verdict `divided`. #312 already plans that pin correctly.

The trunk stretch is further south: **S Santa Fe Dr at `39.69322, -104.99425`** (way 16981493, `highway=trunk`,
`oneway=yes`, ref US 85). There, prod's near-intersection request carries **`carriageway: null`,
`divided: false`** (`before-prod-ef8f573-scenario.json`), which is the defect. Other one-way trunk
carriageways with at-grade streets in Denver include US 285 Hampden and US 6/85 Vasquez (`trunk322.py`).

## The fix (R145 self-ruled, #312's route)

A one-way **trunk or motorway** carriageway is divided by class: `classify.ts` already says so for the shoulder
kind. So the carriageway verdict gains a rule, in both its producer (`src/rules/carriageway.py`) and its
display mirror (`lib/road-detection/carriageway.ts`):

> a `oneway` tag in `{yes, -1}` on class `trunk` or `motorway` → `divided`, by class, before the twin test

and `classify.ts` builds the carriageway facts for those classes too, so the relay reaches the
near-intersection kind. #312's plan then applies unchanged: mainline signs mirrored to the median side at the
CHOSEN -4.0 ft, Note 8 owed, the "Divided Highway" title.

What stays the same:

- `carriagewayApplies` (the twin question, and the PlanDetails carriageway row) still covers street classes
  only. A trunk road gets no "same-name carriageway … m away" row; its verdict comes from the class.
- **Shoulder on a trunk road:** today `divided: true` by class; after, the verdict `divided`. `plans_divided()`
  is the same, so the plan is the same. One message changes: a left side asked for on a trunk shoulder plan is
  refused for cause `divided` instead of `no_facts`, which is more accurate.

## Before and after (S Santa Fe Dr, `39.69322, -104.99425`)

The scenario is captured from the real site:

- **Before:** prod `ef8f573`'s frontend.
- **After:** a `next start` of the branch.

The cross street the picker marks by a map click is added programmatically: the road's nearest named cross
street, from #285's own read, and a side. Then `/render/audit` and `/render/pdf` run (prod for before, the
branch's backend on localhost for after).

| | Note 8 row | signs |
|---|---|---|
| before (predicted) | "Signs on both sides of divided highway · Required: False" | `0 left, N right` |
| after (predicted) | "Required: True" | `N left, N right` |

The title gains "Divided Highway".

## Byte-identical

The following match between `ef8f573` and the branch:

- the near-intersection audit and PDF page 1 for an undivided two-way road (Lafayette St) and a one-way street
  (N Broadway SB);
- every audit and corpus snapshot (`tests/snapshots/`), with no file moving;
- a shoulder plan on a two-way road.

## Tests

- **pytest:** the verdict is `divided` for one-way trunk and motorway; `not_applicable` for a two-way trunk and
  for links; the street-class rules are unchanged.
- **vitest:** the mirror agrees, and `classify.ts` builds facts for a one-way trunk.
