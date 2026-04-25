"""Tests for src.rules.tables, spacing, devices, and validators.

Section 1 — table integrity (tables.py).
Section 2 — spacing calculations (spacing.py).
Section 3 — device catalog and helpers (devices.py).
Section 4 — layout validators (validators.py).
"""

from __future__ import annotations

import pytest

from src.rules.devices import (
    DEVICE_CATALOG,
    DeviceType,
    get_channelizers,
    get_drawn_devices,
    get_field_only_devices,
    get_sign_devices,
)
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    co_construction_plaques,
    co_speed_reduction_signs,
    downstream_taper_length,
    num_devices_in_taper,
    num_devices_on_tangent,
    shifting_taper_length,
    shoulder_taper_length,
    taper_length,
)
from src.rules.tables import (
    ADVANCE_WARNING_SIGN_SPACING,
    BUFFER_SPACE,
    COLORADO_OVERRIDES,
)
from src.rules.validators import (
    DevicePlacement,
    ScenarioParams,
    validate_layout,
)

# ===========================================================================
# Section 1 — Table integrity
# ===========================================================================


def test_buffer_space_table_complete() -> None:
    """All 12 speed rows present, no None values, monotonically increasing."""
    expected_speeds = list(range(20, 80, 5))  # 20, 25, ..., 75
    actual_speeds = [row.speed_mph for row in BUFFER_SPACE]
    assert actual_speeds == expected_speeds

    values = [row.buffer_ft for row in BUFFER_SPACE]
    assert all(v is not None for v in values)
    assert values == sorted(values), "buffer_ft must increase with speed"
    assert all(
        values[i] < values[i + 1] for i in range(len(values) - 1)
    ), "buffer_ft must be strictly monotonic"


def test_buffer_space_table_known_values() -> None:
    """User-confirmed anchor points from MUTCD Table 6B-2."""
    by_speed = {row.speed_mph: row.buffer_ft for row in BUFFER_SPACE}
    assert by_speed[30] == 200
    assert by_speed[45] == 360
    assert by_speed[60] == 570
    assert by_speed[70] == 730


def test_advance_warning_all_rows_have_abc() -> None:
    """Every Table 6B-1 row has positive A, B, C; expressway is asymmetric."""
    for row in ADVANCE_WARNING_SIGN_SPACING:
        assert row.a_ft > 0, f"{row.road_category} A must be positive"
        assert row.b_ft > 0, f"{row.road_category} B must be positive"
        assert row.c_ft is not None and row.c_ft > 0, f"{row.road_category} C must be positive"

    expressway = next(
        row for row in ADVANCE_WARNING_SIGN_SPACING if row.road_category == "expressway"
    )
    assert expressway.c_ft is not None
    assert (
        expressway.a_ft < expressway.b_ft < expressway.c_ft
    ), "expressway A/B/C distances are required to be asymmetric and increasing"


def test_advance_warning_known_values() -> None:
    """Known values from MUTCD Table 6B-1."""
    by_cat = {row.road_category: row for row in ADVANCE_WARNING_SIGN_SPACING}

    urban_low = by_cat["urban_low"]
    assert urban_low.a_ft == 100
    assert urban_low.b_ft == 100
    assert urban_low.c_ft == 100

    expressway = by_cat["expressway"]
    assert expressway.a_ft == 1000
    assert expressway.b_ft == 1500
    assert expressway.c_ft == 2640


def test_colorado_overrides_values() -> None:
    """Three Colorado Supplement constants verified against source."""
    assert COLORADO_OVERRIDES.max_speed_reduction_per_sign_mph == 15
    assert COLORADO_OVERRIDES.construction_zone_plaque_interval_ft == 2640
    assert COLORADO_OVERRIDES.flagger_station_light_watts == 500


# ===========================================================================
# Section 2 — Spacing calculations
# ===========================================================================


def test_taper_length_below_threshold() -> None:
    """L = W * S^2 / 60 for speeds below 40 mph."""
    # 30 mph, 12-ft lane: 12 * 900 / 60 = 180
    assert taper_length(30, 12) == pytest.approx(180.0)
    # 35 mph, 11-ft lane: 11 * 1225 / 60 = 224.5833...
    assert taper_length(35, 11) == pytest.approx(11 * 35**2 / 60)


def test_taper_length_at_and_above_threshold() -> None:
    """L = W * S at and above 40 mph (the threshold itself uses linear)."""
    # 40 mph (at threshold), 12-ft lane
    assert taper_length(40, 12) == pytest.approx(480.0)
    # 45 mph, 11-ft lane
    assert taper_length(45, 11) == pytest.approx(495.0)
    # 65 mph, 12-ft lane
    assert taper_length(65, 12) == pytest.approx(780.0)


