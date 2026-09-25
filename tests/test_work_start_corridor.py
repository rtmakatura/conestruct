"""#290 — ``build_corridor(pin_model="work_start")``: the anchor moves.

Ruling 7 (validation-artifacts/committed/issue-290-pin-work/rulings.md):
"anchor moved in build_corridor".  The pin marks where the work starts —
the work zone's upstream edge for the occupied lane's traffic — and the
bearing is that traffic's direction of travel.  The corridor comes back
in the frame every reader already speaks, so the assertions here are on
the corridor the readers receive: where its work zone, its first sign
and its stations land (Rule 11), on a straight road and around a curve.
"""

from __future__ import annotations

import math

import pytest

from src.rules.corridor import (
    HEADING_DEG,
    _destination_point,
    _haversine_m,
    against_legal_direction,
    build_corridor,
    travel_bearing_at,
)

M_PER_FT = 0.3048
PIN = (39.7400, -104.9600)
COMMON = dict(speed_mph=35, work_zone_ft=1000.0, closure_type="shoulder", road_type="urban_low")


def _ft(a: tuple[float, float], b: tuple[float, float]) -> float:
    return _haversine_m(*a, *b) / M_PER_FT


def _bearing(a: tuple[float, float], b: tuple[float, float]) -> float:
    from src.rules.corridor import _initial_bearing_deg

    return _initial_bearing_deg(*a, *b)


# ---------------------------------------------------------------------------
# Straight road
# ---------------------------------------------------------------------------


def test_the_pin_is_the_work_zones_upstream_edge() -> None:
    """Northbound traffic, pin at the work start: the work runs north of the
    pin, the approach (buffer, taper, advance warning) south of it."""
    c = build_corridor(*PIN, bearing_deg=0.0, pin_model="work_start", **COMMON)
    work_downstream, work_upstream = c.work_zone_endpoints()
    assert _ft(work_upstream, PIN) < 0.01
    assert _ft(work_downstream, PIN) == pytest.approx(1000.0, abs=0.01)
    assert abs(((_bearing(PIN, work_downstream) - 0.0 + 540) % 360) - 180) < 0.01  # north
    first_sign = c.upstream_point()
    approach_ft = c.buffer_ft + c.taper_ft + c.advance_warning_ft
    assert _ft(first_sign, PIN) == pytest.approx(approach_ft, abs=0.01)
    assert abs(((_bearing(PIN, first_sign) - 180.0 + 540) % 360) - 180) < 0.01  # south


def test_same_lengths_same_frame_as_corridor_end() -> None:
    """Only the anchor moves: every zone length is the corridor_end build's."""
    v1 = build_corridor(*PIN, bearing_deg=180.0, **COMMON)
    v2 = build_corridor(*PIN, bearing_deg=0.0, pin_model="work_start", **COMMON)
    for f in ("advance_warning_ft", "taper_ft", "buffer_ft", "work_zone_ft", "downstream_taper_ft"):
        assert getattr(v2, f) == getattr(v1, f), f
    assert v2.bearing_deg == pytest.approx(180.0)


def test_a_corridor_end_plan_reexpressed_as_work_start_is_the_same_corridor() -> None:
    """The unit-level conversion proof (checkpoint (g)): take a corridor_end
    corridor, put the pin on its work zone's upstream edge with the travel
    direction = its bearing + 180, and build again.  Anchor, bearing and
    the zone of every probe point agree."""
    v1 = build_corridor(39.7113, -105.0815, 180.0, **COMMON)
    start = v1.point_at_station_ft(v1.downstream_taper_ft + v1.work_zone_ft)
    v2 = build_corridor(*start, bearing_deg=0.0, pin_model="work_start", **COMMON)
    assert _haversine_m(v1.anchor_lat, v1.anchor_lng, v2.anchor_lat, v2.anchor_lng) < 1e-6
    assert v2.bearing_deg == pytest.approx(v1.bearing_deg)
    for station in (-100, 25, 500, 1100, 1300, 1600, 1800, 2100):
        p = v1.point_at_station_ft(station)
        q = _destination_point(*p, 90.0, 20 * M_PER_FT)
        for pt in (p, q):
            assert v2.classify_distance(*pt) == v1.classify_distance(*pt), station


