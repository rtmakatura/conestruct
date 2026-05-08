"""Plan-sheet renderer — compose a single MUTCD/CDOT MOT plan sheet.

Pure-reportlab implementation: road geometry, device symbols, dimension
callouts, title block, legend, and notes are drawn directly on a
landscape 11×17 (tabloid) canvas using geometric primitives.  No SVG or
sprite assets in V1; sign and channelizer glyphs are simple shapes.

Convention: LEFT side of the plan view is upstream (high station, where
drivers first encounter the work zone); RIGHT side is downstream.  The
work side (positive ``offset_ft``, where the right-shoulder closure
lives) is drawn at the BOTTOM of the page so the direction-of-travel
arrow sits next to the closed carriageway — this matches CDOT S-630-1
where the work side is always the near side of the plan view.  The
plan view is fitted to show the merging taper, buffer, work zone, and
downstream taper.  Advance warning signs sit further upstream, off the
left edge of the plan view, and are documented in the notes panel.

Authoritative sources:
  - CDOT M&S Standard Plan S-630-1 (typical sheet layout)
  - MUTCD 11th Edition Part 6
"""

from __future__ import annotations

import os
import tempfile
from collections.abc import Callable
from datetime import date
from pathlib import Path

import httpx
from reportlab.lib import colors
from reportlab.pdfgen import canvas

from src._dotenv import load_dotenv
from src.rules.devices import DeviceType
from src.rules.sign_codes import description_for
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    shoulder_taper_length,
    taper_length,
)
from src.rules.validators import DevicePlacement, ScenarioParams

load_dotenv()


def _required_taper_length(params: ScenarioParams, shoulder_width_ft: float) -> float:
    """Plan-side taper length used for fitting the scale and dimension callouts.

    Lane closures use the full merging taper L (MUTCD §6C.08); shoulder
    closures use L/3 (§6C.08(B)).  Mirrors the branching in
    ``src.generation.layout`` so the rendered plan view fits whichever
    layout the engine produced.
    """
    if params.closure_type == "lane":
        return taper_length(params.speed_mph, params.lane_width_ft)
    return shoulder_taper_length(params.speed_mph, shoulder_width_ft)


def _road_y_extent(params: ScenarioParams, shoulder_width_ft: float) -> tuple[float, float]:
    """Return (y_road_top, y_road_bottom) on the page for the rendered road.

    Divided highways are drawn with two lanes per direction separated by
    a visible median band of ``MEDIAN_PTS`` height; undivided highways
    are drawn with a single lane each direction and a yellow centerline.
    """
    lane_h = params.lane_width_ft * PTS_PER_OFFSET_FT
    shoulder_h = shoulder_width_ft * PTS_PER_OFFSET_FT
    half_lanes = 2 if params.is_divided else 1
    half_road = half_lanes * lane_h + shoulder_h
    if params.is_divided:
        half_road += MEDIAN_PTS / 2.0
    return PLAN_Y_CENTER + half_road, PLAN_Y_CENTER - half_road


# 11" x 17" tabloid landscape (long side horizontal)
PAGE_W: float = 17 * 72.0  # 1224 pt
PAGE_H: float = 11 * 72.0  # 792 pt

MARGIN: float = 18.0
TITLE_H: float = 72.0
FOOTER_H: float = 250.0

PLAN_LEFT: float = MARGIN
PLAN_RIGHT: float = PAGE_W - MARGIN
PLAN_TOP: float = PAGE_H - TITLE_H - 8.0
PLAN_BOTTOM: float = FOOTER_H + 8.0
PLAN_Y_CENTER: float = (PLAN_TOP + PLAN_BOTTOM) / 2.0

# Y exaggeration: 3.5 pt per offset-ft (a 12-ft lane = 42 pt tall on page).
# X scale is fitted per-layout to span the full plan view width.
PTS_PER_OFFSET_FT: float = 3.5

# Visual median band height for divided highways.  The two carriageways
# are pushed apart by this amount so the schematic conveys "two separate
# travel directions" rather than one wide road.  Sized to comfortably
# host a median-side sign glyph + numbered callout (~18 pt total).
MEDIAN_PTS: float = 18.0

# Road palette
LANE_FILL = colors.HexColor("#B0B0B0")
SHOULDER_OPEN_FILL = colors.HexColor("#D0D0D0")
SHOULDER_CLOSED_FILL = colors.HexColor("#E8D0D0")
EDGE_LINE = colors.white
LANE_STRIPE = colors.white
MEDIAN_EDGE = colors.HexColor("#FFD700")
MEDIAN_FILL = colors.HexColor("#C8D6C0")  # muted sage — reads as grass median
ROAD_BORDER = colors.black

# Symbol palette
CONE_ORANGE = colors.Color(1.00, 0.50, 0.00)
DRUM_ORANGE = colors.Color(0.95, 0.45, 0.00)
DRUM_STRIPE = colors.white
SIGN_FILL = colors.Color(0.00, 0.45, 0.20)
SIGN_BORDER = colors.white
ARROW_FILL = colors.Color(1.00, 0.85, 0.00)
ARROW_GLYPH = colors.black
FLAG_RED = colors.red

DIM_LINE = colors.Color(0.20, 0.25, 0.55)
TITLE_BORDER = colors.black
LEADER_GRAY = colors.HexColor("#3A3A3A")

LABEL_FONT = "Helvetica"
LABEL_SIZE = 7
LABEL_HALO_PAD_X = 1.5
LABEL_HALO_TOP = 6.5  # ascent above baseline (≈ size * 0.92 for Helvetica)
LABEL_HALO_BOTTOM = 1.5  # descent below baseline
CALLOUT_TIER_H = 10.0  # vertical step between tiers in the callout strip
CALLOUT_BAND_OFFSET = 16.0  # gap between road edge and the first tier baseline

_TABLE_CATEGORIES: frozenset[str] = frozenset(
    {"urban_low", "urban_high", "rural", "expressway", "freeway"}
)


# ---------------------------------------------------------------------------
# Coordinate transforms
# ---------------------------------------------------------------------------


BUFFER_VISUAL_FT: float = 80.0  # compressed length the empty buffer is shown at


def _make_x_mapping(
    placements: list[DevicePlacement],
    params: ScenarioParams,
    shoulder_width_ft: float,
) -> dict:
    """Build a piecewise station → page-x mapping for the plan view.

    The buffer region carries no devices (MUTCD §6C.08) so it dominates
    page width without earning any.  We compress it to a fixed visual
    length (``BUFFER_VISUAL_FT``) marked with a // scale break, freeing
    width for the work zone and taper where every device lives.

    Returns a dict with:
      - ``x_of(station_ft)`` callable, raw stations in, page x out
      - ``pts_per_ft`` for the scale label in the title block (work-zone
        scale, since that is the region a reader will measure off)
      - ``station_max_visible`` for clipping advance-warning signs
      - ``buffer_break_x`` page x where the scale-break marks belong
    """
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft
    taper_len = _required_taper_length(params, shoulder_width_ft)
    buf_len = buffer_space(speed)

    def effective(s: float) -> float:
        if s <= wz_len:
            return s
        if s <= wz_len + buf_len:
            t = (s - wz_len) / buf_len
            return wz_len + t * BUFFER_VISUAL_FT
        return s - buf_len + BUFFER_VISUAL_FT

    eff_min = min(effective(p.station_ft) for p in placements) - 50.0
    eff_taper_start = effective(wz_len + buf_len + taper_len)
    eff_max = eff_taper_start + 100.0

    pts_per_ft = (PLAN_RIGHT - PLAN_LEFT) / (eff_max - eff_min)

    def x_of(s: float) -> float:
        return PLAN_LEFT + (eff_max - effective(s)) * pts_per_ft

    buffer_mid_station = wz_len + buf_len / 2.0
    buffer_break_x = x_of(buffer_mid_station)

    # Stations above this raw-station threshold (the advance warning signs)
    # land outside the plan view and get filtered out before drawing.
    station_max_visible = wz_len + buf_len + taper_len + 50.0

    return {
        "x_of": x_of,
        "pts_per_ft": pts_per_ft,
        "station_max_visible": station_max_visible,
        "buffer_break_x": buffer_break_x,
    }


def _y_of(offset_ft: float, is_divided: bool = False) -> float:
    """Map road offset to page y.  Positive offset (work side) → BOTTOM of
    page; negative offset (opposing side) → TOP of page (CDOT S-630-1).

    On divided highways, the two carriageways are visually separated by
    a median band of ``MEDIAN_PTS``.  The mapping shifts each side
    outward by ``MEDIAN_PTS / 2`` so the geometry data convention
    (offset=0 at the road centerline) lines up with the visible median
    centerline on the page.  ``offset_ft = 0`` always renders at
    ``PLAN_Y_CENTER`` regardless of divided-ness so the call is safe for
    median-axis features (centerline labels, dimension band tics).
    """
    if is_divided and offset_ft != 0.0:
        sign = 1.0 if offset_ft > 0 else -1.0
        return PLAN_Y_CENTER - offset_ft * PTS_PER_OFFSET_FT - sign * MEDIAN_PTS / 2.0
    return PLAN_Y_CENTER - offset_ft * PTS_PER_OFFSET_FT


# ---------------------------------------------------------------------------
# Road geometry
# ---------------------------------------------------------------------------


