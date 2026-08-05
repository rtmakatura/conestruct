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
