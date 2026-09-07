"""Render a run's rows.json (s2a22-runs.js) as the README's markdown table.
Usage: python rows-to-table.py <outDir>"""

import json
import sys
from pathlib import Path

rows = json.loads((Path(sys.argv[1]) / "rows.json").read_text(encoding="utf-8"))
K = ("intersections", "interchanges", "sidewalks", "bike_facilities")
print("| run | pin | HTTP | wall | scan | memo | dur ms | measured_at | int/ich/sw/bike | mirror | bytes | elem | corridor | Note 8 |")
print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
for r in rows:
    counts = "/".join((r.get("counts") or {}).get(k, "-").lstrip("D-") or "0" for k in K) if r.get("counts") else "—"
    mirror = (r.get("mirror") or "—").replace("https://", "").replace("/api/interpreter", "")
    note8 = (r.get("note8") or "—").split(" (")[0]
    status = r.get("status")
    if str(status).startswith("HTTP"):
        status = f"**{status}** {str(r.get('error')).replace(' | ', ' — ')}"
    print(
        f"| {r['run']} | {r['pin']} | {r['http']} | {r['ms']/1000:.1f} s | {status} | "
        f"{'yes' if r.get('memo_hit') else 'no'} | {r.get('duration_ms') or '—'} | "
        f"{(r.get('measured_at') or '—')[11:19]} | {counts} | {mirror} | {r.get('response_bytes') or '—'} | "
        f"{r.get('element_count') if r.get('element_count') is not None else '—'} | {r.get('corridor') or '—'} | {note8} |"
    )
