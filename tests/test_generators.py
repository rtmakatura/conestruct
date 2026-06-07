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
    assert (
        actual == expected_counts
    ), f"Device-count snapshot mismatch.\n  expected: {expected_counts}\n  actual:   {actual}"


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
            # Tangent pick(2000, 110): pre-fix floor=18 at 111.11 ft (>110 max);
            # post-fix ceil=19 at 105.26 ft → 20 tangent + 2 downstream = 22.
            {"SIGN_GENERIC": 14, "DRUM": 5, "ARROW_BOARD": 1, "CONE": 22},
        ),
        (
            65,
            "expressway",
            5000.0,
            12.0,
            # Tangent pick(5000, 130): pre-fix floor=38 at 131.58 ft (>130);
            # post-fix ceil=39 at 128.21 ft → 40 tangent + 2 downstream = 42.
            {"SIGN_GENERIC": 20, "DRUM": 5, "ARROW_BOARD": 1, "CONE": 42},
        ),
        (
            75,
            "freeway",
            8000.0,
            12.0,
            # Tangent pick(8000, 150): pre-fix floor=53 at 150.94 ft (>150);
            # post-fix ceil=54 at 148.15 ft → 55 tangent + 2 downstream = 57.
            {"SIGN_GENERIC": 22, "DRUM": 5, "ARROW_BOARD": 1, "CONE": 57},
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
        # 35 mph: tangent pick(500, 70): pre-fix floor=7 at 71.43 ft (>70 max);
        # post-fix ceil=8 at 62.5 ft → 9 tangent + 2 downstream = 11.
        (35, "rural", 500.0, 11.0, {"SIGN_GENERIC": 6, "DRUM": 4, "ARROW_BOARD": 1, "CONE": 11}),
        # 45 mph: tangent pick(1000, 90): pre-fix floor=11 at 90.91 ft (>90);
        # post-fix ceil=12 at 83.33 ft → 13 tangent + 2 downstream = 15.
        (45, "rural", 1000.0, 12.0, {"SIGN_GENERIC": 7, "DRUM": 4, "ARROW_BOARD": 1, "CONE": 15}),
        # 55 mph: tangent pick(3000, 110): pre-fix floor=27 at 111.11 ft (>110);
        # post-fix ceil=28 at 107.14 ft → 29 tangent + 2 downstream = 31.
        (55, "rural", 3000.0, 12.0, {"SIGN_GENERIC": 7, "DRUM": 4, "ARROW_BOARD": 1, "CONE": 31}),
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
        # Same pick(wz_len, 2*speed) math as the shoulder_divided cases —
        # pre-fix picked floor candidates that exceeded the §6C.09 max.
        (55, "rural", 2000.0, {"SIGN_GENERIC": 14, "DRUM": 13, "ARROW_BOARD": 1, "CONE": 22}),
        # V1-Wide Item 2: jurisdiction="CDOT" at 65/75 mph uses CDOT
        # supplement buffer (570/650 ft) rather than MUTCD federal
        # (645/820 ft). Shorter buffer → shorter total signed length
        # → fewer CO construction-zone plaque pairs.
        (65, "rural", 5000.0, {"SIGN_GENERIC": 16, "DRUM": 13, "ARROW_BOARD": 1, "CONE": 42}),
        (75, "freeway", 8000.0, {"SIGN_GENERIC": 22, "DRUM": 13, "ARROW_BOARD": 1, "CONE": 57}),
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
        # All four configs share the same tangent pick(1000, 90, min_count=3):
        # pre-fix floor=11 at 90.91 ft (>90 max) → 12 cones tangent → 14 total;
        # post-fix ceil=12 at 83.33 ft → 13 cones tangent → 15 total.
        (
            {},
            {"SIGN_GENERIC": 12, "FLAGGER_STATION": 2, "DRUM": 13, "CONE": 15},
        ),
        (
            {"afad": True},
            {"SIGN_GENERIC": 12, "TEMPORARY_SIGNAL": 2, "DRUM": 13, "CONE": 15},
        ),
        (
            {"pilot_car": True, "pedestrian_access": True},
            {"SIGN_GENERIC": 16, "FLAGGER_STATION": 2, "DRUM": 13, "CONE": 15},
        ),
        (
            {"afad": True, "pilot_car": True, "pedestrian_access": True},
            {"SIGN_GENERIC": 16, "TEMPORARY_SIGNAL": 2, "DRUM": 13, "CONE": 15},
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
        # Taper pick(224.58, 35): pre-fix floor=6 at 37.43 ft (>35 in-taper max)
        # → 7 drums; post-fix ceil=7 at 32.08 ft → 8 drums.
        # Tangent pick(300, 70): pre-fix floor=4 at 75 ft (>70 max) → 5 tangent
        # cones + 2 downstream = 7; post-fix ceil=5 at 60 ft → 6 tangent + 2 = 8.
        (
            35,
            "urban_low",
            300.0,
            11.0,
            {"SIGN_GENERIC": 11, "FLAGGER_STATION": 2, "DRUM": 8, "CONE": 8},
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


# ---------------------------------------------------------------------------
# V1-Wide Item 3 — Fines Double envelope emission.
#
# Per-label count tests instead of bulk SIGN_GENERIC totals so the delta
# from envelope emission is locked precisely. Each test verifies:
#   * No-reduction baseline emits zero R2-10/R2-11/R2-1
#   * Reduction emits the expected mirrored or single-side counts
# ---------------------------------------------------------------------------


def _count_label(placements: list[DevicePlacement], label: str) -> int:
    return sum(1 for p in placements if p.device_type.value == "SIGN_GENERIC" and p.label == label)


def _shoulder_divided_params(work_zone_speed_mph: int | None) -> ScenarioParams:
    return ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=work_zone_speed_mph,
    )


def test_shoulder_divided_no_reduction_emits_no_envelope() -> None:
    """Baseline: no reduction → zero Fines Double envelope signs."""
    placements = generate_shoulder_closure_divided(_shoulder_divided_params(None))
    for label in ("R2-10", "R2-11", "R2-1", "R2-6P"):
        assert _count_label(placements, label) == 0


def test_shoulder_divided_with_reduction_emits_mirrored_envelope() -> None:
    """Reduction on divided shoulder → mirrored R2-10/R2-11 (2 each) and
    mirrored R2-1 entrance + downstream (4 total) plus mirrored
    G20-5P/R2-6P pair per envelope assembly.
    800 ft wz → 1800 ft envelope → ceil(1800/2640)=1 assembly →
    2×R2-10 + 2×R2-11 + 4×R2-1 (entrance pair + downstream pair) +
    2×G20-5P(envelope) + 2×R2-6P."""
    placements = generate_shoulder_closure_divided(_shoulder_divided_params(45))
    assert _count_label(placements, "R2-10") == 2
    assert _count_label(placements, "R2-11") == 2
    # G4: entrance R2-1 mirrored (2) plus downstream R2-1 mirrored (2).
    assert _count_label(placements, "R2-1") == 4
    # R2-6P is envelope-only (no intra-work-zone R2-6P emission); equals
    # 2 × n_assemblies for divided.
    assert _count_label(placements, "R2-6P") == 2


def test_shoulder_divided_g20_5p_coexists_intra_zone_and_envelope() -> None:
    """Q1 confirmation: intra-work-zone G20-5P + envelope G20-5P both
    emit. 800 ft wz → 1 intra-zone half-mile plaque pair (2 mirrored)
    + 1 envelope assembly pair (2 mirrored) = 4 total G20-5P labels."""
    placements = generate_shoulder_closure_divided(_shoulder_divided_params(45))
    # Pre-Item-3 baseline (no reduction): 2 intra-work-zone G20-5P (mirrored).
    no_reduction = generate_shoulder_closure_divided(_shoulder_divided_params(None))
    n_no_reduction = _count_label(no_reduction, "G20-5P")
    n_with_reduction = _count_label(placements, "G20-5P")
    # Reduction adds the envelope assembly pair: 2 × n_assemblies = 2.
    assert n_with_reduction - n_no_reduction == 2


def test_shoulder_divided_large_envelope_more_assemblies() -> None:
    """5000 ft wz with reduction → 6000 ft envelope → ceil(6000/2640)=3
    assemblies → 6 mirrored R2-6P, 6 mirrored envelope-G20-5P."""
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=5000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=45,
    )
    placements = generate_shoulder_closure_divided(params)
    assert _count_label(placements, "R2-6P") == 6


def test_shoulder_undivided_with_reduction_single_side() -> None:
    """Undivided shoulder → no mirror requirement under §6C.04(A).
    Reduction emits single-side: 1×R2-10 + 1×R2-11 + 1×R2-1 entrance +
    1×R2-1 downstream = 2 R2-1 total (single side, entrance + restoration)."""
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=1,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=600.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
        work_zone_speed_mph=45,
    )
    placements = generate_shoulder_closure_undivided(params)
    assert _count_label(placements, "R2-10") == 1
    assert _count_label(placements, "R2-11") == 1
    # G4: entrance R2-1 + downstream R2-1, single-side on undivided.
    assert _count_label(placements, "R2-1") == 2


