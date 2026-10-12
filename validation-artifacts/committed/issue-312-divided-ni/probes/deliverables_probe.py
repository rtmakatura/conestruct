"""#312 evidence: the Colorado Blvd plan's deliverables (plan sheet, audit PDF,
crew sheet), rendered from the given checkout.  Run once on the code before
the build and once after, into before/ and after/.

Writes plan.pdf (+ page PNGs), audit.pdf (+ page PNGs), crew.pdf (+ page
PNGs), crew.md, and facts.txt: the title, the mainline signs by side, the
Note 8 row, the pending items, and the crew lines that name a median or the
left side.  TestClient, Overpass stubbed, no network.
Usage: python deliverables_probe.py <repo-root> <out-dir>
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "probe"
os.environ.pop("MAPBOX_TOKEN", None)
AUTH = {"Authorization": "Bearer probe"}

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]

leg = {"speed": 25, "roadType": "urban_arterial", "lanesPerDirection": 1, "laneWidth": 12,
       "signalized": True}
BODY: dict[str, Any] = {
    "kind": "near_intersection",
    "meta": {
        "project": "#312 Colorado Blvd at E Exposition Ave", "address": "S Colorado Blvd, Denver",
        "lat": 39.709, "lng": -104.9407, "pinModel": "work_start",
        "work": {"side": "right", "heading": "N"},
        "intersection": {"lat": 39.71092, "lng": -104.9407, "name": "E Exposition Ave"},
    },
    "roadType": "urban_arterial", "speed": 35, "lanes": 2, "laneWidth": 12, "divided": False,
    "workType": "utility_cut", "duration": "short", "workLen": 500, "night": False,
    "approaches": [{"id": "cross_a", **leg}, {"id": "cross_b", **leg}],
    "carriageway": {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": 14.8,
                    "twinSearched": True, "confirmed": None},
}
client = TestClient(app)


def pdf(path: str, name: str, body: dict[str, Any]) -> str:
    r = client.post(path, headers=AUTH, json=body)
    assert r.status_code == 200, (path, r.status_code, r.text[:300])
    (OUT / f"{name}.pdf").write_bytes(r.content)
    doc = pdfium.PdfDocument(r.content)
    text = []
    for i in range(len(doc)):
        doc[i].render(scale=2).to_pil().save(OUT / f"{name}-p{i + 1}.png")
        text.append(doc[i].get_textpage().get_text_range())
    return "\n".join(text)


plan_text = pdf("/render/pdf", "plan", BODY)
projection = client.post("/render/audit", headers=AUTH, json=BODY).json()
audit_text = pdf("/render/audit-pdf", "audit", BODY)
crew_text = pdf("/render/crew-pdf", "crew", BODY)
crew_md = client.post("/render/markdown", headers=AUTH, json=BODY).text
(OUT / "crew.md").write_text(crew_md, encoding="utf-8")

flat = " ".join(plan_text.split())
facts = []
for t in ("Lane Closure Near Intersection · Divided Highway", "Lane Closure Near Intersection · Undivided",
          "LANE CLOSURE NEAR INTERSECTION · DIVIDED HIGHWAY", "LANE CLOSURE NEAR INTERSECTION · UNDIVIDED"):
    if t in flat:
        facts.append(f"plan sheet title: {t}")
text = json.dumps(projection)
i = text.find("Signs on both sides of")
facts.append("audit Note 8 row: " + (text[i : i + 140] if i >= 0 else "(none)"))
pend = projection.get("pending_verification", {})
items = pend.get("items", []) if isinstance(pend, dict) else pend
for it in items or []:
    s = json.dumps(it)
    if "median" in s.lower():
        facts.append("pending item: " + s[:400])
for line in crew_md.splitlines():
    low = line.lower()
    if "median" in low or "left curb" in low or "left side" in low:
        facts.append("crew line: " + line.strip()[:300])
a = " ".join(audit_text.split())
for needle in ("Required: True", "Required: False", "median opening"):
    facts.append(f"audit PDF has {needle!r}: {needle in a}")
(OUT / "facts.txt").write_text("\n".join(facts) + "\n", encoding="utf-8")
print("\n".join(facts))
