"""Prod 'before' measurement for the bundle centerline relay (#257 fold):
the zipped plan sheet vs the direct plan-sheet download for the same
Denver scenario with a confirmed road."""

import io
import json
import sys
import zipfile

import httpx
import pypdfium2 as pdfium

sys.stdout.reconfigure(encoding="utf-8")
BASE = "https://www.conestruct.com"
LAT, LNG = 39.7269, -104.9873

print("healthz:", httpx.get("https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz", timeout=30).json())
rb = httpx.post(f"{BASE}/api/road-bearing", json={"lat": LAT, "lng": LNG}, timeout=60)
print("road-bearing:", rb.status_code)
j = rb.json()
print("  scan_status:", j.get("scan_status"), "candidates:", len(j.get("candidates", [])), "primary:", j.get("primary_index"))
cand = j["candidates"][j["primary_index"] if j.get("primary_index") is not None else 0]
print("  primary:", cand.get("name"), cand.get("ref"), "bearing", cand.get("bearing"), "geometry pts", len(cand.get("geometry") or []))

scenario = {
    "kind": "shoulder",
    "meta": {
        "project": "", "address": "", "lat": LAT, "lng": LNG, "bearingDeg": round(cand["bearing"]),
        "confirmedRoad": {
            "candidate": cand,
            "classification": {"roadType": "rural_divided", "divided": True, "laneWidthFt": 12},
            "method": "auto_single", "overrides": {}, "isUrban": bool(j.get("isUrban")),
            "placeName": j.get("placeName"), "pinLat": LAT, "pinLng": LNG,
        },
    },
    "roadType": "rural_divided", "speed": 65, "lanes": 2, "laneWidth": 12, "divided": True,
    "workType": "utility_locate", "duration": "short", "workLen": 1000, "night": False,
    "jurisdiction_key": "denver",
}
print("  body bytes:", len(json.dumps({"scenario": scenario})))


def p2(pdf: bytes) -> str:
    d = pdfium.PdfDocument(pdf)
    try:
        if len(d) < 2:
            return "<no page 2>"
        tp = d[1].get_textpage()
        t = tp.get_text_range(0, tp.count_chars())
        i = t.find("CORRIDOR DETAILS")
        return t[i:i + 320].replace("\r\n", " | ")
    finally:
        d.close()


r = httpx.post(f"{BASE}/api/render/pdf", json={"scenario": scenario}, timeout=120)
print("direct pdf:", r.status_code, r.headers.get("content-type"))
direct = p2(r.content)
print("  direct p.2:", direct)
r = httpx.post(f"{BASE}/api/render/bundle", json={"scenario": scenario}, timeout=120)
print("bundle:", r.status_code, r.headers.get("content-type"))
z = zipfile.ZipFile(io.BytesIO(r.content))
print("  parts:", z.namelist())
zipped = p2(z.read("plan_sheet.pdf"))
print("  zipped p.2:", zipped)
print("Centerline row — direct:", "Centerline" in direct, "· zipped:", "Centerline" in zipped)
