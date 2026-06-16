"""Boundary/invalid tier: the tool must fail honestly, not emit a degraded plan.

Each boundary case asserts the HTTP status ``/render/audit`` returns for an input
at or past a validation edge — exercising the honest-failure-mode principle:

  * 422 — the pydantic ``ShoulderScenario`` schema refuses malformed input
    (speed outside 20-75, speed not a multiple of 5, work-zone speed above the
    posted speed).
  * 400 — ``validate_corridor_geometry`` rejects a geometrically impossible
    corridor; the specific ``rule_id`` must appear in
    ``detail.violations[]`` of the response body.
  * 200 — near-edge ACCEPTS (speed 20 and 75) that must still pass, guarding the
    valid envelope from an accidental over-tightening of validation.

A case that behaves opposite to its pin is a FINDING: do NOT relax validation to
make the test pass. The manifest's ``expected_status`` / ``expected_error`` are
the contract; fix the manifest only if the pinned value was wrong.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.corpus.manifest import BOUNDARY_CASES, CorpusCase, scenario_body


@pytest.mark.parametrize("case", BOUNDARY_CASES, ids=lambda c: c.id)
def test_boundary_status_and_error(
    case: CorpusCase, client: TestClient, auth_headers: dict[str, str]
) -> None:
    res = client.post("/render/audit", headers=auth_headers, json=scenario_body(case))
    assert res.status_code == case.expected_status, (
        f"{case.id}: expected HTTP {case.expected_status}, got {res.status_code}. "
        f"A boundary case that does not reject/accept as pinned is a FINDING — "
        f"do not change validation to make this pass. Body: {res.text[:400]}"
    )
    if case.expected_status == 400:
        detail = res.json().get("detail", {})
        rule_ids = {v.get("rule_id") for v in detail.get("violations", [])}
        assert case.expected_error in rule_ids, (
            f"{case.id}: expected geometry rule_id {case.expected_error!r} in the "
            f"400 response, got {sorted(r for r in rule_ids if r)}. "
            f"message: {detail.get('message', '')[:300]}"
        )
