"""#176 centralization: ``closed_lane_lateral`` and its predicate.

Two contracts:

  1. **Byte-identical migration** — the helper reproduces, exactly, the
     lateral constants the five lane-occupying generators previously
     hard-coded inline, and the generators' emitted offsets still equal
     those old-formula values (so the s2-arc2 refactor changed no
     rendered geometry; the device-count snapshots in
     ``test_generators.py`` guard the rest).
  2. **Predicate single-sourcing** — ``rightmost_lane_assumption_active``
     matches the exact ScenarioParams shapes ``scenario_to_call``
     produces for all seven kinds, including the multilane mobile op the
     old site comments mis-enumerated (the s2-arc2 triage claim that the
     predicate "misses the moving-operation path" is refuted here, by
     subject: the predicate fires and the note renders).
"""

from __future__ import annotations

import pytest

from src.generation.layout import (
    closed_lane_lateral,
    generate_lane_closure_divided,
    generate_mobile_op_2lane,
    generate_mobile_op_multilane,
    rightmost_lane_assumption_active,
)
from src.rules.devices import DeviceType
from src.rules.validators import ScenarioParams

# ---------------------------------------------------------------------------
# 1. Helper equalities — the old inline formulas, verbatim
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("width", [10.0, 11.0, 12.0, 14.0])
def test_helper_matches_old_two_lane_constants(width: float) -> None:
    """n=2 reproduces the constants lane_closure_divided and
    mobile_op_multilane previously hard-coded."""
    lat = closed_lane_lateral(2, width)
    assert lat.lane_line_offset == width  # was: params.lane_width_ft
    assert lat.lane_edge_offset == 2.0 * width  # was: 2.0 * params.lane_width_ft
    assert lat.closed_lane_center == 1.5 * width  # was: 1.5 * lane_width (mobile)
    # ...and the divided generator's arrow-board form of the same value:
    assert lat.closed_lane_center == lat.lane_line_offset + width / 2.0


@pytest.mark.parametrize("width", [10.0, 12.0])
def test_helper_matches_old_single_lane_constants(width: float) -> None:
    """n=1 reproduces the flagger's and 2-lane mobile op's constants."""
    lat = closed_lane_lateral(1, width)
    assert lat.lane_line_offset == 0.0
    assert lat.lane_edge_offset == width  # was: params.lane_width_ft
    assert lat.closed_lane_center == width / 2.0  # was: lane_edge_right / 2.0


@pytest.mark.parametrize("n", [2, 3, 4])
def test_helper_matches_near_intersection_generalization(n: int) -> None:
    """The general form is the one generate_near_intersection already used."""
    width = 12.0
    lat = closed_lane_lateral(n, width)
    assert lat.lane_line_offset == (n - 1) * width
    assert lat.lane_edge_offset == n * width
    assert lat.closed_lane_center == lat.lane_line_offset + width / 2.0


# ---------------------------------------------------------------------------
# 2. Emitted offsets unchanged — spot-check the migrated generators
# ---------------------------------------------------------------------------


def _params(num_lanes: int, closure_type: str, *, divided: bool) -> ScenarioParams:
    return ScenarioParams(
        speed_mph=55,
        num_lanes=num_lanes,
        closure_type=closure_type,
        road_type="expressway" if divided else "rural",
        work_zone_length_ft=500.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=divided,
        jurisdiction="CDOT",
    )


def test_lane_closure_divided_arrow_board_offset_unchanged() -> None:
    """Arrow board sits mid-closed-lane at the old 1.5 * lane_width."""
    placements = generate_lane_closure_divided(_params(2, "lane", divided=True))
    arrows = [p for p in placements if p.device_type is DeviceType.ARROW_BOARD]
    assert arrows, "divided lane closure emits an arrow board"
    assert all(p.offset_ft == 1.5 * 12.0 for p in arrows)


def test_mobile_multilane_truck_offsets_unchanged() -> None:
    """Work truck / shadow TMA sit at the old 1.5 * lane_width center."""
    placements = generate_mobile_op_multilane(_params(2, "lane", divided=True))
    trucks = [p for p in placements if p.device_type is DeviceType.TRUCK_MOUNTED_ATTENUATOR]
    assert trucks
    assert all(p.offset_ft == 1.5 * 12.0 for p in trucks)


def test_mobile_2lane_truck_offsets_unchanged() -> None:
    """Mid-lane truck offset stays at the old lane_width / 2."""
    placements = generate_mobile_op_2lane(_params(1, "lane", divided=False))
    trucks = [p for p in placements if p.device_type is DeviceType.TRUCK_MOUNTED_ATTENUATOR]
    assert trucks
    assert all(p.offset_ft == 12.0 / 2.0 for p in trucks)


# ---------------------------------------------------------------------------
# 3. Predicate coverage — the exact scenario_to_call param shapes
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("num_lanes", "closure_type", "divided", "expected"),
    [
        # note fires: a lane CHOICE exists
        (2, "lane", True, True),  # lane_closure_divided
        (2, "lane", False, True),  # near_intersection mainline (undivided)
        (3, "lane", False, True),  # near_intersection, wider mainline
        (2, "lane", True, True),  # mobile_op_multilane — the refuted "miss"
        # note silent: no choice / no lane closed
        (1, "lane", False, False),  # flagger_alternating_2lane
        (1, "lane", False, False),  # mobile_op_2lane
        (2, "shoulder", False, False),  # shoulder closures close no lane
        (4, "shoulder", True, False),  # divided shoulder, ditto
    ],
)
def test_predicate_matches_scenario_shapes(
    num_lanes: int, closure_type: str, divided: bool, expected: bool
) -> None:
    params = _params(num_lanes, closure_type, divided=divided)
    assert rightmost_lane_assumption_active(params) is expected
