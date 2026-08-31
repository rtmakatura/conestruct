"""Tests for the ``/render/detect-site`` handler (#35).

The handler must build its response by spreading site_detection's return
into a fresh dict — never by grafting ``mode`` / ``corridor_unavailable_reason``
onto the inner dict in place.  In-place mutation is the pattern that blocked
TypedDict precision on the detector's return shape; the sentinel-unmutated
assertions here are the regression pin on that defect class.

All three handler paths are covered: corridor, corridor-build ValueError
fallback, and plain point mode.  Detectors are monkeypatched — no network.
"""

from __future__ import annotations

import copy
import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

_TEST_SECRET = "test-secret-do-not-deploy"


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    # The bearer-auth middleware fails closed if RENDER_API_SECRET is unset.
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture()
def client() -> TestClient:
    # Imported lazily so the secret above is set before the app is touched.
    from src.api.render_api import app

    return TestClient(app)


@pytest.fixture()
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_TEST_SECRET}"}


# A recognizable stand-in for the detector's bucketed return.  ``details``
# lists make it shape-faithful; ``junction_refs`` pins that unmodeled extras
# survive the boundary (the Rule-10 reason there is no response_model).
def _sentinel() -> dict[str, Any]:
    return {
        "intersections": {"detected": True, "count": 2, "details": ["a", "b"]},
        "interchanges": {
            "detected": False,
            "count": 0,
            "details": [],
            "junction_refs": [],
        },
        "road_curvature": {
            "detected": False,
            "count": 0,
            "details": ["Road curvature analysis not implemented; assume straight."],
        },
    }


_POINT_BODY = {"lat": 39.7113, "lng": -105.0815, "radius_m": 500}

# Adds the five corridor-triggering fields (corridor_ready in the handler).
_CORRIDOR_BODY = {
    **_POINT_BODY,
    "bearing_deg": 0.0,
    "speed_mph": 45,
    "work_zone_ft": 800.0,
    "closure_type": "shoulder",
    # TS-side vocabulary — _map_road_type translates it before build_corridor.
    "road_type": "urban_arterial",
}


