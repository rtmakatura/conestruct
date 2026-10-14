"""#310 evidence: page 1 of the Broadway SB fixture with and without the relay."""
import copy
import io
import json
import os
import sys

W = r"C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-319-stations"
OUT = W + "/validation-artifacts/committed/issue-310-lane-clamp/after"
os.chdir(W)
sys.path.insert(0, W)
os.environ["RENDER_API_SECRET"] = "t"
os.environ["MAPBOX_TOKEN"] = ""
os.makedirs(OUT, exist_ok=True)

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_k: ({"elements": []}, None)
client = TestClient(app)
fx = json.load(open("tests/fixtures/corridor/broadway-sb.json", encoding="utf-8"))
body = fx.get("scenario") or fx.get("body") or fx
for k in ("scenario", "body", "request"):
    if isinstance(fx, dict) and k in fx:
        body = fx[k]
        break
print("lanes", body.get("lanes"), "detectedLanesTotal", body.get("detectedLanesTotal"))
for name, extra in (("with-relay", {"roadLanesPerDirection": 5}), ("no-relay", {})):
    b = copy.deepcopy(body)
    b.update(extra)
    r = client.post("/render/pdf", headers={"Authorization": "Bearer t"}, json=b)
    print(name, r.status_code)
    if r.status_code != 200:
        print(r.text[:400])
        continue
    open(f"{OUT}/page1-{name}.pdf", "wb").write(r.content)
    page = pdfium.PdfDocument(io.BytesIO(r.content))[0]
    text = " ".join(page.get_textpage().get_text_range().split())
    i = text.find("THE ROAD HAS")
    print("   note:", text[max(0, i - 40): i + 140] if i >= 0 else "absent")
    page.render(scale=2).to_pil().save(f"{OUT}/page1-{name}.png")
    a = client.post("/render/audit", headers={"Authorization": "Bearer t"}, json=b).json()
    kinds = [it["kind"] for it in (a["pending_verification"].get("items") or [])]
    print("   audit items:", kinds)
    md = client.post("/render/markdown", headers={"Authorization": "Bearer t"}, json=b).text
    j = md.find("- Lanes:")
    print("   narrative:", md[j: j + 200] if j >= 0 else "absent")
