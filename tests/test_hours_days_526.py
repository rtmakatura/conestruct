"""#526: the hours check per day kind (``hours_days``), for the What
section's Work dates line and the work-hours window.

Every window here is the committed jurisdiction data's (data/jurisdictions);
the tests read the records, never restate their hours except as the
expected answer for that record.
"""

from __future__ import annotations

from datetime import date

from src.rules.jurisdiction import (
    PlanContext,
    WorkSchedule,
    evaluate,
    evaluate_hours,
    evaluate_hours_days,
    load_jurisdiction,
)

MON = date(2026, 11, 16)
FRI = date(2026, 11, 20)
SUN = date(2026, 11, 22)


def ctx(cls: str | None = "arterial", **sched: object) -> PlanContext:
    s = WorkSchedule(**sched) if sched else None  # type: ignore[arg-type]
    return PlanContext(street_class=cls, schedule=s)


def days(key: str, c: PlanContext) -> dict:
    out = evaluate_hours_days(load_jurisdiction(key), c)
    assert out is not None
    return out


def test_no_windows_is_none() -> None:
    assert evaluate_hours_days(load_jurisdiction("cdot"), ctx()) is None


def test_waits_on_dates_then_times() -> None:
    assert days("denver", ctx())["missing"] == "dates"
    d = days("denver", ctx(date_mode="range", work_date=MON, work_date_end=FRI))
    # The cause of "set dates to check" with dates set: the times.
    assert (d["status"], d["missing"]) == ("unknown", "times")
    # The allowed spans are there before the times are.
    assert d["kinds"]["weekday"]["allowed"] == [[0.0, 5.0], [8.5, 15.5], [20.0, 24.0]]


def test_class_unset_waits_on_street_class() -> None:
    c = ctx(None, date_mode="single", work_date=MON, start_time=9.0, end_time=15.0)
    d = days("denver", c)
    assert (d["status"], d["missing"]) == ("unknown", "street_class")
    assert d["kinds"]["weekday"]["allowed"] is None
    # hours_eval says only "unknown" for the same input, which the old
    # line read as "set dates to check".
    assert evaluate_hours(load_jurisdiction("denver"), c)["status"] == "unknown"


def test_fits_and_outside_on_weekdays() -> None:
    fit = days(
        "denver",
        ctx(date_mode="range", work_date=MON, work_date_end=FRI, start_time=9.0, end_time=15.0),
    )
    assert (fit["status"], fit["missing"]) == ("inside", None)
    assert fit["job"]["kinds"] == ["weekday"]
    out = days(
        "denver",
        ctx(date_mode="range", work_date=MON, work_date_end=FRI, start_time=7.0, end_time=17.0),
    )
    wd = out["kinds"]["weekday"]
    assert out["status"] == "outside"
    assert wd["outside"] == [[7.0, 8.5], [15.5, 17.0]]
    assert (wd["starts_before"], wd["ends_after"], wd["fix"]) == (8.5, 15.5, [8.5, 15.5])
    assert wd["sources"][0]["doc"] == "Rule 22.3"


def test_night_work_offers_the_overnight_window() -> None:
    d = days("denver", ctx(date_mode="single", work_date=MON, start_time=18.0, end_time=2.0))
    wd = d["kinds"]["weekday"]
    assert wd["outside"] == [[18.0, 20.0]]
    assert wd["fix"] == [20.0, 5.0]
    assert (wd["starts_before"], wd["ends_after"]) == (20.0, None)
    inside = days("denver", ctx(date_mode="single", work_date=MON, start_time=21.0, end_time=4.0))
    assert inside["status"] == "inside"


def test_weekend_in_the_dates_is_checked() -> None:
    # Englewood's all-days 7 am to 7 pm window applies on weekends too.
    d = days(
        "englewood",
        ctx(
            "local",
            date_mode="range",
            work_date=MON,
            work_date_end=SUN,
            start_time=6.0,
            end_time=12.0,
        ),
    )
    assert d["job"]["kinds"] == ["weekday", "weekend"]
    assert d["job"]["kind_dates"]["weekend"] == ["2026-11-21", "2026-11-22"]
    assert d["kinds"]["weekend"]["allowed"] == [[7.0, 19.0]]
    assert d["kinds"]["weekend"]["starts_before"] == 7.0
    # The weekday is the nested envelope: 8:30 am to 3:30 pm.
    assert d["kinds"]["weekday"]["allowed"] == [[8.5, 15.5]]
    # hours_eval still reads only the first date's day kind (unchanged).
    assert (
        evaluate_hours(
            load_jurisdiction("englewood"),
            PlanContext(
                street_class="local",
                schedule=WorkSchedule(
                    date_mode="range",
                    work_date=MON,
                    work_date_end=SUN,
                    start_time=6.0,
                    end_time=12.0,
                ),
            ),
        )["status"]
        == "outside"
    )


