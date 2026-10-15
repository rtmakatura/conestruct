"""#322: generate the near-intersection plan from a captured scenario.

    python gen322.py <scenario.json> <base> <outdir>

The scenario is the one the site really sent (capture322.cjs).  Two
things the picker would add by hand are added here:
  * the cross street (the picker marks it by a map click): the confirmed
    road's nearest named cross street from #285's own read, its OSM node's
    position and name;
  * a side: the right side, with the road's geometry.
Then /api/render/audit and /api/render/pdf run through the site's proxy
(gate header from GATE_BYPASS_TOKEN, never printed), and the Note 8 row,
the sign placement and the title are printed.
"""

import json
import os
import sys
from pathlib import Path

import httpx
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from gate import gate_headers  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402
from src.rules.nearest_intersection import build_query, from_overpass  # noqa: E402

src_path, base, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
s = json.loads(Path(src_path).read_text(encoding="utf-8"))
cand = s["meta"]["confirmedRoad"]["candidate"]
pin = (s["meta"]["lat"], s["meta"]["lng"])
line = [tuple(p) for p in cand["geometry"]]
key, value = ("name", cand["name"]) if cand.get("name") else ("ref", cand["ref"])

data, err = sd._overpass_request_with_fallback(build_query(pin[0], pin[1], key, value), budget_s=20)
assert data is not None, err
ans = from_overpass(data, pin, line, key, value)
assert ans.status == "found", ans
node = next(e for e in data["elements"] if e["type"] == "node" and e["id"] == ans.osm_node_id)
s["meta"]["intersection"] = {"lat": node["lat"], "lng": node["lon"], "name": ans.cross_street}
s["meta"]["work"] = {"side": "right", "travel": "with_geometry"}
print(f"cross street: {ans.cross_street} (OSM node {ans.osm_node_id}), {ans.text}")
(out / "scenario-generated.json").write_text(json.dumps(s, indent=1), encoding="utf-8")

h = {**gate_headers(base), "content-type": "application/json"}
with httpx.Client(timeout=180) as c:
    a = c.post(f"{base}/api/render/audit", headers=h, content=json.dumps({"scenario": s}))
    p = c.post(f"{base}/api/render/pdf", headers=h, content=json.dumps({"scenario": s}))
print("audit", a.status_code, "| pdf", p.status_code)
if a.status_code != 200:
    print(a.text[:500])
    sys.exit(1)
audit = a.json()
(out / "audit.json").write_text(json.dumps(audit, indent=1), encoding="utf-8")


def walk(o, hits):
    if isinstance(o, dict):
        for v in o.values():
            walk(v, hits)
    elif isinstance(o, list):
        for v in o:
            walk(v, hits)
    elif isinstance(o, str) and ("both sides" in o.lower() or "signs placed" in o.lower()):
        hits.append(o)


hits: list[str] = []
walk(audit, hits)
for h_ in dict.fromkeys(hits):
    print("audit:", h_)
cs = (audit.get("sections") or {}).get("colorado") or {}
for chk in cs.get("checks", []):
    if "both sides" in json.dumps(chk).lower():
        print("Note 8 row:", json.dumps(chk, ensure_ascii=False))
if p.status_code == 200:
    (out / "plan.pdf").write_bytes(p.content)
    doc = pdfium.PdfDocument(p.content)
    text = doc[0].get_textpage().get_text_range()
    title = next((ln for ln in text.splitlines() if "LANE CLOSURE" in ln.upper()), "")
    print("page 1 title line:", title.strip())
    doc[0].render(scale=2).to_pil().save(out / "plan-p1.png")
