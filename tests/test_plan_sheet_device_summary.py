"""Spec §4 print pipeline (issue #150) — API plumbing + rendered-output tests.

Rule-11 layer choice: assertions run against the text extracted from the
actually-rendered PDF (pypdfium2), through the real /render/pdf endpoint,
so plumbing bugs and layout regressions both surface here.
"""

from __future__ import annotations

import copy

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app

AUTH = {"Authorization": "Bearer test-secret"}

SHOULDER_BODY = {
    "kind": "shoulder",
    "meta": {"project": "Spec4 Test", "address": "", "lat": 0.0, "lng": 0.0},
    "roadType": "rural_divided",
    "speed": 55,
    "lanes": 2,
    "laneWidth": 12.0,
    "divided": True,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 800.0,
    "night": False,
}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


def pdf_text(client: TestClient, body: dict, tmp_path) -> str:
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text
    tmp = tmp_path / "sheet.pdf"
    tmp.write_bytes(resp.content)
    pdf = pdfium.PdfDocument(str(tmp))
    try:
        return "\n".join(page.get_textpage().get_text_range() for page in pdf)
    finally:
        pdf.close()


# ---------------------------------------------------------------------------
# Task 3: plumbing
# ---------------------------------------------------------------------------


def test_unknown_jurisdiction_key_is_a_400(client: TestClient) -> None:
    body = copy.deepcopy(SHOULDER_BODY)
    body["jurisdiction_key"] = "narnia"
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 400


def test_meta_toggle_field_accepted_and_defaults_on(client: TestClient) -> None:
    body = copy.deepcopy(SHOULDER_BODY)
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200

    body["meta"]["includeDeviceSummary"] = False
    resp = client.post("/render/pdf", json=body, headers=AUTH)
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Task 4: footer geometry
# ---------------------------------------------------------------------------


def test_footer_geometry_three_and_four_box() -> None:
    from src.rendering.plan_sheet import MARGIN, PAGE_W, _footer_geometry

    g3 = _footer_geometry(include_device_summary=False)
    assert g3.device_x is None and g3.device_w is None
    third = (PAGE_W - 2 * MARGIN - 2 * 12.0) / 3
    assert abs(g3.legend_w - third) < 0.01
    assert g3.legend_w == g3.notes_w == g3.title_w

    g4 = _footer_geometry(include_device_summary=True)
    assert g4.device_x is not None and g4.device_w is not None
    assert g4.legend_x < g4.notes_x < g4.device_x < g4.title_x
    # Weighted boxes fill the inner width exactly (3 gutters of 12 pt).
    total = g4.legend_w + g4.notes_w + g4.device_w + g4.title_w + 3 * 12.0
    assert abs(total - (PAGE_W - 2 * MARGIN)) < 0.01
    # The NOTES box keeps (approximately) its engineered 3-box width —
    # its interior column layout was designed for it.
    assert g4.notes_w > 0.95 * third
    # Right edge of the last box lands on the right margin.
    assert abs((g4.title_x + g4.title_w) - (PAGE_W - MARGIN)) < 0.01


# ---------------------------------------------------------------------------
# Task 5: the on-sheet device summary block
# ---------------------------------------------------------------------------

FLAGGER_BODY = {
    "kind": "flagger_lane_closure",
    "meta": {"project": "Spec4 Flagger", "address": "", "lat": 0.0, "lng": 0.0},
    "roadType": "rural_undivided",
    "speed": 45,
    "laneWidth": 11.0,
    "workType": "utility_cut",
    "duration": "short",
    "workLen": 1000.0,
    "night": False,
    "pilotCar": False,
    "afad": False,
    "pedestrianAccess": False,
}


def _placements_for_body(body: dict):
    """Placements exactly as the render endpoints build them."""
    from src.api.schemas import (
        FlaggerLaneClosureScenario,
        ShoulderScenario,
        scenario_to_call,
    )

    model = (
        FlaggerLaneClosureScenario if body["kind"] == "flagger_lane_closure" else ShoulderScenario
    )
    scenario = model.model_validate(body)
    params, generator, kwargs = scenario_to_call(scenario)
    return generator(params, **kwargs), params


def test_device_summary_block_renders_with_real_quantities(client, tmp_path) -> None:
    text = pdf_text(client, copy.deepcopy(SHOULDER_BODY), tmp_path)
    assert "TRAFFIC CONTROL DEVICE SUMMARY" in text
    assert "SEE DEVICE LIST (XLSX) FOR BID QUANTITIES." in text
    assert "TOTAL DEVICES" in text


def test_quantities_match_the_aggregation_not_constants(client, tmp_path) -> None:
    """Two zone lengths must show two different channelizer counts, and every
    aggregated (XLSX) row quantity must appear on its sheet (spec §4.3)."""
    from src.rules.device_aggregation import aggregate_device_rows

    for work_len in (500.0, 5000.0):
        body = copy.deepcopy(SHOULDER_BODY)
        body["workLen"] = work_len
        placements, _params = _placements_for_body(body)
        text = pdf_text(client, body, tmp_path)
        for row in aggregate_device_rows(placements):
            assert str(row.quantity) in text, (work_len, row.device_type, row.label)
        assert str(len(placements)) in text  # totals row

    short_p, _ = _placements_for_body({**copy.deepcopy(SHOULDER_BODY), "workLen": 500.0})
    long_p, _ = _placements_for_body({**copy.deepcopy(SHOULDER_BODY), "workLen": 5000.0})
    assert len(long_p) > len(short_p)


def test_flagger_station_quantity_comes_from_placements(client, tmp_path) -> None:
    """The §4.3 headline: flagger-station count is engine output, never 2-by-fiat."""
    from src.rules.devices import DEVICE_CATALOG, DeviceType

    placements, _params = _placements_for_body(copy.deepcopy(FLAGGER_BODY))
    n_stations = sum(1 for p in placements if p.device_type == DeviceType.FLAGGER_STATION)
    assert n_stations >= 1  # the scenario staffs real stations

    text = pdf_text(client, copy.deepcopy(FLAGGER_BODY), tmp_path)
    flat = " ".join(text.split())
    desc = DEVICE_CATALOG[DeviceType.FLAGGER_STATION].description
    assert f"{desc} {n_stations}" in flat  # name cell followed by its qty cell


def test_toggle_off_removes_the_block(client, tmp_path) -> None:
    body = copy.deepcopy(SHOULDER_BODY)
    body["meta"]["includeDeviceSummary"] = False
    text = pdf_text(client, body, tmp_path)
    assert "TRAFFIC CONTROL DEVICE SUMMARY" not in text
