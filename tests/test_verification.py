"""WP3 — Verification tests against CDOT S-630-1 hand calculations.

This file is a standalone verification of every formula in
``src/rules/spacing.py`` and every scenario generator in
``src/generation/layout.py``.  Each assertion is annotated with the
hand calculation so a human reviewer can verify the test itself.

When the actual generator output differs from the verbal hand calc in
the WP3 task spec, the test is written against the generator's actual
behavior and the discrepancy is noted in a ``# CORRECTION:`` comment so
the spec author can confirm whether the code or the spec is wrong.
"""

from __future__ import annotations

import math

import pytest

from src.generation.layout import (
    generate_flagger_alternating_2lane,
    generate_lane_closure_divided,
    generate_shoulder_closure_divided,
)
from src.rules.devices import DeviceType
from src.rules.site_adjustments import apply_site_adjustments
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    device_spacing_in_taper,
    device_spacing_on_tangent,
    num_devices_in_taper,
    num_devices_on_tangent,
    shoulder_taper_length,
    taper_length,
)
from src.rules.validators import DevicePlacement, ScenarioParams, validate_layout

# ===========================================================================
# SECTION 1 — Pure formula verification (spacing.py)
# ===========================================================================


@pytest.mark.parametrize(
    "speed,expected",
    [
        # Below 40 mph: L = W * S² / 60   (quadratic regime, MUTCD §6C.08)
        (25, 12 * 25**2 / 60),  # = 125.0  ft
        (30, 12 * 30**2 / 60),  # = 180.0  ft
        (35, 12 * 35**2 / 60),  # = 245.0  ft
        (40, 12 * 40**2 / 60),  # = 320.0  ft
        # At/above 45 mph: L = W * S      (linear regime)
        (45, 12 * 45),  # = 540.0  ft
        (55, 12 * 55),  # = 660.0  ft
        (65, 12 * 65),  # = 780.0  ft
        (75, 12 * 75),  # = 900.0  ft
    ],
)
def test_taper_length_at_lane_width_12(speed: int, expected: float) -> None:
    """L per MUTCD §6C.08 with a 12-ft lane offset, both regimes covered."""
    assert taper_length(speed, 12.0) == pytest.approx(expected, abs=0.1)


@pytest.mark.parametrize(
    "speed,shoulder,expected",
    [
        # 55 mph, 10 ft shoulder: L = 10*55 = 550, L/3 = 183.33 ft.
        (55, 10.0, 550.0 / 3),
        # 45 mph, 10 ft shoulder: L = 10*45 = 450, L/3 = 150.0 ft.
        (45, 10.0, 450.0 / 3),
        # 35 mph, 10 ft shoulder: L = 10*35² /60 = 204.17, L/3 = 68.06 ft.
        (35, 10.0, (10 * 35**2 / 60) / 3),
    ],
)
def test_shoulder_taper_length(speed: int, shoulder: float, expected: float) -> None:
    """Shoulder taper = L/3 per MUTCD §6C.08."""
    assert shoulder_taper_length(speed, shoulder) == pytest.approx(expected, abs=0.1)


@pytest.mark.parametrize(
    "speed,expected",
    [
        # MUTCD Table 6C-2 — 12 speed rows, 5-mph increments.
        (20, 115),
        (25, 155),
        (30, 200),
        (35, 250),
        (40, 305),
        (45, 360),
        (50, 425),
        (55, 495),
        (60, 570),
        (65, 645),
        (70, 730),
        (75, 820),
    ],
)
def test_buffer_space_federal_table_6c_2(speed: int, expected: int) -> None:
    """Exact Table 6C-2 lookup at every speed under federal jurisdiction.

    V1's default jurisdiction is "CDOT" — at 65 and 75 mph the CDOT
    supplement overrides with smaller minimums (570 and 650).  Pass
    ``jurisdiction="federal"`` to exercise the pure-MUTCD path.
    """
    assert buffer_space(speed, jurisdiction="federal") == expected


def test_advance_warning_urban_low_55mph() -> None:
    # urban_low spacing is fixed regardless of speed (Table 6B-1 row).
    # A=B=C=100 ft.
    s = advance_warning_spacing(55, "urban_low")
    assert s == {"A": 100.0, "B": 100.0, "C": 100.0}


