"""#440 X3 — a tap on the WHERE band's ``pin`` picture becomes a coordinate.

The ``pin`` stage is centred on the pin at ``PIN_ZOOM`` + the zoom step
(``band_image_url``), so the backend maps the tap's pixel to lat/lng
(``static_aerial.pin_frame_point``) behind ``POST /render/aerial-point``.
Nothing is computed on the frontend (Rule 3).
"""

from __future__ import annotations

import os
import re
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from src.rendering import static_aerial as sa

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
# E Colfax Ave, Denver (memory.md's reference pin).
PIN = (39.73997, -104.96632)


def _forward(lat: float, lng: float, *, width: int, height: int, zoom: int) -> tuple[float, float]:
    """The pixel a coordinate lands on in the pin frame: the textbook Web
    Mercator forward projection, written out here (not the module's own) so
    the round trip checks the module against an independent formula."""
    import math

    scale = 512 * 2 ** (sa.PIN_ZOOM + zoom)

    def world(la: float, ln: float) -> tuple[float, float]:
        s = math.sin(math.radians(la))
        return (
            (ln + 180) / 360 * scale,
            (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * scale,
        )

    px, py = world(lat, lng)
    cx, cy = world(*PIN)
    return px - cx + width / 2, py - cy + height / 2


def test_the_centre_of_the_frame_is_the_pin() -> None:
    lat, lng = sa.pin_frame_point(*PIN, width=600, height=340, zoom=0, x=300, y=170)
    assert lat == pytest.approx(PIN[0], abs=1e-9)
    assert lng == pytest.approx(PIN[1], abs=1e-9)


@pytest.mark.parametrize("zoom", [-1, 0, 1, 3])
@pytest.mark.parametrize(("x", "y"), [(0, 0), (600, 340), (123.5, 301.25), (512, 17)])
def test_every_pixel_round_trips_through_the_forward_projection(
    zoom: int, x: float, y: float
) -> None:
    lat, lng = sa.pin_frame_point(*PIN, width=600, height=340, zoom=zoom, x=x, y=y)
    fx, fy = _forward(lat, lng, width=600, height=340, zoom=zoom)
    assert fx == pytest.approx(x, abs=1e-6)
    assert fy == pytest.approx(y, abs=1e-6)


def test_right_is_east_and_down_is_south() -> None:
    lat, lng = sa.pin_frame_point(*PIN, width=600, height=340, zoom=0, x=400, y=270)
    assert lng > PIN[1]
    assert lat < PIN[0]


def test_the_frame_is_the_one_the_band_draws() -> None:
    """The geometry is the ``pin`` URL's own: centred on the pin at PIN_ZOOM + step."""
    url, query = sa.band_image_url(*PIN, None, stage="pin", width=600, height=340, zoom=1)
    assert query == {}
    m = re.search(r"/(-?[\d.]+),(-?[\d.]+),(\d+),0/600x340@2x$", url)
    assert m is not None
    assert (float(m[2]), float(m[1]), int(m[3])) == (PIN[0], PIN[1], sa.PIN_ZOOM + 1)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"x": -1, "y": 10},
        {"x": 601, "y": 10},
        {"x": 10, "y": 341},
        {"x": 10, "y": 10, "zoom": 4},
        {"x": 10, "y": 10, "zoom": -2},
        {"x": 0, "y": 0, "width": 0},
    ],
)
def test_a_pixel_outside_the_frame_or_a_bad_step_is_refused(kwargs: dict[str, float]) -> None:
    args: dict[str, float] = {"width": 600, "height": 340, "zoom": 0, **kwargs}
    with pytest.raises(ValueError):
        sa.pin_frame_point(*PIN, **args)  # type: ignore[arg-type]


# ── the endpoint ──────────────────────────────────────────────────────────


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


BODY = {"lat": PIN[0], "lng": PIN[1], "width": 600, "height": 340, "x": 450, "y": 100}


def test_the_endpoint_answers_the_functions_coordinate(client: TestClient) -> None:
    res = client.post("/render/aerial-point", headers=AUTH, json={**BODY, "zoom": 1})
    assert res.status_code == 200, res.text[:400]
    lat, lng = sa.pin_frame_point(*PIN, width=600, height=340, zoom=1, x=450, y=100)
    assert res.json() == {"lat": lat, "lng": lng}


def test_the_zoom_step_defaults_to_zero(client: TestClient) -> None:
    res = client.post("/render/aerial-point", headers=AUTH, json=BODY)
    assert res.status_code == 200
    lat, lng = sa.pin_frame_point(*PIN, width=600, height=340, zoom=0, x=450, y=100)
    assert res.json() == {"lat": lat, "lng": lng}


@pytest.mark.parametrize(
    "override",
    [
        {"x": 601},
        {"y": 341},
        {"x": -1},
        {"width": 100},
        {"height": 2000},
        {"zoom": 4},
        {"lat": 91},
        {"lng": "east"},
        {"x": None},
    ],
)
def test_bad_input_answers_422(client: TestClient, override: dict[str, object]) -> None:
    res = client.post("/render/aerial-point", headers=AUTH, json={**BODY, **override})
    assert res.status_code == 422, res.text[:400]


def test_the_endpoint_needs_the_secret(client: TestClient) -> None:
    assert client.post("/render/aerial-point", json=BODY).status_code == 401
