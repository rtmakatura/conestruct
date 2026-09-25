"""#290 — ``POST /render/corridor-geometry``: each approach's geometry, from the backend.

Ruling 7: "each approach's geometry returned by the backend, never sent on
the request."  The picker's overlay will draw from this response instead of
walking the pin along a bearing on the frontend (Rule 3).  Asserted on the
response the overlay would draw (Rule 11): where the work segment starts
and runs, which side of it each approach's zones lie on, how many
approaches a kind has, and what is returned before the side is confirmed
(nothing directional — rule 112).
"""

from __future__ import annotations

import math
import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.rules import site_detection as sd
from src.rules.corridor import _destination_point, _haversine_m, _initial_bearing_deg

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
PIN = (39.7400, -104.9600)
M_PER_FT = 0.3048


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    calls: list[int] = []

    def stub(*_a: Any, **_kw: Any) -> tuple[dict[str, Any], None]:
        calls.append(1)
        return {"elements": []}, None

    monkeypatch.setattr(sd, "_overpass_request_with_fallback", stub)
    return calls


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


def shoulder(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "shoulder",
        "meta": {"project": "s290", "address": "", "lat": PIN[0], "lng": PIN[1], **meta},
        "roadType": "urban_arterial",
        "speed": 35,
        "lanes": 2,
        "laneWidth": 12,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
    }


def flagger(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "flagger_lane_closure",
        "meta": {"project": "s290", "address": "", "lat": PIN[0], "lng": PIN[1], **meta},
        "roadType": "rural_undivided",
        "speed": 45,
        "laneWidth": 11.0,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
        "pilotCar": False,
        "afad": False,
        "pedestrianAccess": False,
    }


NORTHBOUND = {"pinModel": "work_start", "work": {"side": "right", "heading": "N"}}


def geometry(client: TestClient, body: dict[str, Any]) -> dict[str, Any]:
    res = client.post("/render/corridor-geometry", headers=AUTH, json=body)
    assert res.status_code == 200, res.text[:400]
    return res.json()


def ft(a: list[float] | tuple[float, float], b: list[float] | tuple[float, float]) -> float:
    return _haversine_m(a[0], a[1], b[0], b[1]) / M_PER_FT


def compass(a: list[float] | tuple[float, float], b: list[float] | tuple[float, float]) -> float:
    return _initial_bearing_deg(a[0], a[1], b[0], b[1])


def zone(approach: dict[str, Any], name: str) -> dict[str, Any]:
    return next(z for z in approach["zones"] if z["zone"] == name)


def test_the_work_runs_from_the_pin_and_the_approach_lies_upstream(
    client: TestClient, _no_network: list[int]
) -> None:
    g = geometry(client, shoulder(NORTHBOUND))
    assert g["status"] == "laid_out"
    assert g["pin_model"] == "work_start"
    assert g["travel_bearing_deg"] == 0.0
    work = g["work"]["points"]
    # Upstream edge on the pin, running 1,000 ft north with traffic.
    assert ft(work[-1], PIN) < 0.1
    assert ft(work[0], PIN) == pytest.approx(1000.0, abs=0.5)
    (primary,) = g["approaches"]
    assert primary["id"] == "primary"
    assert primary["travel_bearing_deg"] == pytest.approx(0.0, abs=0.01)
    advance = zone(primary, "advance_warning")["points"]
    # The first sign is the far end of the advance-warning zone: south.
    first_sign = advance[-1]
    assert abs(((compass(PIN, first_sign) - 180.0 + 540) % 360) - 180) < 0.1
    assert {z["zone"] for z in primary["zones"]} == {
        "downstream",
        "buffer",
        "transition",
        "advance_warning",
    }
    assert _no_network == [], "a geometry read never scans"


def test_the_flagger_returns_an_approach_at_each_end(client: TestClient) -> None:
    """Ruling 9: the pin is the closed lane's upstream end; the opposing
    traffic's approach lies beyond the work's far end, 500 ft north."""
    g = geometry(client, flagger(NORTHBOUND))
    primary, opposing = g["approaches"]
    assert (primary["id"], opposing["id"]) == ("primary", "opposing")
    assert opposing["travel_bearing_deg"] == pytest.approx(180.0, abs=0.01)
    far_end = _destination_point(*PIN, 0.0, 500.0 * M_PER_FT)
    opposing_first_sign = zone(opposing, "advance_warning")["points"][-1]
    assert abs(((compass(far_end, opposing_first_sign) - 0.0 + 540) % 360) - 180) < 0.1
    primary_first_sign = zone(primary, "advance_warning")["points"][-1]
    assert abs(((compass(PIN, primary_first_sign) - 180.0 + 540) % 360) - 180) < 0.1


def test_on_a_curve_the_paths_follow_the_road(client: TestClient) -> None:
    center, radius_m = (39.75, -105.0), 1500.0 * M_PER_FT
    road = [list(_destination_point(*center, t, radius_m)) for t in range(0, 271)]
    pin = _destination_point(*center, 135.0, radius_m)
    body = shoulder(
        {
            "pinModel": "work_start",
            "lat": pin[0],
            "lng": pin[1],
            "centerline": road,
            "work": {"side": "right", "travel": "with_geometry"},
        }
    )
    g = geometry(client, body)
    work = g["work"]["points"]
    assert len(work) > 2, "a curved work zone carries the road's vertices"
    for p in work:
        r = _haversine_m(center[0], center[1], p[0], p[1])
        assert r == pytest.approx(radius_m, abs=1.0)
    end_expected = _destination_point(*center, 135.0 + math.degrees(1000.0 / 1500.0), radius_m)
    assert ft(work[0], end_expected) < 3.0


@pytest.mark.parametrize(
    ("meta", "status"),
    [
        ({"pinModel": "work_start"}, "side_not_confirmed"),
        ({"pinModel": "work_start", "lat": 0.0, "lng": 0.0}, "no_pin"),
        ({}, "no_bearing"),
    ],
)
def test_nothing_directional_without_a_direction(
    client: TestClient, meta: dict[str, Any], status: str
) -> None:
    g = geometry(client, shoulder(meta))
    assert g["status"] == status
    assert g["work"] is None and g["approaches"] == []
    assert g["travel_bearing_deg"] is None


def test_corridor_end_is_laid_as_it_always_was(client: TestClient) -> None:
    """The old reading, served honestly: the pin is the corridor's end and
    the sent bearing points at the first sign; direction of travel is its
    reciprocal."""
    g = geometry(client, shoulder({"bearingDeg": 0.0}))
    assert g["pin_model"] == "corridor_end"
    assert g["travel_bearing_deg"] == 180.0
    first_sign = zone(g["approaches"][0], "advance_warning")["points"][-1]
    assert abs(((compass(PIN, first_sign) - 0.0 + 540) % 360) - 180) < 0.1


def test_the_preview_flag_is_refused_like_everywhere_else(client: TestClient) -> None:
    body = {**shoulder(NORTHBOUND), "preview": True}
    res = client.post("/render/corridor-geometry", headers=AUTH, json=body)
    assert res.status_code == 400
    assert "preview" in res.text.lower()
