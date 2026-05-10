"""Tests for src.rules.night_adjustments — night-operation device adjustments."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from src.export.quote_generator import generate_quote
from src.generation.layout import generate_shoulder_closure_divided
from src.rules.devices import DeviceType
from src.rules.night_adjustments import apply_night_adjustments
from src.rules.site_adjustments import apply_site_adjustments
from src.rules.spacing import buffer_space, shoulder_taper_length
from src.rules.validators import DevicePlacement, ScenarioParams

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _params(*, is_night: bool = False) -> ScenarioParams:
    """Reference scenario: I-25 freeway, 55 mph, divided shoulder closure."""
    return ScenarioParams(
        speed_mph=55,
        num_lanes=3,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_night=is_night,
        is_divided=True,
        jurisdiction="CDOT",
    )


def _baseline(params: ScenarioParams) -> list[DevicePlacement]:
    return generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)


def _count(placements: list[DevicePlacement], dt: DeviceType) -> int:
    return sum(1 for p in placements if p.device_type == dt)


def _taper_drums(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> list[DevicePlacement]:
    """Subset of placements that are drums sitting in the taper region."""
    buf = buffer_space(params.speed_mph)
    taper_end = params.work_zone_length_ft + buf
    taper_len = shoulder_taper_length(params.speed_mph, params.shoulder_width_ft)
    taper_start = taper_end + taper_len
    return [
        p
        for p in placements
        if p.device_type == DeviceType.DRUM
        and (taper_end - 0.5) <= p.station_ft <= (taper_start + 0.5)
    ]


# ---------------------------------------------------------------------------
# (a) Day vs night device counts for shoulder closure
# ---------------------------------------------------------------------------


def test_day_vs_night_device_counts() -> None:
    """Night layout = baseline + (one warning light per taper drum) + 1 light plant."""
    day_params = _params(is_night=False)
    night_params = _params(is_night=True)

    day_layout = _baseline(day_params)
    night_layout = _baseline(night_params)

    # Generators don't apply night adjustments themselves — both produce the
    # identical baseline.  apply_night_adjustments is what diverges.
    assert len(day_layout) == len(night_layout)
    n_taper_drums = len(_taper_drums(night_layout, night_params))
    assert n_taper_drums >= 2  # spec guarantees >=2 in any taper

    night_adjusted, _ = apply_night_adjustments(night_layout, night_params)
    expected = len(night_layout) + n_taper_drums + 1
    assert len(night_adjusted) == expected, (
        f"Expected baseline ({len(night_layout)}) + warning lights ({n_taper_drums}) "
        f"+ 1 light plant = {expected}, got {len(night_adjusted)}"
    )


def test_day_no_op_for_apply_night_adjustments() -> None:
    """When is_night is False, apply_night_adjustments returns input unchanged."""
    params = _params(is_night=False)
    baseline = _baseline(params)
    out, records = apply_night_adjustments(baseline, params)
    assert records == []
    assert len(out) == len(baseline)
    # Same content (order may differ but for a no-op it shouldn't).
    assert out == list(baseline)


# ---------------------------------------------------------------------------
# (b) Warning lights are co-located with drums; not on cones or signs
# ---------------------------------------------------------------------------


def test_warning_lights_colocated_with_taper_drums() -> None:
    """Each taper drum has a warning light at the same (station, offset)."""
    params = _params(is_night=True)
    baseline = _baseline(params)
    adjusted, _ = apply_night_adjustments(baseline, params)

    drums = _taper_drums(adjusted, params)
    assert drums, "Test fixture must produce taper drums"

    lights = [p for p in adjusted if p.device_type == DeviceType.WARNING_LIGHT_TYPE_C]
    assert len(lights) == len(drums)

    drum_keys = {(round(d.station_ft, 1), round(d.offset_ft, 1)) for d in drums}
    light_keys = {(round(lt.station_ft, 1), round(lt.offset_ft, 1)) for lt in lights}
    assert drum_keys == light_keys, (
        f"Warning lights and taper drums must occupy identical (station, offset).\n"
        f"  drums : {sorted(drum_keys)}\n"
        f"  lights: {sorted(light_keys)}"
    )


def test_no_warning_lights_on_tangent_cones() -> None:
    """Warning lights only attach to taper drums, never to tangent cones."""
    params = _params(is_night=True)
    baseline = _baseline(params)
    cones = [p for p in baseline if p.device_type == DeviceType.CONE]
    if not cones:
        pytest.skip("Layout has no tangent cones to verify against.")

    adjusted, _ = apply_night_adjustments(baseline, params)
    lights = [p for p in adjusted if p.device_type == DeviceType.WARNING_LIGHT_TYPE_C]
    cone_keys = {(round(c.station_ft, 1), round(c.offset_ft, 1)) for c in cones}
    light_keys = {(round(lt.station_ft, 1), round(lt.offset_ft, 1)) for lt in lights}
    assert cone_keys.isdisjoint(light_keys), "Warning lights must not co-locate with cones"


def test_no_warning_lights_on_signs() -> None:
    """Warning lights are not added to any SIGN_GENERIC placements."""
    params = _params(is_night=True)
    baseline = _baseline(params)
    sign_keys = {
        (round(p.station_ft, 1), round(p.offset_ft, 1))
        for p in baseline
        if p.device_type == DeviceType.SIGN_GENERIC
    }

    adjusted, _ = apply_night_adjustments(baseline, params)
    light_keys = {
        (round(p.station_ft, 1), round(p.offset_ft, 1))
        for p in adjusted
        if p.device_type == DeviceType.WARNING_LIGHT_TYPE_C
    }
    assert sign_keys.isdisjoint(light_keys)


# ---------------------------------------------------------------------------
# (c) Portable light plant placement
# ---------------------------------------------------------------------------


def test_exactly_one_portable_light_plant() -> None:
    params = _params(is_night=True)
    adjusted, _ = apply_night_adjustments(_baseline(params), params)
    assert _count(adjusted, DeviceType.PORTABLE_LIGHT_PLANT) == 1


def test_light_plant_at_start_of_work_zone() -> None:
    """Light plant sits 25 ft past the buffer, at the start of the work area.

    Stationing: ``wz_start_station = work_zone_length_ft`` is the
    upstream edge of the work zone (where the buffer ends).  The
    plant sits just downstream of that, clearly reading as "at the
    start of the work area" rather than mid-zone.  Pushed 5 ft past
    the closure-side edge so the glyph clears the tangent
    channelizer column.
    """
    params = _params(is_night=True)
    baseline = _baseline(params)
    adjusted, _ = apply_night_adjustments(baseline, params)

    plant = next(p for p in adjusted if p.device_type == DeviceType.PORTABLE_LIGHT_PLANT)

    assert plant.station_ft == pytest.approx(params.work_zone_length_ft - 25.0, abs=0.5)
    closure_edge = 2.0 * params.lane_width_ft + params.shoulder_width_ft
    assert plant.offset_ft == pytest.approx(closure_edge + 5.0, abs=0.5)


# ---------------------------------------------------------------------------
# (d) No-op when is_night=False — covered by (a) test_day_no_op…, plus:
# ---------------------------------------------------------------------------


def test_returns_independent_copy_when_no_op() -> None:
    """The returned list is a copy, not the original — caller can mutate freely."""
    params = _params(is_night=False)
    baseline = _baseline(params)
    out, _ = apply_night_adjustments(baseline, params)
    assert out is not baseline


# ---------------------------------------------------------------------------
# (e) Combined with site adjustments
# ---------------------------------------------------------------------------


def test_combined_site_and_night_adjustments() -> None:
    """Site adjustments + night adjustments compose without losing either set."""
    params = _params(is_night=True)
    baseline = _baseline(params)
    n_taper_drums_before = len(_taper_drums(baseline, params))

    flags = {
        "pedestrian_facility": True,
        "adjacent_intersection": False,
        "driveways_present": False,
        "bicycle_facility": False,
        "limited_sight_distance": False,
        "school_zone": False,
    }
    after_site, site_records = apply_site_adjustments(baseline, params, flags)
    # pedestrian_facility adds 4 Type III barricades + 2 R9-9 signs = 6 devices.
    assert len(after_site) == len(baseline) + 6
    assert any(r["flag"] == "pedestrian_facility" for r in site_records)

    after_night, night_records = apply_night_adjustments(after_site, params)
    # Night adds: 1 warning light per taper drum (unchanged from baseline since
    # pedestrian_facility doesn't add drums) + 1 portable light plant.
    expected_total = len(after_site) + n_taper_drums_before + 1
    assert len(after_night) == expected_total

    flags_recorded = {r["flag"] for r in night_records}
    assert "night_taper_lighting" in flags_recorded
    assert "night_work_area_lighting" in flags_recorded
    assert "night_retroreflective" in flags_recorded


# ---------------------------------------------------------------------------
# (f) Quote integration — equipment AND labor both reflect night
# ---------------------------------------------------------------------------


def test_quote_includes_night_equipment_and_labor_multiplier() -> None:
    """Night quote: warning lights + light plant in equipment, 1.5x labor."""
    day_params = _params(is_night=False)
    night_params = _params(is_night=True)

    day_layout = _baseline(day_params)
    night_layout = _baseline(night_params)
    night_layout, _ = apply_night_adjustments(night_layout, night_params)

    with tempfile.TemporaryDirectory() as td:
        _, qb_day = generate_quote(
            day_layout,
            day_params,
            output_path=str(Path(td) / "day.xlsx"),
            project_name="Day",
            project_duration_days=1,
            num_flaggers=2,  # nonzero so the labor delta is visible
        )
        _, qb_night = generate_quote(
            night_layout,
            night_params,
            output_path=str(Path(td) / "night.xlsx"),
            project_name="Night",
            project_duration_days=1,
            num_flaggers=2,
        )

    # Equipment: night > day by exactly the rate sum of new devices.
    n_taper_drums = len(_taper_drums(night_layout, night_params))
    expected_equipment_delta = n_taper_drums * 5.00 + 1 * 125.00  # rates from quote_generator
    actual_delta = qb_night.equipment_total - qb_day.equipment_total
    assert actual_delta == pytest.approx(expected_equipment_delta, abs=0.01), (
        f"Night equipment should exceed day by ${expected_equipment_delta:.2f} "
        f"({n_taper_drums} warning lights @ $5 + 1 plant @ $125); got ${actual_delta:.2f}"
    )

    # Labor multiplier: night labor = day labor * 1.5 (same flagger count).
    assert qb_night.is_night is True
    assert qb_day.is_night is False
    assert qb_night.labor_total == pytest.approx(qb_day.labor_total * 1.5, rel=1e-6)