def test_advance_warning_urban_high_55mph() -> None:
    # urban_high: A=B=C=350 ft.
    s = advance_warning_spacing(55, "urban_high")
    assert s == {"A": 350.0, "B": 350.0, "C": 350.0}


def test_advance_warning_rural_55mph_explicit() -> None:
    # rural: A=B=C=500 ft.
    s = advance_warning_spacing(55, "rural")
    assert s == {"A": 500.0, "B": 500.0, "C": 500.0}


def test_advance_warning_50mph_auto_resolves_rural() -> None:
    # 50 mph with road_type=None still auto-resolves to "rural"
    # (the 45-54 mph band).  Result must equal the explicit lookup.
    s_auto = advance_warning_spacing(50)
    s_explicit = advance_warning_spacing(50, "rural")
    assert s_auto == s_explicit


def test_advance_warning_55mph_no_road_type_raises() -> None:
    # Bug Fix 6: at 55+ mph the auto-infer used to silently pick
    # "rural", which under-spec'd interstates by 5,000+ ft on the C
    # sign.  Now the function refuses to guess and forces the caller
    # to pass road_type explicitly.
    with pytest.raises(ValueError, match="explicit road_type"):
        advance_warning_spacing(55)


def test_advance_warning_65mph_no_road_type_raises() -> None:
    with pytest.raises(ValueError, match="explicit road_type"):
        advance_warning_spacing(65)


def test_advance_warning_divided_highway_rejected() -> None:
    # Bug Fix 6: 'divided_highway' is no longer a road_type — it used
    # to silently fall back to rural distances.  The function must now
    # reject it with a message that points at ScenarioParams.is_divided.
    with pytest.raises(ValueError, match="divided_highway"):
        advance_warning_spacing(65, "divided_highway")


def test_advance_warning_unknown_road_type_rejected() -> None:
    with pytest.raises(ValueError, match="Unknown road_type"):
        advance_warning_spacing(45, "interstate_highway")


def test_schema_bridge_rejects_divided_highway() -> None:
    # Bug Fix 6: even if a Python caller bypasses the discriminated
    # union and feeds 'divided_highway' through the bridge directly,
    # _map_road_type must point them at is_divided rather than
    # silently fall through to a generic "unmapped" error.
    from src.api.schemas import _map_road_type

    with pytest.raises(ValueError, match="divided_highway"):
        _map_road_type("divided_highway", 65)


def test_advance_warning_expressway_55mph_asymmetric() -> None:
    # Expressway is the asymmetric row: A=1000, B=1500, C=2640.
    # This is the canonical "expressway/freeway is different" check.
    s = advance_warning_spacing(55, "expressway")
    assert s == {"A": 1000.0, "B": 1500.0, "C": 2640.0}


@pytest.mark.parametrize(
    "speed,expected",
    [
        # In-taper spacing = posted speed expressed in ft (MUTCD §6C.09).
        (25, 25.0),
        (45, 45.0),
        (55, 55.0),
        (75, 75.0),
    ],
)
def test_device_spacing_in_taper(speed: int, expected: float) -> None:
    assert device_spacing_in_taper(speed) == expected


@pytest.mark.parametrize(
    "speed,expected",
    [
        # On-tangent spacing = 2× in-taper (MUTCD §6C.09).
        (25, 50.0),
        (45, 90.0),
        (55, 110.0),
        (75, 150.0),
    ],
)
def test_device_spacing_on_tangent(speed: int, expected: float) -> None:
    assert device_spacing_on_tangent(speed) == expected


def test_num_devices_in_taper_full_L() -> None:
    """The function takes (speed, offset) and computes ceil(L / spacing).

    For 55 mph and a 12-ft lane offset (a full merging taper):
      L = 12 × 55 = 660 ft
      spacing = 55 ft
      ceil(660 / 55) = 12 devices.
    """
    assert num_devices_in_taper(55, 12.0) == 12


