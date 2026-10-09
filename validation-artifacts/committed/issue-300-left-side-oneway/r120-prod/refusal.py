"""R120 prod check, the refusal leg: a stored left side the backend does not build.

N Broadway SB (``tests/fixtures/corridor/broadway-sb.json``) as a shoulder plan
with ``meta.work.side = "left"``, POSTed to the live site's ``/api/render/audit``
in two stale shapes:
  divided-answer    ``divided: true`` and no carriageway facts (verdict not one-way)
  untagged-two-way  ``roadDirection.oneway = "no"``
Both must answer 400 ``pin_model_input`` with R120's words.

Run from the repo root, with GATE_BYPASS_TOKEN set (scripts/gate.py):
  python validation-artifacts/committed/issue-300-left-side-oneway/r120-prod/refusal.py
Output, 2026-10-09 against prod 60bbe09: see ``refusal.txt``.
"""

from __future__ import annotations

import copy
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
from gate import gate_headers  # noqa: E402

URL = "https://www.conestruct.com/api/render/audit"

base = json.loads((ROOT / "tests/fixtures/corridor/broadway-sb.json").read_text(encoding="utf-8"))
meta = base["meta"]
cand = meta["confirmedRoad"]["candidate"]
meta["centerline"] = cand["geometry"]
meta["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": cand["tags"]["oneway"]}
meta["work"] = {"side": "left", "travel": "with_geometry"}

cases = {
    "divided-answer": {"divided": True},
    "untagged-two-way": {"divided": False, "oneway": "no"},
}
for name, opt in cases.items():
    s = copy.deepcopy(base)
    s["divided"] = opt["divided"]
    if "oneway" in opt:
        s["meta"]["roadDirection"]["oneway"] = opt["oneway"]
    req = urllib.request.Request(
        URL,
        data=json.dumps({"scenario": s}).encode(),
        headers={"Content-Type": "application/json", **gate_headers(URL)},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            print(name, r.status, r.read()[:300])
    except urllib.error.HTTPError as e:
        print(name, e.code, e.read().decode())
