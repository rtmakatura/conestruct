"""#334 pre-ship evidence: replay the issue's two audit rows through the local API.

Posts each row's saved ``request.json`` scenario (audit-shoulder runs
``e470-r-75`` and ``i25-r-65-night-3lanes``) to the local ``/render/audit``
and ``/render/pdf``, then prints each advance sign's distance from the taper
as the audit and page 1 state it, beside Case 11's (oracle O16).  Writes
``local-replay.md``.  The production check after the ship replays the same
rows against production.
Run from the repo root:
``uv run --extra dev python <this folder>/local_replay.py`` (this folder:
validation-artifacts/committed/issue-334-case11-spacing).
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))
os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")
os.environ.setdefault("MAPBOX_TOKEN", "")

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from tests.test_audit_endpoint import _auth_headers  # noqa: E402

HERE = Path(__file__).resolve().parent
RUNS = HERE.parent / "audit-shoulder" / "runs"
ROWS = ["e470-r-75", "i25-r-65-night-3lanes"]
# Oracle O16 (audit-shoulder/oracle-sources.md), copied by hand, not imported.
CASE_11 = [("W5-1", 500), ("W21-5aR", 1000), ("W21-5aR", 2000), ("W20-1", 5200)]

client = TestClient(app)
lines = [
    "# #334 local replay: the two audit rows on the branch",
    "",
    "Each row's saved `request.json` posted to the local `/render/audit` and `/render/pdf`,",
    "with the confirmed road's compass heading in place of the site-attached centerline",
    "and no network site scan (neither moves a sign along the road).",
    "Distances are from the start of the shoulder taper. Case 11 = oracle O16.",
    "",
]
fails = 0
for row in ROWS:
    body = json.loads((RUNS / row / "request.json").read_text(encoding="utf-8"))["scenario"]
    # The site attaches meta.centerline before it forwards a with-geometry
    # request; locally the confirmed road's compass heading stands in, and
    # the network site scan is left out.  Neither moves a sign along the
    # road: every distance below is measured from the taper.
    bearing = body["meta"]["confirmedRoad"]["candidate"]["bearing"]
    heading = "NESW"[round(bearing / 90.0) % 4]
    body["meta"]["work"] = {"side": body["meta"]["work"]["side"], "heading": heading}
    body.pop("site_scan", None)
    audit = client.post("/render/audit", headers=_auth_headers(), json=body)
    pdf = client.post("/render/pdf", headers=_auth_headers(), json=body)
    assert audit.status_code == 200 and pdf.status_code == 200, (audit.text[:200], pdf.text[:200])
    table = audit.json()["sections"]["advance"]["sign_table"]
    audit_ft = sorted(
        (r["Code"], int(r["Distance from Taper (ft)"].split()[0].replace(",", "")))
        for r in table
        if r["Code"] in {"W5-1", "W21-5aR", "W20-1", "W20-2"}
    )
    doc = pdfium.PdfDocument(pdf.content)
    page1 = " ".join(doc[0].get_textpage().get_text_range().split())
    doc.close()
    page1_ft = sorted(
        (code, int(ft))
        for code, ft in re.findall(r"\b(W5-1|W21-5aR|W20-1|W20-2) [A-Z ]+? (\d+) ft", page1)
    )
    want = sorted(CASE_11)
    ok = audit_ft == want and page1_ft == want
    fails += not ok
    lines += [
        f"## {row}: {'PASS' if ok else 'FAIL'}",
        f"- Case 11: {', '.join(f'{c} {d:,}' for c, d in CASE_11)}",
        f"- Audit sign table: {', '.join(f'{c} {d:,}' for c, d in audit_ft)}",
        f"- Page 1 advance list: {', '.join(f'{c} {d:,}' for c, d in page1_ft)}",
        f"- W20-2 anywhere on page 1: {'yes' if 'W20-2' in page1 else 'no'}",
        f"- plan_flags: {audit.json()['plan_flags']}",
        "",
    ]
lines += [
    "The I-25 row's one validation warning is the replay's own: the compass heading",
    "(E, 90°) differs from I-25's mapped bearing (114°) by more than the corridor",
    "check's 15°, so `corridor_validation` warns `bearing_conflict`. Production sends",
    "the centerline, so it doesn't get this warning. The row's one V1 limitation is",
    '#310\'s lanes item ("Drawn as 3 lanes per direction; the road has 4"), which is',
    "also in production's saved audit.",
    "",
]
lines.append(f"Result: {len(ROWS) - fails}/{len(ROWS)} PASS.")
(HERE / "local-replay.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
print("\n".join(lines))
