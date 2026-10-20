"""#310 (option (a), R145 self-ruled): a road with more lanes per direction than
the plan draws says so on page 1, in the audit and in the crew narrative.

The plan draws at most 4 lanes per direction (the shoulder wire's ``lanes``
cap; 5+ overrun the sheet's drawable half-road).  The frontend relays the
road's own count as ``roadLanesPerDirection`` (the detected count, or the
operator's picker override); the backend owns the predicate and the one
sentence every surface prints (``layout.lanes_drawn_below_road``, the #176
pattern).  Tested through the real endpoints (Rule 11).
"""

from __future__ import annotations

import copy
import dataclasses
import io
import os
from typing import Any

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.api.render_api import app
from src.api.schemas import ShoulderScenario
from src.generation.layout import PLAN_MAX_LANES_PER_DIRECTION, lanes_drawn_below_road
from src.rules import site_detection as sd
from src.rules.validators import ScenarioParams

_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_SECRET}"}
SENTENCE = (
    "Drawn as 4 lanes per direction; the road has 5. Plans draw at most 4 lanes "
    "per direction, so the device offsets are measured against 4 lanes."
)


@pytest.fixture(scope="module", autouse=True)
def _env() -> None:
    os.environ["RENDER_API_SECRET"] = _SECRET
    os.environ["MAPBOX_TOKEN"] = ""


@pytest.fixture(autouse=True)
def _no_overpass(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_kw: ({"elements": []}, None)
    )


client = TestClient(app)


def _body(**over: Any) -> dict[str, Any]:
    # A 4-lane-per-direction divided shoulder plan; 10.5 ft lanes fit the
    # drawable half-road under the 10 ft shoulder (52 - 10 = 42 = 4 x 10.5).
    return {
        "kind": "shoulder",
        "meta": {"project": "T", "address": "", "lat": 0.0, "lng": 0.0},
        "roadType": "rural_divided",
        "speed": 55,
        "lanes": 4,
        "laneWidth": 10.5,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 800.0,
        "night": False,
        **over,
    }


def _params(num_lanes: int, road: int | None) -> ScenarioParams:
    return ScenarioParams(
        speed_mph=55,
        num_lanes=num_lanes,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=10.5,
        shoulder_width_ft=10.0,
        is_divided=True,
        road_lanes_per_direction=road,
    )