def test_shifting_taper_is_half() -> None:
    """Shifting taper = full merging taper / 2."""
    assert shifting_taper_length(45, 11) == pytest.approx(247.5)
    assert shifting_taper_length(65, 12) == pytest.approx(390.0)


def test_shoulder_taper_is_third() -> None:
    """Shoulder taper = full merging taper / 3."""
    # 45 mph, 6-ft shoulder: full = 270, shoulder = 90
    assert shoulder_taper_length(45, 6) == pytest.approx(90.0)
    # 30 mph (below threshold), 4-ft shoulder: full = 60, shoulder = 20
    assert shoulder_taper_length(30, 4) == pytest.approx(20.0)


def test_downstream_taper() -> None:
    """50 ft/lane minimum, 100 ft/lane maximum."""
    assert downstream_taper_length(1) == pytest.approx(50.0)
    assert downstream_taper_length(1, use_max=True) == pytest.approx(100.0)
    assert downstream_taper_length(3) == pytest.approx(150.0)


def test_buffer_space_lookup() -> None:
    """Table 6B-2 lookup; ValueError on invalid speeds."""
    assert buffer_space(45) == pytest.approx(360.0)
    assert buffer_space(60) == pytest.approx(570.0)
    with pytest.raises(ValueError):
        buffer_space(42)  # not a 5-mph increment
    with pytest.raises(ValueError):
        buffer_space(80)  # out of table range


def test_advance_warning_auto_inference() -> None:
    """Speed-based inference selects urban/rural; expressway needs explicit."""
    # 30 mph -> urban_low (A=B=C=100)
    assert advance_warning_spacing(30) == {"A": 100.0, "B": 100.0, "C": 100.0}
    # 40 mph -> urban_high (A=B=C=350)
    assert advance_warning_spacing(40) == {"A": 350.0, "B": 350.0, "C": 350.0}
    # 50 mph -> rural (A=B=C=500)
    assert advance_warning_spacing(50) == {"A": 500.0, "B": 500.0, "C": 500.0}
    # 60 mph with explicit expressway -> asymmetric 1000/1500/2640
    assert advance_warning_spacing(60, road_type="expressway") == {
        "A": 1000.0,
        "B": 1500.0,
        "C": 2640.0,
    }
    # 60 mph with no road_type -> rural (NOT expressway)
    assert advance_warning_spacing(60) == {"A": 500.0, "B": 500.0, "C": 500.0}


def test_device_counts_in_taper() -> None:
    """ceil(taper_length / in_taper_spacing) = device count."""
    # 45 mph, 11-ft: taper=495, spacing=45, count=11
    assert num_devices_in_taper(45, 11) == 11
    # 65 mph, 12-ft: taper=780, spacing=65, count=12
    assert num_devices_in_taper(65, 12) == 12


def test_device_counts_on_tangent() -> None:
    """ceil(tangent_length / tangent_spacing) = device count."""
    # 500 ft at 45 mph: spacing=90, count=ceil(500/90)=6
    assert num_devices_on_tangent(500, 45) == 6
    # 1000 ft at 65 mph: spacing=130, count=ceil(1000/130)=8
    assert num_devices_on_tangent(1000, 65) == 8


def test_co_speed_reduction_signs() -> None:
    """ceil(delta / 15) = number of stepped speed-reduction signs."""
    assert co_speed_reduction_signs(65, 45) == 2  # ceil(20/15)
    assert co_speed_reduction_signs(55, 45) == 1  # ceil(10/15)
    assert co_speed_reduction_signs(45, 40) == 1  # ceil(5/15)
    with pytest.raises(ValueError):
        co_speed_reduction_signs(45, 50)  # target >= current


def test_co_construction_plaques() -> None:
    """At least 1 plaque set; one more per 2,640 ft interval."""
    assert co_construction_plaques(0) == 1  # minimum
    assert co_construction_plaques(2640) == 1  # exactly one half-mile
    assert co_construction_plaques(2641) == 2  # just over
    assert co_construction_plaques(5280) == 2  # one mile
    assert co_construction_plaques(10000) == 4  # ceil(10000/2640) = 4


# ===========================================================================
# Section 3 — Device catalog
# ===========================================================================


def test_device_catalog_has_all_types() -> None:
    """Catalog covers all 15 DeviceType members exactly once."""
    assert len(DEVICE_CATALOG) == 15
    assert set(DEVICE_CATALOG.keys()) == set(DeviceType)


def test_channelizer_classification() -> None:
    """get_channelizers returns CONE, DRUM, TUBULAR_MARKER, CHANNELIZER_OPTIONAL."""
    chans = get_channelizers()
    assert len(chans) == 4
    assert set(chans) == {
        DeviceType.CONE,
        DeviceType.DRUM,
        DeviceType.TUBULAR_MARKER,
        DeviceType.CHANNELIZER_OPTIONAL,
    }