def test_lane_closure_divided_with_reduction_emits_envelope() -> None:
    """Divided lane closure (TA-19) with reduction → mirrored envelope
    with mirrored entrance + downstream R2-1 (G4)."""
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
    placements = generate_lane_closure_divided(params)
    assert _count_label(placements, "R2-10") == 2
    assert _count_label(placements, "R2-11") == 2
    # G4: entrance R2-1 mirrored (2) + downstream R2-1 mirrored (2).
    assert _count_label(placements, "R2-1") == 4


def test_flagger_with_reduction_emits_no_envelope() -> None:
    """Flagger 2-lane is exempt per Sheet 12 scope (freeway/expressway).
    Even if work_zone_speed_mph triggers, the generator doesn't emit."""
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
    for label in ("R2-10", "R2-11", "R2-1", "R2-6P"):
        assert _count_label(placements, label) == 0


def test_shoulder_divided_envelope_station_geometry() -> None:
    """R2-10 sits at wz_start+500, R2-11 at wz_end-500, downstream R2-1
    at wz_end-1000, entrance R2-1 at (n_plaques-0.5)*wz_len/n_plaques
    (G4 — upstream-most §6C.06(A) plaque anchor, inside wz)."""
    placements = generate_shoulder_closure_divided(_shoulder_divided_params(45))
    r2_10_stations = sorted(p.station_ft for p in placements if p.label == "R2-10")
    r2_11_stations = sorted(p.station_ft for p in placements if p.label == "R2-11")
    r2_1_stations = sorted(p.station_ft for p in placements if p.label == "R2-1")
    # 800 ft wz: wz_start = 800, wz_end = 0. n_plaques for the harness
    # 55 mph rural divided shoulder yields 3 plaques over the total
    # signed length; upstream-most plaque sits at (3-0.5)/3 * 800 = 600.
    assert r2_10_stations == [1300.0, 1300.0]
    assert r2_11_stations == [-500.0, -500.0]
    # Entrance R2-1 (2× mirrored) at 600 ft + downstream R2-1 (2× mirrored)
    # at -1000 ft — driver-encounter order.
    assert r2_1_stations == [-1000.0, -1000.0, 600.0, 600.0]
