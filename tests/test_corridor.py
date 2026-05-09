"""Tests for src.rules.corridor — corridor-based work-zone definition."""

from __future__ import annotations

import math

import pytest

from src.rules.corridor import (
    WorkCorridor,
    _along_cross_track_m,
    _destination_point,
    _haversine_m,
    _initial_bearing_deg,
    _point_along_corridor,
    build_corridor,
)

# ---------------------------------------------------------------------------
# Geodesy primitives
# ---------------------------------------------------------------------------


def test_haversine_zero_when_same_point() -> None:
    assert _haversine_m(40.0, -105.0, 40.0, -105.0) == pytest.approx(0.0, abs=1e-6)


def test_haversine_known_one_degree_meridian() -> None:
    """1° of latitude ≈ 111.13 km along a meridian."""
    assert _haversine_m(40.0, -105.0, 41.0, -105.0) == pytest.approx(111_195, rel=0.001)


def test_destination_point_round_trips_with_bearing() -> None:
    """Move 1000 m at bearing 90°, then verify haversine distance ≈ 1000 m."""
    lat2, lng2 = _destination_point(39.9714, -104.8205, 90.0, 1000.0)
    assert _haversine_m(39.9714, -104.8205, lat2, lng2) == pytest.approx(1000.0, rel=0.001)


def test_initial_bearing_north() -> None:
    bearing = _initial_bearing_deg(39.9714, -104.8205, 39.9814, -104.8205)
    assert bearing == pytest.approx(0.0, abs=0.5)


def test_initial_bearing_east() -> None:
    bearing = _initial_bearing_deg(39.9714, -104.8205, 39.9714, -104.8105)
    assert bearing == pytest.approx(90.0, abs=0.5)


def test_along_cross_track_pure_along() -> None:
    """Point 500 m north of anchor (bearing 0): along ≈ 500, cross ≈ 0."""
    point_lat, point_lng = _destination_point(39.9714, -104.8205, 0.0, 500.0)
    along, cross = _along_cross_track_m(39.9714, -104.8205, 0.0, point_lat, point_lng)
    assert along == pytest.approx(500.0, abs=1.0)
    assert abs(cross) < 1.0


def test_along_cross_track_pure_lateral() -> None:
    """Point 200 m east of anchor (bearing 0 corridor): along ≈ 0, |cross| ≈ 200."""
    point_lat, point_lng = _destination_point(39.9714, -104.8205, 90.0, 200.0)
    along, cross = _along_cross_track_m(39.9714, -104.8205, 0.0, point_lat, point_lng)
    assert abs(along) < 1.0
    assert abs(cross) == pytest.approx(200.0, abs=1.0)


def test_along_cross_track_behind_anchor_is_negative() -> None:
    """Point 500 m south of anchor with corridor bearing 0 → along negative."""
    point_lat, point_lng = _destination_point(39.9714, -104.8205, 180.0, 500.0)
    along, _ = _along_cross_track_m(39.9714, -104.8205, 0.0, point_lat, point_lng)
    assert along == pytest.approx(-500.0, abs=1.0)


# ---------------------------------------------------------------------------
# build_corridor — Brighton scenario hand-calculation
# ---------------------------------------------------------------------------


def _brighton() -> WorkCorridor:
    """Brighton US-85 NB shoulder closure: speed=55, work_zone=800 ft."""
    return build_corridor(
        lat=39.9714,
        lng=-104.8205,
        bearing_deg=0.0,  # corridor extends north toward upstream
        speed_mph=55,
        work_zone_ft=800.0,
        closure_type="shoulder",
        # 55 mph is at the auto-infer cutoff (Bug Fix 6); pass road_type
        # explicitly so the call doesn't trip the high-speed guard.
        road_type="rural",
        anchor_description="US-85 & Bromley Ln (test)",
    )


def test_brighton_segment_lengths_match_hand_calc() -> None:
    """Verify each segment matches the hand-calculation in the spec."""
    corridor = _brighton()
    # Rural advance warning: A=B=C=500 → total 1500 ft.
    assert corridor.advance_warning_ft == pytest.approx(1500.0, abs=0.1)
    # Shoulder taper at 55 mph with 10 ft shoulder: L=550, L/3 ≈ 183.33.
    assert corridor.taper_ft == pytest.approx(183.333, abs=0.1)
    # Buffer at 55 mph from MUTCD Table 6B-2.
    assert corridor.buffer_ft == 495.0
    assert corridor.work_zone_ft == 800.0
    # Downstream taper: 1 lane × 100 ft (upper bound).
    assert corridor.downstream_taper_ft == 100.0


