"""#321: page 1's direction arrows sit inside an open travel lane.

Rendered-output test (Rule 11): every ``_draw_lane_arrow`` call made while
``/render/pdf`` draws page 1 is recorded, and each arrow's y is checked
against the lane it should sit in.  Two-way and divided plans draw one arrow
per direction, each in lane 1 of its side (beside the centerline or median);
one-way plans keep #308 R94's arrows; the flagger's work-side arrow keeps its
pre-#321 margin place pending a ruling (its one lane is closed where the
arrows are drawn).
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
from src.rendering import plan_sheet as ps
from src.rules import site_detection as sd

_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_SECRET}"}
META = {"project": "T", "address": "", "lat": 0.0, "lng": 0.0}


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

SHOULDER: dict[str, Any] = {
    "kind": "shoulder",
    "meta": META,
    "roadType": "urban_arterial",
    "speed": 35,
    "lanes": 2,
    "laneWidth": 11.0,
    "divided": False,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 500.0,
    "night": False,
}


def _arrows(monkeypatch: pytest.MonkeyPatch, body: dict[str, Any]) -> list[tuple[float, bool]]:
    calls: list[tuple[float, bool]] = []
    real = ps._draw_lane_arrow

    def spy(c, x_left, x_right, y, pointing_right=True):  # noqa: ANN001
        calls.append((y, pointing_right))
        return real(c, x_left, x_right, y, pointing_right=pointing_right)

    monkeypatch.setattr(ps, "_draw_lane_arrow", spy)
    r = client.post("/render/pdf", headers=AUTH, json=copy.deepcopy(body))
    assert r.status_code == 200, r.text[:300]
    return calls


def _in_lane(y: float, lane_from_ft: float, lane_to_ft: float, divided: bool) -> bool:
    a, b = ps._y_of(lane_from_ft, divided), ps._y_of(lane_to_ft, divided)
    return min(a, b) < y < max(a, b)


@pytest.mark.parametrize("sidewalk", [False, True])
def test_two_way_one_arrow_per_direction_in_lane_one(
    monkeypatch: pytest.MonkeyPatch, sidewalk: bool
) -> None:
    body = {**SHOULDER}
    if sidewalk:
        body["meta"] = {**META, "siteConditions": {"pedestrian_facility": True}}
    arrows = _arrows(monkeypatch, body)
    assert sorted(p for _, p in arrows) == [False, True]
    work = next(y for y, p in arrows if p)
    opposing = next(y for y, p in arrows if not p)
    assert _in_lane(work, 0.0, 11.0, False)  # work-side lane 1
    assert _in_lane(opposing, -11.0, 0.0, False)  # opposing lane 1


def test_divided_one_arrow_per_carriageway_in_lane_one(monkeypatch: pytest.MonkeyPatch) -> None:
    body = {
        **SHOULDER,
        "roadType": "rural_divided",
        "divided": True,
        "lanes": 3,
        "meta": {**META, "siteConditions": {"pedestrian_facility": True}},
    }
    arrows = _arrows(monkeypatch, body)
    assert sorted(p for _, p in arrows) == [False, True]
    work = next(y for y, p in arrows if p)
    opposing = next(y for y, p in arrows if not p)
    assert _in_lane(work, 0.001, 11.0, True)
    assert _in_lane(opposing, -11.0, -0.001, True)


def test_flagger_gains_its_opposing_arrow_and_keeps_its_work_side_one(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    body = {
        "kind": "flagger_lane_closure",
        "meta": META,
        "roadType": "rural_undivided",
        "speed": 45,
        "laneWidth": 11.0,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
        "pilotCar": False,
        "afad": False,
        "pedestrianAccess": False,
    }
    arrows = _arrows(monkeypatch, body)
    work = next(y for y, p in arrows if p)
    opposing = next(y for y, p in arrows if not p)
    assert _in_lane(opposing, -11.0, 0.0, False)
    # The work-side lane is closed where the arrows are drawn: the arrow
    # stays past the shoulder, outside the asphalt, pending a ruling (#321).
    assert not _in_lane(work, 0.0, 11.0, False)


def test_one_way_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    """#308 R94: every arrow points the one direction, inside the lanes.
    The committed one-way fixture (Broadway, read as a one-way street)."""
    fx = json.loads(
        Path("tests/fixtures/pdf_worst_case/broadway-left.json").read_text(encoding="utf-8")
    )
    for key in ("scenario", "body", "request"):
        if key in fx:
            fx = fx[key]
            break
    arrows = _arrows(monkeypatch, fx)
    assert arrows and all(p for _, p in arrows)
