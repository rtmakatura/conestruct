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
    # summary block.  The fixture is shoulder, 55 mph, 800 ft work zone:
    # the duration-independent cone derivation yields 11 (taper 12 +
    # tangent 15 = 27 cones <= 30).  See test_step_count_shoulder_*.
    assert res.json()["summary"]["step_count"] == 11


def test_audit_response_has_top_level_keys(client: TestClient) -> None:
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=_shoulder_scenario(),
    )
    body = res.json()
    assert set(body.keys()) == {
        "summary",
        "sections",
        "pending_verification",
        "plan_flags",  # #60 rollup
    }


# ---------------------------------------------------------------------------
# Summary block — the math the TS estimator used to compute
# ---------------------------------------------------------------------------


def test_audit_summary_shoulder_ta_and_sheet(client: TestClient) -> None:
    """Shoulder closure → road-type-aware TA (Refs #100): TA-3 generally,
    TA-5 on a freeway (MUTCD Table 6P-1; TA-2 is the Blasting Zone
    typical and was a transcription error)."""
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=_shoulder_scenario(),
    )
    summary = res.json()["summary"]
    assert summary["ta"] == "TA-3"
    assert summary["cdot_sheet"] == "S-630-1"

    freeway = {**_shoulder_scenario(), "roadType": "freeway", "speed": 65}
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=freeway,
    )
    summary = res.json()["summary"]
    assert summary["ta"] == "TA-5"
    assert summary["cdot_sheet"] == "S-630-1"


def test_audit_summary_taper_buffer_spacing_match_spacing_py(
    client: TestClient,
) -> None:
    """Summary math matches the spacing.py primitives directly.

    Shoulder closure on a divided highway, 55 mph, 10-ft shoulder offset:
      L (full merging taper) = 10 × 55 = 550 ft  (high-speed L = W × S
        regime at 55 mph; the W is the offset being closed off, which
        is the shoulder width for a shoulder closure, not the lane width)
      Shoulder taper = L/3 = 183.33 ft, displayed rounded to 183 ft (#93
        whole-feet display rounding) — NOT the full 550 ft.
      buffer = 495 ft (Table 6B-2).
      in-taper spacing = 55 ft, on-tangent spacing = 110 ft (§6C.09).

    The 183 ft vs 550 ft distinction is load-bearing: confusing the
    shoulder taper with the full merging taper would under-spec a
    shoulder closure (a class of bug we've been chasing this week).
    Asserting the displayed 183 directly — not the formula — so a
    future reader cannot misread the literal as "550 ft taper."
    """
    res = client.post(
        "/render/audit",
        headers=_auth_headers(),
        json=_shoulder_scenario(),
    )
    summary = res.json()["summary"]
    assert summary["taper_length_ft"] == 183
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
    # PR 3 citation correction: the validated flagger fixtures are
    # S-630-1 (Sheet 9 Case 17 / Sheet 25 Case 42).
    assert projection["summary"]["cdot_sheet"] == "S-630-1"


@pytest.mark.parametrize("speed", [55, 60, 65, 70, 75])
@pytest.mark.parametrize("road_type", ["urban_low", "urban_high", "rural", "expressway", "freeway"])
def test_audit_road_type_text_sourced_from_lookup_value(road_type: str, speed: int) -> None:
    """#55 parity: the displayed Table 6B-1 category is the same value fed
    to ``advance_warning_spacing`` (``rt_for_lookup``), not a parallel
    ``_resolve_road_category`` copy.  For every valid Table 6B-1 category
    at 55-75 mph the ``road_type_text`` echoes ``road_type`` unchanged —
    this locks the consolidated display against regression."""
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=speed,
        num_lanes=2,
        closure_type="shoulder",
        road_type=road_type,
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    raw = audit_module.build_audit_trail([], params)
    assert raw["advance"]["road_type_text"] == (
        f"Speed {speed} mph, road_type = '{road_type}' -> Table 6B-1 category: {road_type}"
    )


def test_build_audit_trail_raises_on_non_category_road_type_at_high_speed() -> None:
    """#55: the canonical ``advance_warning_spacing`` raise governs the
    55+ / non-Table-6B-1 case and fires before any displayed category is
    resolved — documenting that the deleted ``_resolve_road_category``
    lenient 'rural at 55+' branch was dead code.  A non-category road_type
    at 55 mph never reaches a display string; it raises at the lookup."""
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="divided_highway",  # not a Table 6B-1 category
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    with pytest.raises(ValueError, match="explicit road_type"):
        audit_module.build_audit_trail([], params)