def _pending_kinds(audit: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {i["kind"]: i for i in audit["pending_verification"].get("items") or []}


def test_the_predicate_fires_only_when_the_road_has_more() -> None:
    assert PLAN_MAX_LANES_PER_DIRECTION == 4
    assert lanes_drawn_below_road(_params(4, 5)) == SENTENCE
    assert lanes_drawn_below_road(_params(4, 4)) is None
    assert lanes_drawn_below_road(_params(3, 3)) is None
    assert lanes_drawn_below_road(_params(4, None)) is None
    # The numbers are the plan's and the road's, never literals.
    assert "the road has 7" in (lanes_drawn_below_road(_params(4, 7)) or "")


def test_the_wire_field_takes_any_count_of_one_or_more() -> None:
    ShoulderScenario.model_validate(_body(roadLanesPerDirection=5))
    # No upper bound: an outsized map count must not 422 the render.
    ShoulderScenario.model_validate(_body(roadLanesPerDirection=25))
    with pytest.raises(ValidationError):
        ShoulderScenario.model_validate(_body(roadLanesPerDirection=0))


def test_the_audit_carries_the_item() -> None:
    r = client.post("/render/audit", headers=AUTH, json=_body(roadLanesPerDirection=5))
    assert r.status_code == 200, r.text[:300]
    item = _pending_kinds(r.json())["lanes_drawn_below_road"]
    assert item["label"] == SENTENCE
    assert item["tracking_issue"].endswith("/issues/310")


def test_no_item_when_the_road_fits_or_no_relay() -> None:
    for body in (_body(), _body(roadLanesPerDirection=4)):
        r = client.post("/render/audit", headers=AUTH, json=body)
        assert r.status_code == 200, r.text[:300]
        assert "lanes_drawn_below_road" not in _pending_kinds(r.json())


def _page_text(body: dict[str, Any]) -> str:
    r = client.post("/render/pdf", headers=AUTH, json=copy.deepcopy(body))
    assert r.status_code == 200, r.text[:300]
    page = pdfium.PdfDocument(io.BytesIO(r.content))[0]
    return " ".join(page.get_textpage().get_text_range().split())


def test_page_one_says_so() -> None:
    text = _page_text(_body(roadLanesPerDirection=5))
    assert "DRAWN AS 4 LANES PER DIRECTION; THE ROAD HAS 5." in text
    assert "MEASURED AGAINST 4 LANES." in text
    assert "THE ROAD HAS" not in _page_text(_body())


def test_the_crew_narrative_says_so() -> None:
    r = client.post("/render/markdown", headers=AUTH, json=_body(roadLanesPerDirection=5))
    assert r.status_code == 200, r.text[:300]
    assert f"- Lanes: {SENTENCE}" in r.text
    plain = client.post("/render/markdown", headers=AUTH, json=_body())
    assert "the road has" not in plain.text


# #341 (R145 self-ruled S1): the sheet's limit is named only when it is the
# cause.  A plan drawn below the limit drew the entered count.
ENTERED = (
    "Drawn as 3 lanes per direction (entered); the road has 4. "
    "Device offsets are measured against 3 lanes."
)


def test_below_the_limit_the_note_names_the_entered_count() -> None:
    assert lanes_drawn_below_road(_params(3, 4)) == ENTERED
    # 3 of 5: the limit allowed 4, so it is not why 3 was drawn.
    assert "(entered); the road has 5." in (lanes_drawn_below_road(_params(3, 5)) or "")
    for num_lanes, road in ((3, 4), (3, 5), (1, 2)):
        assert "at most" not in (lanes_drawn_below_road(_params(num_lanes, road)) or "")
    # At the limit with a bigger road, today's sentence is unchanged.
    assert lanes_drawn_below_road(_params(4, 5)) == SENTENCE


def test_below_the_limit_every_surface_prints_the_entered_wording() -> None:
    body = _body(lanes=3, roadLanesPerDirection=4)
    r = client.post("/render/audit", headers=AUTH, json=body)
    assert r.status_code == 200, r.text[:300]
    assert _pending_kinds(r.json())["lanes_drawn_below_road"]["label"] == ENTERED
    text = _page_text(body)
    assert "DRAWN AS 3 LANES PER DIRECTION (ENTERED); THE ROAD HAS 4." in text
    assert "MEASURED AGAINST 3 LANES." in text
    assert "AT MOST" not in text
    md = client.post("/render/markdown", headers=AUTH, json=body)
    assert md.status_code == 200, md.text[:300]
    assert f"- Lanes: {ENTERED}" in md.text


# #345 (R145 self-ruled S2): on a freeway the 11 ft minimum, not the 4-lane
# limit, is why a 4-lane road draws as 3 under a 10 ft shoulder (#335's
# recovery).  The sentence names that cause.
FREEWAY_MIN = (
    "Drawn as 3 lanes per direction; the road has 4. Freeway lanes must be at "
    "least 11 ft (CDOT S-630-1 Sheet 7 Case 11), and at that width 4 lanes and "
    "the 10 ft shoulder overrun the sheet's 52 ft half-road, so the device "
    "offsets are measured against 3 lanes."
)


def _freeway(num_lanes: int, road: int | None, shoulder: float = 10.0) -> ScenarioParams:
    return dataclasses.replace(
        _params(num_lanes, road),
        road_type="freeway",
        lane_width_ft=11.0,
        shoulder_width_ft=shoulder,
    )


def test_a_freeway_drawn_at_the_fit_count_names_the_freeway_minimum() -> None:
    assert lanes_drawn_below_road(_freeway(3, 4)) == FREEWAY_MIN
    assert "the road has 6. Freeway lanes" in (lanes_drawn_below_road(_freeway(3, 6)) or "")
    # Below the fit count the operator chose it: #341's entered wording.
    assert "(entered); the road has 4." in (lanes_drawn_below_road(_freeway(2, 4)) or "")
    # A non-freeway plan at 3 of 4 keeps #341's sentence byte for byte.
    assert lanes_drawn_below_road(_params(3, 4)) == ENTERED
    # Under an 8 ft shoulder 4 lanes fit at 11 ft: the limit is the cause.
    assert lanes_drawn_below_road(_freeway(4, 5, shoulder=8.0)) == SENTENCE


def test_the_i25_recovery_prints_the_freeway_minimum_on_every_surface() -> None:
    # #345's repro: I-25 (4 per direction) after #335's refusal, 3 x 11 ft.
    body = _body(roadType="freeway", speed=65, lanes=3, laneWidth=11.0, roadLanesPerDirection=4)
    r = client.post("/render/audit", headers=AUTH, json=body)
    assert r.status_code == 200, r.text[:300]
    assert _pending_kinds(r.json())["lanes_drawn_below_road"]["label"] == FREEWAY_MIN
    text = _page_text(body)
    assert "DRAWN AS 3 LANES PER DIRECTION; THE ROAD HAS 4." in text
    assert "FREEWAY LANES MUST BE AT" in text
    assert "MEASURED AGAINST 3 LANES." in text
    assert "AT MOST" not in text
    md = client.post("/render/markdown", headers=AUTH, json=body)
    assert md.status_code == 200, md.text[:300]
    assert f"- Lanes: {FREEWAY_MIN}" in md.text
