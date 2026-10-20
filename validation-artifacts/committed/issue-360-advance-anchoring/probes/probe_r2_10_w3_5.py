from src.rules.validators import ScenarioParams
from src.generation.layout import generate_shoulder_closure_divided as gd, generate_shoulder_closure_undivided as gu
import itertools
print("gen rt sp->wz | taperStart | W20-1 R2-10 W3-5s entR2-1 | flags")
for (g,div), rt, (s,wz), L in itertools.product([(gd,True),(gu,False)], ["urban_high","rural","expressway","freeway"], [(45,35),(55,45),(55,50),(65,60),(65,55),(65,45),(75,70),(75,65),(75,55)], [500,2000]):
    try:
        p = ScenarioParams(speed_mph=s, num_lanes=2, closure_type="shoulder", road_type=rt, work_zone_length_ft=L, is_divided=div, work_zone_speed_mph=wz)
        pl = g(p)
    except Exception as e:
        print(rt,s,wz,L,"ERR",type(e).__name__); continue
    ch = [x.station_ft for x in pl if "SIGN" not in x.device_type.name and x.station_ft>L]
    ts = max(ch) if ch else None
    st = lambda lab: sorted({round(x.station_ft) for x in pl if x.label==lab})
    w35 = sorted({round(x.station_ft) for x in pl if (x.label or "").startswith("W3-5")})
    r210 = st("R2-10"); adv = sorted({round(x.station_ft) for x in pl if (x.label or "").startswith(("W20-1","W21-5"))})
    bad = [v for v in r210+w35 if ts and v<=ts]
    print(f"{'D' if div else 'U'} {rt:10} {s}->{wz} L{L} | ts={ts} | adv={adv} R2-10={r210} W3-5={w35} | {'INSIDE '+str(bad) if bad else ''}")
