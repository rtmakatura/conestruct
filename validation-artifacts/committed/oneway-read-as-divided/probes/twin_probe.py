"""Issue C (a one-way street read as divided) — does a one-way way have a twin carriageway?

For each pin: fetch the OSM map data in a small box from the OSM API
(api.openstreetmap.org — NOT Overpass, NOT prod), pick the nearest
``highway=primary|primary_link|secondary|trunk`` way to the pin, and report:

  * its tags (highway, oneway, lanes, name, ref, dual_carriageway if any);
  * every other way in the box with the same name or ref, its bearing near
    the pin, whether it runs the opposite direction (|Δbearing - 180| <= 30°),
    and its perpendicular distance from the pin's way.

That distance is the signal option (b) would use: a twin under the same
name at median distance means a divided carriageway; none means a one-way
street. Read-only; a handful of API calls.

    python twin_probe.py   (writes twin_probe.txt beside itself)
"""

from __future__ import annotations

import json
import math
import time
import urllib.request
from pathlib import Path

PINS = {
    # name: (lat, lng, road-name substring the pin's way must carry, why)
    "broadway-sb": (39.73370, -104.98753, "Broadway", "#290/#300 pin, a downtown couplet street"),
    "lincoln-nb": (39.73370, -104.98593, "Lincoln", "Broadway's couplet partner, one block east"),
    "speer-blvd": (39.72926, -104.99009, "Speer", "Speer Blvd near Broadway (Nominatim way 1121174298); carriageways either side of Cherry Creek"),
    "federal-blvd": (39.72500, -105.02530, "Federal", "Federal Blvd (CO 88) at ~W 4th Ave"),
    "colorado-blvd": (39.70900, -104.94070, "Colorado", "Colorado Blvd (CO 2) at ~E Exposition Ave"),
}
HALF = 0.0025  # degrees: ~280 m N-S, ~215 m E-W at 39.7°N
CLASSES = {"primary", "primary_link", "secondary", "secondary_link", "trunk", "trunk_link", "tertiary"}
UA = "conestruct-investigation/1.0 (issue C, read-only)"


def fetch(lat: float, lng: float) -> dict:
    url = (
        "https://api.openstreetmap.org/api/0.6/map.json?bbox="
        f"{lng - HALF:.6f},{lat - HALF:.6f},{lng + HALF:.6f},{lat + HALF:.6f}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def xy(lat0: float, lat: float, lng: float, lng0: float) -> tuple[float, float]:
    k = 111_320.0
    return ((lng - lng0) * k * math.cos(math.radians(lat0)), (lat - lat0) * k)


def seg_dist(p, a, b) -> tuple[float, float]:
    """Distance from p to segment ab (metres) and the segment's bearing (deg)."""
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy or 1e-9
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy), (math.degrees(math.atan2(dx, dy)) + 360) % 360


def nearest(way, nodes, p, lat0, lng0):
    best = (1e18, 0.0)
    pts = [xy(lat0, nodes[n][0], nodes[n][1], lng0) for n in way["nodes"] if n in nodes]
    for a, b in zip(pts, pts[1:]):
        best = min(best, seg_dist(p, a, b))
    return best


lines = []
for key, (lat, lng, want, why) in PINS.items():
    d = fetch(lat, lng)
    time.sleep(1.5)
    nodes = {e["id"]: (e["lat"], e["lon"]) for e in d["elements"] if e["type"] == "node"}
    ways = [e for e in d["elements"] if e["type"] == "way" and (e.get("tags") or {}).get("highway") in CLASSES]
    origin = (0.0, 0.0)
    scored = sorted(((nearest(w, nodes, origin, lat, lng), w) for w in ways), key=lambda t: t[0][0])
    named = [t for t in scored if want in (t[1].get("tags") or {}).get("name", "")]
    if named:
        scored = [named[0]] + [t for t in scored if t is not named[0]]
    lines.append(f"== {key}  ({lat}, {lng})  {why}")
    if not scored:
        lines.append("   no road ways in the box")
        continue
    (d0, b0), w0 = scored[0]
    t0 = w0.get("tags", {})
    lines.append(
        f"   pin way {w0['id']}: highway={t0.get('highway')} oneway={t0.get('oneway')} lanes={t0.get('lanes')} "
        f"name={t0.get('name')!r} ref={t0.get('ref')!r} dual_carriageway={t0.get('dual_carriageway')} "
        f"bearing={b0:.0f} dist_from_pin={d0:.1f} m"
    )
    # Distance from the pin way (its nearest point to the pin) to each same-name/ref way.
    # The pin way's nearest point to the pin: distances below are measured from it.
    pts0 = [xy(lat, nodes[n][0], nodes[n][1], lng) for n in w0["nodes"] if n in nodes]
    best = None
    for a, b in zip(pts0, pts0[1:]):
        ax, ay = a; bx, by = b; dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, (-ax * dx - ay * dy) / ((dx * dx + dy * dy) or 1e-9)))
        c = (ax + t * dx, ay + t * dy)
        if best is None or math.hypot(*c) < math.hypot(*best):
            best = c
    p0 = best or origin
    name, ref = t0.get("name"), t0.get("ref")
    for (_d, _b), w in scored[1:]:
        dist, brg = nearest(w, nodes, p0, lat, lng)
        t = w.get("tags", {})
        if not ((name and t.get("name") == name) or (ref and t.get("ref") == ref)):
            continue
        diff = abs(((brg - b0) + 180) % 360 - 180)
        opposite = abs(diff - 180) <= 30 or diff >= 150
        lines.append(
            f"   same-name way {w['id']}: oneway={t.get('oneway')} lanes={t.get('lanes')} bearing={brg:.0f} "
            f"(delta {diff:.0f}; {'OPPOSITE' if opposite else 'same/other'}) dist_from_pin_way={dist:.1f} m"
        )
    others = [
        (dist, w) for (dist, _b), w in scored[1:6]
        if not ((name and w.get('tags', {}).get('name') == name) or (ref and w.get('tags', {}).get('ref') == ref))
    ]
    for dist, w in others[:3]:
        t = w.get("tags", {})
        lines.append(f"   (other) way {w['id']} {t.get('highway')} oneway={t.get('oneway')} name={t.get('name')!r} dist={dist:.1f} m")

out = Path(__file__).with_name("twin_probe.txt")
out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\r\n")
print("\n".join(lines))
