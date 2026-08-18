"""#207 evidence — drawn vs classified frame agreement, measured.

Committed Lookout Mountain Road fixture (no network).  Two sections:

1. THE PRODUCT FRAME: what the corridor's own classification says
   about points on its drawn corridor.  Pre-#207 (chord classification)
   this is the defect record: 22/24 stations misclassified, max along
   error 868 ft, 16/24 drawn points outside the Overpass bbox.
   Post-#207 it is the acceptance record: agreement within 2.0 ft,
   containment 24/24.

2. THE CHORD TWIN: the identical corridor with the centerline
   withheld — reproduces the pre-#207 classification at ANY sha (the
   Arc 10 FORCE_CHORD idiom, script-level; the product carries no
   flag: no centerline attached ⇒ the chord frame, structurally).

Run from the repo root with the venv python.
"""

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from src.rules.corridor import WorkCorridor, _destination_point, build_corridor  # noqa: E402

M_PER_FT = 0.3048
FT_PER_M = 1.0 / 0.3048

data = json.loads(
    (ROOT / "tests/fixtures/centerline/lookout_mountain_road.json").read_text()
)

corr = build_corridor(
    lat=data["anchor"][0],
    lng=data["anchor"][1],
    bearing_deg=data["bearing_deg"],
    speed_mph=40,
    work_zone_ft=800.0,
    closure_type="shoulder",
    road_type="urban_high",
    centerline=tuple((p[0], p[1]) for p in data["centerline"]),
)
chord = WorkCorridor(
    anchor_lat=corr.anchor_lat,
    anchor_lng=corr.anchor_lng,
    anchor_description="chord twin",
    bearing_deg=corr.bearing_deg,
    advance_warning_ft=corr.advance_warning_ft,
    taper_ft=corr.taper_ft,
    buffer_ft=corr.buffer_ft,
    work_zone_ft=corr.work_zone_ft,
    downstream_taper_ft=corr.downstream_taper_ft,
    centerline=None,
)


def true_zone(s, c):
    cum = 0.0
    for length, label in (
        (c.downstream_taper_ft, "downstream"),
        (c.work_zone_ft, "work_zone"),
        (c.buffer_ft, "buffer"),
        (c.taper_ft, "transition"),
        (c.advance_warning_ft, "advance_warning"),
    ):
        cum += length
        if s <= cum:
            return label
    return "advance_warning"


def measure(frame_corr, title):
    """Classify the DRAWN corridor's points through ``frame_corr``."""
    print(f"=== {title} ===")
    bbox = frame_corr.corridor_bbox(lateral_buffer_m=100.0, longitudinal_buffer_m=152.4)
    south, west, north, east = bbox
    covered = corr.centerline_coverage_ft() or 0.0
    limit = min(covered, corr.total_length_ft)
    # 50-ft phase so the 100-ft stride never lands on an exact zone
    # boundary (the <= cut is a float coin-flip there — the straight
    # control recorded a 25-millionths-of-a-foot tie at station 900).
    s = 50.0
    n = mis = out = 0
    worst_err = worst_lat = 0.0
    while s <= limit:
        lat, lng = corr.point_at_station_ft(s)  # drawn position, ON the road
        along = frame_corr.along_station_ft(lat, lng)
        lateral = frame_corr.lateral_offset_ft(lat, lng)
        zone = frame_corr.classify_distance(lat, lng)
        tz = true_zone(s, corr)
        n += 1
        if zone != tz:
            mis += 1
        if not (south <= lat <= north and west <= lng <= east):
            out += 1
        worst_err = max(worst_err, abs(along - s))
        worst_lat = max(worst_lat, lateral)
        s += 100.0
    print(f"sampled {n} on-road stations (50 + 100k ft, 0..{limit:.0f})")
    print(f"max along-station error: {worst_err:.1f} ft")
    print(f"max lateral offset of an on-road point: {worst_lat:.1f} ft")
    print(f"misclassified zones: {mis}/{n}")
    print(f"drawn points outside frame's Overpass bbox: {out}/{n}")
    print()
    return mis, out


print(f"fixture: {len(data['centerline'])} vertices, bearing {data['bearing_deg']}")
print(
    f"corridor: total {corr.total_length_ft:.0f} ft "
    f"(dt {corr.downstream_taper_ft:.0f} / wz {corr.work_zone_ft:.0f} / "
    f"buf {corr.buffer_ft:.0f} / taper {corr.taper_ft:.0f} / adv {corr.advance_warning_ft:.0f})"
)
print()

prod_mis, prod_out = measure(corr, "PRODUCT FRAME (centerline attached)")
chord_mis, chord_out = measure(chord, "CHORD TWIN (centerline withheld — the pre-#207 repro)")

ok = prod_mis == 0 and prod_out == 0 and chord_mis > 10 and chord_out > 10
print(f"VERDICT: {'agreement holds; chord twin reproduces the defect' if ok else 'MEASUREMENTS OFF-PATTERN — inspect'}")
