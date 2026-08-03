# Arc 9 Step-2 repro, #144: ARROW_BOARD and PCMS resolve to the same glyph.
# Draw both via the production _DEVICE_GLYPHS mapping, rasterize, grayscale,
# pixel-diff.  Pre-fix expectation: byte-identical patches.
import sys, os
sys.path.insert(0, r"C:\Users\rtmak\Documents\traffic-control-tool")
from reportlab.pdfgen import canvas
import pypdfium2 as pdfium
from PIL import Image, ImageChops
from src.rendering.plan_sheet import _DEVICE_GLYPHS
from src.rules.devices import DeviceType

out = os.path.dirname(os.path.abspath(__file__))
pdf = os.path.join(out, "repro144-glyph-pair.pdf")
W, H = 200, 100
c = canvas.Canvas(pdf, pagesize=(W, H))
# Left: arrow board.  Right: PCMS.  Same mapping the plan view and LEGEND use.
_DEVICE_GLYPHS[DeviceType.ARROW_BOARD](c, 50, 50)
_DEVICE_GLYPHS[DeviceType.PCMS](c, 150, 50)
c.save()

page = pdfium.PdfDocument(pdf)[0]
img = page.render(scale=6.0).to_pil().convert("L")
img.save(os.path.join(out, "repro144-pair-grayscale.png"))
left = img.crop((0, 0, W * 3, H * 6))
right = img.crop((W * 3, 0, W * 6, H * 6))
diff = ImageChops.difference(left, right)
bbox = diff.getbbox()
print("glyph functions identical object:",
      _DEVICE_GLYPHS[DeviceType.ARROW_BOARD] is _DEVICE_GLYPHS[DeviceType.PCMS])
print("grayscale pixel diff bbox (None = indistinguishable):", bbox)
print("max pixel delta:", diff.getextrema())
