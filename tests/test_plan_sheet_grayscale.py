"""Rule-13 grayscale regressions for the plan sheet (Refs #144, #159).

Rendered-output level: each test rasterizes real ReportLab output
(pypdfium2 + Pillow) and measures the grayscale image, rather than
asserting that drawing code called the right function.  fitz/PyMuPDF
is deliberately not used here (AGPL).
"""

from __future__ import annotations

import io

import pypdfium2 as pdfium
from PIL import Image, ImageChops, ImageStat
from reportlab.pdfgen import canvas

from src.rendering.plan_sheet import (
    _DEVICE_GLYPHS,
    _draw_arrow_board,
)
from src.rules.devices import DeviceType

SCALE = 6.0


def _rasterize_grayscale(draw, page_w: float, page_h: float) -> Image.Image:
    """Render ``draw(canvas)`` to a one-page PDF and return it as a
    grayscale PIL image — the photocopy the tests measure."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))
    draw(c)
    c.save()
    page = pdfium.PdfDocument(buf.getvalue())[0]
    return page.render(scale=SCALE).to_pil().convert("L")


def _glyph_patch(device_type: DeviceType) -> Image.Image:
    """One device glyph, drawn through the production mapping, centered
    on a small page."""
    return _rasterize_grayscale(lambda c: _DEVICE_GLYPHS[device_type](c, 50, 50), 100, 100)


class TestPcmsGlyphDistinct:
    def test_pcms_no_longer_shares_the_arrow_board_function(self):
        # The #144 defect in its cheapest form: both device types mapped
        # to the same callable, so legend and schematic could not differ.
        assert _DEVICE_GLYPHS[DeviceType.PCMS] is not _DEVICE_GLYPHS[DeviceType.ARROW_BOARD]
        assert _DEVICE_GLYPHS[DeviceType.PCMS] is not _draw_arrow_board

    def test_glyphs_distinguishable_in_grayscale(self):
        # Measured, not asserted: the two patches must differ materially
        # after grayscale conversion (pre-fix they were byte-identical —
        # diff bbox None, max delta 0).
        arrow = _glyph_patch(DeviceType.ARROW_BOARD)
        pcms = _glyph_patch(DeviceType.PCMS)
        diff = ImageChops.difference(arrow, pcms)
        assert diff.getbbox() is not None
        histogram = diff.histogram()
        total = sum(histogram)
        changed = total - histogram[0]
        # The 20x12pt panel is ~4.5% of the 100x100pt patch; require at
        # least half the panel area to differ so a cosmetic tweak (e.g.
        # a shifted border) cannot satisfy the regression.
        assert changed / total > 0.02

    def test_pcms_is_polarity_inverted(self):
        # The arrow board is a light panel with a dark arrow; the PCMS a
        # dark panel with light rows.  Compare mean luminance over the
        # panel footprint (the 20x12pt rect centered at 50,50).
        def panel_mean(img: Image.Image) -> float:
            box = (
                int((50 - 10) * SCALE),
                int((50 - 6) * SCALE),
                int((50 + 10) * SCALE),
                int((50 + 6) * SCALE),
            )
            return ImageStat.Stat(img.crop(box)).mean[0]

        arrow_mean = panel_mean(_glyph_patch(DeviceType.ARROW_BOARD))
        pcms_mean = panel_mean(_glyph_patch(DeviceType.PCMS))
        assert arrow_mean > 128, "arrow board panel should read light"
        assert pcms_mean < 96, "PCMS panel should read dark"
