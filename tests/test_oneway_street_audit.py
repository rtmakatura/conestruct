"""#308 — what a one-way street's shoulder plan says about itself.

The title, the audit's Case 11 and Note 8 rows, and the CHOSEN disclosure
(rulings R84, R88, R90, R91), read off ``POST /render/audit`` for the
North Broadway shape (primary, ``oneway=yes``, no same-name twin), with
no coordinates so no site scan runs.  The sources quoted are committed in
``validation-artifacts/committed/issue-308-oneway-read-as-divided/sources/``.
"""

from __future__ import annotations

import os
from dataclasses import replace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.rules.devices import DeviceType
from src.rules.validators import (
    DevicePlacement,
    ScenarioParams,
    scenario_display_name,
    validate_co_signs_both_sides,
)

AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}
ONE_WAY = {"oneway": "yes", "highwayClass": "primary", "twinSearched": True}


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def body(carriageway: dict[str, Any] | None = ONE_WAY, **over: Any) -> dict[str, Any]:
    b: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "s308", "address": "", "lat": 0.0, "lng": 0.0},
        "roadType": "urban_arterial",
        "speed": 30,
        "lanes": 4,
        "laneWidth": 11.0,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000.0,
        "night": False,
    }
    if carriageway is not None:
        b["carriageway"] = carriageway
    b.update(over)
    return b


def audit(client: TestClient, b: dict[str, Any]) -> dict[str, Any]:
    res = client.post("/render/audit", headers=AUTH, json=b)
    assert res.status_code == 200, res.text
    return res.json()


def note8(a: dict[str, Any]) -> dict[str, Any]:
    (row,) = [
        c
        for c in a["sections"]["colorado"]["checks"]
        if c["label"].startswith("Signs on both sides")
    ]
    return row


def _params(**over: Any) -> ScenarioParams:
    base = ScenarioParams(
        speed_mph=30,
        num_lanes=4,
        closure_type="shoulder",
        road_type="urban_low",
        work_zone_length_ft=1000.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
        one_way_street=True,
    )
    return replace(base, **over)


def test_the_title_names_a_one_way_street() -> None:
    assert scenario_display_name(_params()) == "Shoulder Closure · One-Way Street"


def test_a_two_way_undivided_title_is_unchanged() -> None:
    assert (
        scenario_display_name(_params(one_way_street=False))
        == "Shoulder Closure · 8-Lane Undivided"
    )


def test_case_11_says_one_way_street_and_cites_fig_6p_3(client: TestClient) -> None:
    case = audit(client, body())["sections"]["case"]
    assert case["case"] == "Case 11: Shoulder closure on one-way street"
    assert "one-way street" in case["narrative"]
    assert "General Note 8" in case["narrative"]
    assert "Fig. 6P-3 Note 1" in case["narrative"]
    assert "undivided" not in case["narrative"]


def test_the_taper_reference_says_one_way_street(client: TestClient) -> None:
    taper = audit(client, body())["sections"]["taper"]
    assert taper["cdot_reference"] == (
        "CDOT S-630-1 Case 11 (right-shoulder closure, applied to one-way street)"
    )


def test_note_8_row_names_the_one_way_street_and_its_exception(client: TestClient) -> None:
    row = note8(audit(client, body()))
    assert row["label"] == "Signs on both sides of one-way street"
    assert row["pass"] is True
    assert row["detail"].startswith(
        "Not required: one shoulder closed (Note 8's Case 11 exception)."
    )
    # R90: the figure note that says which side.
    assert "MUTCD 11th Ed. Fig. 6P-3 Note 1 (p. 864)" in row["detail"]
    assert "Signs placed: 0 left, 6 right." in row["detail"]


def test_note_8_row_on_a_denver_plan_names_what_was_read(client: TestClient) -> None:
    """R91: PT-116.1 and Rule 22.3 read; DOTI standards and details not."""
    detail = note8(audit(client, body(jurisdiction_key="denver")))["detail"]
    assert "Denver: DOTI PT-116.1 (2022) and Rule 22.3 (2022) read" in detail
    assert "DOTI standards and details not read" in detail


def test_note_8_row_off_denver_has_no_denver_sentence(client: TestClient) -> None:
    assert "Denver" not in note8(audit(client, body()))["detail"]


def test_the_chosen_widths_are_disclosed_as_pending(client: TestClient) -> None:
    """R88: the shoulder width and lane-width ceiling have no source."""
    pv = audit(client, body())["pending_verification"]
    (item,) = [i for i in pv.get("items", []) if i["kind"] == "one_way_street_widths_chosen"]
    assert "8 ft" in item["label"]
    assert "CHOSEN" in item["label"]
    assert "#308" in item["label"]


def test_a_two_way_plan_carries_none_of_it(client: TestClient) -> None:
    a = audit(client, body(None))
    assert a["sections"]["case"]["case"] == "Case 11: Shoulder closure on undivided highway"
    assert note8(a)["label"] == "Signs on both sides of divided highway"
    assert a["pending_verification"]["count"] == 0


def _crew(client: TestClient, b: dict[str, Any]) -> str:
    res = client.post("/render/markdown", headers=AUTH, json=b)
    assert res.status_code == 200, res.text
    return res.content.decode("utf-8")


def test_the_crew_sheet_measures_from_the_left_edge_not_a_centerline(client: TestClient) -> None:
    """A one-way street has no centerline: offset 0 is its left lane edge."""
    md = _crew(client, body())
    assert "from centerline" not in md
    assert "ft from the left edge of the roadway" in md
    assert "One-way street: signs go on the closed shoulder's side only" in md
    assert "Fig. 6P-3 Note 1" in md


def test_a_two_way_crew_sheet_still_says_centerline(client: TestClient) -> None:
    md = _crew(client, body(None))
    assert "ft from centerline" in md
    assert "One-way street" not in md


def _sign(offset: float) -> DevicePlacement:
    return DevicePlacement(
        device_type=DeviceType.SIGN_GENERIC, station_ft=-500.0, offset_ft=offset, label="W20-1"
    )


def test_note_8_validator_runs_on_a_one_way_lane_closure() -> None:
    """Note 8 names one-way streets: a lane closure there owes both sides."""
    params = _params(closure_type="lane")
    assert validate_co_signs_both_sides([_sign(15.0)], params)
    assert not validate_co_signs_both_sides([_sign(15.0), _sign(-15.0)], params)


def test_note_8_validator_exempts_a_one_way_shoulder_closure() -> None:
    assert not validate_co_signs_both_sides([_sign(15.0)], _params())
