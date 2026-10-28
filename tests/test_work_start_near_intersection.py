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


# ---------------------------------------------------------------------------
# #399: the inside-the-work-zone refusal, at the Wadsworth/W 10th pin
# ---------------------------------------------------------------------------

# The geocoded `Wadsworth Blvd & W 10th Ave, Lakewood, CO` pin on way
# 427683596 (Wadsworth Boulevard northbound), as the #420 shots stub it.
WADSWORTH = (39.73296, -105.08131)


def wadsworth(cross_ft_north: float, pin: tuple[float, float] = WADSWORTH) -> dict[str, Any]:
    """Work starts at ``pin``, right side, northbound: the work runs north
    (downstream) from the pin.  The cross street is ``cross_ft_north`` ft
    north of the Wadsworth pin (negative: south)."""
    cross = _destination_point(*WADSWORTH, 0.0, cross_ft_north * M_PER_FT)
    meta = work_start(cross)
    meta.update({"lat": pin[0], "lng": pin[1]})
    return meta


def test_a_cross_street_at_the_work_start_pin_is_at_station_length() -> None:
    """The cause, confirmed: the layout frame's 0 is the work's DOWNSTREAM
    end, so the work-start pin (the work zone's upstream edge) sits at
    station L.  A cross street at the pin is at 500 on a 500 ft zone, and
    one marked 13 ft north (13 ft into the work) at 487: the issue's
    "length - 13" is the cross street's real place, in a frame the operator
    never sees."""
    from src.rules.corridor import build_corridor

    def layout_station(meta: dict[str, Any]) -> float:
        # The production formula (work_start_cross_station), read before
        # its refusal: the corridor laid from the work-start pin.
        parsed = TypeAdapter(Scenario).validate_python(body(meta))
        params, _gen, _kw = scenario_to_call(parsed, place_cross_street=False)
        assert params.bearing_deg is not None
        corridor = build_corridor(
            lat=parsed.meta.lat,
            lng=parsed.meta.lng,
            bearing_deg=params.bearing_deg,
            speed_mph=params.speed_mph,
            work_zone_ft=params.work_zone_length_ft,
            closure_type=params.closure_type,
            road_type=params.road_type,
            lane_width_ft=params.lane_width_ft,
            shoulder_width_ft=params.shoulder_width_ft,
            centerline=params.centerline,
            pin_model="work_start",
        )
        cross = parsed.meta.intersection
        assert cross is not None
        return corridor.along_station_ft(cross.lat, cross.lng) - corridor.downstream_taper_ft

    assert layout_station(wadsworth(0.0)) == pytest.approx(500.0, abs=1.0)
    assert layout_station(wadsworth(13.0)) == pytest.approx(487.0, abs=1.0)


def test_the_refusal_measures_from_the_work_start_pin(client: TestClient) -> None:
    message = refused(client, wadsworth(13.0))
    assert (
        "The marked cross street is inside the work zone, 13 ft past the pin where the work starts."
    ) in message
    assert "station" not in message
    assert "0..500" not in message


def test_a_cross_street_at_the_pin_reads_at_the_pin(client: TestClient) -> None:
    message = refused(client, wadsworth(0.0))
    assert "inside the work zone, at the pin where the work starts." in message


def test_the_refusal_names_both_moves(client: TestClient) -> None:
    """Each move clears the cross street and its pavement: 13 ft + the
    12 ft half-width forward, 487 + 12 back."""
    message = refused(client, wadsworth(13.0))
    assert (
        "Move that pin more than 25 ft with traffic, past the cross street, or more "
        "than 499 ft against traffic, so the work ends before it."
    ) in message
    assert "mark it again with Mark on map" in message


@pytest.mark.parametrize("pin_ft_north", [26.0, -500.0], ids=["forward-26", "back-500"])
def test_the_named_moves_clear_the_refusal(client: TestClient, pin_ft_north: float) -> None:
    """Following either move generates the plan: past the schema's 0..L
    check and the generator's curb-box check alike."""
    pin = _destination_point(*WADSWORTH, 0.0, pin_ft_north * M_PER_FT)
    res = client.post("/render/device-breakdown", headers=AUTH, json=body(wadsworth(13.0, pin)))
    assert res.status_code == 200, res.text[:300]


def test_too_far_names_the_move(client: TestClient) -> None:
    message = refused(client, wadsworth(21_000.0))
    assert "too far for a near-intersection plan" in message
    assert "Mark the cross street closest to the work with Mark on map." in message
    assert "within 20,000 ft" in message
