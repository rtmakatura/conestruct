"""Cross-surface regression tests for the parametric-label invariants.

T-01 (audit finding B-01) — descriptive surfaces must agree with the
PDF on every parametric value:

  * The XLSX Device List and the UI device-breakdown rows never ship a
    literal template token (``XXX`` / ``XX``) from SIGN_DESCRIPTIONS.
  * On reduced-speed plans the two R2-1 faces (work-zone entrance
    posting vs downstream restoration) get separate rows with the
    actual limits, instead of one merged "SPEED LIMIT XX" line.

T-02 (audit finding B-02) — the audit ``advance.sign_table`` covers
exactly the upstream SIGN_GENERIC placements (mirror pairs deduped):
every sign the layout ships upstream of the taper has a row, and no
phantom rows exist.  Set equality both ways, so a future hand-added or
hand-dropped row fails loudly.

All four S-630-1 fixtures (Cases 11 / 11b / 26 / 27) run through both
invariants — the same bodies the Phase 5 harness pins.
"""

from __future__ import annotations

import dataclasses
import json
import re
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from src.api.render_api import _build_device_breakdown
from src.api.render_api import app as _render_app
from src.api.schemas import FlaggerLaneClosureScenario, ShoulderScenario, scenario_to_call
from src.export.device_list import export_device_list
from src.export.quote_generator import generate_quote
from src.narrative.crew_narrative import build_narrative_context
from src.rendering import audit_blocks as _audit_blocks
from src.rendering import plan_sheet as _ps
from src.rendering.plan_sheet import _scenario_label
from src.rules.devices import DeviceType
from src.rules.validators import (
    DevicePlacement,
    ScenarioParams,
    scenario_display_name,
    scenario_display_name_short,
)

from ._harness import (
    CASE_11_GENERAL_BODY,
    CASE_11B_BODY,
    CASE_26_BODY,
    CASE_27_BODY,
    placements_and_audit,
)

BODIES: dict[str, dict[str, Any]] = {
    "case_11": CASE_11_GENERAL_BODY,
    "case_11b": CASE_11B_BODY,
    "case_26": CASE_26_BODY,
    "case_27": CASE_27_BODY,
}

# (posted, work-zone) speeds for the reduced-speed fixtures — used to
# assert the R2-1 faces carry the right limits.
REDUCED_SPEEDS: dict[str, tuple[int, int]] = {
    "case_11b": (55, 50),
    "case_26": (65, 60),
    "case_27": (75, 65),
}

# A literal XX / XXX placeholder surviving into a rendered description.
_TEMPLATE_TOKEN = re.compile(r"\bX{2,3}\b")


def _pipeline(body: dict[str, Any]) -> tuple[list[DevicePlacement], ScenarioParams]:
    scenario = ShoulderScenario.model_validate(body)
    params, generator, kwargs = scenario_to_call(scenario)
    return generator(params, **kwargs), params


def _xlsx_device_rows(placements, params, tmp_path) -> list[tuple]:
    path = tmp_path / "devices.xlsx"
    export_device_list(placements, params, str(path))
    wb = load_workbook(str(path), read_only=True)
    rows = list(wb["Device List"].iter_rows(min_row=2, values_only=True))
    wb.close()
    return rows


# ---------------------------------------------------------------------------
# T-01 — XLSX
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("name", sorted(BODIES))
def test_xlsx_descriptions_carry_no_template_tokens(name: str, tmp_path) -> None:
    """No Device List description ships a literal XX/XXX placeholder."""
    placements, params = _pipeline(BODIES[name])
    for row in _xlsx_device_rows(placements, params, tmp_path):
        description = str(row[2])
        assert not _TEMPLATE_TOKEN.search(description), (
            f"{name}: XLSX description carries a literal template token: {description!r}"
        )