def test_brighton_total_length_3078_ft() -> None:
    corridor = _brighton()
    expected = 1500 + 550 / 3 + 495 + 800 + 100
    assert corridor.total_length_ft == pytest.approx(expected, abs=0.1)
    assert corridor.total_length_ft == pytest.approx(3078.33, abs=0.1)
    assert corridor.total_length_m == pytest.approx(3078.33 * 0.3048, abs=0.1)


def test_brighton_upstream_point_is_total_length_north_of_anchor() -> None:
    """upstream_point() should sit ~3078 ft north of anchor (bearing 0 = north)."""
    corridor = _brighton()
    upstream_lat, upstream_lng = corridor.upstream_point()
    distance_m = _haversine_m(corridor.anchor_lat, corridor.anchor_lng, upstream_lat, upstream_lng)
    # Exactly the corridor's total length, in meters.
    assert distance_m == pytest.approx(corridor.total_length_m, rel=0.001)
    # And along the bearing direction (north).
    bearing = _initial_bearing_deg(
        corridor.anchor_lat, corridor.anchor_lng, upstream_lat, upstream_lng
    )
    assert bearing == pytest.approx(0.0, abs=0.5)


def test_brighton_downstream_point_is_anchor() -> None:
    corridor = _brighton()
    assert corridor.downstream_point() == (corridor.anchor_lat, corridor.anchor_lng)


def test_brighton_corridor_bbox_encompasses_full_corridor() -> None:
    corridor = _brighton()
    lateral_buffer_m = 100.0
    south, west, north, east = corridor.corridor_bbox(lateral_buffer_m=lateral_buffer_m)

    # Sanity: anchor is inside the bbox.
    assert south <= corridor.anchor_lat <= north
    assert west <= corridor.anchor_lng <= east

    # Upstream point is also inside.
    upstream_lat, upstream_lng = corridor.upstream_point()
    assert south <= upstream_lat <= north
    assert west <= upstream_lng <= east

    # North side extends at least to the upstream point (bearing 0 = north).
    assert north >= upstream_lat
    # At bearing 0 the lateral buffer is applied east/west of the
    # corridor centerline, so the bbox should be wider in longitude
    # than the (zero-width) corridor itself.  100 m ≈ 0.00117° lng at
    # latitude 39.97 (cos(40°) ≈ 0.766 → 1° lng ≈ 85 km).
    assert east - west > 0
    half_buffer_deg_lng = (lateral_buffer_m / (111_000.0 * math.cos(math.radians(39.97)))) * 0.5
    assert east - corridor.anchor_lng >= half_buffer_deg_lng
    assert corridor.anchor_lng - west >= half_buffer_deg_lng


# ---------------------------------------------------------------------------
# classify_distance
# ---------------------------------------------------------------------------


def test_classify_at_anchor_is_downstream() -> None:
    """Point AT the anchor (along=0) falls inside the downstream taper segment."""
    corridor = _brighton()
    assert corridor.classify_distance(corridor.anchor_lat, corridor.anchor_lng) == "downstream"


def test_classify_inside_work_zone() -> None:
    """A point ~150 m (≈ 492 ft) upstream of the anchor lies in the work zone.

    Cumulative segment bounds (ft from anchor):
      0–100      : downstream taper
      100–900    : work zone   ← 492 ft falls here
      900–1395   : buffer
      1395–1578  : transition
      1578–3078  : advance warning
    """
    corridor = _brighton()
    point = _destination_point(corridor.anchor_lat, corridor.anchor_lng, 0.0, 150.0)
    assert corridor.classify_distance(*point) == "work_zone"


def test_classify_inside_buffer() -> None:
    """~350 m upstream of anchor (≈ 1148 ft) lies in the buffer segment."""
    corridor = _brighton()
    point = _destination_point(corridor.anchor_lat, corridor.anchor_lng, 0.0, 350.0)
    assert corridor.classify_distance(*point) == "buffer"


def test_classify_inside_transition() -> None:
    """~460 m upstream (≈ 1509 ft) lies in the transition (taper) segment."""
    corridor = _brighton()
    point = _destination_point(corridor.anchor_lat, corridor.anchor_lng, 0.0, 460.0)
    assert corridor.classify_distance(*point) == "transition"


