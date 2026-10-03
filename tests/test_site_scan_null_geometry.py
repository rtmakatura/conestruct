"""#304 -- an Overpass answer with a point-less road point never takes the plan down.

The real case (validation-artifacts/committed/issue-304-scan-null-geometry/):
for #243's Federal pin, the fallback mirror overpass.openstreetmap.fr
answers with one extra road way -- 42125193, a street in Pavlodar,
Kazakhstan -- whose geometry holds two null points.  The primary mirror's
answer to the same query has no such way; the scan halves are identical.

Every test here replays the real captures in tests/fixtures/site_scan/
(federal.meta.json says where each came from).  Overpass is never reached.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from src.api import site_scan as ss
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
FIXTURES = Path(__file__).parent / "fixtures" / "site_scan"
FALLBACK = json.loads((FIXTURES / "federal_fallback_null_points.json").read_text("utf-8"))
PRIMARY = json.loads((FIXTURES / "federal_primary.json").read_text("utf-8"))
REQUEST = json.loads((FIXTURES / "federal_request.json").read_text("utf-8"))["scenario"]
STRAY = 42125193
PIN = (REQUEST["meta"]["lat"], REQUEST["meta"]["lng"])


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _fresh_memo() -> Iterator[None]:
    ss.clear_memo()
    yield
    ss.clear_memo()


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app, raise_server_exceptions=False)


def _audit(client: TestClient, monkeypatch: pytest.MonkeyPatch, payload: Any) -> Any:
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda q, **_k: (payload, None))
    return client.post(
        "/render/audit", json=REQUEST, headers={"Authorization": f"Bearer {_TEST_SECRET}"}
    )


def _way(way_id: int, points: list[Any], **tags: str) -> dict[str, Any]:
    return {"type": "way", "id": way_id, "tags": {"highway": "primary", **tags}, "geometry": points}


# --------------------------------------------------------------------------- #
# (a) a point without coordinates is not a point
# --------------------------------------------------------------------------- #


def test_the_fixtures_are_what_they_say() -> None:
    def nulls(p: dict[str, Any]) -> dict[int, list[int]]:
        return {
            e["id"]: [i for i, x in enumerate(e["geometry"]) if x is None]
            for e in p["elements"]
            if e.get("geometry") and any(x is None for x in e["geometry"])
        }

    assert nulls(FALLBACK) == {STRAY: [15, 39]}
    assert nulls(PRIMARY) == {}


def test_bearing_skips_segments_with_a_pointless_end() -> None:
    lat, lng = 39.7342, -105.0250
    good = [{"lat": lat - 0.001, "lon": lng}, {"lat": lat + 0.001, "lon": lng}]
    ways = [
        _way(1, [good[0], None, good[1]]),  # null point between two good ones
        _way(2, [{"lat": lat}, {"lon": lng}]),  # partial points only
        _way(3, ["not a point", {"lat": None, "lon": None}]),
    ]
    out = sd._bearing_from_elements(ways, lat, lng)
    # Way 1's only segments both touch the null point, so nothing is usable.
    assert out["bearing_deg"] is None
    assert out["points_skipped"] == 5

    ways.append(_way(4, good))
    out = sd._bearing_from_elements(ways, lat, lng)
    assert out["way_id"] == 4
    assert out["bearing_deg"] == pytest.approx(0.0, abs=0.01)
    assert out["points_skipped"] == 5


def test_complete_geometry_counts_nothing_skipped() -> None:
    out = sd._bearing_from_elements(PRIMARY["elements"], *PIN)
    assert out["bearing_deg"] is not None
    assert out["points_skipped"] == 0


def test_the_fallback_answer_renders_a_plan(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The issue's regression: the empty-point response gives a 200 plan."""
    r = _audit(client, monkeypatch, FALLBACK)
    assert r.status_code == 200, r.text[:300]
    assert r.json()["sections"]["site_scan"]["status"] == "ok"


# --------------------------------------------------------------------------- #
# (d) an element outside its own query box is dropped (R60)
# --------------------------------------------------------------------------- #

_VOLATILE = {"measured_at", "duration_ms"}


