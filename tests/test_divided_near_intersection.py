"""#312 (R134) — a near-intersection lane closure on a divided highway.

S-630-1 (July 2026) Sheet 2, General Note 8: "All warning and regulatory
signs shall be posted on both sides of the roadway on divided highways, ...".
R134 Q1 (a), #309's route: one carriageway of a divided road is a one-way
roadway whose left curb is the median edge, so the plan is #309's — all 8
mainline signs mirrored to the median side at -4.0 ft (Q2, CHOSEN) — with
the divided words: the title "· Divided Highway" (Q4), the Note 8 row's
divided label, the narrative, and the median-opening line in the audit's
pending items and the crew sheet (Q3).  Nothing is drawn for the opening.
Colorado Blvd at E Exposition Ave (39.70900, -104.94070), the #312 repro.
"""

from __future__ import annotations

import copy
import json
import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from src.api import render_api
from src.api.audit import MEDIAN_OPENING_PENDING
from src.api.schemas import Scenario
from src.generation.layout import ONE_WAY_LEFT_CURB_SIGN_OFFSET_FT
from src.rules import site_detection as sd
from src.rules.validators import DeviceType, scenario_display_name

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
MAINLINE_LABELS = ("W4-2R", "W20-5R", "W20-1", "R2-10", "G20-5P", "G20-1", "G20-2", "R2-11")
DIVIDED = {
    "oneway": "yes",
    "highwayClass": "primary",
    "twinDistanceM": 14.8,
    "twinSearched": True,
    "confirmed": None,
}
ONE_WAY = {**DIVIDED, "twinDistanceM": None}


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *a, **k: ({"elements": []}, None)
    )


@pytest.fixture()
def client() -> TestClient:
    return TestClient(render_api.app)


