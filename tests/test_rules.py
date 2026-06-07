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
    pick_device_count,
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
    validate_corridor_geometry,
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
    """Table 6C-2 lookup at silent CDOT speeds (falls back to federal)."""
    # 45 and 60 mph: CDOT supplement is silent → falls back to MUTCD.
    # Assertion holds under both jurisdiction=CDOT (default) and =federal.
    assert buffer_space(45) == pytest.approx(360.0)
    assert buffer_space(60) == pytest.approx(570.0)
    with pytest.raises(ValueError):
        buffer_space(42)  # not a 5-mph increment
    with pytest.raises(ValueError):
        buffer_space(80)  # out of table range


# ---------------------------------------------------------------------------
# V1-Wide Item 2 — jurisdiction-aware buffer_space
# ---------------------------------------------------------------------------


def test_buffer_space_cdot_at_65_returns_570() -> None:
    """CDOT supplement minimum at 65 mph (S-630-1 Sheet 14 Case 26)."""
    assert buffer_space(65, jurisdiction="CDOT") == pytest.approx(570.0)


def test_buffer_space_cdot_at_75_returns_650() -> None:
    """CDOT supplement minimum at 75 mph (S-630-1 Sheet 14 Case 27)."""
    assert buffer_space(75, jurisdiction="CDOT") == pytest.approx(650.0)


def test_buffer_space_cdot_silent_fallback_at_55() -> None:
    """CDOT silent at 55 mph → falls back to federal MUTCD 495."""
    assert buffer_space(55, jurisdiction="CDOT") == pytest.approx(495.0)


def test_buffer_space_cdot_silent_fallback_at_45() -> None:
    """CDOT silent at 45 mph → falls back to federal MUTCD 360."""
    assert buffer_space(45, jurisdiction="CDOT") == pytest.approx(360.0)


def test_buffer_space_federal_at_65_returns_645() -> None:
    """Federal path bypasses CDOT supplement; returns full MUTCD 645."""
    assert buffer_space(65, jurisdiction="federal") == pytest.approx(645.0)


def test_buffer_space_federal_at_75_returns_820() -> None:
    """Federal path returns MUTCD 820, not CDOT 650."""
    assert buffer_space(75, jurisdiction="federal") == pytest.approx(820.0)


def test_buffer_space_rejects_unknown_jurisdiction() -> None:
    """Only 'CDOT' and 'federal' are recognized; everything else raises."""
    with pytest.raises(ValueError, match="jurisdiction"):
        buffer_space(55, jurisdiction="TxDOT")


def test_cdot_buffer_space_table_only_has_65_and_75() -> None:
    """CDOT_BUFFER_SPACE is intentionally sparse — only the two speeds
    that S-630-1 Sheet 14 posts as 'MIN' annotations. Other speeds are
    silent per General Note 23 (engineer's judgment)."""
    from src.rules.tables import CDOT_BUFFER_SPACE

    speeds = {row.speed_mph for row in CDOT_BUFFER_SPACE}
    assert speeds == {65, 75}
    by_speed = {row.speed_mph: row.buffer_ft for row in CDOT_BUFFER_SPACE}
    assert by_speed[65] == 570
    assert by_speed[75] == 650


def test_is_cdot_minimum_true_only_at_65_and_75_cdot() -> None:
    """Predicate that distinguishes CDOT regulatory floors from MUTCD
    advisory values. Drives the validator's tolerance branching."""
    from src.rules.spacing import _is_cdot_minimum

    assert _is_cdot_minimum("CDOT", 65) is True
    assert _is_cdot_minimum("CDOT", 75) is True
    assert _is_cdot_minimum("CDOT", 55) is False  # CDOT silent at 55
    assert _is_cdot_minimum("CDOT", 60) is False
    assert _is_cdot_minimum("federal", 65) is False  # federal path
    assert _is_cdot_minimum("federal", 75) is False


def test_advance_warning_auto_inference() -> None:
    """Speed-based inference selects urban/rural; 55+ mph requires explicit."""
    # 30 mph -> urban_low (A=B=C=100)
    assert advance_warning_spacing(30) == {"A": 100.0, "B": 100.0, "C": 100.0}
    # 40 mph -> urban_high (A=B=C=350)
    assert advance_warning_spacing(40) == {"A": 350.0, "B": 350.0, "C": 350.0}
    # 45-54 mph band -> rural (A=B=C=500)
    assert advance_warning_spacing(50) == {"A": 500.0, "B": 500.0, "C": 500.0}
    # 60 mph with explicit expressway -> asymmetric 1000/1500/2640
    assert advance_warning_spacing(60, road_type="expressway") == {
        "A": 1000.0,
        "B": 1500.0,
        "C": 2640.0,
    }
    # Bug Fix 6: 55+ mph with no road_type now raises rather than
    # silently picking rural (which under-spec'd interstates by
    # thousands of feet on the C sign).
    with pytest.raises(ValueError, match="explicit road_type"):
        advance_warning_spacing(60)


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


def test_pick_device_count_both_in_window() -> None:
    """Both candidates fit the asymmetric window; closer-to-target wins.

    The window is ``[target * 0.9, target]`` — asymmetric: lower bound
    relaxed, upper bound clamped at the MUTCD §6C.09 max.
    """
    # 1000 ft, target 90 → exact 11.11
    # floor=11 intervals → 90.9 ft (above 90 max — REJECTED)
    # ceil=12 intervals  → 83.3 ft (in [81, 90] — in window)
    # Only ceil fits → 12 intervals → 13 devices.  Before the
    # asymmetric-window fix this returned 12 because floor's 0.9-ft
    # over-max spacing won the absolute-deviation comparison against
    # ceil's 6.7-ft under-target spacing.
    assert pick_device_count(1000, 90) == 13


def test_pick_device_count_only_one_in_window() -> None:
    """Picks the in-window candidate when its sibling falls outside."""
    # 800 ft, target 90 → exact 8.89
    # floor=8  → 100 ft (above 90 max)
    # ceil=9   → 88.9 ft (in [81, 90])
    assert pick_device_count(800, 90) == 10


def test_pick_device_count_neither_in_window() -> None:
    """Picks the safer (smaller-spacing) candidate when neither fits.

    When both floor- and ceil-interval candidates fall outside the
    asymmetric window, the picker prefers ceil (= more devices,
    smaller spacing) so we never exceed the MUTCD §6C.09 maximum.
    """
    # 150 ft, target 45 → exact 3.33
    # floor=3 → 50 ft  (over the 45 max)
    # ceil=4  → 37.5 ft (under the 40.5 lower bound — too tight)
    # ceil wins → 4 intervals → 5 devices
    assert pick_device_count(150, 45) == 5


def test_pick_device_count_tangent_at_75mph_800ft() -> None:
    """Repro for the 75 mph / 800 ft tangent over-max bug.

    On a 75 mph freeway with an 800 ft work-zone tangent the picker
    previously returned 6 cones at 160 ft spacing — over the 150 ft
    MUTCD §6C.09 maximum.  With the asymmetric-window fix it now
    returns 7 cones at 133.33 ft (within the max).

    Hand calc:
        target = device_spacing_on_tangent(75) = 2 × 75 = 150 ft (max)
        exact intervals = 800 / 150 = 5.333
        floor=5 → 800/5 = 160 ft (above 150 max — REJECTED)
        ceil=6  → 800/6 = 133.33 ft (below 135 lower bound — too tight)
        Neither fits → ceil wins → 6 intervals → 7 devices.
    """
    # device_spacing_on_tangent(75) = 150
    assert pick_device_count(800, 150, min_count=2) == 7


