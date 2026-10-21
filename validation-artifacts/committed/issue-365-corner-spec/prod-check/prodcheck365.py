"""#365 production check: a corner plan's corridor spec and page 2 say
"Corner extension"; a midblock near-side plan keeps its downstream taper.

Runs against www.conestruct.com through the site proxy (gate bypass token from
the main checkout's conestruct/site/.env.local), with
tests.test_lane_confidence_block._ni_body() (near side, alongStationFt -60) and
its midblock twin (alongStationFt -600), pinned on E Colfax, bearing 90.
Usage: python prodcheck365.py <main checkout root>
"""
import io, json, os, sys, urllib.request

root = sys.argv[1]
sys.path.insert(0, root)
import pypdfium2 as pdfium  # noqa: E402
from tests.test_lane_confidence_block import _ni_body  # noqa: E402

tok = next(
    l.split("=", 1)[1].strip().strip('"')
    for l in open(os.path.join(root, "conestruct/site/.env.local"), encoding="utf-8")
    if l.startswith("GATE_BYPASS_TOKEN=")
)
base = "https://www.conestruct.com/api/render/"
PIN = {"lat": 39.73997, "lng": -104.96632, "bearingDeg": 90.0}


def post(path, payload):
    req = urllib.request.Request(
        base + path,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"content-type": "application/json", "x-conestruct-gate": tok},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.status, r.read()


def body(along):
    b = _ni_body(alongStationFt=along)
    b["meta"] = {**b["meta"], **PIN}
    return b


def page2(b):
    st, raw = post("pdf", {"scenario": b})
    doc = pdfium.PdfDocument(io.BytesIO(raw))
    text = doc[1].get_textpage().get_text_range() if len(doc) > 1 else ""
    return st, len(doc), " ".join(text.split())


results = []


def check(name, ok, detail):
    results.append(ok)
    print(("PASS" if ok else "FAIL"), name, "--", detail)


st, raw = post("audit", {"scenario": body(-60.0)})
spec = json.loads(raw)["sections"]["corridor_spec"]
check("1 corner corridor_spec keys corner_extension_ft 48, no downstream_taper_ft",
      st == 200 and spec.get("corner_extension_ft") == 48 and "downstream_taper_ft" not in spec,
      json.dumps(spec, sort_keys=True))
st, n, t = page2(body(-60.0))
check("2 corner page 2 reads 'Corner extension: 48 ft', no 'Downstream:' row",
      st == 200 and n == 2 and "Corner extension: 48 ft" in t and "Downstream:" not in t,
      t[t.find("CORRIDOR DETAILS"):t.find("DRAFT")])
st, raw = post("audit", {"scenario": body(-600.0)})
mspec = json.loads(raw)["sections"]["corridor_spec"]
check("3 midblock corridor_spec keeps downstream_taper_ft 50",
      st == 200 and mspec.get("downstream_taper_ft") == 50 and "corner_extension_ft" not in mspec,
      json.dumps(mspec, sort_keys=True))
st, n, t = page2(body(-600.0))
check("4 midblock page 2 keeps 'Downstream: 50 ft'",
      st == 200 and n == 2 and "Downstream: 50 ft" in t and "Corner extension" not in t,
      t[t.find("CORRIDOR DETAILS"):t.find("DRAFT")])
print(f"{sum(results)}/{len(results)} PASS")
