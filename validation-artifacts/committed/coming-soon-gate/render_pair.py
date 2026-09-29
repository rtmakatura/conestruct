"""R37: render the control-typical plan sheet + crew sheet in-process (TestClient), offline.

    PDF_OUT=<dir> python render_pair.py      (run with the repo's .venv python)

Writes plan.pdf, crew.pdf, crew.md to PDF_OUT and prints the em-dash
count in each PDF's text.  Run once before the Part B build and once after.
"""
import json, os, sys, socket
WT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
OUT = os.environ["PDF_OUT"]
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, WT)
os.chdir(WT)
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
os.environ.pop("MAPBOX_TOKEN", None)

# Hard-block the network so "offline" is proven, not assumed.
_orig_connect = socket.socket.connect
def _no_net(self, addr, *a, **k):
    host = addr[0] if isinstance(addr, tuple) else addr
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise RuntimeError(f"network attempted: {addr}")
    return _orig_connect(self, addr, *a, **k)
socket.socket.connect = _no_net  # type: ignore[assignment]
_orig_cc = socket.create_connection
def _no_cc(addr, *a, **k):
    if addr[0] not in ("127.0.0.1", "::1", "localhost"):
        raise RuntimeError(f"network attempted: {addr}")
    return _orig_cc(addr, *a, **k)
socket.create_connection = _no_cc  # type: ignore[assignment]

from fastapi.testclient import TestClient
from src.api.render_api import app

c = TestClient(app)
H = {"Authorization": "Bearer test-secret-do-not-deploy"}
body = json.load(open("tests/fixtures/pdf_worst_case/control-typical.json", encoding="utf-8"))["scenario"]
for route, name in (("/render/pdf", "plan.pdf"), ("/render/crew-pdf", "crew.pdf"), ("/render/markdown", "crew.md")):
    r = c.post(route, json=body, headers=H)
    print(route, r.status_code, len(r.content))
    if r.status_code == 200:
        open(os.path.join(OUT, name), "wb").write(r.content)
import fitz
for n in ("plan.pdf", "crew.pdf"):
    d = fitz.open(os.path.join(OUT, n))
    txt = "".join(p.get_text() for p in d)
    print(n, "pages", d.page_count, "em-dashes", txt.count("\u2014"))
    for line in txt.splitlines():
        if "\u2014" in line:
            print("   ", line[:120])
