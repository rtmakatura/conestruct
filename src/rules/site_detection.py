"""
Auto-detect site conditions near a work zone using OpenStreetMap Overpass API.

Pre-fills the manual site-condition checkboxes in the generator UI. Detection is
approximate (OSM coverage varies); a field inspection still owns the final answer.

Two detection modes are supported:

* :func:`detect_site_conditions` — legacy point-and-radius query.  Used
  when only a single lat/lng is available and no corridor extent has
  been computed yet.
* :func:`detect_along_corridor` — corridor-aware query.  Uses a
  :class:`~src.rules.corridor.WorkCorridor` bounding box so that
  features detected belong to the road segment the work zone actually
  occupies, and tags each feature with the corridor zone it falls in
  (advance warning, taper, buffer, work zone, downstream, lateral).
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING, Any

import httpx

if TYPE_CHECKING:
    from src.rules.corridor import WorkCorridor

DEFAULT_RADIUS_M = 500.0
HTTP_TIMEOUT_S = 25.0
# Overpass returns 406 to clients without an identifying User-Agent.
USER_AGENT = "conestruct-traffic-control-tool/0.2 (+https://conestruct.com; hello@conestruct.com)"

# Public Overpass mirrors, tried in order.  The official endpoint at
# overpass-api.de regularly returns 504 Gateway Timeout under load, so
# we fall back to community mirrors.  Each mirror is independently
# rate-limited and operated; ordering puts the most-reliable first.
OVERPASS_MIRRORS: tuple[str, ...] = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
)


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lon points in meters."""
    earth_radius_m = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_m * c


def _build_query(lat: float, lng: float, radius_m: float) -> str:
    r = f"{radius_m:.0f}"
    around = f"around:{r},{lat},{lng}"
    return f"""[out:json][timeout:10];
(
  node({around})["highway"="traffic_signals"];
  node({around})["highway"="crossing"];
  way({around})["highway"="footway"];
  way({around})["footway"="sidewalk"];
  way({around})["highway"="cycleway"];
  way({around})["cycleway"];
  node({around})["amenity"="school"];
  way({around})["amenity"="school"];
  node({around})["railway"="level_crossing"];
  node({around})["amenity"="hospital"];
  way({around})["amenity"="hospital"];
  node({around})["highway"="motorway_junction"];
  way({around})["highway"="motorway_link"];
  way({around})["highway"="trunk_link"];
  way({around})["bridge"="yes"];
);
out center tags;
"""


def _element_coord(el: dict[str, Any]) -> tuple[float, float] | None:
    if "lat" in el and "lon" in el:
        return float(el["lat"]), float(el["lon"])
    center = el.get("center")
    if center and "lat" in center and "lon" in center:
        return float(center["lat"]), float(center["lon"])
    return None


def _label_for(el: dict[str, Any]) -> str:
    tags = el.get("tags") or {}
    name = tags.get("name")
    # Motorway-junction nodes carry the exit number on a ``ref`` tag and
    # the cross-street name on ``name``; surface both so the audit trail
    # shows e.g. "Garden of the Gods Rd interchange (Exit 146)".
    if tags.get("highway") == "motorway_junction":
        ref = tags.get("ref")
        if name and ref:
            return f"{name} interchange (Exit {ref})"
        if ref:
            return f"Exit {ref}"
        if name:
            return f"{name} interchange"
    if name:
        return str(name)
    coord = _element_coord(el)
    if coord is not None:
        return f"unnamed at {coord[0]:.4f}, {coord[1]:.4f}"
    return "unnamed feature"


def _junction_ref(el: dict[str, Any]) -> str | None:
    """Exit number from a ``motorway_junction`` node, if present."""
    tags = el.get("tags") or {}
    if tags.get("highway") != "motorway_junction":
        return None
    ref = tags.get("ref")
    return str(ref) if ref else None