def test_sign_classification() -> None:
    """get_sign_devices returns SIGN_GENERIC and DETOUR_MARKER."""
    signs = get_sign_devices()
    assert len(signs) == 2
    assert set(signs) == {DeviceType.SIGN_GENERIC, DeviceType.DETOUR_MARKER}


def test_all_devices_are_drawn() -> None:
    """Every taxonomy member is drawn; none are field-only."""
    assert len(get_drawn_devices()) == 15
    assert len(get_field_only_devices()) == 0


def test_device_units() -> None:
    """Spot-check pay-item units against CDOT Section 630."""
    assert DEVICE_CATALOG[DeviceType.CONE].unit == "EACH"
    assert DEVICE_CATALOG[DeviceType.TEMPORARY_BARRIER].unit == "LF"
    assert DEVICE_CATALOG[DeviceType.FLAGGER_STATION].unit == "HOUR"
    assert DEVICE_CATALOG[DeviceType.SIGN_GENERIC].unit == "SF"


# ===========================================================================
# Section 4 — Layout validators
# ===========================================================================
#
# Coordinate convention used throughout this section (from validators.py):
#   station_ft = 0 at the downstream end of the work zone, increasing
#   upstream (against traffic flow).  offset_ft is from the centerline,
#   positive to the right when facing upstream.
#
# Layout zones for the textbook helper (45 mph, 12-ft lane, 500 ft work zone):
#   work zone:            [0,    500]
#   buffer (360 ft):      [500,  860]
#   merging taper (540 ft): [860, 1400]
#   advance warning area: > 1400


def _simple_lane_closure_params() -> ScenarioParams:
    """Reusable ScenarioParams for the textbook scenario."""
    return ScenarioParams(
        speed_mph=45,
        num_lanes=4,
        lane_width_ft=12.0,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=500.0,
        is_divided=True,
        jurisdiction="CDOT",
    )


def _textbook_layout() -> list[DevicePlacement]:
    """Textbook-perfect layout for ``_simple_lane_closure_params``.

    Built per the Phase 2b Part 2 spec:
      - 6 tangent cones along the work zone (offset +12, 90 ft spacing)
      - 13 taper drums spanning the 540 ft taper at 45 ft spacing,
        offsets stepping from +24 (downstream end) to 0 (upstream end)
      - 1 arrow board at the upstream end of the taper
      - 3 advance warning signs at A/B/C = 500 ft, mirrored on the
        opposite side (is_divided=True)
      - 2 G20-5P plaques in the work zone, mirrored
    """
    placements: list[DevicePlacement] = []

    # Work-zone tangent — cones along the closed-lane edge at 90 ft spacing.
    for k in range(6):
        placements.append(
            DevicePlacement(
                device_type=DeviceType.CONE,
                station_ft=k * 90.0,
                offset_ft=12.0,
            )
        )

    # Merging taper — drums at 45 ft spacing, offsets +24 → 0.
    for k in range(13):
        placements.append(
            DevicePlacement(
                device_type=DeviceType.DRUM,
                station_ft=860.0 + k * 45.0,
                offset_ft=24.0 - k * 2.0,
            )
        )

    # Arrow board at the upstream end of the taper.
    placements.append(
        DevicePlacement(
            device_type=DeviceType.ARROW_BOARD,
            station_ft=1400.0,
            offset_ft=24.0,
        )
    )

    # Advance warning signs A/B/C with left-side mirrors.
    for n in range(3):
        station = 1900.0 + n * 500.0  # 1900, 2400, 2900
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=station,
                offset_ft=24.0,
                label="W20-1",
            )
        )
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=station,
                offset_ft=-24.0,
                label="W20-1",
            )
        )

    # Two G20-5P plaques in the work zone, mirrored.
    for station in (100.0, 400.0):
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=station,
                offset_ft=24.0,
                label="G20-5P",
            )
        )
        placements.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=station,
                offset_ft=-24.0,
                label="G20-5P",
            )
        )

    return placements


def test_valid_layout_no_violations() -> None:
    """A textbook-perfect layout produces zero violations."""
    placements = _textbook_layout()
    params = _simple_lane_closure_params()
    violations = validate_layout(placements, params)
    assert violations == [], "Unexpected violations:\n" + "\n".join(
        f"  - {v.severity} {v.rule_id}: {v.message}" for v in violations
    )


