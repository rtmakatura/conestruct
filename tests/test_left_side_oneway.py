"""#300 — left-side shoulder work on a one-way street.

Rulings (``validation-artifacts/committed/issue-300-left-side-oneway/
rulings.md``): R79 shoulder only; R80 the left edge only on a confirmed
one-way street; R81 / R119 Q2 page 1 mirrored, CHOSEN; R82
``work_side``; R119 Q3 the Case 11 words and a pending item; R119 Q4 an
honest 400 naming the fix; R119 Q5 the verdict AND the one-way tag.

Tested where the bug lived (Rule 11): the wire (side options, the gate),
the payload (placements, audit, crew sheet) on N Broadway southbound
(``tests/fixtures/corridor/broadway-sb.json``, relayed as the site relays
a one-way candidate after #308), and page 1's drawing calls.
"""

from __future__ import annotations

import copy
import json
import os
from dataclasses import replace
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from src.api.render_api import app
from src.api.schemas import Scenario, left_side_built, scenario_to_call
from src.rendering import plan_sheet as ps
from src.rules import site_detection as sd
from src.rules.devices import DeviceType
from src.rules.validators import shoulder_closed_sign_code, validate_shoulder_warning_pair

AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}
BROADWAY = Path(__file__).parent / "fixtures" / "corridor" / "broadway-sb.json"
ONE_WAY_STREET = {
    "oneway": "yes",
    "highwayClass": "primary",
    "twinDistanceM": None,
    "twinSearched": True,
}


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


def broadway(side: str | None = None, **over: Any) -> dict[str, Any]:
    """N Broadway SB as the site relays it after #308 (a one-way street)."""
    b = json.loads(BROADWAY.read_text(encoding="utf-8"))
    meta = b["meta"]
    cand = meta["confirmedRoad"]["candidate"]
    meta["centerline"] = cand["geometry"]
    meta["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": "yes"}
    meta.pop("work", None)
    if side is not None:
        meta["work"] = {"side": side, "travel": "with_geometry"}
    b["carriageway"] = dict(ONE_WAY_STREET)
    b["divided"] = False
    b.update(over)
    return b


def parsed(body: dict[str, Any]) -> Any:
    return TypeAdapter(Scenario).validate_python(body)


def plan(body: dict[str, Any]):
    params, generator, kwargs = scenario_to_call(parsed(body))
    return params, generator(params, **kwargs)


def options(client: TestClient, body: dict[str, Any]) -> list[dict[str, Any]]:
    r = client.post("/render/corridor-geometry", headers=AUTH, json=body)
    assert r.status_code == 200, r.text
    return r.json()["side_options"]


# --- the wire: offered sides and the gate -------------------------------


def test_a_one_way_street_offers_both_curbs(client: TestClient) -> None:
    opts = options(client, broadway())
    assert [(o["label"], o["work"]) for o in opts] == [
        ("West side · southbound traffic", {"side": "right", "travel": "with_geometry"}),
        ("East side · southbound traffic", {"side": "left", "travel": "with_geometry"}),
    ]
    assert all(o["built"] for o in opts)


@pytest.mark.parametrize(
    ("label", "over"),
    [
        ("no carriageway facts", {"carriageway": None}),
        ("a divided carriageway", {"carriageway": {**ONE_WAY_STREET, "twinDistanceM": 40.0}}),
        ("undecided", {"carriageway": {**ONE_WAY_STREET, "twinSearched": False}}),
    ],
)
def test_left_is_not_offered_unless_the_road_is_a_one_way_street(
    client: TestClient, label: str, over: dict[str, Any]
) -> None:
    body = broadway()
    body.update(over)
    if body["carriageway"] is None:
        del body["carriageway"]
    assert [o["work"]["side"] for o in options(client, body)] == ["right"], label


def _refusal(client: TestClient, body: dict[str, Any]) -> str:
    r = client.post("/render/corridor-geometry", headers=AUTH, json=body)
    assert r.status_code == 400, r.text
    detail = r.json()["detail"]
    assert detail["error"] == "pin_model_input"
    return detail["message"]


