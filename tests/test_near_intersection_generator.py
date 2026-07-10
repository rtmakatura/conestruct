"""Option C increment 2 — the near_intersection generator (Refs #117).

Covers, at the layer where the behavior lives (rule 11):

  * The Case 18 numeric anchor: the spike's worked example
    (validation-artifacts/intersections-spike/make_sheet_mock.py) —
    mainline 45 mph urban arterial, 2 lanes/dir, 12-ft lanes, 300-ft
    work zone; 30 mph urban cross street at alongStationFt = -60 —
    must reproduce the rules-engine stations exactly: taper 660..1200
    (L = 540), signs at 1550/1900/2250 (A=B=C=350, Sheet 10 key
    URBAN >=45), R2-10 at 2075 (1/2 C), cross-street sets on the
    100-ft key (URBAN <=40).
  * Near/far derivation and the §6N.12.12 far-side companion closure.
  * Loud geometry guards (rule 10) — no degraded plans.
  * The post-generation approach-id invariant.
  * Per-approach validation: a cross-street group validates against the
    CROSS street's numbers, pinned in both directions (mainline 45
    urban_high A=350 vs approach 30 urban_low A=100).
"""

from __future__ import annotations

import pytest
from pydantic import TypeAdapter

from src.api.schemas import Scenario, scenario_to_call
from src.generation.layout import (
    generate_near_intersection,
    near_intersection_stations,
)
from src.rules.devices import DEVICE_CATALOG, DeviceType
from src.rules.validators import (
    ApproachParams,
    DevicePlacement,
    ScenarioParams,
    _is_flagger_scenario,
    scenario_display_name,
    validate_layout,
)

_ADAPTER: TypeAdapter[Scenario] = TypeAdapter(Scenario)

_META = {
    "project": "near-intersection-inc2",
    "address": "",
    "lat": 0.0,
    "lng": 0.0,
    "siteConditions": {},
}


def _approach(**overrides) -> dict:
    base = {
        "id": "cross_n",
        "speed": 30,
        "roadType": "urban_arterial",
        "lanesPerDirection": 1,
        "laneWidth": 12.0,
        "signalized": False,
        "bearingDeg": None,
        "alongStationFt": -60.0,
    }
    return {**base, **overrides}


def _body(**overrides) -> dict:
    # The spike's Case 18 example, verbatim (make_sheet_mock.py:21-28).
    base = {
        "kind": "near_intersection",
        "meta": _META,
        "roadType": "urban_arterial",
        "speed": 45,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 300.0,
        "night": False,
        "approaches": [_approach()],
    }
    return {**base, **overrides}


def _generate(**overrides) -> tuple[list[DevicePlacement], ScenarioParams]:
    scenario = _ADAPTER.validate_python(_body(**overrides))
    params, generator, kwargs = scenario_to_call(scenario)
    return generator(params, **kwargs), params


def _mainline(placements: list[DevicePlacement]) -> list[DevicePlacement]:
    return [p for p in placements if p.approach_id == "mainline"]


def _sign_station(placements: list[DevicePlacement], label: str, approach_id: str) -> float:
    matches = [p for p in placements if p.label == label and p.approach_id == approach_id]
    assert len(matches) == 1, f"expected exactly one {label} on {approach_id}, got {len(matches)}"
    return matches[0].station_ft


# ---------------------------------------------------------------------------
# The Case 18 anchor (spec-verified — spike worked example)
# ---------------------------------------------------------------------------


