"""#300 build — Broadway SB, left and right shoulder plans through the real API.

N Broadway SB (39.7337, -104.98753), the #308 carriageway facts relayed as
the site relays them for a one-way candidate (``repro_broadway_r2.py``).
For each side, through FastAPI's TestClient on THIS checkout (Overpass
stubbed, no network, no prod request): the side options, the placements'
sign labels and offsets, the audit's Note 8 row / Case 11 words / pending
items, the crew sheet's side lines, and page 1 as a PNG.

Run from the repo root:
  python validation-artifacts/committed/issue-300-left-side-oneway/probes/capture_left.py <tag>
Writes ``<tag>/`` beside itself: ``summary.txt``, ``<side>-page1.png``.
"""

from __future__ import annotations

import copy
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}

import fitz  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pydantic import TypeAdapter  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.api.schemas import Scenario, scenario_to_call  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402
from src.rules.devices import DeviceType  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]

tag = sys.argv[1]
out = Path(__file__).with_name(tag)
out.mkdir(exist_ok=True)

base = json.loads((ROOT / "tests/fixtures/corridor/broadway-sb.json").read_text(encoding="utf-8"))
meta = base["meta"]
cand = meta["confirmedRoad"]["candidate"]
meta["centerline"] = cand["geometry"]
meta["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": cand["tags"]["oneway"]}
meta.pop("work", None)
base["carriageway"] = {
    "oneway": "yes",
    "highwayClass": "primary",
    "twinDistanceM": None,
    "twinSearched": True,
}
base["divided"] = False

client = TestClient(app)
sha = subprocess.run(
    ["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT
).stdout.strip()
lines = [f"HEAD {sha}", ""]

r = client.post("/render/corridor-geometry", headers=AUTH, json=base)
opts = r.json().get("side_options", []) if r.status_code == 200 else []
lines.append(f"side options ({r.status_code}):")
for o in opts:
    lines.append(f"  {o['label']!r}  work={o['work']}")
lines.append("")

for side in ("right", "left"):
    body = copy.deepcopy(base)
    body["meta"]["work"] = {"side": side, "travel": "with_geometry"}
    params, generator, kwargs = scenario_to_call(TypeAdapter(Scenario).validate_python(body))
    plan = generator(params, **kwargs)
    signs = sorted(
        (p.label, round(p.offset_ft, 2)) for p in plan if p.device_type == DeviceType.SIGN_GENERIC
    )
    lines.append(f"[{side}] work_side={params.work_side} generator={generator.__name__}")
    lines.append(f"[{side}] signs (label, offset_ft): {signs}")
    lines.append(f"[{side}] all offsets: {sorted(round(p.offset_ft, 2) for p in plan)}")

    a = client.post("/render/audit", headers=AUTH, json=body).json()
    rows = [
        row
        for sec in a.get("sections", {}).values()
        if isinstance(sec, dict)
        for row in (sec.get("checks") or sec.get("rows") or [])
        if isinstance(row, dict) and "both sides" in str(row.get("label", ""))
    ]
    for row in rows:
        lines.append(f"[{side}] Note 8 row: {row.get('label')!r} -> {row.get('detail')!r}")
    taper = a.get("sections", {}).get("taper", {})
    lines.append(f"[{side}] taper cdot_reference: {taper.get('cdot_reference')!r}")
    for item in a.get("pending_verification", {}).get("items", []):
        lines.append(f"[{side}] pending: {item.get('kind')}: {item.get('label')}")

    md = client.post("/render/markdown", headers=AUTH, json=body).text
    for ln in md.splitlines():
        if any(k in ln for k in ("side of road", "lane edge at", "Offsets are measured", "side.")):
            lines.append(f"[{side}] crew: {ln.strip()[:300]}")

    pdf = client.post("/render/pdf", headers=AUTH, json=body)
    lines.append(f"[{side}] pdf -> {pdf.status_code}")
    if pdf.status_code == 200:
        page = fitz.open(stream=pdf.content, filetype="pdf")[0]
        page.get_pixmap(dpi=110).save(out / f"{side}-page1.png")
    lines.append("")

(out / "summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\r\n")
print("\n".join(lines))
