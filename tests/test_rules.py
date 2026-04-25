"""Tests for src.rules.tables and src.rules.spacing.

Section 1 verifies the integrity of the raw lookup data in tables.py.
Section 2 verifies the calculation functions in spacing.py against the
worked examples documented in skills/mutcd-rules-engine/SKILL.md.
"""

from __future__ import annotations

import pytest

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
