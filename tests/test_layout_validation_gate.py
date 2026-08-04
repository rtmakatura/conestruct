"""validate_layout runs in the production render path (#117 enablement item 2).

Before this gate, ``validate_layout`` ran only in the retired Streamlit
app, dev scripts, and tests — no production render ever consulted it.
Now ``_placements_for`` (the #136/#158/#120 chokepoint every render/
quote/audit/breakdown path funnels through) validates the RAW generator
output and fails CLOSED on any error-severity Violation: every
generator's output is invariant-tested clean (tests/test_generators.py),
so an error here means the generator and the rules engine disagree — a
regression, not a user input problem.  Ruled 2026-08-03: honest 5xx
naming internal validation failure, no wire change.

Endpoint-level like test_lane_confidence_block.py: behavior is proven on
the real mounted endpoints.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import src.api.render_api as render_api
from src.api.render_api import app
from src.rules.validators import Violation, validate_layout
from tests.test_lane_confidence_block import _ni_body
from tests.test_plan_sheet_device_summary import SHOULDER_BODY

AUTH = {"Authorization": "Bearer test-secret"}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def ni_enabled(monkeypatch):
    """Enable near_intersection so requests reach the layout gate (#117)."""
    monkeypatch.setattr(
        render_api,
        "ENABLED_SCENARIOS",
        frozenset({"shoulder", "flagger_lane_closure", "near_intersection"}),
    )


def test_clean_generator_output_renders_unchanged(client):
    resp = client.post("/render/markdown", json=SHOULDER_BODY, headers=AUTH)
    assert resp.status_code == 200


def test_error_severity_violation_fails_closed(client, monkeypatch):
    """An error-severity Violation refuses the render with an honest 5xx."""

    def broken(placements, params, approach_params=None):
        return [
            Violation(
                rule_id="MISSING_TAPER",
                severity="error",
                message="synthetic regression: no merging taper found",
                mutcd_section="6N.06",
            )
        ]

    monkeypatch.setattr(render_api, "validate_layout", broken)
    resp = client.post("/render/markdown", json=SHOULDER_BODY, headers=AUTH)
    assert resp.status_code == 500
    detail = resp.json()["detail"]
    assert detail["error"] == "internal_layout_validation_failed"
    assert "MISSING_TAPER" in detail["message"]
    # The refusal names the failure honestly rather than rendering a plan
    # the tool's own validator rejects (rule 10).
    assert "will not be rendered" in detail["message"]


def test_warning_severity_does_not_block(client, monkeypatch):
    """Warnings pass through — only error severity fails the render."""

    def warning_only(placements, params, approach_params=None):
        return [
            Violation(
                rule_id="TAPER_LONGER_THAN_REQUIRED",
                severity="warning",
                message="synthetic warning",
                mutcd_section="6N.06",
            )
        ]

    monkeypatch.setattr(render_api, "validate_layout", warning_only)
    resp = client.post("/render/markdown", json=SHOULDER_BODY, headers=AUTH)
    assert resp.status_code == 200


def test_near_intersection_approach_params_reach_the_validator(client, monkeypatch, ni_enabled):
    """The chokepoint hands validate_layout the per-approach params map.

    Without it, the fifteen mainline validators would judge cross-street
    signs by the mainline's speed key and the per-approach §6N.12.06
    checks would never run (the increment-2 seam this gate must not
    bypass).
    """
    seen: dict = {}

    def spy(placements, params, approach_params=None):
        seen["approach_params"] = approach_params
        return validate_layout(placements, params, approach_params)

    monkeypatch.setattr(render_api, "validate_layout", spy)
    resp = client.post("/render/markdown", json=_ni_body(), headers=AUTH)
    assert resp.status_code == 200
    assert seen["approach_params"] is not None
    assert set(seen["approach_params"].keys()) == {"cross_n"}


@pytest.mark.parametrize("speed", [20, 25, 30, 35])
def test_low_speed_shoulder_validates_clean(client, speed):
    """Regression pin for the taper tie-break (phase-2 discovery).

    At 20-35 mph the shoulder-divided merging taper has exactly three
    drums — the same device count as the downstream taper's three cones.
    _extract_taper_indices' old first-wins tie-break picked the
    DOWNSTREAM run (lowest stations), so validate_buffer_space measured
    the buffer against the wrong taper (-850 ft) and the low-speed
    renders would have failed the production gate.  Ties now go to the
    most upstream run — the merging taper every consumer means.
    """
    body = {**SHOULDER_BODY, "speed": speed}
    resp = client.post("/render/markdown", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text


def test_enabled_kinds_pass_the_live_gate(client):
    """Both live kinds render with the real validate_layout in the path —
    the generator-output-validates-clean invariant holds end to end."""
    from tests.test_plan_sheet_device_summary import FLAGGER_BODY

    for body in (SHOULDER_BODY, FLAGGER_BODY):
        resp = client.post("/render/markdown", json=body, headers=AUTH)
        assert resp.status_code == 200, body["kind"]
