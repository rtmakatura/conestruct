"""#308 — the carriageway predicate: a one-way street or one side of a divided road.

Ruling R83: "One-way is its own fact. Divided = a same-name twin runs the
opposite direction within the radius. If the test can't decide, the
operator confirms; the plan doesn't guess."  R86: the radius is measured
first (``validation-artifacts/committed/issue-308-oneway-read-as-divided/
probes/twin_sample.txt``) and CHOSEN.  One case per rule, in the order the
predicate applies them.
"""

from __future__ import annotations

import pytest

from src.rules.carriageway import TWIN_RADIUS_M, carriageway_verdict


def verdict(**over):
    facts = {
        "oneway": "yes",
        "highway_class": "primary",
        "twin_distance_m": None,
        "twin_searched": True,
        "confirmed": None,
    }
    facts.update(over)
    return carriageway_verdict(**facts)


def test_the_radius_is_the_chosen_100_m() -> None:
    assert TWIN_RADIUS_M == 100.0


def test_no_twin_after_a_completed_search_is_a_one_way_street() -> None:
    """North Broadway: no same-name opposite way in the pool."""
    assert verdict() == "one_way_street"


@pytest.mark.parametrize("twin_m", [7.3, 21.7, 55.4, 100.0])
def test_a_same_name_twin_within_the_radius_is_divided(twin_m: float) -> None:
    """Sheridan 7.3 m, Colorado 21.7 m, Speer 55.4 m, and the edge itself."""
    assert verdict(twin_distance_m=twin_m) == "divided"


def test_a_twin_beyond_the_radius_does_not_make_it_divided() -> None:
    assert verdict(twin_distance_m=100.1) == "one_way_street"


def test_a_search_that_did_not_run_cannot_decide() -> None:
    assert verdict(twin_searched=False) == "undecided"


def test_a_twin_found_decides_even_if_the_search_flag_is_false() -> None:
    """A distance is evidence; only its absence needs the search."""
    assert verdict(twin_searched=False, twin_distance_m=12.0) == "divided"


@pytest.mark.parametrize("answer", ["one_way_street", "divided"])
def test_the_operator_answer_wins(answer: str) -> None:
    assert verdict(confirmed=answer, twin_searched=False) == answer
    assert verdict(confirmed=answer, twin_distance_m=12.0) == answer


@pytest.mark.parametrize("oneway", [None, "no", "reversible", "alternating"])
def test_a_road_that_is_not_one_way_is_not_this_predicates_question(oneway) -> None:
    assert verdict(oneway=oneway) == "not_applicable"


@pytest.mark.parametrize("oneway", ["yes", "-1"])
def test_both_one_way_tag_values_count(oneway: str) -> None:
    assert verdict(oneway=oneway) == "one_way_street"


@pytest.mark.parametrize("highway_class", ["secondary", "tertiary", "unclassified", "residential"])
def test_every_street_class_takes_the_twin_rule(highway_class: str) -> None:
    """R85: secondary one-way streets are included (and the classes below)."""
    assert verdict(highway_class=highway_class) == "one_way_street"
    assert verdict(highway_class=highway_class, twin_distance_m=17.2) == "divided"


@pytest.mark.parametrize(
    "highway_class",
    ["motorway", "motorway_link", "trunk", "trunk_link", "primary_link", "secondary_link"],
)
def test_motorways_trunks_and_ramps_keep_their_class_rule(highway_class: str) -> None:
    """A ramp is not a one-way street (Note 8 names multi-lane ramps on
    their own); motorways and trunks are divided by class."""
    assert verdict(highway_class=highway_class) == "not_applicable"
