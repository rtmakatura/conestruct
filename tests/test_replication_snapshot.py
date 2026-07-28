"""Dev-only replication-snapshot endpoint (Refs #102).

The snapshot is diagnostic scaffolding: one markdown blob containing the
full audit projection, quote content, device-list content, and crew
narrative for a scenario — sourced from the SAME shared functions the
real deliverables use (rule #3: reuse, don't reimplement).  These tests
pin (a) the endpoint contract, (b) that each section carries real
content from its canonical source, and (c) that the gate/validation
behavior matches the sibling render endpoints.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client() -> TestClient:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
    from src.api.render_api import app

    return TestClient(app)


def _auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-secret-do-not-deploy"}


def _shoulder_body() -> dict:
    return {
        "kind": "shoulder",
        "meta": {"project": "Snapshot Test"},
        "roadType": "freeway",
        "speed": 55,
        "lanes": 2,
        "laneWidth": 12,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
    }


def _post_snapshot(client: TestClient, body: dict | None = None, settings: dict | None = None):
    payload: dict = {"scenario": body or _shoulder_body()}
    if settings is not None:
        payload["settings"] = settings
    return client.post("/render/replication-snapshot", headers=_auth_headers(), json=payload)


def test_snapshot_returns_markdown_with_all_backend_sections(client: TestClient) -> None:
    res = _post_snapshot(client)
    assert res.status_code == 200, res.text
    assert res.headers["content-type"].startswith("text/markdown")
    text = res.text
    for header in (
        "## 3 Audit projection",
        "## 4 Quote",
        "## 5 Device list",
        "## 6 Crew narrative",
    ):
        assert header in text, f"missing section header: {header}"
    # Plan-sheet exclusion is explicit in the backend half too.
    assert "plan-sheet" in text.lower()


def test_snapshot_audit_section_is_the_full_projection(client: TestClient) -> None:
    """The audit section is a verbatim JSON dump of _audit_projection_for —
    spot-check the fields the spec names (plan_flags, TA, step count)."""
    res = _post_snapshot(client)
    text = res.text
    for key in ('"plan_flags"', '"is_clean"', '"ta"', '"step_count"', '"pending_verification"'):
        assert key in text, f"audit projection key missing from snapshot: {key}"
    # Road-type-aware TA for a freeway shoulder plan (#100).
    assert '"TA-5"' in text


def test_snapshot_quote_section_matches_quote_breakdown(client: TestClient) -> None:
    """Every equipment line the real quote endpoint returns appears in the
    snapshot's quote table (description + qty), sourced from the same
    QuoteBreakdown — not a re-derivation."""
    res = _post_snapshot(client)
    assert res.status_code == 200, res.text
    breakdown = client.post(
        "/render/quote-breakdown",
        headers=_auth_headers(),
        json={"scenario": _shoulder_body()},
    ).json()
    assert breakdown["equipment_lines"], "fixture produced no equipment lines"
    for line in breakdown["equipment_lines"]:
        assert line["description"] in res.text, (
            f"quote row missing from snapshot: {line['description']!r}"
        )
    # Totals surface too.
    assert f"{breakdown['total']:.2f}" in res.text


def test_snapshot_quote_section_reflects_settings(client: TestClient) -> None:
    """Non-default quote settings flow into the snapshot the same way they
    flow into /render/quote (same QuoteRequest model, same _run_quote)."""
    res = _post_snapshot(client, settings={"project_duration_days": 3, "num_flaggers": 2})
    assert res.status_code == 200, res.text
    breakdown = client.post(
        "/render/quote-breakdown",
        headers=_auth_headers(),
        json={
            "scenario": _shoulder_body(),
            "settings": {"project_duration_days": 3, "num_flaggers": 2},
        },
    ).json()
    assert f"{breakdown['total']:.2f}" in res.text


def test_snapshot_device_list_section_carries_the_xlsx_rows(client: TestClient) -> None:
    """The device-list section is read back from the same workbook
    export_device_list ships — pay-item numbers and the resolved cone
    description are the tell."""
    res = _post_snapshot(client)
    text = res.text
    assert "630-80380" in text  # CONE CDOT pay item — only the XLSX carries this column
    assert "Traffic Cone (36-inch)" in text  # 55 mph — resolved size (#101)
    # Both section markers exist and in order (4 before 5).
    assert text.index("## 4 Quote") < text.index("## 5 Device list")
    # Night/multiplier scalars from QuoteBreakdown surface in the totals.
    assert "Night operation: False" in text


def test_snapshot_crew_narrative_embedded_verbatim(client: TestClient) -> None:
    """Section 6 is the same markdown /render/markdown returns."""
    res = _post_snapshot(client)
    md = client.post("/render/markdown", headers=_auth_headers(), json=_shoulder_body()).text
    narrative_section = res.text.split("## 6 Crew narrative", 1)[1]
    # The full narrative body (everything after its title line) is embedded.
    # Normalize newlines: /render/markdown round-trips through a file write
    # (CRLF on Windows); the snapshot embeds the in-memory string (LF).
    narrative_body = md.replace("\r\n", "\n").split("\n", 1)[1]
    assert narrative_body.strip() in narrative_section.replace("\r\n", "\n"), (
        "crew narrative not embedded verbatim"
    )


def test_snapshot_gated_kind_rejected(client: TestClient) -> None:
    """Gated kinds 400 at the door, same as every sibling endpoint."""
    body = {
        "kind": "lane_closure_divided",
        "meta": {"project": "gated"},
        "roadType": "rural_divided",
        "speed": 55,
        "laneWidth": 12.0,
        "workType": "pavement_repair",
        "duration": "short",
        "workLen": 800.0,
        "night": False,
        "truckMountedAttenuator": False,
    }
    res = _post_snapshot(client, body=body)
    assert res.status_code == 400


def test_snapshot_invalid_geometry_survives_as_refused(client: TestClient) -> None:
    """#178 item 1: a geometry-refused scenario produces a snapshot that
    says so instead of a 400 — the diagnostic must not die in exactly the
    states it exists to document.  (Inverts the pre-#178 pin that
    asserted the 400 passed through.)"""
    body = {**_shoulder_body(), "workLen": 10}
    res = _post_snapshot(client, body=body)
    assert res.status_code == 200, res.text
    assert "## 3 GENERATION REFUSED" in res.text
    # The structured 400 detail is quoted verbatim, not summarized.
    assert "geometry_validation_failed" in res.text
    # Nothing downstream of the refused pipeline is fabricated.
    for header in ("## 4 Quote", "## 5 Device list", "## 6 Crew narrative"):
        assert header not in res.text


def test_snapshot_survives_gate_refusal_with_verbatim_detail(client: TestClient) -> None:
    """#178 item 1, the Colfax shape: the #86 multilane flagger gate
    refuses, and the snapshot carries the refusal message verbatim —
    before this arc, attempting the Colfax snapshot pre-confirm returned
    an error, not evidence."""
    from tests.test_plan_sheet_device_summary import FLAGGER_BODY

    body = {**FLAGGER_BODY, "detectedLanesTotal": 5, "detectedLanesForward": 3}
    res = _post_snapshot(client, body=body)
    assert res.status_code == 200, res.text
    assert "## 3 GENERATION REFUSED" in res.text
    # The #86 gate's own words, not a paraphrase.
    assert "more lanes than a flagger" in res.text
    assert "## 4 Quote" not in res.text


def test_snapshot_carries_backend_sha_in_both_paths(client: TestClient) -> None:
    """#178 item 2: the backend sha line appears under the section-3
    header on the normal path AND the refused path (same GIT_SHA sentinel
    convention as /healthz — "unknown" when unstamped, never fabricated)."""
    normal = _post_snapshot(client)
    assert "Backend: GIT_SHA=" in normal.text
    refused = _post_snapshot(client, body={**_shoulder_body(), "workLen": 10})
    assert "Backend: GIT_SHA=" in refused.text
