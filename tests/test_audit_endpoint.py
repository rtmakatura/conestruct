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
        "MUTCD 11th Ed. Part 6 TA-10 (flagger-controlled one-lane two-way operation)"
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


# ---------------------------------------------------------------------------
# V1-Wide Item 1 — work-zone speed reduction
#
# Covers the four CO Supplement §2B.13(A) cases:
#   1. No reduction (workZoneSpeed omitted)
#   2. Reduction ≤ 15 mph (one advance sign)
#   3. Reduction > 15 mph (stepped signs; pending_verification bumps)
#   4. workZoneSpeed > posted (Pydantic 422)
# Plus the wz == posted normalization (bridge collapses to None).
# Plus a canonical-baseline snapshot match for the no-reduction case.
# ---------------------------------------------------------------------------


def _speed_reduction_check(body: dict) -> dict:
    checks = body["sections"]["colorado"]["checks"]
    return next(c for c in checks if "Speed reduction" in c["label"])


def test_audit_no_reduction_speed_section_pass(client: TestClient) -> None:
    """workZoneSpeed omitted → speed_reduction check passes with the
    no-reduction detail text, posted speed echoed back."""
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_scenario())
    assert res.status_code == 200
    sr = _speed_reduction_check(res.json())
    assert sr["pass"] is True
    assert sr["detail"] == (
        "No work-zone speed reduction. Posted speed 55 mph applies throughout the zone."
    )


def test_audit_small_reduction_one_sign(client: TestClient) -> None:
    """55 → 45 mph (Δ10) → pass=True, "1 advance speed-reduction sign"."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 45
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200
    sr = _speed_reduction_check(res.json())
    assert sr["pass"] is True
    assert "55 → 45 mph" in sr["detail"]
    assert "Δ10 mph" in sr["detail"]
    assert "1 advance speed-reduction sign" in sr["detail"]
    # Small reduction does NOT trigger the stepped-signs pending entry.
    pending = res.json()["pending_verification"]
    items = pending.get("items", [])
    kinds = [item["kind"] for item in items]
    assert "stepped_speed_reduction_signs" not in kinds


def test_audit_large_reduction_pending_bumps_with_36(client: TestClient) -> None:
    """55 → 30 mph (Δ25) → 2 stepped signs required, pending_verification
    gains a stepped_speed_reduction_signs item linking #36."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 30
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200
    body = res.json()
    sr = _speed_reduction_check(body)
    assert sr["pass"] is True
    assert "55 → 30 mph" in sr["detail"]
    assert "Δ25 mph" in sr["detail"]
    assert "2 stepped sign installations" in sr["detail"]
    assert "see #36" in sr["detail"]

    pending = body["pending_verification"]
    assert pending["count"] >= 1
    items = pending["items"]
    kinds = [item["kind"] for item in items]
    assert "stepped_speed_reduction_signs" in kinds
    stepped = next(item for item in items if item["kind"] == "stepped_speed_reduction_signs")
    assert stepped["tracking_issue"] == audit_module.AUDIT_STEPPED_SIGNS_ISSUE


def test_audit_wz_above_posted_rejected(client: TestClient) -> None:
    """workZoneSpeed > posted → Pydantic 422 from the schema validator."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 60  # > posted 55
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 422
    assert "workZoneSpeed" in res.text or "work_zone" in res.text.lower()


def test_audit_wz_equal_to_posted_normalized(client: TestClient) -> None:
    """workZoneSpeed == posted → bridge normalizes to None, audit reads
    "No work-zone speed reduction." Same body as the no-reduction case."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 55  # == posted
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200
    sr = _speed_reduction_check(res.json())
    assert sr["detail"].startswith("No work-zone speed reduction.")


def test_audit_no_reduction_matches_baseline(client: TestClient) -> None:
    """The no-reduction shoulder audit body must match the canonical
    post-Item-1 baseline snapshot byte-for-byte. When future PRs change
    audit shape, this snapshot is regenerated deliberately and the diff
    documented in the PR description."""
    import json
    from pathlib import Path

    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_scenario())
    assert res.status_code == 200
    expected_path = Path("tests/snapshots/audit_shoulder_no_reduction.json")
    expected = json.loads(expected_path.read_text(encoding="utf-8"))
    assert res.json() == expected


