"""Arc 2 Step 2 - #185 live capture (read-only against the deployed backend).

One trace, three artifacts:
  A. /render/quote-breakdown with settings A (overhead 10%) -> the JSON the
     SCREEN keeps rendering after a later settings edit (QuotePanel has no
     invalidation: setBreakdown writes only at QuotePanel.tsx:227).
  B. /render/quote (XLSX bytes) with settings B (overhead 20%) -> what the
     download button actually produces after the edit (reads live settings
     at click time, QuotePanel.tsx:241-245).
  C. /render/quote-breakdown with settings B -> the correct recomputed total.

Also sums the displayed-rounded line items vs the reported totals to show
the #135 non-implementation (floats summed, rounding only at presentation).
"""
import json, os, sys, urllib.request, io

env = {}
with open(r"C:\Users\rtmak\Documents\traffic-control-tool\conestruct\site\.env.local") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k] = v
BASE = env["MODAL_RENDER_URL"].rstrip("/")
SECRET = env["MODAL_RENDER_SECRET"]

SCENARIO = {
    "kind": "shoulder", "roadType": "urban_arterial", "speed": 35, "lanes": 2,
    "laneWidth": 12, "divided": False, "workType": "utility_locate",
    "duration": "short", "workLen": 1000, "night": False,
    "meta": {"project": "", "address": "E Colfax Ave & Race St, Denver",
             "lat": 39.73997, "lng": -104.96632},
}
BASE_SETTINGS = {
    "project_duration_days": 1, "num_flaggers": 2, "delivery_distance_miles": 10,
    "profit_pct": 0.10, "flagger_hourly_rate": 35, "tcs_hourly_rate": 55,
    "crew_hourly_rate": 45,
}
A = dict(BASE_SETTINGS, overhead_pct=0.10)
B = dict(BASE_SETTINGS, overhead_pct=0.20)

def post(path, body, raw=False):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(body).encode(),
        headers={"content-type": "application/json",
                 "authorization": "Bearer " + SECRET})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
        return (r.status, data if raw else json.loads(data))

st, bd_a = post("/render/quote-breakdown", {"scenario": SCENARIO, "settings": A})
print(f"A: breakdown @ overhead 10% -> HTTP {st}; total={bd_a['total']:.4f} "
      f"subtotal={bd_a['subtotal']:.4f} overhead={bd_a['overhead']:.4f} profit={bd_a['profit']:.4f}")

st, xlsx = post("/render/quote", {"scenario": SCENARIO, "settings": B}, raw=True)
print(f"B: quote XLSX @ overhead 20% -> HTTP {st}; {len(xlsx)} bytes")
import openpyxl
wb = openpyxl.load_workbook(io.BytesIO(xlsx), data_only=True)
ws = wb.active
xl_cells = []
for row in ws.iter_rows():
    for c in row:
        if c.value is not None and isinstance(c.value, str) and ("TOTAL" in c.value.upper() or "OVERHEAD" in c.value.upper()):
            vals = [x.value for x in row if isinstance(x.value, (int, float))]
            xl_cells.append((c.value.strip(), vals))
for label, vals in xl_cells:
    print(f"   XLSX row: {label!r} -> {vals}")

st, bd_b = post("/render/quote-breakdown", {"scenario": SCENARIO, "settings": B})
print(f"C: breakdown @ overhead 20% (correct recompute) -> HTTP {st}; total={bd_b['total']:.4f} "
      f"subtotal={bd_b['subtotal']:.4f} overhead={bd_b['overhead']:.4f}")

print()
print(f"SCREEN after edit (stale, per code trace): total {bd_a['total']:.2f} with 'Markup - overhead 10%' header")
print(f"FILE after edit (live settings):           total {bd_b['total']:.2f}")
print(f"Divergence: {bd_b['total'] - bd_a['total']:+.2f} - screen and XLSX disagree in opposite directions from current inputs")

# #135 check: do displayed-rounded (2dp) line items sum to the displayed totals?
def r2(x): return round(x, 2)
for name, bd in (("A", bd_a), ("B", bd_b)):
    for group in ("equipment", "labor", "delivery"):
        lines = bd.get(f"{group}_lines", [])
        gt = bd.get(f"{group}_total")
        if lines and gt is not None:
            s = sum(r2(l["extended"]) for l in lines)
            flag = "" if abs(s - r2(gt)) < 0.005 else "  <-- rounded-line sum != displayed group total"
            print(f"#135 [{name}] {group}: sum(rounded lines)={s:.2f} vs group_total(2dp)={r2(gt):.2f}{flag}")
    s = r2(bd["subtotal"]) + r2(bd["overhead"]) + r2(bd["profit"])
    flag = "" if abs(s - r2(bd["total"])) < 0.005 else "  <-- cent drift at total"
    print(f"#135 [{name}] total: subtotal+overhead+profit (each 2dp) = {s:.2f} vs total(2dp)={r2(bd['total']):.2f}{flag}")
    print(f"#135 [{name}] raw floats: total={bd['total']!r}")
