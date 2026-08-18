"""#207 — the classification frame joins the road centerline.

Rule 11: the bug lived in what classification *said about drawn
positions*, so the assertions measure the classified station/zone of
points on the drawn corridor (and of points deliberately offset from
it), not helper internals:

* round-trip inverse property — ``along_station_ft`` undoes
  ``point_at_station_ft``, on-geometry and past both tangent-extended
  ends;
* the recorded Lookout Mountain Road fixture — drawn and classified
  agree (pre-#207 measurement: 22/24 sampled on-road stations
  misclassified, max along-station error 868 ft, max chord lateral of
  an on-road point 1,521 ft);
* synthetic quarter-circle arc with a closed-form truth, chord-twin
  divergence asserted beside it (positive-beside-negative);
* lateral fidelity — perpendicular offsets from a mid-bend point
  measure as themselves;
* no centerline ⇒ byte-identical to the straight-frame math (the
  zero-churn compat bar, structural — no flag).

Tolerance: 2.0 ft, sourced to the drawn-frame test's discretization
bound (test_corridor_centerline.py:100 — the 1°-sampled synthetic arc
carries ~2 ft of vertex-discretization error; the on-polyline
round-trip itself is float-exact, < 0.001 ft, asserted tighter below).
"""

from __future__ import annotations

import json
import math

import pytest

from src.rules.corridor import (
    WorkCorridor,
    _along_cross_track_m,
    _destination_point,
    build_corridor,
)
from tests.test_corridor_centerline import (
    FIXTURE,
    _arc_centerline,
    _arc_corridor,
    _true_arc_station,
)

M_PER_FT = 0.3048
FT_PER_M = 1.0 / 0.3048

# Discretization bound shared with test_corridor_centerline.py:100.
TOL_FT = 2.0
# On-polyline round-trip is pure float arithmetic — no discretization.
ROUNDTRIP_TOL_FT = 0.01


def _lookout_corridor() -> WorkCorridor:
    data = json.loads(FIXTURE.read_text())
    return build_corridor(
        lat=data["anchor"][0],
        lng=data["anchor"][1],
        bearing_deg=data["bearing_deg"],
        speed_mph=40,
        work_zone_ft=800.0,
        closure_type="shoulder",
        road_type="urban_high",
        centerline=tuple((p[0], p[1]) for p in data["centerline"]),
    )


def _chord_twin(corridor: WorkCorridor) -> WorkCorridor:
    """Same corridor, centerline withheld — the pre-#207 frame."""
    return WorkCorridor(
        anchor_lat=corridor.anchor_lat,
        anchor_lng=corridor.anchor_lng,
        anchor_description=corridor.anchor_description,
        bearing_deg=corridor.bearing_deg,
        advance_warning_ft=corridor.advance_warning_ft,
        taper_ft=corridor.taper_ft,
        buffer_ft=corridor.buffer_ft,
        work_zone_ft=corridor.work_zone_ft,
        downstream_taper_ft=corridor.downstream_taper_ft,
        centerline=None,
    )


def _true_zone(corridor: WorkCorridor, station_ft: float) -> str:
    cumulative = 0.0
    for length, label in (
        (corridor.downstream_taper_ft, "downstream"),
        (corridor.work_zone_ft, "work_zone"),
        (corridor.buffer_ft, "buffer"),
        (corridor.taper_ft, "transition"),
        (corridor.advance_warning_ft, "advance_warning"),
    ):
        cumulative += length
        if station_ft <= cumulative:
            return label
    return "advance_warning"


