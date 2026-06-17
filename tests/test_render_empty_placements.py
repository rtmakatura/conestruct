"""Regression for #53: an empty generator output must reject honestly.

``_make_x_mapping`` fits the plan-view scale to ``min(station over
placements)``; an empty device list would raise ``min() arg is an empty
sequence`` deep in the renderer — which ``render_pdf`` would mask into an
opaque 500.

No real generator returns empty today (each emits >=1 device), so the guard is
unreachable via real params. We monkeypatch the generator to ``[]`` to pin the
two contracts:

  * the API seam (``_placements_for``) rejects with an honest structured 400
    (``rule_id`` ``NO_DEVICES_GENERATED``), the same detail shape as the
    geometry rejection, so the Next.js proxy renders it identically;
  * the renderer enforces a non-empty invariant for non-HTTP callers
    (Streamlit/dev), raising a clear ``ValueError`` instead of the cryptic
    ``min()`` crash.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.rendering.plan_sheet import render_plan_sheet
from src.rules.validators import ScenarioParams

_SECRET = "test-secret-do-not-deploy"

# A valid shoulder scenario (mirrors the corpus boundary base): passes
# validate_corridor_geometry so the request reaches the generator, where the
# monkeypatch forces the empty-placement path under test.
_VALID_BODY = {
    "kind": "shoulder",
    "meta": {
        "project": "empty-guard",
        "address": "",
        "lat": 0.0,
        "lng": 0.0,
        "siteConditions": {},
    },
    "roadType": "rural_divided",
    "speed": 55,
    "lanes": 2,
    "laneWidth": 12.0,
    "divided": True,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 2000,
    "night": False,
    "workZoneSpeed": None,
}


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    # The bearer-auth middleware fails closed if RENDER_API_SECRET is unset;
    # set it before the app module is imported.
    monkeypatch.setenv("RENDER_API_SECRET", _SECRET)
    from src.api.render_api import app

    return TestClient(app)


@pytest.fixture()
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_SECRET}"}


def test_empty_placements_returns_honest_400(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A generator that yields zero devices → structured 400, not a 500."""
    import src.api.render_api as render_api

    real_scenario_to_call = render_api.scenario_to_call

    def _empty_generator_call(scenario: object) -> tuple:
        # Keep the real params (so validate_corridor_geometry still passes)
        # and real kwargs; swap only the generator for one returning [].
        params, _generator, kwargs = real_scenario_to_call(scenario)
        return params, (lambda *args, **kw: []), kwargs

    monkeypatch.setattr(render_api, "scenario_to_call", _empty_generator_call)

    res = client.post("/render/pdf", headers=auth_headers, json=_VALID_BODY)

    assert res.status_code == 400, res.text
    detail = res.json()["detail"]
    assert detail["error"] == "no_devices_generated"
    rule_ids = {v["rule_id"] for v in detail["violations"]}
    assert "NO_DEVICES_GENERATED" in rule_ids


def test_render_plan_sheet_rejects_empty_placements(tmp_path: Path) -> None:
    """The renderer enforces the non-empty invariant for non-HTTP callers."""
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=2000.0,
    )
    with pytest.raises(ValueError, match="No devices generated for scenario"):
        render_plan_sheet([], params, output_path=str(tmp_path / "out.pdf"))