def test_unknown_pin_model_is_refused() -> None:
    with pytest.raises(ValueError, match="pin_model"):
        build_corridor(*PIN, bearing_deg=0.0, pin_model="first_sign", **COMMON)


# ---------------------------------------------------------------------------
# Around a curve (#140's arc-length frame)
# ---------------------------------------------------------------------------

ARC_CENTER = (39.75, -105.0)
ARC_RADIUS_FT = 1500.0


def _arc(theta_deg: float) -> tuple[float, float]:
    return _destination_point(*ARC_CENTER, theta_deg, ARC_RADIUS_FT * M_PER_FT)


ARC = tuple(_arc(t) for t in range(0, 271))  # clockwise, 270 degrees of road


def test_on_a_curve_the_work_follows_the_road_and_the_pin_round_trips() -> None:
    """Pin at theta=135 on a 1,500 ft-radius arc, traffic running clockwise
    (with the vertex order).  The work zone's upstream edge lands on the
    pin; its far edge lands 1,000 ft further along the ARC — not along the
    chord — even though the road turns 38 degrees in between."""
    pin = _arc(135)
    travel = travel_bearing_at(*pin, centerline=ARC, travel="with_geometry", heading=None)
    c = build_corridor(*pin, bearing_deg=travel, pin_model="work_start", centerline=ARC, **COMMON)
    work_downstream, work_upstream = c.work_zone_endpoints()
    assert _haversine_m(*work_upstream, *pin) < 0.5
    arc_deg = math.degrees(1000.0 / ARC_RADIUS_FT)
    expected = _arc(135 + arc_deg)
    assert _haversine_m(*work_downstream, *expected) < 1.0
    # The approach runs back up the arc, the other way from the work.
    # (Read through the station frame the drawing and the classifier walk;
    # ``upstream_point()`` has always dead-reckoned the chord.)
    first_sign = c.point_at_station_ft(c.total_length_ft)
    back_deg = math.degrees((c.buffer_ft + c.taper_ft + c.advance_warning_ft) / ARC_RADIUS_FT)
    assert _haversine_m(*first_sign, *_arc(135 - back_deg)) < 1.0


def test_against_the_vertex_order_runs_the_other_way() -> None:
    pin = _arc(135)
    travel = travel_bearing_at(*pin, centerline=ARC, travel="against_geometry", heading=None)
    c = build_corridor(*pin, bearing_deg=travel, pin_model="work_start", centerline=ARC, **COMMON)
    work_downstream, _ = c.work_zone_endpoints()
    arc_deg = math.degrees(1000.0 / ARC_RADIUS_FT)
    assert _haversine_m(*work_downstream, *_arc(135 - arc_deg)) < 1.0


def test_geometry_that_runs_out_downstream_still_lays_the_work_at_the_pin() -> None:
    """#290 hand-check (RULE 5, stated — this case used to assert a
    refusal).  The anchor sits past the end of a 150 m road geometry.  On
    prod that refused every pin within work + downstream of its way's end
    (N Broadway SB: 11.0 m short), so the picker drew nothing.  The frame
    now carries the anchor on the end tangent, exactly as the station walk
    already did, so the corridor lays the work AT the pin and reports the
    overhang: ``centerline_start_ft`` is the footage drawn past the
    geometry (flagged extended on every surface, #211)."""
    geometry_m = 150.0
    short = (PIN, _destination_point(*PIN, 0.0, geometry_m))
    c = build_corridor(*PIN, bearing_deg=0.0, pin_model="work_start", centerline=short, **COMMON)
    work_downstream, work_upstream = c.work_zone_endpoints()
    assert _haversine_m(*work_upstream, *PIN) < 0.01
    assert _ft(work_downstream, PIN) == pytest.approx(1000.0, abs=0.1)
    shift_ft = c.work_zone_ft + c.downstream_taper_ft
    assert c.centerline_start_ft() == pytest.approx(shift_ft - geometry_m / M_PER_FT, abs=0.1)


