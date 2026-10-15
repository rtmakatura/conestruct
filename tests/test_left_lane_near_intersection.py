"""#323 (R145 self-ruled, checkpoint 3ad7d503): the left lane of a one-way
street, near side of an intersection.

Case 18 mirrored to the left lane: the same devices, stations and offsets as
the right plan (the offset model), the LEFT legends (§6H.07 ¶02, p. 805;
Fig. 6P-33 Note 1, p. 924), the arrow board pointing right, page 1 mirrored,
Note 8's signs on both curbs, and the mirror disclosed as CHOSEN.  The far
side (TA-23's turn bay, #323 Q1) is refused honestly.  N Broadway SB with
E 6th Ave marked downstream of the work (the near side).
"""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.api.schemas import left_side_built, scenario_to_call
from src.rendering.plan_sheet import render_plan_sheet
from src.rules import site_detection as sd
from src.rules.devices import DeviceType
from tests.test_left_side_oneway import AUTH, broadway, options, parsed, plan
from tests.test_pdf_containment import measure_containment


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(autouse=True)
def _no_overpass(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_kw: ({"elements": []}, None)
    )


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


NI_FIXTURE = Path(__file__).parent / "fixtures" / "pdf_worst_case" / "adv-near-intersection.json"
E_6TH = {"lat": 39.7255, "lng": -104.98746, "name": "E 6th Ave"}  # downstream: near side
# Upstream of the work on Broadway SB (north of the pin, past the 2,000 ft
# work zone): the far side.
UPSTREAM = {"lat": 39.7412, "lng": -104.98756, "name": "E 14th Ave"}


def ni(side: str, intersection: dict[str, Any] = E_6TH) -> dict[str, Any]:
    body = json.loads(NI_FIXTURE.read_text(encoding="utf-8"))["scenario"]
    body["meta"].update(
        {k: copy.deepcopy(v) for k, v in broadway(side)["meta"].items() if k != "project"}
    )
    # A work-start plan's cross-street stations are the backend's.
    for approach in body["approaches"]:
        approach.pop("alongStationFt", None)
    body["meta"]["intersection"] = dict(intersection)
    body["carriageway"] = copy.deepcopy(broadway(side)["carriageway"])
    return body


def signs(placements: list[Any]) -> list[tuple[str, float, float]]:
    return sorted(
        (p.label, p.station_ft, p.offset_ft)
        for p in placements
        if p.device_type == DeviceType.SIGN_GENERIC
    )


def test_the_left_lane_is_offered_near_an_intersection_on_a_one_way_street(
    client: TestClient,
) -> None:
    assert left_side_built(parsed(ni("left"))) is True
    sides = [o["work"]["side"] for o in options(client, ni(None))]  # type: ignore[arg-type]
    assert sides == ["right", "left"]


def test_a_two_way_road_offers_no_left_lane() -> None:
    body = ni("left")
    body["meta"]["roadDirection"]["oneway"] = None
    assert left_side_built(parsed(body)) is False


def test_the_left_plan_is_the_right_plan_with_left_legends() -> None:
    right_params, right = plan(ni("right"))
    left_params, left = plan(ni("left"))
    assert left_params.work_side == "left" and right_params.work_side == "right"
    to_left = {"W4-2R": "W4-2L", "W20-5R": "W20-5L"}
    # Every device at the same station and offset; only the lane legends
    # and the arrow change (the offset model).
    assert signs(left) == sorted((to_left.get(c, c), s, o) for c, s, o in signs(right))
    others = lambda ps: sorted(  # noqa: E731
        (p.device_type.value, p.station_ft, p.offset_ft)
        for p in ps
        if p.device_type not in (DeviceType.SIGN_GENERIC, DeviceType.ARROW_BOARD)
    )
    assert others(left) == others(right)
    arrows = [p.label for p in left if p.device_type == DeviceType.ARROW_BOARD]
    assert arrows == ["RIGHT_ARROW"]
    # Note 8: one-way street, signs on both curbs, on the left plan too.
    assert any(o < 0 for c, _s, o in signs(left) if c == "W20-5L")
    assert any(o > 0 for c, _s, o in signs(left) if c == "W20-5L")


def test_the_audit_names_the_left_lane_and_discloses_the_mirror(client: TestClient) -> None:
    r = client.post("/render/audit", headers=AUTH, json=ni("left"))
    assert r.status_code == 200, r.text[:300]
    a = r.json()
    text = json.dumps(a)
    assert "W20-5L" in text and "W4-2L" in text
    assert "W20-5R" not in text and "W4-2R" not in text
    assert "mirrored to the left lane of a one-way street" in text
    kinds = [i["kind"] for i in a["pending_verification"]["items"]]
    assert "left_lane_mirrored" in kinds and "left_shoulder_mirrored" not in kinds
    item = next(i for i in a["pending_verification"]["items"] if i["kind"] == "left_lane_mirrored")
    for cite in (
        "§6N.12 ¶08",
        "Fig. 6P-21 Note 1",
        "§6H.07 ¶02",
        "Fig. 6P-33 Note 1",
        "Note 8",
        "#323",
    ):
        assert cite in item["label"]


def test_the_crew_sheet_names_the_left_lane(client: TestClient) -> None:
    r = client.post("/render/markdown", headers=AUTH, json=ni("left"))
    assert r.status_code == 200, r.text[:300]
    md = r.text
    assert "centered in the closed left lane. Set to RIGHT ARROW mode (traffic merges right" in md
    assert "closing the left lane." in md
    assert "on the right curb at each location" in md
    assert "closed right lane" not in md and "LEFT ARROW" not in md
    assert "LEFTMOST lane" in md


def test_the_right_plans_crew_sheet_keeps_its_words(client: TestClient) -> None:
    r = client.post("/render/markdown", headers=AUTH, json=ni("right"))
    assert r.status_code == 200
    md = r.text
    assert "centered in the closed right lane. Set to LEFT ARROW mode (traffic merges left" in md
    assert "on the left curb at each location" in md


def test_page_1_draws_the_left_plan_inside_its_boxes(tmp_path: Path) -> None:
    params, placements = plan(ni("left"))
    _p, _g, kwargs = scenario_to_call(parsed(ni("left")))
    out = tmp_path / "left-lane.pdf"
    render_plan_sheet(placements, params, output_path=str(out), approaches=kwargs["approaches"])
    counts = {k: len(v) for k, v in measure_containment(str(out)).items()}
    assert counts == {k: 0 for k in counts}, counts


def test_the_far_side_without_a_bay_length_is_refused_and_names_the_field(
    client: TestClient,
) -> None:
    # #323 R153: the far side builds TA-23's turn bay once the operator
    # enters its storage length (tests/test_left_turn_bay_ta23.py).
    r = client.post("/render/pdf", headers=AUTH, json=ni("left", UPSTREAM))
    assert r.status_code == 400, r.text[:300]
    assert r.json()["detail"]["error"] == "turn_bay_storage_missing"
    assert "Enter the left-turn bay storage length under Cross street" in r.text


def test_the_far_side_on_the_right_still_builds(client: TestClient) -> None:
    r = client.post("/render/pdf", headers=AUTH, json=ni("right", UPSTREAM))
    assert r.status_code == 200, r.text[:300]


@pytest.mark.parametrize("route", ["/render/pdf", "/render/xlsx", "/render/crew-pdf"])
def test_every_deliverable_builds_the_left_lane(client: TestClient, route: str) -> None:
    r = client.post(route, headers=AUTH, json=ni("left"))
    assert r.status_code == 200, r.text[:300]
