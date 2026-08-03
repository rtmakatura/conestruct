# Arc 9 Step-2 repro, #159: closed-shoulder pink (#E8D0D0) vs open-shoulder
# gray (#D0D0D0) on the divided shoulder-closure sheet.  Render the real sheet,
# rasterize, grayscale, and measure the WCAG contrast ratio between the two
# shoulder bands (sampled as the modal pixel of each band, dodging devices).
import sys, os
sys.path.insert(0, r"C:\Users\rtmak\Documents\traffic-control-tool")
import pypdfium2 as pdfium
from PIL import Image
from collections import Counter

from src.generation.layout import generate_shoulder_closure_divided
from src.rules.validators import ScenarioParams
from src.rendering import plan_sheet as ps

out = os.path.dirname(os.path.abspath(__file__))
pdf = os.path.join(out, "repro159-shoulder-divided.pdf")

params = ScenarioParams(
    closure_type="shoulder",
    road_type="expressway",
    speed_mph=55,
    num_lanes=2,
    lane_width_ft=12.0,
    shoulder_width_ft=10.0,
    work_zone_length_ft=500.0,
    is_divided=True,
)
placements = generate_shoulder_closure_divided(params)
ps.render_plan_sheet(placements, params, output_path=pdf)

SCALE = 4.0
page = pdfium.PdfDocument(pdf)[0]
rgb = page.render(scale=SCALE).to_pil().convert("RGB")
gray = rgb.convert("L")
gray.save(os.path.join(out, "repro159-sheet-grayscale.png"))
rgb.save(os.path.join(out, "repro159-sheet-color.png"))

# Band geometry, mirroring _draw_road's math (y-up PDF coords).
lane_h = params.lane_width_ft * ps.PTS_PER_OFFSET_FT
shoulder_h = params.shoulder_width_ft * ps.PTS_PER_OFFSET_FT
half_median = ps.MEDIAN_PTS / 2.0
y_closed_lane_outer = ps.PLAN_Y_CENTER - half_median - params.num_lanes * lane_h
y_closed_shldr_mid = y_closed_lane_outer - shoulder_h / 2.0
y_open_lane_outer = ps.PLAN_Y_CENTER + half_median + params.num_lanes * lane_h
y_open_shldr_mid = y_open_lane_outer + shoulder_h / 2.0

def modal_pixel(img, y_pdf):
    row = int((ps.PAGE_H - y_pdf) * SCALE)
    xs = range(int(ps.PLAN_LEFT * SCALE), int(ps.PLAN_RIGHT * SCALE))
    return Counter(img.getpixel((x, row)) for x in xs).most_common(1)[0][0]

def rel_lum(px):
    def chan(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = px if isinstance(px, tuple) else (px, px, px)
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)

def contrast(a, b):
    la, lb = sorted((rel_lum(a), rel_lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

closed_rgb = modal_pixel(rgb, y_closed_shldr_mid)
open_rgb = modal_pixel(rgb, y_open_shldr_mid)
closed_g = modal_pixel(gray, y_closed_shldr_mid)
open_g = modal_pixel(gray, y_open_shldr_mid)
print("closed shoulder modal RGB:", closed_rgb, "open:", open_rgb)
print("color contrast ratio: %.3f" % contrast(closed_rgb, open_rgb))
print("grayscale modal: closed %s open %s -> contrast %.3f"
      % (closed_g, open_g, contrast((closed_g,) * 3, (open_g,) * 3)))

# Crop the two shoulder bands side by side for the evidence pair.
def band(img, y_mid):
    r = int((ps.PAGE_H - y_mid) * SCALE)
    h = int(shoulder_h * SCALE / 2)
    return img.crop((int(ps.PLAN_LEFT * SCALE), r - h, int(ps.PLAN_RIGHT * SCALE), r + h))

pair = Image.new("L", (band(gray, y_closed_shldr_mid).width,
                       band(gray, y_closed_shldr_mid).height * 2 + 8), 255)
pair.paste(band(gray, y_open_shldr_mid), (0, 0))
pair.paste(band(gray, y_closed_shldr_mid), (0, band(gray, y_open_shldr_mid).height + 8))
pair.save(os.path.join(out, "repro159-bands-grayscale-pair.png"))
print("wrote band pair (top = open, bottom = closed)")