def test_flagger_lighting_check_day_passes_night_fails() -> None:
    """PR 3 B5: the lighting check (CO Sec 6E.02(A) / Sheet 2 Note 22)
    was inverted — ``pass = params.is_night`` failed daytime plans on a
    rule that does not apply and passed night plans that ship no
    lighting equipment.  Now: day -> pass (not required); night ->
    honest fail (Required ... Placed: 0) with a
    flagger_lighting_manual_handling pending item in lockstep."""
    from src.generation.layout import generate_flagger_alternating_2lane
    from src.rules.validators import ScenarioParams

    def _params(night: bool) -> ScenarioParams:
        return ScenarioParams(
            speed_mph=45,
            num_lanes=2,
            closure_type="lane",
            road_type="rural",
            work_zone_length_ft=500.0,
            lane_width_ft=11.0,
            shoulder_width_ft=8.0,
            is_divided=False,
            is_night=night,
            jurisdiction="CDOT",
        )

    def _lighting_check(audit: dict) -> dict:
        return next(
            c
            for c in audit["colorado"]["checks"]
            if c["label"].startswith("Flagger station lighting")
        )

    # Day: lighting not required -> pass, no pending item.
    day_params = _params(night=False)
    day_audit = audit_module.build_audit_trail(
        generate_flagger_alternating_2lane(day_params), day_params
    )
    day_check = _lighting_check(day_audit)
    assert day_check["pass"] is True
    assert "not required" in day_check["detail"]
    day_proj = audit_module.audit_projection(day_audit, "flagger_lane_closure")
    assert day_proj["pending_verification"]["count"] == 0

    # Night: required, none placed -> honest fail + pending item.
    night_params = _params(night=True)
    night_audit = audit_module.build_audit_trail(
        generate_flagger_alternating_2lane(night_params), night_params
    )
    night_check = _lighting_check(night_audit)
    assert night_check["pass"] is False
    assert "Placed: 0" in night_check["detail"]
    assert night_audit["colorado"]["all_pass"] is False
    night_proj = audit_module.audit_projection(night_audit, "flagger_lane_closure")
    kinds = [it["kind"] for it in night_proj["pending_verification"]["items"]]
    assert "flagger_lighting_manual_handling" in kinds
    item = next(
        it
        for it in night_proj["pending_verification"]["items"]
        if it["kind"] == "flagger_lighting_manual_handling"
    )
    assert "Sheet 2 Note 22" in item["label"]
    assert item["tracking_issue"] == audit_module.AUDIT_PENDING_VERIFICATION_ISSUE


# ---------------------------------------------------------------------------
# #60 plan_flags rollup — the single derived verdict the status strip
# reads instead of re-deriving "is this plan clean."  Three categories
# (validation_warnings / compliance_fails / v1_limitations) + an
# ``is_clean`` verdict true only when all three are zero.  The strip used
# to flip green on validation warnings alone, hiding compliance fails and
# V1 limitations the audit panel surfaced.
# ---------------------------------------------------------------------------


def test_plan_flags_clean_shoulder_is_clean() -> None:
    """A default shoulder plan trips nothing — green-READY stays correct."""
    from src.generation.layout import generate_shoulder_closure_divided
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=4,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    raw = audit_module.build_audit_trail(generate_shoulder_closure_divided(params), params)
    flags = audit_module.audit_projection(raw, "shoulder", road_type="freeway")["plan_flags"]
    assert flags == {
        "validation_warnings": 0,
        "compliance_fails": 0,
        "v1_limitations": 0,
        "is_clean": True,
    }


def test_plan_flags_night_flagger_not_clean() -> None:
    """Acceptance: a night flagger plan has a failing lighting check AND a
    V1 limitation — it must NOT read clean (the strip must go off-green)."""
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
        is_night=True,
        jurisdiction="CDOT",
    )
    raw = audit_module.build_audit_trail(generate_flagger_alternating_2lane(params), params)
    flags = audit_module.audit_projection(raw, "flagger_lane_closure")["plan_flags"]
    assert flags["is_clean"] is False
    assert flags["compliance_fails"] >= 1  # night lighting check fails
    assert flags["v1_limitations"] >= 1  # flagger_lighting_manual_handling


def test_plan_flags_reduced_speed_flagger_is_clean() -> None:
    """Documents the live state of the issue's second acceptance scenario:
    the Item 3 / PR 2 correction made the flagger generator emit the Fines
    Double envelope, so a reduced-speed (daytime) flagger has no carve-out,
    no pending item, and no failing check — it is genuinely clean.  The
    rollup must NOT fabricate a flag here."""
    from src.generation.layout import generate_flagger_alternating_2lane
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=45,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        work_zone_speed_mph=35,
        jurisdiction="CDOT",
    )
    raw = audit_module.build_audit_trail(generate_flagger_alternating_2lane(params), params)
    proj = audit_module.audit_projection(raw, "flagger_lane_closure")
    assert proj["sections"]["fines_double"]["applicable"] is True
    assert proj["plan_flags"]["is_clean"] is True


def test_plan_flags_counts_validation_warnings() -> None:
    """A soft geometry warning (work-zone short vs buffer; 200 OK, no
    error) counts as a validation warning and flips is_clean false — and
    the count mirrors the geometry_validation.violations the strip's
    collectValidationWarnings reads, so the two never diverge."""
    from src.generation.layout import generate_shoulder_closure_divided
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=65,
        num_lanes=4,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=300.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    raw = audit_module.build_audit_trail(generate_shoulder_closure_divided(params), params)
    proj = audit_module.audit_projection(raw, "shoulder", road_type="freeway")
    n_violations = len(proj["sections"]["geometry_validation"]["violations"])
    assert n_violations >= 1
    flags = proj["plan_flags"]
    assert flags["validation_warnings"] == n_violations
    assert flags["compliance_fails"] == 0
    assert flags["v1_limitations"] == 0
    assert flags["is_clean"] is False


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


def test_step_count_shoulder_duration_independent() -> None:
    """Shoulder step count does not depend on duration (Refs #90).

    CDOT S-630 has no reduced short-duration stationary shoulder case —
    Cases 11/26/27 are the layout regardless of duration, and the
    layout/devices/crew narrative all ignore ``duration``.  So flipping
    only ``duration`` must not move the crew-step count: both resolve to
    the cone-derived value.  For the 55 mph / 800 ft fixture that is 11
    (taper 12 + tangent 15 = 27 cones <= 30).
    """
    short = audit_module._compute_step_count(
        _shoulder(duration="short", speed=55, laneWidth=12.0, workLen=800.0)
    )
    long = audit_module._compute_step_count(
        _shoulder(duration="long", speed=55, laneWidth=12.0, workLen=800.0)
    )
    assert short == long == 11