def test_pick_device_count_min_count_floor() -> None:
    """Returned count never falls below ``min_count``."""
    # tiny length picks a small count, but min_count=4 floors it
    assert pick_device_count(50, 45, min_count=4) == 4


def test_pick_device_count_invalid_inputs() -> None:
    """Non-positive length or spacing raises."""
    with pytest.raises(ValueError):
        pick_device_count(0, 45)
    with pytest.raises(ValueError):
        pick_device_count(100, 0)
    with pytest.raises(ValueError):
        pick_device_count(-10, 45)


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
    """Catalog covers every DeviceType member exactly once."""
    assert len(DEVICE_CATALOG) == len(DeviceType)
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
    assert len(get_drawn_devices()) == len(DeviceType)
    assert len(get_field_only_devices()) == 0


def test_device_units() -> None:
    """Spot-check pay-item units against CDOT Section 630."""
    assert DEVICE_CATALOG[DeviceType.CONE].unit == "EACH"
    assert DEVICE_CATALOG[DeviceType.TEMPORARY_BARRIER].unit == "LF"
    assert DEVICE_CATALOG[DeviceType.FLAGGER_STATION].unit == "HOUR"
    assert DEVICE_CATALOG[DeviceType.SIGN_GENERIC].unit == "SF"


def test_no_unverified_pay_items() -> None:
    """Regression guard: every catalog entry has a verified pay item number.

    No entry may carry the literal "TODO" or None for cdot_pay_item_number
    after the 2026-05 CDOT Section 630 verification pass.  Subsidiary items
    carry the literal "subsidiary" string and are explicitly allowed.
    See ``docs/cdot_pay_items.md`` for the mapping and reasoning.
    """
    for device_type, spec in DEVICE_CATALOG.items():
        assert (
            spec.cdot_pay_item_number is not None
        ), f"{device_type.value}: cdot_pay_item_number is None"
        assert (
            spec.cdot_pay_item_number != "TODO"
        ), f"{device_type.value}: cdot_pay_item_number is still 'TODO'"


def test_pay_item_number_format() -> None:
    """Every non-subsidiary pay item number matches the CDOT 630-XXXXX format."""
    import re

    pattern = re.compile(r"^630-\d{5}$")
    for device_type, spec in DEVICE_CATALOG.items():
        number = spec.cdot_pay_item_number
        if number == "subsidiary":
            assert (
                spec.cdot_pay_item is None
            ), f"{device_type.value}: subsidiary items must have cdot_pay_item=None"
            continue
        assert pattern.match(
            number or ""
        ), f"{device_type.value}: pay item number {number!r} does not match 630-XXXXX format"


def test_pay_item_name_present_when_not_subsidiary() -> None:
    """Non-subsidiary entries must carry the verbatim CDOT §630.18 name."""
    for device_type, spec in DEVICE_CATALOG.items():
        if spec.cdot_pay_item_number == "subsidiary":
            continue
        assert (
            spec.cdot_pay_item
        ), f"{device_type.value}: non-subsidiary entry missing cdot_pay_item name"


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
        median-side shoulder per CO Supplement §6C.04(A)
      - 2 G20-5P plaques in the work zone, mirrored on both sides
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

    # Advance warning signs A/B/C, mirrored on both sides of the
    # divided roadway per CO Supplement §6C.04(A).
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

    # Two G20-5P plaques in the work zone, mirrored on both sides.
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
    assert (
        advance_errors
    ), f"Expected an advance-sign error, got: {[(v.severity, v.rule_id) for v in violations]}"


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
    """Stripping left-side mirrors fires CO_SIGN_BOTH_SIDES on a divided highway.

    Bug Fix 1 wired the both-sides rule to ``is_divided`` on the
    canonical textbook layout.  Bug Fix 6 then removed the legacy
    ``one_way_street``/``multi_lane_ramp`` road_type triggers (those
    are not Table 6B-1 categories), so the divided-highway path is
    now the sole live trigger and the regression check follows it.
    """
    params = _simple_lane_closure_params()  # is_divided=True, road_type="rural"
    placements = [
        p
        for p in _textbook_layout()
        if not (DEVICE_CATALOG[p.device_type].is_sign and p.offset_ft < 0)
    ]
    violations = validate_layout(placements, params)
    co_errors = [
        v for v in violations if v.rule_id == "CO_SIGN_BOTH_SIDES" and v.severity == "error"
    ]
    assert (
        co_errors
    ), f"Expected CO_SIGN_BOTH_SIDES errors, got: {[(v.severity, v.rule_id) for v in violations]}"


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
    assert (
        not flagger_violations
    ), f"Did not expect FLAGGER violations, got: {[v.rule_id for v in flagger_violations]}"


def _shoulder_divided_params() -> ScenarioParams:
    """Canonical TA-2 params for the new divided-highway shoulder validators."""
    return ScenarioParams(
        speed_mph=65,
        num_lanes=4,
        closure_type="shoulder",
        road_type="expressway",
        work_zone_length_ft=5000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )


def test_shoulder_divided_signs_mirrored_both_sides() -> None:
    """The canonical TA-2 generator output mirrors every sign on both sides.

    CO Supplement §6C.04(A) requires signs on both sides of a divided
    highway.  Each SIGN_GENERIC placement at +offset must have a
    matching placement at -offset (same station, same label).
    """
    from src.generation.layout import generate_shoulder_closure_divided

    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params)
    right_signs = [
        p for p in placements if p.device_type == DeviceType.SIGN_GENERIC and p.offset_ft > 0
    ]
    left_signs = [
        p for p in placements if p.device_type == DeviceType.SIGN_GENERIC and p.offset_ft < 0
    ]
    assert len(right_signs) == len(left_signs) > 0, (
        f"Expected balanced left/right sign counts on a divided shoulder closure; "
        f"got {len(right_signs)} right, {len(left_signs)} left."
    )

    violations = validate_layout(placements, params)
    co_errors = [v for v in violations if v.rule_id == "CO_SIGN_BOTH_SIDES"]
    assert not co_errors, (
        "Canonical TA-2 generator output must not raise CO_SIGN_BOTH_SIDES: "
        f"{[v.message for v in co_errors]}"
    )


def test_shoulder_divided_one_side_only_fires_error() -> None:
    """Stripping the median-side mirrors fires CO_SIGN_BOTH_SIDES at error severity."""
    from src.generation.layout import generate_shoulder_closure_divided

    params = _shoulder_divided_params()
    placements = [
        p
        for p in generate_shoulder_closure_divided(params)
        if not (DEVICE_CATALOG[p.device_type].is_sign and p.offset_ft < 0)
    ]
    violations = validate_layout(placements, params)
    assert any(
        v.rule_id == "CO_SIGN_BOTH_SIDES" and v.severity == "error" for v in violations
    ), f"Expected CO_SIGN_BOTH_SIDES error, got: {[(v.severity, v.rule_id) for v in violations]}"


def test_begin_road_work_required_with_end() -> None:
    """Removing G20-1 from a layout that has G20-2 fires MISSING_BEGIN_ROAD_WORK."""
    from src.generation.layout import generate_shoulder_closure_divided

    params = _shoulder_divided_params()
    placements = [
        p
        for p in generate_shoulder_closure_divided(params)
        if not (p.device_type == DeviceType.SIGN_GENERIC and p.label == "G20-1")
    ]
    violations = validate_layout(placements, params)
    assert any(
        v.rule_id == "MISSING_BEGIN_ROAD_WORK" and v.severity == "error" for v in violations
    ), f"Expected MISSING_BEGIN_ROAD_WORK, got: {[v.rule_id for v in violations]}"