def _draw_road(
    c: canvas.Canvas,
    lane_width_ft: float,
    shoulder_width_ft: float,
    closure_type: str = "shoulder",
    is_divided: bool = True,
) -> None:
    x_left = PLAN_LEFT
    x_right = PLAN_RIGHT
    width = x_right - x_left

    lane_h = lane_width_ft * PTS_PER_OFFSET_FT
    shoulder_h = shoulder_width_ft * PTS_PER_OFFSET_FT

    # After the Y-flip, positive offset_ft → lower page y.  The closed
    # (work-side) carriageway is therefore at the BOTTOM of the page; the
    # opposing carriageway is at the TOP.  On divided highways the two
    # carriageways are pushed apart by MEDIAN_PTS so a visible median
    # band sits between them.
    y_center = PLAN_Y_CENTER
    half_median = MEDIAN_PTS / 2.0 if is_divided else 0.0
    half_lanes = 2 if is_divided else 1
    y_closed_lane_inner = y_center - half_median - half_lanes * lane_h  # top of closed lanes? no
    # Note: y_closed_lane_inner is the OUTER (page-bottom) edge of the closed-side lane stack.
    # We compute from the inner (median-facing) edge down through the lanes.
    y_closed_lane_inner_edge = y_center - half_median  # median-facing edge of closed lanes
    y_closed_lane_outer = y_closed_lane_inner_edge - half_lanes * lane_h  # outer (page-bottom) edge
    y_closed_shldr_outer = y_closed_lane_outer - shoulder_h  # bottom of page
    y_open_lane_inner_edge = y_center + half_median  # median-facing edge of open lanes
    y_open_lane_outer = y_open_lane_inner_edge + half_lanes * lane_h  # outer (page-top) edge
    y_open_shldr_outer = y_open_lane_outer + shoulder_h  # top of page

    # Backwards-compatible aliases used below.
    y_closed_lane_inner = y_closed_lane_outer  # boundary closed-lanes / closed-shoulder
    y_open_lane_inner = y_open_lane_outer  # boundary open-lanes / open-shoulder

    is_lane_closure = closure_type == "lane"

    if not is_divided:
        # 2-lane undivided road: single lane each direction with a yellow
        # centerline.  No median gap; the closed right lane is painted
        # pink to flag it as the work-side lane.
        c.setFillColor(SHOULDER_OPEN_FILL)
        c.rect(x_left, y_closed_shldr_outer, width, shoulder_h, fill=1, stroke=0)
        c.rect(x_left, y_open_lane_inner, width, shoulder_h, fill=1, stroke=0)

        c.setFillColor(SHOULDER_CLOSED_FILL if is_lane_closure else LANE_FILL)
        c.rect(x_left, y_closed_lane_inner, width, lane_h, fill=1, stroke=0)
        c.setFillColor(LANE_FILL)
        c.rect(x_left, y_center, width, lane_h, fill=1, stroke=0)

        # Yellow dashed centerline (no-passing in a real work zone, but
        # dashed reads cleaner on the schematic).
        c.setStrokeColor(MEDIAN_EDGE)
        c.setLineWidth(2.0)
        c.setDash(12, 8)
        c.line(x_left, y_center, x_right, y_center)
        c.setDash()

        # Outer edge lines (white solid)
        c.setStrokeColor(EDGE_LINE)
        c.setLineWidth(2.0)
        c.line(x_left, y_closed_lane_inner, x_right, y_closed_lane_inner)
        c.line(x_left, y_open_lane_inner, x_right, y_open_lane_inner)

        # Shoulder outer edges (white thin)
        c.setLineWidth(1.0)
        c.line(x_left, y_closed_shldr_outer, x_right, y_closed_shldr_outer)
        c.line(x_left, y_open_shldr_outer, x_right, y_open_shldr_outer)

        # Black corridor outline
        c.setStrokeColor(ROAD_BORDER)
        c.setLineWidth(0.5)
        c.rect(
            x_left,
            y_closed_shldr_outer,
            width,
            y_open_shldr_outer - y_closed_shldr_outer,
            fill=0,
            stroke=1,
        )
        return

    # ----- Divided highway: two distinct carriageways with a median band -----
    #
    # Page layout, top → bottom:
    #   [opposing shoulder] [opposing lanes] [MEDIAN] [closed lanes] [closed shoulder]
    #
    # The work-side (closed) carriageway is at the page bottom and carries
    # the closure (right shoulder painted pink for a shoulder closure, or
    # right lane painted pink for a lane closure).  The opposing carriageway
    # at the page top is a clean roadway with no closure indication.

    # Work-side (closed) shoulder — pink for a shoulder closure, neutral for lane closure.
    c.setFillColor(SHOULDER_CLOSED_FILL if not is_lane_closure else SHOULDER_OPEN_FILL)
    c.rect(x_left, y_closed_shldr_outer, width, shoulder_h, fill=1, stroke=0)
    # Opposing shoulder — always neutral gray (no closure on this side).
    c.setFillColor(SHOULDER_OPEN_FILL)
    c.rect(x_left, y_open_lane_outer, width, shoulder_h, fill=1, stroke=0)

    # Closed-side travel lanes.  For a lane closure, paint the right
    # (page-bottom-most) travel lane pink to flag it; the inner lane
    # stays neutral gray.
    closed_lanes_h = half_lanes * lane_h
    if is_lane_closure:
        # Outer (closed) lane abutting the work-side shoulder.
        c.setFillColor(SHOULDER_CLOSED_FILL)
        c.rect(x_left, y_closed_lane_outer, width, lane_h, fill=1, stroke=0)
        # Inner (open) lane on the closed-side carriageway, butting against
        # the median.
        c.setFillColor(LANE_FILL)
        c.rect(
            x_left,
            y_closed_lane_outer + lane_h,
            width,
            lane_h,
            fill=1,
            stroke=0,
        )
    else:
        c.setFillColor(LANE_FILL)
        c.rect(x_left, y_closed_lane_outer, width, closed_lanes_h, fill=1, stroke=0)

    # Opposing-side travel lanes — clean (no closure).
    c.setFillColor(LANE_FILL)
    c.rect(x_left, y_open_lane_inner_edge, width, closed_lanes_h, fill=1, stroke=0)

    # ----- Median band -----
    # Filled with a neutral grass/concrete color and overlaid with a 45°
    # diagonal hatch so it visually reads as the median.  Yellow edge
    # lines on either side mark the inner shoulder of each carriageway.
    c.setFillColor(MEDIAN_FILL)
    c.rect(x_left, y_closed_lane_inner_edge, width, MEDIAN_PTS, fill=1, stroke=0)
    _draw_diagonal_hatch(
        c,
        x_left,
        x_right,
        y_closed_lane_inner_edge,
        y_open_lane_inner_edge,
        spacing=8.0,
    )
    c.setStrokeColor(MEDIAN_EDGE)
    c.setLineWidth(2.0)
    c.line(x_left, y_open_lane_inner_edge, x_right, y_open_lane_inner_edge)
    c.line(x_left, y_closed_lane_inner_edge, x_right, y_closed_lane_inner_edge)

    # Outer travel-lane edges (white solid, 2 pt)
    c.setStrokeColor(EDGE_LINE)
    c.setLineWidth(2.0)
    c.line(x_left, y_closed_lane_outer, x_right, y_closed_lane_outer)
    c.line(x_left, y_open_lane_outer, x_right, y_open_lane_outer)

    # Lane stripes between same-direction lanes (white dashed, 2 pt) at ±lane_width_ft
    c.setLineWidth(2.0)
    c.setDash(12, 8)
    c.line(x_left, _y_of(lane_width_ft, True), x_right, _y_of(lane_width_ft, True))
    c.line(x_left, _y_of(-lane_width_ft, True), x_right, _y_of(-lane_width_ft, True))
    c.setDash()

    # Shoulder outer edges (white solid, 1 pt)
    c.setLineWidth(1.0)
    c.line(x_left, y_closed_shldr_outer, x_right, y_closed_shldr_outer)
    c.line(x_left, y_open_shldr_outer, x_right, y_open_shldr_outer)

    # Black corridor outline (0.5 pt) so the road pops from the page
    c.setStrokeColor(ROAD_BORDER)
    c.setLineWidth(0.5)
    c.rect(
        x_left,
        y_closed_shldr_outer,
        width,
        y_open_shldr_outer - y_closed_shldr_outer,
        fill=0,
        stroke=1,
    )

    # MEDIAN label — centered both vertically (in the band) and
    # horizontally (across the page), at 7 pt in a muted gray so it
    # labels the band without competing with the device glyphs.  No
    # halo: the label sits on top of the diagonal hatch and inherits
    # the band's neutral color, which reads as part of the geometry
    # rather than as a floating callout.
    label_text = "MEDIAN"
    label_font = "Helvetica"
    label_size = 7.0
    label_x = (x_left + x_right) / 2.0
    # Helvetica's visual center sits ~size/3 above the baseline; setting
    # the baseline at y_center - size/3 puts the optical centerline of
    # the text exactly on y_center (the middle of the median band).
    label_y = y_center - label_size / 3.0
    c.setFont(label_font, label_size)
    c.setFillColor(colors.HexColor("#7A7A7A"))
    c.drawCentredString(label_x, label_y, label_text)


# ---------------------------------------------------------------------------
# Device glyphs (V1: simple geometric primitives, no sprite PNGs)
# ---------------------------------------------------------------------------


def _draw_cone(c: canvas.Canvas, x: float, y: float) -> None:
    h, w = 10.0, 8.0
    c.setFillColor(CONE_ORANGE)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    p = c.beginPath()
    p.moveTo(x - w / 2, y - h / 2)
    p.lineTo(x + w / 2, y - h / 2)
    p.lineTo(x, y + h / 2)
    p.close()
    c.drawPath(p, stroke=1, fill=1)


def _draw_drum(c: canvas.Canvas, x: float, y: float) -> None:
    h, w = 14.0, 10.0
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    c.setFillColor(DRUM_ORANGE)
    c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
    c.setFillColor(DRUM_STRIPE)
    c.rect(x - w / 2, y + 1.5, w, 2.0, fill=1, stroke=0)
    c.rect(x - w / 2, y - 3.5, w, 2.0, fill=1, stroke=0)


SIGN_FILL_WARN = colors.HexColor("#F58220")  # MUTCD work-zone orange
SIGN_FILL_GUIDE = colors.HexColor("#F58220")  # G20-x in temp work zones is orange
SIGN_REG_BORDER = colors.HexColor("#C8102E")  # regulatory red border
SIGN_FILL_SCHOOL = colors.HexColor("#FFE600")  # school yellow


def _sign_category(label: str) -> str:
    """Map a MUTCD code to a category that drives its glyph shape and fill.

    Work-zone signs follow MUTCD Part 6 conventions: W codes are warning
    (orange diamond), G codes are guide (orange rectangle in temporary
    applications), R codes are regulatory (white rectangle, red border),
    S codes are school (yellow pentagon), M codes are route guidance
    (white rectangle, black legend).
    """
    if not label:
        return "warning"
    if label.startswith("W"):
        return "warning"
    if label.startswith("G"):
        return "guide"
    if label.startswith("R"):
        return "regulatory"
    if label.startswith("S"):
        return "school"
    if label.startswith("M"):
        return "route"
    return "warning"


def _draw_sign(c: canvas.Canvas, x: float, y: float, label: str = "") -> None:
    """MUTCD-shaped sign glyph: orange diamond for W codes, orange
    rectangle for G codes, white-with-red-border for R codes, yellow
    pentagon for S codes, white rectangle for M codes."""
    cat = _sign_category(label)
    if cat == "warning":
        s = 7.0
        c.setFillColor(SIGN_FILL_WARN)
        c.setStrokeColor(colors.black)
        c.setLineWidth(0.7)
        p = c.beginPath()
        p.moveTo(x, y + s)
        p.lineTo(x + s, y)
        p.lineTo(x, y - s)
        p.lineTo(x - s, y)
        p.close()
        c.drawPath(p, stroke=1, fill=1)
        return
    if cat == "guide":
        w, h = 13.0, 9.0
        c.setFillColor(SIGN_FILL_GUIDE)
        c.setStrokeColor(colors.black)
        c.setLineWidth(0.6)
        c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
        return
    if cat == "regulatory":
        w, h = 11.0, 12.0
        c.setFillColor(colors.white)
        c.setStrokeColor(SIGN_REG_BORDER)
        c.setLineWidth(1.4)
        c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
        return
    if cat == "school":
        import math

        s = 7.5
        c.setFillColor(SIGN_FILL_SCHOOL)
        c.setStrokeColor(colors.black)
        c.setLineWidth(0.6)
        p = c.beginPath()
        for i in range(5):
            a = math.pi / 2 + i * 2 * math.pi / 5
            px = x + s * math.cos(a)
            py = y + s * math.sin(a)
            if i == 0:
                p.moveTo(px, py)
            else:
                p.lineTo(px, py)
        p.close()
        c.drawPath(p, stroke=1, fill=1)
        return
    # route / default — white rectangle, black border
    w, h = 11.0, 11.0
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.7)
    c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)


def _draw_barricade_iii(c: canvas.Canvas, x: float, y: float) -> None:
    """Three-rail Type III barricade: a wide rectangle with two horizontal
    orange-and-white stripes.  Visually distinct from a drum so the eye
    can pick out sidewalk closures from channelizers in dense areas."""
    w, h = 16.0, 8.0
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
    # Three orange rails interleaved with two white gaps
    c.setFillColor(DRUM_ORANGE)
    rail_h = h / 5.0
    for i in (0, 2, 4):
        c.rect(x - w / 2, y - h / 2 + i * rail_h, w, rail_h, fill=1, stroke=0)


def _draw_barricade_ii(c: canvas.Canvas, x: float, y: float) -> None:
    """Two-rail Type II barricade — narrower than Type III."""
    w, h = 12.0, 6.0
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
    c.setFillColor(DRUM_ORANGE)
    rail_h = h / 3.0
    for i in (0, 2):
        c.rect(x - w / 2, y - h / 2 + i * rail_h, w, rail_h, fill=1, stroke=0)


def _draw_arrow_board(c: canvas.Canvas, x: float, y: float, direction: str = "right") -> None:
    w, h = 20.0, 12.0
    c.setFillColor(ARROW_FILL)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.7)
    c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
    # Black arrow inside; ``direction`` is one of {"right", "left"}.
    c.setFillColor(ARROW_GLYPH)
    c.setStrokeColor(ARROW_GLYPH)
    c.setLineWidth(0.5)
    p = c.beginPath()
    if direction == "left":
        p.moveTo(x + 6, y - 2)
        p.lineTo(x - 2, y - 2)
        p.lineTo(x - 2, y - 4)
        p.lineTo(x - 7, y)
        p.lineTo(x - 2, y + 4)
        p.lineTo(x - 2, y + 2)
        p.lineTo(x + 6, y + 2)
    else:
        p.moveTo(x - 6, y - 2)
        p.lineTo(x + 2, y - 2)
        p.lineTo(x + 2, y - 4)
        p.lineTo(x + 7, y)
        p.lineTo(x + 2, y + 4)
        p.lineTo(x + 2, y + 2)
        p.lineTo(x - 6, y + 2)
    p.close()
    c.drawPath(p, stroke=0, fill=1)


