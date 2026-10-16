"""#333: regenerate the shoulder snapshots the buffer cones move, through
the canonical writer (tests._snapshot_helper.write_snapshot), from the same
builders the tests post.  Run from the worktree root, then review the diff:
only the spacing section's cone fields and lines may change.

    python -B validation-artifacts/committed/issue-333-buffer-devices/regen333.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())
os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

from fastapi.testclient import TestClient  # noqa: E402

import tests.test_audit_endpoint as tae  # noqa: E402
from src.api import render_api  # noqa: E402
from tests._snapshot_helper import write_snapshot  # noqa: E402
from tests.corpus.manifest import GRID_CASES, scenario_body, snapshot_path  # noqa: E402

c = TestClient(render_api.app)
H = {"Authorization": "Bearer test-secret-do-not-deploy"}


def post(body: dict) -> dict:
    r = c.post("/render/audit", headers=H, json=body)
    r.raise_for_status()
    return r.json()


def with_(**kw: object) -> dict:
    s = tae._shoulder_scenario()
    s.update(kw)
    return s


AUDIT = {
    "audit_shoulder_no_reduction.json": tae._shoulder_scenario(),
    "audit_shoulder_65mph.json": tae._shoulder_at_65(),
    "audit_shoulder_75mph.json": tae._shoulder_at_75(),
    "audit_shoulder_reduction_10.json": with_(workZoneSpeed=45),
    "audit_shoulder_reduction_25.json": with_(workZoneSpeed=30),
    "audit_shoulder_reduction_65mph_envelope.json": with_(
        speed=65, workLen=1000.0, workZoneSpeed=60, roadType="freeway"
    ),
    "audit_shoulder_urban25_quadratic.json": tae._shoulder_urban25(),
}
for name, body in AUDIT.items():
    write_snapshot(Path("tests/snapshots") / name, post(body))
    print("wrote", name)

n = 0
for case in GRID_CASES:
    path = snapshot_path(case.id)
    payload = post(scenario_body(case))
    if path.exists() and path.read_text(encoding="utf-8") == "":
        continue
    write_snapshot(path, payload)
    n += 1
print("grid snapshots written:", n)
