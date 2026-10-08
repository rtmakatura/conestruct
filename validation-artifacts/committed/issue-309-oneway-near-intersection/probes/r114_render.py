"""#309 R114 -- before/after on the checkout named on the command line.

Plans (FastAPI TestClient, Overpass stubbed, MAPBOX_TOKEN empty in both
runs so both draw the same pages; no prod request):

  broadway   the near-intersection kind on N Broadway SB at E 11th Ave
             (39.73370, -104.98753): the checkpoint's repro body
             (ni_broadway_probe.py), with #308's carriageway facts for
             Broadway (oneway=yes, primary, no same-name twin, searched).
  two-way    the same body on a two-way road: carriageway oneway=no,
             residential (the facts the frontend now relays on every road).
             R112: "A two-way near-intersection plan stays byte-identical."
             The audit and the device breakdown are hashed as bytes.  The
             XLSX and the PDF carry a render time (the XLSX's generated
             stamp, a datetime cell; the PDF's metadata), so two renders of
             one body on one checkout differ in bytes: they are hashed as
             content instead (every XLSX cell but datetimes; each PDF
             page's text and its page-1 pixels).  The "after" run compares
             each hash to the "before" run's.

Run with the main .venv python:
    python r114_render.py <checkout-root> <before|after>
Writes r114_broadway_<tag>.png (page 1, 100 dpi) and r114_<tag>.txt beside
itself.
"""

from __future__ import annotations

import copy
import hashlib
import io
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
TAG = sys.argv[2]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
# Empty, not absent: src/_dotenv fills only unset keys.
os.environ["MAPBOX_TOKEN"] = ""
AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}

import datetime  # noqa: E402

import pypdfium2 as pdfium  # noqa: E402
from openpyxl import load_workbook  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pydantic import TypeAdapter  # noqa: E402

from src.api import render_api  # noqa: E402
from src.api.render_api import app  # noqa: E402
from src.api.schemas import Scenario, scenario_to_call  # noqa: E402
from src.narrative.crew_narrative import render_crew_narrative_markdown  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402
from src.rules.validators import scenario_display_name  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]

APPROACH = {
    "speed": 25,
    "roadType": "urban_arterial",
    "lanesPerDirection": 1,
    "laneWidth": 11.0,
    "signalized": True,
    "alongStationFt": -100.0,
}
BODY = {
    "kind": "near_intersection",
    "meta": {
        "project": "309 render",
        "address": "N Broadway SB at E 11th Ave",
        "lat": 39.73370,
        "lng": -104.98753,
        "bearingDeg": 0.0,
    },
    "roadType": "urban_arterial",
    "speed": 30,
    "lanes": 4,
    "laneWidth": 10.5,
    "divided": False,
    "workType": "utility_cut",
    "duration": "short",
    "workLen": 500.0,
    "night": False,
    "approaches": [{"id": "e11_wb", **APPROACH}, {"id": "e11_eb", **APPROACH}],
}
ONE_WAY = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None,
           "twinSearched": True, "confirmed": None}
TWO_WAY = {**ONE_WAY, "oneway": "no", "highwayClass": "residential"}

client = TestClient(app)
sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
lines = [f"HEAD {sha}  tag {TAG}  checkout {ROOT.name}", ""]

# --- Broadway, one-way ---------------------------------------------------------
body = {**copy.deepcopy(BODY), "carriageway": ONE_WAY}
r = client.post("/render/pdf", headers=AUTH, json=body)
lines.append(f"== broadway one-way: POST /render/pdf -> {r.status_code}")
pdf = pdfium.PdfDocument(io.BytesIO(r.content))
pdf[0].render(scale=100 / 72).to_pil().save(HERE / f"r114_broadway_{TAG}.png")
scenario = TypeAdapter(Scenario).validate_python(copy.deepcopy(body))
placements, params, *_ = render_api._placements_for(scenario)
lines.append(
    f"   one_way_street={getattr(params, 'one_way_street', None)}  devices={len(placements)}  "
    f"title={scenario_display_name(params)!r}"
)
for p in placements:
    if p.device_type.name == "SIGN_GENERIC" and p.approach_id == "mainline":
        lines.append(f"   mainline {p.label:<7} station {p.station_ft:8.1f}  offset {p.offset_ft:+6.1f} ft")
audit = client.post("/render/audit", headers=AUTH, json=body).json()
row = next(c for c in audit["sections"]["colorado"]["checks"] if "both sides" in c["label"])
lines.append(f"   Note 8 row: {json.dumps(row, ensure_ascii=False)}")
lines.append(f"   narrative: {audit['sections']['case']['narrative']}")
lines.append(f"   narrative_2: {audit['sections']['case']['narrative_2']}")
_, _, kwargs = scenario_to_call(scenario)
md = render_crew_narrative_markdown(placements, params, approaches=kwargs["approaches"])
lines.extend(f"   crew: {line}" for line in md.splitlines() if line.startswith("- One-way street"))
bd = client.post("/render/device-breakdown", headers=AUTH, json=body).json()["devices"]
lines.append("   breakdown: " + ", ".join(f"{d['code']} {d['qty']}" for d in bd if d.get("code")))
lines.append("")

# --- two-way control: byte hashes ----------------------------------------------
hashes = {}
lines.append("== two-way control (carriageway oneway=no): sha256 per surface")


def _content(path: str, raw: bytes) -> bytes:
    if path == "/render/xlsx":
        wb = load_workbook(io.BytesIO(raw))
        cells = [
            f"{ws.title}!{c.coordinate}={c.value!r}"
            for ws in wb
            for row in ws.iter_rows()
            for c in row
            if c.value is not None and not isinstance(c.value, datetime.datetime)
        ]
        return "\n".join(cells).encode("utf-8")
    if path == "/render/pdf":
        doc = pdfium.PdfDocument(io.BytesIO(raw))
        text = "\f".join(doc[i].get_textpage().get_text_range() for i in range(len(doc)))
        pixels = doc[0].render(scale=100 / 72).to_pil().tobytes()
        return text.encode("utf-8") + pixels
    return raw


for path in ("/render/audit", "/render/device-breakdown", "/render/xlsx", "/render/pdf"):
    rr = client.post(path, headers=AUTH, json={**copy.deepcopy(BODY), "carriageway": TWO_WAY})
    hashes[path] = hashlib.sha256(_content(path, rr.content)).hexdigest()
    kind = "content" if path in ("/render/xlsx", "/render/pdf") else "bytes"
    lines.append(f"   {path:<26} {rr.status_code} {kind:<7} {hashes[path]}")
(HERE / f"r114_twoway_hashes_{TAG}.json").write_text(json.dumps(hashes, indent=2) + "\n", encoding="utf-8")

if TAG == "after":
    before = HERE / "r114_twoway_hashes_before.json"
    if before.exists():
        b = json.loads(before.read_text(encoding="utf-8"))
        lines.append("")
        for path, h in hashes.items():
            kind = "content" if path in ("/render/xlsx", "/render/pdf") else "bytes"
            same = b.get(path) == h
            lines.append(f"   two-way {path}: {'identical to before' if same else 'CHANGED'} ({kind})")

out = HERE / f"r114_{TAG}.txt"
out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\r\n")
print("\n".join(lines))