# --- Schema validator unit tests (bypass the API; cover edge cases) --------


def test_shoulder_scenario_accepts_wz_below_posted() -> None:
    """workZoneSpeed < posted is accepted by the Pydantic validator."""
    s = _shoulder(workZoneSpeed=45)
    assert s.workZoneSpeed == 45


def test_shoulder_scenario_accepts_wz_equal_to_posted() -> None:
    """workZoneSpeed == posted is accepted; bridge normalizes downstream."""
    s = _shoulder(workZoneSpeed=55)
    assert s.workZoneSpeed == 55


def test_shoulder_scenario_rejects_wz_above_posted() -> None:
    """workZoneSpeed > posted is rejected by the model validator."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        _shoulder(workZoneSpeed=60)
    assert "workZoneSpeed" in str(exc_info.value)


def test_bridge_normalizes_wz_equal_to_posted_to_none() -> None:
    """scenario_to_call collapses workZoneSpeed == posted to None on
    ScenarioParams — equal-to-posted is semantically "no reduction"."""
    from src.api.schemas import scenario_to_call

    params, _gen, _kw = scenario_to_call(_shoulder(workZoneSpeed=55))
    assert params.work_zone_speed_mph is None


def test_bridge_threads_wz_below_posted() -> None:
    """scenario_to_call threads workZoneSpeed < posted through verbatim."""
    from src.api.schemas import scenario_to_call

    params, _gen, _kw = scenario_to_call(_shoulder(workZoneSpeed=45))
    assert params.work_zone_speed_mph == 45


def test_bridge_passes_none_when_wz_omitted() -> None:
    """Default ShoulderScenario (no workZoneSpeed) yields None on params."""
    from src.api.schemas import scenario_to_call

    params, _gen, _kw = scenario_to_call(_shoulder())
    assert params.work_zone_speed_mph is None


# ---------------------------------------------------------------------------
# V1-Wide Item 2 — jurisdiction-aware buffer + CDOT supplement divergence
#
# Three cases covered:
#   A. CDOT + speed in {65, 75}: divergent, full annotation, structured
#      fields present.
#   B. CDOT + speed not in {65, 75}: silent fallback to MUTCD; lookup_text
#      names the silence; structured fields suppressed.
#   C. Snapshot match: re-baselined 55 mph body byte-identical to
#      tests/snapshots/audit_shoulder_no_reduction.json (citation + silent
#      annotation only).
# ---------------------------------------------------------------------------


def _shoulder_at_65() -> dict:
    s = _shoulder_scenario()
    s["roadType"] = "rural_divided"
    s["speed"] = 65
    s["workLen"] = 1200.0
    return s


def _shoulder_at_75() -> dict:
    s = _shoulder_scenario()
    s["roadType"] = "freeway"
    s["speed"] = 75
    s["workLen"] = 1500.0
    return s


def _buffer_section(body: dict) -> dict:
    return body["sections"]["buffer"]


def test_audit_buffer_divergent_at_65_emits_full_annotation(
    client: TestClient,
) -> None:
    """65 mph CDOT: buffer_ft=570; lookup_text carries CDOT/MUTCD
    comparison + Note sentence; structured divergence fields present."""
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_at_65())
    assert res.status_code == 200, res.text
    b = _buffer_section(res.json())
    assert b["buffer_ft"] == 570.0
    assert b["divergence"] is True
    assert b["jurisdiction"] == "CDOT"
    assert b["cdot_value_ft"] == 570
    assert b["mutcd_value_ft"] == 645
    assert "CDOT supplement: 570 ft" in b["lookup_text"]
    assert "MUTCD Table 6C-2: 645 ft" in b["lookup_text"]
    assert "Plan uses CDOT supplement value" in b["lookup_text"]
    assert "Note: CDOT supplement permits shorter buffer" in b["lookup_text"]
    assert "engineering judgment" in b["lookup_text"]
    assert "Case 26 at 65 mph" in b["source"]


def test_audit_buffer_divergent_at_75_emits_full_annotation(
    client: TestClient,
) -> None:
    """75 mph CDOT: buffer_ft=650; lookup_text references Case 27."""
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_at_75())
    assert res.status_code == 200, res.text
    b = _buffer_section(res.json())
    assert b["buffer_ft"] == 650.0
    assert b["divergence"] is True
    assert b["cdot_value_ft"] == 650
    assert b["mutcd_value_ft"] == 820
    assert "CDOT supplement: 650 ft" in b["lookup_text"]
    assert "MUTCD Table 6C-2: 820 ft" in b["lookup_text"]
    assert "Case 27 at 75 mph" in b["source"]


def test_audit_buffer_silent_at_55_names_silence(client: TestClient) -> None:
    """55 mph CDOT: CDOT supplement silent → falls back to MUTCD 495;
    lookup_text names the silence; structured divergence fields suppressed."""
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_scenario())
    assert res.status_code == 200, res.text
    b = _buffer_section(res.json())
    assert b["buffer_ft"] == 495.0
    assert "MUTCD Table 6C-2: 495 ft" in b["lookup_text"]
    assert "(CDOT supplement silent at this speed)" in b["lookup_text"]
    # Suppression check: silent-speed bodies must not carry divergence keys.
    assert "divergence" not in b
    assert "cdot_value_ft" not in b
    assert "mutcd_value_ft" not in b
    assert "jurisdiction" not in b


def test_audit_buffer_value_matches_layout_geometry_at_65() -> None:
    """The buffer_ft the audit reports equals the buffer actually placed
    by the layout. Confirms the Q1 load-bearing invariant: audit doesn't
    lie about geometry."""
    from src.api.audit import build_audit_trail
    from src.api.schemas import scenario_to_call

    s_dict = _shoulder_at_65()
    from src.api.schemas import ShoulderScenario

    scenario = ShoulderScenario(**s_dict)
    params, generator, kwargs = scenario_to_call(scenario)
    placements = generator(params, **kwargs)
    audit = build_audit_trail(placements, params, shoulder_width_ft=10.0)
    audit_buffer = audit["buffer"]["buffer_ft"]
    # Buffer = first taper drum station - work zone length
    from src.rules.devices import DeviceType

    drum_stations = sorted(p.station_ft for p in placements if p.device_type == DeviceType.DRUM)
    actual_taper_downstream = drum_stations[0]
    actual_buffer = actual_taper_downstream - params.work_zone_length_ft
    assert audit_buffer == pytest.approx(actual_buffer, abs=1.0)
    assert audit_buffer == 570.0


def test_audit_buffer_at_65_matches_baseline(client: TestClient) -> None:
    """Canonical snapshot baseline for 65 mph divergent case."""
    import json
    from pathlib import Path

    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_at_65())
    assert res.status_code == 200
    expected = json.loads(
        Path("tests/snapshots/audit_shoulder_65mph.json").read_text(encoding="utf-8")
    )
    assert res.json() == expected


def test_audit_buffer_at_75_matches_baseline(client: TestClient) -> None:
    """Canonical snapshot baseline for 75 mph divergent case."""
    import json
    from pathlib import Path

    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_at_75())
    assert res.status_code == 200
    expected = json.loads(
        Path("tests/snapshots/audit_shoulder_75mph.json").read_text(encoding="utf-8")
    )
    assert res.json() == expected


def test_audit_buffer_55_no_divergence_fields_suppression() -> None:
    """Build-audit-trail directly, no API; assert silent-speed shape
    has none of the structured divergence keys."""
    from src.api.audit import build_audit_trail
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    audit = build_audit_trail([], params, shoulder_width_ft=10.0)
    keys = set(audit["buffer"].keys())
    assert keys == {"speed_mph", "lookup_text", "buffer_ft", "source"}


# --- Federal jurisdiction explicit unit tests ----------------------------


def test_audit_buffer_federal_at_65_uses_mutcd_value() -> None:
    """jurisdiction='federal' bypasses CDOT supplement; audit emits MUTCD value."""
    from src.api.audit import build_audit_trail
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=1200.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="federal",
    )
    audit = build_audit_trail([], params, shoulder_width_ft=10.0)
    b = audit["buffer"]
    assert b["buffer_ft"] == 645.0
    assert b["lookup_text"] == "MUTCD Table 6C-2: 645 ft"
    assert "divergence" not in b


# --- Validator tolerance: CDOT minimum is strict ------------------------


def test_validate_buffer_space_cdot_minimum_enforced_strictly() -> None:
    """At 65 mph CDOT, the validator tolerates no shortfall from the
    570 ft minimum (Q-PLAN-1 answer: regulatory floor)."""
    from src.rules.devices import DeviceType
    from src.rules.validators import (
        DevicePlacement,
        ScenarioParams,
        validate_buffer_space,
    )

    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    # Place a taper whose downstream end leaves a 569 ft buffer — 1 ft
    # short of the CDOT minimum. Federal tolerance (90%) would accept;
    # CDOT-minimum tolerance (100%) must reject.
    placements = [
        DevicePlacement(device_type=DeviceType.DRUM, station_ft=1000.0 + 569.0, offset_ft=24.0),
        DevicePlacement(
            device_type=DeviceType.DRUM, station_ft=1000.0 + 569.0 + 100.0, offset_ft=28.0
        ),
        DevicePlacement(
            device_type=DeviceType.DRUM, station_ft=1000.0 + 569.0 + 200.0, offset_ft=32.0
        ),
    ]
    violations = validate_buffer_space(placements, params)
    assert len(violations) == 1
    assert violations[0].rule_id == "BUFFER_TOO_SHORT"
    assert "no tolerance" in violations[0].message.lower()


def test_validate_buffer_space_federal_at_65_keeps_90_percent_tolerance() -> None:
    """At 65 mph federal, the validator allows 90% of 645 = 580.5 ft
    (advisory value, not regulatory floor)."""
    from src.rules.devices import DeviceType
    from src.rules.validators import (
        DevicePlacement,
        ScenarioParams,
        validate_buffer_space,
    )

    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="federal",
    )
    # 585 ft buffer: above 580.5 ft tolerance threshold for federal 645.
    placements = [
        DevicePlacement(device_type=DeviceType.DRUM, station_ft=1000.0 + 585.0, offset_ft=24.0),
        DevicePlacement(
            device_type=DeviceType.DRUM, station_ft=1000.0 + 585.0 + 100.0, offset_ft=28.0
        ),
        DevicePlacement(
            device_type=DeviceType.DRUM, station_ft=1000.0 + 585.0 + 200.0, offset_ft=32.0
        ),
    ]
    violations = validate_buffer_space(placements, params)
    assert violations == []


# ---------------------------------------------------------------------------
# V1-Wide Item 3 — Fines Double envelope.
#
# Three audit-trail shapes (per Phase B):
#   A. Speed reduced AND scenario applicable → fines_double.applicable=True
#      with envelope geometry + 4 Sheet 12 operational notes.
#   B. Speed reduced AND scenario is flagger → fines_double.applicable=False
#      with carve-out reason (Sheet 12 scope is freeway/expressway).
#   C. No reduction → fines_double key entirely absent (preserves byte-
#      identity of pre-Item-3 no-reduction baselines).
# ---------------------------------------------------------------------------


def test_audit_fines_double_emitted_when_speed_reduced_shoulder_divided(
    client: TestClient,
) -> None:
    """55 → 45 mph reduction on divided shoulder → applicable=True with
    envelope geometry and four Sheet 12 operational notes."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 45
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200
    body = res.json()
    fd = body["sections"]["fines_double"]
    assert fd["applicable"] is True
    assert fd["citation"] == "CO Supplement Sec 2B.13 + S-630-1 Sheet 12 Fines Double Signing Notes"
    assert "envelope" in fd
    assert len(fd["operational_notes"]) == 4
    # All four notes carry the Sheet 12 citation prefix.
    for note in fd["operational_notes"]:
        assert note["citation"].startswith("S-630-1 Sheet 12, Note")
        assert "action" in note and note["action"]


