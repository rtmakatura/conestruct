"""#447: a NEEDS YOU question's map, through the real route.

Authority: validation-artifacts/committed/ux-site-map/rulings.md.  Mapbox and
Overpass are the only fakes; the frame, the overlays and the headers are the
route's own.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from src.rendering import static_aerial as sa
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
FIXTURES = Path(__file__).parent / "fixtures" / "corridor"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 16


def fixture(name: str = "broadway-sb") -> dict[str, Any]:
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


def pin(scenario: dict[str, Any]) -> tuple[float, float]:
    return scenario["meta"]["lat"], scenario["meta"]["lng"]


def footway(lat: float, lng: float, *, span: float = 0.0004) -> dict[str, Any]:
    """A way beside the pin, as ``out geom tags`` answers it."""
    return {
        "type": "way",
        "tags": {"highway": "footway"},
        "bounds": {},
        "geometry": [
            {"lat": lat - span / 2, "lon": lng + 0.00005},
            {"lat": lat, "lon": lng + 0.00005},
            {"lat": lat + span / 2, "lon": lng + 0.00005},
        ],
    }


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _clean_memo() -> None:
    sd.clear_subject_memo()


@pytest.fixture()
def overpass(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    state: dict[str, Any] = {"answer": ({"elements": []}, None), "queries": [], "budgets": []}

    def request(query: str, budget_s: float | None = None, **_kw: Any) -> Any:
        state["queries"].append(query)
        state["budgets"].append(budget_s)
        return state["answer"]

    monkeypatch.setattr(sd, "_overpass_request_with_fallback", request)
    return state


class _Png:
    content = PNG

    def raise_for_status(self) -> None:
        return None


@pytest.fixture()
def mapbox(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    requests: list[dict[str, Any]] = []
    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")

    def get(url: str, params: dict[str, str] | None = None, **_kw: Any) -> _Png:
        requests.append({"url": url, "params": dict(params or {})})
        return _Png()

    monkeypatch.setattr(httpx, "get", get)
    return requests


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


def ask(client: TestClient, scenario: dict[str, Any], flag: str = "pedestrian_facility", **kw: Any):
    body = {"scenario": scenario, "flag": flag, "width": 800, "height": 400, **kw}
    return client.post("/render/needs-you-map", headers=AUTH, json=body)


def view(url: str) -> tuple[float, float, float]:
    m = re.search(r"/(-?[\d.]+),(-?[\d.]+),([\d.]+),0/800x400@2x$", url)
    assert m, url
    return float(m.group(2)), float(m.group(1)), float(m.group(3))


def test_the_work_is_solid_and_the_subject_dashed_and_framed_on_it(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    overpass["answer"] = ({"elements": [footway(lat, lng)]}, None)

    r = ask(client, scenario)

    assert r.status_code == 200
    assert r.headers["x-map-subject"] == "drawn"
    url = mapbox[0]["url"]
    assert url.count("+FF8A2E-") >= 1
    assert url.count("path-3+3FD3A8-1(") > 2, "a dash is its own path (X2)"
    assert "pin-s" not in url
    # Ruling 2: centred on the sidewalk, not on the corridor.
    c_lat, c_lng, _z = view(url)
    assert c_lat == pytest.approx(lat, abs=1e-4)
    assert c_lng == pytest.approx(lng + 0.00005, abs=1e-4)
    # Ruling 5: the question's point is on the subject.
    p_lat, p_lng = (float(v) for v in r.headers["x-map-point"].split(","))
    assert p_lat == pytest.approx(lat, abs=1e-5)
    assert p_lng == pytest.approx(lng + 0.00005, abs=1e-5)
    # X1: the map's own read, for the line the scan leaves out.
    assert "out geom tags" in overpass["queries"][0]
    assert overpass["budgets"] == [sd.SUBJECT_BUDGET_S]


def test_a_zoom_step_steps_the_frame_and_does_not_ask_overpass_again(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    overpass["answer"] = ({"elements": [footway(*pin(scenario))]}, None)
    ask(client, scenario)
    ask(client, scenario, zoom=1)
    z0 = view(mapbox[0]["url"])[2]
    z1 = view(mapbox[1]["url"])[2]
    assert z1 == pytest.approx(z0 + 1, abs=0.01)
    assert len(overpass["queries"]) == 1


def test_a_node_subject_is_a_ring_at_the_capped_zoom(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    node = {"type": "node", "lat": lat, "lon": lng, "tags": {"highway": "traffic_signals"}}
    overpass["answer"] = ({"elements": [node]}, None)

    r = ask(client, scenario, flag="adjacent_intersection")

    assert r.headers["x-map-subject"] == "drawn"
    url = mapbox[0]["url"]
    assert url.count("path-3+3FD3A8-1(") == sa.RING_DASHES
    assert view(url)[2] == pytest.approx(sa.SUBJECT_MAX_ZOOM)


def test_the_intersection_question_draws_one_ring_on_the_nearest_crossing(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    """Phone fix round: one ring, at every width, however many the road has."""
    scenario = fixture()
    lat, lng = pin(scenario)

    def crossing(north: float) -> dict[str, Any]:
        tags = {"highway": "crossing"}
        return {"type": "node", "lat": lat + north, "lon": lng, "tags": tags}

    # The nearest is not the first in the answer.
    elements = [crossing(0.0003), crossing(0.00005), crossing(0.0002)]
    overpass["answer"] = ({"elements": elements}, None)

    r = ask(client, scenario, flag="adjacent_intersection")

    url = mapbox[0]["url"]
    assert url.count("path-3+3FD3A8-1(") == sa.RING_DASHES
    c_lat, _c_lng, _z = view(url)
    assert c_lat == pytest.approx(lat + 0.00005, abs=1e-5)
    p_lat = float(r.headers["x-map-point"].split(",")[0])
    assert p_lat == pytest.approx(lat + 0.00005, abs=1e-5)


def test_other_questions_still_draw_every_feature(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    overpass["answer"] = ({"elements": [footway(lat, lng), footway(lat, lng + 0.0001)]}, None)
    ask(client, scenario)
    one = mapbox[0]["url"].count("path-3+3FD3A8-1(")
    sd.clear_subject_memo()
    overpass["answer"] = ({"elements": [footway(lat, lng)]}, None)
    ask(client, scenario)
    assert one > mapbox[1]["url"].count("path-3+3FD3A8-1(")


@pytest.mark.parametrize(
    "answer", [({"elements": []}, None), (None, "all mirrors failed")], ids=["none", "down"]
)
def test_no_geometry_draws_no_line_and_shows_the_work_zone(
    client: TestClient,
    mapbox: list[dict[str, Any]],
    overpass: dict[str, Any],
    answer: tuple[Any, Any],
) -> None:
    overpass["answer"] = answer
    r = ask(client, fixture())
    assert r.status_code == 200
    assert r.headers["x-map-subject"] == "none"
    url = mapbox[0]["url"]
    assert "3FD3A8" not in url
    assert url.count("+FF8A2E-") >= 1


def test_a_failed_read_is_not_remembered(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    overpass["answer"] = (None, "down")
    ask(client, scenario)
    overpass["answer"] = ({"elements": [footway(*pin(scenario))]}, None)
    assert ask(client, scenario).headers["x-map-subject"] == "drawn"
    assert len(mapbox) == 2


def test_what_the_scan_would_not_count_is_not_drawn(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    far = footway(lat + 0.05, lng + 0.05)
    other_bucket = {
        "type": "way",
        "tags": {"highway": "cycleway"},
        "geometry": footway(lat, lng)["geometry"],
    }
    overpass["answer"] = ({"elements": [far, other_bucket]}, None)
    r = ask(client, scenario)
    assert r.headers["x-map-subject"] == "none"
    assert "3FD3A8" not in mapbox[0]["url"]


def test_a_malformed_answer_costs_the_line_not_the_picture(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    overpass["answer"] = ({"elements": ["not a dict"]}, None)
    r = ask(client, fixture())
    assert r.status_code == 200
    assert r.headers["x-map-subject"] == "none"


def test_the_url_stays_under_the_cap_and_the_nearest_stay(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    many = [footway(lat + i * 0.00002, lng, span=0.004) for i in range(30)]
    overpass["answer"] = ({"elements": many}, None)
    r = ask(client, scenario)
    assert r.headers["x-map-subject"] == "drawn"
    assert len(mapbox[0]["url"]) < sa.URL_MAX_CHARS


def test_an_unlaid_plan_gets_the_pin_picture_and_no_lines(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    scenario["meta"].pop("work")
    lat, lng = pin(scenario)
    r = ask(client, scenario)
    assert r.status_code == 200
    assert r.headers["x-map-subject"] == "none"
    assert r.headers["x-map-point"] == f"{lat:.6f},{lng:.6f}"
    assert "path-" not in mapbox[0]["url"]
    assert overpass["queries"] == []


def test_refusals_answer_json_like_the_band(
    client: TestClient,
    mapbox: list[dict[str, Any]],
    overpass: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    no_pin = fixture()
    no_pin["meta"]["lat"] = 0
    r = ask(client, no_pin)
    assert (r.status_code, r.json()["status"]) == (409, "no_pin")

    assert ask(client, fixture(), flag="not_a_question").status_code == 422
    assert ask(client, fixture(), zoom=4).status_code == 422

    def boom(*_a: Any, **_kw: Any) -> None:
        raise httpx.ConnectError("no route")

    monkeypatch.setattr(httpx, "get", boom)
    r = ask(client, fixture())
    assert (r.status_code, r.json()["status"]) == (502, "unavailable")

    monkeypatch.setenv("MAPBOX_TOKEN", "")
    r = ask(client, fixture())
    assert (r.status_code, r.json()["status"]) == (503, "unavailable")


@pytest.mark.parametrize(
    ("bucket", "tags"),
    [
        ("intersections", {"highway": "traffic_signals"}),
        ("intersections", {"highway": "crossing"}),
        ("sidewalks", {"highway": "footway"}),
        ("sidewalks", {"footway": "sidewalk"}),
        ("bike_facilities", {"highway": "cycleway"}),
        ("bike_facilities", {"cycleway": "lane"}),
        ("schools", {"amenity": "school"}),
        ("interchanges", {"highway": "motorway_junction"}),
        ("interchanges", {"highway": "motorway_link"}),
        ("interchanges", {"highway": "trunk_link"}),
        ("interchanges", {"bridge": "yes"}),
    ],
)
def test_each_questions_selectors_are_the_scans_own(bucket: str, tags: dict[str, str]) -> None:
    assert sd._categorize({"tags": tags}) == bucket
    key, value = next(iter(tags.items()))
    selectors = sd._SUBJECT_SELECTORS[bucket]
    assert set(selectors) <= set(sd._SCAN_SELECTORS)
    wanted = f'["{key}"="{value}"]'
    assert any(wanted in s or f'["{key}"];' in s for s in selectors)


def test_the_token_stays_on_the_backend(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    r = ask(client, fixture())
    assert "test-token" not in json.dumps(dict(r.headers))
    assert mapbox[0]["params"] == {"access_token": "test-token"}


# #483 ruling 1: the soft image is the full image's frame, from the same
# backend frame (Rule 3).  rulings.md R145-1, R145-2.


def soft_view(url: str) -> tuple[float, float, float]:
    """The soft image's centre and zoom: @1x, the same CSS size, nothing drawn."""
    m = re.search(r"/static/(-?[\d.]+),(-?[\d.]+),([\d.]+),0/800x400$", url)
    assert m, url
    return float(m.group(2)), float(m.group(1)), float(m.group(3))


