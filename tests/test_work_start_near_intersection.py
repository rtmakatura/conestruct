"""#290 — near_intersection under the work-start model: the backend places the cross street.

Before: the frontend's ``alongStationFromPins`` (lib/road-detection/
cross-street.ts) walked the pin to the cross pin along the typed bearing and
subtracted the downstream taper because the pin sat at the corridor's
downstream tip — corridor math on the frontend, keyed to the old meaning.
Now a work-start plan carries the marked intersection (``meta.intersection``,
#234) and never a station; the backend measures it along the road from the
work start (ruling 7, Rule 3).  One producer per pin model, asserted.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter, ValidationError

from src.api.schemas import Scenario, scenario_to_call
from src.rules import site_detection as sd
from src.rules.corridor import _destination_point

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
PIN = (39.7400, -104.9600)
M_PER_FT = 0.3048


def at(bearing: float, feet: float) -> tuple[float, float]:
    return _destination_point(*PIN, bearing, feet * M_PER_FT)


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
    from src.api.render_api import app

    return TestClient(app)


def body(meta: dict[str, Any], station: float | None = None) -> dict[str, Any]:
    approach: dict[str, Any] = {
        "id": "cross_a",
        "speed": 30,
        "roadType": "urban_arterial",
        "lanesPerDirection": 1,
        "laneWidth": 12,
        "signalized": False,
    }
    if station is not None:
        approach["alongStationFt"] = station
    return {
        "kind": "near_intersection",
        "meta": {"project": "s290", "address": "", "lat": PIN[0], "lng": PIN[1], **meta},
        "roadType": "urban_arterial",
        "speed": 35,
        "lanes": 2,
        "laneWidth": 12,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500,
        "night": False,
        "approaches": [approach],
    }


def work_start(cross: tuple[float, float], **work: Any) -> dict[str, Any]:
    return {
        "pinModel": "work_start",
        "work": {"side": "right", "heading": "N", **work},
        "intersection": {"lat": cross[0], "lng": cross[1], "name": "E 17th Ave"},
    }


def station_of(meta: dict[str, Any], station: float | None = None) -> float:
    parsed = TypeAdapter(Scenario).validate_python(body(meta, station))
    _params, _gen, kwargs = scenario_to_call(parsed)
    (approach,) = kwargs["approaches"]
    return approach.along_station_ft


def test_a_cross_street_past_the_work_is_near_side() -> None:
    """Northbound, work 500 ft north of the pin; the cross street 700 ft
    north is 200 ft past the work's downstream end: station -200 (the
    layout frame: 0 = the work's downstream end, growing upstream)."""
    assert station_of(work_start(at(0.0, 700.0))) == pytest.approx(-200.0, abs=1.0)


def test_a_cross_street_before_the_work_is_far_side() -> None:
    """300 ft SOUTH of the pin is upstream of the work start for northbound
    traffic: 500 + 300 = station 800."""
    assert station_of(work_start(at(180.0, 300.0))) == pytest.approx(800.0, abs=1.0)


def test_corridor_end_keeps_the_sent_station() -> None:
    assert station_of({"bearingDeg": 180.0}, station=-200.0) == -200.0


def test_the_endpoints_serve_a_work_start_plan(client: TestClient) -> None:
    b = body(work_start(at(0.0, 700.0)))
    for path in ("/render/audit", "/render/markdown", "/render/device-breakdown"):
        res = client.post(path, headers=AUTH, json=b)
        assert res.status_code == 200, (path, res.text[:300])


# ---------------------------------------------------------------------------
# One producer per pin model
# ---------------------------------------------------------------------------


def test_work_start_never_carries_a_station() -> None:
    with pytest.raises(ValidationError, match="drop alongStationFt"):
        TypeAdapter(Scenario).validate_python(body(work_start(at(0.0, 700.0)), station=-200.0))


def test_work_start_needs_the_marked_intersection() -> None:
    meta = work_start(at(0.0, 700.0))
    del meta["intersection"]
    with pytest.raises(ValidationError, match="meta.intersection"):
        TypeAdapter(Scenario).validate_python(body(meta))


def test_corridor_end_needs_the_station() -> None:
    with pytest.raises(ValidationError, match="alongStationFt"):
        TypeAdapter(Scenario).validate_python(body({"bearingDeg": 180.0}))


# ---------------------------------------------------------------------------
# Honest refusals
# ---------------------------------------------------------------------------


def refused(client: TestClient, meta: dict[str, Any]) -> str:
    res = client.post("/render/device-breakdown", headers=AUTH, json=body(meta))
    assert res.status_code == 400, res.text[:300]
    assert res.json()["detail"]["error"] == "generator_rejected"
    return str(res.json()["detail"]["message"])


def test_side_unset_cannot_place_the_cross_street(client: TestClient) -> None:
    """The station's sign IS the direction: near side or far side decides the
    plan, so a near-intersection plan needs the side even for its counts."""
    meta = work_start(at(0.0, 700.0))
    meta["work"] = {}
    assert "confirmed side" in refused(client, meta)


def test_a_cross_street_inside_the_work_zone_is_refused(client: TestClient) -> None:
    assert "inside the work zone" in refused(client, work_start(at(0.0, 300.0)))