def _overpass_request_with_fallback(
    query: str,
) -> tuple[dict[str, Any] | None, str | None]:
    """POST the Overpass query to each mirror until one returns a valid payload.

    Retries on 5xx and connection errors (mirror is overloaded or down).
    Stops on 4xx (the query itself is malformed; trying another mirror
    will produce the same error).  Returns ``(payload, None)`` on
    success or ``(None, error_message)`` after exhausting mirrors.
    """
    last_error = "no mirrors configured"
    for url in OVERPASS_MIRRORS:
        try:
            resp = httpx.post(
                url,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=HTTP_TIMEOUT_S,
            )
        except httpx.HTTPError as exc:
            last_error = f"{url}: {type(exc).__name__}: {exc}"
            continue
        if 400 <= resp.status_code < 500:
            return None, f"{url}: {resp.status_code} {resp.reason_phrase}"
        if resp.status_code >= 500:
            last_error = f"{url}: {resp.status_code} {resp.reason_phrase}"
            continue
        try:
            return resp.json(), None
        except ValueError as exc:
            last_error = f"{url}: invalid JSON: {exc}"
            continue
    return None, last_error


def _empty(detail_msg: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {"detected": False, "count": 0, "details": []}
    if detail_msg:
        out["details"] = [detail_msg]
    return out


# Highway tag values that indicate an interchange / ramp facility.  Used by
# :func:`_categorize` to split the legacy ``intersections`` bucket into
# ``intersections`` (at-grade signal/stop/uncontrolled crossings) and
# ``interchanges`` (highway on/off-ramps where cross-traffic merges rather
# than crosses at a stop bar).  See BUG FIX 3 for the cross-street vs.
# ramp-signing rationale.
_INTERCHANGE_HIGHWAY_TAGS: frozenset[str] = frozenset(
    {"motorway", "trunk", "motorway_link", "trunk_link"}
)


def _categorize(el: dict[str, Any]) -> str | None:
    """Map an OSM element to one of our site-condition buckets.

    Splits the historical "any crossing/junction" bucket into two:

    * ``intersections`` — at-grade signals, stop-controlled crossings,
      uncontrolled crossings.  Cross-traffic enters via a stop bar.
    * ``interchanges`` — highway on/off-ramps, motorway junction nodes
      (exit numbers), and bridges (typically a structure carrying the
      highway over a cross street, or vice versa).  Cross-traffic
      enters via merging ramps and needs ramp-specific signing.
    """
    tags = el.get("tags") or {}
    highway = tags.get("highway")
    if highway == "motorway_junction":
        return "interchanges"
    if highway in _INTERCHANGE_HIGHWAY_TAGS:
        return "interchanges"
    if tags.get("bridge") == "yes":
        return "interchanges"
    if highway in {"traffic_signals", "crossing"}:
        return "intersections"
    if highway == "footway" or tags.get("footway") == "sidewalk":
        return "sidewalks"
    if highway == "cycleway" or "cycleway" in tags:
        return "bike_facilities"
    if tags.get("amenity") == "school":
        return "schools"
    if tags.get("railway") == "level_crossing":
        return "railroad_crossings"
    if tags.get("amenity") == "hospital":
        return "hospitals"
    return None


def detect_site_conditions(
    lat: float,
    lng: float,
    radius_m: float = DEFAULT_RADIUS_M,
) -> dict[str, Any]:
    """Query Overpass for features near (lat, lng) and bucket them.

    Returns a dict keyed by condition name. Each value has ``detected`` (bool),
    ``count`` (int), ``details`` (list[str]), and where applicable
    ``nearest_distance_m`` (float).

    On any network/parse failure, returns all-buckets-empty plus an ``error``
    key carrying the exception string. The generator must still work offline.
    """
    buckets: dict[str, Any] = {
        "intersections": _empty(),
        "interchanges": _empty(),
        "sidewalks": _empty(),
        "bike_facilities": _empty(),
        "schools": _empty(),
        "railroad_crossings": _empty(),
        "hospitals": _empty(),
        "road_curvature": {
            "detected": False,
            "details": "Road curvature analysis not implemented; assume straight.",
        },
    }
    # Interchange exit numbers, deduplicated, populated only when a
    # motorway_junction node carries a ``ref`` tag.  Surfaced to the UI
    # so the audit trail can call out specific exits.
    buckets["interchanges"]["junction_refs"] = []

    query = _build_query(lat, lng, radius_m)
    payload, error = _overpass_request_with_fallback(query)
    if payload is None:
        buckets["error"] = error or "Overpass request failed"
        return buckets

    elements = payload.get("elements", []) or []

    for el in elements:
        bucket_name = _categorize(el)
        if bucket_name is None:
            continue
        bucket = buckets[bucket_name]
        bucket["count"] += 1
        bucket["detected"] = True
        label = _label_for(el)
        coord = _element_coord(el)
        if coord is not None:
            distance = _haversine(lat, lng, coord[0], coord[1])
            existing = bucket.get("nearest_distance_m")
            if existing is None or distance < existing:
                bucket["nearest_distance_m"] = round(distance, 1)
            label = f"{label} (~{distance:.0f} m)"
        if len(bucket["details"]) < 5:
            bucket["details"].append(label)
        if bucket_name == "interchanges":
            ref = _junction_ref(el)
            if ref and ref not in bucket["junction_refs"]:
                bucket["junction_refs"].append(ref)

    return buckets


# ---------------------------------------------------------------------------
# Corridor-aware detection
# ---------------------------------------------------------------------------

# Zones that always count as "relevant" — feature is on the corridor
# centerline within one of the longitudinal segments.  Features tagged
# ``lateral`` or ``outside`` are not relevant *by default*; per-bucket
# overrides below relax this where the underlying signing rule has a
# different geometric expectation.
_RELEVANT_ZONES: frozenset[str] = frozenset(
    {"advance_warning", "transition", "buffer", "work_zone", "downstream"}
)

# Per-bucket relaxations of the default "relevant ⇔ zone ∈ _RELEVANT_ZONES"
# rule.  Tuned so the auto-apply layer flips a flag iff the OSM feature is
# in the geometric scope the corresponding MUTCD treatment cares about:
#
# * ``accept_lateral_within_ft`` — a feature classified ``lateral`` (offset
#   from centerline beyond corridor's default 50 ft lateral_threshold) still
#   counts as relevant if its lateral offset is within this distance.  Used
#   for sidewalks/bike facilities, which run parallel to the work zone by
#   construction — a curbside sidewalk at ~70–80 ft lateral is the *target*
#   of the pedestrian-closure rule, not a parallel-street false positive.
#
# * ``outside_tolerance_ft`` — a feature classified ``outside`` (just past
#   the corridor's upstream or downstream end, past classify_distance's
#   25 ft hard tolerance) still counts as relevant if it sits within this
#   distance of either end.  Used for at-grade intersections and highway
#   interchanges, where cross-street ROAD WORK AHEAD or upstream-ramp
#   signing must face the cross-traffic — a T-junction 30 ft past the most
#   upstream sign is still a real intersection that needs treatment.
#
# Numbers are tunable; the lateral 150 ft covers a typical 4-lane arterial
# section (lanes + shoulders + furnish) with margin, and the 250 ft / 500 ft
# longitudinal extents match the urban A-spacing / ramp-signing distances
# called out in MUTCD §6N.12 + §6N.16 (11th-ed intersection/interchange
# work-zone sections; formerly cited via the stale §6C.10 + §6F.60).
_BUCKET_RELEVANCE_OVERRIDES: dict[str, dict[str, float]] = {
    "intersections": {"outside_tolerance_ft": 250.0},
    "interchanges": {"outside_tolerance_ft": 500.0},
    "sidewalks": {"accept_lateral_within_ft": 150.0},
    "bike_facilities": {"accept_lateral_within_ft": 150.0},
}

# Longitudinal Overpass-bbox pad used when fetching corridor features, in
# meters.  Must be ≥ the widest ``outside_tolerance_ft`` above so that
# features eligible to count via the tolerance override are inside the
# query bbox in the first place.  500 ft ≈ 152.4 m.
_CORRIDOR_LONGITUDINAL_BUFFER_M: float = 152.4


def _is_feature_relevant(
    bucket_name: str,
    zone: str,
    along_ft: float | None,
    lateral_ft: float | None,
    total_length_ft: float,
) -> bool:
    """Decide whether a feature is relevant enough to flip the bucket flag.

    Default rule: ``zone ∈ _RELEVANT_ZONES`` (on-centerline, within the
    corridor's longitudinal extent).  Per-bucket overrides in
    ``_BUCKET_RELEVANCE_OVERRIDES`` relax this for sidewalks/bike facilities
    (accept ``lateral`` features within a sub-threshold) and for
    intersections/interchanges (accept ``outside`` features within a wider
    end-of-corridor tolerance).  See the override-table docstring for
    motivation.
    """
    if zone in _RELEVANT_ZONES:
        return True

    overrides = _BUCKET_RELEVANCE_OVERRIDES.get(bucket_name, {})

    if zone == "lateral":
        max_lateral_ft = overrides.get("accept_lateral_within_ft")
        if max_lateral_ft is None or lateral_ft is None:
            return False
        return lateral_ft <= max_lateral_ft

    if zone == "outside":
        tol_ft = overrides.get("outside_tolerance_ft")
        if tol_ft is None or along_ft is None:
            return False
        return -tol_ft <= along_ft <= total_length_ft + tol_ft

    return False


def _build_bbox_query(bbox: tuple[float, float, float, float]) -> str:
    """Same feature buckets as :func:`_build_query` but scoped to a bbox."""
    south, west, north, east = bbox
    box = f"{south:.6f},{west:.6f},{north:.6f},{east:.6f}"
    return f"""[out:json][timeout:10];
(
  node({box})["highway"="traffic_signals"];
  node({box})["highway"="crossing"];
  way({box})["highway"="footway"];
  way({box})["footway"="sidewalk"];
  way({box})["highway"="cycleway"];
  way({box})["cycleway"];
  node({box})["amenity"="school"];
  way({box})["amenity"="school"];
  node({box})["railway"="level_crossing"];
  node({box})["amenity"="hospital"];
  way({box})["amenity"="hospital"];
  node({box})["highway"="motorway_junction"];
  way({box})["highway"="motorway_link"];
  way({box})["highway"="trunk_link"];
  way({box})["bridge"="yes"];
);
out center tags;
"""


def _empty_corridor_bucket() -> dict[str, Any]:
    return {"detected": False, "count": 0, "details": [], "features": []}


def detect_along_corridor(
    corridor: WorkCorridor,
    lateral_buffer_m: float = 100.0,
) -> dict[str, Any]:
    """Query Overpass over the corridor's bounding box and bucket detections.

    Each detected feature is augmented with corridor-aware metadata
    (``zone``, ``relevant``, ``along_station_ft``) so that downstream
    layers can prefer features along the project corridor over features
    that merely happen to be inside its bbox.

    Returns a dict shaped like :func:`detect_site_conditions` but with
    each bucket additionally carrying:

    * ``features``: list of dicts with ``label``, ``zone``,
      ``relevant``, ``along_station_ft``, ``lateral_offset_ft``, and
      ``distance_to_anchor_m`` for the first ~5 detected features.
    * Bucket-level ``detected``/``count`` reflect only *relevant*
      features (zone in advance_warning/transition/buffer/work_zone/
      downstream) so existing callers see the same shape.

    On any network/parse failure, returns all-buckets-empty plus an
    ``error`` key carrying the failure message.
    """
    buckets: dict[str, Any] = {
        "intersections": _empty_corridor_bucket(),
        "interchanges": _empty_corridor_bucket(),
        "sidewalks": _empty_corridor_bucket(),
        "bike_facilities": _empty_corridor_bucket(),
        "schools": _empty_corridor_bucket(),
        "railroad_crossings": _empty_corridor_bucket(),
        "hospitals": _empty_corridor_bucket(),
        "road_curvature": {
            "detected": False,
            "details": "Road curvature analysis not implemented; assume straight.",
        },
    }
    buckets["interchanges"]["junction_refs"] = []

    bbox = corridor.corridor_bbox(
        lateral_buffer_m=lateral_buffer_m,
        longitudinal_buffer_m=_CORRIDOR_LONGITUDINAL_BUFFER_M,
    )
    query = _build_bbox_query(bbox)
    payload, error = _overpass_request_with_fallback(query)
    if payload is None:
        buckets["error"] = error or "Overpass request failed"
        return buckets

    elements = payload.get("elements", []) or []

    for el in elements:
        bucket_name = _categorize(el)
        if bucket_name is None:
            continue
        bucket = buckets[bucket_name]

        coord = _element_coord(el)
        label = _label_for(el)

        feature: dict[str, Any]
        if coord is None:
            # No geometry → can't classify zone; still record but mark
            # irrelevant so it doesn't move checkbox state.
            feature = {
                "label": label,
                "zone": "outside",
                "relevant": False,
                "along_station_ft": None,
                "lateral_offset_ft": None,
                "distance_to_anchor_m": None,
            }
        else:
            zone = corridor.classify_distance(coord[0], coord[1])
            along_ft = corridor.along_station_ft(coord[0], coord[1])
            lateral_ft = corridor.lateral_offset_ft(coord[0], coord[1])
            anchor_dist_m = _haversine(corridor.anchor_lat, corridor.anchor_lng, coord[0], coord[1])
            feature = {
                "label": label,
                "zone": zone,
                "relevant": _is_feature_relevant(
                    bucket_name, zone, along_ft, lateral_ft, corridor.total_length_ft
                ),
                "along_station_ft": round(along_ft, 1),
                "lateral_offset_ft": round(lateral_ft, 1),
                "distance_to_anchor_m": round(anchor_dist_m, 1),
            }

        if len(bucket["features"]) < 5:
            bucket["features"].append(feature)

        if feature["relevant"]:
            bucket["count"] += 1
            bucket["detected"] = True
            display = f"{label} [{feature['zone']} @ {feature['along_station_ft']:.0f} ft]"
            if len(bucket["details"]) < 5:
                bucket["details"].append(display)
            anchor_dist_m = feature["distance_to_anchor_m"]
            if anchor_dist_m is not None:
                existing = bucket.get("nearest_distance_m")
                if existing is None or anchor_dist_m < existing:
                    bucket["nearest_distance_m"] = anchor_dist_m
            if bucket_name == "interchanges":
                ref = _junction_ref(el)
                if ref and ref not in bucket["junction_refs"]:
                    bucket["junction_refs"].append(ref)

    return buckets


# ---------------------------------------------------------------------------
# OSM way bearing auto-detect
# ---------------------------------------------------------------------------


def _bearing_between(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Initial compass bearing from (lat1, lng1) to (lat2, lng2), in degrees [0, 360)."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dlambda = math.radians(lng2 - lng1)
    y = math.sin(dlambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360.0) % 360.0


def _build_road_at_query(lat: float, lng: float, radius_m: float) -> str:
    r = f"{radius_m:.0f}"
    around = f"around:{r},{lat},{lng}"
    # Pull highway ways near the anchor along with their geometry so we
    # can compute a bearing; restrict to the typical motorized facility
    # tags to avoid grabbing footways or service roads.
    return f"""[out:json][timeout:10];
(
  way({around})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];
);
out geom tags;
"""


def detect_road_bearing(
    lat: float,
    lng: float,
    radius_m: float = 30.0,
) -> dict[str, Any]:
    """Best-effort estimate of the road bearing at (lat, lng).

    Queries Overpass for the nearest motorized highway way, finds the
    two nodes on its geometry that bracket the anchor point, and
    returns the bearing of that segment.

    Returns a dict with:

    * ``bearing_deg``: ``float | None`` — the estimated bearing, or
      ``None`` if no road could be matched.
    * ``oneway``: ``bool | None`` — ``True``/``False`` from the OSM
      ``oneway`` tag, or ``None`` if absent.  When ``oneway`` is
      ``False`` the returned bearing represents the way's digitization
      direction; the road serves traffic in *both* this bearing and
      its reciprocal.
    * ``way_id``: the matched OSM way id (or ``None``).
    * ``highway``: the matched ``highway`` tag value (or ``None``).
    * ``error``: error string when the query failed; otherwise absent.
    """
    out: dict[str, Any] = {
        "bearing_deg": None,
        "oneway": None,
        "way_id": None,
        "highway": None,
    }

    query = _build_road_at_query(lat, lng, radius_m)
    payload, error = _overpass_request_with_fallback(query)
    if payload is None:
        out["error"] = error or "Overpass request failed"
        return out

    ways = [el for el in payload.get("elements", []) if el.get("type") == "way"]
    if not ways:
        return out

    # Pick the way whose geometry passes closest to the anchor.
    best_way: dict[str, Any] | None = None
    best_segment: tuple[dict[str, float], dict[str, float]] | None = None
    best_distance = math.inf

    for way in ways:
        geometry = way.get("geometry") or []
        if len(geometry) < 2:
            continue
        for a, b in zip(geometry, geometry[1:], strict=False):
            mid_lat = (a["lat"] + b["lat"]) / 2.0
            mid_lng = (a["lon"] + b["lon"]) / 2.0
            d = _haversine(lat, lng, mid_lat, mid_lng)
            if d < best_distance:
                best_distance = d
                best_way = way
                best_segment = (a, b)

    if best_way is None or best_segment is None:
        return out

    a, b = best_segment
    bearing = _bearing_between(a["lat"], a["lon"], b["lat"], b["lon"])
    tags = best_way.get("tags") or {}
    oneway_tag = tags.get("oneway")
    oneway = None
    if oneway_tag in {"yes", "true", "1"}:
        oneway = True
    elif oneway_tag in {"no", "false", "0"}:
        oneway = False

    out["bearing_deg"] = round(bearing, 2)
    out["oneway"] = oneway
    out["way_id"] = best_way.get("id")
    out["highway"] = tags.get("highway")
    return out


# ---------------------------------------------------------------------------
# Corridor-against-OSM validator
# ---------------------------------------------------------------------------

# Highway classes considered "major" for the no-road check.  These are the
# road types where work-zone plans are typically deployed; a closure on
# anything below tertiary is unusual enough that the planner should
# double-check the anchor coordinates.
_MAJOR_ROAD_CLASSES: frozenset[str] = frozenset(
    {
        "motorway",
        "trunk",
        "primary",
        "secondary",
        "motorway_link",
        "trunk_link",
        "primary_link",
        "secondary_link",
    }
)

# Search radius (m) when looking for the road at the anchor.  Anything
# closer than this is "on the road"; anything farther means the anchor
# is in a parking lot, off-ramp, or unrelated nearby terrain.
_VALIDATION_SEARCH_RADIUS_M: float = 50.0

# Minimum allowed angular agreement between the corridor's declared
# bearing and the OSM road's bearing (or its reciprocal — divided
# carriageways are tagged one-way and the closer-segment heuristic may
# pick the opposing direction).
_BEARING_CONFLICT_THRESHOLD_DEG: float = 15.0


def _shortest_bearing_delta_deg(a: float, b: float) -> float:
    """Smallest unsigned angle between two compass bearings, in [0, 180]."""
    diff = (a - b) % 360.0
    return min(diff, 360.0 - diff)


def validate_corridor_against_osm(
    anchor_lat: float,
    anchor_lng: float,
    corridor_bearing_deg: float | None,
    search_radius_m: float = _VALIDATION_SEARCH_RADIUS_M,
    bearing_threshold_deg: float = _BEARING_CONFLICT_THRESHOLD_DEG,
) -> dict[str, Any]:
    """Best-effort sanity check: corridor inputs vs. OSM ground truth.

    Two checks fire when Overpass is reachable:

      1. **No major road at anchor.**  If no motorway / trunk / primary /
         secondary way (or any of their ``_link`` variants) lies within
         ``search_radius_m`` of the anchor, the corridor's anchor is
         probably wrong — emit a ``no_road_at_anchor`` warning.
      2. **Bearing conflict.**  If a major road is found, compare its
         bearing (and its reciprocal — divided-highway carriageways are
         one-way and the closer-segment heuristic may report the opposing
         travel direction) against ``corridor_bearing_deg``.  If neither
         agrees within ``bearing_threshold_deg``, emit a
         ``bearing_conflict`` warning.

    Returns ``{"checked": bool, "warnings": list[dict]}`` so callers can
    distinguish "OSM unavailable, skipped" from "OSM agreed, no
    warnings".  Each warning is a dict with ``flag`` / ``level`` /
    ``message`` plus context fields.

    Network or Overpass failures are caught silently — this is a soft
    check, never a render blocker.
    """
    out: dict[str, Any] = {"checked": False, "warnings": []}

    if corridor_bearing_deg is None:
        # Without a declared bearing we can't compute the conflict
        # check, and the no-road check is itself less actionable —
        # skip entirely so a future bearing-less render path doesn't
        # noisily warn for every plan.
        return out

    try:
        result = detect_road_bearing(anchor_lat, anchor_lng, radius_m=search_radius_m)
    except Exception:  # noqa: BLE001
        # Best-effort: any Overpass / network failure leaves
        # ``checked = False`` so callers know we never got an answer.
        return out

    if "error" in result and result.get("bearing_deg") is None:
        return out

    out["checked"] = True

    detected_highway = result.get("highway")
    if detected_highway is None or detected_highway not in _MAJOR_ROAD_CLASSES:
        # No major road within the radius — either nothing at all or a
        # residential / service / tertiary road.  Either way the
        # planner should re-verify coordinates.
        nearby_class = (
            f" (closest road within {search_radius_m:.0f} m: '{detected_highway}')"
            if detected_highway
            else ""
        )
        out["warnings"].append(
            {
                "flag": "no_road_at_anchor",
                "level": "warning",
                "message": (
                    "No motorway/trunk/primary/secondary road detected at anchor "
                    f"({anchor_lat:.5f}, {anchor_lng:.5f}) within {search_radius_m:.0f} m"
                    f"{nearby_class}.  "
                    "Verify coordinates correspond to the actual work zone."
                ),
                "anchor_lat": anchor_lat,
                "anchor_lng": anchor_lng,
                "detected_highway": detected_highway,
                "search_radius_m": search_radius_m,
            }
        )
        return out

    detected_bearing = result.get("bearing_deg")
    if detected_bearing is None:
        return out

    direct_delta = _shortest_bearing_delta_deg(corridor_bearing_deg, detected_bearing)
    reciprocal_delta = _shortest_bearing_delta_deg(
        corridor_bearing_deg, (detected_bearing + 180.0) % 360.0
    )
    delta = min(direct_delta, reciprocal_delta)
    if delta > bearing_threshold_deg:
        out["warnings"].append(
            {
                "flag": "bearing_conflict",
                "level": "warning",
                "message": (
                    f"Corridor bearing {corridor_bearing_deg:.1f}° conflicts with "
                    f"detected road bearing {detected_bearing:.1f}° at anchor "
                    f"({anchor_lat:.5f}, {anchor_lng:.5f}).  Smallest angle "
                    f"(incl. reciprocal): {delta:.1f}° > {bearing_threshold_deg:.0f}° "
                    "threshold.  Aerial overlay may not follow road geometry."
                ),
                "anchor_lat": anchor_lat,
                "anchor_lng": anchor_lng,
                "corridor_bearing_deg": corridor_bearing_deg,
                "detected_bearing_deg": detected_bearing,
                "delta_deg": delta,
                "detected_highway": detected_highway,
                "detected_way_id": result.get("way_id"),
            }
        )

    return out
