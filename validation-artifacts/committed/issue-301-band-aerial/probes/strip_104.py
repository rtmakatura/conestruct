"""#301 checkpoint (c) — can S3's 104 px corridor strip reuse the band's framing?

Re-requests the Broadway and Lafayette overlays static_cost.py captured
(read back from static-cost's PNG run is not possible, so the overlays are
rebuilt the same way: /render/pdf with the Mapbox fetch spied) at
600x104@2x with ``auto`` framing, padding 60 and padding 10.

    python strip_104.py > strip-104.txt
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))
if not os.environ.get("MAPBOX_TOKEN"):
    for env in (ROOT / ".env", ROOT.parents[2] / ".env"):
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                if line.startswith("MAPBOX_TOKEN="):
                    os.environ["MAPBOX_TOKEN"] = line.split("=", 1)[1].strip().strip('"')
os.environ.setdefault("RENDER_API_SECRET", "strip-probe")

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import src.rendering.plan_sheet as ps  # noqa: E402
from src.api.render_api import app  # noqa: E402

urls: list[str] = []
real = httpx.get


def spy(url, params=None, timeout=None, **kw):  # noqa: ANN001
    urls.append(str(url))
    return real(url, params=params, timeout=timeout, **kw)


ps.httpx.get = spy  # type: ignore[attr-defined]
client = TestClient(app)
SRC = ROOT / "validation-artifacts/committed/issue-290-picker-draws/prod-after"
for name in ("broadway-prod-after", "lafayette-flagger-prod-after"):
    sc = json.loads((SRC / f"{name}-sided-request.json").read_text(encoding="utf-8"))["scenario"]
    cand = sc["meta"]["confirmedRoad"]["candidate"]
    sc["meta"]["centerline"] = cand["geometry"]
    sc["meta"]["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": (cand.get("tags") or {}).get("oneway")}
    urls.clear()
    client.post("/render/pdf", headers={"Authorization": f"Bearer {os.environ['RENDER_API_SECRET']}"}, json=sc)
    base = re.sub(r"/auto/\d+x\d+@2x$", "", urls[-1])
    for pad in (60, 10):
        r = real(f"{base}/auto/600x104@2x", params={"access_token": os.environ["MAPBOX_TOKEN"], "padding": str(pad)}, timeout=30.0)
        msg = r.json().get("message") if r.headers.get("content-type", "").startswith("application/json") else f"{len(r.content)} bytes PNG"
        print(f"{name:30s} 600x104 padding {pad:2d}: {r.status_code} {msg}")
        if r.status_code == 200:
            Path(__file__).with_name(f"{name.split('-')[0]}-strip-600x104-pad{pad}.png").write_bytes(r.content)