@pytest.mark.parametrize("name", sorted(REDUCED_SPEEDS))
def test_xlsx_splits_r2_1_faces_on_reduced_plans(name: str, tmp_path) -> None:
    """Reduced-speed plans get two R2-1 rows (entrance + restoration),
    qty 2 each (mirrored on the divided fixtures), with the actual
    limits — not one merged row of 4."""
    posted, wz_speed = REDUCED_SPEEDS[name]
    placements, params = _pipeline(BODIES[name])
    rows = _xlsx_device_rows(placements, params, tmp_path)
    r2_1_rows = [r for r in rows if str(r[2]).startswith("R2-1 ")]
    assert len(r2_1_rows) == 2, f"{name}: expected 2 R2-1 rows, got {r2_1_rows}"
    descriptions = sorted(str(r[2]) for r in r2_1_rows)
    quantities = [r[5] for r in r2_1_rows]
    assert quantities == [2, 2], f"{name}: expected qty 2 per face, got {quantities}"
    assert descriptions[0] == (f"R2-1 SPEED LIMIT {wz_speed} (work-zone speed posting)"), (
        descriptions
    )
    assert descriptions[1] == (f"R2-1 SPEED LIMIT {posted} (posted-speed restoration)"), (
        descriptions
    )


# ---------------------------------------------------------------------------
# T-01 — UI device breakdown
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("name", sorted(BODIES))
def test_breakdown_descriptions_carry_no_template_tokens(name: str) -> None:
    """No device-breakdown row ships a literal XX/XXX placeholder."""
    placements, params = _pipeline(BODIES[name])
    for row in _build_device_breakdown(placements, params):
        assert not _TEMPLATE_TOKEN.search(str(row["device"])), (
            f"{name}: breakdown device description carries a literal template token: {row!r}"
        )


@pytest.mark.parametrize("name", sorted(REDUCED_SPEEDS))
def test_breakdown_splits_r2_1_faces_on_reduced_plans(name: str) -> None:
    """Same R2-1 face split on the device-breakdown panel."""
    posted, wz_speed = REDUCED_SPEEDS[name]
    placements, params = _pipeline(BODIES[name])
    rows = [r for r in _build_device_breakdown(placements, params) if r["code"] == "R2-1"]
    assert len(rows) == 2, f"{name}: expected 2 R2-1 rows, got {rows}"
    devices = sorted(str(r["device"]) for r in rows)
    assert all(r["qty"] == 2 for r in rows), rows
    assert devices[0] == f"SPEED LIMIT {wz_speed} (work-zone speed posting)", devices
    assert devices[1] == f"SPEED LIMIT {posted} (posted-speed restoration)", devices


# ---------------------------------------------------------------------------
# T-01 — crew narrative Required Equipment list (UX-10)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("name", sorted(BODIES))
def test_narrative_equipment_carries_no_template_tokens(name: str) -> None:
    """The Required Equipment bullets must resolve parametric sign
    legends (e.g. ``G20-1 ROAD CONSTRUCTION (NEXT XXX FT)``) to real
    values instead of leaking the bare template token — the same
    invariant the XLSX device list and UI breakdown already hold, now
    extended to the narrative equipment surface (UX-10)."""
    placements, params = _pipeline(BODIES[name])
    bullets = build_narrative_context(placements, params)["equipment_bullets"]
    assert not _TEMPLATE_TOKEN.search(bullets), (
        f"{name}: narrative equipment list carries a literal template token:\n{bullets}"
    )


# ---------------------------------------------------------------------------
# T-01 — quote Equipment Detail (T4-1 closure, Refs #101)
#
# The quote must route through the same shared helpers as the XLSX /
# breakdown / narrative (substitute_sign_description, schedule_key,
# device_row_sort_key, cone_display_name) — asserted here on the
# generated workbook content, not on rate math.
# ---------------------------------------------------------------------------

# Low-speed variant of the Case 11 body: 40 mph on an undivided rural
# road, below the MUTCD §6F.65 36-inch cone threshold — exercises the
# 28-inch branch of cone_display_name on the export surfaces.
CASE_11_LOW_SPEED_BODY: dict[str, Any] = {
    **CASE_11_GENERAL_BODY,
    "roadType": "rural_undivided",
    "speed": 40,
    "divided": False,
}


def _quote_equipment_rows(placements, params, tmp_path) -> list[tuple]:
    """Data rows of the quote's Equipment Detail sheet (skips SUBTOTAL)."""
    path = tmp_path / "quote.xlsx"
    generate_quote(placements, params, output_path=str(path))
    wb = load_workbook(str(path), read_only=True)
    rows = [
        r
        for r in wb["Equipment Detail"].iter_rows(min_row=2, values_only=True)
        if isinstance(r[0], int)
    ]
    wb.close()
    return rows


