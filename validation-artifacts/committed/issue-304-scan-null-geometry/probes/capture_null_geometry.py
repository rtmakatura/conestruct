"""#304 investigate: capture the Overpass answer that crashes the scan.

Read-only.  Replays #243's Federal request (the body the site sent,
validation-artifacts/committed/issue-243-note-8/recheck-2f27be3/prod/
federal-audit-request.json) through the backend app at this checkout,
N times, with the Overpass fetch wrapped so every answer is kept:

  - which mirror answered, how long it took, its size;
  - every way whose ``geometry`` holds a null (or partial) point, with
    the point's index, the way's id/tags, and the way's node count.

Any answer with a null point is saved whole to
out/answer-<run>-<mirror host>.json, so the regression fixture can be cut
from a real response.  The audit's status and the error text (if any) are
printed per run.

  python capture_null_geometry.py [runs] > capture.txt
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding="utf-8")
os.environ["RENDER_API_SECRET"] = "probe"

from fastapi.testclient import TestClient  # noqa: E402

from src.api import render_api  # noqa: E402
from src.api import site_scan as ss  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

REQ = (
    ROOT
    / "validation-artifacts/committed/issue-243-note-8/recheck-2f27be3/prod/federal-audit-request.json"
)
OUT = HERE / "out"
_real = sd._overpass_request_with_fallback
_seen: list[dict] = []


def _bad_points(geometry: list) -> list[tuple[int, object]]:
    return [
        (i, pt)
        for i, pt in enumerate(geometry)
        if not isinstance(pt, dict) or pt.get("lat") is None or pt.get("lon") is None
    ]


def _wrapped(query, **kw):
    meta = kw.setdefault("meta", {})
    t0 = time.time()
    payload, error = _real(query, **kw)
    (OUT / "federal-folded-query.txt").write_text(query, "utf-8")
    rec = {
        "mirror": meta.get("mirror"),
        "seconds": round(time.time() - t0, 1),
        "bytes": meta.get("response_bytes"),
        "error": error,
        "folded": ".road out geom tags" in query,
        "payload": payload,
    }
    _seen.append(rec)
    return payload, error


def main() -> None:
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    OUT.mkdir(exist_ok=True)
    body = json.loads(REQ.read_text("utf-8"))["scenario"]
    print(f"request: {REQ.name}; confirmedRoad {body['meta'].get('confirmedRoad')}; "
          f"lat,lng {body['meta']['lat']},{body['meta']['lng']}")
    sd._overpass_request_with_fallback = _wrapped
    client = TestClient(render_api.app, raise_server_exceptions=False)
    for run in range(1, runs + 1):
        ss.clear_memo()
        _seen.clear()
        t0 = time.time()
        r = client.post("/render/audit", json=body, headers={"Authorization": "Bearer probe"})
        print(f"\n== run {run}: HTTP {r.status_code} in {time.time() - t0:.1f} s")
        if r.status_code != 200:
            print(f"   body: {r.text[:200]}")
        else:
            scan = r.json()["sections"]["site_scan"]
            print(f"   scan {scan['status']} mirror {scan.get('mirror')}")
        for k, rec in enumerate(_seen):
            p = rec["payload"] or {}
            els = p.get("elements") or []
            geo_ways = [e for e in els if e.get("type") == "way" and "geometry" in e]
            print(f"   fetch {k}: mirror {rec['mirror']} {rec['seconds']} s {rec['bytes']} B "
                  f"folded={rec['folded']} error={rec['error']!r} elements={len(els)} "
                  f"ways-with-geometry={len(geo_ways)} remark={p.get('remark')!r}")
            bad = []
            for e in geo_ways:
                pts = _bad_points(e["geometry"])
                if pts:
                    bad.append(e)
                    print(f"     way {e.get('id')} {e.get('tags', {}).get('highway')} "
                          f"{e.get('tags', {}).get('name')!r}: {len(pts)} bad of "
                          f"{len(e['geometry'])} points, first at {pts[0][0]} = {pts[0][1]!r}; "
                          f"nodes listed {len(e.get('nodes') or [])}")
            if bad:
                host = urlsplit(rec["mirror"] or "none").hostname or "none"
                path = OUT / f"answer-{run}-{k}-{host}.json"
                path.write_text(json.dumps(p, ensure_ascii=False), "utf-8")
                print(f"     saved {path.name}")


if __name__ == "__main__":
    main()