def test_begin_road_work_present_in_canonical_layout() -> None:
    """The canonical TA-2 generator output includes G20-1 BEGIN ROAD WORK."""
    from src.generation.layout import generate_shoulder_closure_divided

    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params)
    has_begin = any(
        p.device_type == DeviceType.SIGN_GENERIC and p.label == "G20-1" for p in placements
    )
    assert has_begin, "Expected G20-1 BEGIN ROAD WORK in the canonical TA-2 layout"


def test_w20_2_label_substitutes_distance() -> None:
    """Rendered notes substitute the actual distance into the W20-2 line.

    Regression for the literal "ROAD WORK XXX FT" placeholder that
    leaked through to the generated PDF.
    """
    import os
    import tempfile

    import pypdfium2 as pdfium

    from src.generation.layout import generate_shoulder_closure_divided
    from src.rendering.plan_sheet import render_plan_sheet

    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params)

    fd, path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    try:
        render_plan_sheet(placements, params, output_path=path, shoulder_width_ft=10.0)
        pdf = pdfium.PdfDocument(path)
        try:
            text = pdf[0].get_textpage().get_text_range()
        finally:
            pdf.close()
    finally:
        os.unlink(path)

    assert (
        "ROAD WORK XXX FT" not in text
    ), "Rendered PDF still contains the literal 'ROAD WORK XXX FT' placeholder"
    assert "ROAD WORK 2500 FT" in text, (
        "Expected the substituted W20-2 distance 'ROAD WORK 2500 FT' in the rendered PDF; "
        f"found notes text: {text!r}"
    )
    assert (
        "NEXT XXX FT" not in text
    ), "Rendered PDF still contains the literal 'NEXT XXX FT' placeholder for G20-1"
    assert "NEXT 5000 FT" in text, (
        "Expected the substituted G20-1 distance 'NEXT 5000 FT' in the rendered PDF; "
        f"found notes text: {text!r}"
    )
    for header in ("PARAMETERS", "SIGN SCHEDULE", "ADVANCE WARNING SIGNS"):
        assert header in text, (
            f"Expected sub-section header {header!r} in the rendered notes panel; "
            f"found text: {text!r}"
        )
    for column in ("CODE", "DESCRIPTION", "DISTANCE"):
        assert (
            column in text
        ), f"Expected column header {column!r} in the rendered notes panel; found text: {text!r}"


def _lane_divided_params() -> ScenarioParams:
    """Canonical TA-19 params for the divided-highway lane-closure validators."""
    return ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="lane",
        road_type="expressway",
        work_zone_length_ft=5000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )


def test_lane_closure_signs_mirrored_both_sides() -> None:
    """The canonical TA-19 generator output mirrors every sign on both sides."""
    from src.generation.layout import generate_lane_closure_divided

    params = _lane_divided_params()
    placements = generate_lane_closure_divided(params)
    right_signs = [
        p for p in placements if p.device_type == DeviceType.SIGN_GENERIC and p.offset_ft > 0
    ]
    left_signs = [
        p for p in placements if p.device_type == DeviceType.SIGN_GENERIC and p.offset_ft < 0
    ]
    assert len(right_signs) == len(left_signs) > 0, (
        f"Expected balanced left/right sign counts on a divided lane closure; "
        f"got {len(right_signs)} right, {len(left_signs)} left."
    )

    violations = validate_layout(placements, params)
    co_errors = [v for v in violations if v.rule_id == "CO_SIGN_BOTH_SIDES"]
    assert not co_errors, (
        "Canonical TA-19 generator output must not raise CO_SIGN_BOTH_SIDES: "
        f"{[v.message for v in co_errors]}"
    )


def test_lane_closure_one_side_only_fires_error() -> None:
    """Stripping the median-side mirrors fires CO_SIGN_BOTH_SIDES at error severity."""
    from src.generation.layout import generate_lane_closure_divided

    params = _lane_divided_params()
    placements = [
        p
        for p in generate_lane_closure_divided(params)
        if not (DEVICE_CATALOG[p.device_type].is_sign and p.offset_ft < 0)
    ]
    violations = validate_layout(placements, params)
    assert any(
        v.rule_id == "CO_SIGN_BOTH_SIDES" and v.severity == "error" for v in violations
    ), f"Expected CO_SIGN_BOTH_SIDES error, got: {[(v.severity, v.rule_id) for v in violations]}"


def test_lane_closure_begin_road_work_required_with_end() -> None:
    """Removing G20-1 from a TA-19 layout that has G20-2 fires MISSING_BEGIN_ROAD_WORK."""
    from src.generation.layout import generate_lane_closure_divided

    params = _lane_divided_params()
    placements = [
        p
        for p in generate_lane_closure_divided(params)
        if not (p.device_type == DeviceType.SIGN_GENERIC and p.label == "G20-1")
    ]
    violations = validate_layout(placements, params)
    assert any(
        v.rule_id == "MISSING_BEGIN_ROAD_WORK" and v.severity == "error" for v in violations
    ), f"Expected MISSING_BEGIN_ROAD_WORK, got: {[v.rule_id for v in violations]}"


def test_lane_closure_begin_road_work_present_in_canonical_layout() -> None:
    """The canonical TA-19 generator output includes G20-1 BEGIN ROAD WORK."""
    from src.generation.layout import generate_lane_closure_divided

    params = _lane_divided_params()
    placements = generate_lane_closure_divided(params)
    has_begin = any(
        p.device_type == DeviceType.SIGN_GENERIC and p.label == "G20-1" for p in placements
    )
    assert has_begin, "Expected G20-1 BEGIN ROAD WORK in the canonical TA-19 layout"


def test_lane_closure_uses_w20_5r_not_w20_5b() -> None:
    """Regression: B-position advance sign label is the real MUTCD W20-5R, not the typo W20-5B."""
    from src.generation.layout import generate_lane_closure_divided

    params = _lane_divided_params()
    placements = generate_lane_closure_divided(params)
    labels = {p.label for p in placements if p.label is not None}
    assert "W20-5B" not in labels, "W20-5B is not a real MUTCD code; expected W20-5R"
    assert (
        "W20-5R" in labels
    ), f"Expected RIGHT LANE CLOSED AHEAD label W20-5R in TA-19 layout; got labels: {labels!r}"


