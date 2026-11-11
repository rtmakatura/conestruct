"""Local backend for the #507 walk: scripts/verify-generate-cls-stub.py's
replay, plus an extra fixture dir (the walk's own, last in the list) and a
record mode (STUB_RECORD=1: a miss asks the live mirrors once and saves the
answer into the extra dir).  The final walk runs with STUB_RECORD unset:
replay only.

    uv run --extra dev python stub_backend.py <worktree> "<dir>;<dir>;<extra dir>" <port>
"""

import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, sys.argv[1])

import uvicorn  # noqa: E402

from src.rules import site_detection  # noqa: E402

FIXES = [Path(d) for d in sys.argv[2].split(";")]
EXTRA = FIXES[-1]
EXTRA.mkdir(parents=True, exist_ok=True)
LOG = EXTRA / "asks.log"
RECORD = os.environ.get("STUB_RECORD") == "1"
_real = site_detection._overpass_request_with_fallback


def _stub(query, budget_s=None, meta=None, validate=None):
    key = hashlib.sha256(query.encode()).hexdigest()[:16]
    f = next((d / f"{key}.json" for d in FIXES if (d / f"{key}.json").exists()), None)
    if f is not None:
        with LOG.open("a", encoding="utf-8") as fh:
            fh.write(f"{key} replay\n")
        if meta is not None:
            meta.update(mirror="replay", response_bytes=f.stat().st_size, remark=None)
        return json.loads(f.read_text(encoding="utf-8")), None
    if RECORD:
        ans, err = _real(query, budget_s=budget_s, meta=meta, validate=validate)
        with LOG.open("a", encoding="utf-8") as fh:
            fh.write(f"{key} record {'ok' if ans is not None else err}\n")
        if ans is not None:
            (EXTRA / f"{key}.json").write_text(json.dumps(ans), encoding="utf-8")
            (EXTRA / f"{key}.query.txt").write_text(query, encoding="utf-8")
        return ans, err
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"{key} miss\n")
    return None, "stubbed: no recorded answer"


site_detection._overpass_request_with_fallback = _stub

from src.api.render_api import app  # noqa: E402

uvicorn.run(app, host="127.0.0.1", port=int(sys.argv[3]), log_level="warning")
