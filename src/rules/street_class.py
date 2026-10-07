"""The street class a road's OSM ``highway`` tag guesses (#152 C; R108, R110).

R110 Q1: "the tag table moves to the backend".  This is the table; the
frontend's ``STREET_CLASS_BY_HIGHWAY`` (``lib/road-detection/classify.ts``)
is its commented MIRROR, used only to prefill the field before Generate,
and ``tests/test_street_class_mirror.py`` holds the two equal.  The backend
is authoritative: a render whose ``guesses.street_class`` names a tag this
table does not map to the scenario's ``street_class`` is refused as stale
(``render_api._ensure_guesses_current``).

The mapping follows the FHWA functional-class convention OSM's own wiki
documents: primary / secondary are arterials, tertiary a collector,
residential / unclassified local.  It is a GUESS: jurisdictions classify
streets by their own adopted maps, so the plan marks it "⚠ from the road"
and the audit says the operator did not confirm it (R108, Rule 10).
"""

from __future__ import annotations

from typing import Literal

StreetClass = Literal["local", "collector", "arterial"]

STREET_CLASS_BY_HIGHWAY: dict[str, StreetClass] = {
    "motorway": "arterial",
    "motorway_link": "arterial",
    "trunk": "arterial",
    "trunk_link": "arterial",
    "primary": "arterial",
    "primary_link": "arterial",
    "secondary": "arterial",
    "secondary_link": "arterial",
    "tertiary": "collector",
    "tertiary_link": "collector",
    "unclassified": "local",
    "residential": "local",
    "living_street": "local",
    "service": "local",
}

STREET_CLASS_LABEL: dict[StreetClass, str] = {
    "local": "Local",
    "collector": "Collector",
    "arterial": "Arterial",
}


def street_class_from_highway(highway_class: str) -> StreetClass | None:
    """The class the tag guesses, or None for a tag that guesses nothing."""
    return STREET_CLASS_BY_HIGHWAY.get(highway_class)