def _flagger_params() -> ScenarioParams:
    """Canonical TA-10 params for the flagger-controlled validators."""
    return ScenarioParams(
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


def test_flagger_uses_w3_4_not_w20_4() -> None:
    """Regression: BE PREPARED TO STOP code is W3-4, not the typo W20-4 (= ONE LANE ROAD AHEAD)."""
    from src.generation.layout import generate_flagger_alternating_2lane

    params = _flagger_params()
    placements = generate_flagger_alternating_2lane(params)
    labels = {p.label for p in placements if p.label is not None}
    assert "W20-4" not in labels, "W20-4 is ONE LANE ROAD AHEAD, not BE PREPARED TO STOP — use W3-4"
    assert (
        "W3-4" in labels
    ), f"Expected BE PREPARED TO STOP label W3-4 in TA-10 layout; got labels: {labels!r}"


def test_flagger_pilot_car_uses_g20_4_not_w20_1a() -> None:
    """Regression: PILOT CAR FOLLOW ME is G20-4 (guide), not W20-1A (warning)."""
    from src.generation.layout import generate_flagger_alternating_2lane

    params = _flagger_params()
    placements = generate_flagger_alternating_2lane(params, pilot_car=True)
    labels = {p.label for p in placements if p.label is not None}
    assert "W20-1A" not in labels, "W20-1A is not a real MUTCD code; PILOT CAR FOLLOW ME is G20-4"
    assert (
        "G20-4" in labels
    ), f"Expected G20-4 PILOT CAR FOLLOW ME in pilot_car=True layout; got labels: {labels!r}"


def test_flagger_advance_sign_order_canonical_layout() -> None:
    """Canonical TA-10 output: FLAGGER (W20-7) at A and BE PREPARED TO STOP (W3-4) at B.

    Walking signs from upstream → downstream (highest station first), the
    first sign cluster the driver sees should be ROAD WORK AHEAD (W20-1),
    then BE PREPARED TO STOP (W3-4), then FLAGGER (W20-7) closest to the
    flagger station.
    """
    from src.generation.layout import generate_flagger_alternating_2lane

    params = _flagger_params()
    placements = generate_flagger_alternating_2lane(params)
    # Look at right-direction advance signs only (positive offset, station > 1500ft)
    right_advance = sorted(
        [
            p
            for p in placements
            if p.device_type == DeviceType.SIGN_GENERIC
            and p.offset_ft > 0
            and p.station_ft > 1500.0
            and (p.label or "") in {"W20-1", "W3-4", "W20-7", "W20-7a"}
        ],
        key=lambda p: -p.station_ft,  # most upstream first
    )
    labels = [p.label for p in right_advance]
    assert labels == [
        "W20-1",
        "W3-4",
        "W20-7",
    ], f"Expected advance sign order [C,B,A] = [W20-1, W3-4, W20-7]; got {labels}"


def test_flagger_advance_sign_order_validator_fires_when_reversed() -> None:
    """Reverting to the old A=W20-4, B=W20-7 order fires FLAGGER_ADVANCE_SIGN_ORDER."""
    from src.generation.layout import generate_flagger_alternating_2lane

    params = _flagger_params()
    placements = list(generate_flagger_alternating_2lane(params))
    # Rewrite the right-direction advance signs to the broken pre-fix order.
    out: list[DevicePlacement] = []
    for p in placements:
        if (
            p.device_type == DeviceType.SIGN_GENERIC
            and p.offset_ft > 0
            and p.station_ft > 1500.0
            and p.label in {"W20-7", "W3-4"}
        ):
            new_label = "W20-4" if p.label == "W3-4" else "W20-7"
            # Swap so W20-7 is at position B (middle) and the bogus
            # W20-4 ends up at A (closest to flagger) — the old bug.
            out.append(
                DevicePlacement(
                    device_type=p.device_type,
                    station_ft=p.station_ft,
                    offset_ft=p.offset_ft,
                    label=new_label,
                )
            )
        else:
            out.append(p)
    violations = validate_layout(out, params)
    assert any(
        v.rule_id == "FLAGGER_ADVANCE_SIGN_ORDER" and v.severity == "error" for v in violations
    ), f"Expected FLAGGER_ADVANCE_SIGN_ORDER, got: {[v.rule_id for v in violations]}"


def test_flagger_advance_sign_order_validator_clean_on_canonical() -> None:
    """The canonical TA-10 layout produces no FLAGGER_ADVANCE_SIGN_ORDER violations."""
    from src.generation.layout import generate_flagger_alternating_2lane

    params = _flagger_params()
    placements = generate_flagger_alternating_2lane(params)
    violations = validate_layout(placements, params)
    bad = [v for v in violations if v.rule_id == "FLAGGER_ADVANCE_SIGN_ORDER"]
    assert not bad, (
        f"Canonical TA-10 layout should not fire FLAGGER_ADVANCE_SIGN_ORDER: "
        f"{[v.message for v in bad]}"
    )


def test_flagger_advance_sign_order_validator_accepts_afad() -> None:
    """AFAD layouts (W20-7a at position A) also pass the order validator."""
    from src.generation.layout import generate_flagger_alternating_2lane

    params = _flagger_params()
    placements = generate_flagger_alternating_2lane(params, afad=True)
    violations = validate_layout(placements, params)
    bad = [v for v in violations if v.rule_id == "FLAGGER_ADVANCE_SIGN_ORDER"]
    assert not bad, (
        f"AFAD layout (W20-7a at A) should not fire FLAGGER_ADVANCE_SIGN_ORDER: "
        f"{[v.message for v in bad]}"
    )


def _mobile_2lane_params(speed: int = 45) -> ScenarioParams:
    """Canonical TA-35 params for the 2-lane mobile-op validators."""
    return ScenarioParams(
        speed_mph=speed,
        num_lanes=2,
        closure_type="mobile",
        road_type="rural",
        work_zone_length_ft=100.0,
        lane_width_ft=12.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
    )


def test_mobile_uses_w21_1a_lowercase_not_uppercase() -> None:
    """Regression: WORKERS sign code is W21-1a (lowercase suffix per MUTCD), not W21-1A."""
    from src.generation.layout import generate_mobile_op_2lane

    params = _mobile_2lane_params()
    placements = generate_mobile_op_2lane(params)
    labels = {p.label for p in placements if p.label is not None}
    assert "W21-1A" not in labels, (
        "MUTCD suffix convention is lowercase ('W20-7a', 'W3-4', 'W21-1a'); "
        "uppercase 'W21-1A' is the typo"
    )
    assert (
        "W21-1a" in labels
    ), f"Expected WORKERS label W21-1a in TA-35 layout; got labels: {labels!r}"


def test_mobile_emits_road_work_ahead_advance_sign() -> None:
    """The canonical TA-35 layout includes W20-1 ROAD WORK AHEAD upstream."""
    from src.generation.layout import generate_mobile_op_2lane

    params = _mobile_2lane_params()
    placements = generate_mobile_op_2lane(params)
    has_road_work_ahead = any(
        p.device_type == DeviceType.SIGN_GENERIC and p.label == "W20-1" for p in placements
    )
    assert has_road_work_ahead, (
        "MUTCD §6C.05 calls for ROAD WORK AHEAD (W20-1) upstream of any work area, "
        "including mobile ops"
    )


def test_mobile_advance_sign_distance_uses_table_6b1() -> None:
    """The W21-1a WORKERS advance distance comes from Table 6B-1, not a hardcode.

    Regression: pre-fix the generator used a hardcoded ``shadow_station + 500.0``
    which only matched Table 6B-1 at one speed/road bucket.
    """
    from src.generation.layout import generate_mobile_op_2lane

    # Pick two road categories with different Table 6B-1 A-distances.
    # urban_low has A=100; rural has A=500 in MUTCD Table 6B-1.
    placements_urban = generate_mobile_op_2lane(
        ScenarioParams(
            speed_mph=30,
            num_lanes=2,
            closure_type="mobile",
            road_type="urban_low",
            work_zone_length_ft=100.0,
            lane_width_ft=12.0,
            shoulder_width_ft=8.0,
            is_divided=False,
            jurisdiction="CDOT",
        )
    )
    placements_rural = generate_mobile_op_2lane(_mobile_2lane_params(speed=45))

    def workers_station(placements: list[DevicePlacement]) -> float:
        for p in placements:
            if p.label == "W21-1a":
                return p.station_ft
        raise AssertionError("W21-1a not found")

    s_urban = workers_station(placements_urban)
    s_rural = workers_station(placements_rural)
    assert s_rural > s_urban, (
        f"Rural Table 6B-1 A-distance should exceed urban_low; "
        f"got urban_low={s_urban:.0f}, rural={s_rural:.0f}"
    )


def test_mobile_shadow_vehicle_required() -> None:
    """A mobile layout without a SHADOW_TMA fires MISSING_SHADOW_VEHICLE."""
    from src.generation.layout import generate_mobile_op_2lane

    params = _mobile_2lane_params()
    placements = [
        p
        for p in generate_mobile_op_2lane(params)
        if not (
            p.device_type == DeviceType.TRUCK_MOUNTED_ATTENUATOR
            and (p.label or "").upper().startswith("SHADOW")
        )
    ]
    violations = validate_layout(placements, params)
    assert any(
        v.rule_id == "MISSING_SHADOW_VEHICLE" and v.severity == "error" for v in violations
    ), f"Expected MISSING_SHADOW_VEHICLE, got: {[v.rule_id for v in violations]}"


def test_mobile_shadow_vehicle_present_in_canonical_layout() -> None:
    """The canonical TA-35 generator output includes a SHADOW_TMA."""
    from src.generation.layout import generate_mobile_op_2lane

    params = _mobile_2lane_params()
    placements = generate_mobile_op_2lane(params)
    violations = validate_layout(placements, params)
    bad = [v for v in violations if v.rule_id == "MISSING_SHADOW_VEHICLE"]
    assert (
        not bad
    ), f"Canonical TA-35 layout should not fire MISSING_SHADOW_VEHICLE: {[v.message for v in bad]}"


def test_mobile_advance_sign_required_when_missing() -> None:
    """A mobile layout without any upstream signs fires MISSING_MOBILE_ADVANCE_SIGN."""
    from src.generation.layout import generate_mobile_op_2lane

    params = _mobile_2lane_params()
    placements = [
        p for p in generate_mobile_op_2lane(params) if p.device_type != DeviceType.SIGN_GENERIC
    ]
    violations = validate_layout(placements, params)
    assert any(
        v.rule_id == "MISSING_MOBILE_ADVANCE_SIGN" and v.severity == "error" for v in violations
    ), f"Expected MISSING_MOBILE_ADVANCE_SIGN, got: {[v.rule_id for v in violations]}"


def test_mobile_validators_clean_on_canonical() -> None:
    """The canonical TA-35 layout has no errors."""
    from src.generation.layout import generate_mobile_op_2lane

    params = _mobile_2lane_params()
    placements = generate_mobile_op_2lane(params)
    violations = validate_layout(placements, params)
    errors = [v for v in violations if v.severity == "error"]
    assert not errors, (
        f"Canonical TA-35 layout should not produce error-level violations: "
        f"{[(v.rule_id, v.message) for v in errors]}"
    )


# ===========================================================================
# Section 5 — sign_codes module (single source of truth for descriptions)
# ===========================================================================


def test_sign_codes_cover_every_label_emitted_by_canonical_generators() -> None:
    """Every sign label produced by the V1 generators has a non-empty
    description in the consolidated sign_codes module.

    Regression for the parallel-dict drift that left codes like G20-1,
    W20-5R, and W4-2R as bare codes in the device-list xlsx because
    the exporter's local dict had never been updated to match the
    plan-sheet renderer's dict.
    """
    from src.generation.layout import (
        generate_flagger_alternating_2lane,
        generate_lane_closure_divided,
        generate_mobile_op_2lane,
        generate_shoulder_closure_divided,
    )
    from src.rules.sign_codes import SIGN_DESCRIPTIONS, description_for

    placements = (
        list(generate_shoulder_closure_divided(_shoulder_divided_params()))
        + list(generate_lane_closure_divided(_lane_divided_params()))
        + list(generate_flagger_alternating_2lane(_flagger_params()))
        + list(generate_mobile_op_2lane(_mobile_2lane_params()))
    )
    # Skip the synthetic non-MUTCD labels (RIGHT_ARROW, WORK_TRUCK,
    # SHADOW_TMA, etc.) — they're internal glyph keys, not sign codes.
    sign_codes_emitted = {
        p.label
        for p in placements
        if p.device_type == DeviceType.SIGN_GENERIC and p.label is not None
    }

    missing = sorted(c for c in sign_codes_emitted if c not in SIGN_DESCRIPTIONS)
    assert not missing, (
        f"Generators emit sign codes with no entry in SIGN_DESCRIPTIONS: {missing}. "
        "Add them to src/rules/sign_codes.py."
    )

    for code in sign_codes_emitted:
        desc = description_for(code)
        assert desc and desc != code, (
            f"description_for({code!r}) returned a fallback ({desc!r}); "
            "every emitted code should have a real description."
        )


def test_description_for_falls_back_to_bare_code_for_unknown() -> None:
    """Unknown codes round-trip as themselves so xlsx/PDF still render something."""
    from src.rules.sign_codes import description_for

    assert description_for("ZZ-99") == "ZZ-99"


def test_description_for_keeps_xxx_placeholder_for_substitution() -> None:
    """W20-2 and G20-1 carry parametric distances — the literal XXX must
    survive the lookup so consumers can substitute the actual length."""
    from src.rules.sign_codes import description_for

    assert "XXX" in description_for("W20-2")
    assert "XXX" in description_for("G20-1")


# ===========================================================================
# Section 5 — Corridor geometry validator (pre-generation sanity check)
# ===========================================================================


def _i25_mead_shoulder_params(work_zone_ft: float = 200.0) -> ScenarioParams:
    """ScenarioParams matching the I-25 Mead demo test that surfaced the bug.

    75 mph, freeway, divided, shoulder closure, 10 ft shoulder.  At this
    speed shoulder taper L/3 = (10 × 75) / 3 = 250 ft and buffer = 820 ft,
    so a 200 ft work zone trips both the hard taper rule and the soft
    buffer rule.
    """
    return ScenarioParams(
        speed_mph=75,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=work_zone_ft,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )


def test_geometry_validator_blocks_work_zone_shorter_than_taper() -> None:
    """The I-25 Mead demo case (200 ft work zone on 75 mph shoulder)
    must fire WORK_ZONE_SHORTER_THAN_TAPER as a hard error."""
    params = _i25_mead_shoulder_params(work_zone_ft=200.0)
    violations = validate_corridor_geometry(params)
    errors = [v for v in violations if v.severity == "error"]
    assert any(
        v.rule_id == "WORK_ZONE_SHORTER_THAN_TAPER" for v in errors
    ), f"Expected blocking error, got: {[(v.severity, v.rule_id) for v in violations]}"
    # Error message names the actual taper length so the user can act on it.
    msg = next(v.message for v in errors if v.rule_id == "WORK_ZONE_SHORTER_THAN_TAPER")
    assert "250 ft" in msg, msg
    assert "75 mph" in msg, msg


def test_geometry_validator_warns_work_zone_short_vs_buffer() -> None:
    """200 ft work zone against an 820 ft buffer is well under buffer/2
    → soft warning fires (not blocking)."""
    params = _i25_mead_shoulder_params(work_zone_ft=200.0)
    violations = validate_corridor_geometry(params)
    warnings = [v for v in violations if v.severity == "warning"]
    assert any(
        v.rule_id == "WORK_ZONE_SHORT_VS_BUFFER" for v in warnings
    ), f"Expected soft buffer warning, got: {[(v.severity, v.rule_id) for v in violations]}"


def test_geometry_validator_passes_when_work_zone_matches_taper_exactly() -> None:
    """A work zone exactly equal to the taper length is the boundary
    case — must not fire the hard rule (clears the >=L floor)."""
    params = _i25_mead_shoulder_params(work_zone_ft=250.0)
    violations = validate_corridor_geometry(params)
    errors = [v for v in violations if v.severity == "error"]
    assert errors == [], f"Boundary work zone fired error: {[v.rule_id for v in errors]}"


def test_geometry_validator_passes_reasonable_corridor() -> None:
    """Generous work zone (1500 ft on 75 mph shoulder) clears both rules.

    Buffer at 75 mph = 820 ft → half is 410 ft, 1500 ft is well above.
    """
    params = _i25_mead_shoulder_params(work_zone_ft=1500.0)
    violations = validate_corridor_geometry(params)
    assert violations == [], "Reasonable corridor produced violations: " + ", ".join(
        f"{v.severity} {v.rule_id}" for v in violations
    )


def test_geometry_validator_lane_closure_uses_full_taper() -> None:
    """Lane closures use the full merging taper L, not L/3.

    At 45 mph with 12 ft lanes: L = W × S = 540 ft.  A 400 ft work zone
    is short of 540 → hard error fires citing the full taper.
    """
    params = ScenarioParams(
        speed_mph=45,
        num_lanes=4,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=400.0,
        lane_width_ft=12.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    violations = validate_corridor_geometry(params)
    errors = [v for v in violations if v.rule_id == "WORK_ZONE_SHORTER_THAN_TAPER"]
    assert errors, "Lane-closure short work zone must trip the taper rule"
    assert "540 ft" in errors[0].message
    assert "merging taper" in errors[0].message.lower()


def test_geometry_validator_exempts_mobile_and_off_road() -> None:
    """Mobile (moving TMA) and off-road (work beyond shoulder) closures
    don't have a fixed merging taper — geometry rules must not fire."""
    for closure_type in ("mobile", "off_road"):
        params = ScenarioParams(
            speed_mph=75,
            num_lanes=2,
            closure_type=closure_type,
            road_type="freeway",
            work_zone_length_ft=50.0,  # absurdly short — would fail if checked
            is_divided=True,
            jurisdiction="CDOT",
        )
        violations = validate_corridor_geometry(params)
        assert violations == [], f"closure_type={closure_type} should be exempt, got: " + ", ".join(
            v.rule_id for v in violations
        )


# ===========================================================================
# G3 — LANE_WIDTH_BELOW_FREEWAY_MIN: 11 ft minimum lane width on freeway.
# Source: CDOT S-630-1 Sheet 7 (Case 11), "11' MIN." annotation on the
# temporary edge line callout.  Validator-layer enforcement of a freeway
# design constraint, independent of closure type.
# ===========================================================================


def test_geometry_validator_blocks_freeway_lane_below_11ft() -> None:
    """Freeway × 10 ft lane width must fire LANE_WIDTH_BELOW_FREEWAY_MIN."""
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=1500.0,
        lane_width_ft=10.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    violations = validate_corridor_geometry(params)
    errors = [v for v in violations if v.severity == "error"]
    assert any(
        v.rule_id == "LANE_WIDTH_BELOW_FREEWAY_MIN" for v in errors
    ), f"Expected freeway lane-width error, got: {[(v.severity, v.rule_id) for v in violations]}"
    msg = next(v.message for v in errors if v.rule_id == "LANE_WIDTH_BELOW_FREEWAY_MIN")
    assert "10.0 ft" in msg, msg
    assert "11 ft" in msg, msg


def test_geometry_validator_passes_freeway_lane_at_11ft_boundary() -> None:
    """Freeway × 11.0 ft is the boundary — must clear the >=11 floor."""
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=1500.0,
        lane_width_ft=11.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    violations = validate_corridor_geometry(params)
    assert not any(
        v.rule_id == "LANE_WIDTH_BELOW_FREEWAY_MIN" for v in violations
    ), f"Boundary 11 ft fired G3 error: {[v.rule_id for v in violations]}"


def test_geometry_validator_skips_non_freeway_narrow_lane() -> None:
    """Rural × 9 ft lane width does not trip the freeway-scoped rule.

    Confirms G3 is gated on road_type=='freeway' — narrower lanes on
    rural/urban facilities are governed by separate design standards
    not enforced by this validator.
    """
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=1500.0,
        lane_width_ft=9.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    violations = validate_corridor_geometry(params)
    assert not any(
        v.rule_id == "LANE_WIDTH_BELOW_FREEWAY_MIN" for v in violations
    ), f"Non-freeway scenario fired G3 error: {[v.rule_id for v in violations]}"


def test_geometry_validator_freeway_lane_check_applies_to_mobile() -> None:
    """Mobile-on-freeway × 10 ft still fires G3.

    The mobile/off_road exemption applies to taper- and buffer-keyed
    rules only.  G3 is a roadway design constraint (the public's
    travel lane must be >=11 ft on a freeway) and the closure-type
    exemption must not swallow it.
    """
    for closure_type in ("mobile", "off_road"):
        params = ScenarioParams(
            speed_mph=75,
            num_lanes=2,
            closure_type=closure_type,
            road_type="freeway",
            work_zone_length_ft=50.0,
            lane_width_ft=10.0,
            is_divided=True,
            jurisdiction="CDOT",
        )
        violations = validate_corridor_geometry(params)
        assert any(v.rule_id == "LANE_WIDTH_BELOW_FREEWAY_MIN" for v in violations), (
            f"closure_type={closure_type} on freeway × 10 ft should still fire G3, "
            f"got: {[v.rule_id for v in violations]}"
        )


# ===========================================================================
# V1-Wide Item 3 — validate_fines_double_envelope + _is_flagger_scenario
#                  + _NON_ADVANCE_WARNING_SIGN_LABELS regression.
# ===========================================================================


def _fines_double_params(
    *,
    closure_type: str = "shoulder",
    is_divided: bool = True,
    num_lanes: int = 2,
    work_zone_speed_mph: int | None = 45,
) -> ScenarioParams:
    return ScenarioParams(
        speed_mph=55,
        num_lanes=num_lanes,
        closure_type=closure_type,
        road_type="freeway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=is_divided,
        jurisdiction="CDOT",
        work_zone_speed_mph=work_zone_speed_mph,
    )


def _mk_envelope_placements(
    include_r2_10: bool,
    include_r2_11: bool,
    *,
    include_entrance_r2_1: bool = True,
    n_w3_5_signs: int = 1,
) -> list[DevicePlacement]:
    """Hand-constructed placement list with the requested envelope signs.

    Bypasses the generator so the validator is tested in isolation.
    ``include_entrance_r2_1`` defaults to True so existing R2-10/R2-11
    tests don't double-fire MISSING_R2_1_ENTRANCE (G4).
    ``n_w3_5_signs`` defaults to 1 so existing tests don't double-fire
    MISSING_W3_5 (G5) — assumes the harness ``_fines_double_params``
    (55→45, Δ=10 → 1 sign required).  Override to 0 to drop the W3-5
    family entirely, or to ≥ 2 for stepped scenarios.
    """
    out: list[DevicePlacement] = []
    if include_r2_10:
        out.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=1300.0,
                offset_ft=28.0,
                label="R2-10",
            )
        )
    if include_r2_11:
        out.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=-500.0,
                offset_ft=28.0,
                label="R2-11",
            )
        )
    if include_entrance_r2_1:
        # Inside wz (0 < station <= wz_len=800): satisfies G4 validator.
        out.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=600.0,
                offset_ft=28.0,
                label="R2-1",
            )
        )
    for k in range(n_w3_5_signs):
        # G5: W3-5 advisory speed sign(s). Speed and station details
        # don't matter for the validator (only count by prefix), so the
        # harness uses synthetic ascending stations and a single speed.
        out.append(
            DevicePlacement(
                device_type=DeviceType.SIGN_GENERIC,
                station_ft=1830.0 + k * 530.0,
                offset_ft=28.0,
                label=f"W3-5({45 - k * 5})",
            )
        )
    return out