def test_audit_fines_double_envelope_geometry_is_case_11_generic(
    client: TestClient,
) -> None:
    """Envelope uses Case 11 generic 500/500 offsets uniformly — Phase B Q2."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 45  # 55 → 45
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    body = res.json()
    env = body["sections"]["fines_double"]["envelope"]
    # 800 ft work zone: wz_start_st = 800, wz_end_st = 0
    # R2-10 at 800 + 500 = 1300; R2-11 at 0 - 500 = -500
    # downstream R2-1 at 0 - 1000 = -1000
    # envelope length: 1300 - (-500) = 1800 ft
    # n_assemblies: ceil(1800 / 2640) = 1
    assert env["r2_10_station_ft"] == 1300.0
    assert env["r2_11_station_ft"] == -500.0
    assert env["downstream_r2_1_station_ft"] == -1000.0
    assert env["length_ft"] == 1800.0
    assert env["n_assemblies"] == 1
    assert env["downstream_r2_1_label"] == "SPEED LIMIT 55"


def test_audit_fines_double_n_assemblies_scales_with_envelope_length(
    client: TestClient,
) -> None:
    """Long work zone → more 2640 ft assemblies. 5000 ft wz → 6000 ft envelope
    → ceil(6000/2640) = 3 assemblies."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 45
    s["workLen"] = 5000.0
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    env = res.json()["sections"]["fines_double"]["envelope"]
    assert env["length_ft"] == 6000.0
    assert env["n_assemblies"] == 3


