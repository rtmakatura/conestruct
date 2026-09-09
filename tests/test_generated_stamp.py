"""#268 — one generated stamp for every deliverable (pure half).

Four files printed four formats from three clocks (server-local
``datetime.now()`` in the XLSX / quote / crew paths, ``date.today()`` on
the plan sheet).  The ruling: ONE format — the plan sheet's
``YYYY-MM-DD`` — read from the UTC clock, zone omitted.  Two helpers in
``src/rules/validators.py`` (the module every deliverable already
imports for ``scenario_display_name``):

* ``generated_at(now=None) -> datetime`` — the instant as a NAIVE UTC
  datetime, the shape openpyxl writes as a real date cell.
* ``generated_stamp(now=None) -> str`` — that instant as ``YYYY-MM-DD``.

``now`` is injected for tests; production reads ``_utcnow()`` (the one
monkeypatch seam the payload-level tests in the surface suites use).
Rule 3: formatting only — no value is computed here.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta, timezone

import pytest

from src.rules import validators
from src.rules.validators import generated_at, generated_stamp

_INSTANT = datetime(2026, 9, 8, 16, 7, 35, 123456, tzinfo=UTC)
_STAMP_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def test_generated_stamp_is_the_utc_date_zone_omitted() -> None:
    assert generated_stamp(_INSTANT) == "2026-09-08"
    assert _STAMP_RE.match(generated_stamp(_INSTANT))


def test_generated_stamp_converts_a_non_utc_instant_to_the_utc_date() -> None:
    # 23:30 on the 8th in Denver (UTC-6 in September) is 05:30 on the 9th UTC:
    # the stamp names the UTC date, never the wall-clock date of a server.
    denver = datetime(2026, 9, 8, 23, 30, tzinfo=timezone(timedelta(hours=-6)))
    assert generated_stamp(denver) == "2026-09-09"


def test_generated_at_is_naive_utc_to_the_second() -> None:
    at = generated_at(_INSTANT)
    assert at.tzinfo is None, "openpyxl date cells take naive datetimes"
    assert at == datetime(2026, 9, 8, 16, 7, 35)


def test_generated_at_treats_a_naive_now_as_utc() -> None:
    naive = datetime(2026, 9, 8, 16, 7, 35)
    assert generated_at(naive) == naive


def test_stamp_and_at_agree_on_the_same_instant() -> None:
    assert generated_stamp(_INSTANT) == generated_at(_INSTANT).strftime("%Y-%m-%d")


def test_default_now_reads_the_utc_clock_seam(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(validators, "_utcnow", lambda: _INSTANT)
    assert generated_stamp() == "2026-09-08"
    assert generated_at() == datetime(2026, 9, 8, 16, 7, 35)


def test_utcnow_is_zone_aware_utc() -> None:
    # The seam itself: an aware UTC instant, so nothing downstream can
    # read a server-local wall clock by accident.
    now = validators._utcnow()
    assert now.tzinfo is not None
    assert now.utcoffset() == timedelta(0)