def test_classify_inside_advance_warning() -> None:
    """~600 m upstream (≈ 1969 ft) lies in the advance-warning segment."""
    corridor = _brighton()
    point = _destination_point(corridor.anchor_lat, corridor.anchor_lng, 0.0, 600.0)
    assert corridor.classify_distance(*point) == "advance_warning"


def test_classify_lateral_offset() -> None:
    """A point 100 m east of anchor sits beside the corridor → 'lateral'."""
    corridor = _brighton()
    point = _destination_point(corridor.anchor_lat, corridor.anchor_lng, 90.0, 100.0)
    assert corridor.classify_distance(*point) == "lateral"


def test_classify_far_outside() -> None:
    """A point 2 km north is well beyond the upstream end → 'outside'."""
    corridor = _brighton()
    point = _destination_point(corridor.anchor_lat, corridor.anchor_lng, 0.0, 2000.0)
    assert corridor.classify_distance(*point) == "outside"


def test_classify_behind_anchor_outside() -> None:
    """A point 100 m south of anchor (behind the corridor) → 'outside'.

    Anchor sits at the downstream end; anything past it in the
    direction of travel is no longer part of the project.
    """
    corridor = _brighton()
    point = _destination_point(corridor.anchor_lat, corridor.anchor_lng, 180.0, 100.0)
    assert corridor.classify_distance(*point) == "outside"


# ---------------------------------------------------------------------------
# Builder closure-type coverage
# ---------------------------------------------------------------------------


def test_build_corridor_lane_closure_uses_full_taper() -> None:
    """Lane closure → taper = L (full merging length), not L/3."""
    corridor = build_corridor(
        lat=39.9714,
        lng=-104.8205,
        bearing_deg=0.0,
        speed_mph=55,
        work_zone_ft=800.0,
        closure_type="lane_closure",
        lane_width_ft=12.0,
        road_type="rural",
    )
    # 55 mph >= 40, so L = W * S = 12 * 55 = 660 ft.
    assert corridor.taper_ft == pytest.approx(660.0, abs=0.1)


def test_build_corridor_shifting_uses_half_taper() -> None:
    """Shifting taper = L/2."""
    corridor = build_corridor(
        lat=39.9714,
        lng=-104.8205,
        bearing_deg=0.0,
        speed_mph=55,
        work_zone_ft=800.0,
        closure_type="shifting",
        lane_width_ft=12.0,
        road_type="rural",
    )
    assert corridor.taper_ft == pytest.approx(330.0, abs=0.1)


def test_build_corridor_unknown_closure_type_raises() -> None:
    with pytest.raises(ValueError, match="Unknown closure_type"):
        build_corridor(
            lat=39.9714,
            lng=-104.8205,
            bearing_deg=0.0,
            speed_mph=55,
            work_zone_ft=800.0,
            closure_type="not_a_real_kind",
            road_type="rural",
        )


def test_build_corridor_explicit_road_type_overrides_inference() -> None:
    """Passing road_type='expressway' should pick the asymmetric A/B/C row."""
    corridor = build_corridor(
        lat=39.9714,
        lng=-104.8205,
        bearing_deg=0.0,
        speed_mph=55,
        work_zone_ft=800.0,
        closure_type="shoulder",
        road_type="expressway",
    )
    # Expressway A/B/C is asymmetric (1000 / 1500 / 2640) per Table 6B-1.
    # We assert only that it differs from the rural total of 1500.
    assert corridor.advance_warning_ft != 1500.0


# ---------------------------------------------------------------------------
# point_along_corridor / station sampling
# ---------------------------------------------------------------------------


def test_point_at_station_zero_is_anchor() -> None:
    corridor = _brighton()
    lat, lng = corridor.point_at_station_ft(0.0)
    assert lat == pytest.approx(corridor.anchor_lat, abs=1e-9)
    assert lng == pytest.approx(corridor.anchor_lng, abs=1e-9)


def test_point_at_station_total_length_is_upstream_point() -> None:
    corridor = _brighton()
    expected_lat, expected_lng = corridor.upstream_point()
    lat, lng = corridor.point_at_station_ft(corridor.total_length_ft)
    assert lat == pytest.approx(expected_lat, abs=1e-9)
    assert lng == pytest.approx(expected_lng, abs=1e-9)


def test_point_along_corridor_midpoint_is_halfway() -> None:
    corridor = _brighton()
    lat, lng = _point_along_corridor(corridor, 0.5)
    distance_m = _haversine_m(corridor.anchor_lat, corridor.anchor_lng, lat, lng)
    assert distance_m == pytest.approx(corridor.total_length_m / 2.0, rel=0.001)
