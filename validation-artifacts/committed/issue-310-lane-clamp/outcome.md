# Rule 5 outcome: `issue-310-lane-clamp` (#310)

Prediction: `prediction.md` (committed `c0df742`, before any change). Stacked on
`issue-319-stations`.

## Measured (`render310.py`, the committed Broadway SB fixture, `tests/fixtures/corridor/broadway-sb.json`)

North Broadway (way `131232822`, OSM `lanes=5`, one-way) as the wire carries it today (`lanes: 4`),
once with `roadLanesPerDirection: 5` and once without:

| Surface | With the relay | Without |
|---|---|---|
| Page 1 notes box | "DRAWN AS 4 LANES PER DIRECTION; THE ROAD HAS 5. PLANS DRAW AT MOST 4 LANES PER DIRECTION, SO THE DEVICE OFFSETS ARE MEASURED AGAINST 4 LANES." (2 lines, above the draft trailer; `after/page1-notes-with-relay.png`) | absent (`after/page1-no-relay.png`) |
| Audit pending items | `lanes_drawn_below_road`, the same sentence, tracking #310 | none |
| Crew narrative (Safety Notes) | "- Lanes: Drawn as 4 lanes per direction; the road has 5. Plans draw at most 4 lanes per direction, so the device offsets are measured against 4 lanes." | absent |

## Prediction vs. outcome

| Predicted | Outcome |
|---|---|
| A 5-lane road shows the line on all three surfaces | ✓ |
| No relay, or the road within the plan's count: unchanged | ✓ (and `tests/test_lane_ceiling.py`: 4-lane road, no relay) |
| No snapshot or fixture changes | ✓ none changed; Python suite 2786 passed, 2 skipped |
| The frontend sets the relay on auto-apply and the picker override, drops it on a form lane edit | ✓ and on a picker save with no road (`clearDetectionRelays`), added in the build |
| Page 1 wording "LANES: DRAWN AS 4 PER DIRECTION; … THE SHEET DRAWS AT MOST 4 …" | **Changed during the build:** page 1 prints the audit's and the narrative's sentence upper-cased, so the three surfaces share one sentence (`layout.lanes_drawn_below_road`, the #176 single-source pattern) |

## Tests

- `tests/test_lane_ceiling.py` (6): the predicate (fires only when the road has more; the
  numbers come from the plan and the road), the wire field's bounds, the audit item, no item
  without the fact, page 1's text, the crew narrative's bullet; all through the real endpoints.
- `conestruct/site/lib/scenarios/lane-ceiling-relay.test.ts` (7): detection relays 5 and plans 4;
  within the ceiling relays the same count; a detection without a count clears it; the picker
  override relays the operator's count; a form lane edit clears it; an outsized count (25)
  relays as-is and a 0 is dropped; a road-less picker save removes it from the wire.
- Site suite: 2169 passed (210 files); type check clean.

## Repair (diff-verifier, cycle 1)

The first verification returned REPAIR: the relay sent the raw count, the wire capped it at
1..20, and an OSM tag outside that (`lanes=25`, or a `lanes:forward` that parses to 0) would have
422'd the whole render, the failure `clampLanesToDomain` exists to prevent. Fixed both halves:
the wire takes any count of at least 1 (the predicate needs no upper bound, and a large count is
still the map's claim), and the frontend relays only a whole count of at least 1
(`roadLanesRelay`, `validation.ts`), at both sites. Its caveat, that the sentence's "4" and the
wire's `lanes` cap were separate literals, is also closed: both read `PLAN_MAX_LANES_PER_DIRECTION`
(`schemas.py`'s two `lanes` fields). The frontend's `MAX_LANES_PER_DIRECTION` stays its own
constant (TypeScript can't import it).

## Scope

Shoulder only: it is the one kind that auto-applies, and so clamps, a lane count. The flagger
kind has no `lanes`; the near-intersection mainline count is operator-set and never
auto-applied. The device geometry is unchanged (the line discloses the clamp; option (b),
drawing more lanes, stays open as future work).
