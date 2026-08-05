"""Arc 13 / #51 + #98 byte-compare harness.

Dumps every surface the arc touches, before and after; the two dumps
must be byte-identical (zero churn is both migrations' proof):

  * the Arc 12 audit matrix (6 scenarios) — exercises every taper /
    buffer / spacing ``source`` prose branch #98 consolidates
    (flagger one-lane two-way taper prose, lane full-L, shoulder L/3,
    CDOT divergent / supplement-silent / federal buffer branches)
  * a freeway shoulder scenario — the only kind that renders the G1
    W16-2a / W7-3a plaque rows #51 migrates: its ``/render/audit``
    JSON (sign table) AND its ``/render/markdown`` crew narrative
    (sign schedule)

Usage:  python validation-artifacts/committed/arc13-citation-tail-2/dump_arc13_surfaces.py <out-prefix>
        (writes <out-prefix>.json and <out-prefix>-freeway-narrative.md)
"""

from __future__ import annotations

import json
import os
import sys

os.environ.setdefault("RENDER_API_SECRET", "arc13-byte-compare")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from importlib import util as _util  # noqa: E402

_spec = _util.spec_from_file_location(
    "dump_audit_matrix",
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "arc12-citation-tail",
        "dump_audit_matrix.py",
    ),
)
_arc12 = _util.module_from_spec(_spec)
_spec.loader.exec_module(_arc12)

HEADERS = {"Authorization": f"Bearer {os.environ['RENDER_API_SECRET']}"}

FREEWAY_SHOULDER = {
    "kind": "shoulder",
    "meta": {"project": "arc13", "address": "", "lat": 0.0, "lng": 0.0},
    "roadType": "freeway",
    "speed": 65,
    "lanes": 3,
    "laneWidth": 12.0,
    "divided": True,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 1000.0,
    "night": False,
}


def main(out_prefix: str) -> None:
    client = TestClient(app)
    dump = {}
    matrix = dict(_arc12.MATRIX)
    matrix["freeway_shoulder_g1_plaques"] = FREEWAY_SHOULDER
    for name, payload in matrix.items():
        res = client.post("/render/audit", json=payload, headers=HEADERS)
        if res.status_code != 200:
            raise SystemExit(f"{name}: HTTP {res.status_code}: {res.text[:300]}")
        dump[name] = res.json()
    with open(out_prefix + ".json", "w", encoding="utf-8", newline="\n") as f:
        json.dump(dump, f, indent=2, sort_keys=True, ensure_ascii=False)
        f.write("\n")

    res = client.post("/render/markdown", json=FREEWAY_SHOULDER, headers=HEADERS)
    if res.status_code != 200:
        raise SystemExit(f"freeway narrative: HTTP {res.status_code}: {res.text[:300]}")
    md = res.text  # /render/markdown returns the raw Markdown body
    with open(out_prefix + "-freeway-narrative.md", "w", encoding="utf-8", newline="\n") as f:
        f.write(md)
    print(f"wrote {out_prefix}.json ({len(dump)} scenarios) + -freeway-narrative.md")


if __name__ == "__main__":
    main(sys.argv[1])
