"""#334 re-baseline: the two locked audit snapshots of a Case 11 freeway shoulder plan.

``grid_road_freeway`` and ``audit_shoulder_75mph`` are the only locked audit
snapshots of a freeway shoulder plan that cites Case 11.  This script posts
each one's scenario to the live ``/render/audit`` and writes the answer
(canonical encoding).  It prints every JSON path that changed, so the diff
can be checked against the Rule 5 prediction (only ``sections.advance`` and
the sign counts that follow from dropping W20-2).
Run from the repo root:
``uv run --extra dev python <this folder>/rebaseline_snapshots.py`` (this folder:
validation-artifacts/committed/issue-334-case11-spacing).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path.cwd()))
os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from tests._snapshot_helper import write_snapshot  # noqa: E402
from tests.corpus.manifest import GRID_CASES, scenario_body, snapshot_path  # noqa: E402
from tests.test_audit_endpoint import _auth_headers, _shoulder_at_75  # noqa: E402


def _diff(old: Any, new: Any, path: str = "") -> list[str]:
    if isinstance(old, dict) and isinstance(new, dict):
        out: list[str] = []
        for k in sorted(set(old) | set(new)):
            out += _diff(old.get(k), new.get(k), f"{path}.{k}" if path else k)
        return out
    return [] if old == new else [path]


client = TestClient(app)
grid = next(c for c in GRID_CASES if c.id == "grid_road_freeway")
targets = [
    (snapshot_path(grid.id), scenario_body(grid)),
    (Path("tests/snapshots/audit_shoulder_75mph.json"), _shoulder_at_75()),
]
for path, body in targets:
    res = client.post("/render/audit", headers=_auth_headers(), json=body)
    assert res.status_code == 200, res.text
    old = json.loads(path.read_text(encoding="utf-8"))
    new = res.json()
    print(path.as_posix())
    for p in _diff(old, new):
        print("  changed:", p)
    write_snapshot(path, new)
