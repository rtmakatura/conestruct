"""#285: the nearest named cross street at pin time.

A READ (#290 ruling 4): one Overpass call, no lock, no write, no memo, no
scan.  It finds the nodes the confirmed road's ways share with another
named (or numbered) vehicular way, keeps those on the relayed centerline,
and names the one nearest the pin along that line.  The words are
composed here (Rule 3); the frontend prints them.

Nothing is guessed (Rule 10): no centerline, no road key, a refused
query, or no shared node within reach all answer without a cross street,
and the tag keeps the ruled interim (the road name).

On a near_intersection plan with a marked cross pin (#234) the answer is
that pin, so the tag and the picker's marker cannot disagree.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from src.rules import site_detection
from src.rules.corridor import _haversine_m, _project_onto_segment_m

# CHOSEN (Rule 12): 1700 m.  The smallest of the three radii Ryan named
# (400 / 800 / 1700 m, 2026-10-14) that names the cross street on every
# pin of the 16-pin test set where any of them does; US 287 north of Lamar
# finds County Road 7 (925 m) only at 1700 m, Lookout Mountain Road needs
# 800 m.  Answers ran 0.5-2.1 s at every radius, 35 KB at most
# (validation-artifacts/committed/issue-285-cross-street/prediction.md,
# run1/).  Not #290's 250 ft relevance threshold, which is an
# along-corridor tolerance.
FETCH_RADIUS_M = 1700

# CHOSEN (Rule 12): 12 s, a judgment call, not measured as a limit.  The
# tag waits on nothing else and the measured worst case was 2.06 s
# (run1/rows.json); past 12 s the answer is "unavailable" and the tag
# keeps the road name.
QUERY_BUDGET_S = 12.0

# CHOSEN (Rule 12): 30 m.  Measured (lateral285.txt): shared nodes on the
# road sit 0 m from its centerline, or 12-19 m on the far carriageway of a
# divided road (US 287; one Broadway node on the picker's own geometry);
# the nearest node off the relayed stretch sat 59 m away.  30 m is between
# them.  A node past it has no along-road offset on this centerline.
LATERAL_TOLERANCE_M = 30.0

# CHOSEN (Rule 12): 50 ft, a judgment call.  Under it the offset is not a
# useful distance ("10 ft N of"), and the tag says the work starts AT the
# cross street.
AT_THRESHOLD_FT = 50

# CHOSEN (Rule 12): the vehicular classes, most important first, a
# judgment call.  The rank breaks a tie between two names at one node.
# Footways, service roads and tracks are not cross streets a crew would
# name.
VEHICULAR_CLASSES = (
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "motorway_link",
    "trunk_link",
    "primary_link",
    "secondary_link",
    "tertiary_link",
    "unclassified",
    "residential",
    "living_street",
)
_CLASS_RANK = {c: i for i, c in enumerate(VEHICULAR_CLASSES)}

M_PER_FT = 0.3048
_COMPASS = ("N", "NE", "E", "SE", "S", "SW", "W", "NW")


@dataclass(frozen=True)
class Answer:
    """The read's answer.  Only ``status == "found"`` carries words."""

    status: str  # found | none | unavailable | not_applicable
    text: str | None = None
    cross_street: str | None = None
    offset_ft: int | None = None
    direction: str | None = None
    source: str | None = None  # osm_shared_node | marked_cross_pin
    provenance_text: str | None = None
    osm_node_id: int | None = None
    reason: str | None = None

    def as_json(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "text": self.text,
            "cross_street": self.cross_street,
            "offset_ft": self.offset_ft,
            "direction": self.direction,
            "source": self.source,
            "provenance_text": self.provenance_text,
            "osm_node_id": self.osm_node_id,
            "reason": self.reason,
            "radius_m": FETCH_RADIUS_M,
        }


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def build_query(
    lat: float, lng: float, key: str, value: str, radius_m: int = FETCH_RADIUS_M
) -> str:
    """The shared-node query: the road's ways near the pin (by its name, or
    its ref when it has none), and every node they share with another
    vehicular way that has a name or a ref.  Ways come back with their
    node lists and tags; the shared nodes with their coordinates."""
    classes = "|".join(VEHICULAR_CLASSES)
    return (
        "[out:json][timeout:15];"
        f'way(around:{radius_m},{lat},{lng})[highway~"^({classes})$"]["{key}"="{_escape(value)}"]->.road;'
        "node(w.road)->.rn;"
        f'way(bn.rn)[highway~"^({classes})$"][~"^(name|ref)$"~"."]->.touch;'
        "(.touch; - .road;)->.cross;"
        "node(w.cross)->.cn;"
        "node.rn.cn->.shared;"
        ".cross out body;"
        ".shared out skel;"
    )


