# Export the recorded Lookout Mountain Road centerline as a committed test
# fixture (network-guard-safe: tests read this JSON, never Overpass).
import sys, os, math, json, datetime
sys.path.insert(0, r"C:\Users\rtmak\Documents\traffic-control-tool")
from src.rules.site_detection import _overpass_request_with_fallback

q = """[out:json][timeout:25];
way["name"="Lookout Mountain Road"]["highway"](39.70,-105.30,39.78,-105.20);
out geom tags;"""
payload, err = _overpass_request_with_fallback(q)
assert not err, err
ways = payload["elements"]
longest = max(ways, key=lambda w: len(w.get("geometry") or []))
mid = longest["geometry"][len(longest["geometry"]) // 2]
pin = (mid["lat"], mid["lon"])

# Stitch same-name chain (same walk as the Step-2 repro).
def endpoints(w):
    g = w["geometry"]
    return (round(g[0]["lat"],7), round(g[0]["lon"],7)), (round(g[-1]["lat"],7), round(g[-1]["lon"],7))
chain = list(longest["geometry"]); used = {longest["id"]}
grew = True
while grew:
    grew = False
    head = (round(chain[0]["lat"],7), round(chain[0]["lon"],7))
    tail = (round(chain[-1]["lat"],7), round(chain[-1]["lon"],7))
    for w in ways:
        if w["id"] in used or not w.get("geometry"):
            continue
        s, e = endpoints(w)
        if s == tail:
            chain.extend(w["geometry"][1:]); used.add(w["id"]); grew = True
        elif e == tail:
            chain.extend(list(reversed(w["geometry"]))[1:]); used.add(w["id"]); grew = True
        elif e == head:
            chain = list(w["geometry"][:-1]) + chain; used.add(w["id"]); grew = True
        elif s == head:
            chain = list(reversed(w["geometry"]))[:-1] + chain; used.add(w["id"]); grew = True

def hav_m(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = math.radians(b[0]-a[0]), math.radians(b[1]-a[1])
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))

pts = [(n["lat"], n["lon"]) for n in chain]
# Trim to ±4000 ft of the pin along-arc so the fixture stays compact but
# covers the 2,344 ft corridor with margin.
cum = [0.0]
for i in range(len(pts)-1):
    cum.append(cum[-1] + hav_m(pts[i], pts[i+1]))
pin_arc = min(range(len(pts)), key=lambda i: hav_m(pts[i], pin))
pin_arc_m = cum[pin_arc]
WINDOW_M = 4000 * 0.3048
keep = [p for i, p in enumerate(pts) if abs(cum[i] - pin_arc_m) <= WINDOW_M]
print(f"chain {len(pts)} nodes -> trimmed {len(keep)}")

# Production bearing at the pin: nearest-segment bearing (route.ts math).
def bear(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1]-a[1])
    y = math.sin(dl)*math.cos(p2)
    x = math.cos(p1)*math.sin(p2)-math.sin(p1)*math.cos(p2)*math.cos(dl)
    return (math.degrees(math.atan2(y, x))+360.0) % 360.0
seg_i = min(range(len(keep)-1), key=lambda i: hav_m(keep[i], pin))
bearing = bear(keep[seg_i], keep[min(seg_i+1, len(keep)-1)])

fixture = {
    "_provenance": {
        "source": "Overpass API (OpenStreetMap), query way[name='Lookout Mountain Road'][highway](39.70,-105.30,39.78,-105.20); out geom",
        "fetched": datetime.date.today().isoformat(),
        "license": "ODbL (OpenStreetMap contributors)",
        "purpose": "Recorded curved-road centerline for #140 regression tests; "
                   "the Arc 10 pre-fix measurement on this road showed the "
                   "straight-chord frame up to 1,521 ft off the centerline.",
    },
    "anchor": [pin[0], pin[1]],
    "bearing_deg": round(bearing, 1),
    "centerline": [[round(lat, 7), round(lng, 7)] for lat, lng in keep],
}
out = r"C:\Users\rtmak\Documents\traffic-control-tool\tests\fixtures\centerline\lookout_mountain_road.json"
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w") as f:
    json.dump(fixture, f, indent=1)
print("wrote", out, "anchor", fixture["anchor"], "bearing", fixture["bearing_deg"], "nodes", len(keep))
