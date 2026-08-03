# Arc 10 evidence, #157 + #141.  SAME SCRIPT, BOTH SIDES (run with
# OUT_PREFIX=pre-fix- at the old sha, OUT_PREFIX=post-fix- at the new).
# #157: render through the production path with the issue's exact mismatch —
#   typed address "23rd ave, greeley, co", pin at Denver Civic Center
#   (39.7389, -104.9862).  Extract page-1/page-2 text: pre-fix the title
#   block prints the stale address with no coordinates anywhere on page 1;
#   post-fix both print and the caption order flips.
# #141: rasterize page 2 (whatever style production uses at that sha) and
#   fetch the identical viewport in both styles for the label pair.
import sys, os, re
sys.path.insert(0, r"C:\Users\rtmak\Documents\traffic-control-tool")

# Load MAPBOX_TOKEN from the repo .env (never printed).
with open(r"C:\Users\rtmak\Documents\traffic-control-tool\.env") as f:
    for line in f:
        m = re.match(r"^\s*([A-Z_]+)\s*=\s*(.+?)\s*$", line)
        if m:
            os.environ.setdefault(m.group(1), m.group(2).strip('"'))
print("MAPBOX_TOKEN set:", bool(os.environ.get("MAPBOX_TOKEN")))

import pypdfium2 as pdfium

from src.generation.layout import generate_flagger_alternating_2lane
from src.rules.validators import ScenarioParams
from src.rendering import plan_sheet as ps

out = os.path.dirname(os.path.abspath(__file__))
PREFIX = os.environ.get("OUT_PREFIX", "")
pdf = os.path.join(out, f"{PREFIX}157-mismatch.pdf")

DENVER_LAT, DENVER_LNG = 39.7389, -104.9862  # the issue's exact repro pin

params = ScenarioParams(
    closure_type="flagger",
    road_type="urban_low",
    speed_mph=30,
    num_lanes=2,
    lane_width_ft=12.0,
    work_zone_length_ft=300.0,
    location_description="23rd ave, greeley, co",
    bearing_deg=0.0,
)
placements = generate_flagger_alternating_2lane(params)
ps.render_plan_sheet(
    placements,
    params,
    output_path=pdf,
    site_address="23rd ave, greeley, co",
    site_lat=DENVER_LAT,
    site_lng=DENVER_LNG,
)

doc = pdfium.PdfDocument(pdf)
print("pages:", len(doc))
for i in range(len(doc)):
    text = doc[i].get_textpage().get_text_range()
    print(f"--- page {i+1} text (location-relevant lines) ---")
    for line in text.splitlines():
        if re.search(r"LOCATION|SITE|greeley|39\.7|104\.9|-104", line, re.I):
            print(repr(line))
    coords_present = bool(re.search(r"39\.7\d+.*-104\.9\d+", text))
    print(f"page {i+1}: any coordinate string present: {coords_present}")

# Rasterize page 2 for #141 (no labels on satellite-v9).
if len(doc) >= 2:
    rgb = doc[1].render(scale=3.0).to_pil().convert("RGB")
    rgb.save(os.path.join(out, f"{PREFIX}141-page2.png"))
    rgb.convert("L").save(os.path.join(out, f"{PREFIX}141-page2-gray.png"))
    print("page 2 rasterized")

# #141 comparison: identical viewport, satellite-streets-v12.
import httpx
url_v9 = ps._last_aerial_url if hasattr(ps, "_last_aerial_url") else None
# Rebuild the URL the way _fetch_mapbox_aerial does for the pin-only case is
# corridor-gated; here bearing_deg was set, so reproduce the corridor URL:
from src.rules.corridor import build_corridor, encode_polyline
from urllib.parse import quote as urllib_quote
corridor = build_corridor(
    lat=DENVER_LAT, lng=DENVER_LNG, bearing_deg=0.0, speed_mph=30,
    work_zone_ft=300.0, closure_type="flagger", road_type="urban_low",
)
d_ll, u_ll = corridor.work_zone_endpoints()
poly = urllib_quote(encode_polyline([d_ll, u_ll]), safe="")
mid_lat, mid_lng = corridor.point_at_station_ft(
    corridor.downstream_taper_ft + corridor.work_zone_ft / 2.0)
zoom = ps._aerial_zoom_for_work_zone(corridor)
for style, name in (("satellite-v9", "v9"), ("satellite-streets-v12", "streets-v12")):
    url = (f"https://api.mapbox.com/styles/v1/mapbox/{style}/static/"
           f"path-3+e8710a-0.7({poly})/{mid_lng},{mid_lat},{zoom},0/1200x500@2x")
    r = httpx.get(url, params={"access_token": os.environ["MAPBOX_TOKEN"]}, timeout=20.0)
    r.raise_for_status()
    p = os.path.join(out, f"repro141-aerial-{name}.png")
    with open(p, "wb") as f:
        f.write(r.content)
    print("fetched", name, len(r.content), "bytes")
from PIL import Image
a = Image.open(os.path.join(out, "repro141-aerial-v9.png")).convert("L")
b = Image.open(os.path.join(out, "repro141-aerial-streets-v12.png")).convert("L")
pair = Image.new("L", (a.width, a.height * 2 + 10), 255)
pair.paste(a, (0, 0)); pair.paste(b, (0, a.height + 10))
pair.save(os.path.join(out, f"{PREFIX}141-style-pair-grayscale.png"))
print("wrote style pair (top = satellite-v9 current, bottom = satellite-streets-v12)")