def test_validate_fines_double_envelope_pass_when_both_signs_present() -> None:
    """Happy path: R2-10 + R2-11 + entrance R2-1 satisfy the validator."""
    from src.rules.validators import validate_fines_double_envelope

    params = _fines_double_params()
    placements = _mk_envelope_placements(include_r2_10=True, include_r2_11=True)
    violations = validate_fines_double_envelope(placements, params)
    assert violations == []


def test_validate_fines_double_envelope_error_when_r2_10_missing() -> None:
    """Missing R2-10 → MISSING_R2_10 error violation."""
    from src.rules.validators import validate_fines_double_envelope

    params = _fines_double_params()
    placements = _mk_envelope_placements(include_r2_10=False, include_r2_11=True)
    violations = validate_fines_double_envelope(placements, params)
    assert len(violations) == 1
    assert violations[0].rule_id == "MISSING_R2_10"
    assert violations[0].severity == "error"


def test_validate_fines_double_envelope_error_when_r2_11_missing() -> None:
    """Missing R2-11 → MISSING_R2_11 error violation."""
    from src.rules.validators import validate_fines_double_envelope

    params = _fines_double_params()
    placements = _mk_envelope_placements(include_r2_10=True, include_r2_11=False)
    violations = validate_fines_double_envelope(placements, params)
    assert len(violations) == 1
    assert violations[0].rule_id == "MISSING_R2_11"


