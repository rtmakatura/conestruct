"""Probe plugin: simulate 'pin = work start' by moving build_corridor's anchor.

The pin (lat,lng) is reinterpreted as the upstream edge of the work area
(station downstream_taper_ft + work_zone_ft in today's frame), so the
downstream anchor is displaced by that distance against the bearing.
Direct WorkCorridor(...) constructions are untouched.
"""
import dataclasses
import os

import src.rules.corridor as C

_orig = C.build_corridor


def _shifted(*a, **k):
    cor = _orig(*a, **k)
    if os.environ.get("ANCHOR_SHIFT") == "2":
        shift_ft = cor.advance_warning_ft + cor.taper_ft + cor.buffer_ft
    else:
        shift_ft = cor.downstream_taper_ft + cor.work_zone_ft
    lat, lng = C._destination_point(
        cor.anchor_lat, cor.anchor_lng, (cor.bearing_deg + 180.0) % 360.0, shift_ft * C.M_PER_FT
    )
    return dataclasses.replace(cor, anchor_lat=lat, anchor_lng=lng)


if os.environ.get("ANCHOR_SHIFT") in ("1", "2"):
    C.build_corridor = _shifted
