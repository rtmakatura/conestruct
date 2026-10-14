"""#299: today's north-up scan box vs. a road-following strip, on the live mirrors.

python probe299.py <worktree> <outdir> [N]

Two corridors at a 45-degree bearing in central Denver (39.7392, -104.9903),
built with the backend's own corridor code: a 45 mph shoulder plan, and a
rural 45 mph flagger at #290's both-approach extent.  For each: the scan query
as the backend builds it today (`_build_bbox_query`, the box padded 100 m
lateral / 152.4 m longitudinal) and the same query with each `(box)` filter
replaced by `(around:100, <centerline>)`, the centerline extended 152.4 m past
each end (the same two pads).  Each query is POSTed to both live mirrors, N
times, alternating shape and mirror, spaced so neither mirror is asked twice at
once.  Recorded per request: seconds, bytes, element count, HTTP status.  And
the coverage check: every element the box returns whose center lies within the
strip (100 m lateral of the extended line) must also come back from the strip.
"""
import json
import math
import sys
import time
from pathlib import Path

W, OUT = sys.argv[1], Path(sys.argv[2])
N = int(sys.argv[3]) if len(sys.argv) > 3 else 20
sys.path.insert(0, W)
OUT.mkdir(parents=True, exist_ok=True)

import httpx  # noqa: E402

from src.api.schemas import _map_road_type  # noqa: E402
from src.rules.corridor import WorkCorridor, build_corridor  # noqa: E402
from src.rules.site_detection import (  # noqa: E402
    _CORRIDOR_LATERAL_BUFFER_M as LAT,
    _CORRIDOR_LONGITUDINAL_BUFFER_M as LON,
    OVERPASS_MIRRORS,
    _build_bbox_query,
)

FT_PER_M = 1 / 0.3048
LAT0, LNG0, BRG = 39.7392, -104.9903, 45.0


def corridors():
    sh = build_corridor(LAT0, LNG0, BRG, 45, 1000, "shoulder",
                        road_type=_map_road_type("urban_arterial", 45), shoulder_width_ft=8.0,
                        downstream_taper_use_max=True)
    fl = build_corridor(LAT0, LNG0, 0.0, 45, 400, "lane",
                        road_type=_map_road_type("rural_undivided", 45), shoulder_width_ft=8.0,
                        downstream_taper_use_max=True)
    approach = fl.advance_warning_ft + fl.taper_ft + fl.buffer_ft
    fl2 = WorkCorridor(LAT0, LNG0, "x", BRG, advance_warning_ft=2 * approach + 400, taper_ft=0,
                       buffer_ft=0, work_zone_ft=0, downstream_taper_ft=0)
    return {"shoulder-45mph": sh, "flagger-rural-45mph-both-approaches": fl2}


def strip_query(box_q: str, c: WorkCorridor) -> tuple[str, list[tuple[float, float]]]:
    lo = -LON * FT_PER_M
    hi = c.total_length_ft + LON * FT_PER_M
    pts = [c.point_at_station_ft(lo), c.point_at_station_ft(hi)]
    line = ",".join(f"{la:.6f},{lo_:.6f}" for la, lo_ in pts)
    s, w, n, e = c.corridor_bbox(lateral_buffer_m=LAT, longitudinal_buffer_m=LON)
    box = f"{s:.6f},{w:.6f},{n:.6f},{e:.6f}"
    return box_q.replace(f"({box})", f"(around:{LAT:g},{line})"), pts


def to_xy(lat, lng):
    k = 111_320.0
    return (lng - LNG0) * k * math.cos(math.radians(LAT0)), (lat - LAT0) * k


def in_strip(el, pts) -> bool:
    c = el.get("center") or {"lat": el.get("lat"), "lon": el.get("lon")}
    if c.get("lat") is None:
        return False
    px, py = to_xy(c["lat"], c["lon"])
    (ax, ay), (bx, by) = to_xy(*pts[0]), to_xy(*pts[1])
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= LAT


def post(url, q):
    t0 = time.perf_counter()
    try:
        r = httpx.post(url, data={"data": q}, timeout=httpx.Timeout(30.0, connect=5.0),
                       headers={"User-Agent": "conestruct-probe-299"})
        dt = time.perf_counter() - t0
        body = r.content
        els = None
        if r.status_code == 200:
            try:
                els = json.loads(body).get("elements")
            except ValueError:
                els = None
        return {"status": r.status_code, "s": round(dt, 2), "bytes": len(body), "elements": els}
    except Exception as e:  # noqa: BLE001
        return {"status": f"error: {type(e).__name__}", "s": round(time.perf_counter() - t0, 2),
                "bytes": 0, "elements": None}


rows = []
cov = {}
for name, c in corridors().items():
    s, w, n, e = c.corridor_bbox(lateral_buffer_m=LAT, longitudinal_buffer_m=LON)
    box_q = _build_bbox_query((s, w, n, e))
    sq, pts = strip_query(box_q, c)
    assert sq != box_q, "the strip replaced no box filter"
    (OUT / f"{name}.box.overpassql").write_text(box_q, encoding="utf-8")
    (OUT / f"{name}.strip.overpassql").write_text(sq, encoding="utf-8")
    for i in range(N):
        for url in OVERPASS_MIRRORS:
            for shape, q in (("box", box_q), ("strip", sq)) if i % 2 == 0 else (("strip", sq), ("box", box_q)):
                res = post(url, q)
                els = res.pop("elements")
                row = {"case": name, "i": i, "mirror": url.split("/")[2], "shape": shape,
                       **res, "count": len(els) if els is not None else None}
                rows.append(row)
                if els is not None:
                    cov.setdefault((name, shape), set()).update(
                        (x["type"], x["id"]) for x in els if shape == "strip" or in_strip(x, pts))
                print(json.dumps(row), flush=True)
                time.sleep(2.0)
(OUT / "rows.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
for name in corridors():
    box_ids, strip_ids = cov.get((name, "box"), set()), cov.get((name, "strip"), set())
    missing = box_ids - strip_ids
    print(f"COVERAGE {name}: box elements inside the strip {len(box_ids)}, strip elements "
          f"{len(strip_ids)}, box-in-strip missing from strip {len(missing)}")