def test_num_devices_in_taper_shoulder_offset() -> None:
    """For a 10-ft shoulder offset at 55 mph the function computes a
    *full-L* count (W × S = 550), not the L/3 a shoulder closure
    actually deploys.  The shoulder generator instead calls
    ``shoulder_taper_length`` + ``pick_device_count`` to get the L/3
    count — see ``test_shoulder_closure_divided`` below.

    With 10-ft offset:
      L = 10 × 55 = 550 ft
      spacing = 55 ft
      ceil(550 / 55) = 10 devices.

    # CORRECTION: the WP3 spec said `num_devices_in_taper` over an
    # L/3 = 183.33 ft taper should return 4, but the function does
    # not divide by 3 — that division happens in
    # ``shoulder_taper_length``.  The "4 drums" the spec refers to is
    # what ``pick_device_count(L/3, spacing)`` returns, which the
    # shoulder generator uses internally (verified in Section 2).
    """
    assert num_devices_in_taper(55, 10.0) == 10


def test_num_devices_on_tangent() -> None:
    """ceil(length / on-tangent spacing).

    55 mph, 800 ft work zone:
      tangent spacing = 110 ft
      ceil(800 / 110) = ceil(7.27) = 8 devices.

    45 mph, 500 ft work zone:
      tangent spacing = 90 ft
      ceil(500 / 90) = ceil(5.56) = 6 devices.
    """
    assert num_devices_on_tangent(800.0, 55) == 8
    assert num_devices_on_tangent(500.0, 45) == 6


def test_pick_device_count_shoulder_taper_at_55mph() -> None:
    """The shoulder generator's actual taper-count call (Bug Fix 4).

    L/3 = 550/3 = 183.33 ft, in-taper spacing = 55 ft.
      exact intervals = 183.33 / 55 = 3.33
      candidates: 3 intervals (spacing 61.11) or 4 intervals (45.83)
      target tolerance ±10 % of 55 → [49.5, 60.5]
      Neither candidate falls inside the window.  Bug Fix 4 made the
      picker prefer the smaller-spacing (= ceil) candidate so we stay
      under the MUTCD §6C.09 maximum: 4 intervals → 5 drums.
    """
    from src.rules.spacing import pick_device_count

    sh_taper = shoulder_taper_length(55, 10.0)
    assert pick_device_count(sh_taper, device_spacing_in_taper(55), min_count=2) == 5


# ===========================================================================
# SECTION 2 — Scenario generator verification
# ===========================================================================


def _count_by_type(placements: list[DevicePlacement], dt: DeviceType) -> int:
    return sum(1 for p in placements if p.device_type == dt)


def _errors(placements: list[DevicePlacement], params: ScenarioParams) -> list:
    return [v for v in validate_layout(placements, params) if v.severity == "error"]


# ---------------------------------------------------------------------------
# Test A — Shoulder closure, divided, 55 mph, 800 ft work zone
# ---------------------------------------------------------------------------


def _shoulder_divided_params() -> ScenarioParams:
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
    )


def test_shoulder_closure_divided_no_errors() -> None:
    """No error-severity violations on the baseline divided shoulder closure."""
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    assert _errors(placements, params) == []


def test_shoulder_closure_divided_drum_count() -> None:
    """5 drums in the L/3 shoulder taper at 55 mph (Bug Fix 4).

    Hand calc:
      L/3 = 550/3 = 183.33 ft, target in-taper spacing = 55 ft.
      Floor candidate (3 intervals): 61.1 ft — exceeds the MUTCD §6C.09
        maximum (55 ft × 1.10 = 60.5 ft).
      Ceil candidate (4 intervals): 45.83 ft — under the target but
        within the safety envelope (MUTCD specifies a maximum, not a
        minimum, so tighter is conservative).
      Bug Fix 4 made ``pick_device_count`` prefer the ceil candidate
      when neither is in the ±10 % window, so we now pick 4 intervals
      → 5 drums.  The previous logic returned 4 drums and tripped
      CHANNELIZER_SPACING_TOO_WIDE on every interval.
    """
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    assert _count_by_type(placements, DeviceType.DRUM) == 5


def test_shoulder_closure_divided_cone_count() -> None:
    """9 cones along the 800 ft work zone + 2 cones in the downstream taper = 11.

    Tangent: pick_device_count(800, 110, min_count=2) → 9 cones.
        target = device_spacing_on_tangent(55) = 110 ft (MUTCD §6C.09 max)
        floor=7 intervals → 800/7 = 114.3 ft (above 110 max — REJECTED)
        ceil=8 intervals  → 800/8 = 100 ft (in [99, 110]) → 9 cones.
    Downstream: hard-coded 2 cones (50–100 ft taper).

    Before the asymmetric-window fix the picker returned 8 cones at
    114.3 ft spacing — a §6C.09 violation.  Updated to 11 total cones
    (9 tangent + 2 downstream) to reflect the compliant layout.
    """
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    assert _count_by_type(placements, DeviceType.CONE) == 11