@pytest.mark.parametrize(
    "label",
    ["divided", "no tag with an operator's answer", "near_intersection kind", "no facts"],
)
def test_a_left_side_the_gate_refuses_names_the_fix(client: TestClient, label: str) -> None:
    body = broadway("left")
    if label == "divided":
        body["carriageway"]["confirmed"] = "divided"
    elif label == "no tag with an operator's answer":
        # R119 Q5: the operator's answer returns from the verdict before the
        # tag is read, so the gate checks the tag itself.
        body["carriageway"]["confirmed"] = "one_way_street"
        body["meta"]["roadDirection"]["oneway"] = None
    elif label == "near_intersection kind":
        # R79: the same pin and left side, but a near-intersection plan.
        assert left_side_built(parsed(broadway("left"))) is True
        body = json.loads(
            (
                Path(__file__).parent / "fixtures" / "pdf_worst_case" / "adv-near-intersection.json"
            ).read_text(encoding="utf-8")
        )["scenario"]
        body["meta"].update(
            {k: copy.deepcopy(v) for k, v in broadway("left")["meta"].items() if k != "project"}
        )
        # A work-start plan's cross-street stations are the backend's, read
        # from the marked cross street (E 6th Ave, downstream on Broadway).
        for approach in body["approaches"]:
            approach.pop("alongStationFt", None)
        body["meta"]["intersection"] = {"lat": 39.7255, "lng": -104.98746, "name": "E 6th Ave"}
    else:
        del body["carriageway"]
    message = _refusal(client, body)
    assert "'left'" in message
    assert "shoulder work on a one-way street" in message
    assert "Choose the right side" in message


def test_median_is_still_named_and_refused(client: TestClient) -> None:
    assert "'median'" in _refusal(client, broadway("median"))


def test_left_lays_out_and_generates_on_broadway(client: TestClient) -> None:
    r = client.post("/render/corridor-geometry", headers=AUTH, json=broadway("left"))
    assert r.status_code == 200 and r.json()["status"] == "laid_out", r.text
    r = client.post("/render/pdf", headers=AUTH, json=broadway("left"))
    assert r.status_code == 200, r.text[:300]


# --- the payload --------------------------------------------------------


def test_a_left_plan_is_the_right_plan_measured_from_the_other_curb() -> None:
    right_params, right = plan(broadway("right"))
    left_params, left = plan(broadway("left"))
    assert (right_params.work_side, left_params.work_side) == ("right", "left")
    assert len(left) == len(right)
    swap = {"W21-5aR": "W21-5aL"}
    mirrored = [
        (p.device_type, p.station_ft, p.offset_ft, swap.get(p.label, p.label)) for p in right
    ]
    assert mirrored == [(p.device_type, p.station_ft, p.offset_ft, p.label) for p in left]
    assert any(p.label == "W21-5aL" for p in left)
    assert not any(p.label == "W21-5aR" for p in left)
    assert [p.label for p in left if p.device_type == DeviceType.ARROW_BOARD] == ["CAUTION"]


def test_the_freeway_pair_check_counts_the_work_sides_code() -> None:
    params, placements = plan(broadway("left", roadType="freeway", speed=55))
    assert params.road_type == "freeway"
    assert shoulder_closed_sign_code(params) == "W21-5aL"
    assert sum(1 for p in placements if p.label == "W21-5aL") == 2
    assert validate_shoulder_warning_pair(placements, params) == []
    # The same placements read as a right plan would be missing its pair.
    assert validate_shoulder_warning_pair(placements, replace(params, work_side="right"))


def _audit(client: TestClient, side: str) -> dict[str, Any]:
    r = client.post("/render/audit", headers=AUTH, json=broadway(side))
    assert r.status_code == 200, r.text
    return r.json()


def _note8(audit: dict[str, Any]) -> dict[str, Any]:
    for sec in audit["sections"].values():
        if not isinstance(sec, dict):
            continue
        for row in sec.get("checks") or sec.get("rows") or []:
            if isinstance(row, dict) and "both sides" in str(row.get("label", "")):
                return row
    raise AssertionError("no Note 8 row")


def test_the_audit_names_the_left_shoulder(client: TestClient) -> None:
    left, right = _audit(client, "left"), _audit(client, "right")
    assert "Signs placed: 6 left, 0 right." in _note8(left)["detail"]
    assert "Signs placed: 0 left, 6 right." in _note8(right)["detail"]
    assert left["sections"]["taper"]["cdot_reference"] == (
        "CDOT S-630-1 Case 11 (right-shoulder closure, mirrored to the left shoulder "
        "of a one-way street)"
    )
    left_kinds = [i["kind"] for i in left["pending_verification"]["items"]]
    right_kinds = [i["kind"] for i in right["pending_verification"]["items"]]
    assert "left_shoulder_mirrored" in left_kinds
    assert "left_shoulder_mirrored" not in right_kinds
    item = next(
        i for i in left["pending_verification"]["items"] if i["kind"] == "left_shoulder_mirrored"
    )
    assert "The mirror is CHOSEN." in item["label"]
    assert "§6H.22 ¶02, p. 807" in item["label"]
    assert item["tracking_issue"].endswith("/issues/300")


