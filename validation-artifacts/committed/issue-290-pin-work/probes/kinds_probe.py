import sys
sys.path.insert(0, r"C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-289-kind-and-field")
from src.rules.spacing import *
from src.rules.corridor import build_corridor
from src.api.schemas import _map_road_type
from src.generation import layout as L
from types import SimpleNamespace

for sp in (25, 35, 45):
    rt = _map_road_type("urban_arterial", sp)
    abc = advance_warning_spacing(sp, rt)
    print(f"--- {sp} mph urban_arterial -> {rt} A/B/C={abc} buffer={buffer_space(sp)} "
          f"L(12)={taper_length(sp,12):.0f} L/3 sh8={shoulder_taper_length(sp,8):.1f} "
          f"sh10={shoulder_taper_length(sp,10):.1f} ds={downstream_taper_length(1)}")
    for kind, wz, ct in (("shoulder", 1000, "shoulder"), ("flagger", 400, "flagger"), ("lane", 500, "lane_closure")):
        c = build_corridor(0, 0, 0, sp, wz, ct, road_type=rt, shoulder_width_ft=8.0, downstream_taper_ft=50.0)
        print(f"  corridor {kind}: adv={c.advance_warning_ft} taper={c.taper_ft} buf={c.buffer_ft} "
              f"wz={c.work_zone_ft} ds={c.downstream_taper_ft} total={c.total_length_ft:.0f}; "
              f"pin->work far end={c.downstream_taper_ft + c.work_zone_ft:.0f}")
    p = SimpleNamespace(speed_mph=sp, work_zone_length_ft=400.0, jurisdiction="CDOT",
                        work_zone_speed_mph=None, road_type=rt)
    st = L.flagger_chain_stations(p)
    print("  flagger stations:", {k: v for k, v in st.items() if not isinstance(v, bool)})
