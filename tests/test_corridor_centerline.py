"""#140 — the drawn corridor follows the road centerline.

Rendered-geometry tests for :attr:`WorkCorridor.centerline` (Rule 11:
the bug lived in the drawn output, so the assertions measure drawn
points, not helper internals):

* synthetic quarter-circle arc with a closed-form truth — stations land
  at the correct along-road distance;
* no centerline ⇒ byte-identical to the pre-#140 dead-reckon (the
  zero-churn bar for every existing scenario);
* tangent continuation past the geometry's end (never silent
  truncation — the coverage figure the CORRIDOR DETAILS row discloses);
* the recorded Lookout Mountain Road fixture (the Arc 10 pre-fix
  measurement showed the chord up to 1,521 ft off this centerline);
* the Mapbox Static URL: unchanged without a centerline, multi-vertex
  with one.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from src.rules.corridor import (
    WorkCorridor,
    _destination_point,
    _haversine_m,
    _project_onto_segment_m,
    build_corridor,
    encode_polyline,
)

M_PER_FT = 0.3048
FT_PER_M = 1.0 / 0.3048

FIXTURE = Path(__file__).parent / "fixtures" / "centerline" / "lookout_mountain_road.json"


# ---------------------------------------------------------------------------
# Synthetic arc with closed-form truth
# ---------------------------------------------------------------------------

ARC_CENTER = (39.75, -105.0)
ARC_RADIUS_FT = 1000.0


def _arc_point(theta_deg: float) -> tuple[float, float]:
    """Point on the circle of radius ARC_RADIUS_FT around ARC_CENTER.

    ``theta_deg`` is the compass bearing from the center; walking
    clockwise (increasing theta) the local tangent bearing is
    ``theta + 90``.
    """
    return _destination_point(*ARC_CENTER, theta_deg, ARC_RADIUS_FT * M_PER_FT)


def _arc_centerline(step_deg: float = 1.0) -> tuple[tuple[float, float], ...]:
    """Quarter circle theta 0 → 90, sampled every ``step_deg``."""
    n = int(round(90.0 / step_deg))
    return tuple(_arc_point(i * step_deg) for i in range(n + 1))


def _arc_corridor(centerline: tuple[tuple[float, float], ...] | None) -> WorkCorridor:
    """Corridor anchored at theta=0 heading along the arc's start tangent.

    Zone lengths are arbitrary test values (total 1,200 ft, inside the
    quarter circle's ~1,571 ft arc) — MUTCD spacing is not under test
    here.
    """
    anchor = _arc_point(0.0)
    return WorkCorridor(
        anchor_lat=anchor[0],
        anchor_lng=anchor[1],
        anchor_description="synthetic arc",
        bearing_deg=90.0,
        advance_warning_ft=500.0,
        taper_ft=100.0,
        buffer_ft=100.0,
        work_zone_ft=400.0,
        downstream_taper_ft=100.0,
        centerline=centerline,
    )


def _true_arc_station(station_ft: float) -> tuple[float, float]:
    """Closed-form point ``station_ft`` along the arc from theta=0."""
    theta = math.degrees(station_ft / ARC_RADIUS_FT)
    return _arc_point(theta)


class TestSyntheticArc:
    @pytest.mark.parametrize("station_ft", [0.0, 300.0, 600.0, 900.0, 1200.0])
    def test_station_lands_on_the_arc(self, station_ft: float) -> None:
        corridor = _arc_corridor(_arc_centerline())
        drawn = corridor.point_at_station_ft(station_ft)
        truth = _true_arc_station(station_ft)
        assert _haversine_m(*drawn, *truth) * FT_PER_M < 2.0

    def test_reversed_vertex_order_is_equivalent(self) -> None:
        """The frame derives direction from the bearing, not vertex order."""
        fwd = _arc_corridor(_arc_centerline())
        rev = _arc_corridor(tuple(reversed(_arc_centerline())))
        for station_ft in (0.0, 600.0, 1200.0):
            a = fwd.point_at_station_ft(station_ft)
            b = rev.point_at_station_ft(station_ft)
            assert _haversine_m(*a, *b) * FT_PER_M < 0.5

    def test_chord_frame_is_actually_wrong_here(self) -> None:
        """Sanity: on this arc the old dead-reckon is hundreds of ft off —
        the closed-form assertions above are not vacuous."""
        chord = _arc_corridor(None).point_at_station_ft(1200.0)
        truth = _true_arc_station(1200.0)
        assert _haversine_m(*chord, *truth) * FT_PER_M > 400.0

    def test_coverage_reports_remaining_arc(self) -> None:
        corridor = _arc_corridor(_arc_centerline())
        covered = corridor.centerline_coverage_ft()
        assert covered is not None
        # Anchor sits at the arc's start: the full quarter circle
        # (2 * pi * 1000 / 4 ≈ 1,571 ft) lies upstream.
        assert covered == pytest.approx(math.pi * ARC_RADIUS_FT / 2.0, rel=0.01)


class TestNoCenterlineIsPreFix:
    """Zero-churn bar: without geometry, every drawn point is the
    original great-circle dead-reckon, exactly."""

    def test_point_at_station_identical(self) -> None:
        corridor = _arc_corridor(None)
        for station_ft in (0.0, 250.0, 1200.0, -50.0):
            assert corridor.point_at_station_ft(station_ft) == _destination_point(
                corridor.anchor_lat,
                corridor.anchor_lng,
                corridor.bearing_deg,
                station_ft * M_PER_FT,
            )

    def test_path_points_are_the_two_endpoints(self) -> None:
        corridor = _arc_corridor(None)
        assert corridor.work_zone_path_points() == list(corridor.work_zone_endpoints())

    def test_single_vertex_centerline_falls_back(self) -> None:
        """A degenerate one-point polyline can't carry a frame."""
        corridor = _arc_corridor((_arc_point(0.0),))
        assert corridor.point_at_station_ft(500.0) == _arc_corridor(None).point_at_station_ft(500.0)


class TestTangentContinuation:
    def test_past_the_end_continues_on_the_end_tangent(self) -> None:
        """500 ft of straight geometry heading north; station 800 lands
        300 ft beyond the last vertex on the same heading."""
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
        drawn = corridor.point_at_station_ft(800.0)
        expected = _destination_point(*anchor, 0.0, 800.0 * M_PER_FT)
        assert _haversine_m(*drawn, *expected) * FT_PER_M < 0.5
        assert corridor.centerline_coverage_ft() == pytest.approx(500.0, abs=1.0)


class TestWorkZonePathPoints:
    def test_curved_path_is_multi_vertex_and_on_the_road(self) -> None:
        corridor = _arc_corridor(_arc_centerline())
        pts = corridor.work_zone_path_points()
        assert len(pts) > 2
        centerline = corridor.centerline
        assert centerline is not None
        for pt in pts:
            dist_m = min(
                _project_onto_segment_m(*pt, *centerline[i], *centerline[i + 1])[0]
                for i in range(len(centerline) - 1)
            )
            assert dist_m * FT_PER_M < 1.0

    def test_endpoints_are_exact(self) -> None:
        corridor = _arc_corridor(_arc_centerline())
        downstream_ll, upstream_ll = corridor.work_zone_endpoints()
        pts = corridor.work_zone_path_points()
        assert pts[0] == downstream_ll
        assert pts[-1] == upstream_ll

    def test_decimation_cap(self) -> None:
        corridor = _arc_corridor(_arc_centerline(step_deg=0.05))  # 1801 vertices
        assert len(corridor.work_zone_path_points(max_points=50)) <= 50


# ---------------------------------------------------------------------------
# Recorded real-road fixture (Lookout Mountain Road — the Arc 10 pre-fix
# measurement road; network guard honored: geometry is committed JSON)
# ---------------------------------------------------------------------------


class TestLookoutMountainFixture:
    @pytest.fixture()
    def corridor(self) -> WorkCorridor:
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

    def test_work_zone_end_leaves_the_chord(self, corridor: WorkCorridor) -> None:
        """The drawn work-zone end departs the straight chord by hundreds
        of feet on this road (pre-fix measurement: 968 ft)."""
        station = corridor.downstream_taper_ft + corridor.work_zone_ft
        drawn = corridor.point_at_station_ft(station)
        chord = _destination_point(
            corridor.anchor_lat, corridor.anchor_lng, corridor.bearing_deg, station * M_PER_FT
        )
        assert _haversine_m(*drawn, *chord) * FT_PER_M > 500.0

    def test_drawn_points_stay_on_the_road(self, corridor: WorkCorridor) -> None:
        centerline = corridor.centerline
        assert centerline is not None
        covered = corridor.centerline_coverage_ft() or 0.0
        station = 0.0
        while station <= min(covered, corridor.total_length_ft):
            pt = corridor.point_at_station_ft(station)
            dist_m = min(
                _project_onto_segment_m(*pt, *centerline[i], *centerline[i + 1])[0]
                for i in range(len(centerline) - 1)
            )
            assert dist_m * FT_PER_M < 1.0, f"station {station} off-road"
            station += 100.0

    def test_overlay_path_is_multi_vertex(self, corridor: WorkCorridor) -> None:
        assert len(corridor.work_zone_path_points()) > 2


# ---------------------------------------------------------------------------
# Mapbox Static URL (plan_sheet drawing surface)
# ---------------------------------------------------------------------------

# Smallest valid PNG (1x1, transparent) so the fetch helper can write a
# readable temp file.
_PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082"
)


