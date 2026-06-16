"""Spec-verified anchors: live computation must equal hand-authored ground truth.

Each anchor's ``expected`` maps a dotted path into the ``/render/audit``
projection to the value the spec requires. A mismatch means the code disagrees
with the cited spec — do NOT fix it here: mark the case
``@pytest.mark.xfail(reason="bug #NN: computed X, spec Y")`` and file the issue
(see the corpus build plan).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.corpus.manifest import ANCHOR_CASES, CorpusCase, resolve_path, scenario_body

# Quantities whose spec value is a repeating decimal (the shoulder taper L/3 of
# a quadratic/linear L, e.g. 88.888... at 40 mph) are compared with a small
# tolerance so the anchor can carry the spec's 2-dp value (88.89) verbatim.
# Everything else — buffer and both device spacings — is exact.
_APPROX_PATHS = frozenset({"summary.taper_length_ft"})
_APPROX_ABS = 0.01


@pytest.mark.parametrize("case", ANCHOR_CASES, ids=lambda c: c.id)
def test_anchor_matches_spec(
    case: CorpusCase, client: TestClient, auth_headers: dict[str, str]
) -> None:
    res = client.post("/render/audit", headers=auth_headers, json=scenario_body(case))
    assert res.status_code == 200, res.text
    projection = res.json()
    for dotted, want in case.expected.items():
        got = resolve_path(projection, dotted)
        if dotted in _APPROX_PATHS:
            matches = got == pytest.approx(want, abs=_APPROX_ABS)
            tol = f" (abs={_APPROX_ABS})"
        else:
            matches = got == want
            tol = ""
        assert matches, (
            f"{case.id}: {dotted} = {got!r}, spec expects {want!r}{tol}. "
            f"If the code is right and the spec value is wrong, fix the anchor; "
            f"if the spec is right, xfail this case and file a bug — do not "
            f"change rules-engine behavior here. Citation: {case.citation}"
        )
