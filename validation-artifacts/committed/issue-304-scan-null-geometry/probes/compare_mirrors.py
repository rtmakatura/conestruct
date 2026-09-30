"""#304 investigate: the same folded query, straight to the primary and the fallback mirror.

Read-only.  Posts out/federal-folded-query.txt (the exact query the scan
sent for #243's Federal pin, saved by capture_null_geometry.py) to
overpass-api.de and overpass.openstreetmap.fr, then compares the two
answers: element ids per half (scan / road), ways carrying a null point,
and the data timestamp each mirror reports.

  python compare_mirrors.py > compare.txt
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
sys.stdout.reconfigure(encoding="utf-8")
MIRRORS = ("https://overpass-api.de/api/interpreter", "https://overpass.openstreetmap.fr/api/interpreter")


def halves(p):
    els = p.get("elements") or []
    road = {e["id"]: e for e in els if e.get("geometry")}
    scan = {(e["type"], e["id"]): e for e in els if not e.get("geometry")}
    return scan, road


def main() -> None:
    q = (HERE / "out/federal-folded-query.txt").read_text("utf-8")
    got = {}
    for m in MIRRORS:
        t0 = time.time()
        r = httpx.post(m, data={"data": q}, timeout=60, headers={"User-Agent": "conestruct-304-probe"})
        p = r.json()
        got[m] = p
        scan, road = halves(p)
        nulls = {i: [k for k, x in enumerate(w["geometry"]) if x is None] for i, w in road.items()}
        nulls = {i: v for i, v in nulls.items() if v}
        print(f"{m}: HTTP {r.status_code} {time.time() - t0:.1f} s; osm_base "
              f"{p.get('osm3s', {}).get('timestamp_osm_base')}; scan {len(scan)}; road {len(road)}; "
              f"ways with null points {nulls}")
    (a_scan, a_road), (b_scan, b_road) = (halves(got[m]) for m in MIRRORS)
    print(f"\nscan half: only on primary {sorted(a_scan.keys() - b_scan.keys())}; "
          f"only on fallback {sorted(b_scan.keys() - a_scan.keys())}")
    same = sum(1 for k in a_scan.keys() & b_scan.keys() if a_scan[k] == b_scan[k])
    print(f"scan half: {same} of {len(a_scan.keys() & b_scan.keys())} shared elements identical")
    print(f"road half: only on primary {sorted(a_road.keys() - b_road.keys())}; "
          f"only on fallback {sorted(b_road.keys() - a_road.keys())}")
    for i in sorted(b_road.keys() - a_road.keys()):
        w = b_road[i]
        print(f"  fallback-only way {i}: {w.get('tags', {}).get('highway')} "
              f"{w.get('tags', {}).get('name')!r} bounds {w.get('bounds')}")
    for m in MIRRORS:
        host = m.split("/")[2]
        (HERE / f"out/folded-{host}.json").write_text(json.dumps(got[m], ensure_ascii=False), "utf-8")


if __name__ == "__main__":
    main()
