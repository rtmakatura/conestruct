"""#284: a kind is proposed only when the road leaves exactly one.

"Eligible" adds no threshold: a live kind is ruled out only by a fact the
backend's own refusal gates already turn away.  The last test runs those
gates on the same facts, so the producer and the gates cannot drift.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from src.api import render_api
from src.api.schemas import Scenario
from src.rules import site_detection as sd
from src.rules.kind_proposal import excluded_kinds, propose_kind

PIN = (39.7400, -104.9600)
_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
SCN: TypeAdapter[Any] = TypeAdapter(Scenario)


def body(kind: str, **over: Any) -> dict[str, Any]:
    meta = {"project": "s284", "address": "", "lat": PIN[0], "lng": PIN[1], **over.pop("meta", {})}
    common = {
        "meta": meta,
        "speed": 35,
        "laneWidth": 12,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500,
        "night": False,
    }
    if kind == "shoulder":
        b = {
            "kind": "shoulder",
            "roadType": "urban_arterial",
            "lanes": 2,
            "divided": False,
            **common,
            "workType": "utility_locate",
        }
    elif kind == "flagger_lane_closure":
        b = {
            "kind": "flagger_lane_closure",
            "roadType": "rural_undivided",
            "pilotCar": False,
            "afad": False,
            "pedestrianAccess": False,
            **common,
        }
    else:
        b = {
            "kind": "near_intersection",
            "roadType": "urban_arterial",
            "lanes": 2,
            "divided": False,
            "approaches": [
                {
                    "id": "cross_a",
                    "speed": 30,
                    "roadType": "urban_arterial",
                    "lanesPerDirection": 1,
                    "laneWidth": 12,
                    "signalized": False,
                    "alongStationFt": 900,
                }
            ],
            **common,
        }
    b.update(over)
    return b


def scn(kind: str, **over: Any) -> Any:
    return SCN.validate_python(body(kind, **over))


SIX_LANES = {"detectedLanesTotal": 6, "detectedLanesForward": 3, "detectedLanesBackward": 3}
ONE_WAY_STREET = {
    "carriageway": {
        "oneway": "yes",
        "highwayClass": "residential",
        "twinDistanceM": None,
        "twinSearched": True,
    }
}


# ── the producer ──────────────────────────────────────────────────────────


def test_a_divided_road_wider_than_a_flagger_proposes_nothing() -> None:
    # Flagger is out (too many lanes), but near-intersection is not: #312
    # (R134) plans it as one carriageway of a divided highway.  Two kinds
    # are left, so there is no proposal.
    s = scn("shoulder", divided=True, lanes=3, **SIX_LANES)
    assert set(excluded_kinds(s)) == {"flagger_lane_closure"}
    assert propose_kind(s) is None


def test_a_divided_road_whose_lanes_are_unknown_proposes_nothing() -> None:
    # Flagger can't be ruled out on a fact the request doesn't carry.
    assert excluded_kinds(scn("shoulder", divided=True)) == {}
    assert propose_kind(scn("shoulder", divided=True)) is None


def test_a_one_way_undivided_street_proposes_nothing() -> None:
    # Flagger is out (one-way); shoulder and near-intersection both remain.
    s = scn("shoulder", detectedLanesTotal=3, **ONE_WAY_STREET)
    assert set(excluded_kinds(s)) == {"flagger_lane_closure"}
    assert propose_kind(s) is None


def test_a_two_lane_two_way_road_proposes_nothing() -> None:
    s = scn("shoulder", detectedLanesTotal=2, detectedLanesForward=1, detectedLanesBackward=1)
    assert excluded_kinds(s) == {}
    assert propose_kind(s) is None


def test_a_one_lane_two_way_road_leaves_no_kind_and_proposes_nothing() -> None:
    s = scn("shoulder", detectedLanesTotal=1)
    assert set(excluded_kinds(s)) == {"shoulder", "flagger_lane_closure", "near_intersection"}
    assert propose_kind(s) is None


def test_a_one_lane_one_way_street_proposes_shoulder_work() -> None:
    # Only a shoulder plan is exempt from the one-lane refusal, and only
    # on a one-way street.
    p = propose_kind(scn("shoulder", detectedLanesTotal=1, **ONE_WAY_STREET))
    assert p is not None and p["kind"] == "shoulder"
    assert p["basis"] == (
        "Only shoulder work fits this road: it is one-way, so a flagger has no opposing "
        "traffic to hold; and it has one lane in total."
    )


# ── the producer agrees with the gates ────────────────────────────────────

CASES = [
    ({"divided": True, "lanes": 3, **SIX_LANES}, {"flagger_lane_closure"}),
    ({"detectedLanesTotal": 3, **ONE_WAY_STREET}, {"flagger_lane_closure"}),
    ({"detectedLanesTotal": 1}, {"shoulder", "flagger_lane_closure", "near_intersection"}),
    ({"detectedLanesTotal": 1, **ONE_WAY_STREET}, {"flagger_lane_closure", "near_intersection"}),
    ({"detectedLanesTotal": 2, "detectedLanesForward": 1, "detectedLanesBackward": 1}, set()),
]


def _facts_for(kind: str, facts: dict[str, Any]) -> dict[str, Any]:
    """The same road facts as each kind's request would carry them."""
    f = dict(facts)
    if kind == "flagger_lane_closure":
        cw = f.pop("carriageway", None)
        f.pop("divided", None)
        f.pop("lanes", None)
        if cw:
            f["oneway"] = cw["oneway"]
    if kind == "near_intersection":
        # The frontend never sends this kind `divided: true` (auto-apply.ts's
        # near_intersection branch); a divided road reaches it as the
        # carriageway relay, which #312 plans.
        f.pop("lanes", None)
        f.pop("divided", None)
    return f