@pytest.mark.parametrize("name", sorted(BODIES))
def test_quote_descriptions_carry_no_template_tokens(name: str, tmp_path) -> None:
    """No Equipment Detail description ships a literal XX/XXX placeholder,
    and no labeled sign falls back to its bare code (the W3-5(NN)
    dict-miss case)."""
    placements, params = _pipeline(BODIES[name])
    rows = _quote_equipment_rows(placements, params, tmp_path)
    assert rows, f"{name}: quote Equipment Detail has no data rows"
    for row in rows:
        description = str(row[3])
        assert not _TEMPLATE_TOKEN.search(description), (
            f"{name}: quote description carries a literal template token: {description!r}"
        )
        if row[1] == "SIGN_GENERIC" and row[2]:
            assert description != str(row[2]), (
                f"{name}: labeled sign fell back to its bare code: {description!r}"
            )


@pytest.mark.parametrize("name", sorted(REDUCED_SPEEDS))
def test_quote_splits_r2_1_faces_on_reduced_plans(name: str, tmp_path) -> None:
    """Same R2-1 face split the XLSX/breakdown already hold: two rows
    (entrance + restoration), qty 2 each, with the actual limits."""
    posted, wz_speed = REDUCED_SPEEDS[name]
    placements, params = _pipeline(BODIES[name])
    rows = _quote_equipment_rows(placements, params, tmp_path)
    r2_1_rows = [r for r in rows if str(r[3]).startswith("R2-1 ")]
    assert len(r2_1_rows) == 2, f"{name}: expected 2 R2-1 rows, got {r2_1_rows}"
    descriptions = sorted(str(r[3]) for r in r2_1_rows)
    quantities = [r[4] for r in r2_1_rows]
    assert quantities == [2, 2], f"{name}: expected qty 2 per face, got {quantities}"
    assert descriptions[0] == (f"R2-1 SPEED LIMIT {wz_speed} (work-zone speed posting)"), (
        descriptions
    )
    assert descriptions[1] == (f"R2-1 SPEED LIMIT {posted} (posted-speed restoration)"), (
        descriptions
    )


@pytest.mark.parametrize("name", sorted(BODIES))
def test_quote_rows_match_xlsx_order_and_descriptions(name: str, tmp_path) -> None:
    """Quote Equipment Detail agrees with the XLSX Device List row for
    row — same device_row_sort_key order, byte-identical descriptions,
    identical quantities, signs leading."""
    placements, params = _pipeline(BODIES[name])
    quote_rows = _quote_equipment_rows(placements, params, tmp_path)
    xlsx_rows = _xlsx_device_rows(placements, params, tmp_path)
    assert [str(r[3]) for r in quote_rows] == [str(r[2]) for r in xlsx_rows], (
        f"{name}: quote and XLSX descriptions disagree (content or order)"
    )
    assert [r[4] for r in quote_rows] == [r[5] for r in xlsx_rows], (
        f"{name}: quote and XLSX quantities disagree"
    )
    assert quote_rows[0][1] == "SIGN_GENERIC", (
        f"{name}: quote does not lead with signs: first row {quote_rows[0]!r}"
    )


def test_quote_sign_descriptions_appear_in_narrative(tmp_path) -> None:
    """Every quote sign description also appears verbatim in the crew
    narrative's Required Equipment bullets (shared substitution helper
    ⇒ byte-identity across the three surfaces)."""
    placements, params = _pipeline(CASE_26_BODY)
    quote_rows = _quote_equipment_rows(placements, params, tmp_path)
    bullets = build_narrative_context(placements, params)["equipment_bullets"]
    sign_descriptions = [str(r[3]) for r in quote_rows if r[1] == "SIGN_GENERIC" and r[2]]
    assert sign_descriptions, "no labeled sign rows in the quote"
    for description in sign_descriptions:
        assert description in bullets, (
            f"quote sign description not found in narrative equipment bullets: {description!r}"
        )


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        (CASE_11_GENERAL_BODY, "Traffic Cone (36-inch)"),
        (CASE_11_LOW_SPEED_BODY, "Traffic Cone (28-inch)"),
    ],
    ids=["55mph_36in", "40mph_28in"],
)
def test_cone_description_resolves_size_on_quote_and_xlsx(
    body: dict[str, Any], expected: str, tmp_path
) -> None:
    """Quote and XLSX resolve the cone size via cone_display_name(speed),
    matching the narrative/UI/plan-sheet legend text."""
    placements, params = _pipeline(body)
    quote_cones = [r for r in _quote_equipment_rows(placements, params, tmp_path) if r[1] == "CONE"]
    xlsx_cones = [r for r in _xlsx_device_rows(placements, params, tmp_path) if r[1] == "CONE"]
    assert quote_cones and xlsx_cones, "no cone row on one of the surfaces"
    assert str(quote_cones[0][3]) == expected
    assert str(xlsx_cones[0][2]) == expected
    bullets = build_narrative_context(placements, params)["equipment_bullets"]
    assert expected in bullets


