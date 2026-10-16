"""#332 evidence: page 1 of US 24 near Hartsel, before (what the site sent:
divided by class, no facts) and after (the facts the site relays after
#332), rendered locally with the network stubbed.

Run from the worktree root:  python -B validation-artifacts/committed/issue-332-trunk-twoway/render332.py
"""

from __future__ import annotations

import copy
import json
import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())
os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api import render_api  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

sd._overpass_request_with_fallback = lambda *a, **k: ({"elements": []}, None)  # type: ignore[assignment]
HERE = Path(__file__).resolve().parent
REQ = Path("validation-artifacts/committed/audit-shoulder/runs/hartsel-r-65/request.json")
AUTH = {"Authorization": f"Bearer {os.environ['RENDER_API_SECRET']}"}

base = json.loads(REQ.read_text(encoding="utf-8"))["scenario"]
base.pop("site_scan", None)
cand = base["meta"]["confirmedRoad"]["candidate"]
base["meta"]["centerline"] = cand["geometry"]
base["meta"]["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": None}
before = copy.deepcopy(base)
after = copy.deepcopy(base)
after.update(
    divided=False,
    roadType="rural_undivided",
    carriageway={"oneway": None, "highwayClass": "trunk", "twinDistanceM": None, "twinSearched": False},
)
c = TestClient(render_api.app)
for name, body in (("before", before), ("after", after)):
    r = c.post("/render/pdf", headers=AUTH, json=body)
    r.raise_for_status()
    doc = pdfium.PdfDocument(r.content)
    doc[0].render(scale=150 / 72).to_pil().convert("RGB").save(HERE / f"us24-{name}.png", optimize=True)
    a = c.post("/render/audit", headers=AUTH, json=body).json()
    print(name, a["summary"]["case_id"], "| L/3", a["sections"]["taper"]["L_required_ft"],
          "| total devices", a["breakdown"]["total_devices"] if "breakdown" in a else "-")
