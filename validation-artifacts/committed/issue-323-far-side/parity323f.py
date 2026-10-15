"""#323 far side (TA-23) parity: the #323 harness's bodies plus four that
this arc touches.

Run from a checkout's root:  python -B parity323f.py <out.json>

The bodies, on N Broadway SB (one-way):
- ni-left-far-nostorage: the left lane, the cross street (E 14th Ave)
  before the work, and no storage entered.
- ni-left-far-300: the same, with turnBayStorageFt = 300.
- ni-right-far-300: the right far plan carrying the field (ignored).
- ni-left-near-300: the left near plan (E 6th Ave) carrying the field
  (ignored).
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "issue-208-mypy-ratchet"))
sys.path.insert(0, str(HERE.parent / "issue-323-left-lane"))
import parity208 as p  # noqa: E402

p._no_network()
os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

import parity323 as base  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from tests.corpus.manifest import CASES, scenario_body  # noqa: E402
from tests.test_left_side_oneway import broadway  # noqa: E402

NEAR = {"lat": 39.7255, "lng": -104.98746, "name": "E 6th Ave"}
FAR = {"lat": 39.7412, "lng": -104.98756, "name": "E 14th Ave"}


def with_storage(body: dict, ft: float) -> dict:
    return {**body, "turnBayStorageFt": ft}


def main(out_path: str) -> None:
    bodies = {c.id: scenario_body(c) for c in CASES}
    bodies["broadway-left-shoulder"] = broadway("left")
    bodies["broadway-right-shoulder"] = broadway("right")
    bodies["broadway-ni-right-near"] = base.ni("right", NEAR)
    bodies["broadway-ni-right-far"] = base.ni("right", FAR)
    bodies["broadway-ni-left-near"] = base.ni("left", NEAR)
    bodies["ni-left-far-nostorage"] = base.ni("left", FAR)
    bodies["ni-left-far-300"] = with_storage(base.ni("left", FAR), 300.0)
    bodies["ni-right-far-300"] = with_storage(base.ni("right", FAR), 300.0)
    bodies["ni-left-near-300"] = with_storage(base.ni("left", NEAR), 300.0)
    client = TestClient(app)
    result: dict[str, dict[str, str]] = {}
    for case_id, body in sorted(bodies.items()):
        result[case_id] = {}
        for route, kind in p.ROUTES.items():
            payload = {"scenario": body} if route in p.QUOTE_ROUTES else body
            r = client.post(route, headers=p.AUTH, json=payload)
            text = p._mask(p._content(kind, r))
            result[case_id][route] = f"{r.status_code} " + hashlib.sha256(text.encode()).hexdigest()
    Path(out_path).write_text(json.dumps(result, indent=1, sort_keys=True), encoding="utf-8")
    n = sum(len(v) for v in result.values())
    ok = sum(1 for v in result.values() for h in v.values() if h.startswith("200 "))
    print(f"{len(result)} scenarios, {n} responses, {ok} answered 200 -> {out_path}")


if __name__ == "__main__":
    main(sys.argv[1])