def test_step_count_flagger_duration_independent() -> None:
    """Flagger step count does not depend on duration (Refs #92).

    CDOT S-630 has no reduced short-duration flagger case — General Note 28
    makes the typical cases minimums, and a flagger is the control itself
    with nothing to substitute.  The layout/devices/crew narrative all
    ignore ``duration``, so flipping only ``duration`` must not move the
    crew-step count: both resolve to the flat base of 16 (no options).
    """
    short = audit_module._compute_step_count(_flagger(duration="short"))
    long = audit_module._compute_step_count(_flagger(duration="long"))
    assert short == long == 16


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


def test_step_count_shoulder_cones_under_threshold() -> None:
    """Shoulder, cones ≤ 30 → 11 steps (the lower cone-count branch).

    Hand calc (cone derivation in _compute_step_count):
      L = mergingTaperLength(12, 55) = 12 × 55 = 660 ft
      spacing = deviceSpacing(55) = 55 ft
      taperCones = max(4, ceil(660/55)) = max(4, 12) = 12
      tangentCones = ceil(800/55) = ceil(14.55) = 15
      cones = 12 + 15 = 27 ≤ 30
      steps = 11
    """
    assert (
        audit_module._compute_step_count(_shoulder(speed=55, laneWidth=12.0, workLen=800.0)) == 11
    )


def test_step_count_shoulder_cones_over_threshold() -> None:
    """Shoulder, cones > 30 → 14 steps (the upper cone-count branch).

    Hand calc (cone derivation in _compute_step_count):
      L = mergingTaperLength(12, 55) = 660 ft
      spacing = 55 ft
      taperCones = 12
      tangentCones = ceil(2000/55) = ceil(36.36) = 37
      cones = 12 + 37 = 49 > 30
      steps = 14

    Pins the cones>30 boundary as the load-bearing branch — if a future
    refactor of _ts_merging_taper_length or the cone-derivation logic
    flips this boundary, the step count has drifted.
    """
    assert (
        audit_module._compute_step_count(_shoulder(speed=55, laneWidth=12.0, workLen=2000.0)) == 14
    )


# --- #67: TS-estimator taper threshold routed through the shared constant ---
#
# _ts_merging_taper_length used a hardcoded ``>= 40``, independent of the shared
# TAPER_LENGTH_FORMULA_THRESHOLD_MPH (now 45 after the 40->45 taper fix).  The
# only speed in [40, 45) is 40, so the correction touches 40 mph ONLY: it moves
# from the linear W*S regime to the spec-exact quadratic W*S^2/60.  These tests
# pin the 40-mph correction and prove every other speed is byte-identical.


def test_ts_merging_taper_length_40mph_now_quadratic() -> None:
    """40 mph uses W*S^2/60 (was the linear W*S before #67).

    L(12, 40) = 12 * 40^2 / 60 = 12 * 1600 / 60 = 320 ft (was 12 * 40 = 480).
    This is the single behavioral change in #67.
    """
    assert audit_module._ts_merging_taper_length(12.0, 40) == 320


def test_ts_merging_taper_length_other_speeds_unchanged() -> None:
    """Only 40 mph moved: >=45 stays linear, <40 stays quadratic.

    L(12, 45) = 12 * 45 = 540 ft  (linear, at/above threshold — unchanged)
    L(12, 35) = 12 * 35^2 / 60 = 14700 / 60 = 245 ft  (quadratic — unchanged)
    """
    assert audit_module._ts_merging_taper_length(12.0, 45) == 540
    assert audit_module._ts_merging_taper_length(12.0, 35) == 245


def test_step_count_shoulder_long_40mph_flips_to_11() -> None:
    """40 mph long shoulder at workLen 800 ft → 11 (was 14 before #67).

    Hand calc with the corrected quadratic taper at 40 mph:
      L = _ts_merging_taper_length(12, 40) = 320 ft
      spacing = 40 ft (TS deviceSpacing = posted speed)
      taper_cones = max(4, ceil(320/40)) = 8
      tangent_cones = ceil(800/40) = 20
      cones = 8 + 20 = 28 <= 30  ->  11 steps
    Pre-#67 the linear L=480 gave taper_cones=12, cones=32 > 30 -> 14.
    """
    assert (
        audit_module._compute_step_count(
            _shoulder(duration="long", speed=40, laneWidth=12.0, workLen=800.0)
        )
        == 11
    )


def test_step_count_shoulder_long_40mph_flip_confined() -> None:
    """The 40-mph flip is confined to the ~720-880 ft band, not a blanket change.

    Above the band (workLen 2000) both regimes clear cones > 30, so step_count
    stays 14; below it (workLen 500) both stay <= 30, so step_count stays 11.
    Only job lengths whose cone count straddles 30 between the two regimes flip.
      workLen 2000: tangent = ceil(2000/40) = 50; cones = 8 + 50 = 58 > 30 -> 14
      workLen 500:  tangent = ceil(500/40)  = 13; cones = 8 + 13 = 21 <= 30 -> 11
    """
    assert (
        audit_module._compute_step_count(
            _shoulder(duration="long", speed=40, laneWidth=12.0, workLen=2000.0)
        )
        == 14
    )
    assert (
        audit_module._compute_step_count(
            _shoulder(duration="long", speed=40, laneWidth=12.0, workLen=500.0)
        )
        == 11
    )