class TestCase18Anchor:
    def test_mainline_advance_signs_reproduce_sheet10_urban_high_key(self) -> None:
        placements, _ = _generate()
        # taper_end = 300 + 360 = 660; taper_start = 660 + 540 = 1200;
        # A/B/C = 350 each (Sheet 10 key, URBAN >= 45).
        assert _sign_station(placements, "W4-2R", "mainline") == pytest.approx(1550.0)
        assert _sign_station(placements, "W20-5R", "mainline") == pytest.approx(1900.0)
        assert _sign_station(placements, "W20-1", "mainline") == pytest.approx(2250.0)
        # BEGIN DOUBLE FINES ZONE at 1/2 C inside W20-1 (Case 18).
        assert _sign_station(placements, "R2-10", "mainline") == pytest.approx(2075.0)

    def test_merging_taper_boundaries_count_and_spacing(self) -> None:
        placements, _ = _generate()
        drums = [p for p in _mainline(placements) if p.device_type == DeviceType.DRUM]
        stations = sorted(p.station_ft for p in drums)
        # L = 540 at 45 mph x 12 ft; in-taper spacing = 45 ft -> 13 drums.
        assert len(drums) == 13
        assert stations[0] == pytest.approx(660.0)
        assert stations[-1] == pytest.approx(1200.0)
        gaps = {round(b - a, 6) for a, b in zip(stations, stations[1:], strict=False)}
        assert gaps == {45.0}
        # Lateral run: lane edge (24 ft) down to the lane line (12 ft).
        by_station = sorted(drums, key=lambda p: p.station_ft)
        assert by_station[-1].offset_ft == pytest.approx(24.0)  # upstream end
        assert by_station[0].offset_ft == pytest.approx(12.0)  # downstream end

    def test_cross_street_set_reproduces_sheet10_urban_low_key(self) -> None:
        placements, _ = _generate()
        # 30 mph urban -> urban_low -> A = 100 (Sheet 10 key, URBAN <= 40).
        # Pattern per Case 18's 500'/500'/100' rural dims, scaled by the
        # key: R2-10 at A from the curb line, W20-1 at 2A, R2-11 at 100
        # on the departure side.
        assert _sign_station(placements, "R2-10", "cross_n") == pytest.approx(100.0)
        assert _sign_station(placements, "W20-1", "cross_n") == pytest.approx(200.0)
        assert _sign_station(placements, "R2-11", "cross_n") == pytest.approx(100.0)
        r2_11 = [p for p in placements if p.approach_id == "cross_n" and p.label == "R2-11"]
        assert r2_11[0].offset_ft < 0  # departure side
        w20_1 = [p for p in placements if p.approach_id == "cross_n" and p.label == "W20-1"]
        assert w20_1[0].offset_ft > 0  # approach side

    def test_anchor_is_near_side_with_corner_termination(self) -> None:
        # alongStationFt = -60 < 0 -> near side; the standard reopening
        # (50-ft downstream taper + 100-ft END signage) does not fit in
        # the 48-ft gap to the upstream curb (-48), so the closure runs
        # to the corner (Fig. 6P-21 / Case 18) and the box stays empty.
        placements, params = _generate()
        st = near_intersection_stations(
            params,
            [
                ApproachParams(
                    id="cross_n",
                    speed_mph=30,
                    road_type="urban_low",
                    num_lanes=1,
                    lane_width_ft=12.0,
                    along_station_ft=-60.0,
                )
            ],
        )
        assert st["side"] == "near"
        assert st["extend_to_corner"] is True
        assert st["upstream_curb"] == pytest.approx(-48.0)
        corner_cones = [
            p
            for p in _mainline(placements)
            if p.device_type == DeviceType.CONE and p.station_ft == pytest.approx(-48.0)
        ]
        assert corner_cones, "closure must terminate at the upstream curb line"
        # No mainline device inside the curb-to-curb box (-72, -48).
        inside = [p for p in _mainline(placements) if -72.0 < p.station_ft < -48.0]
        assert inside == []


# ---------------------------------------------------------------------------
# Near/far derivation + §6N.12.12 far-side companion closure
# ---------------------------------------------------------------------------


class TestFarSide:
    def test_far_side_moves_taper_upstream_of_intersection(self) -> None:
        # along = 900, half-width 12 -> upstream curb 912; 912 + 100 =
        # 1012 beats the midblock anchor 300 + 360 = 660.
        placements, _ = _generate(approaches=[_approach(alongStationFt=900.0)])
        w4_2 = _sign_station(placements, "W4-2R", "mainline")
        # taper_start = 1012 + 540 = 1552; W4-2R at +350.
        assert w4_2 == pytest.approx(1902.0)

    def test_far_side_midblock_anchor_wins_when_more_upstream(self) -> None:
        # along = 400 (half-width 12 -> 412 + 100 = 512) < 300 + 360 =
        # 660: the buffer anchoring governs, exactly like midblock.
        placements, _ = _generate(approaches=[_approach(alongStationFt=400.0)])
        assert _sign_station(placements, "W4-2R", "mainline") == pytest.approx(
            300.0 + 360.0 + 540.0 + 350.0
        )

    def test_far_side_companion_tangent_skips_the_intersection_box(self) -> None:
        placements, _ = _generate(approaches=[_approach(alongStationFt=900.0)])
        cones = [
            p
            for p in _mainline(placements)
            if p.device_type == DeviceType.CONE and p.station_ft > 300.0
        ]
        # Closed-lane tangent exists on both sides of the box...
        assert any(p.station_ft >= 912.0 for p in cones), "segment above the upstream curb"
        assert any(300.0 < p.station_ft <= 888.0 for p in cones), "segment below the box"
        # ...and the box itself (888, 912) is device-free.
        assert not any(888.0 < p.station_ft < 912.0 for p in _mainline(placements))

    def test_far_side_keeps_standard_downstream_reopening(self) -> None:
        placements, _ = _generate(approaches=[_approach(alongStationFt=900.0)])
        ds = [
            p
            for p in _mainline(placements)
            if p.device_type == DeviceType.CONE and p.station_ft < 0.0
        ]
        assert len(ds) == 2  # the standard 2-cone downstream taper

    def test_near_side_has_no_companion_tangent(self) -> None:
        # Near side: no closed-lane cones between the work zone start
        # (300) and the taper's downstream end (660) — the buffer stays
        # device-empty, as in every midblock closure.
        placements, _ = _generate()
        assert not any(
            300.0 < p.station_ft < 660.0
            for p in _mainline(placements)
            if p.device_type == DeviceType.CONE
        )


