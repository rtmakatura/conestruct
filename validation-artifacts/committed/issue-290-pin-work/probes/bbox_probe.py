import math, sys
sys.path.insert(0, r"C:\Users\rtmak\Documents\traffic-control-tool\.claude\worktrees\issue-289-kind-and-field")
from src.rules.corridor import build_corridor, WorkCorridor, _destination_point
from src.rules.site_detection import _CORRIDOR_LATERAL_BUFFER_M as LAT, _CORRIDOR_LONGITUDINAL_BUFFER_M as LON
from src.api.schemas import _map_road_type
FT=0.3048
LAT0, LNG0 = 39.7392, -104.9903  # Denver
def area(b):
    s,w,n,e=b
    h=(n-s)*111_320.0
    wd=(e-w)*111_320.0*math.cos(math.radians((n+s)/2))
    return h,wd,h*wd
KINDS=[("shoulder","shoulder","urban_arterial",1000,8.0),
       ("near_intersection","lane","urban_arterial",500,8.0),
       ("flagger(rural_undiv)","lane","rural_undivided",400,8.0),
       ("flagger(urban_art)","lane","urban_arterial",400,8.0)]
print("kind|speed|road|AW|taper|buf|work|dstaper|total_ft|bearing|today LxW (m)|today km2|after_total_ft|after LxW|after km2|ratio|strip km2 today|strip after|2-box after km2")
for name,ct,rt,work,sw in KINDS:
    for sp in (25,35,45):
        road=_map_road_type(rt,sp)
        c=build_corridor(LAT0,LNG0,0.0,sp,work,ct,road_type=road,shoulder_width_ft=sw,downstream_taper_use_max=True)
        approach=c.advance_warning_ft+c.taper_ft+c.buffer_ft
        flag=name.startswith("flagger")
        after_total = (2*approach + work) if flag else c.total_length_ft
        for brg in (0.0,45.0):
            ct2=build_corridor(LAT0,LNG0,brg,sp,work,ct,road_type=road,shoulder_width_ft=sw,downstream_taper_use_max=True)
            h,wd,a=area(ct2.corridor_bbox(lateral_buffer_m=LAT,longitudinal_buffer_m=LON))
            # after: model as a straight corridor of after_total length (anchor-agnostic; bbox covers whole extent)
            wc=WorkCorridor(LAT0,LNG0,"x",brg,advance_warning_ft=after_total,taper_ft=0,buffer_ft=0,work_zone_ft=0,downstream_taper_ft=0)
            h2,w2,a2=area(wc.corridor_bbox(lateral_buffer_m=LAT,longitudinal_buffer_m=LON))
            strip_t=(c.total_length_ft*FT+2*LON)*2*LAT
            strip_a=(after_total*FT+2*LON)*2*LAT
            # two boxes: each approach + half work + pads
            twob=""
            if flag:
                seg=approach+work/2
                wb=WorkCorridor(LAT0,LNG0,"x",brg,advance_warning_ft=seg,taper_ft=0,buffer_ft=0,work_zone_ft=0,downstream_taper_ft=0)
                twob=f"{2*area(wb.corridor_bbox(lateral_buffer_m=LAT,longitudinal_buffer_m=LON))[2]/1e6:.3f}"
            print(f"{name}|{sp}|{road}|{c.advance_warning_ft:.0f}|{c.taper_ft:.0f}|{c.buffer_ft:.0f}|{work}|{c.downstream_taper_ft:.0f}|{c.total_length_ft:.0f}|{brg:.0f}|{h:.0f}x{wd:.0f}|{a/1e6:.3f}|{after_total:.0f}|{h2:.0f}x{w2:.0f}|{a2/1e6:.3f}|{a2/a:.2f}|{strip_t/1e6:.3f}|{strip_a/1e6:.3f}|{twob}")
# fixed-radius pre-scan box covering use_max for all live kinds at <=45 mph (worst after-extent either direction from pin)
