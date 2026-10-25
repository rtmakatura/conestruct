"""#388 churn: every surface that prints a device count.

Usage: python churn.py <code root>
Renders every kind x jurisdiction x street class x day/night through the
real endpoints of the tree at <code root> and prints, per body and
surface, a sha256 prefix, plus the Advance Warning Signs count each
surface prints (None when the row is absent).
"""

import copy
import datetime
import hashlib
import io
import json
import os
import re
import sys

root = sys.argv[1]
sys.path.insert(0, root)
sys.path.insert(1, os.getcwd())
os.environ["RENDER_API_SECRET"] = "s"
import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from openpyxl import load_workbook  # noqa: E402

import src.api.render_api as r  # noqa: E402
from tests.test_plan_sheet_device_summary import FLAGGER_BODY, SHOULDER_BODY  # noqa: E402
from tests.test_r117_jurisdiction_raised import _broadway_denver  # noqa: E402

assert os.path.normcase(r.__file__).startswith(os.path.normcase(os.path.normpath(root)))
KEYS = [None] + sorted(f[:-5] for f in os.listdir(os.path.join(root, "data", "jurisdictions")))
# Repair cycle 1 (R7): the road facts that change the direction count.
ONE_WAY = {"oneway": "yes", "highwayClass": "residential", "twinSearched": True}
SHOULDER_2WAY = {**SHOULDER_BODY, "roadType": "rural_undivided", "divided": False, "lanes": 1}
SHOULDER_1WAY = {
    **SHOULDER_BODY,
    "roadType": "urban_arterial",
    "speed": 30,
    "divided": False,
    "carriageway": ONE_WAY,
}
NI_1WAY = {**_broadway_denver(), "carriageway": ONE_WAY}

bodies = {}
for k in KEYS:
    for cls in (None, "local", "arterial"):
        if k is None and cls is not None:
            continue
        for night in (False, True):
            for kind, base in (
                ("flagger", FLAGGER_BODY),
                ("shoulder", SHOULDER_BODY),
                ("ni", _broadway_denver()),
                ("shoulder2way", SHOULDER_2WAY),
                ("shoulder1way", SHOULDER_1WAY),
                ("ni1way", NI_1WAY),
            ):
                b = copy.deepcopy(base)
                if k:
                    b["jurisdiction_key"] = k
                else:
                    b.pop("jurisdiction_key", None)
                if cls:
                    b["street_class"] = cls
                else:
                    b.pop("street_class", None)
                b["night"] = night
                bodies[f"{kind}-{k}-{cls}-{'night' if night else 'day'}"] = b

c = TestClient(r.app)
H = {"Authorization": "Bearer s"}
DATE = re.compile(r"\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?)?")


def h(s: str) -> str:
    return hashlib.sha256(DATE.sub("DATE", s).encode()).hexdigest()[:12]


def wb_values(content: bytes) -> tuple[str, object]:
    wb = load_workbook(io.BytesIO(content))
    try:
        cells = []
        aws = None
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True):
                cells.append(
                    repr(tuple("DT" if isinstance(v, datetime.datetime) else v for v in row))
                )
                for v in row:
                    if isinstance(v, str) and v.startswith("Advance Warning Signs"):
                        aws = [x for x in row if isinstance(x, (int, float))]
        return h("\n".join(cells)), aws
    finally:
        wb.close()


def pdf_page1(content: bytes) -> str:
    doc = pdfium.PdfDocument(content)
    try:
        return doc[0].get_textpage().get_text_range()
    finally:
        doc.close()


out = {}
for name, b in bodies.items():
    rec = {}
    x = c.post("/render/xlsx", json=b, headers=H)
    rec["xlsx"] = (
        (f"{x.status_code}:" + wb_values(x.content)[0], wb_values(x.content)[1])
        if x.status_code == 200
        else x.status_code
    )
    q = c.post("/render/quote", json={"scenario": b}, headers=H)
    rec["quote"] = (
        (f"{q.status_code}:" + wb_values(q.content)[0], wb_values(q.content)[1])
        if q.status_code == 200
        else q.status_code
    )
    bd = c.post("/render/device-breakdown", json=b, headers=H)
    if bd.status_code == 200:
        j = bd.json()
        aws = [
            d["qty"]
            for d in j["devices"]
            if str(d.get("device", "")).startswith("Advance Warning Signs")
        ]
        rec["breakdown"] = ("200:" + h(json.dumps(j, sort_keys=True)), aws or None)
    else:
        rec["breakdown"] = bd.status_code
    md = c.post("/render/markdown", json=b, headers=H)
    m = re.search(r"- (\d+)× Advance Warning Signs", md.text)
    rec["md"] = (f"{md.status_code}:" + h(md.text.replace("\r\n", "\n")), m.group(1) if m else None)
    snap = c.post("/render/replication-snapshot", json={"scenario": b}, headers=H)
    rec["snapshot"] = f"{snap.status_code}:" + h(re.sub(r"GIT_SHA=\S+", "GIT_SHA=X", snap.text))
    au = c.post("/render/audit", json=b, headers=H)
    rec["audit"] = f"{au.status_code}:" + h(au.text)
    pdf = c.post("/render/pdf", json=b, headers=H)
    if pdf.status_code == 200:
        t = pdf_page1(pdf.content)
        rec["pdf_p1"] = "200:" + h(t)
    else:
        rec["pdf_p1"] = pdf.status_code
    out[name] = rec
    print(name, file=sys.stderr)
# A leading newline: render logs (e.g. "MAPBOX_TOKEN not set") also go to stdout.
sys.stdout.write("\n" + json.dumps(out, indent=1, sort_keys=True) + "\n")
