"""#300 build checkpoint — the Broadway repro re-run on main ``aa6dcaa`` (after #308).

Same pin and steps as ``repro_broadway.py``, with one change: the shoulder
scenario relays #308's raw carriageway facts the way the site does for a
one-way candidate (``lib/scenarios/auto-apply.ts``; the backend decides in
``src/rules/carriageway.py``), so the backend reads N Broadway as a one-way
STREET, not one side of a divided road.  ``divided`` is sent as the mirror
sends it for that verdict (False).

  1. ``POST /render/corridor-geometry`` with no side: the side options offered.
  2. The same with ``meta.work.side = "left"`` on the legal direction.
  3. ``POST /render/pdf`` with ``side = "left"``.
  4. Control: ``side = "right"`` on corridor-geometry (laid out) and on
     ``/render/pdf`` (generates).

Run from the repo root:  python validation-artifacts/committed/issue-300-left-side-oneway/probes/repro_broadway_r2.py
It writes ``repro_broadway_r2.txt`` beside itself.  Overpass stubbed; no prod request.
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
meta["centerline"] = cand["geometry"]
meta["roadDirection"] = {
    "osmBearingDeg": cand["bearing"] % 360,
    "oneway": (cand.get("tags") or {}).get("oneway"),
}
meta.pop("work", None)
# #308: the raw facts for a one-way candidate.  No same-name twin within
# 100 m (N Broadway's pair is Lincoln St), search ran.
base["carriageway"] = {
    "oneway": (cand.get("tags") or {}).get("oneway"),
    "highwayClass": (cand.get("tags") or {}).get("highway", "primary"),
    "twinDistanceM": None,
    "twinSearched": True,
}
base["divided"] = False

client = TestClient(app)
sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
lines = [
    f"HEAD {sha}",
    f"pin {meta['lat']}, {meta['lng']}  way {cand.get('way_id')}  oneway={meta['roadDirection']['oneway']}  "
    f"carriageway={base['carriageway']}  divided={base['divided']}  kind={base['kind']}  "
    f"lanes={base['lanes']}  speed={base['speed']}",
    "",
]


def post(path: str, body: dict) -> tuple[int, str, bytes]:
    r = client.post(path, headers=AUTH, json=body)
    return r.status_code, r.text if "json" in r.headers.get("content-type", "") else "", r.content


code, text, _ = post("/render/corridor-geometry", base)
g0 = json.loads(text) if code == 200 else {}
opts = g0.get("side_options", [])
lines.append(f"1. corridor-geometry, no side -> {code} status={g0.get('status', '-')}")
for o in opts:
    lines.append(f"   offered: {o['label']!r}  work={o['work']}  built={o['built']}")
legal = next((o["work"]["travel"] for o in opts if "travel" in o["work"]), None)
lines.append("")

steps = (
    (2, "/render/corridor-geometry", "left"),
    (3, "/render/pdf", "left"),
    (4, "/render/corridor-geometry", "right"),
    (5, "/render/pdf", "right"),
)
for n, path, side in steps:
    body = copy.deepcopy(base)
    body["meta"]["work"] = {"side": side, "travel": legal}
    code, text, raw = post(path, body)
    if code == 200 and path.endswith("geometry"):
        g = json.loads(text)
        summary = f"status={g.get('status')} approaches={len(g.get('approaches', []))}"
    elif code == 200:
        summary = f"PDF {len(raw)} bytes, starts {raw[:5]!r}"
    else:
        summary = text[:300]
    lines.append(f"{n}. {path} side={side} travel={legal} -> {code}  {summary}")

out = Path(__file__).with_name("repro_broadway_r2.txt")
out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\r\n")
print("\n".join(lines))
