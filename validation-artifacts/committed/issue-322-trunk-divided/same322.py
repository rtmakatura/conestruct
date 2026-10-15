"""#322: the undivided and one-way-street plans are unchanged.

    python same322.py

For Lafayette St (two-way undivided) and N Broadway SB (one-way street),
compares prod `ef8f573` against the branch on three levels: the scenario
the site sent, the audit JSON, and page 1 of the plan PDF rendered to
pixels.  The PDF bytes themselves carry a creation timestamp, so pages
are compared as images.
"""

import json
from pathlib import Path

import pypdfium2 as pdfium
from PIL import ImageChops

HERE = Path(__file__).parent
for pin in ("lafayette", "broadway"):
    a = json.loads((HERE / f"same-prod-{pin}.json").read_text(encoding="utf-8"))
    b = json.loads((HERE / f"same-local-{pin}.json").read_text(encoding="utf-8"))
    sent = a == b
    ga = json.loads((HERE / f"same-prod-{pin}" / "scenario-generated.json").read_text(encoding="utf-8"))
    gb = json.loads((HERE / f"same-local-{pin}" / "scenario-generated.json").read_text(encoding="utf-8"))
    aa = json.loads((HERE / f"same-prod-{pin}" / "audit.json").read_text(encoding="utf-8"))
    ab = json.loads((HERE / f"same-local-{pin}" / "audit.json").read_text(encoding="utf-8"))
    pa = pdfium.PdfDocument(str(HERE / f"same-prod-{pin}" / "plan.pdf"))[0].render(scale=2).to_pil()
    pb = pdfium.PdfDocument(str(HERE / f"same-local-{pin}" / "plan.pdf"))[0].render(scale=2).to_pil()
    diff = ImageChops.difference(pa.convert("RGB"), pb.convert("RGB")).getbbox()
    print(
        f"{pin}: scenario sent identical {sent} | generated scenario identical {ga == gb} | "
        f"audit JSON identical {aa == ab} | page 1 pixel diff {diff}"
    )