def _draw_flagger(c: canvas.Canvas, x: float, y: float) -> None:
    s = 6.0  # half-length → 12 pt total
    c.setStrokeColor(FLAG_RED)
    c.setLineWidth(3.0)
    c.line(x - s, y - s, x + s, y + s)
    c.line(x - s, y + s, x + s, y - s)


def _draw_tma(c: canvas.Canvas, x: float, y: float) -> None:
    """Truck-Mounted Attenuator — silver truck silhouette with a rear cushion wedge.

    Distinct from ``_draw_arrow_board`` so a TMA on the plan view doesn't
    read as a flashing arrow panel.  The TMA is the impact-absorbing
    structure mounted on the back of a heavy truck; the silver body
    + yellow cushion wedge gives readers four cues at a glance: color,
    shape, no interior arrow, and a rear feature.

    Page convention: traffic flows left → right on the work-side
    carriageway, so the cab is drawn on the right (leading edge) and
    the cushion wedge points left (rear).
    """
    body_w, body_h = 22.0, 9.0
    cab_w = 5.0
    cushion_w = 4.0

    # Truck body — silver/gray, distinct from the yellow arrow-board panel
    c.setFillColor(colors.HexColor("#B8B8B8"))
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.7)
    c.rect(x - body_w / 2, y - body_h / 2, body_w, body_h, fill=1, stroke=1)

    # Cab (darker rectangle on the leading/right edge)
    cab_x = x + body_w / 2 - cab_w
    c.setFillColor(colors.HexColor("#7A7A7A"))
    c.rect(cab_x, y - body_h / 2, cab_w, body_h, fill=1, stroke=1)

    # Crash cushion at the rear (left edge) — yellow wedge pointing upstream
    rear_x = x - body_w / 2
    c.setFillColor(ARROW_FILL)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    p = c.beginPath()
    p.moveTo(rear_x, y - body_h / 2)
    p.lineTo(rear_x - cushion_w, y)
    p.lineTo(rear_x, y + body_h / 2)
    p.close()
    c.drawPath(p, stroke=1, fill=1)


_DEVICE_GLYPHS: dict[DeviceType, Callable[[canvas.Canvas, float, float], None]] = {
    DeviceType.CONE: _draw_cone,
    DeviceType.DRUM: _draw_drum,
    DeviceType.SIGN_GENERIC: _draw_sign,
    DeviceType.ARROW_BOARD: _draw_arrow_board,
    DeviceType.FLAGGER_STATION: _draw_flagger,
    DeviceType.TUBULAR_MARKER: _draw_cone,
    DeviceType.BARRICADE_TYPE_II: _draw_barricade_ii,
    DeviceType.BARRICADE_TYPE_III: _draw_barricade_iii,
    DeviceType.LONGITUDINAL_CHANNELIZER: _draw_drum,
    DeviceType.PCMS: _draw_arrow_board,
    DeviceType.TRUCK_MOUNTED_ATTENUATOR: _draw_tma,
    DeviceType.TEMPORARY_BARRIER: _draw_drum,
    DeviceType.TEMPORARY_SIGNAL: _draw_sign,
    DeviceType.DETOUR_MARKER: _draw_sign,
    DeviceType.CHANNELIZER_OPTIONAL: _draw_cone,
}

_DEVICE_DISPLAY_NAMES: dict[DeviceType, str] = {
    DeviceType.CONE: "Traffic Cone (36-inch)",
    DeviceType.DRUM: "Channelizing Drum",
    DeviceType.SIGN_GENERIC: "Warning / Construction Sign",
    DeviceType.ARROW_BOARD: "Arrow Board",
    DeviceType.FLAGGER_STATION: "Flagger Station",
    DeviceType.TUBULAR_MARKER: "Tubular Marker",
    DeviceType.BARRICADE_TYPE_II: "Type II Barricade",
    DeviceType.BARRICADE_TYPE_III: "Type III Barricade",
    DeviceType.LONGITUDINAL_CHANNELIZER: "Longitudinal Channelizer",
    DeviceType.PCMS: "Portable Changeable Message Sign",
    DeviceType.TRUCK_MOUNTED_ATTENUATOR: "Truck-Mounted Attenuator (TMA)",
    DeviceType.TEMPORARY_BARRIER: "Temporary Barrier",
    DeviceType.TEMPORARY_SIGNAL: "Temporary Signal",
    DeviceType.DETOUR_MARKER: "Detour Marker",
    DeviceType.CHANNELIZER_OPTIONAL: "Optional Channelizer",
}


def _draw_label_with_halo(c: canvas.Canvas, x: float, y: float, text: str) -> None:
    """Draw a centered text label with a white background rectangle so it
    stays legible on top of road fills, leader lines, and adjacent glyphs.
    """
    c.setFont(LABEL_FONT, LABEL_SIZE)
    text_w = c.stringWidth(text, LABEL_FONT, LABEL_SIZE)
    c.setFillColor(colors.white)
    c.rect(
        x - text_w / 2 - LABEL_HALO_PAD_X,
        y - LABEL_HALO_BOTTOM,
        text_w + 2 * LABEL_HALO_PAD_X,
        LABEL_HALO_TOP + LABEL_HALO_BOTTOM,
        fill=1,
        stroke=0,
    )
    c.setFillColor(colors.black)
    c.drawCentredString(x, y, text)


_TIER_X_STAGGER: tuple[float, ...] = (0.0, 7.0, -7.0, 14.0, -14.0)


def _layout_callout_strip(
    label_specs: list[dict],
    base_y: float,
    direction: int,
) -> list[tuple[dict, float, float]]:
    """Greedy 2-D packing: place each label at its symbol's x, bumping to
    the next tier (further from the road) when it would overlap the
    previous label in that tier.  Successive tiers also pick up a small
    horizontal stagger so leader lines fan out from the symbol cluster
    instead of running parallel and stacking on top of each other.

    ``direction = -1`` for the work-side strip (tiers march DOWN the page,
    away from the road); ``direction = +1`` for the opposing-side strip
    (tiers march UP).
    """
    specs = sorted(label_specs, key=lambda s: s["symbol_x"])
    tier_right_edges: list[float] = []
    placed: list[tuple[dict, float, float]] = []
    gap = 6.0
    for spec in specs:
        text_w = spec["text_w"]
        x = spec["symbol_x"]
        left = x - text_w / 2
        right = x + text_w / 2
        tier = 0
        while tier < len(tier_right_edges) and tier_right_edges[tier] > left - gap:
            tier += 1
        if tier == len(tier_right_edges):
            tier_right_edges.append(right)
        else:
            tier_right_edges[tier] = right
        stagger = _TIER_X_STAGGER[min(tier, len(_TIER_X_STAGGER) - 1)]
        label_x = x + stagger
        label_y = base_y + direction * tier * CALLOUT_TIER_H
        placed.append((spec, label_x, label_y))
    return placed


def _on_road_max_offset_ft(
    params: ScenarioParams,
    shoulder_width_ft: float,
    has_sidewalk: bool = False,
) -> float:
    """|offset_ft| beyond which a sign is considered off-road and gets
    clamped to just outside the shoulder.  When the pedestrian-facility
    flag is on, the threshold is widened so signs that sit on the
    sidewalk strip (R9-9 at offset ~36 ft) stay at their natural
    position rather than getting pulled in to the road edge."""
    half_lanes = 2 if params.is_divided else 1
    base = half_lanes * params.lane_width_ft + shoulder_width_ft
    if has_sidewalk:
        return base + 6.0  # sidewalk outer edge + small margin
    return base


CALLOUT_RADIUS = 5.0  # circled-number callout radius
CALLOUT_NUMBER_FONT_SIZE = 7

SIDEWALK_FILL = colors.HexColor("#DCDCDC")
SIDEWALK_BORDER = colors.HexColor("#888888")
BIKE_LANE_FILL = colors.HexColor("#DAEDC7")
BIKE_LANE_BORDER = colors.HexColor("#7AAA50")
HATCH_GRAY = colors.HexColor("#5A5A5A")
SCHOOL_FILL = colors.HexColor("#FFE89D")

# Schematic facility offsets (ft).  Positions chosen so the existing
# site_adjustments device offsets (R9-9 at 36, M4-9a at 28) sit roughly
# centered on their corresponding strips.
BIKE_LANE_INNER_FT = 25.0
BIKE_LANE_OUTER_FT = 31.0
SIDEWALK_INNER_FT = 33.0
SIDEWALK_OUTER_FT = 39.0


def _detect_site_features(placements: list[DevicePlacement]) -> dict[str, bool]:
    """Infer which site-condition flags are active by scanning placement
    labels.  This avoids threading the flag dict through render_plan_sheet
    callers — the device list itself carries all the information we need.

    ``adjacent_intersection`` is detected by a W20-1 placed at large
    offset (|offset| > 40 ft); the baseline advance W20-1 sits at the
    shoulder offset (≈ 28 ft) and is filtered out by station clipping
    anyway, so the offset check is unambiguous in practice.
    """
    has_r99 = any(p.label == "R9-9" for p in placements)
    has_m49a = any(p.label == "M4-9a" for p in placements)
    has_xstreet_w201 = any(p.label == "W20-1" and abs(p.offset_ft) > 40.0 for p in placements)
    has_school = any(p.label == "S1-1" for p in placements)
    return {
        "pedestrian_facility": has_r99,
        "bicycle_facility": has_m49a,
        "adjacent_intersection": has_xstreet_w201,
        "school_zone": has_school,
    }


def _draw_diagonal_hatch(
    c: canvas.Canvas,
    x_left: float,
    x_right: float,
    y_low: float,
    y_high: float,
    spacing: float = 6.0,
) -> None:
    """Fill the rectangle ``[x_left, x_right] × [y_low, y_high]`` with
    a single-direction diagonal hatch (positive slope, 45°).  Used to
    mark sidewalk and bike-lane segments inside the work-zone span as
    closed."""
    if x_right <= x_left or y_high <= y_low:
        return
    c.setStrokeColor(HATCH_GRAY)
    c.setLineWidth(0.4)
    h = y_high - y_low
    x_start = x_left - h
    while x_start < x_right:
        x_a = max(x_start, x_left)
        x_b = min(x_start + h, x_right)
        if x_a < x_b:
            y_a = y_low + (x_a - x_start)
            y_b = y_low + (x_b - x_start)
            c.line(x_a, y_a, x_b, y_b)
        x_start += spacing


def _draw_strip(
    c: canvas.Canvas,
    x_left: float,
    x_right: float,
    y_low: float,
    y_high: float,
    fill: colors.Color,
    border: colors.Color,
) -> None:
    """Filled stripe with thin top/bottom edge lines.  No left/right
    borders so the strip blends with the plan-view edges instead of
    looking like a boxed-in artifact."""
    c.setFillColor(fill)
    c.rect(x_left, y_low, x_right - x_left, y_high - y_low, fill=1, stroke=0)
    c.setStrokeColor(border)
    c.setLineWidth(0.5)
    c.line(x_left, y_low, x_right, y_low)
    c.line(x_left, y_high, x_right, y_high)


def _strip_y_range(
    offset_inner_ft: float, offset_outer_ft: float, side: int, is_divided: bool = False
) -> tuple[float, float]:
    """Return (y_low, y_high) page coords for a facility strip at the
    given ft offsets.  ``side = +1`` for work side (page bottom),
    ``-1`` for opposing side (page top)."""
    y_outer = _y_of(side * offset_outer_ft, is_divided)
    y_inner = _y_of(side * offset_inner_ft, is_divided)
    return min(y_outer, y_inner), max(y_outer, y_inner)


