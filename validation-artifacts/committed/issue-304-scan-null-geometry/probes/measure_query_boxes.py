"""#304 / R60 (d): how far do real elements sit from their own query box?

Read-only.  For every real Overpass answer on hand, each element is placed
against the box its half of the query asked for:

  - scan half (``out center tags``): the node's point or the way's
    ``center`` against the scan bbox;
  - road half (``out geom tags``): the way's ``bounds`` (else the bbox of
    its resolvable points) against the ``around:`` circle's bounding box.

It prints, per answer and per half, how many elements lie outside and the
largest distance outside (m).  A rule for (d) must keep every element of
a correct answer and drop the stray Kazakh way.

Answers:
  federal-primary   probes/out/folded-overpass-api.de.json      (query: probes/out/federal-folded-query.txt)
  federal-fallback  probes/out/folded-overpass.openstreetmap.fr.json (same query)
  lakewood          tests/fixtures/site_scan/lakewood_overpass.json (scan half only; bbox from its .meta.json)

  python measure_query_boxes.py > query-boxes.txt
"""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.stdout.reconfigure(encoding="utf-8")


def outside_m(lat, lon, box):
    """Metres from (lat, lon) to the box (0 inside).  box = (s, w, n, e)."""
    s, w, n, e = box
    clat = min(max(lat, s), n)
    clon = min(max(lon, w), e)
    dlat = (lat - clat) * 111_320.0
    dlon = (lon - clon) * 111_320.0 * math.cos(math.radians(clat))
    return math.hypot(dlat, dlon)


def box_gap_m(b, box):
    """Metres between two boxes (0 when they overlap).  b, box = (s, w, n, e)."""
    s, w, n, e = b
    S, W, N, E = box
    dlat = max(0.0, S - n, s - N) * 111_320.0
    mid = math.radians((max(s, S) + min(n, N)) / 2)
    dlon = max(0.0, W - e, w - E) * 111_320.0 * math.cos(mid)
    return math.hypot(dlat, dlon)


def coord(el):
    if el.get("lat") is not None and el.get("lon") is not None:
        return el["lat"], el["lon"]
    c = el.get("center") or {}
    if c.get("lat") is not None and c.get("lon") is not None:
        return c["lat"], c["lon"]
    return None


def way_box(el):
    b = el.get("bounds")
    if b:
        return b["minlat"], b["minlon"], b["maxlat"], b["maxlon"]
    pts = [p for p in el.get("geometry") or [] if isinstance(p, dict) and p.get("lat") is not None]
    if not pts:
        return None
    return (min(p["lat"] for p in pts), min(p["lon"] for p in pts),
            max(p["lat"] for p in pts), max(p["lon"] for p in pts))


def report(name, elements, scan_boxes, road_circle):
    scan = [e for e in elements if not e.get("geometry")]
    road = [e for e in elements if e.get("geometry")]
    d_scan = []
    for e in scan:
        c = coord(e)
        if c is None:
            continue
        d_scan.append((min(outside_m(c[0], c[1], b) for b in scan_boxes), e))
    out_scan = [(d, e) for d, e in d_scan if d > 0]
    print(f"\n== {name}: scan {len(scan)} elements; outside the scan box: {len(out_scan)}; "
          f"largest {max((d for d, _ in d_scan), default=0):,.0f} m")
    for d, e in sorted(out_scan, key=lambda x: -x[0])[:6]:
        print(f"   {d:>10,.0f} m  {e['type']} {e['id']} {e.get('tags', {}).get('highway') or e.get('tags', {}).get('amenity')} "
              f"{e.get('tags', {}).get('name')!r} {'center' if 'center' in e else 'point'}")
    if road_circle is None:
        return
    lat, lng, r = road_circle
    dlat = r / 111_320.0
    dlng = r / (111_320.0 * math.cos(math.radians(lat)))
    circle_box = (lat - dlat, lng - dlng, lat + dlat, lng + dlng)
    gaps = [(box_gap_m(wb, circle_box), e) for e in road if (wb := way_box(e))]
    print(f"   road {len(road)} ways; bounds not meeting the around-circle's box: "
          f"{sum(1 for g, _ in gaps if g > 0)}")
    for g, e in sorted(gaps, key=lambda x: -x[0]):
        print(f"   {g:>12,.0f} m  way {e['id']} {e.get('tags', {}).get('highway')} {e.get('tags', {}).get('name')!r}")


def main() -> None:
    q = (HERE / "out/federal-folded-query.txt").read_text("utf-8")
    boxes = [tuple(float(x) for x in m.split(","))
             for m in sorted(set(re.findall(r"\(([-\d.]+,[-\d.]+,[-\d.]+,[-\d.]+)\)", q)))]
    r, lat, lng = (float(x) for x in re.search(r"around:([\d.]+),([-\d.]+),([-\d.]+)", q).groups())
    road_circle = (lat, lng, r)
    print(f"federal query: scan boxes {boxes}; around radius {r} m at {lat},{lng}")
    for name, f in (("federal-primary", "out/folded-overpass-api.de.json"),
                    ("federal-fallback", "out/folded-overpass.openstreetmap.fr.json")):
        report(name, json.loads((HERE / f).read_text("utf-8"))["elements"], boxes, road_circle)
    meta = json.loads((ROOT / "tests/fixtures/site_scan/lakewood_overpass.meta.json").read_text("utf-8"))
    lw = json.loads((ROOT / "tests/fixtures/site_scan/lakewood_overpass.json").read_text("utf-8"))
    report("lakewood (recorded fixture)", lw["elements"], [tuple(meta["bbox"])], None)


if __name__ == "__main__":
    main()
