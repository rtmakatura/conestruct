"""#461 walk (copied from #460's): the local backend with Overpass STUBBED (replay only, never live).

    uv run --extra dev python serve_stub.py <worktree> <fixture_dir> <port>

Adapted from ux-group3-where/evidence/script/serve_replay.py.  An Overpass
ask whose answer is saved under the query's sha256 is replayed; any other
ask fails as if every mirror were down (no live call is ever made).  Every
ask is counted and logged so the walk can read Overpass reads per state.
"""

import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, sys.argv[1])

import uvicorn  # noqa: E402

from src.rules import site_detection  # noqa: E402

FIX = Path(sys.argv[2])
# #460: the log goes to the walk's own folder, not the fixture's.
LOG = Path(os.environ.get("WALK_LOG_DIR", str(FIX.parent))) / "overpass-asks.log"


def _stub(query, budget_s=None, meta=None, validate=None):
    key = hashlib.sha256(query.encode()).hexdigest()[:16]
    f = FIX / f"{key}.json"
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"{key} {'replay' if f.exists() else 'miss'}\n")
    if f.exists():
        if meta is not None:
            meta.update(mirror="replay", response_bytes=f.stat().st_size, remark=None)
        return json.loads(f.read_text(encoding="utf-8")), None
    return None, "stubbed: no recorded answer"


site_detection._overpass_request_with_fallback = _stub

from src.api.render_api import app  # noqa: E402

uvicorn.run(app, host="127.0.0.1", port=int(sys.argv[3]), log_level="warning")