def test_misses_every_window() -> None:
    d = days(
        "parker", ctx("local", date_mode="single", work_date=MON, start_time=17.0, end_time=20.0)
    )
    wd = d["kinds"]["weekday"]
    assert wd["misses"] is True
    assert wd["fix"] == [9.0, 15.5]


def test_a_three_week_job() -> None:
    d = days(
        "denver",
        ctx(
            date_mode="range",
            work_date=date(2026, 11, 18),
            work_date_end=date(2026, 12, 8),
            start_time=9.0,
            end_time=15.0,
        ),
    )
    job = d["job"]
    assert job["days"] == 21
    assert job["kinds"] == ["weekday", "weekend"]
    assert [w["date"] for w in job["week"]][:2] == ["2026-11-16", "2026-11-17"]
    assert [w["in_job"] for w in job["week"]] == [False, False, True, True, True, True, True]
    # Round 2 (R145 S11): each day kind's count over the whole job.
    assert job["kind_days"] == {"weekday": 15, "weekend": 6}
    # Round 2 (R145 S10): Denver's weekends have no window on record, so the
    # job is "partial" (weekdays inside, weekends no record), never "inside".
    assert d["kinds"]["weekend"]["record"] == "none"
    assert d["kinds"]["weekend"]["status"] == "no_record"
    assert d["status"] == "partial"


def test_block_carries_it_and_hours_eval_is_unchanged() -> None:
    rec = load_jurisdiction("denver")
    c = ctx(date_mode="single", work_date=MON, start_time=7.0, end_time=17.0)
    block = evaluate(rec, c)
    assert block["hours_days"] == evaluate_hours_days(rec, c)
    assert block["hours_eval"] == evaluate_hours(rec, c)


# --- Round 2 (R145 S10, Rule 10): no window on record is absence ------------


def test_a_day_kind_with_no_window_is_no_record_not_allowed() -> None:
    d = days(
        "denver",
        ctx(date_mode="range", work_date=MON, work_date_end=FRI, start_time=9.0, end_time=15.0),
    )
    we = d["kinds"]["weekend"]
    # The spans stay the honest value (no rule subtracts anything) ...
    assert we["allowed"] == [[0.0, 24.0]]
    # ... but the record says there is no window, and the status says so.
    assert (we["record"], we["status"], we["sources"]) == ("none", "no_record", [])
    assert d["kinds"]["weekday"]["record"] == "windows"
    # A weekday-only job never reads the weekend: it fits.
    assert d["status"] == "inside"


def test_a_class_with_no_window_is_no_record() -> None:
    # Denver's windows are scoped to arterials and collectors: a local
    # street has none on record on any day.
    d = days(
        "denver",
        ctx(
            "local",
            date_mode="range",
            work_date=MON,
            work_date_end=SUN,
            start_time=9.0,
            end_time=15.0,
        ),
    )
    assert [d["kinds"][k]["record"] for k in ("weekday", "weekend")] == ["none", "none"]
    assert d["status"] == "no_record"
    assert d["kinds"]["weekday"]["fix"] is None


def test_partial_and_outside_over_both_kinds() -> None:
    week = dict(date_mode="range", work_date=MON, work_date_end=SUN)
    fits = days("denver", ctx(**week, start_time=9.0, end_time=15.0))
    assert fits["status"] == "partial"
    out = days("denver", ctx(**week, start_time=7.0, end_time=17.0))
    # Outside wins over a kind with no record.
    assert out["status"] == "outside"
    # Englewood's all-days window gives weekends a record.
    eng = days("englewood", ctx("local", **week, start_time=9.0, end_time=15.0))
    assert eng["kinds"]["weekend"]["record"] == "windows"
    assert eng["status"] == "inside"


def test_ban_only_day_kinds_have_a_record() -> None:
    # Castle Rock's weekend rule is a ban (6 pm to 8 am): a rule on record.
    d = days("castle_rock", ctx(date_mode="single", work_date=SUN, start_time=9.0, end_time=15.0))
    assert d["kinds"]["weekend"]["record"] == "windows"
    assert d["kinds"]["weekend"]["allowed"] == [[8.0, 18.0]]


def test_class_unset_reads_windows_while_it_waits() -> None:
    c = ctx(None, date_mode="single", work_date=MON, start_time=9.0, end_time=15.0)
    d = days("denver", c)
    assert d["kinds"]["weekday"]["record"] == "windows"
    assert d["missing"] == "street_class"
