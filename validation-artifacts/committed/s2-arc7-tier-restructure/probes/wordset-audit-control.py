"""s2-arc7 (#220) word-set control: base vs HEAD audit PDF for the
typical control — the only permitted diff is the new Plan-status row."""

import json
import os
import subprocess
import sys

os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
HEAD_ROOT = "C:/Users/rtmak/Documents/traffic-control-tool"
BASE_ROOT = "C:/Users/rtmak/AppData/Local/Temp/base-wt"
OUT = "C:/Users/rtmak/AppData/Local/Temp/claude/C--Users-rtmak-Documents-traffic-control-tool/4f255911-1a5e-4b2f-9c19-68f03918e4ca/scratchpad/wordset"
os.makedirs(OUT, exist_ok=True)

RENDER_SNIPPET = """
import os, json, sys
os.environ['RENDER_API_SECRET']='test-secret-do-not-deploy'
sys.path.insert(0, {root!r})
from fastapi.testclient import TestClient
from src.api.render_api import app
c = TestClient(app)
sc = json.load(open({fixture!r}, encoding='utf-8'))['scenario']
r = c.post('/render/audit-pdf', json=sc, headers={{'Authorization':'Bearer test-secret-do-not-deploy'}})
assert r.status_code == 200, r.text[:200]
open({out!r}, 'wb').write(r.content)
"""

FIXTURE = HEAD_ROOT + "/tests/fixtures/pdf_worst_case/control-typical.json"
PY = HEAD_ROOT + "/.venv/Scripts/python.exe"

for tag, root in (("base", BASE_ROOT), ("head", HEAD_ROOT)):
    code = RENDER_SNIPPET.format(root=root, fixture=FIXTURE, out=f"{OUT}/{tag}.pdf")
    subprocess.run([PY, "-c", code], check=True, cwd=root)


def words(path):
    import pypdfium2 as pdfium

    doc = pdfium.PdfDocument(path)
    out = set()
    try:
        for page in doc:
            tp = page.get_textpage()
            text = tp.get_text_range(0, tp.count_chars())
            for w in text.split():
                out.add(w)
    finally:
        doc.close()
    return out


b, h = words(f"{OUT}/base.pdf"), words(f"{OUT}/head.pdf")
print("base words:", len(b), "head words:", len(h))
print("only-base:", sorted(b - h))
print("only-head:", sorted(h - b))