def test_step_count_flagger_pilot_car_only() -> None:
    """Flagger + pilotCar → 16 + 2 = 18 steps.

    Base 16 (duration-independent since #92) plus the +2 pilot-car modifier:
      `steps = 16; if (pilotCar) steps += 2; if (pedestrianAccess) steps += 1;`
    """
    assert audit_module._compute_step_count(_flagger(pilotCar=True)) == 18


def test_step_count_flagger_pedestrian_only() -> None:
    """Flagger + pedestrianAccess → 16 + 1 = 17 steps.

    Same source as the pilot-car test; pins the +1 increment in isolation.
    """
    assert audit_module._compute_step_count(_flagger(pedestrianAccess=True)) == 17


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
    """55 → 45 mph (Δ10) → pass=True, detail carries Required: 1 / Placed: 1
    (G5 — layout engine emits the W3-5 advisory)."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 45
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200
    sr = _speed_reduction_check(res.json())
    assert sr["pass"] is True
    assert "55 → 45 mph" in sr["detail"]
    assert "Δ10 mph" in sr["detail"]
    assert "Required: 1" in sr["detail"]
    assert "Placed: 1" in sr["detail"]
    # Small reduction does NOT trigger the stepped-signs pending entry.
    pending = res.json()["pending_verification"]
    items = pending.get("items", [])
    kinds = [item["kind"] for item in items]
    assert "stepped_speed_reduction_signs" not in kinds


def test_audit_large_reduction_emits_stepped_w3_5(client: TestClient) -> None:
    """55 → 30 mph (Δ25) → 2 stepped W3-5 signs emitted by the layout
    engine (G5).  Detail carries Required: 2 stepped sign installations
    + Placed: 2; the pre-G5 stepped_speed_reduction_signs pending entry
    is retired now that the gap is closed."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 30
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200
    body = res.json()
    sr = _speed_reduction_check(body)
    assert sr["pass"] is True
    assert "55 → 30 mph" in sr["detail"]
    assert "Δ25 mph" in sr["detail"]
    assert "Required: 2 stepped sign installations" in sr["detail"]
    assert "Placed: 2" in sr["detail"]

    pending = body["pending_verification"]
    items = pending.get("items", [])
    kinds = [item["kind"] for item in items]
    assert "stepped_speed_reduction_signs" not in kinds


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


def test_audit_buffer_at_65_no_reduction_uses_federal(client: TestClient) -> None:
    """65 mph CDOT, no reduction: the Case 26 570 ft minimum is SSD at the
    65 -> 60 step-down, which is absent here, so the federal posted-speed
    value (645) governs (Sheet 7 Case 11, buffer VARIES).  No divergence;
    lookup_text explains why 570 does not apply; source cites Case 11."""
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_at_65())
    assert res.status_code == 200, res.text
    b = _buffer_section(res.json())
    assert b["buffer_ft"] == 645.0
    # Divergence (and its structured fields) suppressed — the supplement
    # minimum does not govern.
    assert "divergence" not in b
    assert "cdot_value_ft" not in b
    assert "mutcd_value_ft" not in b
    assert "MUTCD Table 6B-2: 645 ft" in b["lookup_text"]
    assert "Case 26" in b["lookup_text"]  # cited only to explain non-application
    assert "no qualifying" in b["lookup_text"]
    assert "Case 26 at 65 mph" not in b["source"]
    assert "Case 11" in b["source"]


def test_audit_buffer_at_65_with_case_26_stepdown_diverges(client: TestClient) -> None:
    """65 -> 60 (Case 26 mandated step-down): the CDOT supplement 570 ft
    minimum applies; full divergence annotation citing Case 26."""
    s = _shoulder_at_65()
    s["workZoneSpeed"] = 60
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200, res.text
    b = _buffer_section(res.json())
    assert b["buffer_ft"] == 570.0
    assert b["divergence"] is True
    assert b["jurisdiction"] == "CDOT"
    assert b["cdot_value_ft"] == 570
    assert b["mutcd_value_ft"] == 645
    assert "CDOT supplement: 570 ft" in b["lookup_text"]
    assert "MUTCD Table 6B-2: 645 ft" in b["lookup_text"]
    assert "Plan uses CDOT supplement value" in b["lookup_text"]
    assert "Case 26 at 65 mph" in b["source"]


def test_audit_buffer_at_75_no_reduction_uses_federal(client: TestClient) -> None:
    """75 mph CDOT, no reduction: federal posted-speed value (820) governs;
    the Case 27 650 ft minimum needs the 75 -> 65 step-down."""
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_at_75())
    assert res.status_code == 200, res.text
    b = _buffer_section(res.json())
    assert b["buffer_ft"] == 820.0
    assert "divergence" not in b
    assert "MUTCD Table 6B-2: 820 ft" in b["lookup_text"]
    assert "Case 27" in b["lookup_text"]
    assert "Case 27 at 75 mph" not in b["source"]
    assert "Case 11" in b["source"]


def test_audit_buffer_at_75_with_case_27_stepdown_diverges(client: TestClient) -> None:
    """75 -> 65 (Case 27 mandated step-down): CDOT supplement 650 ft minimum
    applies; divergence annotation references Case 27."""
    s = _shoulder_at_75()
    s["workZoneSpeed"] = 65
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200, res.text
    b = _buffer_section(res.json())
    assert b["buffer_ft"] == 650.0
    assert b["divergence"] is True
    assert b["cdot_value_ft"] == 650
    assert b["mutcd_value_ft"] == 820
    assert "CDOT supplement: 650 ft" in b["lookup_text"]
    assert "MUTCD Table 6B-2: 820 ft" in b["lookup_text"]
    assert "Case 27 at 75 mph" in b["source"]


