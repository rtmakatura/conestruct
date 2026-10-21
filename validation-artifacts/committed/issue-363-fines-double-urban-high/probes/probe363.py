import itertools, collections
import src.generation.layout as L
from src.rules.validators import ScenarioParams
cap = {}
orig = L.fines_double_envelope
def wrap(p, ts, sc):
    e = orig(p, ts, sc); cap['e'] = e; cap['ts'] = ts; return e
L.fines_double_envelope = wrap
tally = collections.Counter()
for rt, (s, wz), wl, div in itertools.product(
        ["urban_high", "rural", "expressway", "freeway"],
        [(45,35),(45,40),(50,40),(55,45),(55,50),(55,40),(65,60),(65,55),(65,45),(75,70),(75,65),(75,55)],
        [200, 500, 1000, 2000, 3000, 5000], [False, True]):
    p = ScenarioParams(speed_mph=s, num_lanes=2, closure_type="shoulder", road_type=rt,
                       work_zone_length_ft=wl, is_divided=div, work_zone_speed_mph=wz)
    cap.clear()
    try:
        (L.generate_shoulder_closure_divided if div else L.generate_shoulder_closure_undivided)(p)
    except Exception as ex:
        tally[(rt, 'ERR')] += 1; continue
    e = cap.get('e')
    if e is None: continue
    tally[(rt, 'plans')] += 1
    if e.long_gaps:
        tally[(rt, 'note')] += 1
        if div is False and rt == 'urban_high':
            print(rt, s, wz, wl, 'ts', round(cap['ts']), 'r2_10', round(e.r2_10), 'asm', [round(a) for a in e.assemblies], 'gaps', [(round(a), round(b), round(a-b)) for a,b in e.long_gaps])
for k in sorted(tally): print(k, tally[k])
# Option B': a plaque at the work area's upstream end (station = work length).
fixed = left = 0
for rt, (s, wz), wl, div in itertools.product(["urban_high"],
        [(45,35),(45,40),(50,40),(55,45),(55,50),(55,40),(65,60),(65,55),(65,45),(75,70),(75,65),(75,55)],
        [200, 500, 1000, 2000, 3000, 5000], [False, True]):
    p = ScenarioParams(speed_mph=s, num_lanes=2, closure_type="shoulder", road_type=rt,
                       work_zone_length_ft=wl, is_divided=div, work_zone_speed_mph=wz)
    cap.clear(); (L.generate_shoulder_closure_divided if div else L.generate_shoulder_closure_undivided)(p)
    e = cap['e']
    if not e.long_gaps: continue
    top = max(a for a in e.assemblies if a < cap['ts'])
    ok = wl - top >= 250 and e.r2_10 - wl <= 2640 and all(h - l <= 2640 for h, l in e.long_gaps if l != top)
    if ok: fixed += 1
    else: left += 1; print('LEFT', s, wz, wl, div, round(e.r2_10 - wl), round(wl - top))
print('B-prime fixed', fixed, 'left', left)
