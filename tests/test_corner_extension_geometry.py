"""#366 — the picker draws a corner plan's run past the work zone as the plan builds it.

A near-side plan whose closure runs to the corner
(``near_intersection_stations(...)["extend_to_corner"]``) places its last
cone on the cross street's upstream curb line, not the §6B.08 floor.  The
corridor reads had no layout, so they drew the 50 ft floor next to the
48 ft the audit, page 2 and the crew print.  Now they read the plan's
placements through the one layout call (#257, Rule 3).  Rule 11: the tests
read the served payloads.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

import src.api.render_api as render_api
from src.api.render_api import app
from src.api.schemas import Scenario, scenario_to_call
from src.rendering import static_aerial
from src.rules import site_detection as sd
from src.rules.corridor import _destination_point
from src.rules.corridor_layout import laid_out
from tests.test_lane_confidence_block import _ni_body

AUTH = {"Authorization": "Bearer test-secret"}
# E Colfax (memory.md reference pin), eastbound.
PIN = {"lat": 39.73997, "lng": -104.96632, "bearingDeg": 90.0}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    """The site scan and the band aerial's Mapbox fetch go to stubs."""
    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *a, **k: ({"elements": []}, None)
    )
    monkeypatch.setattr(
        render_api,
        "ENABLED_SCENARIOS",
        frozenset({"shoulder", "flagger_lane_closure", "near_intersection"}),
    )


@pytest.fixture()
def client():
    return TestClient(app)


def _pinned(**approach_overrides: Any) -> dict:
    body = _ni_body(**approach_overrides)
    return {**body, "meta": {**body["meta"], **PIN}}


def _work_start(cross_ft: float) -> dict:
    """Work-start pin, northbound, the cross street ``cross_ft`` north.

    The work is 700 ft, so 760 ft north is 60 ft past its downstream end:
    the issue's corner plan under the work-start model."""
    lat, lng = 39.7400, -104.9600
    cross = _destination_point(lat, lng, 0.0, cross_ft * 0.3048)
    body = _ni_body()
    body["approaches"][0].pop("alongStationFt")
    return {
        **body,
        "meta": {
            **body["meta"],
            "lat": lat,
            "lng": lng,
            "pinModel": "work_start",
            "work": {"side": "right", "heading": "N"},
            "intersection": {"lat": cross[0], "lng": cross[1], "name": "E 17th Ave"},
        },
    }


def _drawn_downstream(client: TestClient, body: dict) -> float:
    resp = client.post("/render/corridor-geometry", json=body, headers=AUTH)
    assert resp.status_code == 200
    geometry = resp.json()
    assert geometry["status"] == "laid_out"
    zones = {z["zone"]: z["length_ft"] for z in geometry["approaches"][0]["zones"]}
    return zones["downstream"]


def _spec(client: TestClient, body: dict) -> dict:
    resp = client.post("/render/audit", json=body, headers=AUTH)
    assert resp.status_code == 200
    return resp.json()["sections"]["corridor_spec"]


@pytest.mark.parametrize(
    ("along", "built"),
    [
        # The issue's plan: the upstream curb is 48 ft past the work zone,
        # short of the 50 ft floor.
        (-60.0, 48),
        # A run longer than the floor: still short of taper + setback, so
        # the closure runs on to the corner, 88 ft.
        (-100.0, 88),
    ],
)
def test_corner_plan_draws_the_run_it_builds(client, along, built):
    body = _pinned(alongStationFt=along)
    assert _spec(client, body)["corner_extension_ft"] == built
    assert _drawn_downstream(client, body) == built


def test_work_start_corner_plan_draws_the_run_it_builds(client):
    body = _work_start(cross_ft=760.0)
    spec = _spec(client, body)
    assert "corner_extension_ft" in spec, spec
    assert round(_drawn_downstream(client, body)) == spec["corner_extension_ft"]


@pytest.mark.parametrize("along", [-600.0, 800.0])
def test_midblock_and_far_side_plans_still_draw_the_floor(client, along):
    body = _pinned(alongStationFt=along)
    assert _spec(client, body)["downstream_taper_ft"] == 50
    assert _drawn_downstream(client, body) == 50.0


def test_the_band_aerial_draws_the_same_run(client, monkeypatch):
    """/render/corridor-map draws page 2's overlays from the same laid-out
    corridor, so its drawn path is the read's (R2)."""
    fetched: list[str] = []
    monkeypatch.setattr(
        render_api._static_aerial,
        "fetch_image",
        lambda url, query, token: fetched.append(url) or b"\x89PNG\r\n\x1a\n",
    )
    body = _work_start(cross_ft=760.0)
    resp = client.post(
        "/render/corridor-map",
        json={"scenario": body, "stage": "laid_out", "width": 640, "height": 400},
        headers=AUTH,
    )
    assert resp.status_code == 200

    # Page 2's path: the corridor laid out with the plan's placements.
    params, generator, kwargs = scenario_to_call(TypeAdapter(Scenario).validate_python(body))
    lat, lng = body["meta"]["lat"], body["meta"]["lng"]

    def url(placements: Any) -> str:
        _primary, approaches = laid_out(params, lat, lng, placements=placements)
        return static_aerial.band_image_url(
            lat, lng, approaches, stage="laid_out", width=640, height=400
        )[0]

    built = url(generator(params, **kwargs))
    assert built != url(None), "the corner run must differ from the floor here"
    assert fetched == [built]
