"""#301 checkpoint question (b) — what option (a), a static image, costs.

Replays the two prod-captured work-start scenarios (the exact bodies the
picker sent on prod after #290 shipped) through THIS branch's
``POST /render/pdf`` via FastAPI's TestClient, relaying the confirmed road's
geometry the way the site's proxy does (as issue-290-picker-draws/probes/
page2.py does).  ``httpx.get`` inside plan_sheet is wrapped so the Static
Images URL page 2 builds is captured — the overlay string is the page-2
overlay builder's own output (``_aerial_laid_out_overlays``), not a copy.

Then the SAME overlays are fetched again at candidate band sizes, three
times each, to measure latency and bytes.

    python static_cost.py > static-cost.txt

Needs ``MAPBOX_TOKEN`` (read from the repo root's .env if unset).  The token
is never printed or written: URLs are reported with it stripped.
"""

from __future__ import annotations

import json
import os
import re
import statistics
import sys
import time
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))

if not os.environ.get("MAPBOX_TOKEN"):
    for env in (ROOT / ".env", ROOT.parents[2] / ".env"):
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                if line.startswith("MAPBOX_TOKEN="):
                    os.environ["MAPBOX_TOKEN"] = line.split("=", 1)[1].strip().strip('"')
            if os.environ.get("MAPBOX_TOKEN"):
                break
if not os.environ.get("MAPBOX_TOKEN"):
    raise SystemExit("MAPBOX_TOKEN not found")

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import src.rendering.plan_sheet as ps  # noqa: E402
from src.api.render_api import app  # noqa: E402

FIXTURES = {
    "broadway-sb (shoulder, one-way, way 131232822)": ROOT
    / "validation-artifacts/committed/issue-290-picker-draws/prod-after/broadway-prod-after-sided-request.json",
    "lafayette (flagger, two approaches, way 581254411)": ROOT
    / "validation-artifacts/committed/issue-290-picker-draws/prod-after/lafayette-flagger-prod-after-sided-request.json",
}

# Candidate band image sizes (CSS px; fetched @2x like page 2).
SIZES = [("page-2 (1200x500@2x)", 1200, 500), ("band 1440 (600x250@2x)", 600, 250), ("band 380 (348x220@2x)", 348, 220)]

captured: list[str] = []
_real_get = httpx.get


def _spy_get(url, params=None, timeout=None, **kw):  # noqa: ANN001
    if "api.mapbox.com/styles" in str(url):
        captured.append(str(url))
    return _real_get(url, params=params, timeout=timeout, **kw)


ps.httpx.get = _spy_get  # type: ignore[attr-defined]

os.environ.setdefault("RENDER_API_SECRET", "static-cost-probe")
client = TestClient(app)
token = os.environ["MAPBOX_TOKEN"]

for name, path in FIXTURES.items():
    scenario = json.loads(path.read_text(encoding="utf-8"))["scenario"]
    meta = scenario["meta"]
    cand = meta["confirmedRoad"]["candidate"]
    meta["centerline"] = cand["geometry"]
    meta["roadDirection"] = {
        "osmBearingDeg": cand["bearing"] % 360,
        "oneway": (cand.get("tags") or {}).get("oneway"),
    }
    captured.clear()
    t0 = time.perf_counter()
    res = client.post(
        "/render/pdf",
        headers={"Authorization": f"Bearer {os.environ['RENDER_API_SECRET']}"},
        json=scenario,
    )
    pdf_ms = (time.perf_counter() - t0) * 1000
    print(f"== {name}")
    print(f"   /render/pdf {res.status_code} in {pdf_ms:.0f} ms (whole PDF, incl. one Mapbox fetch)")
    if not captured:
        print("   no Mapbox URL captured")
        continue
    url = captured[-1]
    m = re.match(r"(https://api\.mapbox\.com/styles/v1/mapbox/[^/]+/static/)(.*)/(auto|[-0-9.,]+)/(\d+)x(\d+)@2x$", url)
    assert m, url
    base, overlays, viewport = m.group(1), m.group(2), m.group(3)
    paths = overlays.split(",path-")
    print(f"   overlays: {len(paths)} paths, {len(overlays)} chars encoded "
          f"({len(unquote(overlays))} decoded); whole URL w/o token {len(url)} chars; "
          f"limit 8,192; page-2 guard {ps._AERIAL_URL_MAX_CHARS}")
    # Which thinning step fit: re-derive by counting points is not needed — say
    # whether the first (100-point) step already fit.
    print(f"   viewport {viewport}; padding {ps._LAID_OUT_PADDING_PX}")
    for label, w, h in SIZES:
        u = f"{base}{overlays}/{viewport}/{w}x{h}@2x"
        pad = ps._LAID_OUT_PADDING_PX if w >= 600 else 30
        times, sizes, status = [], [], []
        for _ in range(3):
            t = time.perf_counter()
            r = _real_get(u, params={"access_token": token, "padding": str(pad)}, timeout=30.0)
            times.append((time.perf_counter() - t) * 1000)
            sizes.append(len(r.content))
            status.append(r.status_code)
        print(f"   {label:24s} status {status} padding {pad}: "
              f"{statistics.median(times):.0f} ms median (runs {', '.join(f'{x:.0f}' for x in times)}), "
              f"{statistics.median(sizes) / 1024:.0f} KiB PNG, cache-control "
              f"{r.headers.get('cache-control')!r}, x-cache {r.headers.get('x-cache')!r}")
        if w == 600 or w == 348:
            out = Path(__file__).with_name(f"{name.split()[0]}-{w}x{h}.png")
            out.write_bytes(r.content)
