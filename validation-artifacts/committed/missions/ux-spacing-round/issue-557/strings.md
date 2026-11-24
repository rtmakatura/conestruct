# #557 user-facing strings

Ruling ("All items"): "List every new string with its source."

## New

None.

## Changed

| Before | Now | Where | Source |
|---|---|---|---|
| `CHANGE` | `Change` | The link at the end of a collapsed row, "Where" and "What's the job?" (`FactVerb` and the two `verb` values in `conestruct/site/lib/scenarios/band-facts.ts`). It is the link's visible text and its accessible name. | Ryan, 2026-11-24, item 3d: `The closed Where row's "CHANGE" becomes "Change"`. The same word on the closed "What's the job?" row is R145 self-ruled S2 (one component, one model field). |

## Removed

| String | Where it was | Why |
|---|---|---|
| `◂` `▸` `▴` `▾` | The work-hours window: the ends of the weekday ruler, and the top and bottom of a week column, where your hours ran off the old 5 am to 9 pm scale. Decoration inside `aria-hidden` charts; never read out. | They can't render on the 6 am to 6 am scale (rulings.md S9). Ryan, 2026-11-24: "If they're no longer needed with the 6 am to 6 am chart, remove them and record that." |

## Unchanged, checked

"See Denver's work hours", "Denver limits when you can close a lane.", "Default", "Zoom in", "Zoom out" and "Reset to the whole corridor" are the same strings as on the base; this item changes only their spacing or size.