def test_taper_too_short() -> None:
    """Compressing the taper to half its formula length fires TAPER_TOO_SHORT."""
    placements: list[DevicePlacement] = []
    for p in _textbook_layout():
        if p.device_type == DeviceType.DRUM:
            # Re-station the 13 drums uniformly into the first 270 ft
            # (half the 540 ft formula length).
            k = round((p.station_ft - 860.0) / 45.0)
            new_station = 860.0 + k * (270.0 / 12.0)
            placements.append(DevicePlacement(p.device_type, new_station, p.offset_ft, p.label))
        else:
            placements.append(p)
    params = _simple_lane_closure_params()
    violations = validate_layout(placements, params)
    assert any(
        v.rule_id == "TAPER_TOO_SHORT" for v in violations
    ), f"Expected TAPER_TOO_SHORT, got: {[v.rule_id for v in violations]}"


def test_missing_advance_warning_signs() -> None:
    """Removing every SIGN_GENERIC fires an advance-sign error."""
    placements = [p for p in _textbook_layout() if p.device_type != DeviceType.SIGN_GENERIC]
    params = _simple_lane_closure_params()
    violations = validate_layout(placements, params)
    advance_errors = [
        v
        for v in violations
        if v.severity == "error" and ("ADVANCE" in v.rule_id or "SIGN" in v.rule_id)
    ]
    assert advance_errors, (
        f"Expected an advance-sign error, got: " f"{[(v.severity, v.rule_id) for v in violations]}"
    )


def test_buffer_too_short() -> None:
    """Pulling the taper toward the work zone fires BUFFER_TOO_SHORT."""
    # Shift drums and the arrow board 200 ft downstream — buffer becomes
    # 660 - 500 = 160 ft, well below the 0.9·360 = 324 ft floor.
    placements: list[DevicePlacement] = []
    for p in _textbook_layout():
        if p.device_type in (DeviceType.DRUM, DeviceType.ARROW_BOARD):
            placements.append(
                DevicePlacement(p.device_type, p.station_ft - 200.0, p.offset_ft, p.label)
            )
        else:
            placements.append(p)
    params = _simple_lane_closure_params()
    violations = validate_layout(placements, params)
    assert any(
        v.rule_id == "BUFFER_TOO_SHORT" for v in violations
    ), f"Expected BUFFER_TOO_SHORT, got: {[v.rule_id for v in violations]}"


def test_missing_arrow_board() -> None:
    """Removing the arrow board fires MISSING_ARROW_BOARD."""
    placements = [p for p in _textbook_layout() if p.device_type != DeviceType.ARROW_BOARD]
    params = _simple_lane_closure_params()
    violations = validate_layout(placements, params)
    assert any(
        v.rule_id == "MISSING_ARROW_BOARD" for v in violations
    ), f"Expected MISSING_ARROW_BOARD, got: {[v.rule_id for v in violations]}"


def test_co_signs_one_side_only() -> None:
    """Removing left-side mirror signs fires CO_SIGN_BOTH_SIDES errors."""
    placements = [
        p
        for p in _textbook_layout()
        if not (DEVICE_CATALOG[p.device_type].is_sign and p.offset_ft < 0)
    ]
    params = _simple_lane_closure_params()
    violations = validate_layout(placements, params)
    co_errors = [
        v for v in violations if v.rule_id == "CO_SIGN_BOTH_SIDES" and v.severity == "error"
    ]
    assert co_errors, (
        f"Expected CO_SIGN_BOTH_SIDES errors, got: "
        f"{[(v.severity, v.rule_id) for v in violations]}"
    )


def test_mobile_skips_taper_check() -> None:
    """Mobile operations bypass the taper-presence and -length checks."""
    params = ScenarioParams(
        speed_mph=45,
        num_lanes=2,
        closure_type="mobile",
        road_type="rural",
        work_zone_length_ft=100.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    violations = validate_layout([], params)
    taper_violations = [v for v in violations if "TAPER" in v.rule_id]
    assert (
        not taper_violations
    ), f"Did not expect taper violations, got: {[v.rule_id for v in taper_violations]}"


def test_flagger_stations_required() -> None:
    """A single-lane closure on a 2-lane two-way road requires flaggers."""
    params = ScenarioParams(
        speed_mph=35,
        num_lanes=2,
        closure_type="lane",
        road_type="urban_low",
        work_zone_length_ft=300.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    violations = validate_layout([], params)
    assert any(
        "FLAGGER" in v.rule_id for v in violations
    ), f"Expected a FLAGGER violation, got: {[v.rule_id for v in violations]}"


def test_flagger_not_required_for_divided() -> None:
    """A divided-highway lane closure does not require flagger stations."""
    params = ScenarioParams(
        speed_mph=45,
        num_lanes=4,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=500.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    violations = validate_layout([], params)
    flagger_violations = [v for v in violations if "FLAGGER" in v.rule_id]
    assert not flagger_violations, (
        f"Did not expect FLAGGER violations, got: " f"{[v.rule_id for v in flagger_violations]}"
    )
