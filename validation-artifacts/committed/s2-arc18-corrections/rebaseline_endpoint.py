"""Add the #224 phase-4 ``sections.site_scan.corrections`` leaf to the
live-compared test_audit_endpoint.py baselines (tests/snapshots/*.json,
never the archived ``*_pre_*`` history snapshots).

The drift is the verified single leaf (+ sections.site_scan.corrections =
[] — see rebaseline_check.py's CHECK_ONLY run, check-only-corpus.txt);
this inserts it through the same canonical encoder the snapshots were
written with, touching nothing else.  s2-arc18 copy of the s2-arc15
script; the leaf and this docstring differ.
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
    if "_pre_" in path.name:
        continue
    data = json.loads(path.read_text(encoding="utf-8"))
    scan = (data.get("sections") or {}).get("site_scan")
    if not isinstance(scan, dict) or "corrections" in scan:
        continue
    scan["corrections"] = []
    write_snapshot(path, data)
    changed += 1
    print(f"updated {path.name}")
print(f"total updated: {changed}")