def test_audit_buffer_at_65_non_standard_reduction_uses_federal(client: TestClient) -> None:
    """65 -> 55 (Δ10, not the Case 26 65 -> 60 step-down): the 570 ft
    minimum must NOT apply; the federal posted-speed value (645) governs."""
    s = _shoulder_at_65()
    s["workZoneSpeed"] = 55
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200, res.text
    b = _buffer_section(res.json())
    assert b["buffer_ft"] == 645.0
    assert "divergence" not in b
    assert "Case 26 at 65 mph" not in b["source"]


def test_audit_taper_and_buffer_cite_consistent_case_at_65(client: TestClient) -> None:
    """The taper cdot_reference and the buffer source must not contradict on
    Case identity: no-reduction 65 → neither cites Case 26; the 65 -> 60
    step-down → both cite Case 26."""
    no_reduction = client.post(
        "/render/audit", headers=_auth_headers(), json=_shoulder_at_65()
    ).json()
    taper_ref = no_reduction["sections"]["taper"]["cdot_reference"]
    buf_src = no_reduction["sections"]["buffer"]["source"]
    assert "Case 26" not in taper_ref
    assert "Case 26" not in buf_src

    s = _shoulder_at_65()
    s["workZoneSpeed"] = 60
    reduced = client.post("/render/audit", headers=_auth_headers(), json=s).json()
    assert "Case 26" in reduced["sections"]["taper"]["cdot_reference"]
    assert "Case 26 at 65 mph" in reduced["sections"]["buffer"]["source"]


def test_audit_taper_case_buffer_cite_same_case_across_reduction_types(client: TestClient) -> None:
    """Commit 2 invariant: taper.cdot_reference, case.case, and buffer.source
    must name the SAME CDOT case for every reduction type — no reduction
    (Case 11), the qualifying Case 26/27 step-down (65->60, 75->65), and a
    non-standard reduction (65->55, which must read Case 11, not Case 26)."""

    def case_token(text: str) -> str:
        for c in ("Case 26", "Case 27", "Case 11"):
            if c in text:
                return c
        raise AssertionError(f"no Case token in: {text!r}")

    def scenario(speed: int, wz: int | None) -> dict:
        s = _shoulder_at_65() if speed == 65 else _shoulder_at_75()
        if wz is not None:
            s["workZoneSpeed"] = wz
        return s

    matrix = [
        (65, None, "Case 11"),
        (65, 60, "Case 26"),
        (65, 55, "Case 11"),  # non-standard reduction → NOT Case 26
        (75, None, "Case 11"),
        (75, 65, "Case 27"),
        (75, 70, "Case 11"),  # non-standard reduction → NOT Case 27
    ]
    for speed, wz, expected in matrix:
        body = client.post(
            "/render/audit", headers=_auth_headers(), json=scenario(speed, wz)
        ).json()
        sec = body["sections"]
        taper_c = case_token(sec["taper"]["cdot_reference"])
        case_c = case_token(sec["case"]["case"])
        buffer_c = case_token(sec["buffer"]["source"])
        assert taper_c == case_c == buffer_c == expected, (
            f"speed={speed} wz={wz}: taper={taper_c} case={case_c} "
            f"buffer={buffer_c} expected={expected}"
        )


def test_audit_buffer_silent_at_55_names_silence(client: TestClient) -> None:
    """55 mph CDOT: CDOT supplement silent → falls back to MUTCD 495;
    lookup_text names the silence; structured divergence fields suppressed."""
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_scenario())
    assert res.status_code == 200, res.text
    b = _buffer_section(res.json())
    assert b["buffer_ft"] == 495.0
    assert "MUTCD Table 6B-2: 495 ft" in b["lookup_text"]
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
    # No reduction at 65 mph → federal posted-speed buffer (645), not the
    # Case 26 570 ft minimum.  Audit and drawn geometry move together.
    assert audit_buffer == 645.0


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
    # ``citation`` (#97) is always present on every buffer variant; the
    # divergence STRUCTURED keys (jurisdiction / cdot_value_ft /
    # mutcd_value_ft / divergence) are what must be suppressed at a silent
    # speed — and they remain absent here.
    assert keys == {"speed_mph", "lookup_text", "buffer_ft", "source", "citation"}


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
    assert b["lookup_text"] == "MUTCD Table 6B-2: 645 ft"
    assert "divergence" not in b


# --- Validator tolerance: CDOT minimum is strict ------------------------


def test_validate_buffer_space_cdot_minimum_enforced_strictly() -> None:
    """At 65 -> 60 mph CDOT (Case 26 step-down), the validator tolerates no
    shortfall from the 570 ft minimum (Q-PLAN-1 answer: regulatory floor).
    The strict floor binds only on this qualifying reduction; a plain 65 mph
    closure carries the federal 645 ft advisory value at 90% tolerance
    (see test_validate_buffer_space_federal_at_65_keeps_90_percent_tolerance)."""
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
        work_zone_speed_mph=60,  # Case 26 step-down unlocks the strict 570 ft floor
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
# Two audit-trail shapes:
#   A. Speed reduced → fines_double.applicable=True with envelope
#      geometry + 4 Sheet 12 operational notes.  Flagger bodies carry
#      the Case-42 chain-insertion geometry (per-direction mirrored
#      sets + gating text) since the Item 3 retroactive correction
#      PR 2; shoulder/lane-divided keep the Case-11 generic formula.
#   B. No reduction → fines_double key entirely absent (preserves byte-
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