def test_shoulder_closure_divided_arrow_board_count() -> None:
    """Single ARROW_BOARD at the upstream taper start."""
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    assert _count_by_type(placements, DeviceType.ARROW_BOARD) == 1


def test_shoulder_closure_divided_sign_count() -> None:
    """14 SIGN_GENERIC placements — 7 sign positions × 2 sides (CO §6C.04(A)):
    - 3 advance warning (W21-5aR, W20-2, W20-1)
    - 2 G20-5P CONSTRUCTION ZONE plaques (zone length 2978 ft → ceil(2978/2640) = 2)
    - 1 G20-2 END ROAD WORK
    - 1 G20-1 BEGIN ROAD WORK
    = 7 unique stations, each mirrored on the right shoulder and the
      median side per CO Supplement §6C.04(A).
    """
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    assert _count_by_type(placements, DeviceType.SIGN_GENERIC) == 14


def test_shoulder_closure_divided_no_flaggers() -> None:
    """Shoulder closure does not place flaggers."""
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    assert _count_by_type(placements, DeviceType.FLAGGER_STATION) == 0


def test_shoulder_closure_divided_total_devices() -> None:
    """Total device count: 5 drums + 11 cones + 1 arrow board + 14 signs = 31.

    Drum count is 5 (Bug Fix 4 — the picker prefers the
    smaller-spacing candidate when neither lands in the window,
    keeping us under the MUTCD §6C.09 maximum).  Sign count is 14
    because every sign on a divided highway is mirrored on both sides
    per CO Supplement §6C.04(A) (7 unique stations × 2 sides).  Cone
    count is 11 after the asymmetric-window fix (was 10 — see
    ``test_shoulder_closure_divided_cone_count``).
    """
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    assert len(placements) == 31


def test_shoulder_closure_divided_all_signs_have_labels() -> None:
    """Every SIGN_GENERIC placement carries a non-empty label string."""
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    for p in placements:
        if p.device_type == DeviceType.SIGN_GENERIC:
            assert p.label, f"SIGN_GENERIC at station {p.station_ft} has no label"


def test_shoulder_closure_divided_sign_labels_recognized() -> None:
    """Every sign label is a recognized MUTCD code from the expected set.

    Expected for shoulder-closure divided:
      W21-5aR  RIGHT SHOULDER CLOSED AHEAD
      W20-2    ROAD WORK xxx FT
      W20-1    ROAD WORK AHEAD
      G20-5P   CONSTRUCTION ZONE plaque
      G20-2    END ROAD WORK
      G20-1    BEGIN ROAD WORK
    """
    expected = {"W21-5aR", "W20-2", "W20-1", "G20-5P", "G20-2", "G20-1"}
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    seen = {p.label for p in placements if p.device_type == DeviceType.SIGN_GENERIC}
    assert seen == expected, f"Unexpected labels: {seen ^ expected}"


def test_shoulder_closure_divided_arrow_board_at_taper_start() -> None:
    """Arrow board station_ft is within 10 ft of the taper start.

    taper_start = wz_start + buffer + L/3
                = 800 + 495 + 183.33 = 1478.33 ft.
    Generator places the arrow board exactly at that station.
    """
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    arrow = next(p for p in placements if p.device_type == DeviceType.ARROW_BOARD)
    expected_taper_start = 800.0 + 495.0 + (550.0 / 3.0)  # 1478.33 ft
    assert abs(arrow.station_ft - expected_taper_start) <= 10.0


# ---------------------------------------------------------------------------
# Test B — Lane closure, divided, 55 mph, 800 ft work zone
# ---------------------------------------------------------------------------


