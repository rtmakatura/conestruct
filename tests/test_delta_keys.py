"""#297: every jurisdiction delta has a stable key.

The NEEDS YOU item for a delta is id'd by it (and #297's acknowledgements
are recorded against it), so it must be unique across the shipped data and
must not move when other deltas start or stop firing.
"""

from __future__ import annotations

import json
from pathlib import Path

from src.rules import jurisdiction as j

DATA = Path(__file__).resolve().parent.parent / "data" / "jurisdictions"


def _records() -> list[dict]:
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(DATA.glob("*.json"))]


def test_every_delta_in_the_shipped_data_has_a_distinct_key() -> None:
    keys: list[str] = []
    for rec in _records():
        keys += [j.delta_key(rec["key"], d) for d in rec.get("deltas", [])]
    assert len(keys) > 20
    assert len(keys) == len(set(keys))


def test_the_key_is_the_jurisdiction_and_ten_hex() -> None:
    rec = _records()[0]
    k = j.delta_key(rec["key"], rec["deltas"][0])
    prefix, digest = k.rsplit(":", 1)
    assert prefix == rec["key"]
    assert len(digest) == 10 and int(digest, 16) >= 0


def test_a_delta_keeps_its_key_when_another_delta_stops_firing() -> None:
    rec = next(r for r in _records() if len(r.get("deltas", [])) >= 2)
    second = rec["deltas"][1]
    before = j.delta_key(rec["key"], second)
    # Drop the first delta, as if it no longer fired: the index of the
    # second would move from 1 to 0; its key does not.
    trimmed = dict(rec, deltas=rec["deltas"][1:])
    assert j.delta_key(trimmed["key"], trimmed["deltas"][0]) == before


def test_editing_a_rule_changes_its_key() -> None:
    rec = _records()[0]
    d = rec["deltas"][0]
    assert j.delta_key(rec["key"], dict(d, rule=d["rule"] + " (amended)")) != j.delta_key(
        rec["key"], d
    )
