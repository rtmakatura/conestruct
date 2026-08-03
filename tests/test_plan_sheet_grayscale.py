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
    MEDIAN_PTS,
    PAGE_H,
    PAGE_W,
    PLAN_LEFT,
    PLAN_RIGHT,
    PLAN_Y_CENTER,
    PTS_PER_OFFSET_FT,
    _draw_arrow_board,
    _draw_road,
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


LANE_W_FT = 12.0
SHOULDER_W_FT = 10.0
NUM_LANES = 2


def _shoulder_bands() -> tuple[Image.Image, Image.Image, Image.Image]:
    """Rasterize the divided shoulder-closure roadway (``_draw_road``
    directly — no devices, so the bands are measured clean) and return
    (full grayscale page, closed-shoulder band, open-shoulder band)."""
    img = _rasterize_grayscale(
        lambda c: _draw_road(
            c,
            lane_width_ft=LANE_W_FT,
            shoulder_width_ft=SHOULDER_W_FT,
            closure_type="shoulder",
            is_divided=True,
            num_lanes=NUM_LANES,
        ),
        PAGE_W,
        PAGE_H,
    )
    lane_h = LANE_W_FT * PTS_PER_OFFSET_FT
    shoulder_h = SHOULDER_W_FT * PTS_PER_OFFSET_FT
    y_closed_lane_outer = PLAN_Y_CENTER - MEDIAN_PTS / 2.0 - NUM_LANES * lane_h
    y_open_lane_outer = PLAN_Y_CENTER + MEDIAN_PTS / 2.0 + NUM_LANES * lane_h

    def band(y_top_pdf: float, y_bottom_pdf: float) -> Image.Image:
        # Trim 2pt from each edge so the shoulder edge lines don't
        # count as hatch strokes.
        return img.crop(
            (
                int(PLAN_LEFT * SCALE),
                int((PAGE_H - (y_top_pdf - 2.0)) * SCALE),
                int(PLAN_RIGHT * SCALE),
                int((PAGE_H - (y_bottom_pdf + 2.0)) * SCALE),
            )
        )

    closed = band(y_closed_lane_outer, y_closed_lane_outer - shoulder_h)
    open_ = band(y_open_lane_outer + shoulder_h, y_open_lane_outer)
    return img, closed, open_


def _dark_column_fraction(band: Image.Image, threshold: int = 128) -> float:
    """Fraction of pixel columns containing at least one sub-threshold
    (dark) pixel.  A 45-degree hatch at 6pt spacing crosses nearly every
    column; a flat fill crosses none."""
    w, h = band.size
    dark_cols = 0
    px = band.load()
    for x in range(w):
        if any(px[x, y] < threshold for y in range(h)):
            dark_cols += 1
    return dark_cols / w


class TestClosedShoulderHatch:
    def test_hatch_present_on_closed_shoulder_only(self):
        # Pre-fix both bands were flat fills (grayscale contrast 1.072,
        # measured) — indistinguishable on a photocopy.  The hatch is
        # the hue-free channel; the open shoulder must stay clean.
        _, closed, open_ = _shoulder_bands()
        assert _dark_column_fraction(closed) > 0.9
        assert _dark_column_fraction(open_) < 0.05

    def test_fills_unchanged(self):
        # The issue's acceptance: hatch is additive, the pink stays and
        # no other fill changes.  Modal pixel dodges the hatch strokes.
        _, closed, open_ = _shoulder_bands()

        def modal(band: Image.Image) -> int:
            hist = band.histogram()
            return max(range(256), key=lambda v: hist[v])

        # #E8D0D0 and #D0D0D0 land at ~215 and 208 in 8-bit grayscale.
        assert modal(closed) == 215
        assert modal(open_) == 208
