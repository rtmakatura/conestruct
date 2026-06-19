"""Tests for editable quote rates (overhead / profit / labor) — issue #74.

Three layers:
  * Zero-churn: passing the five rate kwargs at their defaults reproduces the
    quote computed with no rate kwargs at all (the surfacing is plumbing; the
    math is untouched).
  * Flow-through (unit): a non-default overhead / profit / labor rate moves the
    total by exactly the documented formula, and each labor kwarg is wired to
    its own role (guards against forwarding the wrong settings field).
  * API: QuoteSettings → _run_quote → generate_quote — the only new backend
    path — reflects non-default settings in the /render/quote-breakdown JSON,
    honours the defaults, and rejects an out-of-range percentage.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.export.quote_generator import generate_quote
from src.generation.layout import generate_shoulder_closure_divided
from src.rules.validators import DevicePlacement, ScenarioParams

# generate_quote's own defaults — the values the UI fields default to and the
# numbers an unset request must reproduce. Mirrored here so a future change to
# the function signature that forgets to update a default trips a test.
_DEFAULT_OVERHEAD_PCT = 0.10
_DEFAULT_PROFIT_PCT = 0.10
_DEFAULT_FLAGGER_RATE = 55.0
_DEFAULT_TCS_RATE = 75.0
_DEFAULT_CREW_RATE = 45.0

# Standard shift length applied to flaggers in _compute_labor_lines.
_FLAGGER_HOURS_PER_DAY = 10.0
_DURATION_DAYS = 3
_NUM_FLAGGERS = 2


def _params() -> ScenarioParams:
    """Reference scenario: I-25 freeway, 55 mph, divided shoulder closure."""
    return ScenarioParams(
        speed_mph=55,
        num_lanes=3,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_night=False,
        is_divided=True,
        jurisdiction="CDOT",
    )


def _placements() -> list[DevicePlacement]:
    return generate_shoulder_closure_divided(_params(), shoulder_width_ft=10.0)


def _quote(**rate_overrides):
    """generate_quote on the reference scenario with the labor count pinned so
    every labor role carries a nonzero line; rate kwargs are caller-supplied."""
    with tempfile.TemporaryDirectory() as td:
        _, breakdown = generate_quote(
            _placements(),
            _params(),
            output_path=str(Path(td) / "q.xlsx"),
            project_duration_days=_DURATION_DAYS,
            num_flaggers=_NUM_FLAGGERS,
            **rate_overrides,
        )
    return breakdown


# ---------------------------------------------------------------------------
# Zero-churn: explicit defaults == implicit defaults
# ---------------------------------------------------------------------------


def test_default_rates_reproduce_no_kwarg_quote() -> None:
    """The five rate kwargs at their defaults yield the same quote as omitting
    them entirely — proves surfacing them changed no output."""
    implicit = _quote()
    explicit = _quote(
        overhead_pct=_DEFAULT_OVERHEAD_PCT,
        profit_pct=_DEFAULT_PROFIT_PCT,
        flagger_hourly_rate=_DEFAULT_FLAGGER_RATE,
        tcs_hourly_rate=_DEFAULT_TCS_RATE,
        crew_hourly_rate=_DEFAULT_CREW_RATE,
    )
    for field in (
        "equipment_total",
        "labor_total",
        "delivery_total",
        "subtotal",
        "overhead_pct",
        "profit_pct",
        "overhead",
        "profit",
        "total",
    ):
        assert getattr(explicit, field) == pytest.approx(getattr(implicit, field)), field


# ---------------------------------------------------------------------------
# Flow-through: markup
# ---------------------------------------------------------------------------


def test_overhead_pct_flows_through() -> None:
    qb = _quote(overhead_pct=0.20)
    assert qb.overhead_pct == 0.20
    assert qb.overhead == pytest.approx(qb.subtotal * 0.20)
    # Profit still rides on subtotal + overhead (Colorado vendor convention),
    # so a bigger overhead lifts profit too.
    assert qb.profit == pytest.approx((qb.subtotal + qb.overhead) * qb.profit_pct)
    assert qb.total == pytest.approx(qb.subtotal + qb.overhead + qb.profit)


def test_profit_pct_flows_through() -> None:
    qb = _quote(profit_pct=0.25)
    assert qb.profit_pct == 0.25
    assert qb.profit == pytest.approx((qb.subtotal + qb.overhead) * 0.25)
    assert qb.total == pytest.approx(qb.subtotal + qb.overhead + qb.profit)


# ---------------------------------------------------------------------------
# Flow-through: each labor rate is wired to its own role
# ---------------------------------------------------------------------------


def test_flagger_rate_flows_through() -> None:
    """+$10/hr on the flagger rate lifts labor by flaggers x 10 hr x days x $10."""
    base = _quote(flagger_hourly_rate=_DEFAULT_FLAGGER_RATE)
    bumped = _quote(flagger_hourly_rate=_DEFAULT_FLAGGER_RATE + 10.0)
    expected = _NUM_FLAGGERS * _FLAGGER_HOURS_PER_DAY * _DURATION_DAYS * 10.0
    assert bumped.labor_total - base.labor_total == pytest.approx(expected)


def test_tcs_rate_flows_through() -> None:
    """TCS line is 1 person x 2 hr/day x days; +$10/hr lifts labor by 1x2xdaysx10."""
    base = _quote(tcs_hourly_rate=_DEFAULT_TCS_RATE)
    bumped = _quote(tcs_hourly_rate=_DEFAULT_TCS_RATE + 10.0)
    expected = 1 * 2.0 * _DURATION_DAYS * 10.0
    assert bumped.labor_total - base.labor_total == pytest.approx(expected)


def test_crew_rate_flows_through() -> None:
    """Setup + takedown crew (2 people; 1.5 + 1.0 hr, 1 day each); +$10/hr lifts
    labor by 2 x (1.5 + 1.0) x 1 x $10 = $50."""
    base = _quote(crew_hourly_rate=_DEFAULT_CREW_RATE)
    bumped = _quote(crew_hourly_rate=_DEFAULT_CREW_RATE + 10.0)
    expected = 2 * (1.5 + 1.0) * 1 * 10.0
    assert bumped.labor_total - base.labor_total == pytest.approx(expected)


# ---------------------------------------------------------------------------
# API: QuoteSettings -> _run_quote -> generate_quote
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module", autouse=True)
def _set_render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def _auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-secret-do-not-deploy"}


def _shoulder_scenario() -> dict:
    return {
        "kind": "shoulder",
        "meta": {"project": "T", "address": "", "lat": 0.0, "lng": 0.0},
        "roadType": "rural_divided",
        "speed": 55,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 800.0,
        "night": False,
    }


def test_quote_breakdown_reflects_non_default_settings(client: TestClient) -> None:
    settings = {
        "project_duration_days": _DURATION_DAYS,
        "num_flaggers": _NUM_FLAGGERS,
        "overhead_pct": 0.20,
        "profit_pct": 0.25,
        "flagger_hourly_rate": 65.0,
        "tcs_hourly_rate": 90.0,
        "crew_hourly_rate": 50.0,
    }
    res = client.post(
        "/render/quote-breakdown",
        headers=_auth_headers(),
        json={"scenario": _shoulder_scenario(), "settings": settings},
    )
    assert res.status_code == 200, res.text
    body = res.json()

    assert body["overhead_pct"] == 0.20
    assert body["profit_pct"] == 0.25
    assert body["overhead"] == pytest.approx(body["subtotal"] * 0.20)
    assert body["profit"] == pytest.approx((body["subtotal"] + body["overhead"]) * 0.25)

    rates = {line["role"]: line["rate"] for line in body["labor_lines"]}
    assert rates["Flaggers"] == 65.0
    assert rates["TCS Supervisor"] == 90.0
    assert rates["Setup Crew"] == 50.0
    assert rates["Takedown Crew"] == 50.0


def test_quote_breakdown_defaults_when_settings_omitted(client: TestClient) -> None:
    """No settings block → the surfaced rates fall back to today's defaults."""
    res = client.post(
        "/render/quote-breakdown",
        headers=_auth_headers(),
        json={"scenario": _shoulder_scenario()},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["overhead_pct"] == _DEFAULT_OVERHEAD_PCT
    assert body["profit_pct"] == _DEFAULT_PROFIT_PCT


def test_quote_breakdown_rejects_out_of_range_overhead(client: TestClient) -> None:
    """overhead_pct is bounded 0..1; 2.0 (200%) is a 422, not a silent clamp."""
    res = client.post(
        "/render/quote-breakdown",
        headers=_auth_headers(),
        json={
            "scenario": _shoulder_scenario(),
            "settings": {"overhead_pct": 2.0},
        },
    )
    assert res.status_code == 422, res.text
