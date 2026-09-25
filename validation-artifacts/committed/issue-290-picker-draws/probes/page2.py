"""#290 checkpoint (k) commit 7 — render PDF page 2 for a captured scenario.

Replays a scenario the prod probe captured (``*-sided-request.json``, the
exact body the picker sent) through THIS branch's ``POST /render/pdf`` via
FastAPI's TestClient, relaying the confirmed road's geometry the way the
site's proxy does (lib/scenarios/centerline-relay.ts: ``meta.centerline``
and ``meta.roadDirection``), and rasterises page 2 to PNG.

    python page2.py <request.json> <kind: shoulder|flagger_lane_closure> <out-prefix>

Needs ``MAPBOX_TOKEN`` in the environment (the server token; never written
to disk by this script — the PDF carries the image, not the URL).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402

req_path, kind, out_prefix = sys.argv[1], sys.argv[2], sys.argv[3]
scenario = json.loads(Path(req_path).read_text(encoding="utf-8"))["scenario"]
meta = scenario["meta"]
cand = meta["confirmedRoad"]["candidate"]
meta["centerline"] = cand["geometry"]
meta["roadDirection"] = {
    "osmBearingDeg": cand["bearing"] % 360,
    "oneway": (cand.get("tags") or {}).get("oneway"),
}
if scenario["kind"] != kind:
    raise SystemExit(f"captured kind {scenario['kind']} != {kind}")

os.environ.setdefault("RENDER_API_SECRET", "page2-local")
client = TestClient(app)
res = client.post(
    "/render/pdf",
    headers={"Authorization": f"Bearer {os.environ['RENDER_API_SECRET']}"},
    json=scenario,
)
print("status", res.status_code, res.headers.get("content-type"))
if res.status_code != 200:
    print(res.text[:600])
    raise SystemExit(1)
pdf_path = Path(f"{out_prefix}.pdf")
pdf_path.write_bytes(res.content)
doc = pdfium.PdfDocument(str(pdf_path))
print("pages", len(doc))
page = doc[1]
page.render(scale=1.6).to_pil().save(f"{out_prefix}-page2.png")
print(page.get_textpage().get_text_range()[:1500])