def test_a_curve_that_ends_downstream_round_trips_to_the_pin() -> None:
    """The same overhang on a curve: 150 degrees of the arc, the pin 30
    degrees (~785 ft) from its end, traffic clockwise.  The work's
    upstream edge is the pin; the road-backed part follows the arc."""
    arc = tuple(_arc(t) for t in range(0, 151))
    pin = _arc(120)
    travel = travel_bearing_at(*pin, centerline=arc, travel="with_geometry", heading=None)
    c = build_corridor(*pin, bearing_deg=travel, pin_model="work_start", centerline=arc, **COMMON)
    _, work_upstream = c.work_zone_endpoints()
    assert _haversine_m(*work_upstream, *pin) < 0.5
    along_ft = math.radians(30) * ARC_RADIUS_FT
    start_ft = c.centerline_start_ft()
    assert start_ft is not None
    assert start_ft == pytest.approx(c.work_zone_ft + c.downstream_taper_ft - along_ft, abs=1.0)
    # Every station from there up is on the road.
    assert _haversine_m(*c.point_at_station_ft(start_ft), *_arc(150)) < 1.0


def test_a_pin_beside_the_road_lays_the_work_at_its_place_on_the_road() -> None:
    """#290 hand-check, the prod defect itself: N Broadway SB, a manual pin
    ~11 m east of the way's centerline, was refused ("does not return to
    the pin (11.0 m off)") in BOTH directions — the round trip compared the
    road-walked edge with the raw pin.  The work's upstream edge is the
    pin's projection onto the road; the approach runs upstream from there."""
    line = (_destination_point(*PIN, 0.0, 1500.0), _destination_point(*PIN, 180.0, 1500.0))
    beside = _destination_point(*PIN, 90.0, 11.0)  # 11 m east, like the prod pin
    for travel in (180.0, 0.0):
        c = build_corridor(
            *beside, bearing_deg=travel, pin_model="work_start", centerline=line, **COMMON
        )
        work_downstream, work_upstream = c.work_zone_endpoints()
        assert _haversine_m(*work_upstream, *PIN) < 0.5, travel
        assert _ft(work_downstream, PIN) == pytest.approx(1000.0, abs=1.0)
        heading = _bearing(PIN, work_downstream)
        assert abs(((heading - travel + 540) % 360) - 180) < 1.0, travel


def test_a_corridor_end_pin_on_the_road_has_no_downstream_overhang() -> None:
    """The anchor-extension changes nothing for a pin ON the geometry — the
    corridor_end model's every pin: its first road-backed station is 0."""
    line = (_destination_point(*PIN, 180.0, 500.0), _destination_point(*PIN, 0.0, 500.0))
    c = build_corridor(*PIN, bearing_deg=180.0, centerline=line, **COMMON)
    assert c.centerline_start_ft() == 0.0


# ---------------------------------------------------------------------------
# Direction: derived, never typed
# ---------------------------------------------------------------------------

NORTHBOUND_LINE = (_destination_point(*PIN, 180.0, 500.0), _destination_point(*PIN, 0.0, 500.0))


def test_direction_from_the_road_and_the_travel_choice() -> None:
    w = travel_bearing_at(*PIN, centerline=NORTHBOUND_LINE, travel="with_geometry", heading=None)
    a = travel_bearing_at(*PIN, centerline=NORTHBOUND_LINE, travel="against_geometry", heading=None)
    assert abs(((w - 0.0 + 540) % 360) - 180) < 0.01
    assert abs(((a - 180.0 + 540) % 360) - 180) < 0.01


def test_direction_without_a_road_is_the_four_way_heading() -> None:
    for h, deg in HEADING_DEG.items():
        assert travel_bearing_at(*PIN, centerline=None, travel=None, heading=h) == deg
    assert set(HEADING_DEG) == {"N", "E", "S", "W"}


def test_the_deciding_input_is_required() -> None:
    with pytest.raises(ValueError):
        travel_bearing_at(*PIN, centerline=NORTHBOUND_LINE, travel=None, heading="N")
    with pytest.raises(ValueError):
        travel_bearing_at(*PIN, centerline=None, travel="with_geometry", heading=None)


def test_one_way_roads_are_honoured() -> None:
    """Broadway's shape (#298): way bearing 180.49, oneway=yes."""
    assert not against_legal_direction(180.0, 180.49, "yes")
    assert against_legal_direction(0.0, 180.49, "yes")
    assert against_legal_direction(180.0, 180.49, "-1")
    assert not against_legal_direction(0.0, 180.49, "-1")
    assert not against_legal_direction(0.0, 180.49, "no")
    assert not against_legal_direction(0.0, 180.49, None)
