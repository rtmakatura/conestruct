# Arc 10 evidence, #140: measure the drawn corridor against the real OSM
# centerline, using the PRODUCTION corridor math (build_corridor /
# point_at_station_ft).  SAME SCRIPT, BOTH SIDES: at the pre-fix sha
# build_corridor has no `centerline` parameter, so the script measures
# the straight chord (the defect); at the post-fix sha the parameter
# exists and the same measurement runs against the road-following frame.
#
# Usage (Lookout Mountain Road, the pre-fix 1,521 ft case):
#   NAMED_WAY="Lookout Mountain Road" BBOX="39.70,-105.30,39.78,-105.20" \
#   PREFER_NAME=Lookout RENDER_PDF=1 OUT_PREFIX=post-fix- python capture-140-chord-deviation.py
import sys, os, math, re, json
import inspect
sys.path.insert(0, r"C:\Users\rtmak\Documents\traffic-control-tool")
with open(r"C:\Users\rtmak\Documents\traffic-control-tool\.env") as f:
    for line in f:
        m = re.match(r"^\s*([A-Z_]+)\s*=\s*(.+?)\s*$", line)
        if m:
            os.environ.setdefault(m.group(1), m.group(2).strip('"'))

import httpx
from src.rules.corridor import build_corridor

PIN_LAT, PIN_LNG = float(os.environ.get("PIN_LAT", "39.74540")), float(os.environ.get("PIN_LNG", "-104.99970"))
PREFER_NAME = os.environ.get("PREFER_NAME", "")  # snap only to ways whose name contains this
M_PER_FT = 0.3048
R_EARTH = 6371000.0

def haversine_m(a_lat, a_lng, b_lat, b_lng):
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lng - a_lng)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R_EARTH * math.asin(math.sqrt(h))

def bearing_deg(a_lat, a_lng, b_lat, b_lng):
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dl = math.radians(b_lng - a_lng)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1)*math.sin(p2) - math.sin(p1)*math.cos(p2)*math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0

# --- Overpass: same shape as road-bearing/route.ts buildQuery (around:200 for
# stitching room; production uses 50 m for candidate search, then we walk the
# named chain like a centerline fetch would).
NAMED_WAY = os.environ.get("NAMED_WAY", "")
if NAMED_WAY:
    q = f"""[out:json][timeout:25];
way["name"="{NAMED_WAY}"]["highway"]({os.environ["BBOX"]});
out geom tags;"""
else:
    q = f"""[out:json][timeout:25];
way(around:400,{PIN_LAT},{PIN_LNG})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link)$"];
out geom tags;"""
from src.rules.site_detection import _overpass_request_with_fallback
payload, err = _overpass_request_with_fallback(q)
if err:
    raise SystemExit(f"overpass failed: {err}")
ways = payload["elements"]
print(f"overpass returned {len(ways)} ways")

# Nearest-segment snap across all ways (production: projectOnSegment).
def project(p_lat, p_lng, a, b):
    # local equirectangular, like route.ts:181-210
    kx = math.cos(math.radians(p_lat)) * 111320.0
    ky = 110540.0
    ax, ay = (a["lon"] - p_lng) * kx, (a["lat"] - p_lat) * ky
    bx, by = (b["lon"] - p_lng) * kx, (b["lat"] - p_lat) * ky
    dx, dy = bx - ax, by - ay
    L2 = dx*dx + dy*dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, -(ax*dx + ay*dy) / L2))
    px, py = ax + t*dx, ay + t*dy
    return math.hypot(px, py), t

