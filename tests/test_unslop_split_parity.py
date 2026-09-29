"""Split parity for the two backend helpers that parse copy as data (R37).

The unslop pass (R37/R38) moved two separators:

- ``site_adjustments`` ``rule`` strings: ``"MUTCD §X — title"`` became
  ``"MUTCD §X: title"``; ``audit._site_citation`` now splits on the first
  ``": "`` instead of ``" — "``.
- ``validators.scenario_display_name`` titles: ``"Kind — Road"`` became
  ``"Kind · Road"``; ``scenario_display_name_short`` now splits on
  ``" · "``.

The old strings are frozen here as literals.  For every rule and every
title, the new split of the new string must yield exactly the parts the
old split yielded from the old string, so the panel citation chip and
the PDF PARAMETERS short name are byte-identical across the copy change.
"""

from __future__ import annotations

import pytest

from src.api.audit import _site_citation
from src.rules.site_adjustments import apply_site_adjustments
from src.rules.validators import (
    ScenarioParams,
    scenario_display_name,
    scenario_display_name_short,
)

# Frozen baseline: the seven site-adjustment ``rule`` strings before R37.
_OLD_SITE_RULES: dict[str, str] = {
    "limited_sight_distance": "MUTCD §6B.04 — increased advance warning for limited sight distance",
    "adjacent_intersection": (
        "MUTCD §6N.12 p. 848 — Work within the Traveled Way at an Intersection (11th Ed.)"
    ),
    "adjacent_interchange": "MUTCD §6N.16 p. 851 — Interchanges (11th Ed.)",
    "driveways_present": "MUTCD §6K.01 — access management in work zones",
    "pedestrian_facility": "MUTCD §6C.02 — pedestrian considerations in work zones",
    "bicycle_facility": "MUTCD §9C.101 — bicycle facility work zone signing",
    "school_zone": "MUTCD §7B.08 — school zone signing in proximity to work zones",
}


def _old_site_split(rule: str) -> list[str]:
    return rule.split(" — ")


def _new_site_split(rule: str) -> list[str]:
    return rule.split(": ", 1)


def _old_site_citation(rule: str) -> str:
    """``audit._site_citation`` as it was before R37."""
    return rule.split(" — ")[0].replace("§", "§ ")


def _base_params(**overrides) -> ScenarioParams:
    kwargs = {
        "speed_mph": 45,
        "num_lanes": 1,
        "lane_width_ft": 12.0,
        "closure_type": "shoulder",
        "road_type": "rural",
        "work_zone_length_ft": 500.0,
        "is_divided": False,
        "jurisdiction": "CDOT",
    }
    kwargs.update(overrides)
    return ScenarioParams(**kwargs)


def _new_site_rules() -> dict[str, str]:
    _, records = apply_site_adjustments([], _base_params(), {f: True for f in _OLD_SITE_RULES})
    return {str(r["flag"]): str(r["rule"]) for r in records}


def test_every_old_site_rule_has_a_new_counterpart() -> None:
    assert set(_new_site_rules()) == set(_OLD_SITE_RULES)


@pytest.mark.parametrize("flag", sorted(_OLD_SITE_RULES))
def test_site_rule_split_parity(flag: str) -> None:
    old = _OLD_SITE_RULES[flag]
    new = _new_site_rules()[flag]
    assert "—" not in new
    old_parts = _old_site_split(old)
    new_parts = _new_site_split(new)
    # Two parts on both sides, and the parts are identical.
    assert len(old_parts) == 2
    assert new_parts == old_parts
    # The left (citation) part never contains the new separator, so the
    # first ": " is always the boundary.
    assert ": " not in new_parts[0]
    # The helper the panel chip reads is byte-identical to the old one.
    assert _site_citation(new) == _old_site_citation(old)


# Frozen baseline: the seven em-dash titles before R37/R38 Q1, keyed by
# the ScenarioParams that produce them.
_TITLE_CASES: list[tuple[str, dict, str]] = [
    (
        "mobile_divided",
        {"closure_type": "mobile", "is_divided": True},
        "Mobile Operation — Multi-Lane Road",
    ),
    (
        "mobile_undivided",
        {"closure_type": "mobile", "is_divided": False},
        "Mobile Operation — 2-Lane Road",
    ),
    (
        "near_intersection",
        {"closure_type": "lane", "is_divided": False, "near_intersection": True},
        "Lane Closure Near Intersection — Undivided",
    ),
    (
        "flagger",
        {"closure_type": "lane", "is_divided": False},
        "Flagger Alternating Traffic — 2-Lane Undivided",
    ),
    (
        "lane_divided",
        {"closure_type": "lane", "is_divided": True},
        "Right-Lane Closure — Divided Highway",
    ),
    (
        "shoulder_divided",
        {"closure_type": "shoulder", "is_divided": True},
        "Shoulder Closure — Divided Highway",
    ),
    (
        "shoulder_undivided_2lane",
        {"closure_type": "shoulder", "is_divided": False, "num_lanes": 2},
        "Shoulder Closure — 4-Lane Undivided",
    ),
]


@pytest.mark.parametrize(
    ("key", "overrides", "old"), _TITLE_CASES, ids=[c[0] for c in _TITLE_CASES]
)
def test_scenario_title_split_parity(key: str, overrides: dict, old: str) -> None:
    params = _base_params(**overrides)
    new = scenario_display_name(params)
    assert "—" not in new
    old_parts = old.split(" — ")
    new_parts = new.split(" · ", 1)
    assert len(old_parts) == 2
    assert new_parts == old_parts
    # The short form (PDF PARAMETERS box) is byte-identical to the old one.
    assert scenario_display_name_short(params) == old.split(" — ")[0]


def test_title_without_qualifier_is_unchanged() -> None:
    """``Work Beyond the Shoulder`` never had a separator; the short form
    returns it whole, before and after."""
    params = _base_params(closure_type="off_road")
    assert scenario_display_name(params) == "Work Beyond the Shoulder"
    assert scenario_display_name_short(params) == "Work Beyond the Shoulder"
