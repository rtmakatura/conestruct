"""Add the #224 phase-1 ``sections.site_scan`` leaf to the live-compared
test_audit_endpoint.py baselines (tests/snapshots/*.json, never the
archived ``*_pre_*`` history snapshots).

The drift is the verified single leaf (+ sections.site_scan = the
not_run / not_requested provenance — see rebaseline_check.py's CHECK_ONLY
run); this inserts it through the same canonical encoder the snapshots
were written with, touching nothing else.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.getcwd())

from src.api.site_scan import not_run_provenance  # noqa: E402
from tests._snapshot_helper import write_snapshot  # noqa: E402

LEAF = not_run_provenance("not_requested").model_dump(mode="json")

changed = 0
for path in sorted(Path("tests/snapshots").glob("*.json")):
    if "_pre_" in path.name:
        continue
    data = json.loads(path.read_text(encoding="utf-8"))
    sections = data.get("sections")
    if not isinstance(sections, dict) or "site_scan" in sections:
        continue
    sections["site_scan"] = LEAF
    write_snapshot(path, data)
    changed += 1
    print(f"updated {path.name}")
print(f"total updated: {changed}")
