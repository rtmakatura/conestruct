"""#344 re-baseline: the one locked audit snapshot of a Case 26 freeway shoulder plan.

``audit_shoulder_reduction_65mph_envelope`` (65 -> 60 mph, freeway, 1,000 ft
work zone) is the only locked audit snapshot of a plan that cites Sheet 14.
This script posts its scenario (the one ``test_audit_fines_double_65mph_
envelope_matches_baseline`` posts) to the live ``/render/audit`` and writes
the answer (canonical encoding).  It prints every JSON path that changed, so
the diff can be checked against the Rule 5 prediction: ``sections.advance``,
the Fines Double envelope, and the sign counts that follow from the Sheet 14
series.
Run from the repo root:
``uv run --extra dev python <this folder>/rebaseline_snapshots.py`` (this folder:
validation-artifacts/committed/issue-344-sheet14-series).
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
from tests.test_audit_endpoint import _auth_headers, _shoulder_scenario  # noqa: E402

SNAPSHOT = Path("tests/snapshots/audit_shoulder_reduction_65mph_envelope.json")


def _paths(a: Any, b: Any, here: str = "") -> list[str]:
    if isinstance(a, dict) and isinstance(b, dict):
        out: list[str] = []
        for k in sorted(set(a) | set(b)):
            out += _paths(a.get(k), b.get(k), f"{here}.{k}")
        return out
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        return [
            p
            for i, (x, y) in enumerate(zip(a, b, strict=True))
            for p in _paths(x, y, f"{here}[{i}]")
        ]
    return [] if a == b else [here]


def main() -> None:
    s = _shoulder_scenario()
    s.update({"speed": 65, "workLen": 1000.0, "workZoneSpeed": 60, "roadType": "freeway"})
    res = TestClient(app).post("/render/audit", headers=_auth_headers(), json=s)
    res.raise_for_status()
    old = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    new = res.json()
    for p in _paths(old, new):
        print(p)
    write_snapshot(SNAPSHOT, new)


if __name__ == "__main__":
    main()