def test_audit_fines_double_flagger_envelope_unit_path() -> None:
    """Direct build_audit_trail call exercises the flagger branch
    (Item 3 retroactive correction PR 2: applicable=True with the
    Case-42 chain-insertion envelope geometry from
    flagger_chain_stations) — the API path doesn't expose workZoneSpeed
    for flagger in V1, but the audit logic still handles a
    manually-constructed flagger scenario with reduction."""
    from src.api.audit import build_audit_trail
    from src.generation.layout import flagger_chain_stations
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
    assert fd["applicable"] is True
    assert "LANE CLOSURE is a listed qualifying hazard" in fd["gating"]
    assert "v1_limitation" not in fd
    assert "reason" not in fd
    st = flagger_chain_stations(params)
    env = fd["envelope"]
    assert env["r2_10_station_ft"] == st["r2_10_r"]
    assert env["r2_11_station_ft"] == st["r2_11_r"]
    assert env["r2_10_station_ft_opposing"] == st["r2_10_l"]
    assert env["mirrored_per_direction"] is True
    assert env["entrance_r2_1_label"] == "SPEED LIMIT 30"
    assert env["downstream_r2_1_label"] == "SPEED LIMIT 45"
    assert "Case-11 generic formula" in env["geometry_note"]
    assert len(fd["operational_notes"]) == 4


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


