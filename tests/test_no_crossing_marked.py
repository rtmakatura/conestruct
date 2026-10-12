"""#317 (R129) — a near-intersection plan with no crossing marked.

The two READ endpoints answer ``intersection_not_marked`` with one line
("Mark the cross street on the map to lay out the sides."), the side options
and the pin picture, instead of the model validator's 422.  Nothing is laid
out without the crossing, even with a side stored.  Every deliverable keeps
today's 422, byte for byte, and every other body reads as before.
"""

from __future__ import annotations

import copy
import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter, ValidationError

from src.api.schemas import READS_CROSSING_OPTIONAL, Scenario, intersection_not_marked
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
LINE = "Mark the cross street on the map to lay out the sides."
FIXTURES = Path(__file__).parent / "fixtures" / "corridor"

DELIVERABLES = (
    "/render/audit",
    "/render/audit-pdf",
    "/render/pdf",
    "/render/xlsx",
    "/render/markdown",
    "/render/crew-pdf",
    "/render/device-breakdown",
)


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    import src.api.render_api as ra

    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *a, **k: ({"elements": []}, None)
    )
    monkeypatch.setenv("MAPBOX_TOKEN", "test")
    monkeypatch.setattr(ra._static_aerial, "fetch_png", lambda *a, **k: b"\x89PNG-test")


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


def broadway(side: str | None = None, crossing: bool = False) -> dict[str, Any]:
    """N Broadway SB (the #317 repro), near-intersection, work-start."""
    bw = json.loads((FIXTURES / "broadway-sb.json").read_text(encoding="utf-8"))
    m = copy.deepcopy(bw["meta"])
    cand = m["confirmedRoad"]["candidate"]
    m["centerline"] = cand["geometry"]
    m["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": cand["tags"]["oneway"]}
    m["pinModel"] = "work_start"
    for k in ("work", "intersection", "bearingDeg"):
        m.pop(k, None)
    if side:
        m["work"] = {"side": side, "travel": "with_geometry"}
    if crossing:
        # E 11th Ave, ~350 ft south of the pin on the southbound road.
        m["intersection"] = {"lat": m["lat"] - 0.00096, "lng": m["lng"], "name": "E 11th Ave"}
    return {
        "kind": "near_intersection",
        "meta": m,
        "roadType": "urban_arterial",
        "speed": 30,
        "lanes": 2,
        "laneWidth": 12,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500,
        "night": False,
        "approaches": [
            {
                "id": "cross_a",
                "speed": 30,
                "roadType": "urban_arterial",
                "lanesPerDirection": 1,
                "laneWidth": 12,
                "signalized": False,
            }
        ],
    }


def geometry(client: TestClient, body: dict[str, Any]) -> Any:
    return client.post("/render/corridor-geometry", headers=AUTH, json=body)


def aerial(client: TestClient, body: dict[str, Any], stage: str) -> Any:
    return client.post(
        "/render/corridor-map",
        headers=AUTH,
        json={"scenario": body, "stage": stage, "width": 600, "height": 300},
    )


# --- the reads ---------------------------------------------------------------


@pytest.mark.parametrize("side", [None, "right"])
def test_the_geometry_read_asks_for_the_crossing(client: TestClient, side: str | None) -> None:
    res = geometry(client, broadway(side))
    assert res.status_code == 200, res.text[:300]
    j = res.json()
    assert j["status"] == "intersection_not_marked"
    assert j["message"] == LINE
    assert [o["label"] for o in j["side_options"]] == ["West side · southbound traffic"]
    # Nothing laid out without the crossing, even with a side stored.
    assert j["travel_bearing_deg"] is None
    assert j["work"] is None
    assert j["approaches"] == []
    assert j["coverage_ft"] is None
    assert "side_refused" not in j


@pytest.mark.parametrize("side", [None, "right"])
def test_the_aerial_shows_the_pin_and_holds_the_rest(client: TestClient, side: str | None) -> None:
    pin = aerial(client, broadway(side), "pin")
    assert pin.status_code == 200
    assert pin.headers["content-type"] == "image/png"
    for stage in ("work", "laid_out"):
        res = aerial(client, broadway(side), stage)
        assert res.status_code == 409, stage
        assert res.json() == {"status": "intersection_not_marked", "message": LINE}


def test_once_marked_the_sides_lay_out_as_today(client: TestClient) -> None:
    j = geometry(client, broadway(None, crossing=True)).json()
    assert j["status"] == "side_not_confirmed"
    assert j["message"] is None
    j = geometry(client, broadway("right", crossing=True)).json()
    assert j["status"] == "laid_out"
    assert aerial(client, broadway("right", crossing=True), "laid_out").status_code == 200


# --- the deliverables keep their refusal ---------------------------------------


@pytest.mark.parametrize("path", DELIVERABLES)
def test_every_deliverable_still_refuses(client: TestClient, path: str) -> None:
    res = client.post(path, headers=AUTH, json=broadway("right"))
    assert res.status_code == 422, (path, res.text[:200])
    (err,) = res.json()["detail"]
    assert err["loc"] == ["body", "near_intersection"]
    assert "needs meta.intersection" in err["msg"]


def test_the_validator_refuses_without_the_reads_context() -> None:
    adapter: TypeAdapter[Any] = TypeAdapter(Scenario)
    with pytest.raises(ValidationError, match="needs meta.intersection"):
        adapter.validate_python(broadway("right"))
    parsed = adapter.validate_python(broadway("right"), context=READS_CROSSING_OPTIONAL)
    assert intersection_not_marked(parsed)
    # Any other context is not the reads'.
    with pytest.raises(ValidationError, match="needs meta.intersection"):
        adapter.validate_python(broadway("right"), context={"reads": "other"})


# --- every other body reads as before -------------------------------------------


def test_a_bad_body_answers_the_reads_the_same_422_as_any_endpoint(client: TestClient) -> None:
    """The reads validate their own body; its errors are FastAPI's, byte for byte."""
    bad = broadway("right", crossing=True)
    bad["speed"] = 999
    bad["approaches"][0]["alongStationFt"] = 10.0  # the other station check, too
    expected = client.post("/render/audit", headers=AUTH, json=bad)
    assert expected.status_code == 422
    got = geometry(client, bad)
    assert got.status_code == 422
    assert got.content == expected.content


def test_a_bad_map_body_keeps_its_loc(client: TestClient) -> None:
    res = client.post(
        "/render/corridor-map",
        headers=AUTH,
        json={
            "scenario": broadway("right", crossing=True),
            "stage": "nope",
            "width": 600,
            "height": 300,
        },
    )
    assert res.status_code == 422
    assert [e["loc"] for e in res.json()["detail"]] == [["body", "stage"]]


def test_a_non_json_body_is_still_refused(client: TestClient) -> None:
    res = client.post(
        "/render/corridor-geometry",
        headers={**AUTH, "content-type": "application/json"},
        content=b"{not json",
    )
    assert res.status_code == 422