def test_validate_fines_double_envelope_error_when_entrance_r2_1_missing() -> None:
    """Missing entrance R2-1 → MISSING_R2_1_ENTRANCE error (G4)."""
    from src.rules.validators import validate_fines_double_envelope

    params = _fines_double_params()
    placements = _mk_envelope_placements(
        include_r2_10=True, include_r2_11=True, include_entrance_r2_1=False
    )
    violations = validate_fines_double_envelope(placements, params)
    assert len(violations) == 1
    assert violations[0].rule_id == "MISSING_R2_1_ENTRANCE"
    assert violations[0].severity == "error"
    assert violations[0].mutcd_section == "CO Supplement §2B.13(A)"


def test_validate_fines_double_envelope_entrance_r2_1_outside_wz_does_not_satisfy() -> None:
    """Downstream R2-1 (negative station) alone is not the entrance R2-1
    G4 requires — validator still fires MISSING_R2_1_ENTRANCE."""
    from src.rules.validators import validate_fines_double_envelope

    params = _fines_double_params()
    placements = _mk_envelope_placements(
        include_r2_10=True, include_r2_11=True, include_entrance_r2_1=False
    )
    # Add a downstream R2-1 at wz_end - 1000 (negative station). This
    # mirrors the downstream restoration sign but isn't inside wz.
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=-1000.0,
            offset_ft=28.0,
            label="R2-1",
        )
    )
    violations = validate_fines_double_envelope(placements, params)
    assert len(violations) == 1
    assert violations[0].rule_id == "MISSING_R2_1_ENTRANCE"