def _draw_site_context(
    c: canvas.Canvas,
    placements: list[DevicePlacement],
    params: ScenarioParams,
    x_of: Callable[[float], float],
    shoulder_width_ft: float,
) -> None:
    """Schematic context features driven by the active site flags.

    Drawing order (back to front): sidewalk → bike lane → cross-street
    stub → school marker.  Each strip is hatched within the work-zone
    span to indicate closure; the cross-street stub overlays sidewalk
    and bike lane at the intersection point so the strips appear to
    break for the cross street.
    """
    flags = _detect_site_features(placements)
    if not any(flags.values()):
        return

    wz_len = params.work_zone_length_ft
    wz_x_left = x_of(wz_len)
    wz_x_right = x_of(0.0)

    sides = (1, -1) if params.is_divided else (1,)

    if flags["pedestrian_facility"]:
        for side in sides:
            y_low, y_high = _strip_y_range(
                SIDEWALK_INNER_FT, SIDEWALK_OUTER_FT, side, params.is_divided
            )
            _draw_strip(c, PLAN_LEFT, PLAN_RIGHT, y_low, y_high, SIDEWALK_FILL, SIDEWALK_BORDER)
            # Closed segment within the work zone
            if side == 1:
                _draw_diagonal_hatch(c, wz_x_left, wz_x_right, y_low, y_high)
        # Label the strip at the left edge of the plan (outside the
        # work-zone hatching so it stays legible)
        c.setFillColor(colors.HexColor("#5A5A5A"))
        c.setFont("Helvetica-Oblique", 6)
        y_low_w, y_high_w = _strip_y_range(
            SIDEWALK_INNER_FT, SIDEWALK_OUTER_FT, 1, params.is_divided
        )
        c.drawString(PLAN_LEFT + 4, (y_low_w + y_high_w) / 2 - 2, "SIDEWALK")

    if flags["bicycle_facility"]:
        for side in sides:
            y_low, y_high = _strip_y_range(
                BIKE_LANE_INNER_FT, BIKE_LANE_OUTER_FT, side, params.is_divided
            )
            _draw_strip(c, PLAN_LEFT, PLAN_RIGHT, y_low, y_high, BIKE_LANE_FILL, BIKE_LANE_BORDER)
            if side == 1:
                _draw_diagonal_hatch(c, wz_x_left, wz_x_right, y_low, y_high)
        c.setFillColor(colors.HexColor("#3F6020"))
        c.setFont("Helvetica-Oblique", 6)
        y_low_b, y_high_b = _strip_y_range(
            BIKE_LANE_INNER_FT, BIKE_LANE_OUTER_FT, 1, params.is_divided
        )
        c.drawString(PLAN_LEFT + 4, (y_low_b + y_high_b) / 2 - 2, "BIKE LANE")

    if flags["adjacent_intersection"]:
        midpoint = wz_len / 2.0
        x_mid = x_of(midpoint)
        cross_half_w = 24.0  # ~14 ft wide cross street
        cross_len = 30.0
        y_road_top, y_road_bottom = _road_y_extent(params, shoulder_width_ft)
        c.setFillColor(LANE_FILL)
        c.setStrokeColor(ROAD_BORDER)
        c.setLineWidth(0.5)
        # Top stub (overwrites sidewalk/bike-lane strips at the intersection)
        c.rect(
            x_mid - cross_half_w,
            y_road_top,
            cross_half_w * 2,
            cross_len,
            fill=1,
            stroke=1,
        )
        # Bottom stub
        c.rect(
            x_mid - cross_half_w,
            y_road_bottom - cross_len,
            cross_half_w * 2,
            cross_len,
            fill=1,
            stroke=1,
        )
        # Yellow centerline up each stub
        c.setStrokeColor(MEDIAN_EDGE)
        c.setLineWidth(1.0)
        c.line(x_mid, y_road_top, x_mid, y_road_top + cross_len)
        c.line(x_mid, y_road_bottom, x_mid, y_road_bottom - cross_len)
        c.setFillColor(colors.HexColor("#404040"))
        c.setFont("Helvetica-Oblique", 6)
        c.drawCentredString(x_mid, y_road_top + cross_len + 3, "CROSS ST.")

    if flags["school_zone"]:
        buf_len = buffer_space(params.speed_mph)
        taper_len = _required_taper_length(params, shoulder_width_ft)
        school_station = wz_len + buf_len + taper_len + 100.0
        x_school = x_of(school_station)
        y_road_top, _ = _road_y_extent(params, shoulder_width_ft)
        y_school = y_road_top + 35.0
        c.setFillColor(SCHOOL_FILL)
        c.setStrokeColor(colors.black)
        c.setLineWidth(0.5)
        c.rect(x_school - 22, y_school - 7, 44, 14, fill=1, stroke=1)
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(x_school, y_school - 2, "SCHOOL")


def build_sign_schedule(
    placements: list[DevicePlacement],
    station_max_visible: float,
) -> tuple[list[str], dict[str, int]]:
    """Assign a stable callout number to each unique sign code visible
    on the plan view.  Numbering follows the order drivers encounter the
    signs (upstream → downstream, then left → right of road).

    Returns ``(ordered_codes, code_to_number)``.  ``code_to_number`` maps
    each MUTCD code that appears on the plan view to its 1-based callout
    number; ``ordered_codes`` lists the codes in numbering order so the
    Sign Schedule panel can be rendered.
    """
    visible = [
        p
        for p in placements
        if p.station_ft <= station_max_visible
        and p.device_type == DeviceType.SIGN_GENERIC
        and p.label
    ]
    visible.sort(key=lambda p: (-p.station_ft, p.offset_ft))
    seen: set[str] = set()
    order: list[str] = []
    for p in visible:
        if p.label not in seen:
            seen.add(p.label)
            order.append(p.label)
    return order, {code: i + 1 for i, code in enumerate(order)}


def _draw_callout_circle(c: canvas.Canvas, x: float, y: float, n: int) -> None:
    """Small white-filled circle with the schedule number inside.  Replaces
    the older free-floating MUTCD-code text labels — readers consult the
    Sign Schedule panel for the code → meaning mapping."""
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.circle(x, y, CALLOUT_RADIUS, fill=1, stroke=1)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", CALLOUT_NUMBER_FONT_SIZE)
    text = str(n)
    c.drawCentredString(x, y - CALLOUT_NUMBER_FONT_SIZE / 2.0 + 0.5, text)


def _deoverlap_items(
    items: list[tuple[DevicePlacement, float, float]],
    dx_grid: float = 6.0,
    dy_grid: float = 6.0,
    push_dy: float = 13.0,
) -> list[tuple[DevicePlacement, float, float]]:
    """Spread devices that share the same ~spot on the page along the Y
    axis, pushing each successive one further from the road centerline.

    The site_adjustments module places R9-9 signs and Type III barricades
    at exactly the same (station, offset); without this pass they draw on
    top of one another and read as a single muddied glyph.  Push distance
    is sized so the inline numbered callouts attached to each symbol land
    at clearly different page heights.
    """
    from collections import defaultdict

    groups: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, (_p, x, y) in enumerate(items):
        key = (round(x / dx_grid), round(y / dy_grid))
        groups[key].append(i)

    out = list(items)
    for indices in groups.values():
        n = len(indices)
        if n <= 1:
            continue
        # Anchor signs at their natural position (so they stay aligned
        # to context strips like the sidewalk) and push barricades /
        # other non-sign devices outward.
        indices.sort(key=lambda i: 0 if items[i][0].device_type == DeviceType.SIGN_GENERIC else 1)
        for j, idx in enumerate(indices):
            p, x, y = items[idx]
            new_y = y - j * push_dy if p.offset_ft >= 0 else y + j * push_dy
            out[idx] = (p, x, new_y)
    return out


# Bounding-box footprint for the overlap pass.  Conservative values: the
# orange diamond (warning) is 14 pt across; the regulatory sign is
# 11 × 12 pt; the inline numbered callout adds ~14 pt below/above each
# sign.  Using a 16 × 24 box catches sign-on-sign overlaps including the
# callout circle.
SIGN_BOX_W: float = 16.0
SIGN_BOX_H: float = 24.0


def _deoverlap_signs_pairwise(
    items: list[tuple[DevicePlacement, float, float]],
    push_dy: float = 14.0,
    max_iters: int = 6,
) -> list[tuple[DevicePlacement, float, float]]:
    """Second-pass collision avoidance for SIGN_GENERIC items.

    The grid-based ``_deoverlap_items`` only catches near-coincident
    placements; signs placed at slightly different stations (e.g. the
    work-zone-end M4-9a 5 ft inside the upstream R9-9) still overlap
    after that pass.  This routine walks pairs and bumps the second
    sign vertically (away from the road centerline) until no pair of
    sign bounding boxes overlap, capped at ``max_iters`` to prevent
    pathological pile-ups in dense regulatory clusters.
    """
    out = list(items)
    sign_indices = [
        i for i, (p, _x, _y) in enumerate(out) if p.device_type == DeviceType.SIGN_GENERIC
    ]
    if len(sign_indices) < 2:
        return out

    def overlaps(a_x: float, a_y: float, b_x: float, b_y: float) -> bool:
        return abs(a_x - b_x) < SIGN_BOX_W and abs(a_y - b_y) < SIGN_BOX_H

    for _ in range(max_iters):
        moved_any = False
        # Sort by station-x so we walk left → right; on ties, by current y.
        sign_indices.sort(key=lambda i: (out[i][1], out[i][2]))
        for ai in range(len(sign_indices)):
            for bi in range(ai + 1, len(sign_indices)):
                ia = sign_indices[ai]
                ib = sign_indices[bi]
                pa, ax, ay = out[ia]
                pb, bx, by = out[ib]
                if abs(bx - ax) >= SIGN_BOX_W:
                    # X-sorted; once we exceed the X box, no further
                    # b-candidate will overlap pa either.
                    break
                if not overlaps(ax, ay, bx, by):
                    continue
                # Push pb away from the road centerline.  Direction
                # follows the sign of its offset_ft; signs on the work
                # side (offset >= 0) move to lower y, signs on the
                # opposing/median side move to higher y.
                push = -push_dy if pb.offset_ft >= 0 else push_dy
                out[ib] = (pb, bx, by + push)
                moved_any = True
        if not moved_any:
            return out
    return out


def _draw_devices(
    c: canvas.Canvas,
    placements: list[DevicePlacement],
    x_of: Callable[[float], float],
    station_max_visible: float,
    params: ScenarioParams,
    shoulder_width_ft: float,
    code_to_num: dict[str, int],
) -> None:
    """Three-pass render: leaders behind, glyphs above, numbered callouts on top.

    Each labeled sign gets a tiny circled-number callout in the strip
    just outside the road; the number keys into the Sign Schedule
    panel for the MUTCD code and meaning.  This replaces inline code
    text (W20-1 / R9-9 / M4-9a / …) that piles up unreadably when
    several signs share a station, e.g. at the work-zone ends after
    pedestrian-/bicycle-/intersection adjustments.
    """
    flags = _detect_site_features(placements)
    on_road_max = _on_road_max_offset_ft(
        params, shoulder_width_ft, has_sidewalk=flags["pedestrian_facility"]
    )
    y_road_top, y_road_bottom = _road_y_extent(params, shoulder_width_ft)

    # Devices that get clamped to the road edge when their nominal offset
    # would otherwise place them off the page or floating in white space.
    # Signs (W/G/R/M codes) and Type III barricades are placed by the
    # site-adjustments module at offsets just past the shoulder; without
    # clamping the negative-offset mirror lands far above the roadway and
    # reads as detached.
    clampable_types = (
        DeviceType.SIGN_GENERIC,
        DeviceType.BARRICADE_TYPE_III,
        DeviceType.BARRICADE_TYPE_II,
    )

    # Median-resident signs: on a divided highway, layout generators emit
    # advance warning + downstream-end signs at sign_offset_left = -28 ft
    # to satisfy CO Supplement §6C.04(A).  Geometrically those would land
    # in the OPPOSING carriageway's lanes, which is wrong for a sign that
    # serves work-direction drivers in the inside lane.  Snap negative-
    # offset signs into the median band between the two carriageways so
    # they sit visually just left of the work-side roadway.
    median_sign_y = PLAN_Y_CENTER

    items: list[tuple[DevicePlacement, float, float]] = []
    for p in placements:
        if p.station_ft > station_max_visible:
            continue
        x = x_of(p.station_ft)
        if (
            params.is_divided
            and p.device_type == DeviceType.SIGN_GENERIC
            and p.offset_ft < 0
            and abs(p.offset_ft) <= on_road_max + 4.0
        ):
            # Median-side sign on a divided highway — render in the median.
            y = median_sign_y
        elif p.device_type in clampable_types and abs(p.offset_ft) > on_road_max:
            # Clamp off-road signs/barricades proportionally so a device at
            # offset 36 ft sits closer to the shoulder than one at offset
            # 50 ft (the intersection W20-1).  This keeps off-road
            # placements visually attached to the road edge instead of
            # floating in margin white space.
            overage = abs(p.offset_ft) - on_road_max
            clamp_dist = 7.0 + min(overage, 20.0) * 0.5
            y = y_road_bottom - clamp_dist if p.offset_ft > 0 else y_road_top + clamp_dist
        else:
            y = _y_of(p.offset_ft, params.is_divided)
        items.append((p, x, y))

    items = _deoverlap_items(items)
    items = _deoverlap_signs_pairwise(items)

    # Pass 1: glyphs first — each device drawn at its (possibly
    # de-overlapped) screen position.
    for p, x, y in items:
        if p.device_type == DeviceType.ARROW_BOARD:
            direction = "left" if p.label == "LEFT_ARROW" else "right"
            _draw_arrow_board(c, x, y, direction=direction)
        elif p.device_type == DeviceType.SIGN_GENERIC:
            _draw_sign(c, x, y, p.label or "")
        else:
            glyph = _DEVICE_GLYPHS.get(p.device_type, _draw_sign)
            glyph(c, x, y)

    # Pass 2: inline numbered callouts attached to each sign.  The number
    # sits directly below (work-side) or above (opposing-side) its
    # symbol, with no leader line — proximity carries the association.
    inline_offset = 11.0
    for p, x, y in items:
        if p.device_type != DeviceType.SIGN_GENERIC or not p.label:
            continue
        n = code_to_num.get(p.label)
        if n is None:
            continue
        cy = y - inline_offset if p.offset_ft >= 0 else y + inline_offset
        _draw_callout_circle(c, x, cy, n)


