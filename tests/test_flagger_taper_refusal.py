"""#375: a short flagger zone is refused against the taper it actually draws.

A flagger plan draws the one-lane, two-way taper (MUTCD 11th Ed. §6B.08 ¶14,
50-100 ft, no speed term), but ``WORK_ZONE_SHORTER_THAN_TAPER`` called every
non-shoulder taper "merging taper (L)" and told the user to lower the speed,
which can't shorten it.  Rule 11: the flagger assertions read the real
``/render/audit`` 400; the shoulder and near-intersection pins hold the old
wording byte-for-byte.
"""

from __future__ import annotations

import copy

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.rules.validators import ScenarioParams, validate_corridor_geometry
from tests.test_plan_sheet_device_summary import FLAGGER_BODY

AUTH = {"Authorization": "Bearer test-secret"}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


def _refusal(client: TestClient, body: dict, path: str = "/render/audit") -> dict:
    resp = client.post(path, json=body, headers=AUTH)
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert detail["error"] == "geometry_validation_failed"
    return detail


def _taper_message(detail: dict) -> str:
    return next(
        v["message"] for v in detail["violations"] if v["rule_id"] == "WORK_ZONE_SHORTER_THAN_TAPER"
    )


@pytest.mark.parametrize("speed", [25, 45])
def test_flagger_refusal_names_the_one_lane_two_way_taper(client: TestClient, speed: int) -> None:
    body = copy.deepcopy(FLAGGER_BODY)
    body["speed"] = speed
    body["workLen"] = 50.0
    detail = _refusal(client, body)
    expected = (
        "Work zone length (50 ft) is shorter than the 100 ft one-lane, two-way "
        "taper this flagger plan draws. Increase the work zone to at least 100 ft."
    )
    assert _taper_message(detail) == expected
    assert detail["message"] == expected
    assert "merging" not in detail["message"]
    assert "mph" not in detail["message"]
    assert "speed" not in detail["message"]
    # The PDF refuses with the same body.
    assert _refusal(client, body, "/render/pdf") == detail


def test_flagger_zone_at_the_taper_builds(client: TestClient) -> None:
    body = copy.deepcopy(FLAGGER_BODY)
    body["workLen"] = 100.0
    resp = client.post("/render/audit", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text


def test_shoulder_and_merging_refusals_unchanged() -> None:
    shoulder = ScenarioParams(
        speed_mph=75,
        num_lanes=2,
        closure_type="shoulder",
        work_zone_length_ft=200.0,
        is_divided=True,
        jurisdiction="CDOT",
        road_type="freeway",
        shoulder_width_ft=10.0,
        lane_width_ft=12.0,
    )
    lane = ScenarioParams(
        speed_mph=45,
        num_lanes=4,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=400.0,
        is_divided=False,
        jurisdiction="CDOT",
        lane_width_ft=12.0,
    )
    msgs = {
        p.closure_type: next(
            v.message
            for v in validate_corridor_geometry(p)
            if v.rule_id == "WORK_ZONE_SHORTER_THAN_TAPER"
        )
        for p in (shoulder, lane)
    }
    assert msgs["shoulder"] == (
        "Work zone length (200 ft) is shorter than the required shoulder taper "
        "(L/3) of 250 ft at 75 mph. Increase the work zone to at least 250 ft, "
        "or reduce the speed limit."
    )
    assert msgs["lane"] == (
        "Work zone length (400 ft) is shorter than the required merging taper "
        "(L) of 540 ft at 45 mph. Increase the work zone to at least 540 ft, "
        "or reduce the speed limit."
    )
