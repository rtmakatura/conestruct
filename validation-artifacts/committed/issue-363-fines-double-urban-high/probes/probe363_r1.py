# #363 re-probe under Ryan's condition: the added plaque must be >= 250 ft
# from every other sign in the plan (G20-1 included), Sheet 12 Note 4.
# Run from the repo root: PYTHONPATH=. uv run python <this file>
import itertools, collections
import src.generation.layout as L
from src.rules.validators import ScenarioParams
cap = {}
orig = L.fines_double_envelope
def wrap(p, ts, sc):
    e = orig(p, ts, sc); cap['e'] = e; cap['ts'] = ts; return e
L.fines_double_envelope = wrap
noted = strict = loose = 0
blockers = collections.Counter()
for (s, wz), wl, div in itertools.product(
        [(45,35),(45,40),(50,40),(55,45),(55,50),(55,40),(65,60),(65,55),(65,45),(75,70),(75,65),(75,55)],
        [200, 500, 1000, 2000, 3000, 5000], [False, True]):
    p = ScenarioParams(speed_mph=s, num_lanes=2, closure_type="shoulder", road_type="urban_high",
                       work_zone_length_ft=wl, is_divided=div, work_zone_speed_mph=wz)
    cap.clear()
    pl = (L.generate_shoulder_closure_divided if div else L.generate_shoulder_closure_undivided)(p)
    e = cap['e']
    if not e.long_gaps: continue
    noted += 1
    signs = {(x.label, round(x.station_ft)) for x in pl if 'SIGN' in x.device_type.name}
    def clear(st):
        bad = [lab for lab, v in signs if abs(v - st) < 250]
        return bad
    top = max(a for a in e.assemblies if a < cap['ts'])
    def closes(st):
        return e.r2_10 - st <= 2640 and st - top <= 2640
    # Strict (b'): the spot is the work area's upstream end.
    bad = clear(wl)
    if not bad and closes(wl): strict += 1
    for lab in set(bad): blockers[lab] += 1
    # Loose: any spot in the work area, 10 ft grid.
    if any(not clear(st) and closes(st) for st in range(0, wl + 1, 10)): loose += 1
    if div is False and s == 55 and wz == 45:
        print(wl, 'G20-1/G20-5P stations', sorted(v for lab, v in signs if lab in ('G20-1', 'G20-5P')))
print('noted', noted, 'fixed strict (upstream end)', strict, 'fixed loose (any work-area spot)', loose)
print('signs within 250 ft of the upstream end:', dict(blockers))