# ---------------------------------------------------------------------------
# Dimension callouts and direction arrow
# ---------------------------------------------------------------------------


def _draw_dim(
    c: canvas.Canvas,
    x1: float,
    x2: float,
    y: float,
    label: str,
) -> None:
    """Dimension line with a centered label.

    If the segment is too narrow to hold the label, the label is raised
    to a second tier above the dim line and connected by a short leader
    so it cannot collide with adjacent dim labels (e.g. a short taper
    next to a short buffer next to a long work zone).
    """
    c.setStrokeColor(DIM_LINE)
    c.setLineWidth(0.5)
    c.line(x1, y, x2, y)
    c.line(x1, y - 4, x1, y + 4)
    c.line(x2, y - 4, x2, y + 4)
    c.setFillColor(DIM_LINE)
    c.setFont("Helvetica", 7)
    text_width = c.stringWidth(label, "Helvetica", 7)
    segment_width = abs(x2 - x1)
    x_center = (x1 + x2) / 2.0
    if text_width > segment_width - 4.0:
        y_label = y + 12.0
        c.line(x_center, y + 1.0, x_center, y_label - 1.5)
        c.drawCentredString(x_center, y_label, label)
    else:
        c.drawCentredString(x_center, y + 5.0, label)


def _draw_lane_arrow(
    c: canvas.Canvas,
    x_left: float,
    x_right: float,
    y: float,
    pointing_right: bool = True,
) -> None:
    """Direction-of-travel arrow drawn inside an open lane.  The
    arrowhead sits at the leading edge so the direction reads at a
    glance; placement on the lane (rather than floating in white space
    outside the road) ties the indicator to the geometry it describes."""
    c.setStrokeColor(colors.black)
    c.setLineWidth(1.4)
    c.line(x_left, y, x_right, y)
    head = 6.0
    half_h = head * 0.55
    if pointing_right:
        c.line(x_right, y, x_right - head, y + half_h)
        c.line(x_right, y, x_right - head, y - half_h)
    else:
        c.line(x_left, y, x_left + head, y + half_h)
        c.line(x_left, y, x_left + head, y - half_h)


def _draw_scale_break(c: canvas.Canvas, x_center: float, y_top: float, y_bot: float) -> None:
    """Two thin diagonal slashes across the road indicating a compressed
    region (standard engineering // mark; kept light so it doesn't fight
    with the device glyphs nearby)."""
    c.setStrokeColor(colors.HexColor("#5A5A5A"))
    c.setLineWidth(0.6)
    h = y_top - y_bot
    dx = h * 0.18  # gentler slope, more vertical
    for offset in (-2.5, 2.5):
        c.line(
            x_center + offset - dx / 2.0,
            y_bot,
            x_center + offset + dx / 2.0,
            y_top,
        )


def _draw_landmarks(
    c: canvas.Canvas,
    params: ScenarioParams,
    x_of: Callable[[float], float],
    shoulder_width_ft: float,
) -> None:
    """Dimension callouts for taper, buffer, and work zone (visible portion only).

    Mobile and off-road operations have no fixed taper, buffer, or
    bounded work zone, so the dimension band is skipped — drawing it
    would attach inapplicable distances to whatever placements happen
    to fall in the same horizontal band.
    """
    if params.closure_type in ("mobile", "off_road"):
        return
    wz_len = params.work_zone_length_ft
    taper_len = _required_taper_length(params, shoulder_width_ft)
    buf_len = buffer_space(params.speed_mph)
    taper_label = "L" if params.closure_type == "lane" else "L/3"

    wz_end = 0.0
    wz_start = wz_len
    taper_end = wz_start + buf_len
    taper_start = taper_end + taper_len

    y_road_top, y_road_bottom = _road_y_extent(params, shoulder_width_ft)
    # Sit the dim band well above the upper callout strip so its tick lines
    # cannot land inside a tiered sign label.
    y_top = y_road_top + 18 * PTS_PER_OFFSET_FT

    _draw_dim(
        c,
        x_of(taper_start),
        x_of(taper_end),
        y_top,
        f"{taper_label} = {taper_len:.0f} ft",
    )
    _draw_dim(
        c,
        x_of(taper_end),
        x_of(wz_start),
        y_top,
        f"BUFFER = {buf_len:.0f} ft (NTS)",
    )
    _draw_dim(
        c,
        x_of(wz_start),
        x_of(wz_end),
        y_top,
        f"WORK ZONE = {wz_len:.0f} ft",
    )

    # Scale-break marks across the road in the (compressed) buffer region.
    buffer_mid_x = x_of(wz_len + buf_len / 2.0)
    _draw_scale_break(c, buffer_mid_x, y_road_top, y_road_bottom)


# ---------------------------------------------------------------------------
# Title block, legend, notes
# ---------------------------------------------------------------------------


def _scenario_label(params: ScenarioParams) -> str:
    """Default banner label derived from closure_type + is_divided when
    the project_name field is left empty."""
    if params.closure_type == "mobile":
        return (
            "MOBILE OPERATION — MULTI-LANE ROAD"
            if params.is_divided
            else "MOBILE OPERATION — 2-LANE ROAD"
        )
    if params.closure_type == "off_road":
        return "WORK BEYOND THE SHOULDER"
    if params.closure_type == "lane" and not params.is_divided:
        return "FLAGGER ALTERNATING TRAFFIC — 2-LANE UNDIVIDED"
    if params.closure_type == "lane":
        return "RIGHT-LANE CLOSURE — DIVIDED HIGHWAY"
    if params.is_divided:
        return "SHOULDER CLOSURE — DIVIDED HIGHWAY"
    return "SHOULDER CLOSURE — 2-LANE UNDIVIDED"


def _mutcd_ta_reference(params: ScenarioParams) -> str:
    """Best-effort MUTCD Typical Application reference for the scenario
    in hand.  Maps closure_type + divided-ness to one of the standard
    Part 6 TA diagrams; returns ``"—"`` for combinations the tool does
    not yet support so the title block still renders without a stale
    citation.
    """
    if params.closure_type == "off_road":
        return "TA-1"
    if params.closure_type == "shoulder":
        return "TA-2"
    if params.closure_type == "lane" and not params.is_divided:
        return "TA-10"
    if params.closure_type == "lane" and params.is_divided:
        return "TA-19"
    if params.closure_type == "mobile":
        return "TA-35"
    return "—"


def _cdot_standard_reference(params: ScenarioParams) -> str:
    """CDOT M&S Standard Plan number for the scenario.  S-630-1 covers
    shoulder closures, S-630-2 covers two-lane lane-closure (flagger),
    S-630-3 covers divided-highway lane closures.  Mobile and off-road
    operations don't have a dedicated standard plan."""
    if params.closure_type == "shoulder" or params.closure_type == "off_road":
        return "S-630-1"
    if params.closure_type == "lane" and not params.is_divided:
        return "S-630-2"
    if params.closure_type == "lane" and params.is_divided:
        return "S-630-3"
    return "—"


def _draw_title_block(
    c: canvas.Canvas,
    title: str,
    project_name: str,
    sheet_number: str,
    total_sheets: str,
    params: ScenarioParams,
    scale_label: str,
) -> None:
    """Top banner: METHOD OF HANDLING TRAFFIC, project, speed.

    Segments are joined by em dashes and rendered as a single line.
    The default placeholder ``"Untitled Project"`` is hidden so the
    banner reads cleanly when no real project name is supplied; the
    structured title block at the lower-right always carries the full
    metadata regardless.
    """
    _ = sheet_number, total_sheets, scale_label  # surfaced in the bottom title block
    y0 = PAGE_H - TITLE_H
    c.setStrokeColor(TITLE_BORDER)
    c.setLineWidth(1.0)
    c.line(MARGIN, y0, PAGE_W - MARGIN, y0)
    c.line(MARGIN, PAGE_H - MARGIN, PAGE_W - MARGIN, PAGE_H - MARGIN)

    show_project = bool(project_name) and project_name != "Untitled Project"

    y = PAGE_H - 30
    x = MARGIN + 8

    # Title — bold 14pt
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(x, y, title)
    x += c.stringWidth(title, "Helvetica-Bold", 14)

    # Project segment — only when the user supplied a real value.  Em
    # dash separator is drawn at the title's bold weight so it visually
    # belongs to the banner rather than to either neighbouring segment.
    if show_project:
        sep = "  —  "
        c.setFont("Helvetica-Bold", 14)
        c.drawString(x, y, sep)
        x += c.stringWidth(sep, "Helvetica-Bold", 14)
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(colors.HexColor("#1A1A1A"))
        c.drawString(x, y + 1.0, project_name)
        x += c.stringWidth(project_name, "Helvetica-Bold", 12)

    # Speed segment — always shown.
    sep = "  —  "
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(colors.black)
    c.drawString(x, y, sep)
    x += c.stringWidth(sep, "Helvetica-Bold", 14)
    speed_text = f"{params.speed_mph} MPH"
    c.setFont("Helvetica", 11)
    c.setFillColor(colors.HexColor("#444444"))
    c.drawString(x, y + 1.5, speed_text)


# ---------------------------------------------------------------------------
# Structured title block (lower-right) and chrome (north arrow, sheet border)
# ---------------------------------------------------------------------------


# Three-box footer layout: LEGEND | NOTES & SIGN SCHEDULE | TITLE BLOCK,
# each occupying ⅓ of the inner page width with a small gutter between.
# Box origins are computed from MARGIN so the row aligns with the
# outer sheet border at both ends.
FOOTER_GUTTER: float = 12.0
FOOTER_BOX_W: float = (PAGE_W - 2 * MARGIN - 2 * FOOTER_GUTTER) / 3.0
FOOTER_BOX_H: float = FOOTER_H - 16.0
LEGEND_BOX_X: float = MARGIN
NOTES_BOX_X: float = MARGIN + FOOTER_BOX_W + FOOTER_GUTTER
TITLE_BLOCK_X: float = MARGIN + 2 * (FOOTER_BOX_W + FOOTER_GUTTER)
FOOTER_BOX_Y: float = MARGIN

TITLE_BLOCK_PAD: float = 8.0
TITLE_BLOCK_ROW_H: float = 11.0
TITLE_BLOCK_SECTION_GAP: float = 4.0
TITLE_BLOCK_VALUE_FONT_SIZE: float = 8.0


