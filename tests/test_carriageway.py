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
    "highway_class", ["motorway_link", "trunk_link", "primary_link", "secondary_link"]
)
def test_ramps_keep_their_class_rule(highway_class: str) -> None:
    """A ramp is not a one-way street (Note 8 names multi-lane ramps on
    their own)."""
    assert verdict(highway_class=highway_class) == "not_applicable"


@pytest.mark.parametrize("highway_class", ["trunk", "motorway"])
def test_a_one_way_trunk_or_motorway_is_divided_by_class(highway_class: str) -> None:
    """#322: one carriageway of a divided highway.  No twin test: the class
    says it, as classify.ts already reads it for the shoulder kind."""
    assert verdict(highway_class=highway_class) == "divided"
    assert verdict(highway_class=highway_class, twin_searched=False) == "divided"
    assert verdict(highway_class=highway_class, oneway="-1") == "divided"


@pytest.mark.parametrize("oneway", [None, "no"])
def test_a_two_way_trunk_is_undivided(oneway: str | None) -> None:
    """#332: one way carrying both directions (US 24 near Hartsel) has no
    median.  Before #332 it was ``not_applicable`` and the site's
    divided-by-class flag stood."""
    assert verdict(highway_class="trunk", oneway=oneway) == "undivided"


def test_an_untagged_motorway_is_not_undivided() -> None:
    """OSM implies ``oneway=yes`` on every motorway, tagged or not: an
    untagged motorway is still one carriageway, so the scenario's own
    ``divided`` stands."""
    assert verdict(highway_class="motorway", oneway=None) == "not_applicable"


@pytest.mark.parametrize("oneway", ["reversible", "alternating"])
def test_a_reversible_trunk_keeps_its_own_divided(oneway: str) -> None:
    """Reversible express lanes are their own carriageway, not a two-lane
    road: the scenario's ``divided`` stands, as before #332."""
    assert verdict(highway_class="trunk", oneway=oneway) == "not_applicable"


def test_a_ramp_that_is_two_way_is_still_its_class_rule() -> None:
    assert verdict(highway_class="trunk_link", oneway=None) == "not_applicable"


def test_the_operator_answer_still_wins_on_a_trunk() -> None:
    assert verdict(highway_class="trunk", confirmed="one_way_street") == "one_way_street"
