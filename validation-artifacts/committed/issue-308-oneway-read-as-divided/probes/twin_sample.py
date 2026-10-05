"""#308 R86 — the twin-radius sample: at least 20 Denver roads, divided and one-way.

For each road name below:
  1. Nominatim (inside Denver's bounding box) lists candidate OSM ways.
  2. The OSM API fetches each candidate; the first one tagged ``oneway=yes``
     with a road class is kept. A name with no one-way way is reported, not
     substituted.
  3. From that way's middle node, the OSM API map call (a box +/-HALF deg)
     gives every way nearby. The probe reports the nearest way with the SAME
     name (or ref) whose bearing runs opposite (|delta - 180| <= 30 deg),
     measured perpendicular from the pin way. "none" = no such way in the box.

``expected`` is the road's form as labelled before measuring, with its basis,
so the table can be checked against it. No Overpass, no prod.

    python twin_sample.py   (writes twin_sample.txt and twin_sample.json beside itself)
"""

from __future__ import annotations

import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

UA = "conestruct-investigation/1.0 (issue #308 R86, read-only; rtmakatura)"
VIEWBOX = "-105.11,39.92,-104.60,39.61"  # Denver, generous
HALF = 0.0035  # deg: ~390 m N-S, ~300 m E-W each way at 39.7 N
CLASSES = {"primary", "primary_link", "secondary", "secondary_link", "tertiary", "trunk"}

# (search name, expected form, basis for the label)
ROADS = [
    # Expected one-way streets (downtown / near-downtown one-way grid)
    ("North Broadway", "one_way_street", "#290 pin; couplet with Lincoln St"),
    ("North Lincoln Street", "one_way_street", "couplet with Broadway"),
    ("Stout Street", "one_way_street", "downtown one-way grid; classify.test.ts:183 case"),
    ("California Street", "one_way_street", "downtown one-way grid"),
    ("Champa Street", "one_way_street", "downtown one-way grid"),
    ("Curtis Street", "one_way_street", "downtown one-way grid"),
    ("Welton Street", "one_way_street", "downtown one-way grid"),
    ("15th Street", "one_way_street", "downtown one-way grid"),
    ("17th Street", "one_way_street", "downtown one-way grid"),
    ("18th Street", "one_way_street", "downtown one-way grid"),
    ("East 13th Avenue", "one_way_street", "13th/14th Ave one-way pair"),
    ("East 14th Avenue", "one_way_street", "13th/14th Ave one-way pair"),
    ("East 6th Avenue", "one_way_street", "6th/8th Ave one-way pair east of Broadway"),
    ("East 8th Avenue", "one_way_street", "6th/8th Ave one-way pair east of Broadway"),
    ("Logan Street", "one_way_street", "secondary one-way (twin_probe.txt)"),
    ("Grant Street", "one_way_street", "Grant/Logan one-way pair"),
    ("Pennsylvania Street", "one_way_street", "Pennsylvania/Pearl one-way pair"),
    ("Downing Street", "one_way_street", "Downing/Corona one-way pair (south of Colfax)"),
    # Expected divided roads mapped as two carriageways
    ("South Colorado Boulevard", "divided", "twin_probe.txt 14.8 m"),
    ("North Federal Boulevard", "divided", "twin_probe.txt 21.8 m"),
    ("North Speer Boulevard", "divided", "carriageways either side of Cherry Creek; twin_probe.txt 55.0 m"),
    ("East Hampden Avenue", "divided", "US 285, a median arterial"),
    ("Leetsdale Drive", "divided", "median arterial"),
    ("Martin Luther King Junior Boulevard", "divided", "median boulevard"),
    ("Monaco Street Parkway", "divided", "parkway with a wide median"),
    ("Montview Boulevard", "divided", "boulevard with a median"),
    ("Brighton Boulevard", "divided", "rebuilt with a median"),
    ("South University Boulevard", "divided", "median arterial south of I-25"),
    ("Sheridan Boulevard", "divided", "median arterial (Denver/Lakewood line)"),
    ("East Evans Avenue", "divided", "median sections"),
]


def get(url: str) -> dict | list:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def xy(lat0, lng0, lat, lng):
    k = 111_320.0
    return ((lng - lng0) * k * math.cos(math.radians(lat0)), (lat - lat0) * k)