def _wrap_to_width(
    c: canvas.Canvas,
    text: str,
    font: str,
    size: float,
    max_w: float,
    max_lines: int = 2,
) -> list[str]:
    """Word-wrap ``text`` to ≤ ``max_lines`` lines that each fit ``max_w``.

    Greedy word packing: pack as many whole words as possible per line;
    if the last permitted line still overflows, ellipsis-truncate it.
    Single words wider than ``max_w`` get hard-truncated mid-word so
    the title block never bleeds into the margin.
    """
    if max_lines < 1:
        return []
    if not text:
        return [""]
    if c.stringWidth(text, font, size) <= max_w:
        return [text]

    words = text.split(" ")
    lines: list[str] = []
    cur = ""
    for word in words:
        candidate = word if not cur else cur + " " + word
        if c.stringWidth(candidate, font, size) <= max_w:
            cur = candidate
        else:
            if cur:
                lines.append(cur)
                if len(lines) == max_lines:
                    cur = word
                    break
            cur = word
            # If a single word still overflows, hard-truncate.
            if c.stringWidth(cur, font, size) > max_w:
                cur = _truncate_to_width(c, cur, font, size, max_w)
    if cur:
        if len(lines) < max_lines:
            lines.append(cur)
        else:
            # Pack the leftover into the last line, ellipsis-truncated.
            tail = (lines[-1] + " " + cur) if lines[-1] else cur
            lines[-1] = _truncate_to_width(c, tail, font, size, max_w)

    if len(lines) > max_lines:
        # Belt-and-suspenders: ensure we never exceed the cap.
        lines = lines[:max_lines]
        lines[-1] = _truncate_to_width(c, lines[-1], font, size, max_w)
    return lines


def _draw_structured_title_block(
    c: canvas.Canvas,
    params: ScenarioParams,
    project_name: str,
    location_description: str,
    sheet_number: str,
    total_sheets: str,
    scale_label: str,
    bearing_deg: float | None = None,
) -> None:
    """Boxed title block — third box of the equal-width footer row.

    Engineering-plan conventions: PROJECT/LOCATION up top, MUTCD/CDOT
    references in the middle, SCALE/DATE/SHEET below, and DRAWN BY /
    STATUS at the foot.  Long values (project names, MHT-type labels,
    location prose) wrap to a second line so the full classification
    is preserved instead of being mid-word truncated.  The box itself
    is sized to ``FOOTER_BOX_W × FOOTER_BOX_H`` so it lines up with
    the LEGEND and NOTES boxes; rows render top-down with whitespace
    slack accruing at the bottom of the box when content is short.

    When ``bearing_deg`` is None the orientation caveat appears as an
    ORIENTATION row in the STANDARDS section instead of as text under
    the compass; this keeps the compass area on the schematic clean.
    """
    standards_rows: list[tuple[str, str]] = [
        ("MHT TYPE", _scenario_label(params)),
        ("MUTCD", _mutcd_ta_reference(params)),
        ("CDOT", _cdot_standard_reference(params)),
    ]
    if bearing_deg is None:
        standards_rows.append(("ORIENTATION", "Site bearing not provided"))

    sections: list[tuple[str, list[tuple[str, str]]]] = [
        (
            "PROJECT",
            [
                ("PROJECT", project_name or "Untitled Project"),
                ("LOCATION", location_description or "—"),
            ],
        ),
        ("STANDARDS", standards_rows),
        (
            "SHEET",
            [
                ("SCALE", scale_label),
                ("DATE", date.today().isoformat()),
                ("SHEET", f"{sheet_number} OF {total_sheets}"),
            ],
        ),
        (
            "STATUS",
            [
                ("DRAWN BY", "MHT Tool (auto-generated)"),
                ("STATUS", "DRAFT — Not for stamping"),
            ],
        ),
    ]

    w = FOOTER_BOX_W
    h = FOOTER_BOX_H
    x_box = TITLE_BLOCK_X
    y_box = FOOTER_BOX_Y

    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.rect(x_box, y_box, w, h, fill=0, stroke=1)

    # Wider value column — leverages the new 388-pt box width so almost
    # everything fits on one line and the wrap pass only triggers for
    # genuinely long project names.
    label_col_w = 70.0
    value_col_w = w - label_col_w - 2 * TITLE_BLOCK_PAD

    # Pre-wrap values so the row count is known up front.
    wrapped: list[tuple[str, str, list[str]]] = []
    for section_name, rows in sections:
        for label, value in rows:
            font = "Helvetica-Bold" if label == "STATUS" else "Helvetica"
            size = TITLE_BLOCK_VALUE_FONT_SIZE
            lines = _wrap_to_width(c, value, font, size, value_col_w, max_lines=2)
            wrapped.append((section_name, label, lines))

    label_x = x_box + TITLE_BLOCK_PAD
    value_x = x_box + TITLE_BLOCK_PAD + label_col_w

    # Drawing cursor starts at the top of the box (+ pad) and walks down.
    y = y_box + h - TITLE_BLOCK_PAD

    current_section = wrapped[0][0]
    for section_name, label, lines in wrapped:
        if section_name != current_section:
            # Inter-section divider rule.
            c.setStrokeColor(colors.HexColor("#BBBBBB"))
            c.setLineWidth(0.3)
            c.line(
                x_box + TITLE_BLOCK_PAD,
                y - 0.5,
                x_box + w - TITLE_BLOCK_PAD,
                y - 0.5,
            )
            y -= TITLE_BLOCK_SECTION_GAP
            current_section = section_name

        # Label column on the first line of the row.
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(colors.HexColor("#666666"))
        c.drawString(label_x, y - 7.5, label + ":")

        # Value column — one rendered line per wrapped line.
        for line in lines:
            if label == "STATUS":
                c.setFont("Helvetica-Bold", TITLE_BLOCK_VALUE_FONT_SIZE)
                c.setFillColor(colors.HexColor("#B05010"))
            elif label == "ORIENTATION":
                c.setFont("Helvetica-Oblique", TITLE_BLOCK_VALUE_FONT_SIZE)
                c.setFillColor(colors.HexColor("#666666"))
            else:
                c.setFont("Helvetica", TITLE_BLOCK_VALUE_FONT_SIZE)
                c.setFillColor(colors.black)
            c.drawString(value_x, y - 7.5, line)
            y -= TITLE_BLOCK_ROW_H


def _truncate_to_width(c: canvas.Canvas, text: str, font: str, size: float, max_w: float) -> str:
    """Trim ``text`` with an ellipsis so its rendered width is ≤ ``max_w``.

    Used as a last-resort fallback inside the wrapper when even a
    single word can't fit the value column.  Most rows reach the
    title block via ``_wrap_to_width`` instead, which packs whole
    words across up to two lines before falling through here.
    """
    if c.stringWidth(text, font, size) <= max_w:
        return text
    ell = "…"
    out = text
    while out and c.stringWidth(out + ell, font, size) > max_w:
        out = out[:-1]
    return (out + ell) if out else ell


def _draw_north_arrow(
    c: canvas.Canvas,
    x_center: float,
    y_center: float,
    bearing_deg: float | None,
) -> None:
    """North arrow + direction-of-travel caption, drawn at ``(x_center,
    y_center)``.

    Schematic convention (per the module docstring): the LEFT edge of
    the plan view is upstream (high station), the RIGHT edge is
    downstream.  Drivers therefore travel LEFT → RIGHT across the page
    on the work-side carriageway, which is what the work-side lane
    arrow rendered by ``_draw_road`` shows; the compass's "Direction
    of travel" sub-arrow matches that convention and points right.

    When ``bearing_deg`` is supplied the north symbol rotates to that
    compass bearing (0 = north up, 90 = east right).  When None we
    leave the arrow pointing page-up and surface the caveat as an
    ORIENTATION row in the structured title block instead — keeping
    the area around the compass clean.
    """
    import math

    arrow_h = 26.0
    arrow_w = 12.0

    theta = 0.0 if bearing_deg is None else math.radians(bearing_deg)

    cos_t = math.cos(theta)
    sin_t = math.sin(theta)

    def rot(dx: float, dy: float) -> tuple[float, float]:
        # Standard 2D rotation: theta=0 keeps the arrow pointing up
        # (page +y).  Positive bearing rotates clockwise (compass
        # convention) — i.e. theta=90° rotates "up" to "right".
        return (
            x_center + dx * cos_t + dy * sin_t,
            y_center - dx * sin_t + dy * cos_t,
        )

    # Arrow shaft
    p_tail = rot(0.0, -arrow_h / 2.0)
    p_tip = rot(0.0, arrow_h / 2.0)
    p_head_l = rot(-arrow_w / 2.0, arrow_h / 2.0 - arrow_w * 0.9)
    p_head_r = rot(arrow_w / 2.0, arrow_h / 2.0 - arrow_w * 0.9)

    c.setStrokeColor(colors.black)
    c.setFillColor(colors.black)
    c.setLineWidth(1.2)
    c.line(p_tail[0], p_tail[1], p_tip[0], p_tip[1])
    path = c.beginPath()
    path.moveTo(p_tip[0], p_tip[1])
    path.lineTo(p_head_l[0], p_head_l[1])
    path.lineTo(p_head_r[0], p_head_r[1])
    path.close()
    c.drawPath(path, stroke=0, fill=1)

    # "N" letter just outside the arrow tip, rotated with the symbol.
    n_pos = rot(0.0, arrow_h / 2.0 + 7.0)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(n_pos[0], n_pos[1] - 3.0, "N")

    # Direction-of-travel caption + sub-arrow beneath the compass.
    # The sub-arrow points RIGHT to match the LEFT → RIGHT work-side
    # traffic convention used by ``_draw_road``'s lane arrows.
    cap_y = y_center - arrow_h / 2.0 - 11.0
    c.setFont("Helvetica", 6)
    c.setFillColor(colors.HexColor("#404040"))
    c.drawCentredString(x_center, cap_y, "Direction of travel")
    c.setStrokeColor(colors.HexColor("#404040"))
    c.setLineWidth(0.8)
    sub_y = cap_y - 5.5
    c.line(x_center - 14, sub_y, x_center + 14, sub_y)
    # Arrowhead at the right end (downstream side of the work-side roadway).
    c.line(x_center + 14, sub_y, x_center + 10, sub_y + 2.5)
    c.line(x_center + 14, sub_y, x_center + 10, sub_y - 2.5)


def _draw_sheet_border(c: canvas.Canvas) -> None:
    """Thin black border 0.25" inside the page edge — matches typical
    engineering-plan conventions and frames the sheet content."""
    inset = 18.0  # 0.25 inch
    c.setStrokeColor(colors.black)
    c.setLineWidth(1.0)
    c.rect(inset, inset, PAGE_W - 2 * inset, PAGE_H - 2 * inset, fill=0, stroke=1)


_SIGN_CATEGORY_LEGEND: dict[str, tuple[str, str]] = {
    "warning": ("Warning sign (W series, e.g. W20-1)", "W1-1"),
    "guide": ("Construction guide (G series, e.g. G20-2)", "G1-1"),
    "regulatory": ("Regulatory sign (R series, e.g. R9-9)", "R1-1"),
    "route": ("Route guidance (M series, e.g. M4-9a)", "M1-1"),
    "school": ("School sign (S series, e.g. S1-1)", "S1-1"),
}

_SIGN_CATEGORY_ORDER: tuple[str, ...] = (
    "warning",
    "guide",
    "regulatory",
    "route",
    "school",
)

_SITE_CONTEXT_LEGEND: dict[str, str] = {
    "sidewalk": "Sidewalk (hatched within work zone = closed)",
    "bike_lane": "Bike lane (hatched within work zone = closed)",
    "cross_street": "Cross-street (intersecting work zone)",
    "school": "School building (S1-1 zone applies)",
}

_SITE_CONTEXT_ORDER: tuple[str, ...] = (
    "sidewalk",
    "bike_lane",
    "cross_street",
    "school",
)


