"""R108 / R110 -- a guessed street class or jurisdiction, recorded honestly.

Authority: validation-artifacts/committed/setup-what-redesign/rulings.md.

R108: "No confirm step for guesses. Street class (from the road) and
jurisdiction (from the pin) are prefilled ... The audit must say each
guessed value's source and that the operator didn't confirm it (Rule 10)."

R110 Q1: "Optional guesses wire field with the raw fact, the backend
recomputes, the tag table moves to the backend, a stale entry gets an
honest 400, no entry is byte-identical."  Q2: "Keep guesses out of
pending_verification."  Q3: "add '(guessed from the pin, not confirmed)'
to the XLSX and crew-sheet jurisdiction line."

Tested where each fact lives (Rule 11): the wire (an endpoint's 400 and
its audit JSON), the deliverables' own producers (the XLSX Summary rows,
the crew context, the audit PDF blocks).
"""

from __future__ import annotations

import os
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.api.schemas import ShoulderScenario, scenario_to_call
from src.rendering.audit_blocks import audit_to_blocks
from src.rules.street_class import STREET_CLASS_BY_HIGHWAY, street_class_from_highway
from src.rules.validators import jurisdiction_display

# Colorado State Capitol: deep inside Denver (tests/test_boundary_suggest.py's
# own golden pin, well clear of the 500 ft warning band).
DENVER = (39.7392, -104.9903)
# Belmar, central Lakewood (the same suite's pin).
LAKEWOOD = (39.7080, -105.0810)

GUESSED = "(guessed from the pin, not confirmed)"


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def _auth() -> dict[str, str]:
    return {"Authorization": "Bearer test-secret-do-not-deploy"}


def _body(**over: Any) -> dict[str, Any]:
    """An urban arterial shoulder plan pinned at the Capitol.  No work
    side and no bearing, so nothing in the audit leaves the process."""
    body: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "T", "address": "", "lat": DENVER[0], "lng": DENVER[1]},
        "roadType": "urban_arterial",
        "speed": 30,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
    }
    body.update(over)
    return body


def _guessed_body() -> dict[str, Any]:
    return _body(
        jurisdiction_key="denver",
        street_class="arterial",
        guesses={
            "street_class": {"highwayClass": "primary"},
            "jurisdiction_key": {"lat": DENVER[0], "lng": DENVER[1]},
        },
    )


# --------------------------------------------------------------------------- #
# The tag table moved to the backend (Q1).
# --------------------------------------------------------------------------- #


def test_the_street_class_table_is_the_backends() -> None:
    assert street_class_from_highway("primary") == "arterial"
    assert street_class_from_highway("tertiary") == "collector"
    assert street_class_from_highway("residential") == "local"
    # A tag the table does not know guesses nothing (Rule 10).
    assert street_class_from_highway("footway") is None
    assert set(STREET_CLASS_BY_HIGHWAY.values()) == {"arterial", "collector", "local"}


# --------------------------------------------------------------------------- #
# No entry is byte-identical (Q1).
# --------------------------------------------------------------------------- #


def test_no_guesses_means_no_input_guesses_key(client: TestClient) -> None:
    res = client.post("/render/audit", json=_body(jurisdiction_key="denver"), headers=_auth())
    assert res.status_code == 200, res.text
    assert "input_guesses" not in res.json()


def test_no_guesses_leaves_the_named_jurisdiction_unqualified() -> None:
    params, _gen, _kw = scenario_to_call(ShoulderScenario(**_body(jurisdiction_key="denver")))
    assert params.jurisdiction_guessed is False
    assert jurisdiction_display(params) == "Denver"


def test_an_explicit_null_guesses_is_the_same_as_none(client: TestClient) -> None:
    a = client.post("/render/audit", json=_body(jurisdiction_key="denver"), headers=_auth())
    b = client.post(
        "/render/audit", json=_body(jurisdiction_key="denver", guesses=None), headers=_auth()
    )
    assert a.json() == b.json()


# --------------------------------------------------------------------------- #
# A verified guess: the audit says its source and that nobody confirmed it.
# --------------------------------------------------------------------------- #


def test_the_audit_records_each_guess_with_its_source(client: TestClient) -> None:
    res = client.post("/render/audit", json=_guessed_body(), headers=_auth())
    assert res.status_code == 200, res.text
    guesses = res.json()["input_guesses"]
    by_field = {g["field"]: g for g in guesses}
    assert set(by_field) == {"street_class", "jurisdiction_key"}

    sc = by_field["street_class"]
    assert sc["value"] == "arterial"
    assert sc["source"] == "road"
    assert sc["operator_confirmed"] is False
    assert "highway=primary" in sc["evidence"]

    jk = by_field["jurisdiction_key"]
    assert jk["value"] == "denver"
    assert jk["source"] == "pin"
    assert jk["operator_confirmed"] is False
    assert "Denver" in jk["evidence"]
    assert "TIGER" in jk["evidence"]