def test_audit_fines_double_absent_when_no_reduction(client: TestClient) -> None:
    """No workZoneSpeed → fines_double key entirely absent so the audit
    dict stays byte-identical to pre-Item-3 baselines."""
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_scenario())
    body = res.json()
    assert "fines_double" not in body["sections"]


def test_audit_fines_double_absent_when_speed_equal_to_posted(
    client: TestClient,
) -> None:
    """workZoneSpeed == posted normalizes to None at bridge → fines_double absent."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 55  # == posted
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    body = res.json()
    assert "fines_double" not in body["sections"]


def test_audit_fines_double_carve_out_unit_path() -> None:
    """Direct build_audit_trail call exercises the flagger carve-out
    (applicable=False with reason) — the API path doesn't expose
    workZoneSpeed for flagger in V1, but the audit logic still handles
    a manually-constructed flagger scenario with reduction."""
    from src.api.audit import build_audit_trail
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=45,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=500.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
        work_zone_speed_mph=30,
    )
    audit = build_audit_trail([], params)
    assert "fines_double" in audit
    fd = audit["fines_double"]
    assert fd["applicable"] is False
    assert "freeway/expressway" in fd["reason"]
    assert "MUTCD Part 6E" in fd["reason"]
    # Carve-out doesn't carry envelope / operational_notes — only reason.
    assert "envelope" not in fd
    assert "operational_notes" not in fd


def test_audit_fines_double_lane_closure_divided_emits_envelope() -> None:
    """Lane closure divided (TA-19) with reduction → applicable=True."""
    from src.api.audit import build_audit_trail
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="lane",
        road_type="freeway",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=55,
    )
    audit = build_audit_trail([], params)
    assert audit["fines_double"]["applicable"] is True
    assert audit["fines_double"]["envelope"]["downstream_r2_1_label"] == "SPEED LIMIT 65"


def test_audit_fines_double_off_road_closure_no_envelope() -> None:
    """closure_type='off_road' with reduction → no envelope (not shoulder/lane)."""
    from src.api.audit import build_audit_trail
    from src.rules.validators import ScenarioParams

    # The audit-section gate is purely on reduction; closure_type filtering
    # is handled by the layout/validator. The audit emits when reduction
    # is in effect regardless of closure_type — that is intentional so
    # estimator sees the citation; the layout decides emission per Phase B.
    # But for non-shoulder/lane scenarios the validator's
    # validate_fines_double_envelope also exits early, so the closure_type
    # filter is unit-tested in test_rules.py.
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=40,
    )
    audit = build_audit_trail([], params)
    assert audit["fines_double"]["applicable"] is True


def test_audit_fines_double_reduction_10_matches_baseline(client: TestClient) -> None:
    """The 55→45 mph reduction shoulder audit body must match the
    re-baselined post-Item-3 snapshot byte-for-byte."""
    import json
    from pathlib import Path

    s = _shoulder_scenario()
    s["workZoneSpeed"] = 45
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200
    expected = json.loads(
        Path("tests/snapshots/audit_shoulder_reduction_10.json").read_text(encoding="utf-8")
    )
    assert res.json() == expected


def test_audit_fines_double_reduction_25_matches_baseline(client: TestClient) -> None:
    """The 55→30 mph reduction shoulder audit body must match the
    re-baselined post-Item-3 snapshot byte-for-byte. Carries both the
    fines_double section AND the stepped-signs pending_verification
    entry from Item 1."""
    import json
    from pathlib import Path

    s = _shoulder_scenario()
    s["workZoneSpeed"] = 30
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200
    expected = json.loads(
        Path("tests/snapshots/audit_shoulder_reduction_25.json").read_text(encoding="utf-8")
    )
    assert res.json() == expected


def test_audit_flagger_reduction_carve_out_matches_baseline() -> None:
    """The flagger-with-reduction scenario routes through the unit path
    (build_audit_trail + audit_projection) because the API gates flagger
    in V1. The projection body must match the carve-out canonical
    snapshot byte-for-byte. Pins the applicable=False reason text and
    the wider audit-shape so any silent drift in the carve-out branch
    fails this test."""
    import json
    from pathlib import Path

    from src.api.audit import audit_projection, build_audit_trail
    from src.generation.layout import generate_flagger_alternating_2lane
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=45,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=500.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
        work_zone_speed_mph=30,
    )
    placements = generate_flagger_alternating_2lane(params)
    audit = build_audit_trail(placements, params)
    # step_count=12 mirrors _compute_step_count's FlaggerLaneClosureScenario
    # heuristic for short duration, no pilotCar, no pedestrianAccess.
    projection = audit_projection(audit, scenario_kind="flagger_lane_closure", step_count=12)
    expected = json.loads(
        Path("tests/snapshots/audit_flagger_reduction_carve_out.json").read_text(encoding="utf-8")
    )
    assert projection == expected


def test_audit_fines_double_65mph_envelope_matches_baseline(client: TestClient) -> None:
    """New canonical baseline: 65→60 mph at 65 posted (Case 26 territory),
    envelope emitted with 1000 ft work zone."""
    import json
    from pathlib import Path

    s = _shoulder_scenario()
    s["speed"] = 65
    s["workLen"] = 1000.0
    s["workZoneSpeed"] = 60
    s["roadType"] = "freeway"
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200
    expected = json.loads(
        Path("tests/snapshots/audit_shoulder_reduction_65mph_envelope.json").read_text(
            encoding="utf-8"
        )
    )
    assert res.json() == expected


# ---------------------------------------------------------------------------
# V1-Wide S1 — two-routing case model for shoulder closures.
#
# Routing predicate (`is_reduced = wz_speed is not None and wz_speed < speed`)
# is the single source of truth shared with Item 3's Fines Double gate.
# Shoulder branches into `shoulder_no_reduction` (Case 11) or
# `shoulder_reduced_speed` (Case 26 at 65 mph, Case 27 at 75 mph, or
# Case 11-reduced for other speeds). Sheet 14 trigger callouts surface
# verbatim at 65/75 mph; absent at other speeds (no fixture text).
# Flagger and lane-closure branches are unchanged.
# ---------------------------------------------------------------------------


def _summary(body: dict) -> dict:
    return body["summary"]


def _case_section(body: dict) -> dict:
    return body["sections"]["case"]


def test_case_routing_no_reduction_emits_case_11(client: TestClient) -> None:
    """Default 55 mph shoulder, no work-zone speed → shoulder_no_reduction
    routing, Case 11 label, no trigger_condition."""
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_scenario())
    assert res.status_code == 200
    summary = _summary(res.json())
    assert summary["case_routing"] == "shoulder_no_reduction"
    assert summary["case_id"] == "Case 11: Shoulder closure on divided highway"
    assert "trigger_condition" not in summary


def test_case_routing_reduction_at_55_emits_case_11_variant(client: TestClient) -> None:
    """55 → 45 mph reduction → shoulder_reduced_speed routing, Case 11
    (reduced work-zone speed) label, no trigger_condition (Sheet 14
    doesn't tabulate trigger text at 55 mph)."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 45
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200
    summary = _summary(res.json())
    assert summary["case_routing"] == "shoulder_reduced_speed"
    assert summary["case_id"] == (
        "Case 11 (reduced work-zone speed): Shoulder closure on divided highway"
    )
    assert "trigger_condition" not in summary


def test_case_routing_reduction_at_65_emits_case_26(client: TestClient) -> None:
    """65 → 60 mph reduction → shoulder_reduced_speed routing, Case 26
    label, verbatim 8 ft trigger_condition from Sheet 14."""
    s = _shoulder_scenario()
    s["speed"] = 65
    s["workLen"] = 1000.0
    s["workZoneSpeed"] = 60
    s["roadType"] = "freeway"
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200
    summary = _summary(res.json())
    assert summary["case_routing"] == "shoulder_reduced_speed"
    assert summary["case_id"] == (
        "Case 26 at 65 mph: Shoulder closure with reduced work-zone speed"
    )
    assert summary["trigger_condition"] == (
        "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 8 FT OF TRAVEL WAY"
    )


def test_case_routing_reduction_at_75_emits_case_27(client: TestClient) -> None:
    """75 → 65 mph reduction → shoulder_reduced_speed routing, Case 27
    label, verbatim 10 ft trigger_condition from Sheet 14."""
    s = _shoulder_scenario()
    s["speed"] = 75
    s["workLen"] = 1500.0
    s["workZoneSpeed"] = 65
    s["roadType"] = "freeway"
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200
    summary = _summary(res.json())
    assert summary["case_routing"] == "shoulder_reduced_speed"
    assert summary["case_id"] == (
        "Case 27 at 75 mph: Shoulder closure with reduced work-zone speed"
    )
    assert summary["trigger_condition"] == (
        "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) ARE WITHIN 10 FT OF TRAVEL WAY"
    )


def test_case_routing_section_carries_routing_and_trigger(client: TestClient) -> None:
    """The new fields are also surfaced on the case section (not just
    summary) so audit-section consumers can read them without round-
    tripping through the summary projection."""
    s = _shoulder_scenario()
    s["speed"] = 65
    s["workLen"] = 1000.0
    s["workZoneSpeed"] = 60
    s["roadType"] = "freeway"
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    case = _case_section(res.json())
    assert case["routing"] == "shoulder_reduced_speed"
    assert case["trigger_condition"].startswith("WHEN HAZARDS")


def test_case_routing_gate_parity_with_fines_double_at_boundary() -> None:
    """The S1 routing gate and Item 3 Fines Double gate must agree at
    the boundary (wz_speed == speed → not reduced → no fines_double,
    no routing flip)."""
    from src.api.audit import build_audit_trail
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=55,  # equal to posted — not reduced
    )
    audit = build_audit_trail([], params)
    assert audit["case"]["routing"] == "shoulder_no_reduction"
    assert "fines_double" not in audit


