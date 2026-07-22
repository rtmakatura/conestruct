"""Spec §4 cross-surface proof (issue #150): the sheet's summary IS the
XLSX's rows, and required-on-sheet jurisdictions cannot toggle it off.

Parity here is against CURRENT-XLSX behavior by design (Ryan ruling,
2026-07-21, issue #151): jurisdiction count-deltas are not yet applied to
the shared aggregation, so the on-screen breakdown may differ when one
fires.  #151 moves the deltas into the shared helper for all three
surfaces; it removes this caveat.
"""

from __future__ import annotations

import copy

import pytest

from tests.test_plan_sheet_device_summary import (
    FLAGGER_BODY,
    SHOULDER_BODY,
    _placements_for_body,
    pdf_text,
)
from tests.test_plan_sheet_device_summary import (
    _secret as _secret,  # noqa: PLC0414 — autouse env fixture
)
from tests.test_plan_sheet_device_summary import (
    client as client,  # noqa: PLC0414 — TestClient fixture
)


@pytest.mark.parametrize("body", [SHOULDER_BODY, FLAGGER_BODY], ids=["shoulder", "flagger"])
def test_every_xlsx_row_quantity_appears_on_sheet(client, tmp_path, body) -> None:
    from src.rules.device_aggregation import aggregate_device_rows

    body = copy.deepcopy(body)
    placements, _params = _placements_for_body(body)
    text = pdf_text(client, body, tmp_path)
    for row in aggregate_device_rows(placements):
        assert str(row.quantity) in text, (row.device_type, row.label)
    assert str(len(placements)) in text  # totals row


def test_required_jurisdiction_ignores_toggle_off(client, tmp_path) -> None:
    body = copy.deepcopy(SHOULDER_BODY)
    body["jurisdiction_key"] = "loveland"
    body["meta"]["includeDeviceSummary"] = False
    assert "TRAFFIC CONTROL DEVICE SUMMARY" in pdf_text(client, body, tmp_path)


def test_optional_jurisdiction_honors_toggle_off(client, tmp_path) -> None:
    body = copy.deepcopy(SHOULDER_BODY)
    body["jurisdiction_key"] = "cdot"
    body["meta"]["includeDeviceSummary"] = False
    assert "TRAFFIC CONTROL DEVICE SUMMARY" not in pdf_text(client, body, tmp_path)


def test_wave2_gate_trio_all_render_the_block(client, tmp_path) -> None:
    """The BLOCKED.md hard gate, as an executable statement."""
    for key in ("castle_rock", "loveland", "thornton"):
        body = copy.deepcopy(SHOULDER_BODY)
        body["jurisdiction_key"] = key
        body["meta"]["includeDeviceSummary"] = False  # even opted out
        assert "TRAFFIC CONTROL DEVICE SUMMARY" in pdf_text(client, body, tmp_path), key