def _local_tangent_deg(corridor: WorkCorridor, station_ft: float) -> float:
    a = corridor.point_at_station_ft(station_ft - 5.0)
    b = corridor.point_at_station_ft(station_ft + 5.0)
    phi1, phi2 = math.radians(a[0]), math.radians(b[0])
    dlambda = math.radians(b[1] - a[1])
    y = math.sin(dlambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


# ---------------------------------------------------------------------------
# Round-trip inverse property
# ---------------------------------------------------------------------------


class TestRoundTrip:
    def test_on_geometry_roundtrip_is_float_exact(self) -> None:
        corridor = _lookout_corridor()
        covered = corridor.centerline_coverage_ft() or 0.0
        station = 0.0
        while station <= min(covered, corridor.total_length_ft):
            pt = corridor.point_at_station_ft(station)
            assert corridor.along_station_ft(*pt) == pytest.approx(station, abs=ROUNDTRIP_TOL_FT)
            assert corridor.lateral_offset_ft(*pt) < ROUNDTRIP_TOL_FT
            station += 100.0

    def test_tangent_extension_roundtrips_past_both_ends(self) -> None:
        """500 ft of straight geometry; stations -200 and 800 both lie on
        tangent continuations, and the projection walks back to them."""
        anchor = (39.75, -105.0)
        end = _destination_point(*anchor, 0.0, 500.0 * M_PER_FT)
        corridor = WorkCorridor(
            anchor_lat=anchor[0],
            anchor_lng=anchor[1],
            anchor_description="short geometry",
            bearing_deg=0.0,
            advance_warning_ft=400.0,
            taper_ft=100.0,
            buffer_ft=100.0,
            work_zone_ft=100.0,
            downstream_taper_ft=100.0,
            centerline=(anchor, end),
        )
        for station in (-200.0, 800.0):
            pt = corridor.point_at_station_ft(station)
            assert corridor.along_station_ft(*pt) == pytest.approx(station, abs=TOL_FT)
            assert corridor.lateral_offset_ft(*pt) < TOL_FT

    def test_reversed_vertex_order_is_equivalent(self) -> None:
        """The frame derives direction from the bearing, not vertex order
        (the ``sign = -1`` path of the projection)."""
        fwd = _arc_corridor(_arc_centerline())
        rev = _arc_corridor(tuple(reversed(_arc_centerline())))
        for station in (0.0, 600.0, 1200.0):
            pt = fwd.point_at_station_ft(station)
            assert rev.along_station_ft(*pt) == pytest.approx(fwd.along_station_ft(*pt), abs=TOL_FT)
            assert rev.lateral_offset_ft(*pt) == pytest.approx(
                fwd.lateral_offset_ft(*pt), abs=TOL_FT
            )

    def test_duplicate_vertices_do_not_crash_the_projection(self) -> None:
        anchor = (39.75, -105.0)
        mid = _destination_point(*anchor, 0.0, 250.0 * M_PER_FT)
        end = _destination_point(*anchor, 0.0, 500.0 * M_PER_FT)
        corridor = WorkCorridor(
            anchor_lat=anchor[0],
            anchor_lng=anchor[1],
            anchor_description="degenerate segment",
            bearing_deg=0.0,
            advance_warning_ft=400.0,
            taper_ft=100.0,
            buffer_ft=100.0,
            work_zone_ft=100.0,
            downstream_taper_ft=100.0,
            centerline=(anchor, mid, mid, end),
        )
        pt = corridor.point_at_station_ft(300.0)
        assert corridor.along_station_ft(*pt) == pytest.approx(300.0, abs=TOL_FT)


# ---------------------------------------------------------------------------
# Recorded real-road fixture — the arc's acceptance bar
# ---------------------------------------------------------------------------


class TestLookoutMountainAgreement:
    """Pre-#207 measurement on this fixture (evidence:
    s2-arc3-classification-frame/pre-fix-capture.txt): 22 of 24 sampled
    on-road stations classified ``lateral``, max along-station error
    868 ft, max chord lateral offset of an on-road point 1,521 ft."""

    def test_drawn_and_classified_agree_along_the_whole_corridor(self) -> None:
        corridor = _lookout_corridor()
        covered = corridor.centerline_coverage_ft() or 0.0
        # Start at 50 so the 100-ft stride never lands exactly on a zone
        # boundary (100 / 900 / 1205 / 1294 ft here): at an exact
        # boundary the ``<=`` zone cut is a float coin-flip — the
        # pre-fix capture's straight control recorded the same tie at
        # 25 millionths of a foot.
        station = 50.0
        while station <= min(covered, corridor.total_length_ft):
            pt = corridor.point_at_station_ft(station)
            assert corridor.along_station_ft(*pt) == pytest.approx(station, abs=TOL_FT)
            assert corridor.lateral_offset_ft(*pt) < TOL_FT
            assert corridor.classify_distance(*pt) == _true_zone(corridor, station), (
                f"station {station:.0f} misclassified"
            )
            station += 100.0

    def test_chord_twin_still_reproduces_the_defect(self) -> None:
        """Non-vacuity: withholding the centerline reproduces the
        pre-#207 misfile at the same mid-bend station."""
        corridor = _lookout_corridor()
        chord = _chord_twin(corridor)
        station = 900.0  # mid work zone, mid bend
        pt = corridor.point_at_station_ft(station)
        assert _true_zone(corridor, station) == "work_zone"
        assert chord.classify_distance(*pt) == "lateral"
        assert abs(chord.along_station_ft(*pt) - station) > 300.0


# ---------------------------------------------------------------------------
# Synthetic arc — closed-form truth
# ---------------------------------------------------------------------------


class TestSyntheticArc:
    @pytest.mark.parametrize("station_ft", [0.0, 300.0, 600.0, 900.0, 1200.0])
    def test_station_of_the_true_arc_point(self, station_ft: float) -> None:
        corridor = _arc_corridor(_arc_centerline())
        truth = _true_arc_station(station_ft)
        assert corridor.along_station_ft(*truth) == pytest.approx(station_ft, abs=TOL_FT)
        assert corridor.lateral_offset_ft(*truth) < TOL_FT

    def test_chord_frame_is_actually_wrong_here(self) -> None:
        """Sanity beside the positive: at station 1200 the chord frame
        mis-stations the same point by hundreds of feet."""
        chord = _arc_corridor(None)
        truth = _true_arc_station(1200.0)
        assert abs(chord.along_station_ft(*truth) - 1200.0) > 200.0

    def test_mid_bend_zone_agrees_with_the_drawn_frame(self) -> None:
        corridor = _arc_corridor(_arc_centerline())
        chord = _arc_corridor(None)
        station = 400.0  # inside the 100..500 work zone, past the bend's start
        pt = corridor.point_at_station_ft(station)
        assert corridor.classify_distance(*pt) == "work_zone"
        # The chord twin misfiles the identical point.
        assert chord.classify_distance(*pt) != "work_zone"


# ---------------------------------------------------------------------------
# Lateral fidelity
# ---------------------------------------------------------------------------


class TestLateralFidelity:
    @pytest.mark.parametrize(
        ("offset_ft", "expected_zone"),
        [(30.0, "work_zone"), (100.0, "lateral")],
    )
    def test_perpendicular_offsets_measure_as_themselves(
        self, offset_ft: float, expected_zone: str
    ) -> None:
        corridor = _lookout_corridor()
        station = 500.0  # mid work zone (100–900 ft), mid bend
        on_road = corridor.point_at_station_ft(station)
        perp = (_local_tangent_deg(corridor, station) + 90.0) % 360.0
        pt = _destination_point(*on_road, perp, offset_ft * M_PER_FT)
        assert corridor.lateral_offset_ft(*pt) == pytest.approx(offset_ft, abs=TOL_FT)
        assert corridor.along_station_ft(*pt) == pytest.approx(station, abs=TOL_FT + 3.0)
        assert corridor.classify_distance(*pt) == expected_zone


# ---------------------------------------------------------------------------
# No centerline ⇒ the straight frame, byte-identical (compat bar)
# ---------------------------------------------------------------------------


class TestNoCenterlineIsPreFix:
    def test_along_and_lateral_are_the_original_formulas(self) -> None:
        corridor = _arc_corridor(None)
        probe = _destination_point(
            corridor.anchor_lat, corridor.anchor_lng, corridor.bearing_deg + 30.0, 500.0
        )
        along_m, cross_m = _along_cross_track_m(
            corridor.anchor_lat, corridor.anchor_lng, corridor.bearing_deg, *probe
        )
        assert corridor.along_station_ft(*probe) == along_m * FT_PER_M
        assert corridor.lateral_offset_ft(*probe) == abs(cross_m) * FT_PER_M

    def test_single_vertex_centerline_falls_back(self) -> None:
        one_pt = _arc_corridor((_arc_corridor(None).downstream_point(),))
        bare = _arc_corridor(None)
        probe = (39.751, -104.999)
        assert one_pt.along_station_ft(*probe) == bare.along_station_ft(*probe)
        assert one_pt.lateral_offset_ft(*probe) == bare.lateral_offset_ft(*probe)
        assert one_pt.classify_distance(*probe) == bare.classify_distance(*probe)