def test_validate_fines_double_envelope_error_when_w3_5_missing() -> None:
    """Missing W3-5 (any) → MISSING_W3_5 error (G5). Δ ≤ 15 default
    requires 1 W3-5; zero placed fires the no-W3-5-at-all rule."""
    from src.rules.validators import validate_fines_double_envelope

    params = _fines_double_params()  # 55 → 45, Δ = 10, requires 1 W3-5
    placements = _mk_envelope_placements(include_r2_10=True, include_r2_11=True, n_w3_5_signs=0)
    violations = validate_fines_double_envelope(placements, params)
    assert len(violations) == 1
    assert violations[0].rule_id == "MISSING_W3_5"
    assert violations[0].severity == "error"
    assert violations[0].mutcd_section == "CO Supplement §2B.13(A)"


def test_validate_fines_double_envelope_error_when_w3_5_count_insufficient() -> None:
    """Stepped reduction with partial W3-5 placement → INSUFFICIENT_W3_5_COUNT
    error (G5).  55 → 30 (Δ=25) requires 2 stepped W3-5; placing only 1
    fires the partial-sequence rule, distinct from MISSING_W3_5."""
    from src.rules.validators import validate_fines_double_envelope

    params = _fines_double_params(work_zone_speed_mph=30)  # Δ = 25, requires 2
    placements = _mk_envelope_placements(include_r2_10=True, include_r2_11=True, n_w3_5_signs=1)
    violations = validate_fines_double_envelope(placements, params)
    assert len(violations) == 1
    assert violations[0].rule_id == "INSUFFICIENT_W3_5_COUNT"
    assert violations[0].severity == "error"


def test_validate_fines_double_envelope_pass_with_stepped_w3_5_count_met() -> None:
    """Stepped reduction with the full required count → no violation.
    55 → 30 (Δ=25, N=2) with 2 W3-5 placements passes."""
    from src.rules.validators import validate_fines_double_envelope

    params = _fines_double_params(work_zone_speed_mph=30)
    placements = _mk_envelope_placements(include_r2_10=True, include_r2_11=True, n_w3_5_signs=2)
    assert validate_fines_double_envelope(placements, params) == []


def test_validate_fines_double_envelope_w3_5_count_uses_label_prefix() -> None:
    """W3-5 counter is by label prefix, not exact match — speed-encoded
    labels W3-5(40), W3-5(30) all aggregate to the W3-5 family."""
    from src.rules.validators import DevicePlacement, validate_fines_double_envelope

    params = _fines_double_params(work_zone_speed_mph=30)  # Δ=25 → requires 2
    placements = _mk_envelope_placements(include_r2_10=True, include_r2_11=True, n_w3_5_signs=0)
    # Two manually placed W3-5 signs at different per-step speeds.
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=1830.0,
            offset_ft=28.0,
            label="W3-5(30)",
        )
    )
    placements.append(
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=2360.0,
            offset_ft=28.0,
            label="W3-5(40)",
        )
    )
    assert validate_fines_double_envelope(placements, params) == []


def test_validate_fines_double_envelope_skipped_when_no_reduction() -> None:
    """work_zone_speed_mph None → validator exits early with no violations."""
    from src.rules.validators import validate_fines_double_envelope

    params = _fines_double_params(work_zone_speed_mph=None)
    placements: list[DevicePlacement] = []  # missing R2-10/R2-11 should be OK
    assert validate_fines_double_envelope(placements, params) == []


def test_validate_fines_double_envelope_skipped_on_flagger() -> None:
    """Flagger carve-out: lane closure + undivided + num_lanes<=2 exits early
    even with reduction in effect."""
    from src.rules.validators import validate_fines_double_envelope

    params = _fines_double_params(
        closure_type="lane",
        is_divided=False,
        num_lanes=2,
        work_zone_speed_mph=30,
    )
    placements: list[DevicePlacement] = []  # no envelope expected
    assert validate_fines_double_envelope(placements, params) == []


def test_validate_fines_double_envelope_skipped_on_mobile_and_off_road() -> None:
    """closure_type='mobile' or 'off_road' or 'full_road' → validator exits early."""
    from src.rules.validators import validate_fines_double_envelope

    for closure_type in ("mobile", "off_road", "full_road"):
        params = _fines_double_params(closure_type=closure_type)
        assert validate_fines_double_envelope([], params) == []


def test_is_flagger_scenario_helper() -> None:
    """Single-source predicate: lane + undivided + num_lanes<=2 → True."""
    from src.rules.validators import _is_flagger_scenario

    # Positive: 2-lane two-way undivided lane closure (num_lanes=2)
    assert _is_flagger_scenario(
        _fines_double_params(closure_type="lane", is_divided=False, num_lanes=2)
    )
    # Positive: per-direction count = 1 also describes the same road
    assert _is_flagger_scenario(
        _fines_double_params(closure_type="lane", is_divided=False, num_lanes=1)
    )
    # Negative: divided lane closure
    assert not _is_flagger_scenario(
        _fines_double_params(closure_type="lane", is_divided=True, num_lanes=2)
    )
    # Negative: shoulder closure
    assert not _is_flagger_scenario(_fines_double_params(closure_type="shoulder", is_divided=False))
    # Negative: multi-lane undivided (num_lanes >= 3)
    assert not _is_flagger_scenario(
        _fines_double_params(closure_type="lane", is_divided=False, num_lanes=3)
    )