# ---------------------------------------------------------------------------
# T-02 — audit sign_table covers the upstream placements exactly
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("name", sorted(BODIES))
def test_audit_sign_table_matches_upstream_placements(name: str) -> None:
    """Every upstream SIGN_GENERIC placement (mirror-deduped) has a
    sign_table row, and the table has no rows without a placement."""
    placements, audit = placements_and_audit(BODIES[name])
    taper_start = (
        audit["geometry_validation"]["work_zone_ft"]
        + audit["buffer"]["buffer_ft"]
        + audit["taper"]["L_required_ft"]
    )
    expected = {
        (p.label, round(p.station_ft))
        for p in placements
        if p.device_type == DeviceType.SIGN_GENERIC and p.label and p.station_ft > taper_start
    }
    actual = {
        (row["Code"], round(float(row["Station (ft)"].replace(",", ""))))
        for row in audit["advance"]["sign_table"]
    }
    assert actual == expected, (
        f"{name}: audit sign_table disagrees with upstream placements.\n"
        f"  missing from table: {sorted(expected - actual)}\n"
        f"  phantom rows:       {sorted(actual - expected)}"
    )


# ---------------------------------------------------------------------------
# T-03 — closure-type label reads the real lane count (Refs #118)
#
# scenario_display_name derives the undivided lane claim from
# ``num_lanes`` (total-lane naming, so num_lanes=1 → "2-Lane") and the
# single-sourced string must reach every full-label surface
# byte-identically: plan-sheet title block, XLSX Summary, quote header,
# crew narrative.  The PARAMETERS box short form never carries the
# count — pinned here so a truncation change is a loud failure.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("lanes", [1, 2, 3, 4])
def test_undivided_label_reads_lane_count_on_every_surface(lanes: int, tmp_path) -> None:
    body = {
        **CASE_11_GENERAL_BODY,
        "roadType": "rural_undivided",
        "divided": False,
        "lanes": lanes,
        # 10-ft lanes keep lanes=4 inside MAX_DRAWABLE_HALF_ROAD_FT.
        "laneWidth": 10,
    }
    placements, params = _pipeline(body)
    expected = f"Shoulder Closure — {2 * lanes}-Lane Undivided"

    assert scenario_display_name(params) == expected
    # Plan-sheet title block MHT TYPE row renders this wrapper.
    assert _scenario_label(params) == expected.upper()
    # PARAMETERS box short form drops the qualifier entirely.
    assert scenario_display_name_short(params) == "Shoulder Closure"
    # Crew narrative header.
    assert build_narrative_context(placements, params)["closure_type_display"] == expected

    # XLSX device list Summary sheet.
    xlsx_path = tmp_path / "devices.xlsx"
    export_device_list(placements, params, str(xlsx_path))
    wb = load_workbook(str(xlsx_path), read_only=True)
    summary = {str(r[0]): r[1] for r in wb["Summary"].iter_rows(values_only=True)}
    wb.close()
    assert summary["Closure type"] == expected

    # Quote Summary header line.
    quote_path = tmp_path / "quote.xlsx"
    generate_quote(placements, params, output_path=str(quote_path))
    qwb = load_workbook(str(quote_path), read_only=True)
    header_row = next(
        qwb["Quote Summary"].iter_rows(min_row=6, max_row=6, max_col=1, values_only=True)
    )
    qwb.close()
    assert f"Closure: {expected}" in str(header_row[0])


