"""#362 probe: which reduced-speed shoulder plans cut advance rows on page 1, and what.

Run from the worktree root: PYTHONPATH=. uv run --extra dev python <this>
Spies on the plan sheet's advance table: the full list, and the rows the
final (real) draw gets.  Grid = #363's 96-plan grid plus large step-downs.
"""
import itertools, os
from fastapi.testclient import TestClient
from tests.s630._harness import _common
from tests.s630 import test_cross_surface as tcs
from src.rendering import plan_sheet as ps

os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
os.environ["MAPBOX_TOKEN"] = "test-token"
tcs._ps.httpx.get = lambda *a, **k: tcs._FakeTile()
tcs._ps._validate_corridor_bearing = lambda corridor: None
api = TestClient(tcs._render_app)

seen: dict = {}
_build = ps._build_advance_warning_table
def build(*a, **k):
    r = _build(*a, **k); seen["full"] = r; seen["drawn"] = None; return r
ps._build_advance_warning_table = build
for name in ("_draw_advance_table_one_column", "_draw_advance_table_two_column"):
    f = getattr(ps, name)
    def spy(c, adv, *a, _f=f, **k):
        seen["drawn"] = len(adv); return _f(c, adv, *a, **k)
    setattr(ps, name, spy)

PLAQUES = {"G20-5P", "R2-6P"}
cut_plans = 0; total = 0
for road, (s, wz), wl in itertools.product(
        ["urban_arterial", "rural_undivided", "rural_divided", "freeway"],
        [(45, 35), (55, 45), (55, 50), (65, 55), (65, 60), (75, 65), (75, 70), (55, None),
         (55, 35), (65, 45), (65, 40), (75, 55), (75, 45), (75, 40)],
        [200, 1000, 5000]):
    body = {**_common(s, wz), "roadType": road, "divided": road in ("rural_divided", "freeway"),
            "workLen": wl}
    seen.clear()
    r = api.post("/render/pdf", json=body, headers=tcs._API_HEADERS)
    key = f"{road} {s}->{wz} L{wl}"
    if r.status_code != 200 or "full" not in seen:
        print(key, "HTTP", r.status_code); continue
    total += 1
    full = seen["full"]; drawn = seen["drawn"] if seen["drawn"] is not None else 0
    if drawn < len(full):
        cut_plans += 1
        cut = [c for c, _d, _s in full[drawn:]]
        nplq = sum(1 for c, _d, _s in full if c in PLAQUES)
        print(f"{key}: {len(full)} rows, draws {drawn}, plaque rows {nplq}, cut {cut}")
print(total, "plans;", cut_plans, "cut on page 1")