def test_case_routing_gate_parity_with_fines_double_one_step_in() -> None:
    """One step into reduction (wz_speed = speed - 1) → both the
    routing flip and Fines Double envelope fire together."""
    from src.api.audit import build_audit_trail
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=54,
    )
    audit = build_audit_trail([], params)
    assert audit["case"]["routing"] == "shoulder_reduced_speed"
    assert audit["fines_double"]["applicable"] is True


def test_case_routing_flagger_unchanged_no_routing_field() -> None:
    """Flagger scenarios (with or without reduction) do not participate
    in the S1 two-routing model; case.routing is absent so flagger
    snapshots stay byte-identical."""
    from src.api.audit import build_audit_trail
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=45,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=500.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
        work_zone_speed_mph=30,
    )
    audit = build_audit_trail([], params)
    assert audit["case"]["case"] == "MUTCD TA-10: Flagger one-lane two-way"
    assert "routing" not in audit["case"]
    assert "trigger_condition" not in audit["case"]


def test_case_routing_lane_closure_unchanged_no_routing_field() -> None:
    """Lane closure on divided highway → Case 10 unchanged, no routing
    field. S1 is scoped to shoulder."""
    from src.api.audit import build_audit_trail
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="lane",
        road_type="freeway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    audit = build_audit_trail([], params)
    assert audit["case"]["case"] == "Case 10: One Lane Closed - 4-Lane Divided Highway"
    assert "routing" not in audit["case"]
    assert "trigger_condition" not in audit["case"]


