"""Ped/bike accommodation (#125) + emergency access (#124) narrative sections.

Both are CDOT 630.10(a) MHT-minimum elements and both render on EVERY
plan (rule 10: the no-facility / no-computable-content case states
itself explicitly — an absent section reads as an unanswered question
on a field document).  Statements derive from what the plan actually
carries (placements + fired adjustment records), never input flags
alone; jurisdiction rules are quoted from the corpus with citations and
render only for the matching jurisdiction_key (phase-4 ruling: an
inapplicable rule is noise).

Rendered-output tests (rule 11): the served markdown and the crew PDF's
extracted text, through the real endpoints.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import src.api.render_api as render_api
from src.api.render_api import app
from tests.test_lane_confidence_block import _ni_body
from tests.test_plan_sheet_device_summary import FLAGGER_BODY, SHOULDER_BODY

AUTH = {"Authorization": "Bearer test-secret"}

PED_HEADING = "## Pedestrian and Bicycle Accommodation"
EA_HEADING = "## Emergency Access"


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


def _markdown(client, body) -> str:
    resp = client.post("/render/markdown", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text
    return resp.text


# ---------------------------------------------------------------------------
# Always-rendered (rule 10)
# ---------------------------------------------------------------------------


def test_both_sections_render_on_a_plain_plan_with_explicit_statements(client):
    text = _markdown(client, SHOULDER_BODY)
    assert PED_HEADING in text
    assert EA_HEADING in text
    # No facility flagged -> the explicit statement, never silence.
    assert "No pedestrian or bicycle facility is flagged as affected" in text
    # Shoulder closure's computable fact.
    assert "the closure occupies the shoulder only" in text
    # The MHT-minimum element named, and the TCS assignment cited.
    assert "CDOT 630.10(a)" in text
    assert "630.11, TCS duty 4" in text


def test_flagger_emergency_access_states_the_flagger_gate(client):
    text = _markdown(client, FLAGGER_BODY)
    assert EA_HEADING in text
    assert "controlled at the flagger stations" in text


def test_near_intersection_states_open_lane_traversability(client, monkeypatch):
    monkeypatch.setattr(
        render_api,
        "ENABLED_SCENARIOS",
        frozenset({"shoulder", "flagger_lane_closure", "near_intersection"}),
    )
    text = _markdown(client, _ni_body())
    # Default NI mainline: 2 lanes per direction, rightmost closed.
    assert "1 of 2 same-direction travel lane remains open" in text
    assert "traversable width" in text


# ---------------------------------------------------------------------------
# Affected statements derive from the plan's own devices
# ---------------------------------------------------------------------------


def test_pedestrian_facility_statement_counts_the_placed_r9_9s(client):
    body = {
        **SHOULDER_BODY,
        "meta": {**SHOULDER_BODY["meta"], "siteConditions": {"pedestrian_facility": True}},
    }
    text = _markdown(client, body)
    assert "A pedestrian facility is affected" in text
    assert "2 R9-9 SIDEWALK CLOSED signs are placed" in text
    assert "§6G.10" in text
    assert "No pedestrian or bicycle facility is flagged" not in text


def test_bicycle_facility_statement_counts_the_placed_m4_9as(client):
    body = {
        **SHOULDER_BODY,
        "meta": {
            **SHOULDER_BODY["meta"],
            "siteConditions": {"bicycle_facility": True},
        },
    }
    text = _markdown(client, body)
    assert "A bicycle facility is affected" in text
    assert "2 M4-9a BIKE DETOUR signs are placed" in text
    assert "§9C.101" in text


def test_flagger_pedestrian_access_reaches_the_section(client):
    body = {**FLAGGER_BODY, "pedestrianAccess": True}
    text = _markdown(client, body)
    assert "A pedestrian facility is affected" in text
    # The flagger generator emits its own R9-9 pair.
    assert "R9-9 SIDEWALK CLOSED" in text


# ---------------------------------------------------------------------------
# Jurisdiction-scoped rules (quoted from 02-JURISDICTION-DATA, re-verified
# by subject 2026-08-03) render exactly where they apply
# ---------------------------------------------------------------------------


def test_littleton_renders_the_leds_131_quote(client):
    body = {**SHOULDER_BODY, "jurisdiction_key": "littleton"}
    text = _markdown(client, body)
    assert "Littleton LEDS §131" in text
    assert "An accessible pedestrian and bicycle route, per MUTCD" in text


def test_denver_renders_the_tcp_depiction_note(client):
    body = {**SHOULDER_BODY, "jurisdiction_key": "denver"}
    text = _markdown(client, body)
    assert "Denver TCP sheet requirements" in text
    assert "sidewalk/bike closure detail" in text


def test_englewood_crossing_rule_fires_on_more_than_two_lanes(client):
    # SHOULDER_BODY draws 2 lanes per direction -> 4 total: trips.
    body = {**SHOULDER_BODY, "jurisdiction_key": "englewood"}
    text = _markdown(client, body)
    assert "Englewood TC-5B, note 2" in text
    assert "MORE THAN 2 LANES WITHOUT AN EXISTING MARKED" in text


def test_englewood_crossing_rule_silent_on_a_two_lane_road(client):
    # Flagger: one lane per direction -> 2 total: the rule's geometry
    # does not trip, so the rule does not render (phase-4 ruling).
    body = {**FLAGGER_BODY, "jurisdiction_key": "englewood"}
    text = _markdown(client, body)
    assert "Englewood TC-5B" not in text


def test_no_jurisdiction_renders_no_jurisdiction_rule(client):
    text = _markdown(client, SHOULDER_BODY)
    for fragment in ("Littleton LEDS", "Denver TCP", "Englewood TC-5B"):
        assert fragment not in text, fragment


# ---------------------------------------------------------------------------
# The crew PDF carries the same sections (shared content path)
# ---------------------------------------------------------------------------


def test_crew_pdf_carries_both_sections(client):
    import pypdfium2 as pdfium

    resp = client.post("/render/crew-pdf", json=SHOULDER_BODY, headers=AUTH)
    assert resp.status_code == 200
    doc = pdfium.PdfDocument(resp.content)
    all_text = "\n".join(doc[i].get_textpage().get_text_range() for i in range(len(doc)))
    assert "Pedestrian and Bicycle Accommodation" in all_text
    assert "Emergency Access" in all_text
    assert "630.10(a)" in all_text
