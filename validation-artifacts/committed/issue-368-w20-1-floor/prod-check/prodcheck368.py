"""#368 production check: freeway Case 11 reduced-speed W20-1 on www.conestruct.com.

Runs through the site proxy (gate bypass token from the main checkout's
conestruct/site/.env.local).
Usage: PYTHONPATH=<worktree> python prodcheck368.py <main checkout root>
"""
import io, json, os, sys, urllib.error, urllib.request

import pypdfium2 as pdfium

from tests.s630._harness import _common

root = sys.argv[1]
tok = next(
    l.split("=", 1)[1].strip().strip('"')
    for l in open(os.path.join(root, "conestruct/site/.env.local"), encoding="utf-8")
    if l.startswith("GATE_BYPASS_TOKEN=")
)
base = "https://www.conestruct.com/api/render/"


def post(kind, body):
    req = urllib.request.Request(
        base + kind,
        data=json.dumps({"scenario": body}).encode(),
        method="POST",
        headers={"content-type": "application/json", "x-conestruct-gate": tok},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


results = []


def check(name, ok, detail):
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'} {name}: {detail}")


# (posted, work-zone speed, W20-1 from the taper start)
for s, wz, want in [(75, 40, 6090), (75, 20, 6620), (75, 60, 5200)]:
    body = {**_common(s, wz), "workLen": 1000}
    tag = f"freeway {s}->{wz} L1000"
    st, raw = post("audit", body)
    rows = json.loads(raw)["sections"]["advance"]["sign_table"] if st == 200 else []
    fur = next((r for r in rows if r["Position"] == "Furthest (Case 11)"), {})
    dist = fur.get("Distance from Taper (ft)", "")
    check(f"{tag} audit", st == 200 and fur.get("Code") == "W20-1" and dist.startswith(f"{want:,} "),
          f"HTTP {st}, Furthest (Case 11) = {fur.get('Code')} {dist}")
    st, raw = post("markdown", body)
    line = f"| W20-1 | ROAD WORK AHEAD | {want:,} ft upstream |"
    check(f"{tag} crew sheet", st == 200 and line in raw.decode(), f"HTTP {st}, '{line}' present")
    st, raw = post("pdf", body)
    page1 = " ".join(pdfium.PdfDocument(io.BytesIO(raw))[0].get_textpage().get_text_range().split()) if st == 200 else ""
    want_txt = f"W20-1 ROAD WORK AHEAD {want} ft"
    check(f"{tag} page 1", want_txt in page1, f"HTTP {st}, '{want_txt}' present")

print(f"{sum(results)}/{len(results)} PASS")