def _station(
    lat: float, lng: float, line: list[tuple[float, float]]
) -> tuple[float, float, tuple[float, float]]:
    """``(along_m, lateral_m, foot)`` of a point on a polyline: the nearest
    segment's clamped projection, its arc length from the line's start,
    and the projected point itself."""
    best: tuple[float, float, tuple[float, float]] | None = None
    walked = 0.0
    for (a_lat, a_lng), (b_lat, b_lng) in zip(line, line[1:], strict=False):
        seg = _haversine_m(a_lat, a_lng, b_lat, b_lng)
        lateral, t = _project_onto_segment_m(lat, lng, a_lat, a_lng, b_lat, b_lng)
        if best is None or lateral < best[1]:
            foot = (a_lat + t * (b_lat - a_lat), a_lng + t * (b_lng - a_lng))
            best = (walked + t * seg, lateral, foot)
        walked += seg
    assert best is not None
    return best


def _bearing_deg(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dl = math.radians(b_lng - a_lng)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def _compass(deg: float) -> str:
    return _COMPASS[int(((deg % 360.0) + 22.5) // 45.0) % 8]


def _direction(cross_foot: tuple[float, float], pin_foot: tuple[float, float]) -> str:
    """Which way the work start lies from the cross street, read along the
    road: the bearing between the two points' feet on the centerline, so
    a pin dropped beside the road does not tilt "S" into "SW"."""
    return _compass(_bearing_deg(cross_foot[0], cross_foot[1], pin_foot[0], pin_foot[1]))


def _is_road(tags: dict[str, str], key: str, value: str) -> bool:
    """A way IS the confirmed road when it carries the road's key value,
    alone or inside a concurrency ("US 24;CO 9" carries US 24)."""
    own = value.strip().lower()
    for k in ("name", "ref"):
        v = tags.get(k)
        if not v:
            continue
        parts = [p.strip().lower() for p in v.split(";")]
        if own in parts or v.strip().lower() == own:
            return True
    return False


def _words(offset_ft: int, direction: str, name: str) -> str:
    if offset_ft < AT_THRESHOLD_FT:
        return f"at {name}"
    return f"{offset_ft:,} ft {direction} of {name}"


def _round10(ft: float) -> int:
    """CHOSEN (Rule 12): the offset is printed to the nearest 10 ft, a
    judgment call; a pin is placed by hand on an aerial, so a 1 ft figure
    would claim a precision the pin does not have."""
    return int(round(ft / 10.0)) * 10


def from_overpass(
    data: dict[str, Any],
    pin: tuple[float, float],
    centerline: list[tuple[float, float]],
    key: str,
    value: str,
) -> Answer:
    """The pick, from a shared-node answer (pure; the tests replay this)."""
    elements = data.get("elements", [])
    nodes = {e["id"]: (e["lat"], e["lon"]) for e in elements if e.get("type") == "node"}
    named: dict[int, list[tuple[int, str]]] = {}
    for w in elements:
        if w.get("type") != "way":
            continue
        tags = w.get("tags", {})
        if _is_road(tags, key, value):
            continue
        label = tags.get("name") or tags.get("ref")
        if not label:
            continue
        rank = _CLASS_RANK.get(tags.get("highway", ""), len(VEHICULAR_CLASSES))
        for nid in w.get("nodes", []):
            if nid in nodes:
                named.setdefault(nid, []).append((rank, label))
    if not named:
        return Answer(status="none", reason="no shared node with another named way within reach")

    pin_along, _, pin_foot = _station(pin[0], pin[1], centerline)
    best: tuple[float, float, int] | None = None
    for nid in named:
        lat, lng = nodes[nid]
        along, lateral, _ = _station(lat, lng, centerline)
        if lateral > LATERAL_TOLERANCE_M:
            continue
        gap = abs(along - pin_along)
        straight = _haversine_m(pin[0], pin[1], lat, lng)
        if best is None or (gap, straight) < (best[0], best[1]):
            best = (gap, straight, nid)
    if best is None:
        return Answer(status="none", reason="no shared node lies on the confirmed centerline")

    gap_m, _, nid = best
    lat, lng = nodes[nid]
    # CHOSEN (Rule 12), a judgment call: of several names at one node the
    # highest class wins, then the alphabetically first, so the same node
    # always reads the same ("East 11th Avenue" over "West 11th Avenue").
    name = sorted(set(named[nid]))[0][1]
    offset_ft = _round10(gap_m / M_PER_FT)
    direction = _direction(_station(lat, lng, centerline)[2], pin_foot)
    return Answer(
        status="found",
        text=_words(offset_ft, direction, name),
        cross_street=name,
        offset_ft=offset_ft,
        direction=direction,
        source="osm_shared_node",
        provenance_text=f"cross street from OSM node {nid} · searched {FETCH_RADIUS_M:,} m",
        osm_node_id=nid,
    )


def from_marked_cross_pin(
    pin: tuple[float, float],
    centerline: list[tuple[float, float]],
    cross: tuple[float, float],
    name: str,
) -> Answer:
    """#234: the operator's own cross pin answers, so the tag and the
    picker's marker name one cross street."""
    pin_along, _, pin_foot = _station(pin[0], pin[1], centerline)
    along, _, cross_foot = _station(cross[0], cross[1], centerline)
    offset_ft = _round10(abs(along - pin_along) / M_PER_FT)
    direction = _direction(cross_foot, pin_foot)
    return Answer(
        status="found",
        text=_words(offset_ft, direction, name),
        cross_street=name,
        offset_ft=offset_ft,
        direction=direction,
        source="marked_cross_pin",
        provenance_text="cross street from your marked intersection",
    )


def nearest_intersection(
    *,
    pin: tuple[float, float],
    centerline: list[tuple[float, float]] | None,
    road_name: str | None,
    road_ref: str | None,
    marked_cross: tuple[float, float] | None = None,
    marked_cross_name: str | None = None,
    meta: dict[str, Any] | None = None,
) -> Answer:
    """The read.  ``meta`` receives the Overpass helper's mirror facts."""
    if not centerline or len(centerline) < 2:
        return Answer(status="not_applicable", reason="no confirmed centerline at this pin")
    line = [(float(a), float(b)) for a, b in centerline]
    if marked_cross is not None and marked_cross_name:
        return from_marked_cross_pin(pin, line, marked_cross, marked_cross_name)
    if road_name:
        key, value = "name", road_name
    elif road_ref:
        key, value = "ref", road_ref
    else:
        return Answer(status="not_applicable", reason="the confirmed road has no name or ref")
    data, err = site_detection._overpass_request_with_fallback(
        build_query(pin[0], pin[1], key, value), budget_s=QUERY_BUDGET_S, meta=meta
    )
    if data is None:
        return Answer(status="unavailable", reason=err or "overpass did not answer")
    return from_overpass(data, pin, line, key, value)