class _FakeResponse:
    content = _PNG_1PX

    def raise_for_status(self) -> None:
        return None


class TestStaticUrl:
    def _capture_url(self, monkeypatch: pytest.MonkeyPatch, corridor: WorkCorridor) -> str:
        from src.rendering import plan_sheet as ps

        seen: list[str] = []

        def fake_get(url: str, params: dict | None = None, timeout: float | None = None):
            seen.append(url)
            return _FakeResponse()

        monkeypatch.setattr(ps.httpx, "get", fake_get)
        assert (
            ps._fetch_mapbox_aerial(
                corridor.anchor_lat, corridor.anchor_lng, "test-token", corridor=corridor
            )
            is not None
        )
        # The bearing soft-check also uses the network; it is patched out
        # by pointing it at a no-op.
        return seen[0]

    @pytest.fixture(autouse=True)
    def _quiet_bearing_check(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from src.rendering import plan_sheet as ps

        monkeypatch.setattr(ps, "_validate_corridor_bearing", lambda corridor: None)

    def test_no_centerline_url_is_the_pre_fix_chord(self, monkeypatch: pytest.MonkeyPatch) -> None:
        corridor = _arc_corridor(None)
        url = self._capture_url(monkeypatch, corridor)
        downstream_ll, upstream_ll = corridor.work_zone_endpoints()
        from urllib.parse import quote

        assert quote(encode_polyline([downstream_ll, upstream_ll]), safe="") in url

    def test_centerline_url_carries_the_road_path(self, monkeypatch: pytest.MonkeyPatch) -> None:
        corridor = _arc_corridor(_arc_centerline())
        url = self._capture_url(monkeypatch, corridor)
        from urllib.parse import quote

        expected = encode_polyline(corridor.work_zone_path_points())
        chord = encode_polyline(list(corridor.work_zone_endpoints()))
        assert quote(expected, safe="") in url
        assert quote(chord, safe="") not in url
