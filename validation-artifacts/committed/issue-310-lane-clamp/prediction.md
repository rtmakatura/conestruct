# Rule 5 prediction: `issue-310-lane-clamp` (#310)

Written 2026-10-14, stacked on `issue-319-stations` (`1bf0e15`, off main `20230f1`), before any
change. Authority: #310 (option (a); its Acceptance), the #176 disclosure pattern, the
relay-fact pattern (#136/#158/#86/#177), Rule 10, R145.

## R145 self-ruled

#310 lists three options and defers the choice; (a), disclose, is "the smallest honest step" and
follows the #176 pattern that already exists, so it fits existing rules. (b) (draw more lanes)
changes the wire contract and the sheet's scale; (c) (refuse) blocks real jobs on wide arterials
like Broadway. Self-ruled: **(a)**, in the relay-fact shape:

- **The raw fact:** a new shoulder wire field, `roadLanesPerDirection`: the road's per-direction
  lane count before the 4-lane clamp. Set by the detection auto-apply (the classifier's
  `lanesPerDirection`, which `clampLanesToDomain` clamps today) and by the picker's lanes override
  (the operator's statement of the road, clamped the same way). Cleared by a form lane edit,
  which takes ownership of the count, as it clears the other lane relays.
- **The backend owns the predicate** (`ScenarioParams.road_lanes_per_direction`, bridged in
  `scenario_to_call`): the road has more lanes per direction than the plan draws.
- **Shoulder only.** Only the shoulder kind auto-applies a lane count, so only it clamps one
  (the flagger kind has no lanes; the near-intersection mainline lanes are operator-set and
  never auto-applied).

## Deliberate changes

When `road_lanes_per_direction > num_lanes` (in practice: a 5+ lane road drawn as 4):

1. **Page 1:** a fixed-obligation note beside the #176 rightmost-lane note, in its style:
   > LANES: DRAWN AS 4 PER DIRECTION; THE ROAD HAS 5. THE SHEET DRAWS AT MOST 4 PER DIRECTION,
   > SO DEVICE OFFSETS ARE MEASURED AGAINST 4 LANES.
2. **The audit:** a pending-verification item (the first #176-style audit item; modelled on the
   #120 lane-confidence item), so it reaches NEEDS YOU, the plan flags and every audit surface:
   > Drawn as 4 lanes per direction; the road has 5. Plans draw at most 4 lanes per direction,
   > so the device offsets are measured against 4 lanes.
3. **The crew narrative:** a Safety Notes bullet beside the #176 one, the same sentence.

The counts in all three are the plan's and the road's numbers, never literals.

## Predicted outcome

- A shoulder plan whose road has 5 lanes per direction shows the line on all three surfaces.
- Plans at 4 lanes or fewer, and every plan without the field (direct API callers, every other
  kind, every committed fixture and snapshot), are unchanged: **no snapshot changes**, no PDF
  fixture changes.
- The frontend sends `roadLanesPerDirection` on auto-apply and on the picker override, and drops
  it on a form lane edit.
- Tests: the predicate; each surface (sheet note text, audit item, narrative bullet) with and
  without the fact; the wire field's bounds; the frontend relay set and cleared.