def test_advance_warning_signs_excludes_r2_10() -> None:
    """Regression: R2-10 placed upstream of taper must NOT corrupt the
    A/B/C cluster analysis. Real generator output is fed through the
    validator; only warnings (not errors) are acceptable."""
    from src.generation.layout import generate_shoulder_closure_divided
    from src.rules.validators import validate_advance_warning_signs

    params = _fines_double_params(work_zone_speed_mph=45)
    placements = generate_shoulder_closure_divided(params)
    violations = validate_advance_warning_signs(placements, params)
    errors = [v for v in violations if v.severity == "error"]
    assert errors == [], f"R2-10 corrupted A/B/C analysis: {errors}"


def test_advance_warning_signs_excludes_w3_5() -> None:
    """G5 regression: W3-5(target) placed upstream of taper must NOT
    corrupt the A/B/C cluster analysis. Same shape as the R2-10
    exclusion; the suffix-strip in ``_advance_warning_label_key``
    collapses ``W3-5(45)`` to the ``W3-5`` family code for lookup."""
    from src.generation.layout import generate_shoulder_closure_divided
    from src.rules.validators import validate_advance_warning_signs

    params = _fines_double_params(work_zone_speed_mph=30)  # stepped Δ=25
    placements = generate_shoulder_closure_divided(params)
    violations = validate_advance_warning_signs(placements, params)
    errors = [v for v in violations if v.severity == "error"]
    assert errors == [], f"W3-5 corrupted A/B/C analysis: {errors}"


def test_advance_warning_signs_excludes_w5_1() -> None:
    """G2 regression: W5-1 placed 500 ft upstream of taper start (between
    the taper and the A-position W21-5aR on freeway, per CDOT S-630-1
    Sheet 7 Case 11) must NOT corrupt the A/B/C cluster analysis. Same
    shape as the R2-10 / W3-5 exclusions; W5-1 is in
    ``_NON_ADVANCE_WARNING_SIGN_LABELS`` so the cluster selector still
    picks W21-5aR / W20-2 / W20-1 as A / B / C."""
    from src.generation.layout import generate_shoulder_closure_divided
    from src.rules.validators import validate_advance_warning_signs

    # Freeway × no reduction = W5-1 emits.
    params = _fines_double_params(work_zone_speed_mph=None)
    placements = generate_shoulder_closure_divided(params)
    # Sanity: W5-1 actually emitted (otherwise the regression test is vacuous).
    assert any(p.label == "W5-1" for p in placements), "W5-1 not emitted; precondition broken"
    violations = validate_advance_warning_signs(placements, params)
    errors = [v for v in violations if v.severity == "error"]
    assert errors == [], f"W5-1 corrupted A/B/C analysis: {errors}"


def test_co_construction_plaques_count_with_envelope() -> None:
    """G20-5P from envelope adds to the plaque count; validator now sees
    more plaques than the half-mile rule requires. Layout passes."""
    from src.generation.layout import generate_shoulder_closure_divided
    from src.rules.validators import validate_co_construction_plaques

    params = _fines_double_params(work_zone_speed_mph=45)
    placements = generate_shoulder_closure_divided(params)
    violations = validate_co_construction_plaques(placements, params)
    assert violations == []  # more plaques than required is conservative


def test_validate_layout_with_envelope_passes() -> None:
    """End-to-end: reduced-speed divided shoulder generates a layout that
    passes validate_layout (no errors)."""
    from src.generation.layout import generate_shoulder_closure_divided
    from src.rules.validators import validate_layout

    params = _fines_double_params(work_zone_speed_mph=45)
    placements = generate_shoulder_closure_divided(params)
    violations = validate_layout(placements, params)
    errors = [v for v in violations if v.severity == "error"]
    assert errors == []


# ---------------------------------------------------------------------------
# G1 — validate_shoulder_warning_pair
# ---------------------------------------------------------------------------
# Two W21-5aR + W16-2a / W7-3a plaques are prescribed on freeway shoulder
# closures per CDOT S-630-1 Sheet 7 Case 11 (positions 5/6) and Sheet 14
# Cases 26/27 (positions 4/6).  Severity is `warning` rather than `error`:
# missing the second W21-5aR is a signing-quality issue (drivers see the
# warning once instead of twice), not a regulatory floor like
# MISSING_R2_10 / MISSING_R2_11 / MISSING_R2_1_ENTRANCE.


def _g1_freeway_shoulder_params(*, is_divided: bool = True) -> ScenarioParams:
    return ScenarioParams(
        speed_mph=65,
        num_lanes=2 if is_divided else 1,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=is_divided,
        jurisdiction="CDOT",
    )


def test_validate_shoulder_warning_pair_passes_on_freeway_divided_layout() -> None:
    """Generated freeway divided shoulder layout emits the full pair —
    validator returns zero violations."""
    from src.generation.layout import generate_shoulder_closure_divided
    from src.rules.validators import validate_shoulder_warning_pair

    params = _g1_freeway_shoulder_params(is_divided=True)
    placements = generate_shoulder_closure_divided(params)
    assert validate_shoulder_warning_pair(placements, params) == []


def test_validate_shoulder_warning_pair_passes_on_freeway_undivided_layout() -> None:
    """Generated freeway undivided shoulder layout emits the single-side
    pair — validator returns zero violations."""
    from src.generation.layout import generate_shoulder_closure_undivided
    from src.rules.validators import validate_shoulder_warning_pair

    params = _g1_freeway_shoulder_params(is_divided=False)
    placements = generate_shoulder_closure_undivided(params)
    assert validate_shoulder_warning_pair(placements, params) == []


def test_validate_shoulder_warning_pair_warns_when_second_w21_5aR_missing() -> None:
    """Hand-constructed layout with only the A-position W21-5aR and no
    plaques: validator emits three warnings (MISSING_SECOND_W21_5aR +
    MISSING_W16_2A_PLAQUE + MISSING_W7_3A_PLAQUE)."""
    from src.rules.validators import validate_shoulder_warning_pair

    params = _g1_freeway_shoulder_params()
    placements = [
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=2786.67,
            offset_ft=28.0,
            label="W21-5aR",
        ),
        DevicePlacement(
            device_type=DeviceType.SIGN_GENERIC,
            station_ft=2786.67,
            offset_ft=-28.0,
            label="W21-5aR",
        ),
    ]
    violations = validate_shoulder_warning_pair(placements, params)
    rule_ids = {v.rule_id for v in violations}
    assert rule_ids == {"MISSING_SECOND_W21_5aR", "MISSING_W16_2A_PLAQUE", "MISSING_W7_3A_PLAQUE"}
    # All warnings — not errors.
    assert all(v.severity == "warning" for v in violations)


def test_validate_shoulder_warning_pair_skipped_on_non_freeway() -> None:
    """G1 is freeway-only.  Rural shoulder layout returns zero violations
    even with no W21-5aR pair."""
    from src.rules.validators import validate_shoulder_warning_pair

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    assert validate_shoulder_warning_pair([], params) == []


def test_validate_shoulder_warning_pair_skipped_on_lane_closure() -> None:
    """G1 is shoulder-only.  Lane closure on freeway returns zero
    violations (Case 10 prescribes W4-2R / W20-5R / W20-1, not W21-5aR)."""
    from src.rules.validators import validate_shoulder_warning_pair

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
    )
    assert validate_shoulder_warning_pair([], params) == []