def body(carriageway: dict[str, Any] | None = DIVIDED, **over: Any) -> dict[str, Any]:
    leg = {
        "speed": 25,
        "roadType": "urban_arterial",
        "lanesPerDirection": 1,
        "laneWidth": 12,
        "signalized": True,
    }
    b: dict[str, Any] = {
        "kind": "near_intersection",
        "meta": {
            "project": "312",
            "address": "S Colorado Blvd",
            "lat": 39.709,
            "lng": -104.9407,
            "pinModel": "work_start",
            "work": {"side": "right", "heading": "N"},
            "intersection": {"lat": 39.71092, "lng": -104.9407, "name": "E Exposition Ave"},
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
        "approaches": [{"id": "cross_a", **leg}, {"id": "cross_b", **leg}],
        **over,
    }
    if carriageway is not None:
        b["carriageway"] = carriageway
    return b


def plan(b: dict[str, Any]):
    placements, params, *_ = render_api._placements_for(
        TypeAdapter(Scenario).validate_python(copy.deepcopy(b))
    )
    return placements, params


def mainline_signs(placements) -> list:
    return [
        p
        for p in placements
        if p.device_type == DeviceType.SIGN_GENERIC and p.approach_id == "mainline"
    ]


def audit(client: TestClient, b: dict[str, Any]) -> dict[str, Any]:
    r = client.post("/render/audit", headers=AUTH, json=b)
    assert r.status_code == 200, r.text[:300]
    return r.json()


def note8(a: dict[str, Any]) -> dict[str, Any]:
    return next(c for c in a["sections"]["colorado"]["checks"] if "both sides" in c["label"])


def pending(a: dict[str, Any]) -> list[dict[str, Any]]:
    pv = a.get("pending_verification") or {}
    return pv.get("items", []) if isinstance(pv, dict) else pv


# --- the plan --------------------------------------------------------------------


def test_the_divided_verdict_is_one_carriageway() -> None:
    _, params = plan(body())
    assert params.divided_carriageway is True
    assert params.one_way_street is True
    assert params.is_divided is False  # no median drawn, nothing re-spaced


def test_all_eight_mainline_signs_are_mirrored_to_the_median_side_at_minus_4() -> None:
    signs = mainline_signs(plan(body())[0])
    right = sorted((p.label, p.station_ft) for p in signs if p.offset_ft > 0)
    left = [p for p in signs if p.offset_ft < 0]
    assert sorted(lbl for lbl, _ in right) == sorted(MAINLINE_LABELS)
    assert sorted((p.label, p.station_ft) for p in left) == right
    # R134 Q2: -4.0 ft, CHOSEN, as #309.
    assert ONE_WAY_LEFT_CURB_SIGN_OFFSET_FT == 4.0
    assert {p.offset_ft for p in left} == {-ONE_WAY_LEFT_CURB_SIGN_OFFSET_FT}


def test_the_note_8_row_is_required_and_met(client: TestClient) -> None:
    row = note8(audit(client, body()))
    assert row["label"] == "Signs on both sides of divided highway"
    assert row["detail"] == "Required: True. Signs placed: 8 left, 8 right."
    assert row["pass"] is True


def test_the_title_says_divided_highway() -> None:
    assert (
        scenario_display_name(plan(body())[1]) == "Lane Closure Near Intersection · Divided Highway"
    )


def test_the_narrative_names_the_divided_highway(client: TestClient) -> None:
    text = json.dumps(audit(client, body()))
    assert "applied to one carriageway of a divided highway" in text
    assert "the median side included" in text
    assert "the divided highway's other carriageway, a separate roadway" in text
    assert "one-way street" not in text.replace("Signs on both sides of one-way street", "")


# --- the median opening (Q3) ---------------------------------------------------------


def test_the_median_opening_is_pending_verification(client: TestClient) -> None:
    items = pending(audit(client, body()))
    (item,) = [i for i in items if i["kind"] == "median_opening_unverified"]
    assert item["label"] == MEDIAN_OPENING_PENDING
    assert "Confirm the signing at the median opening" in item["label"]
    assert item["tracking_issue"].endswith("/issues/312")
    widths = next(i for i in items if i["kind"] == "one_way_street_widths_chosen")
    assert widths["label"].startswith("On one carriageway of a divided highway the plan builds")


def test_the_crew_sheet_asks_for_the_median_opening(client: TestClient) -> None:
    r = client.post("/render/markdown", headers=AUTH, json=body())
    assert r.status_code == 200, r.text[:300]
    md = r.text
    assert (
        "Divided highway: all warning and regulatory signs are posted on BOTH sides "
        "of this carriageway, the median side included" in md
    )
    assert (
        "Median opening: the plates don't draw the cross street's median opening. "
        "Confirm the signing at the median opening with the Engineer before setup."
    ) in md
    assert "both sides on a divided highway" in md
    assert "One-way street:" not in md


# --- nothing else moves --------------------------------------------------------------


def test_a_one_way_plan_carries_none_of_the_divided_words(client: TestClient) -> None:
    b = body(ONE_WAY)
    _, params = plan(b)
    assert params.divided_carriageway is False and params.one_way_street is True
    a = audit(client, b)
    assert note8(a)["label"] == "Signs on both sides of one-way street"
    assert not [i for i in pending(a) if i["kind"] == "median_opening_unverified"]
    assert scenario_display_name(params) == "Lane Closure Near Intersection · One-Way Street"
    md = client.post("/render/markdown", headers=AUTH, json=b).text
    assert "Median opening" not in md and "Divided highway: all warning" not in md


def test_a_two_way_plan_carries_none_of_the_divided_words(client: TestClient) -> None:
    b = body(None)
    placements, params = plan(b)
    assert not params.divided_carriageway and not params.one_way_street
    assert not [p for p in mainline_signs(placements) if p.offset_ft < 0]
    assert scenario_display_name(params) == "Lane Closure Near Intersection · Undivided"
    assert "median" not in json.dumps(audit(client, b)).lower()


def test_the_wire_s_own_divided_true_is_still_refused(client: TestClient) -> None:
    r = client.post("/render/audit", headers=AUTH, json=body(divided=True))
    assert r.status_code == 422
    # #378 R1: the refusal names the carriageway path instead of calling
    # divided roads unsupported.
    assert "divided must be false on a near-intersection plan" in r.text
    assert 'set carriageway.confirmed to \\"divided\\"' in r.text
    assert "aren't supported" not in r.text


def test_the_refusal_s_advice_builds_the_divided_plan(client: TestClient) -> None:
    # #378 R1: what the refusal says to send (divided false, the operator's
    # carriageway answer) gives #312's divided plan.
    b = body({"confirmed": "divided"})
    _, params = plan(b)
    assert params.divided_carriageway
    assert client.post("/render/audit", headers=AUTH, json=b).status_code == 200
