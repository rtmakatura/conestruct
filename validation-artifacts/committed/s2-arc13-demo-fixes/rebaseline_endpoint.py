"""Move the #229 taper.source leaf in the non-grid test_audit_endpoint.py
baselines (tests/snapshots/*.json, active files only — ``_pre_`` archives
are frozen history and stay as written).

The drift is the verified single leaf (sections.taper.source, see
rebaseline-check-only.txt); this rewrites exactly that sentence through
the same canonical encoder the snapshots were written with.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.getcwd())

from src.api import audit as a  # noqa: E402
from tests._snapshot_helper import write_snapshot  # noqa: E402

OLD = (
    f"MUTCD 11th Ed. Sec {a._SEC_TAPER}, Table {a._TBL_TAPER}. Shoulder closures use L/3 "
    f"per Sec {a._SEC_TAPER} (Table {a._TBL_TAPER})."
)
NEW = (
    f"MUTCD 11th Ed. Sec {a._SEC_TAPER}, Table {a._TBL_TAPER_L} (taper length L). "
    f"Shoulder closures use L/3 per Sec {a._SEC_TAPER} (Table {a._TBL_TAPER})."
)

changed = 0
for path in sorted(Path("tests/snapshots").glob("*.json")):
    if "_pre_" in path.name:
        continue
    data = json.loads(path.read_text(encoding="utf-8"))
    taper = (data.get("sections") or {}).get("taper")
    if isinstance(taper, dict) and taper.get("source") == OLD:
        taper["source"] = NEW
        write_snapshot(path, data)
        changed += 1
        print(f"updated {path.name}")
print(f"total updated: {changed}")
