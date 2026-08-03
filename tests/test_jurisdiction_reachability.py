"""Reachability regression (#155): every authored rule record is usable.

The #155 defect class: a jurisdiction record ships in
``data/jurisdictions/`` while the fixed lists that make it reachable —
the boundary layer's SUPPORTED set and the frontend's
``JURISDICTION_OPTIONS`` dropdown — are never extended.  Greeley and
Thornton sat authored-but-unpickable for weeks.

This test closes the class: every ``data/jurisdictions/*.json`` key must
be reachable through at least one door (a supported boundary polygon,
which also implies the resolver can suggest it, or a dropdown entry), or
sit on the EXPLICIT known-unreachable allowlist below.  Adding a record
without wiring a door fails here before it ships.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
JURISDICTIONS_DIR = REPO_ROOT / "data" / "jurisdictions"
BOUNDARY_DIR = REPO_ROOT / "data" / "boundaries"
FRONTEND_OPTIONS = REPO_ROOT / "conestruct" / "site" / "lib" / "jurisdiction.ts"

# Authored records deliberately NOT yet reachable — each waits on the
# coverage-expansion follow-up issue #205 (GO ruling 2026-08-02,
# confirmation 2: this arc wires exactly Greeley + Thornton).  Remove a
# key from this list in the arc that wires its polygon/dropdown entry.
KNOWN_UNREACHABLE: set[str] = {
    "westminster",  # coverage-expansion follow-up (#205)
    "castle_rock",  # coverage-expansion follow-up (#205)
    "loveland",  # coverage-expansion follow-up (#205)
    "el_paso",  # coverage-expansion follow-up (#205)
}


def _dropdown_keys() -> set[str]:
    """Keys offered by JURISDICTION_OPTIONS, read from the source.

    A regex over the literal list is deliberate: the array is a pure
    literal (one ``{ key: "...", label: "..." }`` per line), and parsing
    the file keeps this a data-agreement check with no TS toolchain in
    the Python suite.
    """
    src = FRONTEND_OPTIONS.read_text(encoding="utf-8")
    m = re.search(r"JURISDICTION_OPTIONS[^=]*=\s*\[(.*?)\];", src, re.DOTALL)
    assert m, "JURISDICTION_OPTIONS literal not found in jurisdiction.ts"
    return set(re.findall(r'key:\s*"([^"]+)"', m.group(1)))


def test_every_authored_record_is_reachable() -> None:
    record_keys = {p.stem for p in JURISDICTIONS_DIR.glob("*.json")}
    assert record_keys, "no jurisdiction records found — wrong path?"

    polygon_keys = {
        p.stem
        for p in BOUNDARY_DIR.glob("*.geojson")
        if p.name not in ("places_unsupported.geojson", "counties.geojson")
    }
    dropdown_keys = _dropdown_keys()

    unreachable = record_keys - polygon_keys - dropdown_keys - KNOWN_UNREACHABLE
    assert not unreachable, (
        f"Authored jurisdiction records unreachable (no boundary polygon, "
        f"no dropdown entry, not on the allowlist): {sorted(unreachable)}. "
        "Wire a door or add to KNOWN_UNREACHABLE with a follow-up ref."
    )


def test_allowlist_is_not_stale() -> None:
    """An allowlisted key that gains a door must leave the allowlist."""
    polygon_keys = {
        p.stem
        for p in BOUNDARY_DIR.glob("*.geojson")
        if p.name not in ("places_unsupported.geojson", "counties.geojson")
    }
    dropdown_keys = _dropdown_keys()
    stale = KNOWN_UNREACHABLE & (polygon_keys | dropdown_keys)
    assert not stale, f"allowlisted keys are now reachable — remove them: {sorted(stale)}"


def test_allowlist_keys_are_real_records() -> None:
    record_keys = {p.stem for p in JURISDICTIONS_DIR.glob("*.json")}
    ghosts = KNOWN_UNREACHABLE - record_keys
    assert not ghosts, f"allowlist names records that do not exist: {sorted(ghosts)}"