def test_audit_flagger_reduction_fines_double_required_matches_baseline() -> None:
    """The flagger-with-reduction scenario routes through the unit path
    (build_audit_trail + audit_projection) because the API gates flagger
    in V1. The projection body must match the corrected canonical
    snapshot byte-for-byte (Item 3 retroactive correction PR 2):
    fines_double applicable=True with the Case-42 chain-insertion
    envelope geometry, the colorado speed-reduction check passing
    (per-direction W3-5 emitted), and an empty pending_verification
    rollup (the interim manual-handling item is gone)."""
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
    # step_count=16 mirrors _compute_step_count's FlaggerLaneClosureScenario
    # base (duration-independent since #92), no pilotCar, no pedestrianAccess.
    projection = audit_projection(audit, scenario_kind="flagger_lane_closure", step_count=16)
    expected = json.loads(
        Path("tests/snapshots/audit_flagger_reduction_fines_double_required.json").read_text(
            encoding="utf-8"
        )
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


def test_entrance_r2_1_present_on_flagger_envelope() -> None:
    """Flagger + reduction → fines_double envelope carries the G4
    entrance R2-1 at the §6C.06(A) plaque anchor (Item 3 retroactive
    correction PR 2: the flagger generator emits the envelope, so the
    audit reports real geometry)."""
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
    assert audit["fines_double"]["applicable"] is True
    env = audit["fines_double"]["envelope"]
    # 500 ft wz with the reduced chain → 2 plaques → anchor at
    # (2 - 0.5) / 2 * 500 = 375 ft (inside the work zone).
    assert env["entrance_r2_1_station_ft"] == 375.0
    assert 0 < env["entrance_r2_1_station_ft"] <= params.work_zone_length_ft


# ---------------------------------------------------------------------------
# V1-Wide G5 — W3-5 advisory-speed sign placement (CO §2B.13(A)).
#
# The CO §2B.13(A) audit check now carries the Placed: N suffix and
# passes iff placed ≥ required (was unconditionally True under the
# pre-G5 audit-honesty semantics).  Flagger reduced-speed flows
# through the same computation and, since the Item 3 retroactive
# correction PR 2, passes — the flagger layout emits the per-direction
# W3-5 set.  Δ > 15 retires the stepped_speed_reduction_signs
# pending_verification entry because the layout engine now emits the
# stepped sequence.
# ---------------------------------------------------------------------------


def _co_2b13_check(body: dict) -> dict:
    """The §2B.13(A) row in colorado.checks — third entry, after both-sides
    and plaques — pulled out as a helper so the G5 tests stay readable."""
    return body["sections"]["colorado"]["checks"][2]


def test_co_2b13_check_at_65mph_reduction_reports_placed_1(client: TestClient) -> None:
    """65 → 60 (Δ=5, N=1) → §2B.13(A) detail carries `Placed: 1`."""
    s = _shoulder_scenario()
    s["speed"] = 65
    s["workLen"] = 1000.0
    s["workZoneSpeed"] = 60
    s["roadType"] = "freeway"
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    check = _co_2b13_check(res.json())
    assert "Required: 1" in check["detail"]
    assert "Placed: 1" in check["detail"]
    assert check["pass"] is True


def test_co_2b13_check_at_55_to_30_reduction_reports_placed_2_stepped(client: TestClient) -> None:
    """55 → 30 (Δ=25, N=2 stepped) → §2B.13(A) detail carries
    `Required: 2 stepped sign installations` + `Placed: 2`, passes."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 30
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    check = _co_2b13_check(res.json())
    assert "Required: 2 stepped sign installations" in check["detail"]
    assert "Placed: 2" in check["detail"]
    assert check["pass"] is True


def test_co_2b13_check_no_reduction_reports_not_applicable(client: TestClient) -> None:
    """No reduction → §2B.13(A) detail explicit `No work-zone speed reduction`."""
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_scenario())
    check = _co_2b13_check(res.json())
    assert "No work-zone speed reduction" in check["detail"]
    assert check["pass"] is True


def test_co_2b13_check_flagger_reduction_passes_with_emission() -> None:
    """Flagger reduced-speed flows through the same required-vs-placed
    computation as every other scenario (Item 3 retroactive correction:
    §2B.13(A) carries no road-class scoping). Since PR 2 the flagger
    layout emits the W3-5 set, so the check passes honestly.  Note the
    Placed count reads right-side placements only (offset > 0) — the
    per-direction mirror set counts 1 per step on this check."""
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
    body = audit_projection(audit, scenario_kind="flagger_lane_closure")
    check = _co_2b13_check(body)
    assert "Required: 1. Placed: 1." in check["detail"]
    assert check["pass"] is True
    # The interim fines_double_manual_handling pending item is gone.
    pending = body["pending_verification"]
    assert pending["count"] == 0
    assert "items" not in pending


def test_stepped_signs_pending_entry_retired(client: TestClient) -> None:
    """G5 retires the stepped_speed_reduction_signs pending_verification
    entry: Δ > 15 reductions no longer surface a pending entry because
    the layout engine emits the stepped sequence."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = 30  # Δ = 25, pre-G5 would surface stepped pending
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    pending = res.json()["pending_verification"]
    assert pending["count"] == 0
    assert "items" not in pending
    kinds = [it.get("kind") for it in pending.get("items", [])]
    assert "stepped_speed_reduction_signs" not in kinds


# ---------------------------------------------------------------------------
# B-04 / T-05 — schema speed domain matches the MUTCD Table 6C-2 lookup
# domain.  Every speed the schema admits must resolve end-to-end; every
# out-of-domain speed must be rejected with a 4xx, never a 500.
# ---------------------------------------------------------------------------


def test_buffer_table_covers_every_schema_admissible_speed() -> None:
    """The schema↔table contract, pinned directly: each multiple of 5
    in the schema range has a Table 6C-2 row (no speed can pass the
    schema and then blow up in the lookup)."""
    from src.rules.spacing import buffer_space

    for speed in range(20, 80, 5):  # 20..75 — the post-B-04 schema domain
        assert buffer_space(speed, jurisdiction="CDOT") > 0
        assert buffer_space(speed, jurisdiction="federal") > 0


@pytest.mark.parametrize("speed", list(range(20, 80, 5)))
def test_audit_renders_every_schema_admissible_speed(client: TestClient, speed: int) -> None:
    """End-to-end sweep: every schema-valid speed renders a 200 audit."""
    s = _shoulder_scenario()
    s["speed"] = speed
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 200, f"speed {speed}: {res.text}"


@pytest.mark.parametrize("speed", [62, 77, 80])
def test_audit_rejects_out_of_domain_speed_with_422(client: TestClient, speed: int) -> None:
    """Out-of-domain speeds (km/h conversions like 62, 80-mph tags) are
    rejected by the schema with a 422 naming the constraint — never a
    500 from the table lookup."""
    s = _shoulder_scenario()
    s["speed"] = speed
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 422, f"speed {speed}: got {res.status_code}"


@pytest.mark.parametrize("wz_speed", [47, 80])
def test_audit_rejects_out_of_domain_work_zone_speed_with_422(
    client: TestClient, wz_speed: int
) -> None:
    """workZoneSpeed shares the Table 6C-2 grid (posted limits are
    multiples of 5; the stepped W3-5 math assumes the grid)."""
    s = _shoulder_scenario()
    s["workZoneSpeed"] = wz_speed
    res = client.post("/render/audit", headers=_auth_headers(), json=s)
    assert res.status_code == 422, f"workZoneSpeed {wz_speed}: got {res.status_code}"


# ---------------------------------------------------------------------------
# B-07 — audit "required" counts use the generators' floors.
# ---------------------------------------------------------------------------


def test_audit_required_taper_drums_match_undivided_floor() -> None:
    """25 mph urban undivided shoulder: the formula alone gives 3 drums
    but the generator floors at 4 — the audit's required count must say
    4 (was 3 under the hard-coded min_count=2 recompute), matching the
    deployed count."""
    from src.api.audit import build_audit_trail
    from src.api.schemas import ShoulderScenario, scenario_to_call

    scenario = ShoulderScenario(
        kind="shoulder",
        roadType="urban_arterial",
        speed=25,
        lanes=1,
        laneWidth=12.0,
        divided=False,
        workType="utility_locate",
        duration="short",
        workLen=400.0,
        night=False,
    )
    params, generator, kwargs = scenario_to_call(scenario)
    placements = generator(params, **kwargs)
    audit = build_audit_trail(placements, params)
    spacing = audit["spacing"]
    assert spacing["n_taper_drums_required"] == 4
    assert spacing["n_taper_drums_actual"] == 4
    assert spacing["n_taper_drums_required"] == spacing["n_taper_drums_actual"]


def test_device_count_floors_matrix() -> None:
    """The shared floor source returns the documented per-scenario floors."""
    from src.generation.layout import device_count_floors
    from src.rules.validators import ScenarioParams

    def params_for(closure_type: str, is_divided: bool) -> ScenarioParams:
        return ScenarioParams(
            speed_mph=55,
            num_lanes=2,
            closure_type=closure_type,
            road_type="rural",
            work_zone_length_ft=800.0,
            lane_width_ft=12.0,
            shoulder_width_ft=10.0 if is_divided else 8.0,
            is_divided=is_divided,
            jurisdiction="CDOT",
        )

    assert device_count_floors(params_for("shoulder", True)) == (2, 2)
    assert device_count_floors(params_for("shoulder", False)) == (4, 2)
    assert device_count_floors(params_for("lane", True)) == (2, 2)
    assert device_count_floors(params_for("lane", False)) == (2, 3)  # flagger


# ---------------------------------------------------------------------------
# D-03 — unknown scenario kinds fail loud, not silent.
# ---------------------------------------------------------------------------


def test_audit_projection_unknown_kind_raises() -> None:
    """An unknown scenario_kind raises with the known-kinds list instead
    of shipping an audit summary with empty TA / CDOT citations."""
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
    raw = audit_module.build_audit_trail([], params)
    with pytest.raises(ValueError) as exc_info:
        audit_module.audit_projection(raw, "full_road_closure")
    assert "full_road_closure" in str(exc_info.value)
    assert "shoulder" in str(exc_info.value)  # lists the known kinds


def test_compute_step_count_unknown_type_raises() -> None:
    """A non-Scenario object raises TypeError instead of returning a
    silent step count of 0."""
    with pytest.raises(TypeError) as exc_info:
        audit_module._compute_step_count(object())
    assert "unknown scenario type" in str(exc_info.value)


def test_corridor_geometry_translates_out_of_domain_speed() -> None:
    """Direct ScenarioParams callers bypass the schema; the geometry
    validator translates the buffer-table lookup error into a
    structured Violation instead of letting the ValueError escape."""
    from src.rules.validators import ScenarioParams, validate_corridor_geometry

    params = ScenarioParams(
        speed_mph=62,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    violations = validate_corridor_geometry(params)
    assert len(violations) == 1
    assert violations[0].rule_id == "SPEED_OUTSIDE_TABLE_DOMAIN"
    assert violations[0].severity == "error"
    assert "62 mph" in violations[0].message


# ---------------------------------------------------------------------------
# B-03 / T-03 — the quadratic-branch audit text, pinned by a low-speed
# canonical snapshot (every other snapshot is >= 45 mph and linear).
# ---------------------------------------------------------------------------


def _shoulder_urban25() -> dict:
    """25 mph urban undivided — quadratic taper branch + binding
    undivided-shoulder taper floor."""
    s = _shoulder_scenario()
    s.update(roadType="urban_arterial", speed=25, workLen=400.0, divided=False)
    s["lanes"] = 1
    return s


def test_audit_low_speed_quadratic_matches_baseline(client: TestClient) -> None:
    """Canonical snapshot for the quadratic branch.  Pins three things
    no other snapshot covers: the quadratic L_calc_text (B-03 — the
    displayed arithmetic used to print the linear form against the
    quadratic result), the urban_low A/B/C path, and the B-07 floor
    (taper required == actual == 4)."""
    import json
    from pathlib import Path

    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_urban25())
    assert res.status_code == 200, res.text
    expected = json.loads(
        Path("tests/snapshots/audit_shoulder_urban25_quadratic.json").read_text(encoding="utf-8")
    )
    assert res.json() == expected


def test_audit_quadratic_calc_text_is_arithmetically_coherent(client: TestClient) -> None:
    """B-03 targeted assert: below 40 mph the calc text shows the
    quadratic form and its value (8 x 25^2 / 60 = 83), never the
    self-contradicting linear form (8 x 25 = 83).  The value is the
    whole-feet display rounding of 83.3333 (#93)."""
    res = client.post("/render/audit", headers=_auth_headers(), json=_shoulder_urban25())
    taper = res.json()["sections"]["taper"]
    assert "x 25^2 / 60" in taper["L_calc_text"], taper["L_calc_text"]
    assert taper["L_calc_text"].endswith("= 83 ft")
    assert "< 45 mph threshold" in taper["formula_choice"]
    spacing = res.json()["sections"]["spacing"]
    assert spacing["n_taper_drums_required"] == 4 == spacing["n_taper_drums_actual"]


# ---------------------------------------------------------------------------
# Taper-formula boundary — at 40 mph the audit selects MUTCD's quadratic
# formula (L = W x S^2 / 60), the spec-correct branch for speeds <= 40.
# The 45 mph threshold is the first speed that uses the linear L = W x S.
# (Supersedes the former B-05 "conservative deviation" disclosure.)
# ---------------------------------------------------------------------------


def test_taper_formula_choice_uses_quadratic_at_40() -> None:
    from src.rules.validators import ScenarioParams

    def params_at(speed: int) -> ScenarioParams:
        return ScenarioParams(
            speed_mph=speed,
            num_lanes=2,
            closure_type="shoulder",
            road_type="urban_high",
            work_zone_length_ft=800.0,
            lane_width_ft=12.0,
            shoulder_width_ft=10.0,
            is_divided=True,
            jurisdiction="CDOT",
        )

    taper_40 = audit_module.build_audit_trail([], params_at(40))["taper"]
    # 40 mph is below the 45 mph threshold -> quadratic: 10 x 40^2 / 60 =
    # 266.667, displayed rounded to whole feet 267 (#93).
    assert taper_40["L_full_ft"] == 267
    assert taper_40["L_calc_text"] == "L = 10 x 40^2 / 60 = 267 ft"
    # The formula choice asserts the MUTCD quadratic branch; no deviation text.
    assert taper_40["formula_choice"] == (
        "Speed 40 mph < 45 mph threshold -> using L = W x S^2 / 60"
    )
    assert "deviat" not in taper_40["formula_choice"]
    assert "deviat" not in taper_40["source"]

    # At the 45 mph threshold the linear branch applies and the text is clean.
    taper_45 = audit_module.build_audit_trail([], params_at(45))["taper"]
    assert taper_45["formula_choice"] == ("Speed 45 mph >= 45 mph threshold -> using L = W x S")
    assert "deviat" not in taper_45["source"]
