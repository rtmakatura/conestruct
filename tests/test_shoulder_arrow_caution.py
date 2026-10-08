"""R119 Q1 — a shoulder plan's arrow board shows caution mode, never an arrow.

MUTCD 11th Ed. §6L.06 ¶18 (Standard), p. 833, and CDOT S-630-1 Sheet 2
General Note 26 allow only caution mode for shoulder work.  Tested where
the bug lived (Rule 11): the placements both shoulder generators emit, the
rendered page 1 (legend text + the board glyph), and the crew sheet.  A
near-intersection plan (a lane closure, where ¶17 allows the arrow) is the
control.  Sources: ``validation-artifacts/committed/shoulder-arrow-caution/
sources/``.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from src.api.render_api import app
from src.api.schemas import Scenario, scenario_to_call
from src.generation.layout import (
    SHOULDER_ARROW_BOARD_LABEL,
    generate_shoulder_closure_divided,
    generate_shoulder_closure_undivided,
)
from src.rendering.plan_sheet import _arrow_board_display, _draw_arrow_board
from src.rules import site_detection as sd
from src.rules.devices import DeviceType

AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}
FIXTURES = Path(__file__).parent / "fixtures" / "pdf_worst_case"
ONE_WAY = {"oneway": "yes", "highwayClass": "primary", "twinSearched": True}


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


def shoulder(divided: bool) -> dict[str, Any]:
    b: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "r119", "address": "", "lat": 0.0, "lng": 0.0},
        "roadType": "urban_arterial",
        "speed": 30,
        # Divided: 2 lanes, so 2 x 11 ft + the 10 ft shoulder fits the
        # sheet's 52 ft half-road; the one-way street path takes 4.
        "lanes": 2 if divided else 4,
        "laneWidth": 11.0,
        "divided": divided,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000.0,
        "night": False,
    }
    if not divided:
        b["carriageway"] = ONE_WAY  # the one-way street path (#308)
    return b


def near_intersection() -> dict[str, Any]:
    raw = json.loads((FIXTURES / "adv-near-intersection.json").read_text(encoding="utf-8"))
    return raw["scenario"]


def placements(body: dict[str, Any]):
    params, generator, kwargs = scenario_to_call(TypeAdapter(Scenario).validate_python(body))
    return generator, list(generator(params, **kwargs))


def page1_text(pdf: bytes) -> str:
    doc = pdfium.PdfDocument(pdf)
    return doc[0].get_textpage().get_text_range()


# --- payload -----------------------------------------------------------


@pytest.mark.parametrize(
    ("divided", "expected_generator"),
    [(True, generate_shoulder_closure_divided), (False, generate_shoulder_closure_undivided)],
)
def test_every_shoulder_generator_places_one_board_in_caution_mode(
    divided: bool, expected_generator: Any
) -> None:
    generator, plan = placements(shoulder(divided))
    assert generator is expected_generator
    boards = [p for p in plan if p.device_type == DeviceType.ARROW_BOARD]
    assert [p.label for p in boards] == ["CAUTION"]
    assert SHOULDER_ARROW_BOARD_LABEL == "CAUTION"
    assert all(p.label != "RIGHT_ARROW" for p in plan)


def test_a_lane_closure_keeps_its_arrow() -> None:
    _, plan = placements(near_intersection())
    boards = [p.label for p in plan if p.device_type == DeviceType.ARROW_BOARD]
    assert boards and set(boards) == {"LEFT_ARROW"}


# --- rendered output ---------------------------------------------------


def test_the_caution_label_draws_the_caution_display_not_an_arrow() -> None:
    assert _arrow_board_display("CAUTION") == "caution"
    assert _arrow_board_display("LEFT_ARROW") == "left"
    assert _arrow_board_display("RIGHT_ARROW") == "right"
    canvas = MagicMock()
    _draw_arrow_board(canvas, 100.0, 100.0, direction="caution")
    # Fig 6L-3 "Flashing Caution": four corner lamps, no arrow path.
    assert canvas.circle.call_count == 4
    canvas.beginPath.assert_not_called()


@pytest.mark.parametrize("divided", [True, False])
def test_page_1_legend_says_caution_mode_on_a_shoulder_plan(
    client: TestClient, divided: bool
) -> None:
    r = client.post("/render/pdf", headers=AUTH, json=shoulder(divided))
    assert r.status_code == 200, r.text
    assert "Arrow Board (caution mode)" in page1_text(r.content)


def test_page_1_legend_is_unchanged_on_a_lane_closure(client: TestClient) -> None:
    r = client.post("/render/pdf", headers=AUTH, json=near_intersection())
    assert r.status_code == 200, r.text
    text = page1_text(r.content)
    assert "Arrow Board" in text
    assert "caution mode" not in text


# --- crew sheet --------------------------------------------------------


@pytest.mark.parametrize("divided", [True, False])
def test_the_crew_sheet_sets_the_board_to_caution_mode(client: TestClient, divided: bool) -> None:
    r = client.post("/render/markdown", headers=AUTH, json=shoulder(divided))
    assert r.status_code == 200, r.text
    step1 = next(ln for ln in r.text.splitlines() if ln.startswith("1. Position arrow board"))
    assert "Set it to caution mode (flashing caution or alternating diamond)." in step1
    assert "MUTCD 11th Ed. §6L.06 ¶18, p. 833" in step1
    assert "CDOT S-630-1 Sheet 2 General Note 26" in step1
    assert "RIGHT ARROW" not in r.text


def test_the_crew_sheet_keeps_the_lane_closure_arrow(client: TestClient) -> None:
    r = client.post("/render/markdown", headers=AUTH, json=near_intersection())
    assert r.status_code == 200, r.text
    assert "Set to LEFT ARROW mode" in r.text
    assert "caution mode" not in r.text
