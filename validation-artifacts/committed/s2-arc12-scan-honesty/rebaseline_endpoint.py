"""Add the #213 V4 reason leaf to the test_audit_endpoint.py baselines.

The drift is the verified single leaf (+ sections.corridor_validation.
reason = 'not_run_no_coords' — see rebaseline_check.py's CHECK_ONLY run);
this inserts it through the same canonical encoder the snapshots were
written with, touching nothing else.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.getcwd())

from tests._snapshot_helper import write_snapshot  # noqa: E402

changed = 0
for path in sorted(Path("tests/snapshots").glob("*.json")):
    data = json.loads(path.read_text(encoding="utf-8"))
    sections = data.get("sections")
    if not isinstance(sections, dict):
        continue
    cv = sections.get("corridor_validation")
    if isinstance(cv, dict) and cv.get("checked") is False and "reason" not in cv:
        cv["reason"] = "not_run_no_coords"
        write_snapshot(path, data)
        changed += 1
        print(f"updated {path.name}")
print(f"total updated: {changed}")
