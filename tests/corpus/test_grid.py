"""Current-behavior grid: live projection must equal the locked snapshot.

These snapshots lock today's output as a regression baseline — they are NOT
spec-verified (a snapshot encodes whatever the code computes now). Promotion to
a spec-verified anchor happens by moving the case to ``provenance="spec-verified"``
with hand-authored ``expected`` values (and deleting its snapshot).

PR-1 ships zero grid cases, so this module collects no tests yet; PR-3
populates ``GRID_CASES`` and regenerates snapshots via
``tests._snapshot_helper.write_snapshot`` (canonical encoding).
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from tests.corpus.manifest import GRID_CASES, CorpusCase, scenario_body, snapshot_path


@pytest.mark.parametrize("case", GRID_CASES, ids=lambda c: c.id)
def test_grid_matches_snapshot(
    case: CorpusCase, client: TestClient, auth_headers: dict[str, str]
) -> None:
    res = client.post("/render/audit", headers=auth_headers, json=scenario_body(case))
    assert res.status_code == 200, res.text
    path = snapshot_path(case.id)
    assert path.exists(), (
        f"missing snapshot for {case.id} at {path}. Regenerate with "
        f"tests._snapshot_helper.write_snapshot(path, projection)."
    )
    expected = json.loads(path.read_text(encoding="utf-8"))
    assert res.json() == expected, (
        f"{case.id}: /render/audit projection drifted from its locked snapshot. "
        f"If the change is intended, re-baseline via write_snapshot; otherwise a "
        f"computed value regressed."
    )
