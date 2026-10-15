"""#323 R153: the left lane's far side, MUTCD TA-23's left-turn bay.

N Broadway SB (one-way) with E 14th Ave marked before the work: the taper
closes the left lane before the intersection, a 100 ft opening (Fig. 6P-23,
p. 905), then lane-line channelizers run the bay's storage length, which
the operator enters (Note 5, p. 904; no default), to the upstream curb.
R3-7L stands on the island and the far curb at the taper end.  Rulings and
the self-ruled choices: validation-artifacts/committed/issue-323-far-side/.
"""

from __future__ import annotations

import os
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.api.schemas import scenario_to_call
from src.generation.layout import ONE_WAY_LEFT_CURB_SIGN_OFFSET_FT, near_intersection_stations
from src.rendering.plan_sheet import render_plan_sheet
from src.rules import site_detection as sd
from src.rules.devices import DeviceType
from tests.test_left_lane_near_intersection import E_6TH, UPSTREAM, ni
from tests.test_left_side_oneway import AUTH, parsed
from tests.test_pdf_containment import measure_containment

STORAGE = 300.0


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


def bay_body(storage: float | None = STORAGE, side: str = "left") -> dict[str, Any]:
    body = ni(side, UPSTREAM)
    if storage is not None:
        body["turnBayStorageFt"] = storage
    return body


def layout(body: dict[str, Any]) -> tuple[Any, list[Any], dict[str, Any]]:
    params, gen, kwargs = scenario_to_call(parsed(body))
    return params, gen(params, **kwargs), near_intersection_stations(params, kwargs["approaches"])


def test_the_refusal_names_the_missing_field(client: TestClient) -> None:
    for route in ("/render/pdf", "/render/audit", "/render/markdown"):
        r = client.post(route, headers=AUTH, json=bay_body(None))
        assert r.status_code == 400, (route, r.text[:200])
        detail = r.json()["detail"]
        assert detail["error"] == "turn_bay_storage_missing"
        assert "left-turn bay storage length" in detail["message"]


def test_the_field_is_bounded_with_no_default(client: TestClient) -> None:
    for bad in (0, -50, 20001):
        r = client.post("/render/pdf", headers=AUTH, json=bay_body(bad))
        assert r.status_code == 422, (bad, r.status_code)
    assert parsed(ni("left", UPSTREAM)).turnBayStorageFt is None


def test_the_bay_runs_the_entered_storage_after_a_100_ft_opening() -> None:
    _params, placements, st = layout(bay_body())
    bay = st["turn_bay"]
    assert bay["storage_ft"] == STORAGE
    assert bay["bay_end"] == st["upstream_curb"]
    assert bay["bay_start"] == st["upstream_curb"] + STORAGE
    # On this site the buffer doesn't reach past the bay, so the opening is
    # TA-23's 100 ft exactly.
    assert bay["opening_ft"] == 100.0
    assert st["taper_end"] == bay["bay_start"] + 100.0
    cones = sorted(
        p.station_ft
        for p in placements
        if p.device_type == DeviceType.CONE and p.station_ft > st["downstream_curb"]
    )
    assert cones[0] == bay["bay_end"] and cones[-1] == bay["bay_start"]
    # Nothing in the opening, and nothing between the bay and the taper.
    assert not [
        p
        for p in placements
        if p.device_type in (DeviceType.CONE, DeviceType.DRUM)
        and bay["bay_start"] < p.station_ft < st["taper_end"]
    ]


def test_the_r3_7l_pair_stands_on_the_island_and_the_far_curb() -> None:
    _params, placements, st = layout(bay_body())
    pair = sorted((p.station_ft, p.offset_ft) for p in placements if p.label == "R3-7L")
    arrow = next(p for p in placements if p.device_type == DeviceType.ARROW_BOARD)
    assert [s for s, _ in pair] == [st["taper_end"]] * 2
    assert sorted(o for _, o in pair) == sorted(
        [-ONE_WAY_LEFT_CURB_SIGN_OFFSET_FT, arrow.offset_ft]
    )


def test_the_arrow_board_points_right_at_the_work_space() -> None:
    params, placements, _st = layout(bay_body())
    arrows = [p for p in placements if p.device_type == DeviceType.ARROW_BOARD]
    assert len(arrows) == 1
    assert arrows[0].station_ft == params.work_zone_length_ft
    assert arrows[0].label == "RIGHT_ARROW"


def test_the_advance_series_is_the_left_lane_series_from_the_taper() -> None:
    _params, placements, st = layout(bay_body())
    labels = {p.label: p.station_ft for p in placements if p.label}
    assert labels["W4-2L"] == st["sign_a"] and labels["W20-5L"] == st["sign_b"]
    assert "W4-2R" not in labels and "W20-5R" not in labels


def test_the_audit_records_the_storage_as_entered_by_operator(client: TestClient) -> None:
    r = client.post("/render/audit", headers=AUTH, json=bay_body())
    assert r.status_code == 200, r.text[:300]
    text = r.text
    bay = r.json()["sections"]["approaches"]["turn_bay"]
    assert bay["provenance"] == "entered by operator"
    assert bay["storage_ft"] == STORAGE
    assert r.json()["summary"]["ta"] == "TA-23"
    assert "left_turn_bay" in text
    assert "left_lane_mirrored" not in text


def test_the_plan_sheet_names_ta_23_and_the_operator_entry(tmp_path: Any) -> None:
    params, gen, kwargs = scenario_to_call(parsed(bay_body()))
    out = tmp_path / "ta23.pdf"
    render_plan_sheet(
        gen(params, **kwargs), params, output_path=str(out), approaches=kwargs["approaches"]
    )
    import pypdfium2 as pdfium

    doc = pdfium.PdfDocument(str(out))
    page_text = doc[0].get_textpage().get_text_range()
    doc.close()
    assert "TA-23" in page_text
    assert "LEFT-TURN BAY STORAGE 300 FT, ENTERED BY" in page_text
    counts = {k: len(v) for k, v in measure_containment(str(out)).items()}
    assert counts == {k: 0 for k in counts}, counts


def test_the_crew_sheet_places_the_bay_and_the_pair(client: TestClient) -> None:
    md = client.post("/render/markdown", headers=AUTH, json=bay_body()).text
    assert "reopens as a left-turn bay (MUTCD TA-23)" in md
    assert "300 ft, entered by the operator" in md
    assert "place LEFT LANE MUST TURN LEFT (R3-7L) twice" in md
    assert "Position arrow board at the upstream end of the work zone" in md


@pytest.mark.parametrize("route", ["/render/pdf", "/render/xlsx", "/render/crew-pdf"])
def test_every_deliverable_builds_the_turn_bay(client: TestClient, route: str) -> None:
    r = client.post(route, headers=AUTH, json=bay_body())
    assert r.status_code == 200, r.text[:300]


@pytest.mark.parametrize(
    ("side", "cross"), [("right", UPSTREAM), ("left", E_6TH), ("right", E_6TH)]
)
def test_the_field_is_ignored_off_the_left_far_side(side: str, cross: dict[str, Any]) -> None:
    without = ni(side, cross)
    with_field = {**ni(side, cross), "turnBayStorageFt": STORAGE}
    p1, g1, k1 = scenario_to_call(parsed(without))
    p2, g2, k2 = scenario_to_call(parsed(with_field))
    assert p2.turn_bay_storage_ft is None
    assert g1(p1, **k1) == g2(p2, **k2)
