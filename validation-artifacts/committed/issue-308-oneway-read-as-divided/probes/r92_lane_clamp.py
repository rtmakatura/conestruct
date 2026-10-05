"""#308 R92 — does the 4-lanes-per-direction clamp change any device on Broadway plans?

North Broadway's OSM ``lanes=5`` reaches the plan as 4 (``clampLanesToDomain``,
``conestruct/site/lib/scenarios/validation.ts:27,69-72``); the wire caps lanes at 4
(``src/api/schemas.py:412``). The wire can't carry 5, so this probe builds the
Broadway shoulder plan's ``ScenarioParams`` through the real bridge
(``scenario_to_call`` on ``tests/fixtures/corridor/broadway-sb.json``), then calls the
generator directly at 4 lanes and at 5, each with the lane width the site's
``laneWidthCeilingFt`` would fit (floor(((52 - shoulder) / lanes) * 2) / 2, capped at
the fixture's 10.5 ft... see LANE_WIDTH below), and diffs every placement.

Run twice: as today (divided, 10 ft shoulder) and as #308 will build it
(undivided one-way street, 8 ft shoulder, the undivided generator).
No network.  Writes r92_lane_clamp.txt beside itself.
"""

from __future__ import annotations

import json
import math
import sys
from collections import Counter
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))

from pydantic import TypeAdapter  # noqa: E402

from src.api.schemas import Scenario, scenario_to_call  # noqa: E402
from src.generation.layout import (  # noqa: E402
    generate_shoulder_closure_divided,
    generate_shoulder_closure_undivided,
)

DRAWABLE = 52.0  # MAX_DRAWABLE_HALF_ROAD_FT, validation.ts:28


def ceiling(shoulder: float, lanes: int) -> float:
    return math.floor(((DRAWABLE - shoulder) / lanes) * 2) / 2


body = json.loads((ROOT / "tests/fixtures/corridor/broadway-sb.json").read_text(encoding="utf-8"))
body["meta"].pop("work", None)
body["meta"].pop("pinModel", None)
params, _fn, _kw = scenario_to_call(TypeAdapter(Scenario).validate_python(body))

out = []
for label, gen, divided, shoulder in (
    ("today: divided, 10 ft shoulder", generate_shoulder_closure_divided, True, 10.0),
    ("#308: one-way street (undivided generator), 8 ft shoulder", generate_shoulder_closure_undivided, False, 8.0),
):
    runs = {}
    for lanes in (4, 5):
        lw = min(body["laneWidth"] if lanes == 4 and divided else 12.0, ceiling(shoulder, lanes))
        p = replace(params, num_lanes=lanes, lane_width_ft=lw, is_divided=divided, shoulder_width_ft=shoulder)
        runs[lanes] = (lw, gen(p, shoulder_width_ft=shoulder))
    out.append(f"== {label}")
    for lanes, (lw, pl) in runs.items():
        out.append(f"   lanes={lanes} lane_width={lw} ft  devices={len(pl)}  by type={dict(sorted(Counter(x.device_type.value for x in pl).items()))}")
    a, b = runs[4][1], runs[5][1]
    key = lambda x: (x.device_type.value, x.label or "", round(x.station_ft, 1))  # noqa: E731
    sa = sorted(a, key=key)
    sb = sorted(b, key=key)
    same_set = [key(x) for x in sa] == [key(x) for x in sb]
    out.append(f"   same devices, labels and stations at 4 vs 5 lanes: {same_set}")
    moved = [(key(x), x.offset_ft, y.offset_ft) for x, y in zip(sa, sb) if same_set and abs(x.offset_ft - y.offset_ft) > 0.01]
    out.append(f"   devices whose lateral offset moves: {len(moved)}")
    for k, o4, o5 in moved[:12]:
        out.append(f"      {k[0]:22} {k[1]:14} station {k[2]:>8}  offset {o4:+.1f} ft -> {o5:+.1f} ft")
    if len(moved) > 12:
        out.append(f"      ... {len(moved) - 12} more")

text = "\n".join(out) + "\n"
Path(__file__).with_name("r92_lane_clamp.txt").write_text(text, encoding="utf-8", newline="\r\n")
print(text)