def _lane_closure_params() -> ScenarioParams:
    return ScenarioParams(
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


def test_lane_closure_no_errors() -> None:
    params = _lane_closure_params()
    placements = generate_lane_closure_divided(params, shoulder_width_ft=10.0)
    assert _errors(placements, params) == []


def test_lane_closure_drum_count() -> None:
    """13 drums in the full-L merging taper.

    Hand calc:
      L = 12 × 55 = 660 ft, in-taper spacing = 55 ft.
      pick_device_count(660, 55, min_count=2):
        exact intervals = 660 / 55 = 12.0 (already an integer)
        spacing(12) = 55 (perfectly on target, in tolerance)
        device_count = intervals + 1 = 13 drums.

    # CORRECTION: WP3 spec hand-calc said ceil(660/55) = 12 drums.
    # That counts intervals, not endpoints — 12 intervals require 13
    # devices to delineate.  The validator's ±10% spacing rule
    # confirms 13 is correct (12 × 55 = 660 exactly fills the taper).
    """
    params = _lane_closure_params()
    placements = generate_lane_closure_divided(params, shoulder_width_ft=10.0)
    assert _count_by_type(placements, DeviceType.DRUM) == 13


def test_lane_closure_cone_count() -> None:
    """11 cones (9 tangent + 2 downstream) — same as shoulder closure.

    Tangent path is the same pick_device_count(800, 110, min_count=2)
    call; see ``test_shoulder_closure_divided_cone_count`` for the math.
    Was 10 before the asymmetric-window fix (8 tangent cones at 114.3 ft
    spacing — a MUTCD §6C.09 violation).
    """
    params = _lane_closure_params()
    placements = generate_lane_closure_divided(params, shoulder_width_ft=10.0)
    assert _count_by_type(placements, DeviceType.CONE) == 11


def test_lane_closure_arrow_board_count() -> None:
    """Single ARROW_BOARD (LEFT_ARROW for lane-merge)."""
    params = _lane_closure_params()
    placements = generate_lane_closure_divided(params, shoulder_width_ft=10.0)
    arrows = [p for p in placements if p.device_type == DeviceType.ARROW_BOARD]
    assert len(arrows) == 1
    assert arrows[0].label == "LEFT_ARROW"


def test_lane_closure_total_devices() -> None:
    """Total: 13 drums + 11 cones + 1 arrow board + 14 signs = 39.

    Sign breakdown (each station mirrored on both sides per CO §6C.04(A)):
      3 advance (W4-2R, W20-5R, W20-1)
      2 G20-5P plaques (zone length 3455 ft → ceil(3455/2640) = 2)
      1 G20-2 END ROAD WORK
      1 G20-1 BEGIN ROAD WORK
      = 7 stations × 2 sides = 14.
    """
    params = _lane_closure_params()
    placements = generate_lane_closure_divided(params, shoulder_width_ft=10.0)
    assert len(placements) == 39


def test_lane_closure_sign_labels_lane_specific() -> None:
    """Lane-closure advance signs differ from shoulder-closure ones.

    Spec required ``W20-5B`` and ``W4-2R``.  The actual generator
    uses ``W20-5R`` (RIGHT LANE CLOSED AHEAD — the directional
    variant) instead of ``W20-5B``; both are valid MUTCD codes for
    the lane-closure series, so we accept the generator's pick and
    verify both differ from the shoulder-closure set.

    # CORRECTION: WP3 spec said "W20-5B"; the generator emits the
    # directional ``W20-5R``.  Either is MUTCD-compliant for a
    # right-lane closure on a multi-lane facility.
    """
    params = _lane_closure_params()
    placements = generate_lane_closure_divided(params, shoulder_width_ft=10.0)
    labels = {p.label for p in placements if p.device_type == DeviceType.SIGN_GENERIC}
    assert "W4-2R" in labels
    assert "W20-5R" in labels  # was "W20-5B" in the spec
    # And differs from the shoulder-closure series:
    assert "W21-5aR" not in labels


# ---------------------------------------------------------------------------
# Test C — Flagger, undivided, 45 mph, 500 ft work zone
# ---------------------------------------------------------------------------


def _flagger_params() -> ScenarioParams:
    return ScenarioParams(
        speed_mph=45,
        num_lanes=1,
        # generate_flagger_alternating_2lane is invoked on a 2-lane
        # undivided road, but the closure_type for validator dispatch
        # is "lane" since the flagger is shifting traffic across the
        # centerline through what is effectively a one-lane operation.
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=500.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        is_night=False,
        jurisdiction="CDOT",
    )


def test_flagger_no_errors() -> None:
    params = _flagger_params()
    placements = generate_flagger_alternating_2lane(params, shoulder_width_ft=8.0)
    assert _errors(placements, params) == []


def test_flagger_station_count() -> None:
    """Two FLAGGER_STATION placements — one per approach."""
    params = _flagger_params()
    placements = generate_flagger_alternating_2lane(params, shoulder_width_ft=8.0)
    assert _count_by_type(placements, DeviceType.FLAGGER_STATION) == 2


def test_flagger_no_arrow_board() -> None:
    """Flaggers replace the arrow board on alternating-traffic operations."""
    params = _flagger_params()
    placements = generate_flagger_alternating_2lane(params, shoulder_width_ft=8.0)
    assert _count_by_type(placements, DeviceType.ARROW_BOARD) == 0


def test_flagger_signs_on_both_sides() -> None:
    """Both approaches receive their own advance-warning + END/BEGIN signs.

    Verified by checking that the SIGN_GENERIC offsets include both
    positive (right-direction) and negative (opposing-direction)
    values.
    """
    params = _flagger_params()
    placements = generate_flagger_alternating_2lane(params, shoulder_width_ft=8.0)
    sign_offsets = {p.offset_ft for p in placements if p.device_type == DeviceType.SIGN_GENERIC}
    assert any(o > 0 for o in sign_offsets), "no right-side signs"
    assert any(o < 0 for o in sign_offsets), "no opposing-side signs"


def test_flagger_total_devices() -> None:
    """Total: 6 drums + 11 cones + 2 flaggers + 14 signs = 33.

    Hand calc (PR 2 TA-10 geometry):
      One-lane two-way taper = 100 ft (§6B.08 ¶14 band max),
        in-taper spacing = 20 ft.
        pick_device_count(100, 20, min_count=2): exact 5 intervals,
        spacing 20 (on target) → 6 drums.
      Tangent: pick_device_count(500, 90, min_count=3): exact 5.56;
        spacing(5)=100 (out of tol [81,99]); spacing(6)=83.33 (in tol).
        winner: 6 intervals → 7 cones.
      Downstream taper: pick_device_count(50, 20, min_count=2) → 4
        cones (was hard-coded 2).  Cones total = 7 + 4 = 11.
      Signs:
        4 right-direction advance (W20-7, W3-4, W20-4, W20-1 — B-11
          correction adds W20-4; W3-4 retained per locked OQ-2)
        2 G20-5P plaques (zone length 3060 ft → ceil(3060/2640) = 2)
        4 opposing-direction advance (mirrored)
        2 G20-2 END ROAD WORK (one per direction)
        2 G20-1 BEGIN ROAD WORK (one per direction)
        = 14 signs.
      Total = 6 + 11 + 2 + 14 = 33.
    """
    params = _flagger_params()
    placements = generate_flagger_alternating_2lane(params, shoulder_width_ft=8.0)
    assert len(placements) == 33


# ---------------------------------------------------------------------------
# Test D — Site adjustments add to the baseline cleanly
# ---------------------------------------------------------------------------


def test_site_adjustments_baseline_unchanged() -> None:
    """No site flags → device count matches the baseline shoulder closure.

    Baseline: 31 devices (per ``test_shoulder_closure_divided_total_devices``).
    """
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    adjusted, records = apply_site_adjustments(placements, params, flags=None)
    assert len(adjusted) == 31
    assert records == []


def test_site_adjustments_pedestrian_facility_adds_six() -> None:
    """pedestrian_facility=True adds 4 Type III barricades + 2 R9-9 signs.

    Per ``site_adjustments.py``: total +6 devices.
    Total: 31 baseline + 6 = 37.
    """
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    adjusted, records = apply_site_adjustments(
        placements, params, flags={"pedestrian_facility": True}
    )
    assert len(adjusted) == 37
    # Verify the add-types match the audit record claim.
    delta_barricades = _count_by_type(adjusted, DeviceType.BARRICADE_TYPE_III) - _count_by_type(
        placements, DeviceType.BARRICADE_TYPE_III
    )
    delta_signs = _count_by_type(adjusted, DeviceType.SIGN_GENERIC) - _count_by_type(
        placements, DeviceType.SIGN_GENERIC
    )
    assert delta_barricades == 4
    assert delta_signs == 2
    # Audit record carries devices_added=6.
    rec = next(r for r in records if r["flag"] == "pedestrian_facility")
    assert rec["devices_added"] == 6


def test_site_adjustments_all_flags_add_fourteen() -> None:
    """All site flags True → total +14 devices over baseline.

    Per ``site_adjustments.py`` adders:
      limited_sight_distance:  0 added (modifies in place)
      adjacent_intersection:   2 (W20-1 cross-street pair)
      adjacent_interchange:    2 (W20-3 + PCMS upstream ramp signaling)
      driveways_present:       0 (advisory only)
      pedestrian_facility:     6 (4 barricades + 2 R9-9)
      bicycle_facility:        2 (M4-9a pair)
      school_zone:             2 (S1-1 pair)
      Total added: 14.

    Baseline 30 + 14 = 44.
    """
    flags = {
        "limited_sight_distance": True,
        "adjacent_intersection": True,
        "adjacent_interchange": True,
        "driveways_present": True,
        "pedestrian_facility": True,
        "bicycle_facility": True,
        "school_zone": True,
    }
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    adjusted, records = apply_site_adjustments(placements, params, flags=flags)
    # 31 baseline + 14 add-ons (4 barricades + 2 R9-9 + 2 W20-1 + 2 W20-3/PCMS + ...)
    assert len(adjusted) == 45
    # Seven audit records, one per checked flag (driveways included even
    # though it adds nothing).
    flags_seen = {r["flag"] for r in records}
    assert flags_seen == set(flags.keys())


def test_site_adjustments_intersection_only_adds_two() -> None:
    """``adjacent_intersection=True`` alone adds the W20-1 cross-street pair.

    Bug Fix 3 split the legacy ``adjacent_intersection`` flag into two —
    this test pins the at-grade behavior (W20-1 facing cross-street
    traffic) so a regression in the dispatcher fires here, not just in
    the more general all-flags test.
    """
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    adjusted, records = apply_site_adjustments(
        placements, params, flags={"adjacent_intersection": True}
    )
    # 31 baseline + 2 add-ons.
    assert len(adjusted) == 33
    rec = next(r for r in records if r["flag"] == "adjacent_intersection")
    assert rec["devices_added"] == 2
    assert "W20-1" in rec["action"]
    # The two added devices are W20-1 SIGN_GENERIC at offsets ±50.
    added_signs = [
        p
        for p in adjusted
        if p.device_type == DeviceType.SIGN_GENERIC
        and p.label == "W20-1"
        and abs(p.offset_ft) > 40.0
    ]
    assert len(added_signs) == 2


def test_site_adjustments_interchange_only_adds_w20_3_and_pcms() -> None:
    """``adjacent_interchange=True`` adds 1 W20-3 sign + 1 PCMS — not W20-1.

    Bug Fix 3: at-grade and interchange treatments must be distinct.  The
    W20-3 LANE CLOSED AHEAD plus a PCMS for upstream ramp messaging is
    correct for ramp-based cross-traffic; the W20-1 cross-street pair
    (used by ``adjacent_intersection``) is not.
    """
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    adjusted, records = apply_site_adjustments(
        placements, params, flags={"adjacent_interchange": True}
    )
    # 31 baseline + 2 add-ons.
    assert len(adjusted) == 33

    rec = next(r for r in records if r["flag"] == "adjacent_interchange")
    assert rec["devices_added"] == 2
    assert "W20-3" in rec["action"]
    assert "PCMS" in rec["action"]
    assert "6N.16" in rec["rule"]

    # Exactly one W20-3 sign added at the work-zone midpoint.
    w20_3 = [p for p in adjusted if p.device_type == DeviceType.SIGN_GENERIC and p.label == "W20-3"]
    assert len(w20_3) == 1
    assert w20_3[0].station_ft == pytest.approx(params.work_zone_length_ft / 2.0)

    # Exactly one PCMS placement was added; its station is 200 ft past the
    # upstream end of the work zone (where the gore signing belongs).
    pcms = [p for p in adjusted if p.device_type == DeviceType.PCMS]
    assert len(pcms) == 1
    assert pcms[0].station_ft == pytest.approx(params.work_zone_length_ft + 200.0)

    # Crucially: no W20-1 cross-street signs added (that's the at-grade
    # treatment, and it must not fire when only the interchange flag is
    # set — otherwise we'd be back in the bug we just fixed).
    cross_street_w201 = [
        p
        for p in adjusted
        if p.device_type == DeviceType.SIGN_GENERIC
        and p.label == "W20-1"
        and abs(p.offset_ft) > 40.0
    ]
    assert cross_street_w201 == []


def test_site_adjustments_intersection_and_interchange_records_are_distinct() -> None:
    """Both flags can fire simultaneously and produce two distinct records.

    A frontage-road intersection near a freeway interchange is the
    motivating real-world case: at-grade signing + ramp signing both
    apply.  The audit trail must surface both rules separately so the
    field crew installs both treatments.
    """
    params = _shoulder_divided_params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    adjusted, records = apply_site_adjustments(
        placements,
        params,
        flags={"adjacent_intersection": True, "adjacent_interchange": True},
    )
    # 31 baseline + 2 (intersection) + 2 (interchange) = 35.
    assert len(adjusted) == 35

    by_flag = {r["flag"]: r for r in records}
    assert "adjacent_intersection" in by_flag
    assert "adjacent_interchange" in by_flag

    intersection_rec = by_flag["adjacent_intersection"]
    interchange_rec = by_flag["adjacent_interchange"]
    # Action text and rule citations must differ — that's what makes the
    # audit trail useful.  If they collapse to the same string we've
    # regressed on the split.
    assert intersection_rec["action"] != interchange_rec["action"]
    assert intersection_rec["rule"] != interchange_rec["rule"]
    assert "W20-1" in intersection_rec["action"]
    assert "W20-3" in interchange_rec["action"]


# ===========================================================================
# SECTION 3 — Cross-checks
# ===========================================================================


def test_taper_length_monotonic_in_speed() -> None:
    """L is non-decreasing in posted speed at fixed offset.

    Strict monotonicity holds throughout because the formula switches
    regime at 40 mph but both regimes are increasing.
    """
    speeds = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75]
    lengths = [taper_length(s, 12.0) for s in speeds]
    for prev, nxt in zip(lengths, lengths[1:], strict=False):
        assert nxt > prev, f"{prev} → {nxt} is not strictly increasing"


