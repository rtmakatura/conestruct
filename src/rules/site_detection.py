"""
Auto-detect site conditions near a work zone using OpenStreetMap Overpass API.

Pre-fills the manual site-condition checkboxes in the generator UI. Detection is
approximate (OSM coverage varies); a field inspection still owns the final answer.
"""

from __future__ import annotations

import math
from typing import Any

import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DEFAULT_RADIUS_M = 500.0
HTTP_TIMEOUT_S = 15.0
# Overpass returns 406 to clients without an identifying User-Agent.
USER_AGENT = "conestruct-traffic-control-tool/0.2 (+https://github.com/anthropics/claude-code)"


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
    if name:
        return str(name)
    coord = _element_coord(el)
    if coord is not None:
        return f"unnamed at {coord[0]:.4f}, {coord[1]:.4f}"
    return "unnamed feature"


def _empty(detail_msg: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {"detected": False, "count": 0, "details": []}
    if detail_msg:
        out["details"] = [detail_msg]
    return out


def _categorize(el: dict[str, Any]) -> str | None:
    """Map an OSM element to one of our site-condition buckets."""
    tags = el.get("tags") or {}
    if tags.get("highway") in {"traffic_signals", "crossing"}:
        return "intersections"
    if tags.get("highway") == "footway" or tags.get("footway") == "sidewalk":
        return "sidewalks"
    if tags.get("highway") == "cycleway" or "cycleway" in tags:
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
    buckets: dict[str, dict[str, Any]] = {
        "intersections": _empty(),
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

    try:
        query = _build_query(lat, lng, radius_m)
        resp = httpx.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": USER_AGENT},
            timeout=HTTP_TIMEOUT_S,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:  # noqa: BLE001
        buckets["error"] = f"{type(exc).__name__}: {exc}"
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

    return buckets
