"""#325: limited sight distance moves a left-shoulder plan's LEFT SHOULDER
CLOSED sign (W21-5aL) with the other advance signs, the way it moves the
right plan's W21-5aR (MUTCD §6B.04, site_adjustments._adjust_limited_sight_distance).
N Broadway SB, the #300 pair.
"""

from __future__ import annotations

from src.rules.devices import DeviceType
from src.rules.site_adjustments import apply_site_adjustments
from tests.test_left_side_oneway import broadway, plan

LSD = {"limited_sight_distance": True}


def moved(side: str) -> tuple[list[tuple[str, float]], dict]:
    params, placements = plan(broadway(side))
    before = {
        (p.label, p.offset_ft): p.station_ft
        for p in placements
        if p.device_type == DeviceType.SIGN_GENERIC
    }
    after, records = apply_site_adjustments(placements, params, LSD)
    rec = next(r for r in records if r["flag"] == "limited_sight_distance")
    shifted = sorted(
        (p.label, p.station_ft)
        for p in after
        if p.device_type == DeviceType.SIGN_GENERIC
        and before.get((p.label, p.offset_ft)) not in (None, p.station_ft)
    )
    return shifted, rec


def test_the_left_shoulder_sign_moves_like_the_right() -> None:
    right, right_rec = moved("right")
    left, left_rec = moved("left")
    assert ("W21-5aL", next(s for c, s in right if c == "W21-5aR")) in left
    assert sorted((c.replace("W21-5aR", "W21-5aL"), s) for c, s in right) == left
    assert left_rec["devices_modified"] == right_rec["devices_modified"]
