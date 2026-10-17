"""#335 (option (a), R145 self-ruled): a 4-lane-per-direction freeway's two
refusals no longer point at each other.

The freeway minimum (11 ft, S-630-1 Sheet 7 Case 11) and the sheet's drawable
half-road (52 ft) can't both hold at 4 lanes beside a 10 ft shoulder, so each
refusal names the one recovery that works: 3 lanes at 11 ft.  The test follows
each refusal's own suggested fix through the real endpoint (Rule 11), starting
from the audit-shoulder run's I-25 request (findings F5).
"""

from __future__ import annotations

import copy
import json
import os
import re
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.api.render_api import app
from src.api.schemas import ShoulderScenario
from src.rules import site_detection as sd
from src.rules.validators import freeway_max_drawable_lanes

_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_SECRET}"}
I25_REQUEST = (
    Path(__file__).resolve().parents[1]
    / "validation-artifacts/committed/audit-shoulder/runs/i25-r-65-night/request.json"
)
FREEWAY_FIX = re.compile(r"Set lanes per direction to (\d+) and lane width to (\d+) ft")
SCHEMA_FIX = re.compile(r"Reduce the lane count to (\d+)\.")


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
    # The run's scenario fields as the site sent them.  The site's proxy
    # adds the confirmed road's centerline before the backend sees it, so
    # the meta here is the plain pin; neither refusal reads the geometry.
    scenario = copy.deepcopy(json.loads(I25_REQUEST.read_text(encoding="utf-8"))["scenario"])
    pin = scenario["meta"]
    scenario["meta"] = {k: pin[k] for k in ("project", "address", "lat", "lng")}
    scenario.update(over)
    return scenario


def _audit(body: dict[str, Any]) -> Any:
    return client.post("/render/audit", headers=AUTH, json=body)


def _refusal_text(r: Any) -> str:
    return json.dumps(r.json())


def test_the_fit_is_three_lanes_beside_either_shoulder() -> None:
    # (52 - 10) // 11 = 3 on a divided freeway; (52 - 8) // 11 = 4 undivided.
    assert freeway_max_drawable_lanes(10.0) == 3
    assert freeway_max_drawable_lanes(8.0) == 4


def test_the_site_defaults_refusal_names_a_fix_that_produces_a_plan() -> None:
    # The site fits 4 lanes to 10.5 ft (validation.ts laneWidthCeilingFt).
    r = _audit(_i25())
    assert r.status_code == 400
    text = _refusal_text(r)
    assert "LANE_WIDTH_BELOW_FREEWAY_MIN" in text
    assert "Increase lane width" not in text
    m = FREEWAY_FIX.search(text)
    assert m is not None, text
    fixed = _audit(_i25(lanes=int(m.group(1)), laneWidth=float(m.group(2))))
    assert fixed.status_code == 200, fixed.text


def test_eleven_ft_at_four_lanes_names_the_lane_count_not_a_narrower_lane() -> None:
    # The old loop: the freeway refusal said 11 ft, and 11 ft said 10.5 ft.
    r = _audit(_i25(laneWidth=11.0))
    assert r.status_code == 422
    text = _refusal_text(r)
    assert "Use a lane width of" not in text
    m = SCHEMA_FIX.search(text)
    assert m is not None, text
    fixed = _audit(_i25(lanes=int(m.group(1)), laneWidth=11.0))
    assert fixed.status_code == 200, fixed.text


def test_the_freeway_refusal_keeps_its_wording_when_eleven_ft_fits() -> None:
    r = _audit(_i25(lanes=3, laneWidth=10.5))
    assert r.status_code == 400
    text = _refusal_text(r)
    assert "Increase lane width to at least 11 ft, or verify the scenario" in text
    assert FREEWAY_FIX.search(text) is None


def test_the_drawable_refusal_keeps_its_wording_off_the_freeway() -> None:
    with pytest.raises(ValidationError) as exc:
        ShoulderScenario.model_validate(
            {
                "kind": "shoulder",
                "meta": {"project": "T", "address": "", "lat": 0.0, "lng": 0.0},
                "roadType": "rural_divided",
                "speed": 55,
                "lanes": 4,
                "laneWidth": 11.0,
                "divided": True,
                "workType": "utility_locate",
                "duration": "short",
                "workLen": 800.0,
                "night": False,
            }
        )
    msg = str(exc.value)
    assert "Use a lane width of 10.5 ft or less, or reduce the lane count." in msg
    assert "Freeway" not in msg
