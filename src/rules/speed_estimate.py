"""The speed a road's OSM ``highway`` class suggests when it has no posted speed (R123 Q2).

R123 Q2 (#301): "Move the road-class speed estimate to WHAT's Speed row as a
⚠ line, and keep a "Use N mph" button there.  Nothing is prefilled; the
operator's click sets it, and the audit records the speed as estimated from
the road class and chosen by the operator."

The table moves to the backend for the same reason R110 Q1 moved the street
class table: the audit states where the value came from, so the backend must
own the claim (Rule 3).  The frontend's ``SPEED_BY_CLASS``
(``lib/road-detection/classify.ts``) is its commented MIRROR, used only to
show the estimate before Generate, and ``tests/test_speed_estimate.py``
(``test_the_frontend_table_mirrors_the_backend_table``) holds the two equal.
The values are carried over unchanged from that table
("Ported verbatim from the previous lib/road-classify.ts"); they are a
fallback for a sparsely tagged way, never a posted limit, so the plan never
takes one without the operator's click.
"""

from __future__ import annotations

SPEED_BY_HIGHWAY: dict[str, int] = {
    "motorway": 65,
    "motorway_link": 45,
    "trunk": 55,
    "trunk_link": 45,
    "primary": 45,
    "primary_link": 35,
    "secondary": 40,
    "secondary_link": 30,
    "tertiary": 35,
    "tertiary_link": 30,
    "unclassified": 30,
    "residential": 25,
}


def speed_estimate_from_highway(highway_class: str) -> int | None:
    """The mph the class suggests, or None for a class with no estimate."""
    return SPEED_BY_HIGHWAY.get(highway_class)
