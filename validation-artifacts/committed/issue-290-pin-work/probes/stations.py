"""Probe (#290 checkpoint Q1): build_corridor's stations from the pin, today.

Read-only: imports the shipped code, prints numbers.  Run from the repo root.
"""
import json
import sys

sys.path.insert(0, ".")
from src.rules.corridor import build_corridor, _initial_bearing_deg, _haversine_m  # noqa: E402

CASES = [
    # name, lat, lng, detected bearing (prod /api/road-bearing 2026-09-25), oneway tag, speed, road_type, kind, workLen
    ("E Colfax EB (arc standing spot)", 39.74020, -104.95600, 90.02, "yes", 30, "urban_low", "shoulder", 1000),
    ("E Colfax EB, 35 mph", 39.74020, -104.95600, 90.02, "yes", 35, "urban_low", "shoulder", 1000),
    ("N Broadway SB", 39.73370, -104.98753, 180.49, "yes", 30, "urban_low", "shoulder", 1000),
    ("E Colfax EB, flagger 400", 39.74020, -104.95600, 90.02, "yes", 30, "urban_low", "flagger_alternating_2lane", 400),
]
out = []
for name, lat, lng, brg, oneway, spd, rt, kind, wl in CASES:
    for use_max in (False, True):
        c = build_corridor(lat=lat, lng=lng, bearing_deg=brg, speed_mph=spd, work_zone_ft=wl,
                           closure_type=kind, road_type=rt, downstream_taper_use_max=use_max)
        d = c.downstream_taper_ft
        stations = {
            "downstream": [0.0, d],
            "work_zone": [d, d + c.work_zone_ft],
            "buffer": [d + c.work_zone_ft, d + c.work_zone_ft + c.buffer_ft],
            "transition": [d + c.work_zone_ft + c.buffer_ft, d + c.work_zone_ft + c.buffer_ft + c.taper_ft],
            "advance_warning": [d + c.work_zone_ft + c.buffer_ft + c.taper_ft, c.total_length_ft],
        }
        up = c.upstream_point()
        row = {
            "case": name, "use_max": use_max, "bearing_sent": brg, "osm_oneway": oneway,
            "lengths_ft": {"advance": c.advance_warning_ft, "taper": c.taper_ft, "buffer": c.buffer_ft,
                            "work": c.work_zone_ft, "downstream": c.downstream_taper_ft,
                            "total": c.total_length_ft},
            "stations_from_pin_ft": stations,
            "first_sign_from_pin": {
                "ft": round(_haversine_m(lat, lng, *up) / 0.3048, 1),
                "compass_deg": round(_initial_bearing_deg(lat, lng, *up), 2),
            },
            "work_near_edge_ft_from_pin": d,
            "work_upstream_edge_ft_from_pin": d + c.work_zone_ft,
        }
        out.append(row)
        print(json.dumps(row))
json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else "stations.json", "w"), indent=2)
