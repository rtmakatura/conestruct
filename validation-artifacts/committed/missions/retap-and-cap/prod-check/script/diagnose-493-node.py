"""#493 diagnosis (no map render): run POST /render/needs-you-map in-process
on the same body as map-493-tap-vs-lookup.py, with LIVE Overpass reads and
Mapbox stubbed (no paid call), and print the crossing node the subject read
picked, the tap's distance to it, and what the tap and lookup paths return.

Usage (worktree root): uv run --extra dev python <this file>
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "diag-only"
os.environ["MAPBOX_TOKEN"] = "diag-stub"

from fastapi.testclient import TestClient  # noqa: E402

import src.api.render_api as api  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402
from tests.test_needs_you_map import PNG, colfax, tap_record  # noqa: E402


import httpx  # noqa: E402


class _Png:
    content = PNG

    def raise_for_status(self) -> None:
        return None


# Mapbox is the only httpx.get on this path (static_aerial); Overpass posts.
httpx.get = lambda *a, **k: _Png()  # type: ignore[assignment]

seen: dict[str, object] = {}
real_tap = api.tapped_cross_street
real_lookup = api.cross_street_geometry


def tap(tapped, name, geometry, node, bearing, road):  # type: ignore[no-untyped-def]
    out = real_tap(tapped, name, geometry, node, bearing, road)
    seen["node"] = node
    seen["tap_to_node_m"] = round(sd._haversine(tapped[0], tapped[1], node[0], node[1]), 1)
    seen["bearing"] = bearing
    seen["tap"] = None if out is None else out.name
    return out


def lookup(node, bearing, road):  # type: ignore[no-untyped-def]
    out = real_lookup(node, bearing, road)
    seen["lookup"] = None if out is None else out.name
    return out


api.tapped_cross_street = tap
api.cross_street_geometry = lookup

scenario = colfax()
scenario["meta"]["intersection"] = tap_record()
print("pin", scenario["meta"]["lat"], scenario["meta"]["lng"])
print("radius m", sd.CROSS_STREET_RADIUS_M)
client = TestClient(api.app)
secret = "diag-only"
r = client.post(
    "/render/needs-you-map",
    json={"scenario": scenario, "flag": "adjacent_intersection", "width": 800, "height": 400},
    headers={"Authorization": f"Bearer {secret}"},
)
print("status", r.status_code, "x-map-cross-source", r.headers.get("x-map-cross-source"),
      "x-map-subject", r.headers.get("x-map-subject"))
for k, v in seen.items():
    print(k, v)
