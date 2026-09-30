"""#243 re-check, side finding: the traceback behind federal_replay.py's 500.

render_api turns the exception into HTTPException(500, "render failed: ...");
this prints the exception it wraps.  Read-only; a throwaway bearer secret.

  python federal_traceback.py > federal-traceback.txt 2>&1
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3]))
os.environ["RENDER_API_SECRET"] = "local-replay"

from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api import render_api  # noqa: E402

_init = HTTPException.__init__


def _loud(self, *a, **k):
    if k.get("status_code") == 500 or (a and a[0] == 500):
        traceback.print_exc(file=sys.stdout)
    _init(self, *a, **k)


HTTPException.__init__ = _loud
body = json.loads((HERE / "prod" / "federal-audit-request.json").read_text("utf-8"))["scenario"]
r = TestClient(render_api.app, raise_server_exceptions=False).post(
    "/render/audit", json=body, headers={"Authorization": "Bearer local-replay"}
)
print(r.status_code, r.text[:300])
