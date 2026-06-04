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
from typing import Any

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
    # Plumbing: confirm step_count threads through the endpoint into the
    # summary block.  The fixture is shoulder + short duration, which the
    # TS heuristic at shoulder.ts:59 returned as 8 — same after migration.
    assert res.json()["summary"]["step_count"] == 8


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


def test_audit_projection_lane_closure_divided_case_10_no_pending() -> None:
    """Lane-closure-divided maps to CDOT S-630-1 Case 10 (4-lane divided,
    Sheet 7).  No ``(TODO: verify)`` markers remain in the raw audit —
    the projection rollup count must be 0.

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
    assert raw["case"]["case"] == "Case 10: One Lane Closed - 4-Lane Divided Highway"
    assert raw["taper"]["cdot_reference"] == (
        "CDOT S-630-1 Case 10 (one lane closed on 4-lane divided highway, Sheet 7)"
    )

    projection = audit_module.audit_projection(raw, "lane_closure_divided")
    assert projection["pending_verification"]["count"] == 0
    assert "(TODO" not in projection["sections"]["case"]["case"]
    assert projection["summary"]["ta"] == "TA-19"
    assert projection["summary"]["cdot_sheet"] == "S-630-3"


def test_audit_projection_flagger_mutcd_ta10_no_pending() -> None:
    """Flagger-controlled one-lane two-way cites MUTCD 11th Ed. Part 6
    TA-10 as the primary federal standard.  CDOT S-630-1 has no general
    flagger one-lane two-way case; the narrative notes Case 17 as the
    closest CDOT analog (curve-specialized).  Rollup count must be 0.
    """
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
    assert raw["case"]["case"] == "MUTCD TA-10: Flagger one-lane two-way"
    assert raw["taper"]["cdot_reference"] == (
        "MUTCD 11th Ed. Part 6 TA-10 " "(flagger-controlled one-lane two-way operation)"
    )

    projection = audit_module.audit_projection(raw, "flagger_lane_closure")
    assert projection["pending_verification"]["count"] == 0
    assert "(TODO" not in projection["sections"]["case"]["case"]
    assert "(TODO" not in projection["sections"]["taper"]["cdot_reference"]
    assert projection["summary"]["ta"] == "TA-10"
    assert projection["summary"]["cdot_sheet"] == "S-630-2"


# ---------------------------------------------------------------------------
# Step-count heuristic — port of the per-scenario step-count logic from
# conestruct/site/lib/scenarios/*.ts at SHA e75cfbb.  PR 2a pins the
# port as behavior-preserving so PR 2b can delete the TS estimator
# without changing the OutputCards "Crew instructions" stat.
#
# Each test cites the source TS file + line so a future regression
# points the reviewer at the original heuristic.
# ---------------------------------------------------------------------------


def _shoulder(**overrides) -> Any:
    from src.api.schemas import ShoulderScenario

    defaults = {
        "kind": "shoulder",
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
    return ShoulderScenario(**{**defaults, **overrides})


def _flagger(**overrides) -> Any:
    from src.api.schemas import FlaggerLaneClosureScenario

    defaults = {
        "kind": "flagger_lane_closure",
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
    return FlaggerLaneClosureScenario(**{**defaults, **overrides})


def _lane_closure(**overrides) -> Any:
    from src.api.schemas import LaneClosureDividedScenario

    defaults = {
        "kind": "lane_closure_divided",
        "roadType": "rural_divided",
        "speed": 55,
        "laneWidth": 12.0,
        "workType": "pavement_repair",
        "duration": "short",
        "workLen": 800.0,
        "night": False,
        "truckMountedAttenuator": False,
    }
    return LaneClosureDividedScenario(**{**defaults, **overrides})


def _work_beyond_shoulder(**overrides) -> Any:
    from src.api.schemas import WorkBeyondShoulderScenario

    defaults = {
        "kind": "work_beyond_shoulder",
        "roadType": "rural_undivided",
        "speed": 45,
        "laneWidth": 12.0,
        "workType": "utility",
        "duration": "short",
        "workLen": 200.0,
        "night": False,
    }
    return WorkBeyondShoulderScenario(**{**defaults, **overrides})


def _mobile_2lane(**overrides) -> Any:
    from src.api.schemas import MobileOp2LaneScenario

    defaults = {
        "kind": "mobile_op_2lane",
        "roadType": "rural_undivided",
        "speed": 45,
        "laneWidth": 12.0,
        "workType": "striping",
        "workLen": 200.0,
        "night": False,
        "arrowBoardOnShadow": True,
    }
    return MobileOp2LaneScenario(**{**defaults, **overrides})


def _mobile_multilane(**overrides) -> Any:
    from src.api.schemas import MobileOpMultilaneScenario

    defaults = {
        "kind": "mobile_op_multilane",
        "roadType": "freeway",
        "speed": 65,
        "laneWidth": 12.0,
        "workType": "striping",
        "workLen": 300.0,
        "night": False,
        "secondTMA": False,
    }
    return MobileOpMultilaneScenario(**{**defaults, **overrides})


# --- Basic coverage: one default-input case per scenario kind --------------


def test_step_count_shoulder_short() -> None:
    """Shoulder + short duration → 8 steps.

    Matches lib/scenarios/shoulder.ts:59 at SHA e75cfbb:
      `s.duration === "short" ? 8 : cones > 30 ? 14 : 11`
    """
    assert audit_module._compute_step_count(_shoulder(duration="short")) == 8


def test_step_count_flagger_short_no_options() -> None:
    """Flagger + short + no pilot/pedestrian → 12 steps.

    Matches lib/scenarios/flagger.ts:88 at SHA e75cfbb:
      `let steps = s.duration === "short" ? 12 : 16; ...`
    """
    assert audit_module._compute_step_count(_flagger(duration="short")) == 12


def test_step_count_lane_closure_short_no_tma() -> None:
    """Lane closure + short + no TMA → 14 steps.

    Matches lib/scenarios/lane-closure-divided.ts:80 at SHA e75cfbb:
      `let steps = s.duration === "short" ? 14 : 18; ...`
    """
    assert (
        audit_module._compute_step_count(
            _lane_closure(duration="short", truckMountedAttenuator=False)
        )
        == 14
    )


def test_step_count_work_beyond_shoulder_short() -> None:
    """Work beyond shoulder + short → 4 steps.

    Matches lib/scenarios/work-beyond-shoulder.ts:48 at SHA e75cfbb:
      `const steps = s.duration === "short" ? 4 : 6;`
    """
    assert audit_module._compute_step_count(_work_beyond_shoulder(duration="short")) == 4


def test_step_count_mobile_op_2lane_constant() -> None:
    """Mobile 2-lane → always 6 steps (no inputs vary it).

    Matches lib/scenarios/mobile-2lane.ts:52 at SHA e75cfbb:
      `const steps = 6;`
    """
    assert audit_module._compute_step_count(_mobile_2lane()) == 6
    # Confirm "no inputs vary it" by toggling an input flag and re-asserting.
    assert audit_module._compute_step_count(_mobile_2lane(arrowBoardOnShadow=False)) == 6


def test_step_count_mobile_op_multilane_no_second_tma() -> None:
    """Mobile multilane + no second TMA → 6 steps.

    Matches lib/scenarios/mobile-multilane.ts:32 at SHA e75cfbb:
      `const steps = s.secondTMA ? 8 : 6;`
    """
    assert audit_module._compute_step_count(_mobile_multilane(secondTMA=False)) == 6


# --- Behavior-preservation: every TS branch / conditional increment --------


def test_step_count_shoulder_long_cones_under_threshold() -> None:
    """Shoulder + long + cones ≤ 30 → 11 steps (the lower-branch path).

    Hand calc at SHA e75cfbb (lib/scenarios/shoulder.ts:33-59):
      L = mergingTaperLength(12, 55) = 12 × 55 = 660 ft
      spacing = deviceSpacing(55) = 55 ft
      taperCones = max(4, ceil(660/55)) = max(4, 12) = 12
      tangentCones = ceil(800/55) = ceil(14.55) = 15
      cones = 12 + 15 = 27 ≤ 30
      steps = 11
    """
    assert (
        audit_module._compute_step_count(
            _shoulder(duration="long", speed=55, laneWidth=12.0, workLen=800.0)
        )
        == 11
    )


def test_step_count_shoulder_long_cones_over_threshold() -> None:
    """Shoulder + long + cones > 30 → 14 steps (the upper-branch path).

    Hand calc at SHA e75cfbb (lib/scenarios/shoulder.ts:33-59):
      L = mergingTaperLength(12, 55) = 660 ft
      spacing = 55 ft
      taperCones = 12
      tangentCones = ceil(2000/55) = ceil(36.36) = 37
      cones = 12 + 37 = 49 > 30
      steps = 14

    Pins the cones>30 boundary as the load-bearing branch — if a future
    refactor of _ts_merging_taper_length or the cone-derivation logic
    flips this boundary, the port has drifted from the TS heuristic.
    """
    assert (
        audit_module._compute_step_count(
            _shoulder(duration="long", speed=55, laneWidth=12.0, workLen=2000.0)
        )
        == 14
    )


def test_step_count_flagger_long_pilot_car_only() -> None:
    """Flagger + long + pilotCar → 16 + 2 = 18 steps.

    Matches lib/scenarios/flagger.ts:88-90 at SHA e75cfbb:
      `let steps = s.duration === "short" ? 12 : 16;
       if (s.pilotCar) steps += 2;
       if (s.pedestrianAccess) steps += 1;`
    """
    assert audit_module._compute_step_count(_flagger(duration="long", pilotCar=True)) == 18


def test_step_count_flagger_long_pedestrian_only() -> None:
    """Flagger + long + pedestrianAccess → 16 + 1 = 17 steps.

    Same source as the pilot-car test; pins the +1 increment in isolation.
    """
    assert audit_module._compute_step_count(_flagger(duration="long", pedestrianAccess=True)) == 17


def test_step_count_lane_closure_long_with_tma() -> None:
    """Lane closure + long + TMA → 18 + 2 = 20 steps.

    Matches lib/scenarios/lane-closure-divided.ts:80-81 at SHA e75cfbb:
      `let steps = s.duration === "short" ? 14 : 18;
       if (s.truckMountedAttenuator) steps += 2;`
    """
    assert (
        audit_module._compute_step_count(
            _lane_closure(duration="long", truckMountedAttenuator=True)
        )
        == 20
    )


def test_step_count_mobile_op_multilane_with_second_tma() -> None:
    """Mobile multilane + secondTMA → 8 steps.

    Matches lib/scenarios/mobile-multilane.ts:32 at SHA e75cfbb:
      `const steps = s.secondTMA ? 8 : 6;`
    """
    assert audit_module._compute_step_count(_mobile_multilane(secondTMA=True)) == 8