def test_flagger_label_unchanged_by_lane_count_derivation() -> None:
    """The bridge forces flagger to num_lanes=1 (schemas.scenario_to_call),
    so the derived label is byte-identical to the former literal."""
    scenario = FlaggerLaneClosureScenario.model_validate(
        {
            "kind": "flagger_lane_closure",
            "roadType": "rural_undivided",
            "speed": 45,
            "laneWidth": 12,
            "workType": "utility_cut",
            "duration": "short",
            "workLen": 500,
            "night": False,
            "pilotCar": False,
            "afad": False,
            "pedestrianAccess": False,
        }
    )
    params, _generator, _kwargs = scenario_to_call(scenario)
    assert params.num_lanes == 1
    assert scenario_display_name(params) == "Flagger Alternating Traffic — 2-Lane Undivided"


def test_flagger_label_states_drawn_geometry_not_input_count() -> None:
    """The flagger label is a literal, not 2 * num_lanes (#117 enablement
    item): generate_flagger_alternating_2lane draws a 2-lane road
    unconditionally, so a direct caller passing num_lanes=2 must not get
    a "4-Lane Undivided" claim about a plan nobody drew.  Unreachable
    through the wire (the bridge forces num_lanes=1) — this pins the
    direct-construction path the old formula lied on."""
    params = ScenarioParams(
        speed_mph=45,
        num_lanes=2,
        lane_width_ft=12.0,
        closure_type="lane",
        road_type="rural",
        work_zone_length_ft=500.0,
        is_divided=False,
        jurisdiction="CDOT",
    )
    assert scenario_display_name(params) == "Flagger Alternating Traffic — 2-Lane Undivided"


def test_narrative_rural_road_type_makes_no_lane_claim() -> None:
    """ "Rural two-lane" asserted a lane count Table 6B-1 does not carry —
    the narrative road-type row must stay count-free (Refs #118)."""
    placements, params = _pipeline(
        {**CASE_11_GENERAL_BODY, "roadType": "rural_undivided", "divided": False, "lanes": 3}
    )
    assert params.road_type == "rural"
    assert build_narrative_context(placements, params)["road_type_human"] == "Rural"


# ---------------------------------------------------------------------------
# T-04 — deliverables agree with the screen: jurisdiction (Refs #257)
#
# The screen names the jurisdiction from the evaluated record block on
# ``/render/device-breakdown`` (``jurisdiction.name``); every deliverable
# that prints a jurisdiction must print that same name, and "Not set"
# when the scenario names no record — never the engine's buffer-table
# switch (``params.jurisdiction``, the seven schemas.py "CDOT" literals).
# Runs the committed worst-case fixtures through the REAL API path, the
# containment harness's pattern (tests/test_pdf_containment.py), so the
# invariant holds on the same bodies the PDF containment pins.
# ---------------------------------------------------------------------------

_FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
_WORST_CASE_DIR = _FIXTURES / "pdf_worst_case"
_SCAN_PAYLOAD = _FIXTURES / "site_scan" / "lakewood_overpass.json"
_WORST_CASE = sorted(p.stem for p in _WORST_CASE_DIR.glob("*.json"))
_API_HEADERS = {"Authorization": "Bearer test-secret-do-not-deploy"}


def _worst_case(name: str) -> dict[str, Any]:
    return json.loads((_WORST_CASE_DIR / f"{name}.json").read_text(encoding="utf-8"))["scenario"]


def _stub_scan(name: str, monkeypatch: pytest.MonkeyPatch) -> None:
    """The scanned fixtures' Overpass trip goes to a stub (recorded payload
    or mirrors down, per the fixture's ``_provenance.overpass``); the
    network is never reached.  Mirrors test_pdf_containment's stub."""
    from src.api import site_scan as ss
    from src.rules import site_detection as sd

    ss.clear_memo()
    prov = json.loads((_WORST_CASE_DIR / f"{name}.json").read_text(encoding="utf-8"))
    mode = prov.get("_provenance", {}).get("overpass")
    if mode == "recorded":
        payload = json.loads(_SCAN_PAYLOAD.read_text(encoding="utf-8"))
        monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda q, **_k: (payload, None))
    elif mode == "down":
        monkeypatch.setattr(
            sd, "_overpass_request_with_fallback", lambda q, **_k: (None, "stub: mirrors down")
        )


def _tiny_png_bytes() -> bytes:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (4, 4), (128, 128, 128)).save(buf, format="PNG")
    return buf.getvalue()


class _FakeTile:
    content = _tiny_png_bytes()

    def raise_for_status(self) -> None:
        return None


