"""#439 walk (copied from #437 branch 3): the local backend with Overpass record/replay.

    uv run --extra dev python serve_replay.py <fixture_dir> <port>

Every Overpass ask goes through `_overpass_request_with_fallback`.  This
launcher wraps it: an answer already saved under the query's sha256 is
replayed; otherwise the live mirrors are asked once and the answer saved.
So the first Generate at the Denver Colfax pin records the real answer,
and every later one replays it byte for byte (no mirror flake, no rate
limit during the walkthrough).  Nothing else in the backend is touched.
"""

import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))

import uvicorn  # noqa: E402

from src.rules import site_detection  # noqa: E402

FIX = Path(sys.argv[1])
FIX.mkdir(parents=True, exist_ok=True)
_live = site_detection._overpass_request_with_fallback


def _replay(query, budget_s=None, meta=None, validate=None):
    key = hashlib.sha256(query.encode()).hexdigest()[:16]
    f = FIX / f"{key}.json"
    if f.exists():
        if meta is not None:
            meta.update(mirror="replay", response_bytes=f.stat().st_size, remark=None)
        print(f"[replay] {key}", flush=True)
        return json.loads(f.read_text(encoding="utf-8")), None
    payload, err = _live(query, budget_s=60, meta=meta, validate=validate)
    if payload is not None:
        f.write_text(json.dumps(payload), encoding="utf-8")
        (FIX / f"{key}.query.txt").write_text(query, encoding="utf-8")
    print(f"[record] {key} ok={payload is not None} err={err}", flush=True)
    return payload, err


site_detection._overpass_request_with_fallback = _replay

from src.api.render_api import app  # noqa: E402

uvicorn.run(app, host="127.0.0.1", port=int(sys.argv[2]), log_level="warning")