def _refused(kind: str, facts: dict[str, Any]) -> bool:
    # Any validation error here is a broken test body and must fail loudly.
    s = scn(kind, **_facts_for(kind, facts))
    try:
        render_api._ensure_direction_eligible(s)
        render_api._ensure_lane_eligible(s)
    except HTTPException:
        return True
    return False


def _gate_blind(kind: str, facts: dict[str, Any]) -> bool:
    """The one place the producer is stricter than a gate, on purpose: a
    near-intersection request carries no lane count (its schema has no
    ``detectedLanesTotal``), so the single-lane gate cannot see a one-lane
    road for it.  The fact is the road's, and the gate's own words are
    kind-agnostic ("a single-lane road, which isn't supported yet"), so the
    producer rules near-intersection out too rather than propose it on
    every one-lane road because its request is blind to lanes."""
    return (
        kind == "near_intersection"
        and facts.get("detectedLanesTotal") == 1
        and not facts.get("divided")
    )


@pytest.mark.parametrize(("facts", "want"), CASES)
def test_every_excluded_kind_is_one_the_gates_refuse(facts: dict[str, Any], want: set[str]) -> None:
    assert set(excluded_kinds(scn("shoulder", **facts))) == want
    for kind in ("shoulder", "flagger_lane_closure", "near_intersection"):
        if _gate_blind(kind, facts):
            assert kind in want and not _refused(kind, facts), kind
            continue
        assert _refused(kind, facts) == (kind in want), kind


# ── the wire ──────────────────────────────────────────────────────────────


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *a, **k: ({"elements": []}, None)
    )


@pytest.fixture()
def client() -> TestClient:
    return TestClient(render_api.app)


ONE_LANE_ONE_WAY = {"detectedLanesTotal": 1, **ONE_WAY_STREET}


def test_corridor_geometry_carries_the_proposal_only_when_there_is_one(client: TestClient) -> None:
    with_one = client.post(
        "/render/corridor-geometry", headers=AUTH, json=body("shoulder", **ONE_LANE_ONE_WAY)
    ).json()
    assert with_one["kind_proposal"]["kind"] == "shoulder"
    assert with_one["kind_proposal"]["basis"].startswith("Only shoulder work fits this road")
    without = client.post("/render/corridor-geometry", headers=AUTH, json=body("shoulder")).json()
    assert "kind_proposal" not in without


def test_the_audit_records_proposed_then_chosen(client: TestClient) -> None:
    out = client.post(
        "/render/audit", headers=AUTH, json=body("shoulder", **ONE_LANE_ONE_WAY)
    ).json()
    assert out["kind_proposal"]["proposed"] == "shoulder"
    assert out["kind_proposal"]["chosen"] == "shoulder"
    plain = client.post("/render/audit", headers=AUTH, json=body("shoulder")).json()
    assert "kind_proposal" not in plain


def test_the_audit_pdf_names_the_proposal_and_the_choice() -> None:
    from src.rendering.audit_blocks import _kind_proposal_blocks

    same = _kind_proposal_blocks(
        {"proposed": "shoulder", "chosen": "shoulder", "basis": "Only shoulder work fits."}
    )
    assert "Proposed shoulder work. Only shoulder work fits. The operator chose it." in repr(same)
    assert _kind_proposal_blocks(None) == []
