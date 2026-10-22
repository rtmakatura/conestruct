"""#366 production check: the picker's corridor read draws a corner plan's run
past the work zone as the plan builds it; other plans keep the 50 ft floor.

Runs against www.conestruct.com through the site proxy (gate bypass token from
the main checkout's conestruct/site/.env.local), with
tests.test_lane_confidence_block._ni_body() pinned on E Colfax, bearing 90
(corridor end), at alongStationFt -60, -100, -600 and 800, and a work-start
twin with the cross street 760 ft north of the work start (60 ft past the work).
Usage: python prodcheck366.py <main checkout root>
"""

import io
import json
import os
import sys
import urllib.request

root = sys.argv[1]
sys.path.insert(0, root)
from PIL import Image  # noqa: E402

from src.rules.corridor import _destination_point  # noqa: E402
from tests.test_lane_confidence_block import _ni_body  # noqa: E402

tok = next(
    line.split("=", 1)[1].strip().strip('"')
    for line in open(os.path.join(root, "conestruct/site/.env.local"), encoding="utf-8")
    if line.startswith("GATE_BYPASS_TOKEN=")
)
www = "https://www.conestruct.com/api/"
PIN = {"lat": 39.73997, "lng": -104.96632, "bearingDeg": 90.0}


def post(path, payload):
    req = urllib.request.Request(
        www + path,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"content-type": "application/json", "x-conestruct-gate": tok},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.status, r.headers.get("content-type", ""), r.read()


def pinned(along):
    b = _ni_body(alongStationFt=along)
    b["meta"] = {**b["meta"], **PIN}
    return b


def work_start():
    lat, lng = 39.7400, -104.9600
    cross = _destination_point(lat, lng, 0.0, 760.0 * 0.3048)
    b = _ni_body()
    b["approaches"][0].pop("alongStationFt")
    b["meta"] = {
        **b["meta"],
        "lat": lat,
        "lng": lng,
        "pinModel": "work_start",
        "work": {"side": "right", "heading": "N"},
        "intersection": {"lat": cross[0], "lng": cross[1], "name": "E 17th Ave"},
    }
    return b


def drawn(b):
    _st, _ct, raw = post("render/corridor-geometry", {"scenario": b})
    g = json.loads(raw)
    return g["status"], {z["zone"]: z["length_ft"] for z in g["approaches"][0]["zones"]}["downstream"]


def spec(b):
    _st, _ct, raw = post("render/audit", {"scenario": b})
    return json.loads(raw)["sections"]["corridor_spec"]


results = []


def check(name, ok, detail):
    results.append(ok)
    print(("PASS" if ok else "FAIL"), name, "--", detail)


for n, along, want in ((1, -60.0, 48), (2, -100.0, 88)):
    st, ds = drawn(pinned(along))
    ce = spec(pinned(along)).get("corner_extension_ft")
    check(
        f"{n} corner plan at {along:g}: picker draws {want} = audit corner_extension_ft",
        st == "laid_out" and ds == want and ce == want,
        f"status {st}, drawn {ds}, corner_extension_ft {ce}",
    )
for n, along in ((3, -600.0), (4, 800.0)):
    st, ds = drawn(pinned(along))
    dt = spec(pinned(along)).get("downstream_taper_ft")
    check(
        f"{n} non-corner plan at {along:g}: picker still draws 50 = downstream_taper_ft",
        st == "laid_out" and ds == 50.0 and dt == 50,
        f"status {st}, drawn {ds}, downstream_taper_ft {dt}",
    )
b = work_start()
st, ds = drawn(b)
ce = spec(b).get("corner_extension_ft")
check(
    "5 work-start corner plan: picker draws the audit's corner_extension_ft",
    st == "laid_out" and ce is not None and round(ds) == ce,
    f"status {st}, drawn {ds}, corner_extension_ft {ce}",
)
st, ct, raw = post(
    "corridor-map", {"scenario": b, "stage": "laid_out", "width": 640, "height": 400}
)
# The served bytes are Mapbox's JPEG under an image/png label (pre-existing,
# filed separately); the check asks for a decodable image.
img = Image.open(io.BytesIO(raw))
check(
    "6 band aerial for the work-start corner plan answers a decodable image",
    st == 200 and ct.startswith("image/") and img.size[0] > 0,
    f"status {st}, {ct}, {img.format} {img.size[0]}x{img.size[1]}, {len(raw)} bytes",
)
print(f"{sum(results)}/{len(results)} PASS")
