import sys
sys.path.insert(0, r"C:\Users\rtmak\Documents\traffic-control-tool\.claude\worktrees\issue-289-kind-and-field")
from src.rules.corridor import build_corridor
from src.api.schemas import _map_road_type
for ct,rt,sw in [("shoulder","urban_arterial",8.0),("shoulder","rural_divided",10.0),("shoulder","freeway",10.0),("lane","rural_undivided",8.0),("lane","urban_arterial",8.0)]:
    row=[]
    for sp in (25,35,45,55,65):
        try:
            c=build_corridor(0,0,0,sp,0,ct,road_type=_map_road_type(rt,sp),shoulder_width_ft=sw,downstream_taper_use_max=True)
            row.append(f"{sp}:{c.advance_warning_ft+c.taper_ft+c.buffer_ft:.0f}")
        except Exception as e: row.append(f"{sp}:ERR")
    print(ct,rt,"approach_ft",row)