def test_case_routing_cdot_reference_aligns_with_routing(client: TestClient) -> None:
    """taper.cdot_reference must agree with case_routing — the audit
    is honest about which CDOT case is being referenced."""
    s = _shoulder_scenario()
    s["speed"] = 65
    s["workLen"] = 1000.0
    s["workZoneSpeed"] = 60
    s["roadType"] = "freeway"
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    taper = res.json()["sections"]["taper"]
    assert "Case 26" in taper["cdot_reference"]
    assert "Sheet 14" in taper["cdot_reference"]


# ---------------------------------------------------------------------------
# V1-Wide G4 — entrance R2-1 envelope fields.
#
# fines_double.envelope grows entrance_r2_1_station_ft +
# entrance_r2_1_label whenever applicable=True. Carve-out (flagger) and
# no-reduction paths stay untouched and continue to omit the section
# entirely — covered by the byte-identity snapshot guard rails above.
# ---------------------------------------------------------------------------


def test_entrance_r2_1_envelope_fields_at_65mph(client: TestClient) -> None:
    """65 → 60 mph reduction → envelope carries entrance R2-1 station
    inside wz and the reduced-limit label."""
    s = _shoulder_scenario()
    s["speed"] = 65
    s["workLen"] = 1000.0
    s["workZoneSpeed"] = 60
    s["roadType"] = "freeway"
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    envelope = res.json()["sections"]["fines_double"]["envelope"]
    # Inside wz (0 < station <= wz_len=1000).
    assert 0 < envelope["entrance_r2_1_station_ft"] <= 1000.0
    assert envelope["entrance_r2_1_label"] == "SPEED LIMIT 60"
    # Both downstream and entrance fields coexist.
    assert envelope["downstream_r2_1_label"] == "SPEED LIMIT 65"


