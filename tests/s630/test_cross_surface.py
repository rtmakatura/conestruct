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

import re
from typing import Any

import pytest
from openpyxl import load_workbook

from src.api.render_api import _build_device_breakdown
from src.api.schemas import ShoulderScenario, scenario_to_call
from src.export.device_list import export_device_list
from src.narrative.crew_narrative import build_narrative_context
from src.rules.devices import DeviceType
from src.rules.validators import DevicePlacement, ScenarioParams

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
