"""Money rounds to cents at computation — #135 ruling on the quote path
(Refs #185).

Pre-fix, quote_generator carried raw floats end-to-end and rounded only at
presentation (XLSX number formats, frontend fmtCurrency), so group
subtotals could fail to add up to the rendered total by a cent and two
renderings of the same figure could disagree.  The ruling: round to cents
at computation; every downstream sum consumes rounded values.

The fixture inputs are CHOSEN (Rule 12) to force sub-cent raw products —
an odd hourly rate under the 1.5 night multiplier — so the invariant is
demonstrated, not vacuously true.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from src.export.quote_generator import generate_quote
from src.generation.layout import generate_shoulder_closure_divided
from src.rules.validators import ScenarioParams


def _params(is_night: bool = True) -> ScenarioParams:
    return ScenarioParams(
        speed_mph=55,
        num_lanes=3,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_night=is_night,
        is_divided=True,
        jurisdiction="CDOT",
    )


def _quote(**overrides):
    params = _params()
    placements = generate_shoulder_closure_divided(params, shoulder_width_ft=10.0)
    with tempfile.TemporaryDirectory() as td:
        _, breakdown = generate_quote(
            placements,
            params,
            output_path=str(Path(td) / "q.xlsx"),
            project_duration_days=3,
            num_flaggers=3,
            # 41.113/hr * 10 h * 3 days * 3 flaggers * 1.5 night = 5550.255
            # raw — a genuine half-cent case the rounding must decide.
            flagger_hourly_rate=41.113,
            tcs_hourly_rate=75.0,
            crew_hourly_rate=45.0,
            **overrides,
        )
    return breakdown


def _is_cents(x: float) -> bool:
    return abs(x * 100 - round(x * 100)) < 1e-6


def test_every_line_and_total_is_cent_exact() -> None:
    qb = _quote()
    for line in qb.equipment_lines:
        assert _is_cents(line.extended), f"equipment {line.device_type}: {line.extended!r}"
    for line in qb.labor_lines:
        assert _is_cents(line.extended), f"labor {line.role}: {line.extended!r}"
    for line in qb.delivery_lines:
        assert _is_cents(line.extended), f"delivery {line.item}: {line.extended!r}"
    for name in (
        "equipment_total",
        "labor_total",
        "delivery_total",
        "subtotal",
        "overhead",
        "profit",
        "total",
    ):
        assert _is_cents(getattr(qb, name)), f"{name}: {getattr(qb, name)!r}"


def test_totals_are_sums_of_rounded_lines() -> None:
    qb = _quote()
    assert qb.equipment_total == pytest.approx(
        sum(round(line.extended, 2) for line in qb.equipment_lines), abs=1e-6
    )
    assert qb.labor_total == pytest.approx(
        sum(round(line.extended, 2) for line in qb.labor_lines), abs=1e-6
    )
    assert qb.delivery_total == pytest.approx(
        sum(round(line.extended, 2) for line in qb.delivery_lines), abs=1e-6
    )
    assert qb.subtotal == pytest.approx(
        qb.equipment_total + qb.labor_total + qb.delivery_total, abs=1e-6
    )
    assert qb.total == pytest.approx(qb.subtotal + qb.overhead + qb.profit, abs=1e-6)


def test_half_cent_raw_product_is_decided_at_computation() -> None:
    """The chosen inputs make the flagger line's raw product 5550.255 —
    representable neither as cents nor stable under float repr.  The
    computed line must be the half-up cent value, so every consumer
    (screen, XLSX, JSON) starts from the same number."""
    qb = _quote()
    flagger = next(line for line in qb.labor_lines if line.role == "Flaggers")
    raw = 3 * 10.0 * 3 * 41.113 * 1.5
    assert raw == pytest.approx(5550.255, abs=1e-9)
    assert flagger.extended == pytest.approx(5550.26, abs=1e-9)
    assert flagger.extended != raw


def test_markup_rounds_at_computation_not_presentation() -> None:
    qb = _quote(overhead_pct=0.117, profit_pct=0.083)
    # The raw products carry sub-cent tails by construction; the stored
    # overhead/profit must already be the cent values.
    assert qb.overhead == pytest.approx(round(qb.subtotal * 0.117 + 1e-9, 2), abs=0.011)
    assert _is_cents(qb.overhead)
    assert _is_cents(qb.profit)
    # And the headline identity holds exactly at cent resolution — the
    # defect #185 documents (group figures not summing to the rendered
    # total) is structurally impossible.
    assert qb.total == pytest.approx(qb.subtotal + qb.overhead + qb.profit, abs=1e-6)
