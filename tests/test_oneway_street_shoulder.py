"""#308 — a shoulder plan on a one-way street, from the wire payload in.

The frontend relays raw carriageway facts (``carriageway``); the backend
decides one-way street / divided / undecided (``src/rules/carriageway.py``)
and builds the plan from that verdict (rulings R83-R90).  Tested where the
bug lived (Rule 11): the parsed payload through the real bridge
(``scenario_to_call``), and the HTTP chokepoint for the refusal.  The
North Broadway shape: OSM ``highway=primary``, ``oneway=yes``, 4 lanes
(``tests/fixtures/corridor/broadway-sb.json``), here with no coordinates so
no site scan runs.
"""

from __future__ import annotations

import os
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from src.api.render_api import app
from src.api.schemas import Scenario, scenario_to_call
from src.generation.layout import (
    generate_shoulder_closure_divided,
    generate_shoulder_closure_undivided,
)
from src.rules.devices import DeviceType

AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}
ONE_WAY = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None, "twinSearched": True}


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def body(carriageway: dict[str, Any] | None = None, **over: Any) -> dict[str, Any]:
    b: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "s308", "address": "", "lat": 0.0, "lng": 0.0},
        "roadType": "urban_arterial",
        "speed": 30,
        "lanes": 4,
        "laneWidth": 11.0,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000.0,
        "night": False,
    }
    if carriageway is not None:
        b["carriageway"] = carriageway
    b.update(over)
    return b


def call(b: dict[str, Any]):
    return scenario_to_call(TypeAdapter(Scenario).validate_python(b))


def test_a_one_way_street_builds_one_way_params() -> None:
    params, generator, _ = call(body(ONE_WAY))
    assert params.one_way_street is True
    assert params.is_divided is False
    assert generator is generate_shoulder_closure_undivided
    # R88: the one-way street's shoulder width, CHOSEN.
    assert params.shoulder_width_ft == 8.0


def test_a_one_way_street_signs_only_the_closed_shoulders_side() -> None:
    """R90 / Note 8's single-shoulder exception: no left-curb mirror.  Sent
    as today's frontend sends Broadway (``divided: true``), whose divided
    generator mirrors every sign to the left curb."""
    params, generator, kwargs = call(body(ONE_WAY, divided=True))
    signs = [p for p in generator(params, **kwargs) if p.device_type == DeviceType.SIGN_GENERIC]
    assert signs
    assert all(p.offset_ft > 0 for p in signs)


def test_the_verdict_overrides_a_stale_divided_flag() -> None:
    """Today's frontend sends Broadway as divided; the backend decides."""
    params, generator, _ = call(body(ONE_WAY, divided=True))
    assert params.one_way_street is True
    assert params.is_divided is False
    assert generator is generate_shoulder_closure_undivided


def test_a_one_way_street_at_the_drawable_edge_is_accepted() -> None:
    """4 x 11 ft + the 8 ft one-way shoulder = 52 ft; the validator reads
    the shoulder from the verdict, not from a stale ``divided: true``
    (which would have added a 10 ft shoulder and refused)."""
    call(body(ONE_WAY, divided=True, laneWidth=11.0))


def test_a_same_name_twin_makes_it_divided() -> None:
    params, generator, _ = call(
        body({**ONE_WAY, "twinDistanceM": 21.7}, divided=False, laneWidth=10.5)
    )
    assert params.is_divided is True
    assert params.one_way_street is False
    assert generator is generate_shoulder_closure_divided
    assert params.shoulder_width_ft == 10.0


@pytest.mark.parametrize("divided", [True, False])
def test_a_two_way_road_keeps_its_own_divided_flag(divided: bool) -> None:
    facts = {**ONE_WAY, "oneway": "no"}
    params, _, _ = call(body(facts, divided=divided, laneWidth=10.5))
    assert params.is_divided is divided
    assert params.one_way_street is False


@pytest.mark.parametrize("divided", [True, False])
def test_no_carriageway_facts_is_exactly_todays_plan(divided: bool) -> None:
    with_none, gen_a, _ = call(body(None, divided=divided, laneWidth=10.5))
    assert with_none.one_way_street is False
    assert with_none.is_divided is divided
    assert gen_a is (
        generate_shoulder_closure_divided if divided else generate_shoulder_closure_undivided
    )


def test_the_operator_answer_decides_when_the_search_did_not_run() -> None:
    params, _, _ = call(body({**ONE_WAY, "twinSearched": False, "confirmed": "one_way_street"}))
    assert params.one_way_street is True


def test_an_undecided_road_is_refused_with_its_recovery(client: TestClient) -> None:
    res = client.post("/render/audit", headers=AUTH, json=body({**ONE_WAY, "twinSearched": False}))
    assert res.status_code == 400, res.text
    detail = res.json()["detail"]
    assert detail["error"] == "carriageway_undecided"
    # R107's row and answers, word for word.
    assert "Under Carriageway in Step 2" in detail["message"]
    assert "“One-way” or “Divided”" in detail["message"]


def test_a_confirmed_road_plans(client: TestClient) -> None:
    facts = {**ONE_WAY, "twinSearched": False, "confirmed": "one_way_street"}
    res = client.post("/render/audit", headers=AUTH, json=body(facts))
    assert res.status_code == 200, res.text


def test_a_single_lane_one_way_street_is_not_refused_as_single_lane(client: TestClient) -> None:
    """A one-way street's ``lanes`` tag counts every lane, all one direction:
    1 is a real one-lane one-way street, not the unrepresentable
    single-lane two-way road the #136 gate refuses."""
    one_way = body(ONE_WAY, lanes=1, detectedLanesTotal=1)
    assert client.post("/render/audit", headers=AUTH, json=one_way).status_code == 200
    two_way = body(None, lanes=1, detectedLanesTotal=1)
    res = client.post("/render/audit", headers=AUTH, json=two_way)
    assert res.status_code == 400
    assert "single-lane" in res.text
