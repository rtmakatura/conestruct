"""#323 parity: every right-side plan and every left-shoulder plan is
byte-identical before and after.

Run from a checkout's root:  python -B parity323.py <out.json>
The #208 harness (validation-artifacts/committed/issue-208-mypy-ratchet/
parity208.py: every corpus case through nine routes, network blocked, render
dates masked) plus three bodies this arc touches the neighbourhood of: the
N Broadway SB left shoulder (#300's plan), and near_intersection on the same
one-way street with the right side, the cross street near (E 6th Ave) and
far (upstream).
"""

from __future__ import annotations

import copy
import hashlib
import json
import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "issue-208-mypy-ratchet"))
import parity208 as p  # noqa: E402

p._no_network()
os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from tests.corpus.manifest import CASES, scenario_body  # noqa: E402
from tests.test_left_side_oneway import broadway  # noqa: E402

NI = Path("tests/fixtures/pdf_worst_case/adv-near-intersection.json")


def ni(side: str, cross: dict) -> dict:
    body = json.loads(NI.read_text(encoding="utf-8"))["scenario"]
    body["meta"].update(
        {k: copy.deepcopy(v) for k, v in broadway(side)["meta"].items() if k != "project"}
    )
    for a in body["approaches"]:
        a.pop("alongStationFt", None)
    body["meta"]["intersection"] = cross
    body["carriageway"] = copy.deepcopy(broadway(side)["carriageway"])
    return body


def main(out_path: str) -> None:
    bodies = {c.id: scenario_body(c) for c in CASES}
    bodies["broadway-left-shoulder"] = broadway("left")
    bodies["broadway-right-shoulder"] = broadway("right")
    bodies["broadway-ni-right-near"] = ni(
        "right", {"lat": 39.7255, "lng": -104.98746, "name": "E 6th Ave"}
    )
    bodies["broadway-ni-right-far"] = ni(
        "right", {"lat": 39.7412, "lng": -104.98756, "name": "E 14th Ave"}
    )
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
