"""#319 (Rule 3): the flagger row's station line comes from the plan, not the form.

The panel used to write "2 flagger" / "2 AFAD" from the form's AFAD switch and
"1 vehicle" from its pilot-car switch.  The audit now counts the stations the
layout placed (FLAGGER_STATION, and the TEMPORARY_SIGNAL placements labelled
AFAD_*) and takes the pilot car as a relayed raw fact, through the same
generator + ``build_audit_trail`` path the endpoint uses.
"""

from __future__ import annotations

import os
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from src.api.audit import build_audit_trail
from src.api.render_api import app
from src.api.schemas import Scenario, scenario_to_call
from src.generation.layout import generate_flagger_alternating_2lane
from src.rules.validators import ScenarioParams

_ADAPTER: TypeAdapter[Scenario] = TypeAdapter(Scenario)
_SECRET = "test-secret-do-not-deploy"


@pytest.fixture(scope="module", autouse=True)
def _set_render_secret() -> None:
    # As tests/test_audit_endpoint.py: the bearer middleware fails closed.
    os.environ["RENDER_API_SECRET"] = _SECRET


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture()
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_SECRET}"}


def _flagger(**over: Any) -> dict[str, Any]:
    # tests/corpus/manifest.py's _FLAGGER_GRID_BASE.
    return {
        "kind": "flagger_lane_closure",
        "meta": {"project": "t", "address": "", "lat": 0.0, "lng": 0.0, "siteConditions": {}},
        "roadType": "rural_undivided",
        "speed": 45,
        "laneWidth": 11.0,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 1000.0,
        "night": False,
        "pilotCar": False,
        "afad": False,
        "pedestrianAccess": False,
        **over,
    }


def _flagger_section(body: dict[str, Any]) -> dict[str, Any]:
    scenario = _ADAPTER.validate_python(body)
    params, generator, kwargs = scenario_to_call(scenario)
    placements = generator(params, **kwargs)
    trail = build_audit_trail(placements, params, pilot_car=bool(scenario.pilotCar))
    return trail["flagger"]


def test_flagger_stations_counted_from_the_placements() -> None:
    fl = _flagger_section(_flagger())
    assert fl["stations_text"] == "2 flagger station(s)"
    assert fl["stations_text"] == f"{fl['count']} flagger station(s)"
    assert "pilot_car_text" not in fl


def test_afad_counted_from_the_placements() -> None:
    fl = _flagger_section(_flagger(afad=True))
    assert fl["stations_text"] == "2 AFAD"
    assert fl["count"] == 0  # no FLAGGER_STATION placements on an AFAD plan


def test_pilot_car_relayed() -> None:
    fl = _flagger_section(_flagger(pilotCar=True))
    assert fl["stations_text"] == "2 flagger station(s)"
    assert fl["pilot_car_text"] == "1 vehicle"


def test_all_toggles() -> None:
    fl = _flagger_section(_flagger(afad=True, pilotCar=True))
    assert (fl["stations_text"], fl["pilot_car_text"]) == ("2 AFAD", "1 vehicle")


def test_the_line_follows_the_placements_not_the_switch() -> None:
    """Sentinel: drop one flagger station from the plan and the line says
    one.  A count taken from the form's AFAD switch would still say two."""
    params = ScenarioParams(
        speed_mph=45,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=1000.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    placements = generate_flagger_alternating_2lane(params)
    first = next(i for i, p in enumerate(placements) if p.label == "FLAGGER_1")
    trimmed = placements[:first] + placements[first + 1 :]
    assert build_audit_trail(trimmed, params)["flagger"]["stations_text"] == "1 flagger station(s)"


def test_not_on_other_kinds() -> None:
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
    )
    from src.generation.layout import generate_shoulder_closure_divided

    fl = build_audit_trail(generate_shoulder_closure_divided(params), params)["flagger"]
    assert "stations_text" not in fl
    assert "pilot_car_text" not in fl


def test_the_endpoint_relays_the_pilot_car(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    res = client.post("/render/audit", headers=auth_headers, json=_flagger(pilotCar=True))
    assert res.status_code == 200, res.text
    fl = res.json()["sections"]["flagger"]
    assert (fl["stations_text"], fl["pilot_car_text"]) == ("2 flagger station(s)", "1 vehicle")