def test_guesses_stay_out_of_pending_verification(client: TestClient) -> None:
    """Q2: a guessed plan reads exactly as clean as an operator-set one."""
    plain = client.post(
        "/render/audit",
        json=_body(jurisdiction_key="denver", street_class="arterial"),
        headers=_auth(),
    ).json()
    guessed = client.post("/render/audit", json=_guessed_body(), headers=_auth()).json()
    assert guessed["pending_verification"] == plain["pending_verification"]
    assert guessed["plan_flags"] == plain["plan_flags"]


def test_the_guessed_jurisdiction_line_says_so_on_xlsx_and_crew() -> None:
    """Q3: one producer, both deliverables."""
    params, _gen, _kw = scenario_to_call(ShoulderScenario(**_guessed_body()))
    assert params.jurisdiction_guessed is True
    assert jurisdiction_display(params) == f"Denver {GUESSED}"


def test_the_xlsx_summary_prints_the_qualified_line() -> None:
    from openpyxl import Workbook

    from src.export.device_list import _populate_summary_sheet

    params, _gen, _kw = scenario_to_call(ShoulderScenario(**_guessed_body()))
    wb = Workbook()
    _populate_summary_sheet(wb.active, params, [])
    rows = {r[0]: r[1] for r in wb.active.iter_rows(values_only=True)}
    assert rows["Jurisdiction"] == f"Denver {GUESSED}"


def test_the_crew_sheet_prints_the_qualified_line(client: TestClient) -> None:
    res = client.post("/render/markdown", json=_guessed_body(), headers=_auth())
    assert res.status_code == 200, res.text
    assert f"**Jurisdiction:** Denver {GUESSED}" in res.text


def test_a_crew_sheet_with_no_guess_prints_the_bare_name(client: TestClient) -> None:
    res = client.post("/render/markdown", json=_body(jurisdiction_key="denver"), headers=_auth())
    assert res.status_code == 200, res.text
    assert "**Jurisdiction:** Denver\n" in res.text.replace("\r\n", "\n")


def test_the_audit_pdf_prints_one_line_per_guess(client: TestClient) -> None:
    projection = client.post("/render/audit", json=_guessed_body(), headers=_auth()).json()
    text = repr(audit_to_blocks(projection))
    assert "Guessed inputs" in text
    assert "Jurisdiction: Denver. Guessed from the pin" in text
    assert "Street class: Arterial. Guessed from the road (OSM highway=primary)" in text
    assert text.count("The operator did not confirm it.") == 2
    # Rule 10: the boundary caveat and the map caveat ride the record.
    assert "Confirm the jurisdiction with the permitting authority." in text
    assert "The jurisdiction's adopted classification map governs." in text


def test_an_audit_pdf_with_no_guesses_has_no_block(client: TestClient) -> None:
    projection = client.post(
        "/render/audit", json=_body(jurisdiction_key="denver"), headers=_auth()
    ).json()
    assert "Guessed inputs" not in repr(audit_to_blocks(projection))


# --------------------------------------------------------------------------- #
# A stale entry is an honest 400 (Q1), at the chokepoint every path shares.
# --------------------------------------------------------------------------- #


def _stale(res: Any) -> dict[str, Any]:
    assert res.status_code == 400, res.text
    detail = res.json()["detail"]
    assert detail["error"] == "guess_stale"
    return detail


def test_a_street_class_that_no_longer_matches_its_tag_is_refused(client: TestClient) -> None:
    body = _guessed_body()
    body["street_class"] = "local"  # primary guesses arterial
    detail = _stale(client.post("/render/audit", json=body, headers=_auth()))
    assert "Street class" in detail["message"]


def test_an_unmapped_tag_is_refused(client: TestClient) -> None:
    body = _guessed_body()
    body["guesses"]["street_class"] = {"highwayClass": "footway"}
    _stale(client.post("/render/audit", json=body, headers=_auth()))


def test_a_guess_entry_over_an_empty_field_is_refused(client: TestClient) -> None:
    body = _guessed_body()
    body["jurisdiction_key"] = None
    _stale(client.post("/render/audit", json=body, headers=_auth()))


def test_a_jurisdiction_guessed_at_another_pin_is_refused(client: TestClient) -> None:
    body = _guessed_body()
    body["guesses"]["jurisdiction_key"] = {"lat": LAKEWOOD[0], "lng": LAKEWOOD[1]}
    detail = _stale(client.post("/render/audit", json=body, headers=_auth()))
    assert "Jurisdiction" in detail["message"]


def test_a_jurisdiction_the_pin_does_not_guess_is_refused(client: TestClient) -> None:
    body = _guessed_body()
    body["jurisdiction_key"] = "lakewood"  # the Capitol pin guesses Denver
    _stale(client.post("/render/audit", json=body, headers=_auth()))


@pytest.mark.parametrize(
    "path", ["/render/pdf", "/render/device-breakdown", "/render/xlsx", "/render/audit-pdf"]
)
def test_every_render_path_refuses_a_stale_guess(client: TestClient, path: str) -> None:
    body = _guessed_body()
    body["street_class"] = "collector"
    _stale(client.post(path, json=body, headers=_auth()))
