"""#285: record the Overpass answers the unit tests replay.

    python rec285.py <fixture_dir>

For each case: the shared-node answer at the CHOSEN 1700 m (the query
src/rules/nearest_intersection.py will send), and the confirmed road's
own ways with geometry, stitched nearest-first into the centerline the
picker would relay.  Saved raw, with the pin and the road key.
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, r"C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-295-stale-ink")
from src.rules.site_detection import _overpass_request_with_fallback  # noqa: E402

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
VEHICULAR = (
    "motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|"
    "tertiary|tertiary_link|unclassified|residential|living_street"
)
CASES = {
    "broadway": (39.73370, -104.98753, "name", "North Broadway"),
    "us24_hartsel": (39.021746, -105.792864, "ref", "US 24"),
    "us287_lamar": (38.115797, -102.621192, "ref", "US 50;US 287"),
    "boulder_canyon": (40.001853, -105.412893, "name", "Boulder Canyon Drive"),
    "lookout": (39.7423111, -105.2392485, "name", "Lookout Mountain Road"),
}


def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')


def shared(lat, lng, key, value, radius=1700):
    return (
        "[out:json][timeout:15];"
        f'way(around:{radius},{lat},{lng})[highway~"^({VEHICULAR})$"]["{key}"="{esc(value)}"]->.road;'
        "node(w.road)->.rn;"
        f'way(bn.rn)[highway~"^({VEHICULAR})$"][~"^(name|ref)$"~"."]->.touch;'
        "(.touch; - .road;)->.cross;"
        "node(w.cross)->.cn;"
        "node.rn.cn->.shared;"
        ".cross out body;"
        ".shared out skel;"
    )


def road_geom(lat, lng, key, value):
    return (
        "[out:json][timeout:15];"
        f'way(around:1700,{lat},{lng})[highway~"^({VEHICULAR})$"]["{key}"="{esc(value)}"];'
        "out geom;"
    )


def hav(a, b):
    r = 6371008.8
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def stitch(ways, pin):
    """Chain ways end to end from the one nearest the pin (the picker's
    same-name stitch, simplified: endpoints that coincide are joined)."""
    segs = [[(p["lat"], p["lon"]) for p in w["geometry"] if p] for w in ways]
    segs = [s for s in segs if len(s) >= 2]
    if not segs:
        return []
    start = min(segs, key=lambda s: min(hav(pin, p) for p in s))
    line = list(start)
    segs.remove(start)
    grown = True
    while grown:
        grown = False
        for s in list(segs):
            for cand in (s, s[::-1]):
                if hav(line[-1], cand[0]) < 1.0:
                    line += cand[1:]
                elif hav(line[0], cand[-1]) < 1.0:
                    line = cand[:-1] + line
                else:
                    continue
                segs.remove(s)
                grown = True
                break
    return line


for name, (lat, lng, key, value) in CASES.items():
    a, err = _overpass_request_with_fallback(shared(lat, lng, key, value), budget_s=25)
    b, err2 = _overpass_request_with_fallback(road_geom(lat, lng, key, value), budget_s=25)
    if a is None or b is None:
        print(name, "REFUSED", err or err2)
        continue
    centerline = stitch(b["elements"], (lat, lng))
    doc = {
        "_provenance": f"#285 rec285.py: overpass answer recorded 2026-10-14 for the {name} pin "
        f"(shared-node query at 1700 m, road {key}={value!r}); centerline stitched from the road's own ways.",
        "pin": [lat, lng],
        "road": {key: value},
        "centerline": [list(p) for p in centerline],
        "overpass": a,
    }
    (OUT / f"{name}.json").write_text(json.dumps(doc, indent=1), encoding="utf-8")
    print(name, len(a.get("elements", [])), "elements;", len(centerline), "centerline points")