def _scan_view(audit: dict[str, Any]) -> dict[str, Any]:
    scan = {k: v for k, v in audit["sections"]["site_scan"].items() if k not in _VOLATILE}
    return {**audit, "sections": {**audit["sections"], "site_scan": scan}}


def test_the_stray_way_is_dropped_and_the_plan_matches_the_primary(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """R60's proof, on the real fallback capture: the Kazakh way is dropped,
    and the whole audit equals the primary mirror's (clock fields aside)."""
    fallback = _audit(client, monkeypatch, FALLBACK)
    ss.clear_memo()
    primary = _audit(client, monkeypatch, PRIMARY)
    assert fallback.status_code == primary.status_code == 200
    assert _scan_view(fallback.json()) == _scan_view(primary.json())


# --------------------------------------------------------------------------- #
# #292 (R74): the race takes the first valid answer with content, and #304's
# checks clean it, so the real fallback capture wins when it answers first.
# --------------------------------------------------------------------------- #

_FETCH_SPECIFIC = {"mirror", "response_bytes"}  # which server answered, and its byte count


def _race_audit(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, fast: str, answers: dict[str, Any]
) -> Any:
    """The audit with ``_mirror_post`` replaying ``answers`` per mirror URL:
    ``fast`` answers at once, every other mirror 0.3 s later."""

    async def mirror_post(_client: Any, url: str, _query: str, _timeout: Any) -> httpx.Response:
        if url != fast:
            await asyncio.sleep(0.3)
        return httpx.Response(200, json=answers[url], request=httpx.Request("POST", url))

    monkeypatch.setattr(sd, "_mirror_post", mirror_post)
    return client.post(
        "/render/audit", json=REQUEST, headers={"Authorization": f"Bearer {_TEST_SECRET}"}
    )


def _without_fetch_specifics(audit: dict[str, Any]) -> dict[str, Any]:
    view = _scan_view(audit)
    scan = {k: v for k, v in view["sections"]["site_scan"].items() if k not in _FETCH_SPECIFIC}
    return {**view, "sections": {**view["sections"], "site_scan": scan}}


def test_the_real_fallback_capture_wins_the_race_and_matches_the_primary(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """R74's proof on the real Federal captures (#304).  The fallback
    mirror's answer, with the Kazakh way and its null points, answers first.
    It is valid (200, JSON, no remark) and has content after cleaning, so it
    wins; cleaning drops way 42125193; and the audit equals the one the
    primary's capture gives when the primary wins, except for which server
    answered and its byte count."""
    de, fr = sd.OVERPASS_MIRRORS
    answers = {de: PRIMARY, fr: FALLBACK}
    dropped: list[int] = []
    real_bearing = sd._bearing_from_elements

    def spy(*args: Any, **kwargs: Any) -> dict[str, Any]:
        out = real_bearing(*args, **kwargs)
        dropped.append(out.get("elements_dropped", 0))
        return out

    monkeypatch.setattr(sd, "_bearing_from_elements", spy)

    fallback_won = _race_audit(client, monkeypatch, fr, answers)
    assert fallback_won.status_code == 200, fallback_won.text[:300]
    assert fallback_won.json()["sections"]["site_scan"]["mirror"] == fr
    assert dropped == [1]  # 42125193, the one road way outside the circle

    ss.clear_memo()
    dropped.clear()
    primary_won = _race_audit(client, monkeypatch, de, answers)
    assert primary_won.status_code == 200, primary_won.text[:300]
    assert primary_won.json()["sections"]["site_scan"]["mirror"] == de
    assert dropped == [0]

    assert _without_fetch_specifics(fallback_won.json()) == _without_fetch_specifics(
        primary_won.json()
    )


def test_road_ways_outside_the_around_circle_are_dropped_and_counted() -> None:
    lat, lng, r = *PIN, 50.0
    road = [e for e in FALLBACK["elements"] if e.get("geometry")]
    out = sd._bearing_from_elements(road, lat, lng, radius_m=r)
    assert out["elements_dropped"] == 1  # 42125193, 14,137 km away
    ref = sd._bearing_from_elements(
        [e for e in PRIMARY["elements"] if e.get("geometry")], lat, lng, radius_m=r
    )
    assert ref["elements_dropped"] == 0
    for key in ("bearing_deg", "oneway", "way_id", "highway"):
        assert out[key] == ref[key]


def test_scan_elements_far_outside_the_box_are_dropped_and_counted() -> None:
    box = (39.726, -105.027, 39.739, -105.023)
    near = {"type": "way", "id": 1, "center": {"lat": 39.7405, "lon": -105.025}}  # ~170 m out
    node_in = {"type": "node", "id": 2, "lat": 39.73, "lon": -105.025}
    far = {"type": "way", "id": 3, "center": {"lat": 52.29, "lon": 76.95}}
    no_coord = {"type": "way", "id": 4}
    kept, dropped = sd._within_scan_boxes([near, node_in, far, no_coord], [box])
    assert [e["id"] for e in kept] == [1, 2, 4]
    assert dropped == 1


def test_the_measured_answers_lose_no_scan_element() -> None:
    """Every scan element of both real Federal answers is kept (the largest
    legitimate gap measured is 227 m; probes/query-boxes.txt)."""
    probes = (
        Path(__file__).parents[1] / "validation-artifacts/committed/issue-304-scan-null-geometry"
    )
    q = (probes / "probes/out/federal-folded-query.txt").read_text("utf-8")
    m = re.search(r"node\(([-\d.,]+)\)", q)
    assert m is not None
    box = tuple(float(x) for x in m.group(1).split(","))
    for payload in (PRIMARY, FALLBACK):
        scan = [e for e in payload["elements"] if not e.get("geometry")]
        kept, dropped = sd._within_scan_boxes(scan, [box])
        assert dropped == 0 and len(kept) == 257


# --------------------------------------------------------------------------- #
# (b) the scan never raises: any fault is its own "unavailable" state
# --------------------------------------------------------------------------- #


def _boom(*_a: Any, **_k: Any) -> Any:
    raise RuntimeError("a parse fault nobody foresaw")


def test_a_scan_fault_is_the_honest_refusal_not_a_500(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ss, "detect_along_corridor", _boom)
    r = client.post(
        "/render/audit", json=REQUEST, headers={"Authorization": f"Bearer {_TEST_SECRET}"}
    )
    assert r.status_code == 400, r.text[:300]
    detail = r.json()["detail"]
    assert detail["error"] == "site_scan_unavailable"
    assert detail["site_scan"]["status"] == "unavailable"
    assert "RuntimeError: a parse fault nobody foresaw" in detail["site_scan"]["error"]
    assert detail["recovery"]["proceed_field"] == "site_scan.proceed_if_unavailable"
    assert ss._MEMO == {}  # a fault is never memoised


def test_generate_anyway_after_a_scan_fault_renders_with_the_disclosure(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ss, "detect_along_corridor", _boom)
    body = {**REQUEST, "site_scan": {"proceed_if_unavailable": True}}
    r = client.post("/render/audit", json=body, headers={"Authorization": f"Bearer {_TEST_SECRET}"})
    assert r.status_code == 200, r.text[:300]
    scan = r.json()["sections"]["site_scan"]
    assert scan["status"] == "unavailable"
    assert scan["proceeded_anyway"] is True
    assert scan["disclosure"] == ss.NOT_CHECKED_DISCLOSURE


# --------------------------------------------------------------------------- #
# (c) the scan half's coordinate reader: present-but-null is no coordinate
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "el",
    [
        {"type": "node", "lat": None, "lon": None},
        {"type": "node", "lat": 39.7, "lon": None},
        {"type": "way", "center": {"lat": None, "lon": -105.0}},
        {"type": "way", "center": None},
        {"type": "way", "lat": "39.7", "lon": "-105.0"},
    ],
)
def test_element_coord_reads_no_coordinate_as_none(el: dict[str, Any]) -> None:
    assert sd._element_coord(el) is None


def test_element_coord_still_reads_real_coordinates() -> None:
    assert sd._element_coord({"lat": 39.7, "lon": -105.0}) == (39.7, -105.0)
    assert sd._element_coord({"center": {"lat": 39.7, "lon": -105.0}}) == (39.7, -105.0)
