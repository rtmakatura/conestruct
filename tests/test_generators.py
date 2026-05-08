"""End-to-end fixture tests for the layout generators in src.generation.layout.

Each fixture exercises one of the 7 ``generate_*`` functions across a small
matrix of representative inputs (speed / road type / work-zone length /
optional flags) and asserts two contracts:

  1. ``validate_layout`` returns no ``error``-severity Violation.
  2. The DeviceType counts of the generated placements match a frozen
     baseline — a snapshot that catches regressions in the formulas
     (taper drum count, tangent cone count, advance-sign count, plaque
     count, etc.) without locking down individual stations.

Warnings are *not* asserted — some are known/intentional and tracked
separately. Test failures here mean either a generator produced an
invalid layout (errors) or its device-count signature drifted.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable

import pytest

from src.generation.layout import (
    generate_flagger_alternating_2lane,
    generate_lane_closure_divided,
    generate_mobile_op_2lane,
    generate_mobile_op_multilane,
    generate_shoulder_closure_divided,
    generate_shoulder_closure_undivided,
    generate_work_beyond_shoulder,
)
from src.rules.validators import (
    DevicePlacement,
    ScenarioParams,
    Violation,
    validate_layout,
)

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _format_violations(violations: list[Violation]) -> str:
    return "\n".join(
        f"  [{v.severity:>7s}] {v.rule_id} ({v.mutcd_section}): {v.message}" for v in violations
    )


def _counts_by_type(placements: list[DevicePlacement]) -> dict[str, int]:
    return dict(Counter(p.device_type.value for p in placements))


def _assert_no_errors(placements: list[DevicePlacement], params: ScenarioParams) -> None:
    violations = validate_layout(placements, params)
    errors = [v for v in violations if v.severity == "error"]
    assert not errors, "Generator produced ERROR-level violations:\n" + _format_violations(errors)


def _run(
    generator: Callable[..., list[DevicePlacement]],
    params: ScenarioParams,
    expected_counts: dict[str, int],
    **kwargs: object,
) -> None:
    placements = generator(params, **kwargs)
    _assert_no_errors(placements, params)
    actual = _counts_by_type(placements)
    assert actual == expected_counts, (
        f"Device-count snapshot mismatch.\n"
        f"  expected: {expected_counts}\n"
        f"  actual:   {actual}"
    )


# ---------------------------------------------------------------------------
# generate_shoulder_closure_divided
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "speed,road_type,wz_len,lane_w,expected",
    [
        (
            40,
            "rural",
            1000.0,
            12.0,
            {"SIGN_GENERIC": 14, "DRUM": 5, "ARROW_BOARD": 1, "CONE": 16},
        ),
        (
            45,
            "rural",
            800.0,
            12.0,
            {"SIGN_GENERIC": 14, "DRUM": 5, "ARROW_BOARD": 1, "CONE": 12},
        ),
        (
            55,
            "rural",
            2000.0,
            11.0,
            {"SIGN_GENERIC": 14, "DRUM": 5, "ARROW_BOARD": 1, "CONE": 21},
        ),
        (
            65,
            "expressway",
            5000.0,
            12.0,
            {"SIGN_GENERIC": 20, "DRUM": 5, "ARROW_BOARD": 1, "CONE": 41},
        ),
        (
            75,
            "freeway",
            8000.0,
            12.0,
            {"SIGN_GENERIC": 22, "DRUM": 5, "ARROW_BOARD": 1, "CONE": 56},
        ),
    ],
    ids=[
        "40mph_rural_1000ft_threshold",
        "45mph_rural_800ft",
        "55mph_rural_2000ft_11ft_lane",
        "65mph_expressway_5000ft",
        "75mph_freeway_8000ft",
    ],
)
def test_shoulder_divided(
    speed: int,
    road_type: str,
    wz_len: float,
    lane_w: float,
    expected: dict[str, int],
) -> None:
    params = ScenarioParams(
        speed_mph=speed,
        num_lanes=4,
        closure_type="shoulder",
        road_type=road_type,
        work_zone_length_ft=wz_len,
        lane_width_ft=lane_w,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    _run(generate_shoulder_closure_divided, params, expected)


# ---------------------------------------------------------------------------
# generate_shoulder_closure_undivided
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "speed,road_type,wz_len,lane_w,expected",
    [
        (25, "urban_low", 200.0, 11.0, {"SIGN_GENERIC": 6, "DRUM": 4, "ARROW_BOARD": 1, "CONE": 7}),
        (35, "rural", 500.0, 11.0, {"SIGN_GENERIC": 6, "DRUM": 4, "ARROW_BOARD": 1, "CONE": 10}),
        (45, "rural", 1000.0, 12.0, {"SIGN_GENERIC": 7, "DRUM": 4, "ARROW_BOARD": 1, "CONE": 14}),
        (55, "rural", 3000.0, 12.0, {"SIGN_GENERIC": 7, "DRUM": 4, "ARROW_BOARD": 1, "CONE": 30}),
        (60, "rural", 1500.0, 12.0, {"SIGN_GENERIC": 7, "DRUM": 4, "ARROW_BOARD": 1, "CONE": 16}),
    ],
    ids=[
        "25mph_urban_low_200ft",
        "35mph_rural_500ft",
        "45mph_rural_1000ft",
        "55mph_rural_3000ft",
        "60mph_rural_1500ft",
    ],
)
def test_shoulder_undivided(
    speed: int,
    road_type: str,
    wz_len: float,
    lane_w: float,
    expected: dict[str, int],
) -> None:
    params = ScenarioParams(
        speed_mph=speed,
        num_lanes=2,
        closure_type="shoulder",
        road_type=road_type,
        work_zone_length_ft=wz_len,
        lane_width_ft=lane_w,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    _run(generate_shoulder_closure_undivided, params, expected)


# ---------------------------------------------------------------------------
# generate_lane_closure_divided
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "speed,road_type,wz_len,expected",
    [
        (40, "rural", 800.0, {"SIGN_GENERIC": 14, "DRUM": 13, "ARROW_BOARD": 1, "CONE": 13}),
        (45, "rural", 800.0, {"SIGN_GENERIC": 14, "DRUM": 13, "ARROW_BOARD": 1, "CONE": 12}),
        (55, "rural", 2000.0, {"SIGN_GENERIC": 14, "DRUM": 13, "ARROW_BOARD": 1, "CONE": 21}),
        (65, "rural", 5000.0, {"SIGN_GENERIC": 18, "DRUM": 13, "ARROW_BOARD": 1, "CONE": 41}),
        (75, "freeway", 8000.0, {"SIGN_GENERIC": 22, "DRUM": 13, "ARROW_BOARD": 1, "CONE": 56}),
    ],
    ids=[
        "40mph_rural_800ft",
        "45mph_rural_800ft",
        "55mph_rural_2000ft",
        "65mph_rural_5000ft",
        "75mph_freeway_8000ft",
    ],
)
def test_lane_closure_divided(
    speed: int,
    road_type: str,
    wz_len: float,
    expected: dict[str, int],
) -> None:
    params = ScenarioParams(
        speed_mph=speed,
        num_lanes=4,
        closure_type="lane",
        road_type=road_type,
        work_zone_length_ft=wz_len,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    _run(generate_lane_closure_divided, params, expected)


# ---------------------------------------------------------------------------
# generate_flagger_alternating_2lane
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "kwargs,expected",
    [
        (
            {},
            {"SIGN_GENERIC": 12, "FLAGGER_STATION": 2, "DRUM": 13, "CONE": 14},
        ),
        (
            {"afad": True},
            {"SIGN_GENERIC": 12, "TEMPORARY_SIGNAL": 2, "DRUM": 13, "CONE": 14},
        ),
        (
            {"pilot_car": True, "pedestrian_access": True},
            {"SIGN_GENERIC": 16, "FLAGGER_STATION": 2, "DRUM": 13, "CONE": 14},
        ),
        (
            {"afad": True, "pilot_car": True, "pedestrian_access": True},
            {"SIGN_GENERIC": 16, "TEMPORARY_SIGNAL": 2, "DRUM": 13, "CONE": 14},
        ),
    ],
    ids=["basic", "afad", "pilot_car_plus_pedestrian", "all_options_combined"],
)
def test_flagger(kwargs: dict[str, bool], expected: dict[str, int]) -> None:
    params = ScenarioParams(
        speed_mph=45,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    _run(generate_flagger_alternating_2lane, params, expected, **kwargs)


@pytest.mark.parametrize(
    "speed,road_type,wz_len,lane_w,expected",
    [
        (
            35,
            "urban_low",
            300.0,
            11.0,
            {"SIGN_GENERIC": 11, "FLAGGER_STATION": 2, "DRUM": 7, "CONE": 7},
        ),
    ],
    ids=["35mph_urban_low_300ft"],
)
def test_flagger_low_speed(
    speed: int,
    road_type: str,
    wz_len: float,
    lane_w: float,
    expected: dict[str, int],
) -> None:
    params = ScenarioParams(
        speed_mph=speed,
        num_lanes=2,
        closure_type="lane",
        road_type=road_type,
        work_zone_length_ft=wz_len,
        lane_width_ft=lane_w,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    _run(generate_flagger_alternating_2lane, params, expected)


# ---------------------------------------------------------------------------
# generate_work_beyond_shoulder
#
# Uses closure_type="off_road" so validate_taper_present /
# validate_arrow_board_present / validate_co_construction_plaques honor
# the MUTCD §6G.04 waiver — no taper, no arrow board, no plaques.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "speed,road_type,wz_len,expected",
    [
        (25, "urban_low", 100.0, {"SIGN_GENERIC": 2}),
        (35, "urban_low", 200.0, {"SIGN_GENERIC": 2}),
        (65, "expressway", 1000.0, {"SIGN_GENERIC": 2}),
    ],
    ids=["25mph_urban_100ft", "35mph_urban_200ft", "65mph_expressway_1000ft"],
)
def test_work_beyond_shoulder(
    speed: int,
    road_type: str,
    wz_len: float,
    expected: dict[str, int],
) -> None:
    params = ScenarioParams(
        speed_mph=speed,
        num_lanes=2,
        closure_type="off_road",
        road_type=road_type,
        work_zone_length_ft=wz_len,
        lane_width_ft=12.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    _run(generate_work_beyond_shoulder, params, expected)


# ---------------------------------------------------------------------------
# generate_mobile_op_2lane
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "speed,expected",
    [
        (
            35,
            {"SIGN_GENERIC": 2, "TRUCK_MOUNTED_ATTENUATOR": 2, "ARROW_BOARD": 1},
        ),
        (
            55,
            {"SIGN_GENERIC": 2, "TRUCK_MOUNTED_ATTENUATOR": 2, "ARROW_BOARD": 1},
        ),
        (
            75,
            {"SIGN_GENERIC": 2, "TRUCK_MOUNTED_ATTENUATOR": 2, "ARROW_BOARD": 1},
        ),
    ],
    ids=["35mph", "55mph", "75mph"],
)
def test_mobile_op_2lane(speed: int, expected: dict[str, int]) -> None:
    params = ScenarioParams(
        speed_mph=speed,
        num_lanes=2,
        closure_type="mobile",
        road_type="rural",
        work_zone_length_ft=200.0,
        lane_width_ft=12.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    _run(generate_mobile_op_2lane, params, expected)


# ---------------------------------------------------------------------------
# generate_mobile_op_multilane
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "speed,kwargs,expected",
    [
        (55, {}, {"TRUCK_MOUNTED_ATTENUATOR": 2, "ARROW_BOARD": 1}),
        (65, {"second_tma": True}, {"TRUCK_MOUNTED_ATTENUATOR": 3, "ARROW_BOARD": 1}),
    ],
    ids=["55mph_one_tma", "65mph_two_tmas"],
)
def test_mobile_op_multilane(
    speed: int,
    kwargs: dict[str, bool],
    expected: dict[str, int],
) -> None:
    params = ScenarioParams(
        speed_mph=speed,
        num_lanes=4,
        closure_type="mobile",
        road_type="rural",
        work_zone_length_ft=200.0,
        lane_width_ft=12.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    _run(generate_mobile_op_multilane, params, expected, **kwargs)
