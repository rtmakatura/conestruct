"""#284: propose a kind of work only when the road leaves exactly one.

Ryan, 2026-10-14: "Propose a kind only when the road facts leave exactly
one eligible kind; never pre-selected; marked '✓ proposed'; it rides on
the corridor-geometry answer.  The operator's click makes it the kind, and
the audit records it as proposed then chosen (suggest-never-set holds)."

"Eligible" adds no threshold of its own.  A live kind is ruled out only by
a road fact the request carries that the backend's own refusal gates
already turn away (render_api ``_ensure_direction_eligible``,
``_ensure_lane_eligible``; ``NearIntersectionScenario._check_not_divided``),
through the same predicates.  A fact the request does not carry rules out
nothing, so an unknown never becomes a proposal (Rule 10): "no proposal"
is a first-class answer, not an error.
"""

from __future__ import annotations

from typing import Any

from src.api.schemas import flagger_lane_ineligible_high

# The live kinds (render_api.ENABLED_SCENARIOS), in chip order.
LIVE_KINDS = ("shoulder", "flagger_lane_closure", "near_intersection")

KIND_WORDS = {
    "shoulder": "shoulder work",
    "flagger_lane_closure": "a flagger lane closure",
    "near_intersection": "work near an intersection",
}


def _road_facts(scenario: Any) -> dict[str, Any]:
    """The road facts the request carries, whichever kind it is."""
    meta = scenario.meta
    road_direction = getattr(meta, "roadDirection", None)
    carriageway = getattr(scenario, "carriageway", None)
    # The road's raw OSM ``oneway`` tag, from whichever relay carries it:
    # the work-start direction facts, the flagger relay, or the carriageway
    # relay (shoulder / near-intersection).  All three are the same tag.
    oneway = (
        (road_direction.oneway if road_direction else None)
        or getattr(scenario, "oneway", None)
        or (carriageway.oneway if carriageway else None)
    )
    verdict = scenario.carriageway_verdict() if hasattr(scenario, "carriageway_verdict") else None
    # #332: an ``undivided`` verdict (a two-way trunk) outranks a stale
    # ``divided`` flag, as ``plans_divided`` does for the shoulder kind.
    divided = verdict == "divided" or (
        verdict != "undivided" and bool(getattr(scenario, "divided", False))
    )
    return {
        "oneway": oneway,
        "divided": divided,
        "one_way_street": verdict == "one_way_street",
        "total": getattr(scenario, "detectedLanesTotal", None),
        "forward": getattr(scenario, "detectedLanesForward", None),
        "backward": getattr(scenario, "detectedLanesBackward", None),
        "both_ways": getattr(scenario, "detectedLanesBothWays", None),
    }


def excluded_kinds(scenario: Any) -> dict[str, str]:
    """Each live kind the road facts rule out, with the reason in words."""
    # Lazy: render_api imports this module.
    from src.api.render_api import _ONEWAY_BLOCKING

    f = _road_facts(scenario)
    out: dict[str, str] = {}
    # _ensure_lane_eligible's low side: one lane in total on an undivided
    # road.  Only a shoulder plan is exempt, and only on a one-way street.
    single_lane = f["total"] == 1 and not f["divided"]
    one_lane = "it has one lane in total"

    if single_lane and not f["one_way_street"]:
        out["shoulder"] = one_lane

    if f["oneway"] in _ONEWAY_BLOCKING:
        out["flagger_lane_closure"] = "it is one-way, so a flagger has no opposing traffic to hold"
    elif flagger_lane_ineligible_high(f["total"], f["forward"], f["backward"], f["both_ways"]):
        out["flagger_lane_closure"] = "it carries more lanes than a flagger's one each way"
    elif single_lane:
        out["flagger_lane_closure"] = one_lane

    # A divided road does NOT rule near-intersection out: #312 (R134; fix
    # 27a4105, shipped at 8f5e482) plans it as one carriageway of a divided
    # highway, and the
    # frontend never sends this kind `divided: true`, the only fact
    # ``_check_not_divided`` refuses.  The one-lane road does: the request
    # carries no lane count, but the fact is the road's and the gate's own
    # words are kind-agnostic ("a single-lane road, which isn't supported
    # yet"), so it is ruled out here rather than proposed on every one-lane
    # road because its request is blind to lanes.
    if single_lane:
        out["near_intersection"] = one_lane
    return out


def propose_kind(scenario: Any) -> dict[str, Any] | None:
    """The proposal, or None.  Never sets the kind."""
    excluded = excluded_kinds(scenario)
    left = [k for k in LIVE_KINDS if k not in excluded]
    if len(left) != 1:
        return None
    kind = left[0]
    reasons = [excluded[k] for k in LIVE_KINDS if k in excluded]
    basis = f"Only {KIND_WORDS[kind]} fits this road: " + "; and ".join(reasons) + "."
    return {"kind": kind, "basis": basis, "excluded": excluded}
