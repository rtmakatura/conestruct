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
        """
        return _destination_point(
            self.anchor_lat, self.anchor_lng, self.bearing_deg, station_ft * M_PER_FT
        )

    # ------------------------------------------------------------------
    # Bounding box (for Overpass queries)
    # ------------------------------------------------------------------

    def corridor_bbox(self, lateral_buffer_m: float = 100.0) -> tuple[float, float, float, float]:
        """Bounding box ``(south, west, north, east)`` covering the full corridor.

        The box is inflated laterally by ``lateral_buffer_m`` on each side
        of the corridor centerline so that adjacent features (sidewalks,
        crossing streets) are caught.  This is the geometry that gets
        passed to Overpass for corridor-aware site detection.
        """
        upstream = self.upstream_point()
        downstream = self.downstream_point()

        # Perpendicular bearings to either side of the corridor.
        left = (self.bearing_deg - 90.0) % 360.0
        right = (self.bearing_deg + 90.0) % 360.0

        # Include the two endpoints themselves alongside the four
        # laterally-offset corners.  At cardinal bearings the perp
        # offset doesn't move one of the coords (e.g. bearing 0 →
        # left/right offsets only change lng), and the endpoint coord
        # would round-trip through ``_destination_point`` with a few
        # nanodegrees of drift; including the endpoints directly keeps
        # the bbox a strict superset of the corridor centerline.
        corners: list[tuple[float, float]] = [upstream, downstream]
        for lat, lng in (upstream, downstream):
            corners.append(_destination_point(lat, lng, left, lateral_buffer_m))
            corners.append(_destination_point(lat, lng, right, lateral_buffer_m))

        lats = [c[0] for c in corners]
        lngs = [c[1] for c in corners]
        return min(lats), min(lngs), max(lats), max(lngs)

    # ------------------------------------------------------------------
    # Zone classification
    # ------------------------------------------------------------------

    def along_station_ft(self, lat: float, lng: float) -> float:
        """Along-corridor station of (lat, lng) in feet, measured from anchor.

        Positive values lie in the bearing direction (toward upstream);
        negative values lie behind the anchor (further downstream than
        the anchor).  Lateral offset is ignored.
        """
        along_m, _ = _along_cross_track_m(
            self.anchor_lat, self.anchor_lng, self.bearing_deg, lat, lng
        )
        return along_m * FT_PER_M

    def lateral_offset_ft(self, lat: float, lng: float) -> float:
        """Absolute perpendicular distance from the corridor centerline, in feet."""
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
    if key in _LANE_KINDS or key in _FLAGGER_KINDS or key in _MOBILE_KINDS:
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

    Returns:
        A populated :class:`WorkCorridor`.
    """
    spacing = advance_warning_spacing(speed_mph, road_type)
    advance_ft = spacing["A"] + spacing["B"] + spacing["C"]

    taper_ft = _resolve_taper_ft(closure_type, speed_mph, lane_width_ft, shoulder_width_ft)
    buffer_ft = buffer_space(speed_mph)
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
