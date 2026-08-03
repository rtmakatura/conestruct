"""Schedule-pair arc: overnight shifts (#188) + window composition (#206).

Per Rule 11 these test where the bugs lived: #188's rejection was a
Pydantic 422 at the wire and #206's false verdict rode the
/render/device-breakdown payload — so the primary tests POST scenarios
through the endpoint seam and assert on ``hours_eval`` in the response.
Function-level golden cases pin the segment/union math directly.

Facts used (quoted from data/jurisdictions/, verified in-file):
- denver: work_window, weekday arterial/collector 8:30–15:30 plus the
  split night pair 20–24 + 0–5 ("Night window 8:00pm-5:00am." /
  "Night-window continuation."), Rule 22.3 §IV.4.
- castle_rock: noise_conditioned weekday bans 19–24 + 0–7.
- greeley: nested_envelope — outer 7–19 all streets, inner 8:30–16
  arterials/collectors.
2026-08-05 is a Wednesday (weekday windows).
"""

from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.rules.jurisdiction import (
    WorkSchedule,
    context_for_closure_type,
    evaluate_hours,
    load_jurisdiction,
)

AUTH = {"Authorization": "Bearer test-secret"}

WEDNESDAY = date(2026, 8, 5)


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RENDER_API_SECRET", "test-secret")


@pytest.fixture()
def client():
    return TestClient(app)


def _shoulder_scenario(**extra) -> dict:
    base = {
        "kind": "shoulder",
        "roadType": "urban_arterial",
        "speed": 35,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 800.0,
        "night": False,
    }
    base.update(extra)
    return base


def _schedule(start: float, end: float, mode: str = "single", **extra) -> dict:
    sched = {"date_mode": mode, "start_time": start, "end_time": end}
    if mode == "single":
        sched["work_date"] = WEDNESDAY.isoformat()
    sched.update(extra)
    return sched


def _hours_eval(client: TestClient, scenario: dict) -> dict:
    res = client.post("/render/device-breakdown", headers=AUTH, json=scenario)
    assert res.status_code == 200, res.text
    return res.json()["jurisdiction"]["hours_eval"]


def _ctx(key: str, start: float, end: float, work_date: date | None = WEDNESDAY):
    record = load_jurisdiction(key)
    ctx = context_for_closure_type(
        "shoulder",
        street_class="arterial",
        night=False,
        schedule=WorkSchedule(
            date_mode="single",
            work_date=work_date,
            start_time=start,
            end_time=end,
        ),
    )
    return record, ctx


# ---------------------------------------------------------------------------
# #188 — overnight shifts reach the evaluation
# ---------------------------------------------------------------------------


def test_overnight_denver_night_window_is_inside(client):
    """The acceptance case: 20:00–05:00 was a 422 at the wire; it is
    exactly the shift Denver's night window permits."""
    ev = _hours_eval(
        client,
        _shoulder_scenario(
            jurisdiction_key="denver",
            street_class="arterial",
            schedule=_schedule(20.0, 5.0),
        ),
    )
    assert ev["status"] == "inside"
    assert ev["violations"] == []
    assert "overnight" in ev["note"]


def test_overnight_castle_rock_bans_price_the_full_wrap(client):
    """20:00–05:00 Wednesday vs the weekday noise bans: 4 h inside 19–24
    plus 5 h inside 0–7 — both segments must be counted."""
    ev = _hours_eval(
        client,
        _shoulder_scenario(
            jurisdiction_key="castle_rock",
            street_class="arterial",
            schedule=_schedule(20.0, 5.0),
        ),
    )
    assert ev["status"] == "outside"
    overlaps = sorted(v["overlap_hours"] for v in ev["violations"])
    assert overlaps == [4.0, 5.0]
    assert all(v["kind"] == "ban_window_overlap" for v in ev["violations"])


def test_equal_times_stay_rejected_at_the_wire(client):
    """end == start is ambiguous (zero-length vs 24 h wrap) and keeps the
    honest 400-class refusal, with the wrap semantics named."""
    res = client.post(
        "/render/device-breakdown",
        headers=AUTH,
        json=_shoulder_scenario(
            jurisdiction_key="denver",
            street_class="arterial",
            schedule=_schedule(9.0, 9.0),
        ),
    )
    assert res.status_code == 422
    assert "wraps past midnight" in res.text


def test_overnight_segments_split_at_midnight():
    """Function-level pin of the segment convention: [(s,24),(0,e)],
    matching the data files' midnight-split window encoding."""
    from src.rules.jurisdiction import _schedule_segments

    assert _schedule_segments(20.0, 5.0) == [(20.0, 24.0), (0.0, 5.0)]
    assert _schedule_segments(9.0, 15.0) == [(9.0, 15.0)]


# ---------------------------------------------------------------------------
# #206 — work-window composition: union within a scope, cumulative across
# ---------------------------------------------------------------------------


def test_denver_compliant_day_shift_is_inside(client):
    """The #206 regression: 9:00–15:00 weekday arterial sits inside
    Denver's 8:30–15:30 window; pre-fix the split night pair was wrongly
    intersected in, flagging 21 phantom hours."""
    ev = _hours_eval(
        client,
        _shoulder_scenario(
            jurisdiction_key="denver",
            street_class="arterial",
            schedule=_schedule(9.0, 15.0),
        ),
    )
    assert ev["status"] == "inside"
    assert ev["violations"] == []


def test_denver_genuine_violation_still_caught(client):
    """Union must not become amnesty: 10:00–16:00 runs 0.5 h past the
    15:30 close and no alternative window covers it."""
    ev = _hours_eval(
        client,
        _shoulder_scenario(
            jurisdiction_key="denver",
            street_class="arterial",
            schedule=_schedule(10.0, 16.0),
        ),
    )
    assert ev["status"] == "outside"
    assert len(ev["violations"]) == 1
    v = ev["violations"][0]
    assert v["kind"] == "outside_work_window"
    assert v["outside_hours"] == 0.5
    # The additive alternatives field names the whole scope group, so the
    # card can render the union instead of one window of a pair.
    assert [(w["start"], w["end"]) for w in v["windows"]] == [
        (8.5, 15.5),
        (20.0, 24.0),
        (0.0, 5.0),
    ]
    # Compat: the singular window field stays populated.
    assert v["window"]["start"] == 8.5


def test_greeley_nested_envelope_stays_cumulative():
    """Distinct scopes remain separate constraints: 7:30–15:00 on a
    Greeley arterial satisfies the outer 7–19 envelope but starts 1 h
    before the inner 8:30 gate — exactly one violation."""
    record, ctx = _ctx("greeley", 7.5, 15.0)
    ev = evaluate_hours(record, ctx)
    assert ev["status"] == "outside"
    assert len(ev["violations"]) == 1
    v = ev["violations"][0]
    assert v["outside_hours"] == 1.0
    assert v["window"] == {"start": 8.5, "end": 16.0, "days": "all"}


def test_no_schedule_stays_unknown():
    """Control: the honest unset arm is unchanged."""
    record = load_jurisdiction("denver")
    ctx = context_for_closure_type("shoulder", street_class="arterial", night=False, schedule=None)
    ev = evaluate_hours(record, ctx)
    assert ev["status"] == "unknown"
    assert ev["note"] == "no work schedule provided"