def seg(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy or 1e-9
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.hypot(px - ax - t * dx, py - ay - t * dy), (math.degrees(math.atan2(dx, dy)) + 360) % 360


def nearest(pts, p):
    best = (1e18, 0.0)
    for a, b in zip(pts, pts[1:]):
        best = min(best, seg(p, a, b))
    return best


def pick_way(name: str):
    q = urllib.parse.urlencode({"q": f"{name}, Denver, Colorado", "format": "json", "limit": 15,
                                "viewbox": VIEWBOX, "bounded": 1})
    res = get(f"https://nominatim.openstreetmap.org/search?{q}")
    time.sleep(1.1)
    for r in res:
        if r.get("osm_type") != "way" or r.get("class") != "highway":
            continue
        w = get(f"https://api.openstreetmap.org/api/0.6/way/{r['osm_id']}/full.json")
        time.sleep(0.6)
        way = next(e for e in w["elements"] if e["type"] == "way")
        t = way.get("tags", {})
        if t.get("oneway") in ("yes", "-1") and t.get("highway") in CLASSES:
            nodes = {e["id"]: (e["lat"], e["lon"]) for e in w["elements"] if e["type"] == "node"}
            mid = nodes[way["nodes"][len(way["nodes"]) // 2]]
            return way, mid
    return None, None


rows = []
for name, expected, basis in ROADS:
    way, mid = pick_way(name)
    if way is None:
        rows.append({"name": name, "expected": expected, "basis": basis, "result": "no one-way way found"})
        continue
    lat, lng = mid
    d = get("https://api.openstreetmap.org/api/0.6/map.json?bbox="
            f"{lng - HALF:.6f},{lat - HALF:.6f},{lng + HALF:.6f},{lat + HALF:.6f}")
    time.sleep(1.5)
    nodes = {e["id"]: (e["lat"], e["lon"]) for e in d["elements"] if e["type"] == "node"}
    ways = {e["id"]: e for e in d["elements"] if e["type"] == "way"}
    t0 = way.get("tags", {})
    pts0 = [xy(lat, lng, *nodes[n]) for n in way["nodes"] if n in nodes]
    _, b0 = nearest(pts0, (0.0, 0.0))
    if t0.get("oneway") == "-1":
        b0 = (b0 + 180) % 360
    twin = None
    for w in ways.values():
        t = w.get("tags", {})
        if w["id"] == way["id"] or t.get("highway") not in CLASSES:
            continue
        same = (t0.get("name") and t.get("name") == t0.get("name")) or (t0.get("ref") and t.get("ref") == t0.get("ref"))
        if not same:
            continue
        pts = [xy(lat, lng, *nodes[n]) for n in w["nodes"] if n in nodes]
        if len(pts) < 2:
            continue
        dist, brg = nearest(pts, (0.0, 0.0))
        if t.get("oneway") == "-1":
            brg = (brg + 180) % 360
        if t.get("oneway") not in ("yes", "-1"):
            continue  # a two-way segment of the same road isn't a carriageway twin
        delta = abs(((brg - b0) + 180) % 360 - 180)
        if delta >= 150 and (twin is None or dist < twin[0]):
            twin = (dist, w["id"], round(delta))
    rows.append({
        "name": name, "expected": expected, "basis": basis,
        "way": way["id"], "highway": t0.get("highway"), "lanes": t0.get("lanes"), "ref": t0.get("ref"),
        "osm_name": t0.get("name"), "pin": [round(lat, 6), round(lng, 6)],
        "twin_m": None if twin is None else round(twin[0], 1),
        "twin_way": None if twin is None else twin[1],
    })

here = Path(__file__).parent
(here / "twin_sample.json").write_text(json.dumps(rows, indent=1) + "\n", encoding="utf-8", newline="\r\n")
lines = [f"{'road':40} {'expected':15} {'class':10} {'way':>11} {'twin':>9}  pin"]
for r in rows:
    if "way" not in r:
        lines.append(f"{r['name']:40} {r['expected']:15} -- {r['result']}")
        continue
    tw = "none" if r["twin_m"] is None else f"{r['twin_m']} m"
    lines.append(f"{(r['osm_name'] or r['name'])[:40]:40} {r['expected']:15} {r['highway']:10} {r['way']:>11} {tw:>9}  {r['pin'][0]}, {r['pin'][1]}")
(here / "twin_sample.txt").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\r\n")
print("\n".join(lines))