def _draw_context_icon(c: canvas.Canvas, x: float, y: float, kind: str) -> None:
    """Small legend icon for one of the schematic site-context features."""
    if kind == "sidewalk":
        w, h = 14.0, 5.0
        c.setFillColor(SIDEWALK_FILL)
        c.setStrokeColor(SIDEWALK_BORDER)
        c.setLineWidth(0.4)
        c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
    elif kind == "bike_lane":
        w, h = 14.0, 5.0
        c.setFillColor(BIKE_LANE_FILL)
        c.setStrokeColor(BIKE_LANE_BORDER)
        c.setLineWidth(0.4)
        c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
    elif kind == "cross_street":
        w, h = 7.0, 12.0
        c.setFillColor(LANE_FILL)
        c.setStrokeColor(ROAD_BORDER)
        c.setLineWidth(0.4)
        c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
        c.setStrokeColor(MEDIAN_EDGE)
        c.setLineWidth(0.5)
        c.line(x, y - h / 2, x, y + h / 2)
    elif kind == "school":
        w, h = 14.0, 7.0
        c.setFillColor(SCHOOL_FILL)
        c.setStrokeColor(colors.black)
        c.setLineWidth(0.4)
        c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 4)
        c.drawCentredString(x, y - 1.2, "SCHOOL")


def _draw_median_icon(c: canvas.Canvas, x: float, y: float) -> None:
    """Small legend icon for the median band on a divided highway."""
    w, h = 16.0, 8.0
    c.setFillColor(MEDIAN_FILL)
    c.setStrokeColor(MEDIAN_EDGE)
    c.setLineWidth(0.6)
    c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
    # Mini diagonal hatch for the median fill so it matches the sheet.
    c.setStrokeColor(HATCH_GRAY)
    c.setLineWidth(0.3)
    for offset in (-4.0, 0.0, 4.0):
        c.line(x + offset - h / 2, y - h / 2, x + offset + h / 2, y + h / 2)


def _draw_legend(
    c: canvas.Canvas,
    placements: list[DevicePlacement],
    is_divided: bool = False,
    scale_note: str = "",
) -> None:
    """Two-section legend: device-type icons (cone, drum, barricade, …)
    followed by sign-category icons keyed to the shape and color used on
    the plan view.  The category section explains why one sign appears
    as an orange diamond and another as a white-with-red-border square.

    On divided highways an extra ROAD GEOMETRY section calls out the
    median band symbol and notes that left-side advance warning signs
    are placed in the median (CO Supplement §6C.04(A))."""
    device_types_used = sorted(
        {p.device_type for p in placements if p.device_type != DeviceType.SIGN_GENERIC},
        key=lambda dt: dt.value,
    )
    sign_cats_present: set[str] = set()
    for p in placements:
        if p.device_type == DeviceType.SIGN_GENERIC and p.label:
            sign_cats_present.add(_sign_category(p.label))
    sign_cats_used = [c for c in _SIGN_CATEGORY_ORDER if c in sign_cats_present]

    flags = _detect_site_features(placements)
    flag_to_kind = {
        "pedestrian_facility": "sidewalk",
        "bicycle_facility": "bike_lane",
        "adjacent_intersection": "cross_street",
        "school_zone": "school",
    }
    context_kinds_used = [
        kind
        for kind in _SITE_CONTEXT_ORDER
        if any(flags.get(flag) and flag_to_kind[flag] == kind for flag in flag_to_kind)
    ]

    box_x = LEGEND_BOX_X
    box_y = FOOTER_BOX_Y
    width = FOOTER_BOX_W
    height = FOOTER_BOX_H

    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.rect(box_x, box_y, width, height, fill=0, stroke=1)

    title_y = box_y + height - 12.0
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(box_x + 8, title_y, "LEGEND")

    row_h = 14
    y = title_y - 14
    glyph_x = box_x + 18
    text_x = box_x + 36

    def _bail() -> bool:
        return y < box_y + 10

    c.setFont("Helvetica", 8)
    for dt in device_types_used:
        glyph = _DEVICE_GLYPHS.get(dt, _draw_sign)
        glyph(c, glyph_x, y + 3)
        c.setFillColor(colors.black)
        c.drawString(text_x, y, _DEVICE_DISPLAY_NAMES.get(dt, dt.value))
        y -= row_h
        if _bail():
            return

    if sign_cats_used:
        y -= 4  # divider gap between sections
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(box_x + 8, y, "SIGN CATEGORIES")
        y -= row_h - 1
        c.setFont("Helvetica", 8)
        for cat in sign_cats_used:
            description, sample_label = _SIGN_CATEGORY_LEGEND[cat]
            _draw_sign(c, glyph_x, y + 3, sample_label)
            c.setFillColor(colors.black)
            c.drawString(text_x, y, description)
            y -= row_h
            if _bail():
                return

    if context_kinds_used:
        y -= 4
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(box_x + 8, y, "SITE CONTEXT")
        y -= row_h - 1
        c.setFont("Helvetica", 8)
        for kind in context_kinds_used:
            _draw_context_icon(c, glyph_x, y + 3, kind)
            c.setFillColor(colors.black)
            c.drawString(text_x, y, _SITE_CONTEXT_LEGEND[kind])
            y -= row_h
            if _bail():
                return

    if is_divided:
        y -= 4
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(box_x + 8, y, "ROAD GEOMETRY")
        y -= row_h - 1
        c.setFont("Helvetica", 8)
        _draw_median_icon(c, glyph_x, y + 3)
        c.setFillColor(colors.black)
        c.drawString(text_x, y, "Median (separates carriageways)")
        y -= row_h
        if _bail():
            return
        c.setFont("Helvetica-Oblique", 7)
        c.setFillColor(colors.HexColor("#404040"))
        c.drawString(box_x + 8, y, "Left-side advance signs sit in the median")
        y -= 9
        if _bail():
            return
        c.drawString(box_x + 8, y, "per CO Supplement §6C.04(A).")
        y -= row_h

    # Scale-convention footnote — pinned to the bottom of the LEGEND
    # box.  The structured title block carries only the bare ratio
    # ("1\" = N ft") to keep that cell legible; the explanation of
    # which region the ratio applies to lives here so a reader can
    # always orient against the schematic without squinting at a
    # truncated value cell.
    if scale_note:
        c.setFont("Helvetica-Oblique", 6.5)
        c.setFillColor(colors.HexColor("#666666"))
        legend_inner_w = width - 16
        wrapped = _wrap_to_width(
            c, scale_note, "Helvetica-Oblique", 6.5, legend_inner_w, max_lines=3
        )
        # Anchor inside the box's bottom edge so the footnote doesn't
        # collide with the rows above and never escapes the box border.
        note_y = box_y + 8 + (len(wrapped) - 1) * 9
        for i, line in enumerate(wrapped):
            c.drawString(box_x + 8, note_y - i * 9, line)


def _draw_notes(
    c: canvas.Canvas,
    params: ScenarioParams,
    shoulder_width_ft: float,
    schedule_order: list[str] | None = None,
) -> None:
    """Draw the NOTES & SIGN SCHEDULE panel as three tabular sub-sections.

    Layout: bold sub-section headers (each preceded by a thin grey rule)
    over (1) a 2-column PARAMETERS grid, (2) a 3-column SIGN SCHEDULE
    table (#, CODE, DESCRIPTION), and (3) a 3-column ADVANCE WARNING
    SIGNS table with right-aligned distances.  MUTCD codes are bolded.
    """
    # Middle box of the three-equal-width footer row.
    x_box = NOTES_BOX_X
    box_y = FOOTER_BOX_Y
    width = FOOTER_BOX_W
    height = FOOTER_BOX_H

    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.rect(x_box, box_y, width, height, fill=0, stroke=1)

    title_y = box_y + height - 12.0
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x_box + 8, title_y, "NOTES & SIGN SCHEDULE")

    speed = params.speed_mph
    is_mobile = params.closure_type == "mobile"
    is_off_road = params.closure_type == "off_road"
    is_lane = params.closure_type == "lane"
    is_flagger = is_lane and not params.is_divided

    rt = params.road_type if params.road_type in _TABLE_CATEGORIES else None
    abc = advance_warning_spacing(speed, rt)
    sign_a_dist = abc["A"]
    sign_b_dist = abc["A"] + abc["B"]
    sign_c_dist = abc["A"] + abc["B"] + abc["C"]

    # Mobile and off-road ops have no taper or buffer; defer the values
    # to None so the params block can omit those rows.
    if is_mobile or is_off_road:
        taper_len = None
        buf_len = None
        taper_label = None
    else:
        taper_len = _required_taper_length(params, shoulder_width_ft)
        buf_len = buffer_space(speed)
        taper_label = "Lane taper (L)" if is_lane else "Shoulder taper (L/3)"

    if is_mobile:
        # Mobile-op series: WORKERS at A, ROAD WORK AHEAD at B (per
        # generate_mobile_op_2lane).  No third sign — mobile ops use the
        # shadow vehicle's beacon/arrow board as the closest cue, not a
        # third roadside sign.
        advance: list[tuple[str, str, float]] = [
            ("W21-1a", "WORKERS", sign_a_dist),
            ("W20-1", "ROAD WORK AHEAD", sign_b_dist),
        ]
    elif is_off_road:
        advance = [("W21-5", "SHOULDER WORK", sign_a_dist)]
    elif is_flagger:
        advance = [
            ("W20-7", "FLAGGER AHEAD", sign_a_dist),
            ("W3-4", "BE PREPARED TO STOP", sign_b_dist),
            ("W20-1", "ROAD WORK AHEAD", sign_c_dist),
        ]
    elif is_lane:
        advance = [
            ("W4-2R", "RIGHT LANE ENDS", sign_a_dist),
            ("W20-5R", "RIGHT LANE CLOSED AHEAD", sign_b_dist),
            ("W20-1", "ROAD WORK AHEAD", sign_c_dist),
        ]
    else:
        advance = [
            ("W21-5aR", "RIGHT SHOULDER CLOSED AHEAD", sign_a_dist),
            ("W20-2", f"ROAD WORK {sign_b_dist:.0f} FT", sign_b_dist),
            ("W20-1", "ROAD WORK AHEAD", sign_c_dist),
        ]

    x = x_box + 8
    x_right = x_box + width - 8
    y = [FOOTER_H - 24]

    def section_header(title: str) -> None:
        y[0] -= 4
        c.setStrokeColor(colors.HexColor("#888888"))
        c.setLineWidth(0.4)
        c.line(x, y[0] + 4, x_right, y[0] + 4)
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(x, y[0] - 4, title)
        y[0] -= 12

    def column_header(label: str, x_pos: float, align: str = "left") -> None:
        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(colors.HexColor("#666666"))
        if align == "right":
            c.drawRightString(x_pos, y[0], label)
        else:
            c.drawString(x_pos, y[0], label)

    # PARAMETERS — 2-column "label : value" grid
    section_header("PARAMETERS")
    rows: list[tuple[str, str]] = [
        ("Speed limit", f"{speed} mph"),
        ("Closure", params.closure_type),
    ]
    if is_mobile:
        # Mobile ops have no fixed work area or taper.  The trailing
        # distance between work truck and shadow is the relevant length.
        rows.append(("Shadow trailing", "100 ft"))
        rows.append(("Advance sign A", f"{sign_a_dist:.0f} ft"))
    elif is_off_road:
        rows.append(("Advance sign A", f"{sign_a_dist:.0f} ft"))
    else:
        rows.append(("Work zone", f"{params.work_zone_length_ft:.0f} ft"))
        rows.append((taper_label, f"{taper_len:.0f} ft"))
        rows.append(("Buffer", f"{buf_len:.0f} ft"))
    col_x = [x, x + width / 2.0]
    val_x = [col_x[0] + 110, col_x[1] + 110]
    for k, (label, val) in enumerate(rows):
        col = k % 2
        if col == 0 and k > 0:
            y[0] -= 10
        c.setFont("Helvetica", 7)
        c.setFillColor(colors.black)
        c.drawString(col_x[col], y[0], f"{label}:")
        c.setFont("Helvetica-Bold", 7)
        c.drawString(val_x[col], y[0], val)
    y[0] -= 10

    # SIGN SCHEDULE — 3-column table (#, CODE, DESCRIPTION)
    if schedule_order:
        section_header("SIGN SCHEDULE")
        column_header("#", x)
        column_header("CODE", x + 18)
        column_header("DESCRIPTION", x + 80)
        y[0] -= 4
        c.setStrokeColor(colors.HexColor("#CCCCCC"))
        c.setLineWidth(0.3)
        c.line(x, y[0], x_right, y[0])
        y[0] -= 8
        for i, code in enumerate(schedule_order, start=1):
            desc = description_for(code)
            # Substitute parametric placeholders.  G20-1 BEGIN ROAD WORK
            # carries the work-zone length on its face ("ROAD CONSTRUCTION
            # NEXT N FT"); rendering the literal "XXX" template leaks an
            # unsubstituted placeholder onto the sheet.
            if code == "G20-1":
                desc = desc.replace("XXX", f"{params.work_zone_length_ft:.0f}")
            c.setFillColor(colors.black)
            c.setFont("Helvetica", 7)
            c.drawString(x, y[0], str(i))
            c.setFont("Helvetica-Bold", 7)
            c.drawString(x + 18, y[0], code)
            c.setFont("Helvetica", 7)
            c.drawString(x + 80, y[0], desc)
            y[0] -= 9

    # ADVANCE WARNING SIGNS — 3-column table (CODE, DESCRIPTION, DISTANCE)
    if is_mobile or is_off_road:
        advance_section_title = "ADVANCE WARNING SIGNS (upstream of work area)"
    else:
        advance_section_title = "ADVANCE WARNING SIGNS (off-page upstream of taper)"
    section_header(advance_section_title)
    column_header("CODE", x)
    column_header("DESCRIPTION", x + 60)
    column_header("DISTANCE", x_right, align="right")
    y[0] -= 4
    c.setStrokeColor(colors.HexColor("#CCCCCC"))
    c.setLineWidth(0.3)
    c.line(x, y[0], x_right, y[0])
    y[0] -= 8
    for code, desc, dist in advance:
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(x, y[0], code)
        c.setFont("Helvetica", 7)
        c.drawString(x + 60, y[0], desc)
        c.drawRightString(x_right, y[0], f"{dist:.0f} ft")
        y[0] -= 9

    y[0] -= 4
    c.setFont("Helvetica-Oblique", 6.5)
    c.setFillColor(colors.HexColor("#666666"))
    c.drawString(
        x,
        y[0],
        (
            "Reference: CDOT S-630-1, MUTCD 11th Ed. Part 6 "
            "(effective 2026-01-18), Colorado Supplement."
        ),
    )
    y[0] -= 8
    c.setFont("Helvetica-Bold", 6.5)
    c.setFillColor(colors.HexColor("#B05010"))
    c.drawString(
        x,
        y[0],
        "GENERATED BY CONESTRUCT — DRAFT FOR PE REVIEW. NOT A SEALED PLAN.",
    )
    y[0] -= 8
    c.setFont("Helvetica-Oblique", 6.5)
    c.setFillColor(colors.HexColor("#666666"))
    c.drawString(x, y[0], "Verify all dimensions before use.")


