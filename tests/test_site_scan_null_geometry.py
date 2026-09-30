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

import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

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
