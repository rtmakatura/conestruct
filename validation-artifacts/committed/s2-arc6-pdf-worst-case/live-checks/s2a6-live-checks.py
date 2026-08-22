"""s2-arc6 live checks (Refs #216) — production at the shipped tip, READ-ONLY.

  gate (re-asserted in-log) — healthz == origin/main == served bundle.
  L1  — the adversarial trio POSTed to prod /api/render/pdf; containment
        measured from the SERVED bytes by the same word-box method the
        committed test uses (edge / box_cross / collisions): all ZERO.
  L2  — the flowing surfaces: /api/render/audit-pdf + /api/render/crew-pdf
        for all four fixtures; zero chars outside the margins.
  L3  — the typical control: prod-served PDF vs a local HEAD render —
        word (text, x, y) sets equal modulo the DATE value (same-day
        renders make DATE equal too; any diff is listed).
"""

import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path("C:/Users/rtmak/Documents/traffic-control-tool")
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))

import os

os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")
from test_pdf_containment import measure_containment  # noqa: E402

import pypdfium2 as pdfium  # noqa: E402

OUT = Path(__file__).parent / "outS2A6-live"
OUT.mkdir(exist_ok=True)
BASE = "https://www.conestruct.com"
FIXDIR = ROOT / "tests/fixtures/pdf_worst_case"

failures = 0
lines = []


def log(msg):
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    lines.append(f"- `{stamp}` {msg}")
    print(f"{stamp} {msg}")


def check(name, cond, extra=""):
    global failures
    tag = "**PASS**" if cond else "**FAIL**"
    if not cond:
        failures += 1
    log(f"{tag} — {name}{f' ({extra})' if extra else ''}")


def post_pdf(route, scenario, timeout=120):
    req = urllib.request.Request(
        BASE + route,
        data=json.dumps({"scenario": scenario}).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read()


def words_xyz(pdf_path):
    doc = pdfium.PdfDocument(str(pdf_path))
    out = []
    try:
        for page in doc:
            tp = page.get_textpage()
            n = tp.count_chars()
            text = tp.get_text_range(0, n)
            cur = []

            def flush():
                if not cur:
                    return
                boxes = [tp.get_charbox(i) for i in cur]
                out.append(
                    (
                        "".join(text[i] for i in cur),
                        round(min(b[0] for b in boxes), 2),
                        round(min(b[1] for b in boxes), 2),
                    )
                )
                cur.clear()

            for i, ch in enumerate(text):
                (flush() if ch.isspace() else cur.append(i))
            flush()
    finally:
        doc.close()
    return out


FIXTURES = ["adv-shoulder", "adv-near-intersection", "adv-flagger", "control-typical"]


def load(name):
    return json.loads((FIXDIR / f"{name}.json").read_text(encoding="utf-8"))["scenario"]


# ---- L1: plan-sheet containment on served bytes -----------------------------
for name in FIXTURES:
    s, body = post_pdf("/api/render/pdf", load(name))
    p = OUT / f"{name}-served.pdf"
    p.write_bytes(body)
    if s != 200:
        check(f"L1. {name} serves", False, f"HTTP {s}")
        continue
    fails = measure_containment(str(p))
    counts = {k: len(v) for k, v in fails.items()}
    check(
        f"L1. {name}: served plan sheet zero-bleed",
        all(v == 0 for v in counts.values()),
        f"{counts}",
    )

# ---- L2: flowing surfaces ----------------------------------------------------
for name in FIXTURES:
    for tag, route in (("audit", "/api/render/audit-pdf"), ("crew", "/api/render/crew-pdf")):
        s, body = post_pdf(route, load(name))
        p = OUT / f"{name}-{tag}-served.pdf"
        p.write_bytes(body)
        if s != 200:
            check(f"L2. {name} {tag} serves", False, f"HTTP {s}")
            continue
        doc = pdfium.PdfDocument(str(p))
        bad = 0
        try:
            margin = 0.7 * 72.0
            for page in doc:
                pw = page.get_width()
                tp = page.get_textpage()
                for i in range(tp.count_chars()):
                    box = tp.get_charbox(i)
                    if box[2] > pw - margin + 2.0 or box[0] < margin - 2.0:
                        bad += 1
        finally:
            doc.close()
        check(f"L2. {name} {tag}: chars inside margins", bad == 0, f"{bad} outside")

# ---- L3: the typical control vs a local HEAD render -------------------------
code = f"""
import os, sys, json
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
sys.path.insert(0, {str(ROOT)!r})
from fastapi.testclient import TestClient
from src.api.render_api import app
client = TestClient(app)
sc = json.load(open({str(FIXDIR / 'control-typical.json')!r}, encoding="utf-8"))["scenario"]
r = client.post("/render/pdf", json=sc, headers={{"Authorization": "Bearer test-secret-do-not-deploy"}})
assert r.status_code == 200
open({str(OUT / 'control-local.pdf')!r}, "wb").write(r.content)
"""
subprocess.run(
    [str(ROOT / ".venv/Scripts/python.exe"), "-c", code], check=True, cwd=str(ROOT)
)
served = set(words_xyz(OUT / "control-typical-served.pdf"))
local = set(words_xyz(OUT / "control-local.pdf"))
only_s, only_l = served - local, local - served
check(
    "L3. control word-set: served == local HEAD render (positions included)",
    not only_s and not only_l,
    f"served {len(served)} words, local {len(local)}; "
    f"only-served {sorted(only_s)[:4]}, only-local {sorted(only_l)[:4]}",
)

(OUT / "s2a6-live-raw.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"\nDONE — failures: {failures}")
sys.exit(1 if failures else 0)