if NAMED_WAY:
    # Pin = a mid-geometry node of the longest fetched way, so the anchor is
    # exactly on the road (mirrors a user dropping the pin on the road).
    longest = max(ways, key=lambda w: len(w.get("geometry") or []))
    mid = longest["geometry"][len(longest["geometry"]) // 2]
    PIN_LAT, PIN_LNG = mid["lat"], mid["lon"]
    print(f"pin set on way {longest['id']} mid-node: {PIN_LAT:.5f}, {PIN_LNG:.5f}")

seen = {}
for w in ways:
    nm = w["tags"].get("name", "?")
    g = w.get("geometry") or []
    if g:
        d = min(project(PIN_LAT, PIN_LNG, g[i], g[i+1])[0] for i in range(len(g)-1))
        seen[nm] = min(seen.get(nm, 1e9), d)
print("nearest names:", sorted(seen.items(), key=lambda kv: kv[1])[:6])

best = None
for w in ways:
    if PREFER_NAME and PREFER_NAME.lower() not in w["tags"].get("name", "").lower():
        continue
    g = w.get("geometry") or []
    for i in range(len(g) - 1):
        d, t = project(PIN_LAT, PIN_LNG, g[i], g[i+1])
        if best is None or d < best[0]:
            best = (d, w, i, t)
snap_d, way, seg_i, seg_t = best
name = way["tags"].get("name", "?")
prod_bearing = bearing_deg(way["geometry"][seg_i]["lat"], way["geometry"][seg_i]["lon"],
                           way["geometry"][seg_i+1]["lat"], way["geometry"][seg_i+1]["lon"])
print(f"snapped to '{name}' way {way['id']} seg {seg_i} at {snap_d:.1f} m; production bearing {prod_bearing:.1f}")

# Stitch same-name ways into one chain by shared endpoints (both directions).
same = [w for w in ways if w["tags"].get("name") == name and w.get("geometry")]
def endpoints(w):
    g = w["geometry"]
    return (round(g[0]["lat"],7), round(g[0]["lon"],7)), (round(g[-1]["lat"],7), round(g[-1]["lon"],7))
chain = list(way["geometry"])
used = {way["id"]}
grew = True
while grew:
    grew = False
    head = (round(chain[0]["lat"],7), round(chain[0]["lon"],7))
    tail = (round(chain[-1]["lat"],7), round(chain[-1]["lon"],7))
    for w in same:
        if w["id"] in used:
            continue
        s, e = endpoints(w)
        if s == tail:
            chain.extend(w["geometry"][1:]); used.add(w["id"]); grew = True
        elif e == tail:
            chain.extend(list(reversed(w["geometry"]))[1:]); used.add(w["id"]); grew = True
        elif e == head:
            chain = list(w["geometry"][:-1]) + chain; used.add(w["id"]); grew = True
        elif s == head:
            chain = list(reversed(w["geometry"]))[1:][::-1] + chain if False else list(reversed(w["geometry"]))[:-1] + chain; used.add(w["id"]); grew = True
chain_len_m = sum(haversine_m(chain[i]["lat"], chain[i]["lon"], chain[i+1]["lat"], chain[i+1]["lon"])
                  for i in range(len(chain)-1))
print(f"stitched chain: {len(used)} ways, {len(chain)} nodes, {chain_len_m/M_PER_FT:.0f} ft")

# Along-road frame: cumulative arc length from the snapped anchor, in the
# direction matching the production bearing.
cum = [0.0]
for i in range(len(chain)-1):
    cum.append(cum[-1] + haversine_m(chain[i]["lat"], chain[i]["lon"], chain[i+1]["lat"], chain[i+1]["lon"]))
# anchor station on the chain
best_c = None
for i in range(len(chain)-1):
    d, t = project(PIN_LAT, PIN_LNG, chain[i], chain[i+1])
    if best_c is None or d < best_c[0]:
        seg_len = cum[i+1] - cum[i]
        best_c = (d, cum[i] + t*seg_len, i, t)
anchor_s = best_c[1]
# direction: does increasing chain station align with prod_bearing?
probe_i = min(best_c[2]+1, len(chain)-1)
fwd_b = bearing_deg(chain[best_c[2]]["lat"], chain[best_c[2]]["lon"], chain[probe_i]["lat"], chain[probe_i]["lon"])
diff = abs((fwd_b - prod_bearing + 180) % 360 - 180)
sign = 1.0 if diff <= 90 else -1.0
print(f"chain direction vs bearing: fwd {fwd_b:.1f} vs prod {prod_bearing:.1f} -> sign {sign:+.0f}")

def point_at_arc_m(s_m):
    s = anchor_s + sign * s_m
    if s < 0 or s > cum[-1]:
        return None
    for i in range(len(cum)-1):
        if cum[i] <= s <= cum[i+1]:
            seg = cum[i+1] - cum[i]
            t = 0.0 if seg == 0 else (s - cum[i]) / seg
            return (chain[i]["lat"] + t*(chain[i+1]["lat"]-chain[i]["lat"]),
                    chain[i]["lon"] + t*(chain[i+1]["lon"]-chain[i]["lon"]))
    return None

def dist_to_chain_m(lat, lng):
    return min(project(lat, lng, chain[i], chain[i+1])[0] for i in range(len(chain)-1))

# Production corridor: shoulder closure on urban arterial, 40 mph, 800 ft work.
# Same-script-both-sides switch: relay the stitched chain as the corridor
# centerline exactly when the production signature accepts one (post-fix).
PREFIX = os.environ.get("OUT_PREFIX", "")
# FORCE_CHORD=1 reproduces the pre-fix measurement at any sha (the
# defect's magnitude stays measurable after the fix lands).
CL_SUPPORTED = (
    "centerline" in inspect.signature(build_corridor).parameters
    and os.environ.get("FORCE_CHORD") != "1"
)
centerline_pts = tuple((n["lat"], n["lon"]) for n in chain)
cl_kw = {"centerline": centerline_pts} if CL_SUPPORTED else {}
print(f"centerline relayed to build_corridor: {CL_SUPPORTED} ({len(centerline_pts)} nodes)")
corridor = build_corridor(lat=PIN_LAT, lng=PIN_LNG, bearing_deg=prod_bearing,
                          speed_mph=40, work_zone_ft=800.0,
                          closure_type="shoulder", road_type="urban_high", **cl_kw)
total = corridor.total_length_ft
print(f"corridor zones (ft): downstream {corridor.downstream_taper_ft:.0f}, work {corridor.work_zone_ft:.0f}, "
      f"buffer {corridor.buffer_ft:.0f}, taper {corridor.taper_ft:.0f}, advance {corridor.advance_warning_ft:.0f}, total {total:.0f}")

rows = []
max_dev = (0.0, 0.0)
step = 50.0
s = 0.0
while s <= total:
    if point_at_arc_m(s * M_PER_FT) is None:
        break  # chain ends — stop measuring; beyond here any number is artifact
    chord_lat, chord_lng = corridor.point_at_station_ft(s)
    dev_ft = dist_to_chain_m(chord_lat, chord_lng) / M_PER_FT
    if dev_ft > max_dev[0]:
        max_dev = (dev_ft, s)
    rows.append((s, dev_ft))
    s += step
covered = rows[-1][0] if rows else 0.0
print(f"chain covers corridor stations up to {covered:.0f} ft of {total:.0f} (measured only there)")
print(f"MAX lateral deviation of the DRAWN corridor from the road centerline: {max_dev[0]:.1f} ft at station {max_dev[1]:.0f}")
for s, d in rows:
    if s % 250 == 0:
        print(f"  station {s:5.0f} ft: drawn point is {d:6.1f} ft off the centerline")

# Endpoint error: where the production chord puts the work-zone endpoints vs
# where they actually are along the road.
wz0, wz1 = corridor.downstream_taper_ft, corridor.downstream_taper_ft + corridor.work_zone_ft
for label, st in (("work-zone start", wz0), ("work-zone end", wz1), ("corridor upstream end", total)):
    drawn = corridor.point_at_station_ft(st)
    true_pt = point_at_arc_m(st * M_PER_FT)
    if true_pt:
        err = haversine_m(drawn[0], drawn[1], true_pt[0], true_pt[1]) / M_PER_FT
        print(f"{label} (station {st:.0f}): drawn point is {err:.1f} ft from the true along-road point")

# Render the production PDF page 2 at this pin: the aerial shows the chord.
if os.environ.get("RENDER_PDF") == "1":
    import pypdfium2 as pdfium
    from src.rules.validators import ScenarioParams
    from src.generation.layout import generate_shoulder_closure_undivided
    from src.rendering import plan_sheet as ps
    import dataclasses
    params_cl = (
        {"centerline": centerline_pts}
        if "centerline" in {f.name for f in dataclasses.fields(ScenarioParams)}
        else {}
    )
    params = ScenarioParams(
        closure_type="shoulder", road_type="urban_high", speed_mph=40,
        num_lanes=2, lane_width_ft=12.0, shoulder_width_ft=10.0,
        work_zone_length_ft=800.0, bearing_deg=prod_bearing,
        location_description="Lookout Mountain Road, Golden, CO",
        **params_cl,
    )
    placements = generate_shoulder_closure_undivided(params)
    pdf = f"{PREFIX}140-curved.pdf"
    ps.render_plan_sheet(placements, params, output_path=pdf,
                         site_address="Lookout Mountain Road, Golden, CO",
                         site_lat=PIN_LAT, site_lng=PIN_LNG)
    doc = pdfium.PdfDocument(pdf)
    if len(doc) >= 2:
        img = doc[1].render(scale=3.0).to_pil().convert("RGB")
        img.save(f"{PREFIX}140-page2.png")
        img.convert("L").save(f"{PREFIX}140-page2-gray.png")
        print("rendered page-2 aerial through the production path")
json.dump({"rows": rows, "max_dev_ft": max_dev, "pin": [PIN_LAT, PIN_LNG],
           "bearing": prod_bearing, "way": name, "centerline_relayed": CL_SUPPORTED},
          open(f"{PREFIX}140-deviation.json", "w"))