@pytest.fixture()
def api(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """The real API, offline: a fake Mapbox tile so page 2 (the corridor
    details box) renders, the OSM bearing soft-check silenced."""
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret-do-not-deploy")
    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")
    monkeypatch.setattr(_ps.httpx, "get", lambda *a, **k: _FakeTile())
    monkeypatch.setattr(_ps, "_validate_corridor_bearing", lambda corridor: None)
    return TestClient(_render_app)


def _post(api: TestClient, route: str, scenario: dict[str, Any]):
    r = api.post(route, json=scenario, headers=_API_HEADERS)
    assert r.status_code == 200, f"{route}: {r.status_code} {r.text[:300]}"
    return r


def _pdf_text(pdf_bytes: bytes) -> list[str]:
    """Extracted text per page."""
    doc = pdfium.PdfDocument(pdf_bytes)
    try:
        out = []
        for page in doc:
            tp = page.get_textpage()
            out.append(tp.get_text_range(0, tp.count_chars()))
        return out
    finally:
        doc.close()


def _xlsx_summary(xlsx_bytes: bytes, tmp_path: Path) -> dict[str, Any]:
    path = tmp_path / "devices.xlsx"
    path.write_bytes(xlsx_bytes)
    wb = load_workbook(str(path), read_only=True)
    summary = {str(r[0]): r[1] for r in wb["Summary"].iter_rows(values_only=True)}
    wb.close()
    return summary


def _screen_jurisdiction(api: TestClient, scenario: dict[str, Any]) -> str:
    """What the strip prints: the evaluated record's name, else "Not set"."""
    block = _post(api, "/render/device-breakdown", scenario).json().get("jurisdiction")
    return str(block["name"]) if block else "Not set"


@pytest.mark.parametrize("name", _WORST_CASE)
def test_jurisdiction_is_one_name_on_every_deliverable(
    name: str, api: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    scenario = _worst_case(name)
    _stub_scan(name, monkeypatch)
    expected = _screen_jurisdiction(api, scenario)
    # The engine switch is never displayed as a jurisdiction: a fixture
    # naming no record reads "Not set", one naming a record reads its name.
    assert expected == ("Not set" if not scenario.get("jurisdiction_key") else expected)
    assert expected != "CDOT"

    summary = _xlsx_summary(_post(api, "/render/xlsx", scenario).content, tmp_path)
    assert summary["Jurisdiction"] == expected, f"XLSX Summary: {summary['Jurisdiction']!r}"

    md = _post(api, "/render/markdown", scenario).text
    assert f"- **Jurisdiction:** {expected}" in md, "crew MD header"

    crew_pages = _pdf_text(_post(api, "/render/crew-pdf", scenario).content)
    assert f"Jurisdiction: {expected}" in crew_pages[0], "crew PDF header"

    audit_pages = "\n".join(_pdf_text(_post(api, "/render/audit-pdf", scenario).content))
    assert "Jurisdiction: CDOT" not in audit_pages, (
        "audit PDF names the buffer table as a jurisdiction"
    )


# Rule 10 at the export level (Rule 11: the test sits where the value is
# printed): the XLSX Summary reads ``params.jurisdiction_name`` and prints
# "Not set" when it is None — never the buffer-table switch.


def test_xlsx_summary_prints_not_set_without_a_record(tmp_path: Path) -> None:
    placements, params = _pipeline(CASE_11_GENERAL_BODY)
    assert params.jurisdiction_name is None
    path = tmp_path / "devices.xlsx"
    export_device_list(placements, params, str(path))
    wb = load_workbook(str(path), read_only=True)
    summary = {str(r[0]): r[1] for r in wb["Summary"].iter_rows(values_only=True)}
    wb.close()
    assert summary["Jurisdiction"] == "Not set"


def test_xlsx_summary_prints_the_record_name(tmp_path: Path) -> None:
    placements, params = _pipeline(CASE_11_GENERAL_BODY)
    named = dataclasses.replace(params, jurisdiction_name="Denver")
    path = tmp_path / "devices.xlsx"
    export_device_list(placements, named, str(path))
    wb = load_workbook(str(path), read_only=True)
    summary = {str(r[0]): r[1] for r in wb["Summary"].iter_rows(values_only=True)}
    wb.close()
    assert summary["Jurisdiction"] == "Denver"


def test_bridge_carries_the_record_name_from_the_key() -> None:
    """The one producer: scenario_to_call resolves ``jurisdiction_key`` to
    the record's name on ScenarioParams; the switch stays "CDOT"."""
    _placements, params = _pipeline({**CASE_11_GENERAL_BODY, "jurisdiction_key": "denver"})
    assert params.jurisdiction_name == "Denver"
    assert params.jurisdiction == "CDOT"


def test_audit_buffer_line_names_the_table_not_a_jurisdiction() -> None:
    """The audit's ``buffer.jurisdiction`` key is the buffer-TABLE switch
    (wire unchanged); the PDF line says so instead of printing it as the
    plan's jurisdiction."""
    blocks = _audit_blocks._buffer_blocks(
        {"lookup_text": "x", "source": "y", "jurisdiction": "CDOT"}
    )
    texts = [str(getattr(b, "text", "")) for b in blocks]
    joined = "\n".join(texts)
    assert "Buffer table: CDOT supplement" in joined, joined
    assert "Jurisdiction:" not in joined, joined


# ---------------------------------------------------------------------------
# T-05 — deliverables agree with the screen: the downstream taper (Refs #257)
#
# One length for the word "downstream": the run of downstream-taper cones
# the layout actually placed (the §6B.08 floor when it placed none).  The
# sidebar reads it from the audit's ``sections.corridor_spec``; the plan
# sheet's CORRIDOR DETAILS box, the picker's ``/render/corridor-spec``
# and the crew's step-3 station must print the same figure, and the
# sheet's total corridor must be the sum of the rows it prints.  On
# d6bd79d the sheet and the picker carried the §6B.08 ceiling (100 ft)
# from the scan-bbox corridor frame while every other surface said 50.
# ---------------------------------------------------------------------------

_CREW_DS_STATION = re.compile(r"downstream (?:reopening )?taper, between station -([\d,]+) ft")
_SHEET_ROW = r"{label}:\s*([\d,]+) ft"


def _sheet_ft(page_text: str, label: str) -> int:
    m = re.search(_SHEET_ROW.format(label=label), page_text)
    assert m, f"plan sheet p.2 has no {label!r} row: {page_text[-600:]!r}"
    return int(m.group(1).replace(",", ""))


@pytest.mark.parametrize("name", _WORST_CASE)
def test_downstream_taper_is_one_length_on_every_surface(
    name: str, api: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    scenario = _worst_case(name)
    _stub_scan(name, monkeypatch)

    # The sidebar's source: the audit's own corridor block.
    spec = _post(api, "/render/audit", scenario).json()["sections"]["corridor_spec"]
    downstream = int(spec["downstream_taper_ft"])
    assert downstream > 0

    # The picker's source: the corridor-spec endpoint (the body the proxy
    # sends — kind, speed, roadType; nothing else).
    picker = _post(
        api,
        "/render/corridor-spec",
        {
            "kind": scenario["kind"],
            "speed": scenario["speed"],
            "roadType": scenario.get("roadType"),
        },
    ).json()
    assert picker["downstream_taper_ft"] == downstream, "picker legend vs sidebar"

    # The crew's step 3 names the same station when it places the run.
    md = _post(api, "/render/markdown", scenario).text
    m = _CREW_DS_STATION.search(md)
    if m:
        assert int(m.group(1).replace(",", "")) == downstream, "crew step 3 vs sidebar"

    # The plan sheet's CORRIDOR DETAILS box (page 2 — rendered for the
    # pinned fixtures, where the aerial page exists).
    pages = _pdf_text(_post(api, "/render/pdf", scenario).content)
    if scenario["meta"].get("lat") and scenario["meta"].get("bearingDeg") is not None:
        assert len(pages) == 2, "pinned fixture with a bearing must carry the aerial page"
        p2 = pages[1]
        assert _sheet_ft(p2, "Downstream") == downstream, "plan sheet p.2 vs sidebar"
        assert _sheet_ft(p2, "Advance warning") == int(spec["advance_warning_ft"])
        assert _sheet_ft(p2, "Taper") == int(spec["taper_ft"])
        assert _sheet_ft(p2, "Buffer") == int(spec["buffer_ft"])
        assert _sheet_ft(p2, "Work zone") == int(round(scenario["workLen"]))
        rows = sum(
            _sheet_ft(p2, k)
            for k in ("Advance warning", "Taper", "Buffer", "Work zone", "Downstream")
        )
        # The sheet sums the unrounded lengths, its rows print them
        # rounded: the printed total may differ from the row sum by the
        # rounding of one part, never by a zone.
        assert abs(_sheet_ft(p2, "Total corridor") - rows) <= 1, "plan sheet total vs its rows"


def test_placed_downstream_taper_is_the_layouts_run() -> None:
    """The helper every surface reads: the placed run when the layout
    placed downstream cones, the §6B.08 one-lane floor otherwise."""
    from src.rules.corridor import placed_downstream_taper_ft
    from src.rules.spacing import downstream_taper_length

    placements, _params = _pipeline(CASE_11_GENERAL_BODY)
    ds = [p.station_ft for p in placements if p.device_type == DeviceType.CONE and p.station_ft < 0]
    assert ds, "the shoulder layout places downstream cones"
    assert placed_downstream_taper_ft(placements) == pytest.approx(-min(ds))
    assert placed_downstream_taper_ft([]) == pytest.approx(downstream_taper_length(1))


# ---------------------------------------------------------------------------
# T-06 — the #257 folds: the quote header's road name and one work-zone
# format.  The quote printed the raw ``road_type`` enum ("Road: rural")
# where the crew header printed the display name; the work-zone length
# printed as "1000 ft" on the plan sheet's dimension and PARAMETERS box
# and on the quote header, "1,000 ft" on the crew header and the plan's
# CORRIDOR DETAILS.  One producer for the road name
# (``road_type_display``), one format for the length.
# ---------------------------------------------------------------------------


def test_quote_header_prints_the_road_display_name(tmp_path: Path) -> None:
    from src.rules.validators import ROAD_TYPE_DISPLAY, road_type_display

    placements, params = _pipeline(CASE_11_GENERAL_BODY)
    expected = ROAD_TYPE_DISPLAY[params.road_type]
    assert expected != params.road_type, "the display name is not the enum"
    assert road_type_display(params) == expected
    assert build_narrative_context(placements, params)["road_type_human"] == expected
    quote_path = tmp_path / "quote.xlsx"
    generate_quote(placements, params, output_path=str(quote_path))
    qwb = load_workbook(str(quote_path), read_only=True)
    header = next(qwb["Quote Summary"].iter_rows(min_row=6, max_row=6, max_col=1, values_only=True))
    wz = next(qwb["Quote Summary"].iter_rows(min_row=7, max_row=7, max_col=1, values_only=True))
    qwb.close()
    assert f"Road: {expected}" in str(header[0]), header
    assert f"Road: {params.road_type}" not in str(header[0])
    assert f"Work zone: {params.work_zone_length_ft:,.0f} ft" in str(wz[0]), wz


@pytest.mark.parametrize("name", [n for n in _WORST_CASE if _worst_case(n)["workLen"] >= 1000])
def test_work_zone_length_is_one_format_on_every_surface(
    name: str, api: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    scenario = _worst_case(name)
    _stub_scan(name, monkeypatch)
    expected = f"{scenario['workLen']:,.0f} ft"
    assert "," in expected, "filtered to four-digit work zones above"

    pages = _pdf_text(_post(api, "/render/pdf", scenario).content)
    assert f"WORK ZONE = {expected}" in pages[0], "plan sheet dimension callout"
    assert re.search(rf"Work zone:\s*{re.escape(expected)}", pages[0]), "plan sheet PARAMETERS"
    if len(pages) > 1:
        assert re.search(rf"Work zone:\s*{re.escape(expected)}", pages[1]), "CORRIDOR DETAILS"

    md = _post(api, "/render/markdown", scenario).text
    assert f"- **Work zone length:** {expected}" in md

    quote = _post(api, "/render/quote", {"scenario": scenario}).content
    qpath = tmp_path / "quote.xlsx"
    qpath.write_bytes(quote)
    qwb = load_workbook(str(qpath), read_only=True)
    wz = next(qwb["Quote Summary"].iter_rows(min_row=7, max_row=7, max_col=1, values_only=True))
    qwb.close()
    assert f"Work zone: {expected}" in str(wz[0]), wz

    # The XLSX Summary keeps a numeric cell (a bid document sums it); the
    # unit lives in the label.
    summary = _xlsx_summary(_post(api, "/render/xlsx", scenario).content, tmp_path)
    assert summary["Work zone length (ft)"] == scenario["workLen"]
