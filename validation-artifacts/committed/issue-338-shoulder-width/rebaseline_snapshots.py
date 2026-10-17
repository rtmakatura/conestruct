"""#338 re-baseline: apply exactly the predicted change to every locked audit snapshot.

Q1 = B adds two things to a shoulder plan's ``sections.taper`` and nothing
else: ``shoulder_width_basis: "assumed"`` and a leading
``W = <offset_ft> ft (assumed)`` line in ``formula_text``.  This script
writes only that into the old snapshots (canonical encoding).  If the suite
is green afterwards, the live diff was exactly the prediction.
Run from the repo root: ``uv run python validation-artifacts/committed/issue-338-shoulder-width/rebaseline_snapshots.py``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))
from tests._snapshot_helper import write_snapshot  # noqa: E402

changed = []
skipped = []
for path in sorted(Path("tests/snapshots").rglob("*.json")):
    data = json.loads(path.read_text(encoding="utf-8"))
    taper = (data.get("sections") or {}).get("taper") if isinstance(data, dict) else None
    if not isinstance(taper, dict) or taper.get("closure_type") != "shoulder":
        continue
    if taper.get("shoulder_width_basis") == "assumed":
        continue
    if "formula_text" not in taper:
        # Pre-#286 shape: no live endpoint produces it; the suite proves
        # whether anything still compares against it.
        skipped.append(path.as_posix())
        continue
    taper["shoulder_width_basis"] = "assumed"
    taper["formula_text"] = [f"W = {taper['offset_ft']:g} ft (assumed)"] + taper["formula_text"]
    write_snapshot(path, data)
    changed.append(path.as_posix())
print(len(changed), "snapshots re-baselined")
for p in changed:
    print(" ", p)
print(len(skipped), "skipped (no formula_text)")
for p in skipped:
    print(" ", p)
