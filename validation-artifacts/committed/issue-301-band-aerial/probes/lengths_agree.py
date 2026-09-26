"""#301 checkpoint questions (a) and (d) — do the three consumers state the same lengths?

For each scenario (the two prod-captured work-start fixtures, plus variants
on the fields that feed the lengths), three answers are read through THIS
branch's API via FastAPI's TestClient:

- the PICKER's: ``POST /render/corridor-geometry`` -> ``approaches[].zones[].length_ft``
  (the modal's CORRIDOR EXTENT panel and overlay read these);
- the BAND's: ``POST /render/audit`` -> ``sections.corridor_spec`` (the WHERE
  band's extent rows read these, GeneratorShell.tsx:1562-1564);
- PAGE 2's: ``POST /render/pdf`` with ``plan_sheet._fetch_mapbox_aerial``
  wrapped to capture the ``approaches`` it is handed, then
  ``corridor_layout.zone_spans`` on each (what page 2 draws).

    python lengths_agree.py > lengths-agree.txt

No Mapbox call is made (the fetch is stubbed); MAPBOX_TOKEN is set to a
dummy so page 2's branch runs.
"""

from __future__ import annotations

import copy
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))
os.environ["MAPBOX_TOKEN"] = "probe-dummy-not-a-token"
os.environ.setdefault("RENDER_API_SECRET", "lengths-probe")

from fastapi.testclient import TestClient  # noqa: E402

import src.rendering.plan_sheet as ps  # noqa: E402
from src.api.render_api import app  # noqa: E402
from src.rules.corridor_layout import zone_spans  # noqa: E402

client = TestClient(app)
AUTH = {"Authorization": f"Bearer {os.environ['RENDER_API_SECRET']}"}
seen: dict[str, object] = {}


def _capture(lat, lng, token, corridor=None, approaches=None):  # noqa: ANN001
    seen["approaches"] = approaches
    return None  # no image; page 2 is skipped, which is fine for lengths


ps._fetch_mapbox_aerial = _capture  # type: ignore[assignment]

SRC = ROOT / "validation-artifacts/committed/issue-290-picker-draws/prod-after"


def load(name: str) -> dict:
    s = json.loads((SRC / f"{name}-sided-request.json").read_text(encoding="utf-8"))["scenario"]
    m = s["meta"]
    cand = m["confirmedRoad"]["candidate"]
    m["centerline"] = cand["geometry"]
    m["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": (cand.get("tags") or {}).get("oneway")}
    return s


def variant(base: dict, **kw) -> dict:
    s = copy.deepcopy(base)
    s.update(kw)
    return s


BROADWAY = load("broadway-prod-after")
LAFAYETTE = load("lafayette-flagger-prod-after")
CASES = [
    ("broadway (fixture, shoulder 30 mph)", BROADWAY),
    ("broadway @ 45 mph", variant(BROADWAY, speed=45)),
    ("broadway @ 45 mph, work-zone speed 35", variant(BROADWAY, speed=45, workZoneSpeed=35)),
    ("lafayette (fixture, flagger 55 mph)", LAFAYETTE),
    ("lafayette @ 35 mph", variant(LAFAYETTE, speed=35)),
    ("lafayette @ 55 mph, work-zone speed 45", variant(LAFAYETTE, workZoneSpeed=45)),
    # The buffer's CDOT step-downs (65->60, 75->65) are where the audit
    # (passes work_zone_speed_mph) and the geometry (does not) take
    # different arguments to buffer_space.
    ("broadway @ 65 mph", variant(BROADWAY, speed=65)),
    ("broadway @ 65 mph, work-zone speed 60", variant(BROADWAY, speed=65, workZoneSpeed=60)),
    ("broadway @ 75 mph, work-zone speed 65", variant(BROADWAY, speed=75, workZoneSpeed=65)),
    ("lafayette @ 65 mph, work-zone speed 55", variant(LAFAYETTE, speed=65, workZoneSpeed=55)),
]
ZONES = ("advance_warning", "transition", "buffer", "downstream")
SPEC_KEY = {"advance_warning": "advance_warning_ft", "transition": "taper_ft", "buffer": "buffer_ft", "downstream": "downstream_taper_ft"}

disagreements = 0
for label, sc in CASES:
    g = client.post("/render/corridor-geometry", headers=AUTH, json=sc)
    a = client.post("/render/audit", headers=AUTH, json=sc)
    seen.clear()
    p = client.post("/render/pdf", headers=AUTH, json=sc)
    print(f"== {label}   geometry {g.status_code} · audit {a.status_code} · pdf {p.status_code}")
    if g.status_code != 200 or a.status_code != 200:
        print("   ", g.text[:200], a.text[:200])
        continue
    gj = g.json()
    spec = (a.json().get("sections") or {}).get("corridor_spec") or {}
    page2 = {aid: {n: round(y - x, 1) for n, x, y in zone_spans(c)} for aid, c in (seen.get("approaches") or [])}
    for ap in gj["approaches"]:
        pick = {z["zone"]: z["length_ft"] for z in ap["zones"]}
        p2 = page2.get(ap["id"], {})
        print(f"   approach {ap['id']:8s} travel {ap['travel_bearing_deg']}°")
        for z in ZONES:
            band = spec.get(SPEC_KEY[z]) if ap["id"] == "primary" else None
            vals = [pick.get(z), p2.get(z)] + ([band] if band is not None else [])
            agree = len({round(float(v)) for v in vals if v is not None}) <= 1
            disagreements += 0 if agree else 1
            print(f"     {z:16s} picker {pick.get(z)!s:>8}  page2 {p2.get(z)!s:>8}  "
                  f"band {band if band is not None else '—':>6}  {'agree' if agree else 'DISAGREE'}")
    print(f"     work_zone        picker {gj['work']['length_ft']}  page2 {page2.get('primary', {}).get('work_zone')}  band workLen {sc['workLen']}")
print(f"\nrows that disagree (rounded to whole feet): {disagreements}")
