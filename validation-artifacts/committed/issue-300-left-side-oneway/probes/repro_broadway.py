"""#300 checkpoint — reproduce "left-side work can't be planned" on N Broadway SB.

The pin is the #290 evidence sweep's shoulder pin, captured as
``tests/fixtures/corridor/broadway-sb.json`` (39.7337, -104.98753, OSM way
131232822, oneway=yes, detected ``divided: true``).  Through FastAPI's
TestClient on THIS checkout (Overpass stubbed, zero network), it records:

  1. ``POST /render/corridor-geometry`` with no side: the side options offered.
  2. The same with ``meta.work.side = "left"`` on the legal direction: the answer.
  3. ``POST /render/pdf`` with ``side = "left"``: the answer.
  4. Control: ``side = "right"`` on the legal direction: laid out.

Run from the repo root:  python validation-artifacts/committed/issue-300-left-side-oneway/probes/repro_broadway.py
It writes ``repro_broadway.txt`` beside itself.  No prod request is made.
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

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]

base = json.loads((ROOT / "tests/fixtures/corridor/broadway-sb.json").read_text(encoding="utf-8"))
meta = base["meta"]
cand = meta["confirmedRoad"]["candidate"]
# Relay the confirmed road the way the site's proxy does
# (lib/scenarios/centerline-relay.ts), as the #290 page-2 probe did.
meta["centerline"] = cand["geometry"]
meta["roadDirection"] = {
    "osmBearingDeg": cand["bearing"] % 360,
    "oneway": (cand.get("tags") or {}).get("oneway"),
}
meta.pop("work", None)

client = TestClient(app)
sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
lines = [
    f"HEAD {sha}",
    f"pin {meta['lat']}, {meta['lng']}  way {cand.get('way_id')}  oneway={meta['roadDirection']['oneway']}  "
    f"divided={base['divided']}  kind={base['kind']}  lanes={base['lanes']}  speed={base['speed']}",
    "",
]


def post(path: str, body: dict) -> tuple[int, str]:
    r = client.post(path, headers=AUTH, json=body)
    return r.status_code, r.text


code, text = post("/render/corridor-geometry", base)
opts = json.loads(text).get("side_options", []) if code == 200 else []
lines.append(f"1. corridor-geometry, no side -> {code} status={json.loads(text).get('status') if code == 200 else '-'}")
for o in opts:
    lines.append(f"   offered: {o['label']!r}  work={o['work']}  built={o['built']}")
legal = next((o["work"]["travel"] for o in opts if "travel" in o["work"]), None)
lines.append("")

for n, path, side in ((2, "/render/corridor-geometry", "left"), (3, "/render/pdf", "left"), (4, "/render/corridor-geometry", "right")):
    body = copy.deepcopy(base)
    body["meta"]["work"] = {"side": side, "travel": legal}
    code, text = post(path, body)
    if code == 200 and path.endswith("geometry"):
        g = json.loads(text)
        summary = f"status={g.get('status')} approaches={len(g.get('approaches', []))}"
    elif code == 200:
        summary = f"{len(text)} bytes"
    else:
        summary = text[:300]
    lines.append(f"{n}. {path} side={side} travel={legal} -> {code}  {summary}")

out = Path(__file__).with_name("repro_broadway.txt")
out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\r\n")
print("\n".join(lines))
