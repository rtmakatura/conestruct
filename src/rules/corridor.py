"""Corridor-based work-zone definition.

A point-and-radius model is inadequate for work zones — the same address
with a 200 ft work zone vs. an 1800 ft work zone has very different site
conditions, and detection of nearby features needs to scan the full
project corridor (advance warning sign through downstream taper), not a
circle around a dot.

This module defines a :class:`WorkCorridor` describing the full extent
of a work zone on a road, plus the helpers needed to:

  * compute the geographic bounding box that encompasses the corridor
    (used for Overpass queries — see
    :func:`src.rules.site_detection.detect_along_corridor`),
  * project a detected feature's lat/lng onto the corridor and report
    which zone it falls in (advance warning, transition, buffer, work
    zone, downstream, lateral, outside).

Convention
----------

* ``anchor_lat``/``anchor_lng`` is the **downstream-most** point of the
  corridor (the end of the downstream taper, where drivers exit).
* ``bearing_deg`` is the compass bearing FROM the anchor TOWARD the
  upstream end (where the first advance warning sign sits).  Note that
  ``bearing_deg`` is therefore the *reciprocal* of vehicular direction
  of travel — drivers approach from the upstream end and exit at the
  anchor.  This convention keeps :meth:`WorkCorridor.upstream_point`
  as a simple ``anchor + total_length × bearing`` displacement, which
  is what the Overpass bbox query needs.
* Walking from the anchor along ``bearing_deg`` for ``total_length_ft``
  feet, the segments encountered in order are:

      downstream taper → work zone → buffer → taper → advance warning
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    downstream_taper_length,
    one_lane_two_way_taper_length,
    shifting_taper_length,
    shoulder_taper_length,
    taper_length,
)

EARTH_RADIUS_M = 6_371_000.0
FT_PER_M = 1.0 / 0.3048
M_PER_FT = 0.3048

# Closure-type literals accepted by :func:`build_corridor`.  Keep in sync
# with ScenarioParams.scenario discriminator values so that callers can
# pass a scenario kind directly.
_SHOULDER_KINDS: frozenset[str] = frozenset({"shoulder", "shoulder_divided", "shoulder_undivided"})
_LANE_KINDS: frozenset[str] = frozenset({"lane_closure", "lane_closure_divided", "lane"})
_FLAGGER_KINDS: frozenset[str] = frozenset({"flagger", "flagger_alternating_2lane"})
_MOBILE_KINDS: frozenset[str] = frozenset({"mobile_op_2lane", "mobile_op_multilane", "mobile"})
_SHIFTING_KINDS: frozenset[str] = frozenset({"shifting", "lane_shift"})


# ---------------------------------------------------------------------------
# Geodesy primitives
# ---------------------------------------------------------------------------


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two lat/lng points in meters."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_M * c


def _initial_bearing_deg(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Initial compass bearing from (lat1, lng1) to (lat2, lng2), in degrees [0, 360)."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dlambda = math.radians(lng2 - lng1)
    y = math.sin(dlambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360.0) % 360.0


def _destination_point(
    lat: float, lng: float, bearing_deg: float, distance_m: float
) -> tuple[float, float]:
    """Destination lat/lng given a start point, bearing (deg), and distance (m).

    Source: standard spherical destination formula.
    """
    delta = distance_m / EARTH_RADIUS_M
    theta = math.radians(bearing_deg)
    phi1 = math.radians(lat)
    lambda1 = math.radians(lng)

    sin_phi2 = math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(theta)
    phi2 = math.asin(max(-1.0, min(1.0, sin_phi2)))
    y = math.sin(theta) * math.sin(delta) * math.cos(phi1)
    x = math.cos(delta) - math.sin(phi1) * sin_phi2
    lambda2 = lambda1 + math.atan2(y, x)

    return math.degrees(phi2), ((math.degrees(lambda2) + 540.0) % 360.0) - 180.0


def _along_cross_track_m(
    anchor_lat: float,
    anchor_lng: float,
    bearing_deg: float,
    point_lat: float,
    point_lng: float,
) -> tuple[float, float]:
    """Project ``point`` onto the great-circle through ``anchor`` heading ``bearing_deg``.

    Returns ``(along_track_m, cross_track_m)`` where:

      * ``along_track_m`` is the signed distance from anchor along the
        bearing direction (positive ahead, negative behind).
      * ``cross_track_m`` is the signed perpendicular distance (sign
        irrelevant for our use; we take ``abs`` when classifying).
    """
    d13 = _haversine_m(anchor_lat, anchor_lng, point_lat, point_lng)
    if d13 == 0.0:
        return 0.0, 0.0

    bearing_13 = _initial_bearing_deg(anchor_lat, anchor_lng, point_lat, point_lng)
    bearing_rad = math.radians(bearing_deg)
    bearing_13_rad = math.radians(bearing_13)

    cross_track = (
        math.asin(
            max(
                -1.0,
                min(1.0, math.sin(d13 / EARTH_RADIUS_M) * math.sin(bearing_13_rad - bearing_rad)),
            )
        )
        * EARTH_RADIUS_M
    )

    along_arg = math.cos(d13 / EARTH_RADIUS_M) / math.cos(cross_track / EARTH_RADIUS_M)
    along_track = math.acos(max(-1.0, min(1.0, along_arg))) * EARTH_RADIUS_M

    # Sign of along-track: if the candidate's bearing-from-anchor is
    # within ±90° of the corridor bearing, the candidate is *ahead*
    # (positive along).  Beyond ±90° it is *behind* the anchor.
    diff = ((bearing_13 - bearing_deg + 540.0) % 360.0) - 180.0
    if abs(diff) > 90.0:
        along_track = -along_track
    return along_track, cross_track


def _project_onto_segment_m(
    p_lat: float,
    p_lng: float,
    a_lat: float,
    a_lng: float,
    b_lat: float,
    b_lng: float,
) -> tuple[float, float]:
    """Project ``p`` onto segment ``a→b``; return ``(distance_m, t)``.

    Local-equirectangular projection with ``t`` clamped to [0, 1] —
    the same math as the frontend's ``projectOnSegment``
    (road-bearing/route.ts); this is its documented backend mirror
    for the centerline station frame.  Adequate at corridor scales
    (segment lengths ≪ 1 km).
    """
    kx = math.cos(math.radians(p_lat)) * 111_320.0
    ky = 110_540.0
    ax, ay = (a_lng - p_lng) * kx, (a_lat - p_lat) * ky
    bx, by = (b_lng - p_lng) * kx, (b_lat - p_lat) * ky
    dx, dy = bx - ax, by - ay
    seg_len_sq = dx * dx + dy * dy
    t = 0.0 if seg_len_sq == 0.0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / seg_len_sq))
    px, py = ax + t * dx, ay + t * dy
    return math.hypot(px, py), t


def _project_onto_line_m(
    p_lat: float,
    p_lng: float,
    a_lat: float,
    a_lng: float,
    b_lat: float,
    b_lng: float,
) -> tuple[float, float]:
    """Project ``p`` onto the infinite line through ``a→b``; return ``(distance_m, t)``.

    Same local-equirectangular math as :func:`_project_onto_segment_m`
    but with ``t`` unclamped — ``distance_m`` is the perpendicular
    distance to the line, and ``t`` can fall outside [0, 1].  Used for
    the tangent-extension projection past either end of a centerline
    (#207), the inverse of the unclamped station walk in
    :meth:`WorkCorridor.point_at_station_ft`.  A zero-length segment
    degenerates to the distance to ``a`` at ``t = 0``, matching the
    clamped sibling.
    """
    kx = math.cos(math.radians(p_lat)) * 111_320.0
    ky = 110_540.0
    ax, ay = (a_lng - p_lng) * kx, (a_lat - p_lat) * ky
    bx, by = (b_lng - p_lng) * kx, (b_lat - p_lat) * ky
    dx, dy = bx - ax, by - ay
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq == 0.0:
        return math.hypot(ax, ay), 0.0
    t = -(ax * dx + ay * dy) / seg_len_sq
    px, py = ax + t * dx, ay + t * dy
    return math.hypot(px, py), t


# ---------------------------------------------------------------------------
# Corridor dataclass
# ---------------------------------------------------------------------------


@dataclass
class WorkCorridor:
    """Full geographic extent of a work zone on a road.

    See module docstring for the anchor / bearing convention.
    """

    anchor_lat: float
    anchor_lng: float
    anchor_description: str

    bearing_deg: float

    advance_warning_ft: float
    taper_ft: float
    buffer_ft: float
    work_zone_ft: float
    downstream_taper_ft: float

    # Road centerline as (lat, lng) vertices — the relayed OSM way
    # geometry of the confirmed road candidate (#140).  When present,
    # BOTH frames follow this polyline by arc length instead of
    # dead-reckoning along ``bearing_deg``: the drawing frame
    # (:meth:`point_at_station_ft`, #140) and, since #207, the
    # classification frame (:meth:`along_station_ft`,
    # :meth:`lateral_offset_ft`, :meth:`classify_distance`) and
    # :meth:`corridor_bbox` — so a detected feature's drawn position
    # and its classified station/zone agree through curves.  None ⇒
    # the straight frame everywhere (every pre-#140 behavior,
    # unchanged — the compat path is structural, not a flag).
    centerline: tuple[tuple[float, float], ...] | None = None

    # ------------------------------------------------------------------
    # Length math
    # ------------------------------------------------------------------

    @property
    def total_length_ft(self) -> float:
        return (
            self.advance_warning_ft
            + self.taper_ft
            + self.buffer_ft
            + self.work_zone_ft
            + self.downstream_taper_ft
        )

    @property
    def total_length_m(self) -> float:
        return self.total_length_ft * M_PER_FT

    # ------------------------------------------------------------------
    # Endpoints and along-corridor sampling
    # ------------------------------------------------------------------

    def upstream_point(self) -> tuple[float, float]:
        """Lat/lng of the first advance warning sign (furthest upstream)."""
        return _destination_point(
            self.anchor_lat, self.anchor_lng, self.bearing_deg, self.total_length_m
        )

    def downstream_point(self) -> tuple[float, float]:
        """Lat/lng of the end of the downstream taper (the anchor itself)."""
        return self.anchor_lat, self.anchor_lng

    def work_zone_endpoints(self) -> tuple[tuple[float, float], tuple[float, float]]:
        """Lat/lng of the work zone's downstream and upstream endpoints.

        Walking from the anchor along ``bearing_deg``, the segments
        encountered in order are downstream-taper → work-zone →
        buffer → taper → advance-warning.  The work zone therefore
        sits between ``downstream_taper_ft`` and
        ``downstream_taper_ft + work_zone_ft`` along the corridor.

        Returns ``(downstream_endpoint, upstream_endpoint)`` —
        respectively the buffer-side and the work-side edges of the
        actual work area.  Used to draw a polyline overlay on the
        aerial-context Mapbox tile so reviewers can locate the
        closure on the satellite image.
        """
        downstream_station_ft = self.downstream_taper_ft
        upstream_station_ft = self.downstream_taper_ft + self.work_zone_ft
        return (
            self.point_at_station_ft(downstream_station_ft),
            self.point_at_station_ft(upstream_station_ft),
        )

    def point_at_station_ft(self, station_ft: float) -> tuple[float, float]:
        """Lat/lng at ``station_ft`` along the corridor, measured from the anchor.

        ``station_ft = 0`` returns the anchor (downstream end);
        ``station_ft = total_length_ft`` returns :meth:`upstream_point`.
        Negative or out-of-range values are accepted and extrapolated.

        With a :attr:`centerline`, the station is walked along the
        polyline's arc length (so zone boundaries land at the correct
        along-road distance, #140); past either end of the geometry the
        walk continues on the end segment's tangent — never a silent
        truncation (the CORRIDOR DETAILS panel discloses partial
        coverage).  Without a centerline this is the original
        great-circle dead-reckon, byte-for-byte.
        """
        frame = self._centerline_frame()
        if frame is None:
            return _destination_point(
                self.anchor_lat, self.anchor_lng, self.bearing_deg, station_ft * M_PER_FT
            )
        cum_m, anchor_arc_m, sign = frame
        assert self.centerline is not None
        pts = self.centerline
        s_m = anchor_arc_m + sign * station_ft * M_PER_FT
        if s_m <= 0.0:
            # Tangent continuation past the downstream end of the geometry.
            tangent = _initial_bearing_deg(*pts[1], *pts[0])
            return _destination_point(*pts[0], tangent, -s_m)
        if s_m >= cum_m[-1]:
            tangent = _initial_bearing_deg(*pts[-2], *pts[-1])
            return _destination_point(*pts[-1], tangent, s_m - cum_m[-1])
        for i in range(len(cum_m) - 1):
            if cum_m[i] <= s_m <= cum_m[i + 1]:
                seg_m = cum_m[i + 1] - cum_m[i]
                t = 0.0 if seg_m == 0.0 else (s_m - cum_m[i]) / seg_m
                return (
                    pts[i][0] + t * (pts[i + 1][0] - pts[i][0]),
                    pts[i][1] + t * (pts[i + 1][1] - pts[i][1]),
                )
        return pts[-1]  # unreachable; loop bounds cover [0, cum[-1]]

    def _centerline_frame(self) -> tuple[list[float], float, float] | None:
        """Arc-length frame over :attr:`centerline`: ``(cum_m, anchor_arc_m, sign)``.

        ``cum_m`` is the cumulative arc length at each vertex;
        ``anchor_arc_m`` is the anchor's projection onto the polyline;
        ``sign`` maps corridor stations to arc direction (+1 when
        walking toward higher vertex indices heads upstream — i.e. the
        local tangent is within ±90° of ``bearing_deg``).  Computed
        once and cached on the instance.  None when no usable
        centerline is attached.
        """
        if self.centerline is None or len(self.centerline) < 2:
            return None
        cached = self.__dict__.get("_frame_cache")
        if cached is not None:
            return cached
        pts = self.centerline
        cum_m: list[float] = [0.0]
        for i in range(len(pts) - 1):
            cum_m.append(cum_m[-1] + _haversine_m(*pts[i], *pts[i + 1]))
        best_d = math.inf
        anchor_arc_m = 0.0
        anchor_seg = 0
        for i in range(len(pts) - 1):
            d, t = _project_onto_segment_m(self.anchor_lat, self.anchor_lng, *pts[i], *pts[i + 1])
            if d < best_d:
                best_d = d
                anchor_arc_m = cum_m[i] + t * (cum_m[i + 1] - cum_m[i])
                anchor_seg = i
        tangent = _initial_bearing_deg(*pts[anchor_seg], *pts[anchor_seg + 1])
        diff = ((tangent - self.bearing_deg + 540.0) % 360.0) - 180.0
        sign = 1.0 if abs(diff) <= 90.0 else -1.0
        frame = (cum_m, anchor_arc_m, sign)
        self.__dict__["_frame_cache"] = frame
        return frame

    def centerline_coverage_ft(self) -> float | None:
        """Corridor station (ft, from the anchor) still covered by real geometry.

        Stations beyond this fall on the tangent continuation.  None
        when no centerline is attached.  Station 0 (the anchor) is
        always covered — the anchor projects onto the polyline.
        """
        frame = self._centerline_frame()
        if frame is None:
            return None
        cum_m, anchor_arc_m, sign = frame
        arc_room_m = (cum_m[-1] - anchor_arc_m) if sign > 0 else anchor_arc_m
        return arc_room_m * FT_PER_M

    def work_zone_path_points(self, max_points: int = 100) -> list[tuple[float, float]]:
        """Vertices of the work-zone overlay path, downstream → upstream.

        Without a centerline: exactly the two
        :meth:`work_zone_endpoints` — the pre-#140 chord, unchanged.
        With one: both endpoints plus every centerline vertex whose
        station falls strictly inside the work zone, so the overlay
        tracks the road.  ``max_points`` (chosen: keeps the encoded
        polyline comfortably inside Mapbox Static URL limits at
        precision 5) uniformly decimates interior vertices only —
        endpoints are always exact.
        """
        downstream_ll, upstream_ll = self.work_zone_endpoints()
        frame = self._centerline_frame()
        if frame is None:
            return [downstream_ll, upstream_ll]
        cum_m, anchor_arc_m, sign = frame
        assert self.centerline is not None
        a_ft = self.downstream_taper_ft
        b_ft = self.downstream_taper_ft + self.work_zone_ft
        interior: list[tuple[float, tuple[float, float]]] = []
        for i, pt in enumerate(self.centerline):
            station_ft = sign * (cum_m[i] - anchor_arc_m) * FT_PER_M
            if a_ft < station_ft < b_ft:
                interior.append((station_ft, pt))
        interior.sort(key=lambda item: item[0])
        pts = [pt for _, pt in interior]
        if len(pts) > max_points - 2:
            stride = len(pts) / float(max_points - 2)
            pts = [pts[int(i * stride)] for i in range(max_points - 2)]
        return [downstream_ll, *pts, upstream_ll]

    def work_zone_path_split(
        self, max_points: int = 100
    ) -> tuple[list[tuple[float, float]], list[tuple[float, float]]]:
        """Work-zone overlay path split at the coverage boundary (#211).

        Returns ``(covered, extended)``: the portion of the work-zone
        path backed by real centerline geometry, and the portion drawn
        on the end-tangent continuation past
        :meth:`centerline_coverage_ft`.  Without a centerline the chord
        IS the model (manual mode — there is no geometry claim to be
        beyond), so ``covered`` is the whole pre-#211 path and
        ``extended`` is empty; likewise when coverage reaches past the
        work zone.  Each part keeps its boundary vertex at the exact
        coverage station, so the two overlays meet with no gap.
        """
        full = self.work_zone_path_points(max_points=max_points)
        coverage_ft = self.centerline_coverage_ft()
        a_ft = self.downstream_taper_ft
        b_ft = self.downstream_taper_ft + self.work_zone_ft
        if coverage_ft is None or coverage_ft >= b_ft:
            return full, []
        if coverage_ft <= a_ft:
            return [], full
        # Same interior walk as work_zone_path_points, keeping each
        # vertex's station so it lands on the right side of the boundary;
        # the boundary vertex itself sits at the exact coverage station
        # on both parts, so the two overlays meet with no gap.
        frame = self._centerline_frame()
        assert frame is not None and self.centerline is not None
        cum_m, anchor_arc_m, sign = frame
        downstream_ll, upstream_ll = self.work_zone_endpoints()
        interior: list[tuple[float, tuple[float, float]]] = []
        for i, pt in enumerate(self.centerline):
            station_ft = sign * (cum_m[i] - anchor_arc_m) * FT_PER_M
            if a_ft < station_ft < b_ft:
                interior.append((station_ft, pt))
        interior.sort(key=lambda item: item[0])
        if len(interior) > max_points - 2:
            stride = len(interior) / float(max_points - 2)
            interior = [interior[int(i * stride)] for i in range(max_points - 2)]
        boundary = self.point_at_station_ft(coverage_ft)
        covered = [downstream_ll]
        extended: list[tuple[float, float]] = []
        for station_ft, pt in interior:
            (covered if station_ft <= coverage_ft else extended).append(pt)
        covered.append(boundary)
        extended.insert(0, boundary)
        extended.append(upstream_ll)
        return covered, extended

    def work_zone_chord_m(self) -> float:
        """Straight-line distance between the true work-zone endpoints, meters.

        With a centerline the endpoints sit on the road, so this chord
        is what the aerial camera must frame (the along-road length
        exceeds it on a curve).  Without one it equals
        ``work_zone_ft`` by construction.
        """
        downstream_ll, upstream_ll = self.work_zone_endpoints()
        return _haversine_m(*downstream_ll, *upstream_ll)

    # ------------------------------------------------------------------
    # Bounding box (for Overpass queries)
    # ------------------------------------------------------------------

    def corridor_bbox(
        self,
        lateral_buffer_m: float = 100.0,
        longitudinal_buffer_m: float = 0.0,
    ) -> tuple[float, float, float, float]:
        """Bounding box ``(south, west, north, east)`` covering the full corridor.

        The box is inflated laterally by ``lateral_buffer_m`` on each side
        of the corridor centerline so adjacent features (sidewalks,
        crossing streets) are caught.  When ``longitudinal_buffer_m > 0``,
        the box is additionally extended past each end of the corridor
        in the bearing direction — needed so that features just past the
        upstream or downstream end (e.g. a T-intersection 30 ft past the
        most upstream sign) fall inside the Overpass query bbox and are
        available for the per-bucket tolerance check in
        :func:`~src.rules.site_detection._is_feature_relevant`.  At
        cardinal bearings a pure lateral inflation does not extend the
        bbox in the bearing direction at all, so without this padding
        end-of-corridor features are silently dropped.

        With a :attr:`centerline` (#207) the box is built over the ROAD
        path, not the straight chord — pre-#207, on the Lookout Mountain
        fixture, 16 of 24 drawn-corridor stations fell outside the chord
        bbox, so mid-bend features were never even fetched.  The box
        must stay a superset of every point the classification frame can
        accept, plus its lateral acceptance band.
        """
        frame = self._centerline_frame()
        if frame is not None:
            cum_m, anchor_arc_m, sign = frame
            assert self.centerline is not None
            lo_ft = -longitudinal_buffer_m * FT_PER_M
            hi_ft = self.total_length_ft + longitudinal_buffer_m * FT_PER_M
            # Every centerline VERTEX whose station falls in the buffered
            # window, plus the tangent-extended window ends and the
            # anchor.  Vertices (not samples) make the hull exact:
            # between vertices the polyline is straight, so its lat/lng
            # extremes are at vertices — the padded min/max box is a
            # strict superset of the whole in-window road path.
            hull: list[tuple[float, float]] = [
                (self.anchor_lat, self.anchor_lng),
                self.point_at_station_ft(lo_ft),
                self.point_at_station_ft(hi_ft),
            ]
            for i, pt in enumerate(self.centerline):
                station_ft = sign * (cum_m[i] - anchor_arc_m) * FT_PER_M
                if lo_ft <= station_ft <= hi_ft:
                    hull.append(pt)
            # Inflate by the lateral buffer in all four cardinal
            # directions: any point within ``lateral_buffer_m`` of an
            # in-window road point displaces each coordinate by at most
            # the buffer, so the padded box contains it.
            corners: list[tuple[float, float]] = []
            for lat, lng in hull:
                for cardinal in (0.0, 90.0, 180.0, 270.0):
                    corners.append(_destination_point(lat, lng, cardinal, lateral_buffer_m))
            lats = [c[0] for c in corners]
            lngs = [c[1] for c in corners]
            return min(lats), min(lngs), max(lats), max(lngs)

        upstream = self.upstream_point()
        downstream = self.downstream_point()

        # Perpendicular bearings to either side of the corridor.
        left = (self.bearing_deg - 90.0) % 360.0
        right = (self.bearing_deg + 90.0) % 360.0
        # Reciprocal bearing — used to push downstream past the anchor.
        reciprocal = (self.bearing_deg + 180.0) % 360.0

        # Include the two endpoints themselves alongside the four
        # laterally-offset corners.  At cardinal bearings the perp
        # offset doesn't move one of the coords (e.g. bearing 0 →
        # left/right offsets only change lng), and the endpoint coord
        # would round-trip through ``_destination_point`` with a few
        # nanodegrees of drift; including the endpoints directly keeps
        # the bbox a strict superset of the corridor centerline.
        endpoints: list[tuple[float, float]] = [upstream, downstream]
        if longitudinal_buffer_m > 0.0:
            endpoints.append(_destination_point(*upstream, self.bearing_deg, longitudinal_buffer_m))
            endpoints.append(_destination_point(*downstream, reciprocal, longitudinal_buffer_m))

        corners: list[tuple[float, float]] = list(endpoints)
        for lat, lng in endpoints:
            corners.append(_destination_point(lat, lng, left, lateral_buffer_m))
            corners.append(_destination_point(lat, lng, right, lateral_buffer_m))

        lats = [c[0] for c in corners]
        lngs = [c[1] for c in corners]
        return min(lats), min(lngs), max(lats), max(lngs)

    # ------------------------------------------------------------------
    # Zone classification
    # ------------------------------------------------------------------

    def _project_point(self, lat: float, lng: float) -> tuple[float, float] | None:
        """Project (lat, lng) into the centerline station frame (#207).

        Returns ``(station_ft, lateral_ft)``: the corridor station of
        the nearest point on the centerline polyline (measured from the
        anchor, positive toward upstream — the same frame
        :meth:`point_at_station_ft` walks) and the absolute
        perpendicular distance to it in feet.  None when no usable
        centerline is attached.

        Past either end of the geometry the projection continues on the
        end segment's tangent — the exact inverse of the tangent
        continuation in :meth:`point_at_station_ft`, so the two
        directions round-trip.  Tangent extension rather than honest
        exclusion is deliberate (Rule 10): the OSM way geometry ending
        mid-corridor is absence of *geometry*, not absence of the
        feature, and partial coverage is already disclosed via
        :meth:`centerline_coverage_ft` on the CORRIDOR DETAILS panel.
        """
        frame = self._centerline_frame()
        if frame is None:
            return None
        cum_m, anchor_arc_m, sign = frame
        pts = self.centerline
        assert pts is not None
        best_d = math.inf
        best_arc_m = 0.0
        for i in range(len(pts) - 1):
            d, t = _project_onto_segment_m(lat, lng, *pts[i], *pts[i + 1])
            if d < best_d:
                best_d = d
                best_arc_m = cum_m[i] + t * (cum_m[i + 1] - cum_m[i])
        # Tangent extension: when the clamped winner sits at the
        # polyline's very first or last vertex, re-project unclamped on
        # that end segment so the station keeps growing past the
        # geometry instead of the end vertex absorbing the overshoot
        # into ``lateral``.
        if best_arc_m <= 0.0:
            d, t = _project_onto_line_m(lat, lng, *pts[0], *pts[1])
            if t < 0.0:
                best_d = d
                best_arc_m = t * (cum_m[1] - cum_m[0])
        elif best_arc_m >= cum_m[-1]:
            d, t = _project_onto_line_m(lat, lng, *pts[-2], *pts[-1])
            if t > 1.0:
                best_d = d
                best_arc_m = cum_m[-2] + t * (cum_m[-1] - cum_m[-2])
        station_ft = sign * (best_arc_m - anchor_arc_m) * FT_PER_M
        return station_ft, abs(best_d) * FT_PER_M

    def along_station_ft(self, lat: float, lng: float) -> float:
        """Along-corridor station of (lat, lng) in feet, measured from anchor.

        Positive values lie in the bearing direction (toward upstream);
        negative values lie behind the anchor (further downstream than
        the anchor).  Lateral offset is ignored.

        With a :attr:`centerline` the station is measured along the
        road's arc (#207) — the same frame the drawing uses, so a
        feature's classified station matches its drawn position through
        curves.  Without one: the original straight-frame projection,
        unchanged.
        """
        projected = self._project_point(lat, lng)
        if projected is not None:
            return projected[0]
        along_m, _ = _along_cross_track_m(
            self.anchor_lat, self.anchor_lng, self.bearing_deg, lat, lng
        )
        return along_m * FT_PER_M

    def lateral_offset_ft(self, lat: float, lng: float) -> float:
        """Absolute perpendicular distance from the corridor centerline, in feet.

        With a :attr:`centerline` this is the distance to the road
        polyline itself (#207); without one, to the straight bearing
        line — unchanged.
        """
        projected = self._project_point(lat, lng)
        if projected is not None:
            return projected[1]
        _, cross_m = _along_cross_track_m(
            self.anchor_lat, self.anchor_lng, self.bearing_deg, lat, lng
        )
        return abs(cross_m) * FT_PER_M

    def classify_distance(
        self,
        lat: float,
        lng: float,
        lateral_threshold_ft: float = 50.0,
        outside_tolerance_ft: float = 25.0,
    ) -> str:
        """Classify a point relative to the corridor.

        Returns one of:

          ``'advance_warning'`` — within the advance-warning segment
              (furthest upstream slice).
          ``'transition'``      — within the merging / shifting taper.
          ``'buffer'``          — within the longitudinal buffer space.
          ``'work_zone'``       — within the work area itself.
          ``'downstream'``      — within the downstream taper.
          ``'lateral'``         — on or near the corridor along its
              length but offset laterally by more than
              ``lateral_threshold_ft``.
          ``'outside'``         — beyond either end of the corridor by
              more than ``outside_tolerance_ft``.

        Lateral classification takes precedence only for points whose
        along-station falls inside the corridor extent — a point both
        beyond an end *and* far to the side is classified ``'outside'``.

        Threshold sourcing (#207 ruling, s2-arc3): both defaults are
        CHOSEN, values deliberately unchanged when the frame joined the
        centerline.  ``lateral_threshold_ft = 50.0`` — the on-road +
        curbside acceptance band, now measured from the road polyline
        rather than the straight chord (roughly half a typical arterial
        section: lanes + shoulder + curb zone).  ``outside_tolerance_ft
        = 25.0`` — endpoint jitter tolerance at the corridor ends.
        Neither traces to an MUTCD distance.  #16's threshold pass ran
        2026-08-18 (s2-arc4) and HELD both values: the road frame made
        the same numbers more truthful (the chord error they once
        absorbed is gone — s2-arc3 round-2 live evidence, zero zone
        mismatches at 50/25 on production), and no source demands
        different ones.  The s2-arc3 deferral is discharged.
        """
        along_ft = self.along_station_ft(lat, lng)
        lateral_ft = self.lateral_offset_ft(lat, lng)

        # Beyond either end of the corridor → outside.
        if along_ft < -outside_tolerance_ft:
            return "outside"
        if along_ft > self.total_length_ft + outside_tolerance_ft:
            return "outside"

        # Within the corridor extent but offset laterally → lateral.
        if lateral_ft > lateral_threshold_ft:
            return "lateral"

        # Walking from anchor (along=0) in bearing direction (toward
        # upstream), segments encountered in order:
        cumulative = 0.0
        for length, label in (
            (self.downstream_taper_ft, "downstream"),
            (self.work_zone_ft, "work_zone"),
            (self.buffer_ft, "buffer"),
            (self.taper_ft, "transition"),
            (self.advance_warning_ft, "advance_warning"),
        ):
            cumulative += length
            if along_ft <= cumulative:
                return label

        # Tolerance overrun on the upstream end.
        return "advance_warning"


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------


def _resolve_taper_ft(
    closure_type: str,
    speed_mph: int,
    lane_width_ft: float,
    shoulder_width_ft: float,
) -> float:
    """Pick the appropriate taper-length formula for ``closure_type``."""
    key = closure_type.lower()
    if key in _SHOULDER_KINDS:
        return shoulder_taper_length(speed_mph, shoulder_width_ft)
    if key in _SHIFTING_KINDS:
        return shifting_taper_length(speed_mph, lane_width_ft)
    if key in _FLAGGER_KINDS:
        # One-lane two-way taper (§6B.08 ¶14, PR 2 geometry correction).
        return one_lane_two_way_taper_length()
    if key in _LANE_KINDS or key in _MOBILE_KINDS:
        return taper_length(speed_mph, lane_width_ft)
    valid = sorted(_SHOULDER_KINDS | _LANE_KINDS | _FLAGGER_KINDS | _MOBILE_KINDS | _SHIFTING_KINDS)
    raise ValueError(f"Unknown closure_type {closure_type!r}; expected one of {valid}")


def build_corridor(
    lat: float,
    lng: float,
    bearing_deg: float,
    speed_mph: int,
    work_zone_ft: float,
    closure_type: str,
    road_type: str | None = None,
    lane_width_ft: float = 12.0,
    shoulder_width_ft: float = 10.0,
    num_lanes_closed: int = 1,
    anchor_description: str = "user-supplied anchor",
    downstream_taper_use_max: bool = True,
    jurisdiction: str = "CDOT",
    centerline: tuple[tuple[float, float], ...] | None = None,
) -> WorkCorridor:
    """Build a :class:`WorkCorridor` from user inputs and MUTCD/CDOT distances.

    Args:
        lat, lng: anchor (downstream-most point of the corridor — see
            module docstring).
        bearing_deg: compass bearing from anchor toward the upstream end.
        speed_mph: posted speed.
        work_zone_ft: physical length of the work area itself
            (everything between the buffer and the downstream taper).
        closure_type: one of ``'shoulder'``, ``'lane_closure'``,
            ``'flagger'``, ``'mobile_op_2lane'``,
            ``'mobile_op_multilane'``, or ``'shifting'`` (or the
            corresponding scenario-kind discriminator).
        road_type: ``'urban_low'``, ``'urban_high'``, ``'rural'``,
            ``'expressway'``, or ``'freeway'``.  ``None`` defers to
            :func:`advance_warning_spacing`'s speed-based inference,
            which now raises at 55+ mph (Bug Fix 6) — high-speed
            callers must pass an explicit road_type.
        lane_width_ft: lane width used when computing merging-/shifting-
            taper length.  Default 12 ft (MUTCD typical).
        shoulder_width_ft: shoulder width used when computing the
            shoulder-taper L/3.  Default 10 ft (CDOT typical).
        num_lanes_closed: lanes closed downstream — drives the
            downstream taper length per :func:`downstream_taper_length`.
            Default 1.
        anchor_description: free-form label preserved in the corridor
            (e.g., ``'US-85 & Bromley Ln'``, ``'MP 241.3'``,
            ``'dropped pin'``).
        downstream_taper_use_max: when ``True`` (default), use the
            upper bound of the 50–100 ft-per-lane MUTCD range for the
            downstream taper.  The longer figure produces a more
            conservative corridor for site-detection bboxes.
        centerline: optional (lat, lng) road-geometry vertices — see
            :attr:`WorkCorridor.centerline`.  Drawing frame only (#140);
            zone lengths above are unaffected.

    Returns:
        A populated :class:`WorkCorridor`.
    """
    spacing = advance_warning_spacing(speed_mph, road_type)
    advance_ft = spacing["A"] + spacing["B"] + spacing["C"]

    taper_ft = _resolve_taper_ft(closure_type, speed_mph, lane_width_ft, shoulder_width_ft)
    buffer_ft = buffer_space(speed_mph, jurisdiction=jurisdiction)
    downstream_ft = downstream_taper_length(num_lanes_closed, use_max=downstream_taper_use_max)

    return WorkCorridor(
        anchor_lat=lat,
        anchor_lng=lng,
        anchor_description=anchor_description,
        bearing_deg=bearing_deg % 360.0,
        advance_warning_ft=float(advance_ft),
        taper_ft=float(taper_ft),
        buffer_ft=float(buffer_ft),
        work_zone_ft=float(work_zone_ft),
        downstream_taper_ft=float(downstream_ft),
        centerline=centerline,
    )


def _point_along_corridor(corridor: WorkCorridor, fraction: float) -> tuple[float, float]:
    """Lat/lng at ``fraction`` of the corridor's length.

    ``fraction = 0.0`` returns the anchor (downstream end);
    ``fraction = 1.0`` returns :meth:`WorkCorridor.upstream_point`.
    """
    return corridor.point_at_station_ft(fraction * corridor.total_length_ft)


# ---------------------------------------------------------------------------
# Polyline encoding (Google encoded-polyline algorithm)
# ---------------------------------------------------------------------------


def encode_polyline(coords: list[tuple[float, float]]) -> str:
    """Encode a list of (lat, lng) pairs as a Google polyline string.

    Implements the canonical algorithm used by Mapbox Static Images,
    Google Directions, and other geospatial services.  Coordinates
    are rounded to 5 decimal places (precision 5) per the standard;
    the resulting string can be passed verbatim to
    ``path-{w}+{c}-{a}({polyline})`` in a Mapbox Static URL.

    The algorithm:
      1. Take 5-decimal-precision integer (lat × 1e5, lng × 1e5).
      2. Encode each as a difference from the previous coordinate.
      3. Left-shift one bit, complement if negative.
      4. Break into 5-bit chunks, low-order first.
      5. OR each non-final chunk with 0x20 to mark continuation.
      6. Add 63 to each chunk to land in the printable ASCII range.
    """

    def _encode_signed(v: int) -> str:
        v = ~(v << 1) if v < 0 else (v << 1)
        out_chunks: list[str] = []
        while v >= 0x20:
            out_chunks.append(chr((0x20 | (v & 0x1F)) + 63))
            v >>= 5
        out_chunks.append(chr(v + 63))
        return "".join(out_chunks)

    out: list[str] = []
    prev_lat_e5 = 0
    prev_lng_e5 = 0
    for lat, lng in coords:
        lat_e5 = int(round(lat * 1e5))
        lng_e5 = int(round(lng * 1e5))
        out.append(_encode_signed(lat_e5 - prev_lat_e5))
        out.append(_encode_signed(lng_e5 - prev_lng_e5))
        prev_lat_e5 = lat_e5
        prev_lng_e5 = lng_e5
    return "".join(out)