def test_entrance_r2_1_envelope_fields_at_75mph(client: TestClient) -> None:
    """75 → 65 mph reduction → label carries the reduced limit (65)."""
    s = _shoulder_scenario()
    s["speed"] = 75
    s["workLen"] = 1500.0
    s["workZoneSpeed"] = 65
    s["roadType"] = "freeway"
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    envelope = res.json()["sections"]["fines_double"]["envelope"]
    assert envelope["entrance_r2_1_label"] == "SPEED LIMIT 65"
    assert envelope["downstream_r2_1_label"] == "SPEED LIMIT 75"


def test_entrance_r2_1_envelope_fields_at_55mph_case_11_variant(client: TestClient) -> None:
    """Case 11 variant (55 → 50 mph) — entrance R2-1 still emits.
    CO §2B.13(A) is the regulatory driver, not Sheet 14 tabulation."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 50
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    envelope = res.json()["sections"]["fines_double"]["envelope"]
    assert envelope["entrance_r2_1_label"] == "SPEED LIMIT 50"
    assert envelope["downstream_r2_1_label"] == "SPEED LIMIT 55"


def test_entrance_r2_1_absent_on_no_reduction(client: TestClient) -> None:
    """No reduction → fines_double section absent → entrance R2-1
    fields absent. Tested via direct audit builder so a missing
    envelope is unambiguous."""
    from src.api.audit import build_audit_trail
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=None,
    )
    audit = build_audit_trail([], params)
    assert "fines_double" not in audit


def test_entrance_r2_1_absent_on_flagger_carve_out() -> None:
    """Flagger carve-out → fines_double.applicable=False, no envelope dict."""
    from src.api.audit import build_audit_trail
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=45,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=500.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
        work_zone_speed_mph=30,
    )
    audit = build_audit_trail([], params)
    assert audit["fines_double"]["applicable"] is False
    assert "envelope" not in audit["fines_double"]