# ---------------------------------------------------------------------------
# Loud guards (rule 10)
# ---------------------------------------------------------------------------


class TestGuards:
    def _params_and_approaches(
        self, along: float = -60.0, lanes: int = 2
    ) -> tuple[ScenarioParams, list[ApproachParams]]:
        params = ScenarioParams(
            speed_mph=45,
            num_lanes=lanes,
            closure_type="lane",
            road_type="urban_high",
            work_zone_length_ft=300.0,
            lane_width_ft=12.0,
            shoulder_width_ft=8.0,
            near_intersection=True,
        )
        approaches = [
            ApproachParams(
                id="cross_n",
                speed_mph=30,
                road_type="urban_low",
                num_lanes=1,
                lane_width_ft=12.0,
                along_station_ft=along,
            )
        ]
        return params, approaches

    def test_single_lane_mainline_rejected(self) -> None:
        params, approaches = self._params_and_approaches(lanes=1)
        with pytest.raises(ValueError, match="num_lanes >= 2"):
            generate_near_intersection(params, approaches=approaches)

    def test_disagreeing_along_stations_rejected(self) -> None:
        params, approaches = self._params_and_approaches()
        approaches = approaches + [
            ApproachParams(
                id="cross_s",
                speed_mph=30,
                road_type="urban_low",
                num_lanes=1,
                lane_width_ft=12.0,
                along_station_ft=-200.0,
            )
        ]
        with pytest.raises(ValueError, match="disagree on along_station_ft"):
            generate_near_intersection(params, approaches=approaches)

    def test_curb_box_overlapping_work_zone_rejected_near_side(self) -> None:
        # Centerline at -10 passes the schema (outside [0, workLen]) but
        # the 12-ft half-width puts the upstream curb at +2 — inside the
        # work zone.  The schema cannot see approach widths; the
        # generator must fail loudly, not lay out in-intersection work.
        params, approaches = self._params_and_approaches(along=-10.0)
        with pytest.raises(ValueError, match="curb line"):
            generate_near_intersection(params, approaches=approaches)

    def test_curb_box_overlapping_work_zone_rejected_far_side(self) -> None:
        params, approaches = self._params_and_approaches(along=305.0)
        with pytest.raises(ValueError, match="curb line"):
            generate_near_intersection(params, approaches=approaches)


# ---------------------------------------------------------------------------
# Frame invariants + kind identity
# ---------------------------------------------------------------------------


class TestFrames:
    def test_every_placement_carries_a_declared_approach_id(self) -> None:
        placements, _ = _generate(
            approaches=[
                _approach(id="cross_n"),
                _approach(id="cross_s", speed=25),
            ]
        )
        assert {p.approach_id for p in placements} == {"mainline", "cross_n", "cross_s"}

    def test_cross_street_placements_are_signs_only(self) -> None:
        # Increment 2 scope: advance sets only — no channelizers, no
        # taper on any cross-street leg (the plate's corner-work closure
        # train is Phase 2/3).
        placements, _ = _generate()
        cross = [p for p in placements if p.approach_id != "mainline"]
        assert cross, "cross-street set must exist"
        assert all(DEVICE_CATALOG[p.device_type].is_sign for p in cross)

    def test_no_parametric_or_mainline_only_codes_off_mainline(self) -> None:
        # W20-2 / W16-2a / G20-1 substitute mainline-frame distances and
        # R2-1's schedule key splits on the mainline station sign — none
        # may ever be emitted in an approach frame (rule 10: a
        # confidently wrong printed distance is worse than none).
        placements, _ = _generate(
            approaches=[_approach(id="cross_n"), _approach(id="cross_s", speed=55)]
        )
        forbidden = {"W20-2", "W16-2a", "G20-1", "G20-2", "R2-1"}
        cross_labels = {p.label for p in placements if p.approach_id != "mainline"}
        assert not (cross_labels & forbidden)

    def test_kind_is_not_a_flagger_scenario_and_names_itself(self) -> None:
        _, params = _generate()
        assert _is_flagger_scenario(params) is False
        assert scenario_display_name(params) == "Lane Closure Near Intersection — Undivided"