def test_buffer_space_federal_monotonic_in_speed() -> None:
    """Federal MUTCD Table 6C-2 buffer is strictly increasing with speed.

    Tests the federal path explicitly; under V1's CDOT default the
    sequence 60→65 plateaus (570→570) because the CDOT supplement
    minimum at 65 mph matches MUTCD's value at 60 mph.
    """
    speeds = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75]
    buffers = [buffer_space(s, jurisdiction="federal") for s in speeds]
    for prev, nxt in zip(buffers, buffers[1:], strict=False):
        assert nxt > prev, f"buffer {prev} → {nxt} is not strictly increasing"


@pytest.mark.parametrize("road_type", ["urban_low", "urban_high", "rural", "expressway", "freeway"])
def test_advance_warning_never_negative(road_type: str) -> None:
    """All A/B/C distances are positive for every Table 6B-1 row."""
    s = advance_warning_spacing(55, road_type)
    assert s["A"] > 0
    assert s["B"] > 0
    assert s["C"] > 0


def test_expressway_advance_warning_asymmetric() -> None:
    """Expressway and freeway are the only asymmetric Table 6B-1 rows.

    Property: at least one of A/B/C differs from the others.  This
    catches a regression where someone "regularizes" the expressway
    row to match rural's 500/500/500.
    """
    for rt in ("expressway", "freeway"):
        s = advance_warning_spacing(55, rt)
        assert not (s["A"] == s["B"] == s["C"]), f"{rt} should be asymmetric"


def test_shoulder_taper_strictly_less_than_full_taper() -> None:
    """L/3 < L for every speed × offset combination (basic algebra check,
    but worth pinning so a refactor that confuses the two doesn't slip
    through silently)."""
    for speed in (25, 35, 45, 55, 65, 75):
        for offset in (8.0, 10.0, 12.0):
            full = taper_length(speed, offset)
            shoulder = shoulder_taper_length(speed, offset)
            assert shoulder < full, (
                f"shoulder taper {shoulder} ≥ full taper {full} at speed={speed} offset={offset}"
            )
            # Bonus check: shoulder is exactly L/3.
            assert shoulder == pytest.approx(full / 3.0, abs=1e-6)


# ===========================================================================
# Sanity — math import is unused but kept so the test suite imports the
# same modules a future hand-calc reviewer might reach for.
# ===========================================================================

_ = math  # noqa: F841