# ---------------------------------------------------------------------------
# Mapbox aerial embed (optional)
# ---------------------------------------------------------------------------


def _fetch_mapbox_aerial(lat: float, lng: float, token: str) -> Path | None:
    """Fetch a Mapbox satellite tile centered on (lat, lng).  Returns the
    path to a temporary PNG, or ``None`` if the call fails for any reason
    (network error, bad token, rate limit).  Errors are logged to stdout
    rather than raised — the aerial is an optional enhancement, not a
    required component of the plan sheet.
    """
    url = f"https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/{lng},{lat},16,0/400x300@2x"
    try:
        r = httpx.get(url, params={"access_token": token}, timeout=15.0)
        r.raise_for_status()
        fd, tmp_path = tempfile.mkstemp(suffix=".png", prefix="mht_aerial_")
        with os.fdopen(fd, "wb") as f:
            f.write(r.content)
        return Path(tmp_path)
    except Exception as exc:  # noqa: BLE001
        print(f"[mapbox] static image fetch failed: {type(exc).__name__}: {exc}")
        return None


def _draw_aerial_embed(
    c: canvas.Canvas,
    png_path: Path,
    lat: float,
    lng: float,
    site_address: str,
) -> None:
    img_w, img_h = 216.0, 162.0  # 3" x 2.25"
    img_x = PLAN_RIGHT - 8.0 - img_w
    img_y = PLAN_BOTTOM + 14.0  # leaves room for the caption below

    c.drawImage(
        str(png_path),
        img_x,
        img_y,
        width=img_w,
        height=img_h,
        preserveAspectRatio=True,
    )

    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    c.setFillColor(colors.black, alpha=0)
    c.rect(img_x, img_y, img_w, img_h, fill=0, stroke=1)

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 6)
    c.drawString(img_x, img_y + img_h + 4.0, "AERIAL CONTEXT (NOT TO SCALE)")

    caption = f"SITE: {lat:.4f}, {lng:.4f}"
    if site_address:
        caption += f"  ({site_address})"
    c.setFont("Helvetica", 6)
    c.drawString(img_x, img_y - 7.0, caption)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def render_plan_sheet(
    placements: list[DevicePlacement],
    params: ScenarioParams,
    output_path: str = "plan_sheet.pdf",
    title: str = "METHOD OF HANDLING TRAFFIC",
    project_name: str = "",
    sheet_number: str = "1",
    total_sheets: str = "1",
    shoulder_width_ft: float = 10.0,
    site_lat: float | None = None,
    site_lng: float | None = None,
    site_address: str = "",
) -> str:
    """Render a one-sheet schematic MOT plan to ``output_path``.

    Returns the path written.  The horizontal scale is fitted to the
    work-zone-and-taper region so the merging taper is readable;
    advance warning signs are documented in the notes panel.

    Project metadata (``project_name``, location, bearing) is sourced
    from ``params`` when available; the kwarg ``project_name`` is kept
    as a fallback for callers that haven't migrated to passing the
    fields through ScenarioParams.
    """
    # Prefer params-supplied metadata; fall back to the per-call kwargs
    # (or the bare ``site_address`` for the LOCATION row) so older
    # callers continue to work.
    effective_project_name = (
        getattr(params, "project_name", "") or project_name or "Untitled Project"
    )
    if effective_project_name == "Untitled Project" and project_name:
        effective_project_name = project_name
    location_description = getattr(params, "location_description", "") or site_address or ""
    bearing_deg = getattr(params, "bearing_deg", None)

    c = canvas.Canvas(output_path, pagesize=(PAGE_W, PAGE_H))

    mapping = _make_x_mapping(placements, params, shoulder_width_ft)
    x_of = mapping["x_of"]
    pts_per_ft = mapping["pts_per_ft"]
    station_max_visible = mapping["station_max_visible"]
    ft_per_inch = 72.0 / pts_per_ft if pts_per_ft else 0.0
    # Title block carries the bare ratio so it stays compact; the
    # legend's footnote spells out the scale convention (which region
    # the ratio applies to, what got compressed, what got exaggerated).
    scale_short = f'1" = {ft_per_inch:.0f} ft'
    scale_long = (
        f"Scale {scale_short} applies to the work zone + taper. "
        "Buffer compressed; lateral offset exaggerated."
    )

    schedule_order, code_to_num = build_sign_schedule(placements, station_max_visible)

    _draw_road(
        c,
        params.lane_width_ft,
        shoulder_width_ft,
        closure_type=params.closure_type,
        is_divided=params.is_divided,
    )
    _draw_site_context(c, placements, params, x_of, shoulder_width_ft)
    _draw_landmarks(c, params, x_of, shoulder_width_ft)
    # Direction-of-travel indicators sit in the page margin just outside
    # the asphalt — below the work-side shoulder and (when divided) above
    # the opposing shoulder.  Keeps the arrow from fighting taper drums
    # or tangent cones for screen real estate, while staying close enough
    # to the carriageway it describes that the semantics are unambiguous.
    half_lanes = 2 if params.is_divided else 1
    shoulder_outer_offset = half_lanes * params.lane_width_ft + shoulder_width_ft
    arrow_y_work_side = _y_of(shoulder_outer_offset, params.is_divided) - 14.0
    arrow_y_open_side = _y_of(-shoulder_outer_offset, params.is_divided) + 14.0
    arrow_x_left = PLAN_LEFT + 30.0
    arrow_x_right = PLAN_LEFT + 130.0
    _draw_lane_arrow(c, arrow_x_left, arrow_x_right, arrow_y_work_side, pointing_right=True)
    if params.is_divided:
        _draw_lane_arrow(
            c,
            arrow_x_left,
            arrow_x_right,
            arrow_y_open_side,
            pointing_right=False,
        )
    _draw_devices(
        c,
        placements,
        x_of,
        station_max_visible,
        params,
        shoulder_width_ft,
        code_to_num,
    )
    _draw_title_block(
        c, title, effective_project_name, sheet_number, total_sheets, params, scale_short
    )
    _draw_legend(c, placements, is_divided=params.is_divided, scale_note=scale_long)
    _draw_notes(c, params, shoulder_width_ft, schedule_order)
    _draw_structured_title_block(
        c,
        params,
        project_name=effective_project_name,
        location_description=location_description,
        sheet_number=sheet_number,
        total_sheets=total_sheets,
        scale_label=scale_short,
        bearing_deg=bearing_deg,
    )

    # North-arrow rosette: pulled well inside the upper-right corner
    # so it reads as part of the road area instead of hugging the
    # sheet border.  ~60 pt inset from PLAN_RIGHT clears the page
    # frame; ~36 pt below PLAN_TOP gives the dim band above the road
    # room to breathe.
    _draw_north_arrow(
        c,
        x_center=PLAN_RIGHT - 60.0,
        y_center=PLAN_TOP - 36.0,
        bearing_deg=bearing_deg,
    )

    if site_lat is not None and site_lng is not None and (site_lat or site_lng):
        token = os.environ.get("MAPBOX_TOKEN", "")
        if not token:
            print("MAPBOX_TOKEN not set — skipping aerial embed")
        else:
            png = _fetch_mapbox_aerial(site_lat, site_lng, token)
            if png is not None:
                _draw_aerial_embed(c, png, site_lat, site_lng, site_address)

    # Sheet border last so it sits above any device that strays into
    # the page margin (devices clamp inside PLAN_TOP/PLAN_BOTTOM, but
    # belt-and-suspenders for the off-road clamp logic).
    _draw_sheet_border(c)

    c.showPage()
    c.save()
    return output_path


if __name__ == "__main__":
    import os
    from collections import Counter

    from src.generation.layout import generate_shoulder_closure_divided
    from src.rules.site_adjustments import apply_site_adjustments

    # Reproduce the user's scenario from the screenshot:
    # rural divided, 2 lanes/dir, 12 ft lanes, 200 ft work zone, 65 mph.
    # The visible labels (M4-9a, R9-9, the floating W20-1) imply the
    # bicycle, pedestrian, and adjacent-intersection flags were on, so
    # we mirror those here to stress the new label-placement logic.
    params = ScenarioParams(
        speed_mph=65,
        num_lanes=2,
        closure_type="shoulder",
        road_type="rural",
        work_zone_length_ft=200.0,
        lane_width_ft=12.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    baseline = generate_shoulder_closure_divided(params)
    placements, audit = apply_site_adjustments(
        baseline,
        params,
        flags={
            "adjacent_intersection": True,
            "pedestrian_facility": True,
            "bicycle_facility": True,
        },
    )
    out = render_plan_sheet(placements, params, "test_plan_v12.pdf")

    size_bytes = os.path.getsize(out)
    print(f"Wrote {out} ({size_bytes} bytes)")
    print(
        f"Devices placed: {len(placements)} (baseline {len(baseline)} + "
        f"adjustments {len(placements) - len(baseline)})"
    )
    counts = Counter(p.device_type for p in placements)
    for dt, n in sorted(counts.items(), key=lambda kv: kv[0].value):
        print(f"  {dt.value:25s} {n}")
    print()
    print("Site adjustments applied:")
    for rec in audit:
        print(f"  - {rec['flag']}: {rec['action']}")
    print()
    print("Open test_plan_v12.pdf to visually inspect.")
