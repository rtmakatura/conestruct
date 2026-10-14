# Rule 5 outcome: `issue-284-proposed-kind` (#284)

Prediction: `prediction.md` (committed `62fb718`). Stacked on `issue-297-stable-keys` (`abc7d7d`).

## Built

- **`src/rules/kind_proposal.py`:**
  - `excluded_kinds(scenario)` and `propose_kind(scenario)` over the live kinds.
  - The road's one-way tag is read from whichever relay carries it: `meta.roadDirection`, the flagger
    `oneway`, or the shoulder / near-intersection `carriageway`.
  - The ruling-out calls the gates' own predicates (`_ONEWAY_BLOCKING`, `flagger_lane_ineligible_high`, the
    single-lane rule).
- **`/render/corridor-geometry`:** adds `kind_proposal: {kind, basis}` only when there is one.
- **The audit:** `_audit_build` adds `kind_proposal: {proposed, chosen, basis}` only when there is one. The
  audit PDF prints a "Kind of work" block:

  > Proposed shoulder work. … The operator chose it.

  or "… chose X instead." when the operator picked another kind.
- **Frontend:**
  - `CorridorGeometry.kind_proposal` added to the type.
  - `KindChips` marks the proposed chip " · ✓ proposed" (`kind-proposed-mark`) and prints the backend's
    basis under the row (`kind-proposal-note`). `aria-pressed` is untouched.

## Deviation from the prediction: near-intersection is NOT ruled out on a divided road

The prediction listed "near_intersection ineligible when the road is divided (`_check_not_divided`)". That
was wrong.

- #312 (R134; fix `27a4105`, shipped at `8f5e482`) plans near-intersection on a divided road as one
  carriageway of a divided highway.
- The frontend never sends this kind `divided: true`, the only fact `_check_not_divided` refuses
  (`auto-apply.ts` `near_intersection` branch).

Ruling near-intersection out there would contradict a shipped ruling, so it was removed before the browser
check. With it gone, divided multi-lane roads (S Santa Fe Dr, E Hampden Ave, S Wadsworth Blvd) leave
shoulder and near-intersection both open, and propose nothing.

What does propose: a **one-lane one-way street**.

- Flagger is out because the road is one-way.
- Near-intersection is out because it is a one-lane road.
- Shoulder alone remains: a one-way street is the single-lane rule's one exemption.

The one place the producer is stricter than a gate is pinned by `tests/test_kind_proposal.py::_gate_blind`.
- **The gap:** a near-intersection request carries no lane count, so its gate can't see a one-lane road.
- **Why the producer excludes it anyway:** the fact is the road's, and the gate's words are kind-agnostic
  ("a single-lane road, which isn't supported yet").
- **What the gate does:** the browser check confirms near-intersection there stops at "Mark the cross street"
  rather than refusing.

**Found and filed (R146):** #322. On a divided *trunk* road the near-intersection request carries neither
`divided` nor `carriageway`, so the plan is built undivided. #312's fix reaches street classes only
(`carriagewayApplies`). That is outside #284 and was not changed here.

## Accuracy: reference pins, before and after

Before this change no producer existed: 0 proposals on every pin. After it (`kind-local-*/`, 1440, the
corrected producer):

| pin | road | proposal |
|---|---|---|
| Clarkson St (39.72547, -104.97757) | tertiary, one-way, 1 lane | **shoulder** |
| Tremont Pl (39.75474, -104.97466) | residential, one-way, 1 lane | **shoulder** |
| S Santa Fe Dr | divided trunk, 3 lanes each way | none |
| E Hampden Ave | divided arterial | none |
| S Wadsworth Blvd | multi-lane arterial | none |
| N Broadway SB | one-way, multi-lane | none |
| Lafayette St | two-way, 2 lanes | none |
| S Colorado Blvd | multi-lane arterial | none |

**What Generate's audit answered** when each kind was confirmed in its own fresh page (`acc-local-*/`):

| pin | shoulder | flagger | near-intersection |
|---|---|---|---|
| Clarkson St | 200 | **400**, "This looks like a single-lane road…" | stops at "Mark the cross street" |
| Tremont Pl | 200 | **400**, "This looks like a single-lane road…" | stops at "Mark the cross street" |
| S Santa Fe Dr | 200 | 400, "…more lanes than a flagger operation covers…" | stops at "Mark the cross street" |
| E Hampden Ave | 200 | 400, "This looks like a single-lane road…" | stops at "Mark the cross street" |
| S Wadsworth Blvd | 200 | 400, more lanes | stops at "Mark the cross street" |
| N Broadway SB | 200 | 400, more lanes | stops at "Mark the cross street" |
| Lafayette St | 200 | **200** | stops at "Mark the cross street" |
| S Colorado Blvd | 200 | 400, more lanes | stops at "Mark the cross street" |

- **Both proposals are accurate:** on Clarkson and Tremont the proposed kind is answered (200) and flagger is
  refused.
- **On Lafayette** shoulder and flagger both answer, and no proposal is made. That's right.
- **Near-intersection** can't be driven past "Mark the cross street" without marking a cross street, on any
  pin. Its exclusion on the two one-lane streets is the documented gate-blind case.
- The six `acc-local-*` runs other than Clarkson and Tremont were taken before the near-intersection
  correction. Their "proposed" field reflects the old producer; their shoulder and flagger answers don't
  depend on it.

## Measured

- **`tests/test_kind_proposal.py`** (14 tests):
  - the six producer cases (divided-wide, divided-unknown, one-way multi-lane, two-lane two-way, one-lane
    two-way, one-lane one-way);
  - the shared-gate check over five fact sets, which runs the real gates on each kind's request;
  - the corridor-geometry and audit wire tests;
  - the audit PDF block.
- **`components/bands/WhereBand.kind-proposal.test.tsx`** (4 tests):
  - the mark and the note;
  - the proposed chip is not pressed, and the loaded kind stays pressed;
  - a click picks the proposed chip;
  - no proposal, no mark;
  - every request carries the scenario's own kind (suggest-never-set).
- **Snapshots:** no audit, corpus or corridor-geometry snapshot moved (804 tests across those suites).
- **Suites:**
  - vitest: 213 files, 2200 tests.
  - `tsc` clean; `next build` clean.
  - pytest: 2831 passed, 2 skipped.

**The probe:** `validation-artifacts/committed/issue-297-acknowledge/shots297.cjs`, shared with #297's
screenshots. It gains the S Santa Fe Dr, E Hampden Ave, Clarkson St and Tremont Pl pins and the `accuracy`
mode the table above came from.

**Repair (diff-verifier, cycle 1):** an em dash in the new `_audit_build` comment became a colon, and the
#312 cite now names its fix commit, `27a4105`, beside its ship tip, `8f5e482`.

## Screenshots: look at this (a visible change)

In `shots284-clarkson/` (a proposal) and `shots284-lafayette/` (none), at 1440 and 360. The proposed chip
reads:

> Shoulder work · TA-3/TA-5 · S-630-1 · ✓ proposed

Under the row:

> ✓ proposed: Only shoulder work fits this road: it is one-way, so a flagger has no opposing traffic to hold;
> and it has one lane in total. Pick it to use it.

No chip is pressed, and Confirm keeps "choose the kind of work".
