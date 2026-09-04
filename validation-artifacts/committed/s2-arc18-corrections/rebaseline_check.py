"""Verify the snapshot drift is EXACTLY the #224 phase-4
``sections.site_scan.corrections`` leaf, then re-baseline.

Run with CHECK_ONLY=1 to only report the diff; without it, rewrites every
drifted snapshot via tests._snapshot_helper.write_snapshot (canonical
encoding).  The 8 live-compared test_audit_endpoint.py baselines are
handled by rebaseline_endpoint.py (same leaf, same canonical encoder).
s2-arc18 copy of the s2-arc15 / s2-arc12 script; only this docstring
differs.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, os.getcwd())
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"

from src.api.render_api import app  # noqa: E402
from tests._snapshot_helper import write_snapshot  # noqa: E402
from tests.corpus.manifest import GRID_CASES, scenario_body, snapshot_path  # noqa: E402

AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}


def _diff_paths(old, new, prefix=""):
    """Yield leaf paths present/changed between two JSON values."""
    if isinstance(old, dict) and isinstance(new, dict):
        for k in sorted(set(old) | set(new)):
            p = f"{prefix}.{k}" if prefix else k
            if k not in old:
                yield f"+ {p} = {new[k]!r}"
            elif k not in new:
                yield f"- {p}"
            else:
                yield from _diff_paths(old[k], new[k], p)
    elif old != new:
        yield f"~ {prefix}: {old!r} -> {new!r}"


def main() -> None:
    check_only = os.environ.get("CHECK_ONLY") == "1"
    client = TestClient(app)
    all_diffs: set[str] = set()
    drifted = 0

    for case in GRID_CASES:
        res = client.post("/render/audit", headers=AUTH, json=scenario_body(case))
        assert res.status_code == 200, (case.id, res.text)
        path = snapshot_path(case.id)
        old = json.loads(path.read_text(encoding="utf-8"))
        new = res.json()
        if old != new:
            drifted += 1
            for d in _diff_paths(old, new):
                all_diffs.add(d)
            if not check_only:
                write_snapshot(path, new)

    print(f"grid cases drifted: {drifted}/{len(GRID_CASES)}")
    for d in sorted(all_diffs):
        print(" ", d)


if __name__ == "__main__":
    main()
