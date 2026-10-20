"""#356 (#345 S3's wording): the 52 ft drawable-half-road refusals say "this
plan can draw", never "the plan sheet's".

The 52 ft is ``MAX_DRAWABLE_HALF_ROAD_FT``: the widest half-road Conestruct's
own drawing fits (CHOSEN, src/rules/validators.py).  No CDOT sheet states it,
and the freeway messages cite S-630-1 Sheet 7 beside it, so "the sheet" would
read as CDOT's.  Each refusal is driven through the real endpoint (Rule 11).
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
from src.rules import site_detection as sd

_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_SECRET}"}
I25_REQUEST = (
    Path(__file__).resolve().parents[1]
    / "validation-artifacts/committed/audit-shoulder/runs/i25-r-65-night/request.json"
)
_META = {"project": "T", "address": "", "lat": 0.0, "lng": 0.0}


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


def _i25(**over: Any) -> dict[str, Any]:
    scenario = copy.deepcopy(json.loads(I25_REQUEST.read_text(encoding="utf-8"))["scenario"])
    pin = scenario["meta"]
    scenario["meta"] = {k: pin[k] for k in ("project", "address", "lat", "lng")}
    scenario.update(over)
    return scenario


def _refusal(body: dict[str, Any], status: int) -> str:
    r = client.post("/render/audit", headers=AUTH, json=body)
    assert r.status_code == status, r.text
    return json.dumps(r.json())


def _no_sheet_claim(text: str) -> None:
    assert "plan sheet" not in text
    assert "the sheet draws" not in text
    assert "widest half-road is" not in text


def test_shoulder_refusal_off_the_freeway() -> None:
    text = _refusal(
        {
            "kind": "shoulder",
            "meta": _META,
            "roadType": "rural_divided",
            "speed": 55,
            "lanes": 4,
            "laneWidth": 11.0,
            "divided": True,
            "workType": "utility_locate",
            "duration": "short",
            "workLen": 800.0,
            "night": False,
        },
        422,
    )
    assert (
        "4 lanes x 11.0 ft + 10 ft shoulder = 54.0 ft exceeds the 52 ft half-road "
        "this plan can draw. Use a lane width of 10.5 ft or less, or reduce the lane count."
    ) in text
    _no_sheet_claim(text)


def test_shoulder_refusal_on_the_freeway() -> None:
    text = _refusal(_i25(laneWidth=11.0), 422)
    assert "exceeds the 52 ft half-road this plan can draw." in text
    assert (
        "so this plan draws at most 3 lanes in this direction. Reduce the lane count to 3." in text
    )
    # The 11 ft minimum keeps its CDOT cite.
    assert "CDOT S-630-1 Sheet 7 Case 11" in text
    _no_sheet_claim(text)


def test_near_intersection_refusal() -> None:
    text = _refusal(
        {
            "kind": "near_intersection",
            "meta": {**_META, "siteConditions": {}},
            "roadType": "urban_arterial",
            "speed": 45,
            "lanes": 4,
            "laneWidth": 14.0,
            "divided": False,
            "workType": "utility_cut",
            "duration": "short",
            "workLen": 500.0,
            "night": False,
            "approaches": [
                {
                    "id": "cross_n",
                    "speed": 30,
                    "roadType": "urban_arterial",
                    "lanesPerDirection": 1,
                    "laneWidth": 12.0,
                    "signalized": False,
                    "bearingDeg": None,
                    "alongStationFt": -60.0,
                }
            ],
        },
        422,
    )
    assert (
        "4 lanes x 14.0 ft + 8 ft shoulder = 64.0 ft exceeds the 52 ft half-road "
        "this plan can draw. Use a lane width of 11.0 ft or less, or reduce the lane count."
    ) in text
    _no_sheet_claim(text)


def test_freeway_lane_width_refusal() -> None:
    # The live I-25 form's request: 4 lanes fitted to 10.5 ft.
    text = _refusal(_i25(), 400)
    assert (
        "At 11 ft this plan draws at most 3 lanes in this direction beside the 10 ft "
        "shoulder (the widest half-road it can draw is 52 ft). Set lanes per direction "
        "to 3 and lane width to 11 ft"
    ) in text
    _no_sheet_claim(text)
