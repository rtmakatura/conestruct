"""#243 re-check: #243's own repro pin (N Federal Blvd) replayed in-process.

On prod at 2f27be3 this body answers 502 ("Audit trail failed"; Modal logs
show the backend's /render/audit and /render/device-breakdown 500 at ~17 s,
the traceback went to Sentry).  Here the same body goes through the backend
app at this checkout (= main = 2f27be3) with the real Overpass scan, so the
Note 8 row can still be read.  Read-only; a throwaway bearer secret.

  python federal_replay.py > federal-replay.txt
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3]))
sys.stdout.reconfigure(encoding="utf-8")
os.environ["RENDER_API_SECRET"] = "local-replay"

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402

body = json.loads((HERE / "prod" / "federal-audit-request.json").read_text("utf-8"))["scenario"]
client = TestClient(app, raise_server_exceptions=False)
t0 = time.time()
r = client.post("/render/audit", json=body, headers={"Authorization": "Bearer local-replay"})
print(f"status {r.status_code} in {time.time() - t0:.1f} s")
if r.status_code != 200:
    print("body:", r.text[:2000])
    sys.exit(0)
a = r.json()
s = a["sections"]["site_scan"]
print(f"scan {s['status']} mirror {s.get('mirror')} elements {s.get('element_count')}")
print("site adjustments:", [x["flag"] for x in a["sections"]["site_adjustments"]])
print("Note 8 row:", json.dumps(a["sections"]["colorado"]["checks"][0], ensure_ascii=False))
print("plan_flags:", json.dumps(a["plan_flags"]))
