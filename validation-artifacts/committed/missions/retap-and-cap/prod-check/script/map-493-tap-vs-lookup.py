"""#493 production sample: one intersection NEEDS YOU map with the WHERE
tap's record (``meta.intersection.geometry``), then the same body without
``geometry``.  Records ``x-map-cross-source``, the other x-map headers and
the wall time of each.  n=1 each; two map renders in all.

The body is the one tests/test_needs_you_map.py builds for #493
(``colfax()`` + the committed fixture tests/fixtures/needs-you/
colfax-franklin-tap.json), sent straight to the backend's
POST /render/needs-you-map.  The bearer comes from MODAL_RENDER_SECRET in
the environment and is never printed.

Usage (worktree root):
    MODAL_RENDER_URL=... MODAL_RENDER_SECRET=... uv run --extra dev python \
        validation-artifacts/committed/missions/retap-and-cap/prod-check/script/map-493-tap-vs-lookup.py <png-dir>
"""

from __future__ import annotations

import copy
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[6]
sys.path.insert(0, str(ROOT))

from tests.test_needs_you_map import colfax, tap_record  # noqa: E402

out_dir = Path(sys.argv[1])
base = os.environ["MODAL_RENDER_URL"].rstrip("/")
auth = {"Authorization": f"Bearer {os.environ['MODAL_RENDER_SECRET']}"}

with_tap = colfax()
with_tap["meta"]["intersection"] = tap_record()
without = copy.deepcopy(with_tap)
without["meta"]["intersection"].pop("geometry")

HEADERS = ["x-map-cross-source", "x-map-subject", "x-map-cross-street", "x-map-frame", "x-map-point"]
results = {}
for label, scenario in (("with geometry", with_tap), ("without geometry", without)):
    body = {"scenario": scenario, "flag": "adjacent_intersection", "width": 800, "height": 400}
    t0 = time.perf_counter()
    r = requests.post(f"{base}/render/needs-you-map", json=body, headers=auth, timeout=90)
    wall = time.perf_counter() - t0
    heads = {h: r.headers.get(h) for h in HEADERS}
    print(f"{label}: status {r.status_code}, {len(r.content)} bytes, wall {wall:.2f} s")
    for h, v in heads.items():
        print(f"  {h}: {v}")
    if r.ok:
        name = "tap" if label == "with geometry" else "lookup"
        (out_dir / f"needs-you-map-{name}.png").write_bytes(r.content)
    results[label] = (r.status_code, heads.get("x-map-cross-source"), wall)

tap_ok = results["with geometry"][:2] == (200, "tap")
lookup_ok = results["without geometry"][:2] == (200, "lookup")
print(
    f"RESULT {'PASS' if tap_ok and lookup_ok else 'FAIL'}: with geometry -> "
    f"x-map-cross-source {results['with geometry'][1]} in {results['with geometry'][2]:.2f} s; "
    f"without -> {results['without geometry'][1]} in {results['without geometry'][2]:.2f} s (n=1 each)"
)
sys.exit(0 if tap_ok and lookup_ok else 1)
