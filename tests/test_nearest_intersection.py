"""#285: the nearest named cross street at pin time.

The pick replays Overpass answers recorded 2026-10-14
(tests/fixtures/nearest_intersection/, rec285.py) on real roads; the
endpoint tests stub the helper.  Every status but ``found`` leaves the tag
on the ruled interim (Rule 10), and a marked cross pin answers without a
query (#234).
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.rules import site_detection as sd
from src.rules.corridor import _destination_point
from src.rules.nearest_intersection import (
    AT_THRESHOLD_FT,
    FETCH_RADIUS_M,
    build_query,
    from_overpass,
    nearest_intersection,
)

FIX = Path(__file__).parent / "fixtures" / "nearest_intersection"
_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}


def replay(name: str):
    d = json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))
    ((key, value),) = d["road"].items()
    return from_overpass(
        d["overpass"], tuple(d["pin"]), [tuple(p) for p in d["centerline"]], key, value
    )


# ── the pick, on recorded answers ─────────────────────────────────────────


def test_broadway_names_11th_avenue_south_of_it() -> None:
    a = replay("broadway")
    assert a.status == "found"
    assert a.cross_street == "East 11th Avenue"
    assert a.direction == "S"
    assert a.offset_ft == 50
    assert a.text == "50 ft S of East 11th Avenue"
    assert a.source == "osm_shared_node"
    assert a.osm_node_id == 3397108608
    assert a.provenance_text == "cross street from OSM node 3397108608 · searched 1,700 m"


def test_a_concurrency_carrying_the_road_is_the_road_not_the_cross_street() -> None:
    # The US 24 node is shared with "CO 9" and with "US 24;CO 9"; the
    # second carries US 24 itself and is never named as the cross street.
    a = replay("us24_hartsel")
    assert a.status == "found"
    assert a.cross_street == "CO 9"
    assert a.text == "270 ft E of CO 9"


def test_the_rural_case_only_1700_m_reaches() -> None:
    a = replay("us287_lamar")
    assert a.status == "found"
    assert a.text == "3,030 ft E of County Road 7"


def test_a_canyon_with_no_cross_street_answers_none() -> None:
    a = replay("boulder_canyon")
    assert a.status == "none"
    assert a.text is None


def test_a_cross_street_off_the_relayed_centerline_is_not_named() -> None:
    # Bonvue Drive meets Lookout Mountain Road 592 m off the stretch the
    # picker relays (its own centerline fixture): no along-road offset, so
    # no cross street.
    rec = json.loads((FIX / "lookout.json").read_text(encoding="utf-8"))
    picker = json.loads(
        (FIX.parent / "centerline" / "lookout_mountain_road.json").read_text(encoding="utf-8")
    )["centerline"]
    a = from_overpass(
        rec["overpass"],
        tuple(rec["pin"]),
        [tuple(p) for p in picker],
        "name",
        "Lookout Mountain Road",
    )
    assert a.status == "none"
    assert a.text is None


def test_the_query_asks_1700_m_by_the_road_key() -> None:
    q = build_query(39.7337, -104.98753, "name", 'O"Brien Road')
    assert FETCH_RADIUS_M == 1700
    assert "around:1700,39.7337,-104.98753" in q
    assert '["name"="O\\"Brien Road"]' in q
    assert build_query(38.1, -102.6, "ref", "US 287").count('["ref"="US 287"]') == 1


# ── the read's other answers ──────────────────────────────────────────────

PIN = (39.7400, -104.9600)
LINE = [_destination_point(*PIN, 180.0, 400.0), _destination_point(*PIN, 0.0, 400.0)]


def test_no_centerline_is_not_applicable_and_asks_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda *a, **k: pytest.fail("asked"))
    a = nearest_intersection(pin=PIN, centerline=None, road_name="Main St", road_ref=None)
    assert a.status == "not_applicable"
    assert a.text is None


def test_no_road_key_is_not_applicable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda *a, **k: pytest.fail("asked"))
    a = nearest_intersection(pin=PIN, centerline=LINE, road_name=None, road_ref=None)
    assert a.status == "not_applicable"


def test_a_refused_query_is_unavailable_with_no_words(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *a, **k: (None, "504 from every mirror")
    )
    a = nearest_intersection(pin=PIN, centerline=LINE, road_name="Main St", road_ref=None)
    assert a.status == "unavailable"
    assert a.text is None
    assert a.reason == "504 from every mirror"


def test_the_ref_is_the_key_when_the_road_has_no_name(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[str] = []
    monkeypatch.setattr(
        sd,
        "_overpass_request_with_fallback",
        lambda q, **k: (seen.append(q), ({"elements": []}, None))[1],
    )
    nearest_intersection(pin=PIN, centerline=LINE, road_name=None, road_ref="US 287")
    assert '["ref"="US 287"]' in seen[0]


def test_a_marked_cross_pin_answers_without_a_query(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda *a, **k: pytest.fail("asked"))
    cross = _destination_point(*PIN, 0.0, 64.0)  # 210 ft north of the pin
    a = nearest_intersection(
        pin=PIN,
        centerline=LINE,
        road_name="N Downing St",
        road_ref=None,
        marked_cross=cross,
        marked_cross_name="E 17th Ave",
    )
    assert a.status == "found"
    assert a.source == "marked_cross_pin"
    assert a.text == "210 ft S of E 17th Ave"


def test_under_the_threshold_the_work_starts_at_the_cross_street(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda *a, **k: pytest.fail("asked"))
    cross = _destination_point(*PIN, 0.0, (AT_THRESHOLD_FT - 10) * 0.3048)
    a = nearest_intersection(
        pin=PIN,
        centerline=LINE,
        road_name="N Downing St",
        road_ref=None,
        marked_cross=cross,
        marked_cross_name="E 17th Ave",
    )
    assert a.text == "at E 17th Ave"


# ── the endpoint ──────────────────────────────────────────────────────────


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


def shoulder(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "shoulder",
        "meta": {"project": "s285", "address": "", "lat": PIN[0], "lng": PIN[1], **meta},
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


WORK_START = {
    "pinModel": "work_start",
    "centerline": [list(p) for p in LINE],
    "roadName": "N Downing St",
}


def ask(client: TestClient, body: dict[str, Any]) -> dict[str, Any]:
    res = client.post("/render/nearest-intersection", headers=AUTH, json=body)
    assert res.status_code == 200, res.text[:400]
    return res.json()


def test_the_endpoint_answers_found_from_the_shared_node(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    node = _destination_point(*PIN, 180.0, 64.0)
    answer = {
        "elements": [
            {
                "type": "way",
                "id": 1,
                "nodes": [7],
                "tags": {"highway": "residential", "name": "E 16th Ave"},
            },
            {"type": "node", "id": 7, "lat": node[0], "lon": node[1]},
        ]
    }
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda *a, **k: (answer, None))
    out = ask(client, shoulder(WORK_START))
    assert out["status"] == "found"
    assert out["text"] == "210 ft N of E 16th Ave"
    assert out["radius_m"] == 1700


def test_the_endpoint_is_not_applicable_on_a_corridor_end_pin(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda *a, **k: pytest.fail("asked"))
    out = ask(
        client, shoulder({"centerline": WORK_START["centerline"], "roadName": "N Downing St"})
    )
    assert out["status"] == "not_applicable"
    assert out["text"] is None


def test_the_endpoint_reports_unavailable(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda *a, **k: (None, "timeout"))
    out = ask(client, shoulder(WORK_START))
    assert out["status"] == "unavailable"
    assert out["text"] is None


def test_the_endpoint_names_the_marked_cross_pin_on_a_near_intersection_plan(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda *a, **k: pytest.fail("asked"))
    cross = _destination_point(*PIN, 0.0, 64.0)
    body = {
        "kind": "near_intersection",
        "meta": {
            "project": "s285",
            "address": "",
            "lat": PIN[0],
            "lng": PIN[1],
            **WORK_START,
            "intersection": {"lat": cross[0], "lng": cross[1], "name": "E 17th Ave"},
        },
        "roadType": "urban_arterial",
        "speed": 35,
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
    out = ask(client, body)
    assert out["status"] == "found"
    assert out["source"] == "marked_cross_pin"
    assert out["text"] == "210 ft S of E 17th Ave"