def test_point_mode_spreads_and_does_not_mutate(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from src.api import render_api

    sentinel = _sentinel()
    before = copy.deepcopy(sentinel)
    monkeypatch.setattr(render_api, "detect_site_conditions", lambda *a, **k: sentinel)

    resp = client.post("/render/detect-site", json=_POINT_BODY, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == {**before, "mode": "point"}
    # The regression pin: the detector's return is not grafted onto.
    assert sentinel == before


def test_corridor_mode_spreads_and_does_not_mutate(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from src.api import render_api

    sentinel = _sentinel()
    before = copy.deepcopy(sentinel)
    monkeypatch.setattr(render_api, "build_corridor", lambda **k: object())
    monkeypatch.setattr(render_api, "detect_along_corridor", lambda c: sentinel)

    resp = client.post("/render/detect-site", json=_CORRIDOR_BODY, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == {**before, "mode": "corridor"}
    assert sentinel == before


def test_corridor_valueerror_falls_back_to_point_with_reason(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from src.api import render_api

    sentinel = _sentinel()
    before = copy.deepcopy(sentinel)

    def _boom(**_kwargs: Any) -> Any:
        raise ValueError("unknown closure_type: bogus")

    monkeypatch.setattr(render_api, "build_corridor", _boom)
    monkeypatch.setattr(render_api, "detect_site_conditions", lambda *a, **k: sentinel)

    resp = client.post("/render/detect-site", json=_CORRIDOR_BODY, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == {
        **before,
        "mode": "point",
        "corridor_unavailable_reason": "unknown closure_type: bogus",
    }
    assert sentinel == before


# ---------------------------------------------------------------------------
# #207 — the centerline relay into corridor-mode classification
# ---------------------------------------------------------------------------


def test_centerline_reaches_the_corridor(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from src.api import render_api

    seen: dict[str, Any] = {}

    def _capture(**kwargs: Any) -> object:
        seen.update(kwargs)
        return object()

    monkeypatch.setattr(render_api, "build_corridor", _capture)
    monkeypatch.setattr(render_api, "detect_along_corridor", lambda c: _sentinel())

    geometry = [[39.742, -105.239], [39.743, -105.24], [39.744, -105.241]]
    resp = client.post(
        "/render/detect-site",
        json={**_CORRIDOR_BODY, "centerline": geometry},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert seen["centerline"] == tuple((p[0], p[1]) for p in geometry)

    # Absent ⇒ None — the structural chord-compat path.
    seen.clear()
    resp = client.post("/render/detect-site", json=_CORRIDOR_BODY, headers=auth_headers)
    assert resp.status_code == 200
    assert seen["centerline"] is None


def test_mid_bend_feature_classifies_in_the_road_frame(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Payload-level (Rule 11): a traffic signal sitting ON the road
    mid-bend of the recorded Lookout Mountain centerline comes back
    ``work_zone``/relevant through the whole endpoint.  Pre-#207 the
    identical request classified it ``lateral`` (irrelevant) — the
    chord frame misfiled on-road features (22/24 stations on this
    fixture)."""
    import json as jsonlib
    from pathlib import Path

    from src.api import render_api
    from src.rules import site_detection
    from src.rules.corridor import build_corridor

    fixture = Path(__file__).parent / "fixtures" / "centerline" / "lookout_mountain_road.json"
    data = jsonlib.loads(fixture.read_text())
    centerline = [[p[0], p[1]] for p in data["centerline"]]

    body = {
        "lat": data["anchor"][0],
        "lng": data["anchor"][1],
        "radius_m": 500,
        "bearing_deg": data["bearing_deg"],
        "speed_mph": 40,
        "work_zone_ft": 800.0,
        "closure_type": "shoulder",
        "road_type": "urban_arterial",
        "centerline": centerline,
    }
    # The same corridor the handler builds (urban_arterial @ 40 mph maps
    # to urban_low) — used only to place the probe feature mid work zone.
    corridor = build_corridor(
        lat=data["anchor"][0],
        lng=data["anchor"][1],
        bearing_deg=data["bearing_deg"],
        speed_mph=40,
        work_zone_ft=800.0,
        closure_type="shoulder",
        road_type=render_api._map_road_type("urban_arterial", 40),
        centerline=tuple((p[0], p[1]) for p in data["centerline"]),
    )
    mid_wz = corridor.downstream_taper_ft + corridor.work_zone_ft / 2.0
    lat, lng = corridor.point_at_station_ft(mid_wz)

    payload = {
        "elements": [
            {
                "type": "node",
                "id": 1,
                "lat": lat,
                "lon": lng,
                "tags": {"highway": "traffic_signals"},
            }
        ]
    }
    monkeypatch.setattr(
        site_detection, "_overpass_request_with_fallback", lambda q: (payload, None)
    )

    resp = client.post("/render/detect-site", json=body, headers=auth_headers)
    assert resp.status_code == 200
    out = resp.json()
    assert out["mode"] == "corridor"
    feature = out["intersections"]["features"][0]
    assert feature["zone"] == "work_zone"
    assert feature["relevant"] is True
    assert feature["along_station_ft"] == pytest.approx(mid_wz, abs=2.0)
    assert out["intersections"]["detected"] is True


# ---------------------------------------------------------------------------
# #213 — the failure signal crosses this hop intact
# ---------------------------------------------------------------------------


def test_detector_error_key_passes_through(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Coverage pin (green at baseline): the endpoint's spread preserves
    the detector's ``error`` key, so an Overpass outage reaches the UI as
    a failure — never rebranded as a clean empty scan.  #224's in-generate
    scan will refuse on exactly this signal (ruling 2)."""
    from src.api import render_api

    failed = {**_sentinel(), "error": "overpass-api.de: ConnectError: connection refused"}
    monkeypatch.setattr(render_api, "detect_site_conditions", lambda *a, **k: failed)

    resp = client.post("/render/detect-site", json=_POINT_BODY, headers=auth_headers)
    assert resp.status_code == 200
    out = resp.json()
    assert out["mode"] == "point"
    assert "ConnectError" in out["error"]
