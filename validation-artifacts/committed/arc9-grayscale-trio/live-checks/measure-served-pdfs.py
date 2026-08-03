# Arc 9 live-check measurement — the SERVED PDFs (downloaded from prod by
# arc9-live-checks.js), rasterized and measured with the same
# pypdfium2+Pillow approach as tests/test_plan_sheet_grayscale.py.
#
# Band identification is color-driven (robust to whatever lane/shoulder
# widths the prod defaults produced): closed-shoulder rows are the rows
# whose modal pixel is the pink #E8D0D0 (232,208,208); the open shoulder
# is the topmost contiguous run of rows whose modal pixel is #D0D0D0
# (208,208,208).  The middle 60% of each band is measured so edge lines
# don't count as hatch strokes.
import os
import sys
from collections import Counter

import pypdfium2 as pdfium
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out9")
SCALE = 3.0
PINK = (232, 208, 208)
GRAY = (208, 208, 208)

failures = 0


def check(name, cond, extra=""):
    global failures
    tag = "PASS" if cond else "FAIL"
    if not cond:
        failures += 1
    print(f"**{tag}** — {name}" + (f" ({extra})" if extra else ""))


def modal_rows(img, want, x0, x1):
    rows = []
    px = img.load()
    for y in range(img.height):
        c = Counter(px[x, y] for x in range(x0, x1, 4))
        if c.most_common(1)[0][0] == want:
            rows.append(y)
    return rows


def contiguous_runs(rows):
    runs, start, prev = [], None, None
    for y in rows:
        if start is None:
            start, prev = y, y
        elif y == prev + 1:
            prev = y
        else:
            runs.append((start, prev))
            start, prev = y, y
    if start is not None:
        runs.append((start, prev))
    return runs


def band_middle(run):
    y0, y1 = run
    h = y1 - y0 + 1
    trim = int(h * 0.2)
    return y0 + trim, y1 - trim


def dark_column_fraction(gray, y0, y1, x0, x1, threshold=128):
    px = gray.load()
    dark = sum(
        1 for x in range(x0, x1) if any(px[x, y] < threshold for y in range(y0, y1 + 1))
    )
    return dark / (x1 - x0)


def modal_gray(gray, y0, y1, x0, x1):
    px = gray.load()
    c = Counter(px[x, y] for y in range(y0, y1 + 1) for x in range(x0, x1, 3))
    return c.most_common(1)[0][0]


def load(name):
    page = pdfium.PdfDocument(os.path.join(OUT, name))[0]
    rgb = page.render(scale=SCALE).to_pil().convert("RGB")
    return rgb, rgb.convert("L")


def road_x_window(img):
    # Plan view spans most of the width; measure the central 80%.
    return int(img.width * 0.10), int(img.width * 0.90)


print("## Served shoulder-divided PDF (#159)")
rgb, gray = load("served-shoulder-divided.pdf")
gray.save(os.path.join(OUT, "03-served-shoulder-grayscale.png"))
x0, x1 = road_x_window(rgb)
pink_runs = contiguous_runs(modal_rows(rgb, PINK, x0, x1))
check("closed-shoulder (pink) band found", len(pink_runs) >= 1, f"runs {pink_runs}")
gray_runs = contiguous_runs(modal_rows(rgb, GRAY, x0, x1))
check("open-shoulder (gray) band found", len(gray_runs) >= 1, f"runs {gray_runs[:4]}")
if pink_runs and gray_runs:
    closed = max(pink_runs, key=lambda r: r[1] - r[0])
    open_ = max(gray_runs, key=lambda r: r[1] - r[0])
    cy0, cy1 = band_middle(closed)
    oy0, oy1 = band_middle(open_)
    cf = dark_column_fraction(gray, cy0, cy1, x0, x1)
    of = dark_column_fraction(gray, oy0, oy1, x0, x1)
    check("hatch present across closed band (>90% of columns)", cf > 0.90, f"{cf:.3f}")
    check("open band clean (<5% of columns)", of < 0.05, f"{of:.3f}")
    check("closed fill unchanged (modal 215 in grayscale)", modal_gray(gray, cy0, cy1, x0, x1) == 215)
    check("open fill unchanged (modal 208 in grayscale)", modal_gray(gray, oy0, oy1, x0, x1) == 208)
    band_h = (cy1 - cy0 + 1)
    pair = Image.new("L", (x1 - x0, band_h + (oy1 - oy0 + 1) + 8), 255)
    pair.paste(gray.crop((x0, oy0, x1, oy1 + 1)), (0, 0))
    pair.paste(gray.crop((x0, cy0, x1, cy1 + 1)), (0, (oy1 - oy0 + 1) + 8))
    pair.save(os.path.join(OUT, "04-served-shoulder-bands-pair.png"))
    print("wrote 04-served-shoulder-bands-pair.png (top = open, bottom = closed)")

print()
print("## Served flagger PDF (regression glance)")
rgb_f, gray_f = load("served-flagger.pdf")
gray_f.save(os.path.join(OUT, "05-served-flagger-grayscale.png"))
fx0, fx1 = road_x_window(rgb_f)
pink_f = contiguous_runs(modal_rows(rgb_f, PINK, fx0, fx1))
check("flagger closed-lane pink band present (fill untouched)", len(pink_f) >= 1, f"runs {pink_f[:3]}")
if pink_f:
    lane = max(pink_f, key=lambda r: r[1] - r[0])
    ly0, ly1 = band_middle(lane)
    lf = dark_column_fraction(gray_f, ly0, ly1, fx0, fx1)
    # Devices/labels sit in the closed lane, so the band is not clean —
    # the bar is "no full-width hatch" (hatch measures >0.9).
    check("no hatch where none belongs (closed-lane band <50% dark columns)", lf < 0.50, f"{lf:.3f}")

print()
print(f"DONE — failures: {failures}")
sys.exit(0 if failures == 0 else 1)
