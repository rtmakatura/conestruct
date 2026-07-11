"""Cross-language spacing parity fixture (engine-removal, Decision 1).

The frontend still carries a spacing mirror (``lib/corridor-spacing.ts``)
until PR D deletes it.  This module generates a golden grid from the
Python source of truth (``src/rules/spacing.py``) into
``tests/fixtures/spacing_parity.json``; a vitest test
(``conestruct/site/lib/spacing-parity.test.ts``) runs the TS functions
over the same grid and asserts equality.  Any backend table change that
the mirror doesn't follow fails CI on the TS side; a stale fixture
fails CI here.

This is a MIGRATION PROOF, not a permanent guard: it lives from PR B
until PR D lands and the mirror dies, then this module and the fixture
are deleted with it.

Regenerate after a deliberate table change:

    REGEN_SPACING_PARITY=1 python -m pytest tests/test_spacing_parity_fixture.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    one_lane_two_way_taper_length,
    shoulder_taper_length,
    taper_length,
)
from tests._snapshot_helper import write_snapshot

FIXTURE_PATH = Path("tests/fixtures/spacing_parity.json")

# Mirrors SCENARIO_TO_CLOSURE in lib/corridor-spacing.ts — the map this
# fixture exists to guard until PR D deletes it.
_KIND_TO_FAMILY: dict[str, str] = {
    "shoulder": "shoulder",
    "work_beyond_shoulder": "shoulder",
    "flagger_lane_closure": "one_lane_two_way",
    "lane_closure_divided": "lane",
    "mobile_op_2lane": "lane",
    "mobile_op_multilane": "lane",
    "near_intersection": "lane",
}

_SPEEDS = tuple(range(20, 80, 5))
# Table 6B-1 categories the TS mirror models, plus None (both sides
# speed-infer the category when it is absent).
_CATEGORIES = (None, "rural", "urban_low", "urban_high", "freeway")


def _taper_ft(kind: str, speed: int, lane_width: float, shoulder_width: float) -> float:
    family = _KIND_TO_FAMILY[kind]
    if family == "shoulder":
        return shoulder_taper_length(speed, shoulder_width)
    if family == "one_lane_two_way":
        return one_lane_two_way_taper_length()
    return taper_length(speed, lane_width)


def build_grid() -> list[dict]:
    rows: list[dict] = []
    for kind in sorted(_KIND_TO_FAMILY):
        for speed in _SPEEDS:
            for category in _CATEGORIES:
                if category is None and speed >= 55:
                    # The two sides genuinely DIVERGE here: the backend
                    # refuses to auto-infer a category at 55+ (rural vs
                    # freeway differ by thousands of feet) while the TS
                    # mirror silently falls back to "rural".  The
                    # divergent domain is excluded from the parity
                    # grid — it is the unsafe guess PR D retires, not
                    # parity to be preserved.
                    continue
                abc = advance_warning_spacing(speed, category)
                taper = _taper_ft(kind, speed, lane_width=12.0, shoulder_width=10.0)
                rows.append(
                    {
                        "kind": kind,
                        "speedMph": speed,
                        "laneWidthFt": 12.0,
                        "shoulderWidthFt": 10.0,
                        "roadCategory": category,
                        "taperFt": taper,
                        # Federal Table 6B-2 at posted speed — what the
                        # TS preview's bufferSpaceFt computes (the CDOT
                        # Case 26/27 conditional never fires without a
                        # work-zone step-down, which the preview does
                        # not model).
                        "bufferFt": buffer_space(speed, jurisdiction="federal"),
                        "advanceWarningFt": abc["A"] + abc["B"] + abc["C"],
                        # minWorkZoneFt(kind, ...) in the TS mirror is
                        # the same taper value by construction.
                        "minWorkZoneFt": taper,
                    }
                )
    return rows


def test_spacing_parity_fixture_is_current() -> None:
    grid = build_grid()
    if os.environ.get("REGEN_SPACING_PARITY") == "1":
        FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
        write_snapshot(FIXTURE_PATH, grid)
    assert FIXTURE_PATH.exists(), (
        "spacing parity fixture missing — generate with "
        "REGEN_SPACING_PARITY=1 python -m pytest tests/test_spacing_parity_fixture.py"
    )
    on_disk = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    assert on_disk == grid, (
        "spacing_parity.json is stale relative to src/rules/spacing.py — a "
        "table or formula changed. Regenerate the fixture (see module "
        "docstring); the vitest parity test will then hold the TS mirror "
        "to the new values."
    )
