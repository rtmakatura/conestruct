"""Cross-surface regression tests for the flagger scenario (Region 6 item 1).

Flagger twin of ``test_cross_surface.py``: token-freeness, description/order/
quantity equality across XLSX / UI breakdown / quote / narrative, cone-size
resolution, and the audit ``advance.sign_table`` two-way set equality.  The
helpers are imported from the shoulder file so the two suites can never
assert different invariants.

No reduced-speed (R2-1 face-split) tests: ``FlaggerLaneClosureScenario``
carries no ``workZoneSpeed`` (V1.1 / PR 4) — the reduced flagger chain is
pinned at the params level in ``test_ta10_flagger.py`` instead.
"""

from __future__ import annotations

from typing import Any

import pytest

from src.api.render_api import _build_device_breakdown
from src.narrative.crew_narrative import build_narrative_context
from src.rules.devices import DeviceType
from src.rules.validators import DevicePlacement, ScenarioParams

from .test_cross_surface import _TEMPLATE_TOKEN, _quote_equipment_rows, _xlsx_device_rows
from .test_ta10_flagger import FLAGGER_BASIC_BODY, flagger_placements_and_audit

BODIES: dict[str, dict[str, Any]] = {
    "flagger_basic": FLAGGER_BASIC_BODY,
    "flagger_afad": {**FLAGGER_BASIC_BODY, "afad": True},
    "flagger_pilot_car": {**FLAGGER_BASIC_BODY, "pilotCar": True},
    "flagger_pedestrian": {**FLAGGER_BASIC_BODY, "pedestrianAccess": True},
    "flagger_night": {**FLAGGER_BASIC_BODY, "night": True},
    # urban_low regime (<=40 mph) + the 28-inch cone branch (speed < 45)
    "flagger_urban_35": {**FLAGGER_BASIC_BODY, "roadType": "urban_arterial", "speed": 35},
    # urban_high regime (>40 mph) + the 36-inch cone branch
    "flagger_urban_55": {**FLAGGER_BASIC_BODY, "roadType": "urban_arterial", "speed": 55},
}


def _pipeline(body: dict[str, Any]) -> tuple[list[DevicePlacement], ScenarioParams]:
    placements, _audit, params = flagger_placements_and_audit(body)
    return placements, params


@pytest.mark.parametrize("name", sorted(BODIES))
def test_flagger_xlsx_descriptions_carry_no_template_tokens(name: str, tmp_path) -> None:
    """No flagger Device List description ships a literal XX/XXX placeholder."""
    placements, params = _pipeline(BODIES[name])
    for row in _xlsx_device_rows(placements, params, tmp_path):
        description = str(row[2])
        assert not _TEMPLATE_TOKEN.search(description), (
            f"{name}: XLSX description carries a literal template token: {description!r}"
        )


@pytest.mark.parametrize("name", sorted(BODIES))
def test_flagger_breakdown_descriptions_carry_no_template_tokens(name: str) -> None:
    """No flagger device-breakdown row ships a literal XX/XXX placeholder."""
    placements, params = _pipeline(BODIES[name])
    for row in _build_device_breakdown(placements, params):
        assert not _TEMPLATE_TOKEN.search(str(row["device"])), (
            f"{name}: breakdown description carries a literal template token: {row!r}"
        )


@pytest.mark.parametrize("name", sorted(BODIES))
def test_flagger_narrative_equipment_carries_no_template_tokens(name: str) -> None:
    """The flagger Required Equipment bullets resolve parametric legends."""
    placements, params = _pipeline(BODIES[name])
    bullets = build_narrative_context(placements, params)["equipment_bullets"]
    assert not _TEMPLATE_TOKEN.search(bullets), (
        f"{name}: narrative equipment list carries a literal template token:\n{bullets}"
    )


@pytest.mark.parametrize("name", sorted(BODIES))
def test_flagger_quote_descriptions_carry_no_template_tokens(name: str, tmp_path) -> None:
    """No flagger Equipment Detail description ships a placeholder, and no
    labeled sign falls back to its bare code (the dict-miss case)."""
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


@pytest.mark.parametrize("name", sorted(BODIES))
def test_flagger_quote_rows_match_xlsx_order_and_descriptions(name: str, tmp_path) -> None:
    """Quote Equipment Detail agrees with the XLSX Device List row for row —
    same device_row_sort_key order, byte-identical descriptions, identical
    quantities, signs leading."""
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


def test_flagger_quote_sign_descriptions_appear_in_narrative(tmp_path) -> None:
    """Every flagger quote sign description also appears verbatim in the crew
    narrative's Required Equipment bullets (shared substitution helper)."""
    placements, params = _pipeline(FLAGGER_BASIC_BODY)
    quote_rows = _quote_equipment_rows(placements, params, tmp_path)
    bullets = build_narrative_context(placements, params)["equipment_bullets"]
    sign_descriptions = [str(r[3]) for r in quote_rows if r[1] == "SIGN_GENERIC" and r[2]]
    assert sign_descriptions, "no labeled sign rows in the flagger quote"
    for description in sign_descriptions:
        assert description in bullets, (
            f"quote sign description missing from narrative bullets: {description!r}"
        )


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("flagger_basic", "Traffic Cone (36-inch)"),
        ("flagger_urban_35", "Traffic Cone (28-inch)"),
    ],
    ids=["45mph_36in", "35mph_28in"],
)
def test_flagger_cone_description_resolves_size(name: str, expected: str, tmp_path) -> None:
    """Quote and XLSX resolve the cone size via cone_display_name(speed)
    (36-inch at >=45 mph per MUTCD Sec 6F.65), matching the narrative text."""
    placements, params = _pipeline(BODIES[name])
    quote_cones = [r for r in _quote_equipment_rows(placements, params, tmp_path) if r[1] == "CONE"]
    xlsx_cones = [r for r in _xlsx_device_rows(placements, params, tmp_path) if r[1] == "CONE"]
    assert quote_cones and xlsx_cones, "no cone row on one of the surfaces"
    assert str(quote_cones[0][3]) == expected
    assert str(xlsx_cones[0][2]) == expected
    bullets = build_narrative_context(placements, params)["equipment_bullets"]
    assert expected in bullets


@pytest.mark.parametrize("name", sorted(BODIES))
def test_flagger_audit_sign_table_matches_upstream_placements(name: str) -> None:
    """Two-way set equality between the audit advance.sign_table and the
    upstream (right-direction) SIGN_GENERIC placements — the T-02 invariant
    applied to the flagger chain.  The opposing-direction chain sits at
    negative stations and is excluded by the > taper_start filter."""
    placements, audit, _params = flagger_placements_and_audit(BODIES[name])
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
