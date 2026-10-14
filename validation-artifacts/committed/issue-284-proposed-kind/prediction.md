# Rule 5 prediction: `issue-284-proposed-kind` (#284)

Committed before any code. Stacked on `issue-297-stable-keys` (`abc7d7d`).

## Ruling

Ryan, 2026-10-14:

> #284: as you recommend. Propose a kind only when the road facts leave exactly one eligible kind; never
> pre-selected; marked "✓ proposed"; it rides on the corridor-geometry answer. The operator's click makes it
> the kind, and the audit records it as proposed then chosen (suggest-never-set holds).

This supersedes `issue-290-pin-work/checkpoint.md:476-478` ("#284's proposal only pre-selects"). The kind is
never pre-selected; the defect-1 ruling (`issue-289-band-stack/rulings.md:258-263`, no chip pressed until a
person picks) stands unchanged.

## "Eligible" (R145 self-ruled: no new thresholds)

The live kinds are `shoulder`, `flagger_lane_closure` and `near_intersection`. A kind is ineligible only when
a road fact the request carries is one that the backend's own refusal gates already turn away. The producer
calls the same predicates the gates do:

| kind | ineligible when (the gate it mirrors) |
|---|---|
| flagger | the road is tagged one-way (`meta.roadDirection.oneway` or the flagger relay `oneway` in `{"yes","-1","reversible"}`; `_ensure_direction_eligible`) |
| flagger | the detected lanes exceed TA-10's one-each-way (`schemas.flagger_lane_ineligible_high`; `_ensure_lane_eligible`) |
| near_intersection | the road is divided (`divided`, or a carriageway verdict of `divided`; `NearIntersectionScenario._check_not_divided`) |
| any | one lane in total on an undivided road that isn't a one-way street (`_ensure_lane_eligible`'s low side) |

- A fact the request doesn't carry excludes nothing.
- When exactly one live kind is left, it is the proposal. Two or three left, or none, means no proposal: a
  first-class output, not an error.
- In practice that means a proposal of shoulder work on divided multi-lane roads (or divided one-way ones),
  and nothing elsewhere. Shoulder-or-flagger on a two-lane road needs the unbuilt aerial tap, as #281
  recorded.

## What gets built

### Backend

- **`src/rules/kind_proposal.py`:** `propose_kind(scenario) -> dict | None`, returning `{"kind", "basis",
  "excluded": {kind: reason}}`. `basis` is the backend's sentence, e.g.:

  > Only shoulder work fits this road: it is divided (no near-intersection plan), and it carries more lanes
  > than a flagger's one each way.
- **`/render/corridor-geometry`:** adds `kind_proposal: {"kind", "basis"}` only when there is one. Every other
  answer is byte-identical.
- **The audit (`_audit_build`):** adds top-level `kind_proposal: {"proposed", "chosen", "basis"}` only when
  there is one, with `chosen = scenario.kind`. The audit PDF prints one line under the summary:

  > Kind of work: proposed shoulder work (…basis…); chosen by the operator.

  When the two differ, it says "proposed X; the operator chose Y".

### Frontend

- **`lib/corridor-geometry.ts`:** `kind_proposal?: {kind, basis}` on the type.
- **`KindChips`** (`WhereBand.tsx`):
  - The proposed chip's citation gains " · ✓ proposed", the prototype's wording
    (`issue-289-band-stack/prototype/band-stack.html:271`).
  - A line under the chips (`kind-proposal-note`) prints the backend's `basis`.
  - `aria-pressed` is untouched: nothing is pressed until a person clicks. A click is the existing
    `onKindChange`, which marks the kind picked (suggest-never-set).

## Predicted

- **pytest** `tests/test_kind_proposal.py`:
  - a divided road with lane counts over the ceiling proposes shoulder;
  - a divided road whose lanes are unknown proposes nothing, because flagger can't be excluded;
  - a one-way undivided street proposes nothing (shoulder and near-intersection are both left);
  - a two-lane two-way road proposes nothing;
  - a one-lane undivided two-way road proposes nothing (no kind is left);
  - every excluded kind is refused by the real gate on the same facts. Asserted by running the gate
    functions, so the producer and the gates can't drift.
- **Endpoint tests:**
  - corridor-geometry carries `kind_proposal` only when present;
  - the audit's `kind_proposal` records proposed and chosen;
  - no audit or corpus snapshot moves, unless a snapshot scenario carries facts that leave one kind (counted
    and named if so).
- **vitest:**
  - the chip shows "✓ proposed" and the note from the answer;
  - no chip is pressed by a proposal (payload level: the scenario's kind is unchanged until a click);
  - a click on the proposed chip picks it like any other chip.
- **Accuracy:** before the change, 0 proposals on every reference pin; after, the table in the outcome.
  Reference pins: N Broadway SB, Lafayette St, S Wadsworth Blvd, plus divided roads found by the probe.
  "Accurate" means the proposal is a kind Generate accepts and the excluded kinds are ones it refuses on those
  facts. Checked by the shared-predicate test, and in the browser by the proposal never landing on a pin
  whose other kinds generate.
- **Screenshots** at 1440 and 360 of the chips with a proposal and without one. **Look at this:** it is a
  visible change.