def test_the_crew_sheet_says_left_and_measures_from_the_right_edge(client: TestClient) -> None:
    md = client.post("/render/markdown", headers=AUTH, json=broadway("left")).text
    assert "left side of road 46 ft from the right edge of the roadway." in md
    assert "traffic cones along the left lane edge" in md
    assert "W21-5aL at 100 ft upstream of taper start (station 1,340 ft), left side." in md
    assert "Offsets are measured from the right edge of the roadway." in md
    assert "right side of road" not in md
    right = client.post("/render/markdown", headers=AUTH, json=broadway("right")).text
    assert "right side of road 46 ft from the left edge of the roadway." in right
    assert "Offsets are measured from the left edge of the roadway." in right


# --- page 1 (R81, R119 Q2) ----------------------------------------------


def _one_way_drawing(mirrored: bool) -> list[tuple[str, tuple[Any, ...]]]:
    canvas = MagicMock()
    token = ps._PAGE_MIRRORED.set(mirrored)
    try:
        ps._draw_one_way_street(canvas, 11.0, 8.0, "shoulder", 4)
    finally:
        ps._PAGE_MIRRORED.reset(token)
    return [(name, args) for name, args, _kw in canvas.method_calls]


def _stroked_lines(calls: list[tuple[str, tuple[Any, ...]]]) -> list[tuple[Any, float]]:
    color, out = None, []
    for name, args in calls:
        if name == "setStrokeColor":
            color = args[0]
        elif name == "line":
            out.append((color, args[1]))
    return out


@pytest.mark.parametrize("mirrored", [False, True])
def test_the_yellow_edge_is_the_top_lane_edge_either_way(mirrored: bool) -> None:
    lines = _stroked_lines(_one_way_drawing(mirrored))
    yellow = [y for c, y in lines if c == ps.MEDIAN_EDGE]
    assert len(yellow) == 1
    lane_h = 11.0 * ps.PTS_PER_OFFSET_FT
    work_lane_edge = ps.PLAN_Y_CENTER + (4 * lane_h if mirrored else -4 * lane_h)
    lane_edges = {round(ps.PLAN_Y_CENTER, 3), round(work_lane_edge, 3)}
    assert round(yellow[0], 3) == max(lane_edges)


def test_a_left_plan_draws_the_closed_shoulder_above_the_lanes() -> None:
    def closed_shoulder_y(mirrored: bool) -> float:
        calls = _one_way_drawing(mirrored)
        fill = None
        for name, args in calls:
            if name == "setFillColor":
                fill = args[0]
            elif name == "rect" and fill == ps.SHOULDER_CLOSED_FILL:
                return args[1]
        raise AssertionError("no closed shoulder")

    assert closed_shoulder_y(False) < ps.PLAN_Y_CENTER
    assert closed_shoulder_y(True) > ps.PLAN_Y_CENTER


def test_the_mirror_maps_the_frame_onto_itself_and_resets() -> None:
    token = ps._PAGE_MIRRORED.set(True)
    try:
        assert ps._ry(ps.PLAN_TOP) == pytest.approx(ps.PLAN_BOTTOM)
        assert ps._y_of(10.0) > ps.PLAN_Y_CENTER
        assert ps._side_is_down(-5.0) and not ps._side_is_down(5.0)
    finally:
        ps._PAGE_MIRRORED.reset(token)
    assert ps._y_of(10.0) < ps.PLAN_Y_CENTER
    assert ps._PAGE_MIRRORED.get() is False


def test_a_mirrored_dimension_label_hangs_below_its_line() -> None:
    canvas = MagicMock()
    canvas.stringWidth.return_value = 20.0
    ps._draw_dim(canvas, 100.0, 300.0, 200.0, "WORK ZONE = 1,000 ft", raise_tier=0, below=True)
    (_x, y_label, _t), _ = canvas.drawCentredString.call_args
    assert y_label < 200.0
