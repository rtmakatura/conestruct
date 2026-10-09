"""#315 investigation probe: what the two read endpoints answer for a stale left
side today, and what they would answer with the side treated as unset.

TestClient on the given checkout, Overpass stubbed, no network. No product code
changes: "after (proposed)" is simulated by sending the same scenario with
``meta.work`` removed, which is exactly the read option (a) proposes.

Usage: python stale_left_probe.py <repo-root>
"""

from __future__ import annotations

import copy
import json
import os
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "probe"
AUTH = {"Authorization": "Bearer probe"}

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]
# No network: a placeholder token and a stubbed image fetch, so a picture
# request that gets past every gate answers 200 image/png.
os.environ["MAPBOX_TOKEN"] = "probe"
import src.api.render_api as _ra  # noqa: E402

_ra._static_aerial.fetch_png = lambda *_a, **_kw: b"\x89PNG-probe"  # type: ignore[assignment]

base = json.loads((ROOT / "tests/fixtures/corridor/broadway-sb.json").read_text(encoding="utf-8"))
m = base["meta"]
cand = m["confirmedRoad"]["candidate"]
m["centerline"] = cand["geometry"]
m["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": cand["tags"]["oneway"]}
m["work"] = {"side": "left", "travel": "with_geometry"}
base["carriageway"] = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None, "twinSearched": True}
base["divided"] = False

cases: dict[str, dict] = {}
cases["built left (Broadway shoulder)"] = copy.deepcopy(base)
# The prod repro (r120-prod): Broadway's pin and left side on a flagger plan,
# the job fields from the Lafayette flagger fixture.
flagger = json.loads(
    (ROOT / "tests/fixtures/corridor/lafayette-flagger.json").read_text(encoding="utf-8")
)
flagger["meta"] = copy.deepcopy(base["meta"])
flagger["carriageway"] = copy.deepcopy(base["carriageway"])
cases["kind changed to flagger"] = flagger
d = copy.deepcopy(base)
d["carriageway"]["confirmed"] = "divided"
cases["answered divided"] = d
u = copy.deepcopy(base)
u["carriageway"]["twinSearched"] = False
cases["undecided"] = u
t = copy.deepcopy(base)
t["meta"]["roadDirection"]["oneway"] = "no"
t["carriageway"]["oneway"] = "no"
cases["two-way tag"] = t

client = TestClient(app)


def show(label: str, body: dict) -> None:
    r = client.post("/render/corridor-geometry", headers=AUTH, json=body)
    j = r.json()
    if r.status_code != 200:
        print(f"  {label}: {r.status_code} {json.dumps(j)[:200]}")
        return
    print(
        f"  {label}: 200 status={j['status']} side_options="
        f"{[(o['work']['side'], o['label']) for o in j['side_options']]}"
    )
    for stage in ("pin", "work"):
        rm = client.post(
            "/render/corridor-map",
            headers=AUTH,
            json={"scenario": body, "stage": stage, "width": 600, "height": 300},
        )
        ct = rm.headers.get("content-type", "")
        print(f"    corridor-map stage={stage}: {rm.status_code} {ct.split(';')[0]} {rm.text[:120] if 'json' in ct else ''}")


for label, body in cases.items():
    print(f"== {label}")
    show("today", body)
    unset = copy.deepcopy(body)
    unset["meta"].pop("work", None)
    show("side unset (proposed read)", unset)
