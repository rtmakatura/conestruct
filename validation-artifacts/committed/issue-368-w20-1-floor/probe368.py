"""#368 probe: every freeway reduced-speed shoulder plan's W20-1, last W3-5
and right-side in-zone G20-5P count, taper-relative, from the generators.

Run from the worktree root: PYTHONPATH=. uv run --extra dev python <this>
"""
from src.rules.validators import ScenarioParams
from src.generation.layout import (
    generate_shoulder_closure_divided as gd,
    generate_shoulder_closure_undivided as gu,
)

print("gen sp->wz L | W20-1 lastW3-5 gap | G20-5P right (in zone)")
for g, div in ((gd, True), (gu, False)):
    for s in (55, 60, 65, 70, 75):
        for wz in range(20, s, 5):
            for L in (1000, 5000):
                p = ScenarioParams(speed_mph=s, num_lanes=2, closure_type="shoulder",
                                   road_type="freeway", work_zone_length_ft=L,
                                   is_divided=div, work_zone_speed_mph=wz)
                pl = g(p)
                ts = max(x.station_ft for x in pl if "SIGN" not in x.device_type.name and x.station_ft > L)
                w20 = max(x.station_ft for x in pl if x.label == "W20-1") - ts
                w35 = [x.station_ft - ts for x in pl if (x.label or "").startswith("W3-5")]
                last = max(w35) if w35 else None
                g20 = sum(1 for x in pl if x.label == "G20-5P" and x.offset_ft > 0 and 0 <= x.station_ft <= L)
                gap = f"{w20 - last:.0f}" if last is not None else "-"
                print(f"{'D' if div else 'U'} {s}->{wz} L{L} | {w20:.0f} {last if last is None else round(last)} {gap} | {g20}")
