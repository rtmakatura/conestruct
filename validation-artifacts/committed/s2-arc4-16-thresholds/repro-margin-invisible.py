"""s2-arc4 (#16) — the margin-invisibility reproduction.

Two sidewalks flip the same ``pedestrian_facility`` boolean: one 10 ft
off the road centerline (inside the work zone), one 140 ft off (accepted
by the sidewalks bucket's ``accept_lateral_within_ft = 150.0`` override).
Very different field situations; the pre-fix wire hides the margin two
ways at once:

* the corridor ``details`` string for a ``lateral``-zone feature reads
  ``label [lateral @ <station> ft]`` — the station, not the offset that
  put it in the lateral zone; and
* the sandbox site-conditions rows render neither ``details`` nor
  ``nearest_distance_m`` at all (booleans only) — the frontend half,
  captured separately by the red run of the rendered-row test.

Run from repo root (any sha; behavior-only):
    python validation-artifacts/committed/s2-arc4-16-thresholds/repro-margin-invisible.py
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
sys.stdout.reconfigure(encoding="utf-8")

from src.rules import site_detection
from src.rules.corridor import build_corridor

FT_PER_M = 3.28084

corridor = build_corridor(
    lat=39.7113,
    lng=-105.0815,
    bearing_deg=0.0,
    speed_mph=40,
    work_zone_ft=800.0,
    closure_type="shoulder",
    road_type="urban_low",
)


def offset_point(station_ft: float, lateral_ft: float) -> tuple[float, float]:
    """A point lateral_ft east of the corridor centerline at station_ft."""
    lat, lng = corridor.point_at_station_ft(station_ft)
    dlng = (lateral_ft / FT_PER_M) / (111_320.0 * math.cos(math.radians(lat)))
    return lat, lng + dlng


NEAR = offset_point(400.0, 10.0)  # curb-adjacent sidewalk, inside work zone
FAR = offset_point(400.0, 140.0)  # setback path, accepted by the 150 ft override

print("placed offsets, measured back through the corridor frame:")
for name, (plat, plng) in (("near (10 ft)", NEAR), ("far (140 ft)", FAR)):
    print(
        f"  {name}: zone={corridor.classify_distance(plat, plng)}, "
        f"lateral={corridor.lateral_offset_ft(plat, plng):.1f} ft, "
        f"along={corridor.along_station_ft(plat, plng):.1f} ft"
    )


def fake_overpass(query):
    return {
        "elements": [
            {
                "type": "way",
                "id": 1,
                "center": {"lat": NEAR[0], "lon": NEAR[1]},
                "tags": {"footway": "sidewalk", "highway": "footway", "name": "Curbside Walk"},
            },
            {
                "type": "way",
                "id": 2,
                "center": {"lat": FAR[0], "lon": FAR[1]},
                "tags": {"footway": "sidewalk", "highway": "footway", "name": "Setback Path"},
            },
        ]
    }, None


site_detection._overpass_request_with_fallback = fake_overpass
result = site_detection.detect_along_corridor(corridor)

print("\nsidewalks bucket as the wire carries it:")
print(json.dumps(result["sidewalks"], indent=2))

bucket = result["sidewalks"]
print("\nthe boolean the UI renders from: detected =", bucket["detected"])
print("details strings (what a margin display would have to work with):")
for d in bucket["details"]:
    print("  -", d)
