"""#450 re-baseline: the locked audit snapshots gain ``short_result``.

Posts each locked audit snapshot's own scenario (the one its test posts) to
``/render/audit`` in-process, prints every JSON path that changed, and checks
each path against the Rule 5 prediction in ../checkpoint.md:

- ``sections.colorado.checks[i].short_result`` and
  ``sections.colorado.info_items[i].short_result`` (added);
- ``sections.site_adjustments[i].short_result`` (added, advisory records);
- ``sections.site_adjustments[i].action`` (changed, intersection / interchange).

A path outside that list stops the script before anything is written.
Run from the worktree root:
``uv run --extra dev python validation-artifacts/committed/ux-group5-followup/rebaseline_snapshots.py``
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path.cwd()))
os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.audit import audit_projection, build_audit_trail  # noqa: E402
from src.api.render_api import app  # noqa: E402
from src.generation.layout import generate_flagger_alternating_2lane  # noqa: E402
from src.rules.validators import ScenarioParams  # noqa: E402
from tests._snapshot_helper import write_snapshot  # noqa: E402
from tests.corpus.manifest import GRID_CASES, scenario_body, snapshot_path  # noqa: E402
from tests.test_audit_endpoint import (  # noqa: E402
    _auth_headers,
    _shoulder_at_65,
    _shoulder_at_75,
    _shoulder_scenario,
    _shoulder_urban25,
)

PREDICTED = re.compile(
    r"^\.sections\.(colorado\.(checks|info_items)\[\d+\]\.short_result"
    r"|site_adjustments\[\d+\]\.(short_result|action))$"
)
ROOT = Path("tests/snapshots")


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


def _with(**over: Any) -> dict[str, Any]:
    s = _shoulder_scenario()
    s.update(over)
    return s


def _flagger_projection() -> dict[str, Any]:
    # test_audit_flagger_reduction_fines_double_required_matches_baseline's path.
    params = ScenarioParams(
        speed_mph=45,
        num_lanes=2,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=500.0,
        lane_width_ft=11.0,
        shoulder_width_ft=8.0,
        is_divided=False,
        jurisdiction="CDOT",
        work_zone_speed_mph=30,
    )
    audit = build_audit_trail(generate_flagger_alternating_2lane(params), params)
    return audit_projection(audit, scenario_kind="flagger_lane_closure", step_count=16)


def main() -> None:
    client = TestClient(app)

    def post(s: dict[str, Any]) -> dict[str, Any]:
        res = client.post("/render/audit", headers=_auth_headers(), json=s)
        res.raise_for_status()
        out: dict[str, Any] = res.json()
        return out

    jobs: list[tuple[Path, dict[str, Any]]] = [
        (ROOT / "audit_shoulder_no_reduction.json", post(_shoulder_scenario())),
        (ROOT / "audit_shoulder_65mph.json", post(_shoulder_at_65())),
        (ROOT / "audit_shoulder_75mph.json", post(_shoulder_at_75())),
        (ROOT / "audit_shoulder_reduction_10.json", post(_with(workZoneSpeed=45))),
        (ROOT / "audit_shoulder_reduction_25.json", post(_with(workZoneSpeed=30))),
        (
            ROOT / "audit_shoulder_reduction_65mph_envelope.json",
            post(_with(speed=65, workLen=1000.0, workZoneSpeed=60, roadType="freeway")),
        ),
        (ROOT / "audit_shoulder_urban25_quadratic.json", post(_shoulder_urban25())),
        (ROOT / "audit_flagger_reduction_fines_double_required.json", _flagger_projection()),
    ]
    for case in GRID_CASES:
        res = client.post("/render/audit", headers=_auth_headers(), json=scenario_body(case))
        res.raise_for_status()
        jobs.append((snapshot_path(case.id), res.json()))

    writes: list[tuple[Path, dict[str, Any]]] = []
    bad: list[str] = []
    for path, new in jobs:
        old = json.loads(path.read_text(encoding="utf-8"))
        changed = _paths(old, new)
        if not changed:
            print(f"{path.name}: unchanged")
            continue
        print(f"{path.name}: {len(changed)} path(s)")
        for p in changed:
            ok = bool(PREDICTED.match(p))
            print(f"  {'ok ' if ok else 'BAD'} {p}")
            if not ok:
                bad.append(f"{path.name} {p}")
        writes.append((path, new))
    if bad:
        print(f"{len(bad)} path(s) outside the prediction; nothing written.")
        sys.exit(1)
    for path, new in writes:
        write_snapshot(path, new)
    print(f"wrote {len(writes)} of {len(jobs)} snapshots")


if __name__ == "__main__":
    main()