# ---------------------------------------------------------------------------
# Per-approach validation (the increment-1 deferral)
# ---------------------------------------------------------------------------


def _approach_params_map(**overrides) -> dict[str, ApproachParams]:
    base = {
        "id": "cross_n",
        "speed_mph": 30,
        "road_type": "urban_low",
        "num_lanes": 1,
        "lane_width_ft": 12.0,
        "along_station_ft": -60.0,
    }
    ap = ApproachParams(**{**base, **overrides})
    return {ap.id: ap}


class TestPerApproachValidation:
    def test_generator_output_validates_clean_per_approach(self) -> None:
        placements, params = _generate()
        violations = validate_layout(placements, params, _approach_params_map())
        errors = [v for v in violations if v.severity == "error"]
        assert errors == [], errors

    def test_cross_group_fails_at_cross_speed_even_when_mainline_would_pass(self) -> None:
        # The inverse of the increment-1 stitching guard.  Signs spaced
        # 350 ft apart satisfy the MAINLINE's key (45 mph urban_high)
        # but not the 30 mph urban_low cross street's 100 ft — the
        # approach group must be judged by the CROSS street's numbers.
        placements, params = _generate()
        placements = [p for p in placements if p.approach_id == "mainline"] + [
            DevicePlacement(DeviceType.SIGN_GENERIC, 350.0, 16.0, "R2-10", "cross_n"),
            DevicePlacement(DeviceType.SIGN_GENERIC, 700.0, 16.0, "W20-1", "cross_n"),
        ]
        violations = validate_layout(placements, params, _approach_params_map())
        assert any(v.rule_id == "APPROACH_SIGN_SPACING_OFF" for v in violations)

    def test_same_group_passes_when_the_approach_really_is_that_fast(self) -> None:
        # Identical placements, but the approach genuinely is a 45 mph
        # urban_high road (A = 350): no spacing violation.  Speed comes
        # from the approach's own params, never the mainline's.
        placements, params = _generate()
        placements = [p for p in placements if p.approach_id == "mainline"] + [
            DevicePlacement(DeviceType.SIGN_GENERIC, 350.0, 16.0, "R2-10", "cross_n"),
            DevicePlacement(DeviceType.SIGN_GENERIC, 700.0, 16.0, "W20-1", "cross_n"),
        ]
        violations = validate_layout(
            placements,
            params,
            _approach_params_map(speed_mph=45, road_type="urban_high"),
        )
        assert not any(v.rule_id == "APPROACH_SIGN_SPACING_OFF" for v in violations)

    def test_missing_approach_set_is_an_error(self) -> None:
        placements, params = _generate()
        mainline_only = [p for p in placements if p.approach_id == "mainline"]
        violations = validate_layout(mainline_only, params, _approach_params_map())
        assert any(v.rule_id == "MISSING_APPROACH_ADVANCE_SIGNS" for v in violations)

    def test_unknown_approach_id_is_an_error(self) -> None:
        placements, params = _generate()
        rogue = placements + [
            DevicePlacement(DeviceType.SIGN_GENERIC, 100.0, 16.0, "W20-1", "cross_zz")
        ]
        violations = validate_layout(rogue, params, _approach_params_map())
        assert any(v.rule_id == "UNKNOWN_APPROACH_ID" for v in violations)

    def test_mainline_pass_unchanged_by_approach_partition(self) -> None:
        # With approach_params, the fifteen mainline validators must see
        # exactly the mainline sublist — same findings as validating the
        # sublist the old way (modulo device_index remapping, which the
        # all-mainline-prefix layout makes the identity here).
        placements, params = _generate()
        mainline_only = [p for p in placements if p.approach_id == "mainline"]
        with_partition = [
            v
            for v in validate_layout(placements, params, _approach_params_map())
            if v.rule_id
            not in {
                "UNKNOWN_APPROACH_ID",
                "MISSING_APPROACH_ADVANCE_SIGNS",
                "APPROACH_SIGN_SPACING_OFF",
            }
        ]
        without = validate_layout(mainline_only, params)
        assert with_partition == without
