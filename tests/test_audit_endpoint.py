"""Tests for the ``/render/audit`` endpoint.

Pins the response shape the frontend AuditTrail + math display will
consume after PR 2 migrates them off the TS ``compute()`` estimator.

Coverage:
  * Endpoint returns the expected top-level keys (summary, sections,
    pending_verification) and is gated by the bearer-auth middleware.
  * Summary surfaces the TA / CDOT sheet mapping per scenario kind,
    plus the math primitives (taper, buffer, spacings) that the TS
    estimator used to compute in the browser.
  * Sections body mirrors ``build_audit_trail`` (so any audit-section
    invariants tested elsewhere still hold) with TODO case-# markers
    scrubbed.
  * ``pending_verification.count`` tracks how many TODO markers were
    hidden so a UI rollup can surface the count + tracking issue link.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from src.api import audit as audit_module
from src.api.render_api import app


@pytest.fixture(scope="module", autouse=True)
def _set_render_secret() -> None:
    # The bearer-auth middleware fails closed if RENDER_API_SECRET is
    # unset.  Pin a known value for the test session so every request
    # below can authenticate.
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def _auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-secret-do-not-deploy"}


def _shoulder_scenario() -> dict:
    """Mirrors ``_shoulder_divided_params`` in test_verification.py:
    divided, 55 mph, 800 ft work zone, 12-ft lanes.
    """
    return {
        "kind": "shoulder",
        "meta": {"project": "T", "address": "", "lat": 0.0, "lng": 0.0},
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


# ---------------------------------------------------------------------------
# Auth + plumbing
# ---------------------------------------------------------------------------


def test_audit_requires_bearer(client: TestClient) -> None:
    """No bearer header → 401, regardless of body shape."""
    res = client.post("/render/audit", json=_shoulder_scenario())
    assert res.status_code == 401


def test_audit_returns_200_for_shoulder(client: TestClient) -> None:
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=_shoulder_scenario(),
    )
    assert res.status_code == 200, res.text


def test_audit_response_has_top_level_keys(client: TestClient) -> None:
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=_shoulder_scenario(),
    )
    body = res.json()
    assert set(body.keys()) == {"summary", "sections", "pending_verification"}


# ---------------------------------------------------------------------------
# Summary block — the math the TS estimator used to compute
# ---------------------------------------------------------------------------


def test_audit_summary_shoulder_ta_and_sheet(client: TestClient) -> None:
    """Shoulder closure → TA-2 / S-630-1 (mirrors shoulder.ts:17-18)."""
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=_shoulder_scenario(),
    )
    summary = res.json()["summary"]
    assert summary["ta"] == "TA-2"
    assert summary["cdot_sheet"] == "S-630-1"


def test_audit_summary_taper_buffer_spacing_match_spacing_py(
    client: TestClient,
) -> None:
    """Summary math matches the spacing.py primitives directly.

    Shoulder closure on a divided highway, 55 mph, 10-ft shoulder offset:
      L (full merging taper) = 10 × 55 = 550 ft  (high-speed L = W × S
        regime at 55 mph; the W is the offset being closed off, which
        is the shoulder width for a shoulder closure, not the lane width)
      Shoulder taper = L/3 = 183.33 ft  — NOT the full 550 ft.
      buffer = 495 ft (Table 6B-2).
      in-taper spacing = 55 ft, on-tangent spacing = 110 ft (§6C.09).

    The 183 ft vs 550 ft distinction is load-bearing: confusing the
    shoulder taper with the full merging taper would under-spec a
    shoulder closure (a class of bug we've been chasing this week).
    Asserting the numeric 183.33 directly — not the formula — so a
    future reader cannot misread the literal as "550 ft taper."
    """
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=_shoulder_scenario(),
    )
    summary = res.json()["summary"]
    assert summary["taper_length_ft"] == pytest.approx(183.33, abs=0.1)
    assert summary["buffer_space_ft"] == 495
    assert summary["device_spacing_taper_ft"] == 55.0
    assert summary["device_spacing_tangent_ft"] == 110.0


def test_audit_summary_taper_label_shoulder(client: TestClient) -> None:
    """Shoulder closures report 'L/3' (not 'L') as the taper label."""
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=_shoulder_scenario(),
    )
    assert res.json()["summary"]["taper_label"] == "L/3 (shoulder taper)"


# ---------------------------------------------------------------------------
# Sections body — verify build_audit_trail body is faithfully exposed
# ---------------------------------------------------------------------------


def test_audit_sections_carries_all_build_audit_trail_keys(client: TestClient) -> None:
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=_shoulder_scenario(),
    )
    sections = res.json()["sections"]
    assert set(sections.keys()) == {
        "taper",
        "buffer",
        "spacing",
        "advance",
        "colorado",
        "case",
        "flagger",
        "corridor_validation",
        "geometry_validation",
    }


def test_audit_geometry_validation_present(client: TestClient) -> None:
    """Geometry validation section round-trips through the projection."""
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=_shoulder_scenario(),
    )
    geo = res.json()["sections"]["geometry_validation"]
    assert "violations" in geo
    assert geo["speed_mph"] == 55
    assert geo["all_pass"] is True


# ---------------------------------------------------------------------------
# Pending-verification rollup — TODO scrub + count
# ---------------------------------------------------------------------------


def test_shoulder_audit_has_no_pending_todos(client: TestClient) -> None:
    """Shoulder closure on a divided highway maps to S-630-1 Case 11,
    which has no ``(TODO: verify ...)`` marker — the rollup must show 0.
    """
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=_shoulder_scenario(),
    )
    body = res.json()
    assert body["pending_verification"]["count"] == 0
    # Nothing in the response should still contain "(TODO" — that text is
    # the trigger we scrub on, so finding it means the scrub missed.
    assert "(TODO" not in body["sections"]["case"]["case"]
    assert "(TODO" not in body["sections"]["taper"]["cdot_reference"]


def test_pending_verification_carries_tracking_issue_constant(
    client: TestClient,
) -> None:
    """The rollup surfaces ``AUDIT_PENDING_VERIFICATION_ISSUE`` verbatim
    so a follow-up patch that fills it in lands the URL in the response.
    """
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=_shoulder_scenario(),
    )
    assert (
        res.json()["pending_verification"]["tracking_issue"]
        == audit_module.AUDIT_PENDING_VERIFICATION_ISSUE
    )


# ---------------------------------------------------------------------------
# Pending-verification scrub — exercise the lane-closure branch directly
# ---------------------------------------------------------------------------


def test_audit_projection_scrubs_lane_closure_todo() -> None:
    """The lane-closure divided branch in build_audit_trail stamps a
    ``(TODO: verify)`` marker into ``case.case``.  The projection must
    scrub that and increment ``pending_verification.count``.

    Done at the projection-helper level (not through the endpoint) so
    we don't have to spin up a lane-closure scenario through the
    ``ENABLED_SCENARIOS`` gate, which is still shoulder-only in v1.
    """
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    raw = audit_module.build_audit_trail([], params, shoulder_width_ft=10.0)
    # Pre-condition: the raw audit still carries the TODO marker.
    assert "(TODO" in raw["case"]["case"]

    projection = audit_module.audit_projection(raw, "lane_closure_divided")
    assert projection["pending_verification"]["count"] == 1
    assert "(TODO" not in projection["sections"]["case"]["case"]
    assert projection["summary"]["ta"] == "TA-19"
    assert projection["summary"]["cdot_sheet"] == "S-630-3"


def test_audit_projection_scrubs_flagger_todo_both_fields() -> None:
    """The flagger branch stamps TODOs into both ``case.case`` and
    ``taper.cdot_reference``.  Both must scrub; the count must be 1
    (same underlying case-#, not double-counted)."""
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=45,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=500.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,  # flagger branch (is_lane and not is_divided)
        jurisdiction="CDOT",
    )
    raw = audit_module.build_audit_trail([], params)
    assert "(TODO" in raw["case"]["case"]
    assert "(TODO" in raw["taper"]["cdot_reference"]

    projection = audit_module.audit_projection(raw, "flagger_lane_closure")
    assert projection["pending_verification"]["count"] == 1
    assert "(TODO" not in projection["sections"]["case"]["case"]
    assert "(TODO" not in projection["sections"]["taper"]["cdot_reference"]
    assert projection["summary"]["ta"] == "TA-10"
    assert projection["summary"]["cdot_sheet"] == "S-630-2"
