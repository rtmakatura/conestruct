"""#285: how far each shared node sits from the centerline it is placed on.

    python lateral285.py

Traces LATERAL_TOLERANCE_M.  For every recorded case, the lateral distance
of each shared node to (a) the recorded stitch and, for Broadway, (b) the
picker's own relayed geometry (tests/fixtures/corridor/broadway-sb.json).
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from src.rules.nearest_intersection import _station  # noqa: E402

FIX = ROOT / "tests" / "fixtures"


def laterals(case, line):
    d = json.loads((FIX / "nearest_intersection" / f"{case}.json").read_text(encoding="utf-8"))
    nodes = [(e["lat"], e["lon"]) for e in d["overpass"]["elements"] if e["type"] == "node"]
    return sorted(round(_station(lat, lng, line)[1], 2) for lat, lng in nodes)


for case in ("broadway", "us24_hartsel", "us287_lamar", "boulder_canyon", "lookout"):
    d = json.loads((FIX / "nearest_intersection" / f"{case}.json").read_text(encoding="utf-8"))
    print(f"{case}: on the recorded stitch, node laterals (m) = {laterals(case, [tuple(p) for p in d['centerline']])}")

bw = json.loads((FIX / "corridor" / "broadway-sb.json").read_text(encoding="utf-8"))
picker = [tuple(p) for p in bw["meta"]["confirmedRoad"]["candidate"]["geometry"]]
print(f"broadway on the PICKER's geometry, node laterals (m) = {laterals('broadway', picker)}")