def frame_of(r: Any) -> tuple[float, float, float]:
    lat, lng, z = (float(v) for v in r.headers["x-map-frame"].split(","))
    return lat, lng, z


@pytest.mark.parametrize("flag", ["pedestrian_facility", "adjacent_intersection"])
def test_483_the_soft_image_is_the_full_images_frame_with_nothing_drawn(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any], flag: str
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    node = {"type": "node", "lat": lat, "lon": lng, "tags": {"highway": "traffic_signals"}}
    subject = footway(lat, lng) if flag == "pedestrian_facility" else node
    overpass["answer"] = ({"elements": [subject]}, None)

    soft = ask(client, scenario, flag=flag, soft=True)
    full = ask(client, scenario, flag=flag)

    assert (soft.status_code, full.status_code) == (200, 200)
    assert soft.headers["x-map-frame"] == full.headers["x-map-frame"]
    soft_url, full_url = mapbox[0]["url"], mapbox[1]["url"]
    assert soft_view(soft_url) == pytest.approx(view(full_url), abs=1e-6)
    assert frame_of(full) == pytest.approx(view(full_url), abs=1e-6)
    assert "path-" not in soft_url and "pin-" not in soft_url and "@2x" not in soft_url
    # R145-3: one Overpass read for both, the full one reuses the memo.
    assert len(overpass["queries"]) == 1
    # The soft image says nothing about what was drawn on it.
    assert soft.headers["x-map-subject"] == "none"


def test_483_the_pin_picture_soft_is_the_pins_frame(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    scenario["meta"].pop("work")
    lat, lng = pin(scenario)
    soft = ask(client, scenario, soft=True)
    full = ask(client, scenario)
    assert soft.headers["x-map-frame"] == full.headers["x-map-frame"]
    assert frame_of(full) == pytest.approx((lat, lng, sa.PIN_ZOOM), abs=1e-6)
    assert soft_view(mapbox[0]["url"]) == pytest.approx((lat, lng, sa.PIN_ZOOM), abs=1e-6)
    assert "pin-" in mapbox[1]["url"] and "pin-" not in mapbox[0]["url"]


def test_483_the_full_image_is_unchanged_by_the_soft_one(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    overpass["answer"] = ({"elements": [footway(*pin(scenario))]}, None)
    ask(client, scenario)
    sd.clear_subject_memo()
    ask(client, scenario, soft=True)
    ask(client, scenario, soft=False)
    assert mapbox[2] == mapbox[0]


def test_483_soft_must_be_a_boolean(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    assert ask(client, fixture(), soft="yes please").status_code == 422
