"""#308 — is a one-way road a one-way street or one side of a divided road?

OSM maps both the same way: ``highway=primary`` (or secondary, …) with
``oneway=yes``.  What tells them apart is geometry: a divided road's other
carriageway is a way with the SAME name (or ref) running the opposite
direction close by; a one-way street's partner (Broadway / Lincoln,
13th / 14th) carries a different name a block away.  The frontend relays
the raw facts — the tag, the class, and the distance to the nearest
same-name opposite way (``CarriagewayFacts`` in ``src/api/schemas.py``) —
and this module is the ONE producer of the verdict (Rule 3; the
relay-fact pattern of #136/#158/#86/#177).  ``lib/road-detection/
classify.ts`` carries a display-only mirror.

Ruling R83 (2026-10-05): "One-way is its own fact. Divided = a same-name
twin runs the opposite direction within the radius. If the test can't
decide, the operator confirms; the plan doesn't guess."
"""

from __future__ import annotations

from typing import Literal

# CHOSEN (#308 ruling R86, 2026-10-05): the twin radius.  Measured on 28
# Denver roads (validation-artifacts/committed/issue-308-oneway-read-as-
# divided/probes/twin_sample.txt): every divided road's same-name opposite
# carriageway sat 7.3-55.4 m away (Speer Blvd, Cherry Creek between, the
# widest); no one-way street had one anywhere in a ~300 m box.  100 m is
# about 1.8x the widest median measured and still inside a Denver block;
# paired one-way streets are kept apart by their names, not by this distance.
# Known limit: a median wider than 100 m reads as a one-way street — none
# was found in the sample.
TWIN_RADIUS_M = 100.0

# The OSM ``oneway`` values that mean one direction of travel.  ``-1``
# runs against the way's vertex order and is just as one-way.
# ``reversible`` / ``alternating`` change direction by time and are not a
# one-way street in this sense.
ONE_WAY_TAGS = frozenset({"yes", "-1"})

# The classes the twin rule decides.  Motorways and trunks are divided by
# class (classify.ts); every ``*_link`` is a ramp or slip lane, which Note 8
# names on its own ("multi-lane ramps") and which is not a one-way street.
STREET_CLASSES = frozenset({"primary", "secondary", "tertiary", "unclassified", "residential"})

CarriagewayVerdict = Literal["one_way_street", "divided", "undecided", "not_applicable"]


def carriageway_verdict(
    *,
    oneway: str | None,
    highway_class: str | None,
    twin_distance_m: float | None,
    twin_searched: bool,
    confirmed: Literal["one_way_street", "divided"] | None,
) -> CarriagewayVerdict:
    """The verdict, by rules applied in order (R83):

    1. The operator answered → that answer.
    2. Not a street class, or not tagged one-way → ``not_applicable``
       (the scenario's own ``divided`` stands, exactly as before #308).
    3. A same-name twin within ``TWIN_RADIUS_M`` → ``divided``.
    4. The same-name search did not run → ``undecided`` (the operator
       confirms; the backend refuses until then).
    5. Otherwise → ``one_way_street``.
    """
    if confirmed is not None:
        return confirmed
    if highway_class not in STREET_CLASSES or oneway not in ONE_WAY_TAGS:
        return "not_applicable"
    if twin_distance_m is not None and twin_distance_m <= TWIN_RADIUS_M:
        return "divided"
    if not twin_searched:
        return "undecided"
    return "one_way_street"
