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
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from urllib.parse import quote as urllib_quote

import httpx
from reportlab.lib import colors
from reportlab.pdfgen import canvas

from src._dotenv import load_dotenv
from src.rules.corridor import M_PER_FT, WorkCorridor, build_corridor, encode_polyline
from src.rules.devices import DeviceType, cone_display_name
from src.rules.sign_codes import PLAQUE_CODES, schedule_key, substitute_sign_description
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    one_lane_two_way_taper_length,
    shoulder_taper_length,
    taper_length,
)
from src.rules.validators import (
    DevicePlacement,
    ScenarioParams,
    _is_flagger_scenario,
    scenario_display_name,
    scenario_display_name_short,
    shoulder_ta_reference,
)

load_dotenv()


def _required_taper_length(params: ScenarioParams, shoulder_width_ft: float) -> float:
    """Plan-side taper length used for fitting the scale and dimension callouts.

    Flagger alternating-flow closures use the one-lane two-way taper
    (§6B.08 ¶14, PR 2 geometry correction); other lane closures use the
    full merging taper L (MUTCD §6B.08); shoulder closures use L/3
    (§6B.08).  Mirrors the branching in ``src.generation.layout`` so
    the rendered plan view fits whichever layout the engine produced.
    """
    if _is_flagger_scenario(params):
        return one_lane_two_way_taper_length()
    if params.closure_type == "lane":
        return taper_length(params.speed_mph, params.lane_width_ft)
    return shoulder_taper_length(params.speed_mph, shoulder_width_ft)


def _road_y_extent(params: ScenarioParams, shoulder_width_ft: float) -> tuple[float, float]:
    """Return (y_road_top, y_road_bottom) on the page for the rendered road.

    Both directions are drawn with ``params.num_lanes`` lanes; divided
    highways separate them with a visible median band of ``MEDIAN_PTS``
    height, undivided highways with a yellow centerline.
    """
    lane_h = params.lane_width_ft * PTS_PER_OFFSET_FT
    shoulder_h = shoulder_width_ft * PTS_PER_OFFSET_FT
    half_road = params.num_lanes * lane_h + shoulder_h
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

    The buffer region carries no devices (MUTCD §6B.08) so it dominates
    page width without earning any.  We compress it to a fixed visual
    length (``BUFFER_VISUAL_FT``) marked with a // scale break, freeing
    width for the work zone and taper where every device lives.

    Returns a dict with:
      - ``x_of(station_ft)`` callable, raw stations in, page x out
      - ``pts_per_ft`` for the scale label in the title block (work-zone
        scale, since that is the region a reader will measure off)
      - ``taper_start_station`` upstream end of the taper (raw station),
        the off-page table's distance origin
      - ``station_max_visible`` for clipping advance-warning signs
      - ``buffer_break_x`` page x where the scale-break marks belong

    ``taper_start_station`` / ``station_max_visible`` are computed here
    and only here (D-02) — ``_draw_notes`` and every other consumer
    thread them from this mapping so the on-page/off-page partition
    cannot drift between the schematic and the notes table.
    """
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft
    taper_len = _required_taper_length(params, shoulder_width_ft)
    buf_len = buffer_space(
        speed, jurisdiction=params.jurisdiction, work_zone_speed_mph=params.work_zone_speed_mph
    )
    taper_start_station = wz_len + buf_len + taper_len

    def effective(s: float) -> float:
        if s <= wz_len:
            return s
        if s <= wz_len + buf_len:
            t = (s - wz_len) / buf_len
            return wz_len + t * BUFFER_VISUAL_FT
        return s - buf_len + BUFFER_VISUAL_FT

    eff_min = min(effective(p.station_ft) for p in placements) - 50.0
    eff_taper_start = effective(taper_start_station)
    eff_max = eff_taper_start + 100.0

    pts_per_ft = (PLAN_RIGHT - PLAN_LEFT) / (eff_max - eff_min)

    def x_of(s: float) -> float:
        return PLAN_LEFT + (eff_max - effective(s)) * pts_per_ft

    buffer_mid_station = wz_len + buf_len / 2.0
    buffer_break_x = x_of(buffer_mid_station)

    # Stations above this raw-station threshold (the advance warning signs)
    # land outside the plan view and get filtered out before drawing;
    # everything above it appears in the NOTES table instead.
    station_max_visible = taper_start_station + 50.0

    return {
        "x_of": x_of,
        "pts_per_ft": pts_per_ft,
        "taper_start_station": taper_start_station,
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
    num_lanes: int = 2,
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
    half_lanes = num_lanes  # lanes per direction, drawn symmetrically
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
        # Undivided road: ``num_lanes`` lanes each direction with a yellow
        # centerline.  No median gap; for a lane closure the outer
        # work-side lane is painted pink to flag it.
        c.setFillColor(SHOULDER_OPEN_FILL)
        c.rect(x_left, y_closed_shldr_outer, width, shoulder_h, fill=1, stroke=0)
        c.rect(x_left, y_open_lane_inner, width, shoulder_h, fill=1, stroke=0)

        if is_lane_closure:
            c.setFillColor(SHOULDER_CLOSED_FILL)
            c.rect(x_left, y_closed_lane_outer, width, lane_h, fill=1, stroke=0)
            if half_lanes > 1:
                c.setFillColor(LANE_FILL)
                c.rect(
                    x_left,
                    y_closed_lane_outer + lane_h,
                    width,
                    (half_lanes - 1) * lane_h,
                    fill=1,
                    stroke=0,
                )
        else:
            c.setFillColor(LANE_FILL)
            c.rect(x_left, y_closed_lane_outer, width, half_lanes * lane_h, fill=1, stroke=0)
        c.setFillColor(LANE_FILL)
        c.rect(x_left, y_center, width, half_lanes * lane_h, fill=1, stroke=0)

        # Yellow dashed centerline (no-passing in a real work zone, but
        # dashed reads cleaner on the schematic).
        c.setStrokeColor(MEDIAN_EDGE)
        c.setLineWidth(2.0)
        c.setDash(12, 8)
        c.line(x_left, y_center, x_right, y_center)
        c.setDash()

        # Lane stripes between same-direction lanes (white dashed, 2 pt).
        if half_lanes > 1:
            c.setStrokeColor(EDGE_LINE)
            c.setLineWidth(2.0)
            c.setDash(12, 8)
            for i in range(1, half_lanes):
                c.line(x_left, y_center - i * lane_h, x_right, y_center - i * lane_h)
                c.line(x_left, y_center + i * lane_h, x_right, y_center + i * lane_h)
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
        # Inner (open) lane(s) on the closed-side carriageway, butting
        # against the median.
        c.setFillColor(LANE_FILL)
        c.rect(
            x_left,
            y_closed_lane_outer + lane_h,
            width,
            (half_lanes - 1) * lane_h,
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

    # Lane stripes between same-direction lanes (white dashed, 2 pt) at
    # ±i·lane_width_ft for each interior lane boundary.
    c.setLineWidth(2.0)
    c.setDash(12, 8)
    for i in range(1, half_lanes):
        c.line(x_left, _y_of(i * lane_width_ft, True), x_right, _y_of(i * lane_width_ft, True))
        c.line(x_left, _y_of(-i * lane_width_ft, True), x_right, _y_of(-i * lane_width_ft, True))
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


# Amber/yellow used for steady-burn warning lights and the rays of the
# portable light plant.  Distinct from DRUM_ORANGE so the eye reads
# "light" rather than "another channelizing device".
WARNING_LIGHT_AMBER = colors.HexColor("#FFC800")


def _draw_warning_light(c: canvas.Canvas, x: float, y: float) -> None:
    """Type C steady-burn warning light — small amber disk perched atop a drum.

    Co-located with the drum's (x, y) at the same station/offset.  The
    glyph offsets ~7 pt above the centerline so the disk sits on the
    drum's top edge rather than being hidden behind the drum body.  A
    thin black rim plus a soft halo make it readable on the page even
    when the drum's orange overlaps.
    """
    cx = x
    cy = y + 8.0  # perch on top of the 14pt-tall drum (half-height = 7pt)
    _draw_warning_light_disc(c, cx, cy)


def _draw_warning_light_legend(c: canvas.Canvas, x: float, y: float) -> None:
    """Centered legend variant of the warning light — no perch offset.

    The on-plan glyph self-offsets +8pt so it sits on top of its host
    drum.  In the LEGEND box that offset would push the bulb into the
    row above; the legend variant draws the same disc centered on
    (x, y) so it stays inside its own row.
    """
    _draw_warning_light_disc(c, x, y)


def _draw_warning_light_disc(c: canvas.Canvas, cx: float, cy: float) -> None:
    """Shared disc renderer used by both on-plan and legend variants."""
    r = 1.7
    # Soft halo so the disk reads as a glow, not a solid dot.
    c.setFillColor(colors.HexColor("#FFE680"))
    c.setStrokeColor(colors.HexColor("#FFE680"))
    c.setLineWidth(0.3)
    c.circle(cx, cy, r + 1.6, stroke=1, fill=1)
    # Amber bulb itself with a thin dark rim.
    c.setFillColor(WARNING_LIGHT_AMBER)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.4)
    c.circle(cx, cy, r, stroke=1, fill=1)


def _draw_light_plant(c: canvas.Canvas, x: float, y: float) -> None:
    """Portable light plant — small upright tower with rays emanating.

    Visually prominent so it doesn't read as another channelizer; this
    is one of the most expensive items on the BOM and the operator
    should be able to spot it on the plan view at a glance.
    """
    # Trailer base (wide, low rectangle in dark gray).
    base_w, base_h = 12.0, 3.0
    c.setFillColor(colors.HexColor("#5A5A5A"))
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    c.rect(x - base_w / 2, y - 9.0, base_w, base_h, fill=1, stroke=1)

    # Mast (vertical line from trailer up to lamp head).
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.8)
    c.line(x, y - 6.0, x, y + 4.0)

    # Lamp head (yellow rectangle with black border at the top of the mast).
    head_w, head_h = 8.0, 4.0
    head_y = y + 4.0
    c.setFillColor(WARNING_LIGHT_AMBER)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    c.rect(x - head_w / 2, head_y, head_w, head_h, fill=1, stroke=1)

    # Rays — six short amber strokes radiating from the lamp head.
    import math as _math

    c.setStrokeColor(WARNING_LIGHT_AMBER)
    c.setLineWidth(0.7)
    cx = x
    cy = head_y + head_h / 2.0
    inner_r = 5.5
    outer_r = 8.5
    for deg in (-60, -30, 0, 30, 60, 90):
        rad = _math.radians(deg)
        x1 = cx + inner_r * _math.cos(rad)
        y1 = cy + inner_r * _math.sin(rad)
        x2 = cx + outer_r * _math.cos(rad)
        y2 = cy + outer_r * _math.sin(rad)
        c.line(x1, y1, x2, y2)


def _draw_light_plant_legend(c: canvas.Canvas, x: float, y: float) -> None:
    """Compact legend variant of the light plant — fits a 14-pt legend row.

    Same idea (trailer + mast + lamp head + rays) but scaled down to
    sit inside one row of the LEGEND box without colliding with the
    next entry.  The on-plan glyph stays full-size; only the legend
    representation shrinks.
    """
    import math as _math

    # Trailer base.
    base_w, base_h = 7.0, 1.6
    c.setFillColor(colors.HexColor("#5A5A5A"))
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.4)
    c.rect(x - base_w / 2, y - 4.5, base_w, base_h, fill=1, stroke=1)

    # Mast.
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.line(x, y - 3.0, x, y + 1.5)

    # Lamp head.
    head_w, head_h = 4.5, 2.0
    head_y = y + 1.5
    c.setFillColor(WARNING_LIGHT_AMBER)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.4)
    c.rect(x - head_w / 2, head_y, head_w, head_h, fill=1, stroke=1)

    # Three short rays (top half only — keeps the glyph inside the row).
    c.setStrokeColor(WARNING_LIGHT_AMBER)
    c.setLineWidth(0.5)
    cx = x
    cy = head_y + head_h / 2.0
    inner_r = 3.0
    outer_r = 4.5
    for deg in (-40, 0, 40):
        rad = _math.radians(deg + 90.0)  # rotate so 0 deg points up
        x1 = cx + inner_r * _math.cos(rad)
        y1 = cy + inner_r * _math.sin(rad)
        x2 = cx + outer_r * _math.cos(rad)
        y2 = cy + outer_r * _math.sin(rad)
        c.line(x1, y1, x2, y2)


# Legend-only glyph overrides.  Devices in this dict draw a smaller
# variant in the LEGEND box; on the plan view the regular glyph from
# ``_DEVICE_GLYPHS`` is still used.  Falls back to ``_DEVICE_GLYPHS``
# when a device isn't listed here.
_DEVICE_LEGEND_GLYPHS: dict[DeviceType, Callable[[canvas.Canvas, float, float], None]] = {
    DeviceType.PORTABLE_LIGHT_PLANT: _draw_light_plant_legend,
    DeviceType.WARNING_LIGHT_TYPE_C: _draw_warning_light_legend,
}


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
    DeviceType.WARNING_LIGHT_TYPE_C: _draw_warning_light,
    DeviceType.PORTABLE_LIGHT_PLANT: _draw_light_plant,
}

_DEVICE_DISPLAY_NAMES: dict[DeviceType, str] = {
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
    DeviceType.WARNING_LIGHT_TYPE_C: "Type C Warning Light (steady)",
    DeviceType.PORTABLE_LIGHT_PLANT: "Portable Light Plant",
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
    base = params.num_lanes * params.lane_width_ft + shoulder_width_ft
    if has_sidewalk:
        return base + 6.0  # sidewalk outer edge + small margin
    return base


def _is_median_sign(p: DevicePlacement, params: ScenarioParams, on_road_max: float) -> bool:
    """True when a sign is a divided-highway median-side mirror copy that
    gets snapped into the median band (see _draw_devices).  Negative
    offset within the on-road threshold means the §6C.04(A) mirror that
    would otherwise draw in the opposing carriageway's lanes."""
    return (
        params.is_divided
        and p.device_type == DeviceType.SIGN_GENERIC
        and p.offset_ft < 0
        and abs(p.offset_ft) <= on_road_max + 4.0
    )


def _sign_y_bands(params: ScenarioParams, shoulder_width_ft: float) -> dict[str, float]:
    """Legal page-y bands for SIGN_GENERIC glyphs on a divided highway.

    A sign must render either in the work-side band (the work shoulder
    plus the margin strip just outside it, where stacked callouts spill)
    or in the median band — never on the work-side travel lanes, the
    opposing carriageway's lanes, or its shoulder.  ``work_shoulder_top``
    is the work-side lane/shoulder boundary (signs must stay below it to
    avoid the work-side travel lanes); ``work_floor`` is the page-edge
    floor below the road.  Median edges follow the drawn ``MEDIAN_PTS``
    strip centred on ``PLAN_Y_CENTER``.
    """
    half_med = MEDIAN_PTS / 2.0
    return {
        "median_lo": PLAN_Y_CENTER - half_med,
        "median_hi": PLAN_Y_CENTER + half_med,
        "work_shoulder_top": _y_of(params.num_lanes * params.lane_width_ft, params.is_divided),
        "work_floor": PLAN_BOTTOM,
    }


CALLOUT_RADIUS = 5.0  # circled-number callout radius
CALLOUT_NUMBER_FONT_SIZE = 7

SIDEWALK_FILL = colors.HexColor("#DCDCDC")
SIDEWALK_BORDER = colors.HexColor("#888888")
BIKE_LANE_FILL = colors.HexColor("#DAEDC7")
BIKE_LANE_BORDER = colors.HexColor("#7AAA50")
HATCH_GRAY = colors.HexColor("#5A5A5A")
SCHOOL_FILL = colors.HexColor("#FFE89D")

# Schematic facility strips (ft), derived from the road geometry so they
# track the lane count (multi-lane wire-through).  Sized so the
# site_adjustments device offsets sit roughly centered on their strips:
# the bike strip straddles M4-9a (lane edge + 4) and the sidewalk strip
# straddles R9-9 (road edge + 2).  At the classic 2x12 ft + 10 ft
# shoulder geometry these reproduce the original fixed strips
# (bike 25..31, sidewalk 33..39) exactly.


def _bike_strip_ft(params: ScenarioParams) -> tuple[float, float]:
    lane_edge = params.num_lanes * params.lane_width_ft
    return lane_edge + 1.0, lane_edge + 7.0


def _sidewalk_strip_ft(params: ScenarioParams, shoulder_width_ft: float) -> tuple[float, float]:
    road_edge = params.num_lanes * params.lane_width_ft + shoulder_width_ft
    return road_edge - 1.0, road_edge + 5.0


# Site-condition flags the renderer draws context for.  Structured input
# (Refs #121): callers pass the authoritative flag dict instead of the
# retired label-scan inference, which reconstructed these by scanning
# placement labels/offsets and false-triggered on any W20-1 beyond the
# road edge — a hard blocker for real intersection devices (#117).
# ``adjacent_interchange`` is deliberately absent: it has never driven
# any drawn context, and adding it is a visible value change (rule #5).
_SITE_FLAG_KEYS: tuple[str, ...] = (
    "pedestrian_facility",
    "bicycle_facility",
    "adjacent_intersection",
    "school_zone",
)


def _resolve_site_flags(site_flags: Mapping[str, bool] | None) -> dict[str, bool]:
    """Normalize a caller-supplied site-flag mapping to the drawable set.

    ``None`` (the default for every ``site_flags`` parameter in this
    module) means all-off — accepted as a deliberate tradeoff so
    flag-free callers (tests, dev scripts) stay untouched.  Any future
    call site that renders a scenario which can carry site conditions
    MUST pass the real flags; omitting them silently drops the site
    context from the sheet.  Unknown keys are ignored.
    """
    if not site_flags:
        return {key: False for key in _SITE_FLAG_KEYS}
    return {key: bool(site_flags.get(key)) for key in _SITE_FLAG_KEYS}


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
    params: ScenarioParams,
    x_of: Callable[[float], float],
    shoulder_width_ft: float,
    site_flags: Mapping[str, bool] | None,
) -> None:
    """Schematic context features driven by the active site flags.

    Drawing order (back to front): sidewalk → bike lane → cross-street
    stub → school marker.  Each strip is hatched within the work-zone
    span to indicate closure; the cross-street stub overlays sidewalk
    and bike lane at the intersection point so the strips appear to
    break for the cross street.
    """
    flags = _resolve_site_flags(site_flags)
    if not any(flags.values()):
        return

    wz_len = params.work_zone_length_ft
    wz_x_left = x_of(wz_len)
    wz_x_right = x_of(0.0)

    sides = (1, -1) if params.is_divided else (1,)

    sidewalk_inner_ft, sidewalk_outer_ft = _sidewalk_strip_ft(params, shoulder_width_ft)
    bike_inner_ft, bike_outer_ft = _bike_strip_ft(params)

    if flags["pedestrian_facility"]:
        for side in sides:
            y_low, y_high = _strip_y_range(
                sidewalk_inner_ft, sidewalk_outer_ft, side, params.is_divided
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
            sidewalk_inner_ft, sidewalk_outer_ft, 1, params.is_divided
        )
        c.drawString(PLAN_LEFT + 4, (y_low_w + y_high_w) / 2 - 2, "SIDEWALK")

    if flags["bicycle_facility"]:
        for side in sides:
            y_low, y_high = _strip_y_range(bike_inner_ft, bike_outer_ft, side, params.is_divided)
            _draw_strip(c, PLAN_LEFT, PLAN_RIGHT, y_low, y_high, BIKE_LANE_FILL, BIKE_LANE_BORDER)
            if side == 1:
                _draw_diagonal_hatch(c, wz_x_left, wz_x_right, y_low, y_high)
        c.setFillColor(colors.HexColor("#3F6020"))
        c.setFont("Helvetica-Oblique", 6)
        y_low_b, y_high_b = _strip_y_range(bike_inner_ft, bike_outer_ft, 1, params.is_divided)
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
        buf_len = buffer_space(
            params.speed_mph,
            jurisdiction=params.jurisdiction,
            work_zone_speed_mph=params.work_zone_speed_mph,
        )
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


def _schedule_key(p: DevicePlacement) -> str:
    """Schedule-grouping key for a sign placement.

    Delegates to :func:`src.rules.sign_codes.schedule_key` — the shared
    convention (bare MUTCD code, except R2-1 which splits into
    entrance/restoration faces by station sign) lives there so the XLSX
    device list and UI device breakdown aggregate on the same key the
    PDF schedule uses.
    """
    return schedule_key(p.label, p.station_ft)


def build_sign_schedule(
    placements: list[DevicePlacement],
    station_max_visible: float,
) -> tuple[list[str], dict[str, int]]:
    """Assign a stable callout number to each unique sign visible on the
    plan view.  Numbering follows the order drivers encounter the signs
    (upstream → downstream, then left → right of road).

    Returns ``(ordered_keys, key_to_number)``.  ``key_to_number`` maps
    each schedule key (see ``_schedule_key`` — the MUTCD code, except
    R2-1 which splits into entrance/restoration variants) to its 1-based
    callout number; ``ordered_keys`` lists the keys in numbering order so
    the Sign Schedule panel can be rendered.  Mirror pairs (same key on
    both sides of the road) share a number, as before.
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
        key = _schedule_key(p)
        if key not in seen:
            seen.add(key)
            order.append(key)
    return order, {key: i + 1 for i, key in enumerate(order)}


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


def _deoverlap_median_horizontal(
    items: list[tuple[DevicePlacement, float, float]],
    dx_grid: float = 6.0,
    step: float = SIGN_BOX_W,
) -> list[tuple[DevicePlacement, float, float]]:
    """Spread co-located median-band signs along X (station axis).

    Median-side mirror signs are all snapped to a single y line
    (``PLAN_Y_CENTER``) inside an 18 pt band.  That band is far too thin
    for the vertical de-overlap used elsewhere — a single vertical push
    lands a sign in a travel lane (work side below, opposing side above).
    So co-located median signs fan horizontally instead, staying on the
    median line.  Signs are grouped by page-x; each group is spread
    symmetrically about its shared x by ``step`` so the glyphs no longer
    sit on top of one another.  y is left untouched.
    """
    from collections import defaultdict

    groups: dict[int, list[int]] = defaultdict(list)
    for i, (_p, x, _y) in enumerate(items):
        groups[round(x / dx_grid)].append(i)

    out = list(items)
    for indices in groups.values():
        n = len(indices)
        if n <= 1:
            continue
        # Stable, deterministic order so callout/glyph assignment is
        # reproducible across runs.
        indices.sort(key=lambda i: (items[i][0].label or "", items[i][0].station_ft))
        for j, idx in enumerate(indices):
            p, x, y = items[idx]
            out[idx] = (p, x + (j - (n - 1) / 2.0) * step, y)
    return out


def _clamp_sign_positions(
    items: list[tuple[DevicePlacement, float, float]],
    params: ScenarioParams,
    on_road_max: float,
    bands: dict[str, float],
) -> list[tuple[DevicePlacement, float, float]]:
    """Defensive backstop: clamp every SIGN_GENERIC glyph into a legal
    band so no sign can render on a travel lane or in the opposing
    carriageway, regardless of how the de-overlap passes moved it.

    Scoped to divided highways, where the two-carriageway geometry makes
    misplacement possible.  Median signs clamp to the median band;
    work-side signs (positive offset) clamp between the page floor and the
    work-side lane/shoulder boundary.  Snap-to-boundary keeps output
    visible rather than dropping or erroring.
    """
    if not params.is_divided:
        return items
    out: list[tuple[DevicePlacement, float, float]] = []
    for p, x, y in items:
        if p.device_type == DeviceType.SIGN_GENERIC:
            if _is_median_sign(p, params, on_road_max):
                y = min(max(y, bands["median_lo"]), bands["median_hi"])
            elif p.offset_ft > 0:
                y = min(max(y, bands["work_floor"]), bands["work_shoulder_top"])
        out.append((p, x, y))
    return out


def _layout_device_positions(
    placements: list[DevicePlacement],
    x_of: Callable[[float], float],
    station_max_visible: float,
    params: ScenarioParams,
    shoulder_width_ft: float,
    site_flags: Mapping[str, bool] | None = None,
) -> tuple[
    list[tuple[DevicePlacement, float, float]],
    list[tuple[DevicePlacement, float, float]],
]:
    """Resolve every visible device to a final (placement, x, y) on the
    plan view: offset→page mapping, median snap, de-overlap, and the
    legal-band clamp.  Pure geometry, no drawing — shared by
    ``_draw_devices`` and the sign-band regression test so the two cannot
    drift.  Returns ``(items, lighting_items)``.

    ``site_flags`` defaults to ``None`` (all-off) so flag-free callers
    stay untouched; callers rendering a scenario with site conditions
    must pass the real flags (see ``_resolve_site_flags``).
    """
    flags = _resolve_site_flags(site_flags)
    on_road_max = _on_road_max_offset_ft(
        params, shoulder_width_ft, has_sidewalk=flags["pedestrian_facility"]
    )
    y_road_top, y_road_bottom = _road_y_extent(params, shoulder_width_ft)
    bands = _sign_y_bands(params, shoulder_width_ft)

    clampable_types = (
        DeviceType.SIGN_GENERIC,
        DeviceType.BARRICADE_TYPE_III,
        DeviceType.BARRICADE_TYPE_II,
    )
    lighting_types = (
        DeviceType.WARNING_LIGHT_TYPE_C,
        DeviceType.PORTABLE_LIGHT_PLANT,
    )

    items: list[tuple[DevicePlacement, float, float]] = []
    median_items: list[tuple[DevicePlacement, float, float]] = []
    lighting_items: list[tuple[DevicePlacement, float, float]] = []
    for p in placements:
        if p.station_ft > station_max_visible:
            continue
        x = x_of(p.station_ft)
        if _is_median_sign(p, params, on_road_max):
            # Median-side mirror — snap to the median line; fanned along X
            # below (the band is too thin to fan vertically).
            median_items.append((p, x, PLAN_Y_CENTER))
            continue
        if p.device_type in clampable_types and abs(p.offset_ft) > on_road_max:
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
        if p.device_type in lighting_types:
            lighting_items.append((p, x, y))
        else:
            items.append((p, x, y))

    # Work-side and other signs de-overlap vertically; median signs fan
    # horizontally on their band line.
    items = _deoverlap_items(items)
    items = _deoverlap_signs_pairwise(items)
    median_items = _deoverlap_median_horizontal(median_items)

    items = _clamp_sign_positions(items + median_items, params, on_road_max, bands)
    return items, lighting_items


# ---------------------------------------------------------------------------
# Rendering convention: on-page glyphs vs off-page notes
# ---------------------------------------------------------------------------
# Per CDOT S-630-1 typical-sheet convention, only devices within the work
# zone + buffer + taper + 50 ft of padding (station_ft <= station_max_visible)
# render as glyphs on the schematic.  Upstream advance-warning signs
# (W21-5aR, W20-1, W20-2, W5-1, W16-2a, W7-3a, W3-5, etc.) sit 500-5000+ ft
# from the taper — too far to depict to scale alongside the work zone — and
# are documented textually in the NOTES ADVANCE WARNING SIGNS table instead
# (see _build_advance_warning_table).
#
# Mirroring on divided highways: every sign emitted by the layout engine is
# paired (positive offset_ft on the work-side shoulder, negative offset_ft
# on the median side) per CO Supplement §6C.04(A).  Both placements render
# on the on-page schematic (see _layout_device_positions): positive-offset
# signs land in the work-side shoulder band (lower y) and de-overlap
# vertically; negative-offset signs snap to the median band
# (y = PLAN_Y_CENTER) and de-overlap horizontally, because the 18 pt median
# band is too thin to fan vertically without spilling into a travel lane.
# Median callouts are suppressed (the work-side mirror carries the shared
# number); a final clamp keeps every sign off the travel lanes and out of
# the opposing carriageway.  The notes table dedupes the left/right pair
# into a single row per (code, station) — mirroring is implicit on divided,
# and the XLSX device list is authoritative for the count.
# ---------------------------------------------------------------------------


def _draw_devices(
    c: canvas.Canvas,
    placements: list[DevicePlacement],
    x_of: Callable[[float], float],
    station_max_visible: float,
    params: ScenarioParams,
    shoulder_width_ft: float,
    code_to_num: dict[str, int],
    site_flags: Mapping[str, bool] | None = None,
) -> None:
    """Three-pass render: leaders behind, glyphs above, numbered callouts on top.

    Each labeled sign gets a tiny circled-number callout in the strip
    just outside the road; the number keys into the Sign Schedule
    panel for the MUTCD code and meaning.  This replaces inline code
    text (W20-1 / R9-9 / M4-9a / …) that piles up unreadably when
    several signs share a station, e.g. at the work-zone ends after
    pedestrian-/bicycle-/intersection adjustments.

    Position resolution (offset→page mapping, median snap, de-overlap,
    legal-band clamp) lives in ``_layout_device_positions`` so it can be
    asserted by the sign-band regression test without rendering a PDF.
    """
    flags = _resolve_site_flags(site_flags)
    on_road_max = _on_road_max_offset_ft(
        params, shoulder_width_ft, has_sidewalk=flags["pedestrian_facility"]
    )
    items, lighting_items = _layout_device_positions(
        placements, x_of, station_max_visible, params, shoulder_width_ft, site_flags
    )

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
    # Median-side mirror signs are skipped: the median band is too thin to
    # hold a callout without poking into the opposing carriageway, and the
    # work-side mirror already carries the same number (mirror pairs share
    # a schedule key, so the reader loses nothing).
    inline_offset = 11.0
    for p, x, y in items:
        if p.device_type != DeviceType.SIGN_GENERIC or not p.label:
            continue
        if _is_median_sign(p, params, on_road_max):
            continue
        n = code_to_num.get(_schedule_key(p))
        if n is None:
            continue
        cy = y - inline_offset if p.offset_ft >= 0 else y + inline_offset
        _draw_callout_circle(c, x, cy, n)

    # Pass 3: lighting decorations on top of everything else.  Each
    # glyph self-positions relative to (x, y) so warning lights perch
    # above their host drum and light plants render with their tower
    # geometry intact.
    for p, x, y in lighting_items:
        glyph = _DEVICE_GLYPHS.get(p.device_type, _draw_sign)
        glyph(c, x, y)


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
    buf_len = buffer_space(
        params.speed_mph,
        jurisdiction=params.jurisdiction,
        work_zone_speed_mph=params.work_zone_speed_mph,
    )
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
    the project_name field is left empty.

    Uppercase view of the canonical ``scenario_display_name`` (UX-11) so
    the title-block banner stays byte-identical to its pre-UX-11 form
    while the secondary surfaces share the same Title-Case source.
    """
    return scenario_display_name(params).upper()


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
        # Road-type-aware (Refs #100): TA-3 generally, TA-5 on a freeway.
        # Shared with the audit summary via the single rules-layer helper.
        return shoulder_ta_reference(params.road_type)
    if params.closure_type == "lane" and not params.is_divided:
        return "TA-10"
    if params.closure_type == "lane" and params.is_divided:
        return "TA-19"
    if params.closure_type == "mobile":
        return "TA-35"
    return "—"


def _cdot_standard_reference(params: ScenarioParams) -> str:
    """CDOT M&S Standard Plan number for the scenario.  S-630-1 covers
    shoulder closures AND the 2-lane flagger lane closure (PR 3
    correction: the validated flagger fixtures come from S-630-1
    Sheet 9 Case 17 / Sheet 25 Case 42 — the earlier "S-630-2" value
    referenced a CDOT safety standard this layout was never verified
    against).  S-630-3 covers divided-highway lane closures
    (UNVERIFIED — triages with that scenario's enablement).  Mobile and
    off-road operations don't have a dedicated standard plan."""
    if params.closure_type == "shoulder" or params.closure_type == "off_road":
        return "S-630-1"
    if params.closure_type == "lane" and not params.is_divided:
        return "S-630-1"
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
    aerial_page: str | None = None,
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
    ORIENTATION row in the STANDARDS section so reviewers see that the
    site bearing wasn't supplied; when bearing is set the row is
    omitted (the geographic direction is conveyed by page 2's aerial).
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
                *([("AERIAL", f"See page {aerial_page}")] if aerial_page else []),
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


def _draw_aerial_north_arrow(
    c: canvas.Canvas,
    x_center: float,
    y_center: float,
) -> None:
    """Minimal north-arrow indicator for the page-2 aerial image.

    Mapbox Static Images render with north oriented up, so no rotation
    is needed.  A thin-bordered white plate sits behind the symbol so
    the arrow stays legible against satellite imagery.  We deliberately
    omit the schematic page's right-pointing "Direction of travel"
    sub-arrow: travel direction on a north-up satellite depends on the
    bearing and is already conveyed by the orange work-zone overlay.
    """
    arrow_h = 22.0
    arrow_w = 10.0
    plate_w = 22.0
    plate_h = 40.0
    plate_x = x_center - plate_w / 2.0
    plate_y = y_center - arrow_h / 2.0 - 6.0

    c.setFillColor(colors.HexColor("#FFFFFF"))
    c.setStrokeColor(colors.HexColor("#1A1A1A"))
    c.setLineWidth(0.6)
    c.rect(plate_x, plate_y, plate_w, plate_h, fill=1, stroke=1)

    c.setStrokeColor(colors.black)
    c.setFillColor(colors.black)
    c.setLineWidth(1.2)
    y_tail = y_center - arrow_h / 2.0
    y_tip = y_center + arrow_h / 2.0
    c.line(x_center, y_tail, x_center, y_tip)
    head_w = arrow_w
    head_l = arrow_w * 0.9
    path = c.beginPath()
    path.moveTo(x_center, y_tip)
    path.lineTo(x_center - head_w / 2.0, y_tip - head_l)
    path.lineTo(x_center + head_w / 2.0, y_tip - head_l)
    path.close()
    c.drawPath(path, stroke=0, fill=1)

    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(x_center, y_tip + 4.0, "N")


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
    params: ScenarioParams,
    shoulder_width_ft: float,
    speed_mph: float,
    is_divided: bool = False,
    scale_note: str = "",
    site_flags: Mapping[str, bool] | None = None,
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

    flags = _resolve_site_flags(site_flags)
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

    # Bumped from 14 → 16 pt so 14-pt-tall glyphs (drums) and the
    # warning-light + light-plant compact legend variants don't bleed
    # into the row above.  Pairs with the centered _draw_*_legend
    # variants in _DEVICE_LEGEND_GLYPHS that strip out per-glyph
    # vertical offsets used on the plan view.
    row_h = 16
    y = title_y - 14
    glyph_x = box_x + 18
    text_x = box_x + 36

    def _bail() -> bool:
        return y < box_y + 10

    c.setFont("Helvetica", 8)
    for dt in device_types_used:
        glyph = _DEVICE_LEGEND_GLYPHS.get(dt) or _DEVICE_GLYPHS.get(dt, _draw_sign)
        glyph(c, glyph_x, y + 3)
        c.setFillColor(colors.black)
        label = (
            cone_display_name(speed_mph)
            if dt == DeviceType.CONE
            else _DEVICE_DISPLAY_NAMES.get(dt, dt.value)
        )
        c.drawString(text_x, y, label)
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


# Plaque MUTCD codes — render after their parent sign at the same
# station in the off-page advance-warning table so a reader scans the
# parent code first, then sees the plaque modifier on the next line.
# Shared with the audit sign_table via sign_codes.PLAQUE_CODES.
_PLAQUE_CODES: frozenset[str] = PLAQUE_CODES


def _is_station_placement(p: DevicePlacement) -> bool:
    """Flagger station or AFAD — the placements a flagger plan staffs.

    Mirrors crew_narrative.py's flagger_stations predicate
    (FLAGGER_STATION, or TEMPORARY_SIGNAL labeled AFAD_*) so the PDF
    table and the narrative number the same set of stations.
    """
    return p.device_type == DeviceType.FLAGGER_STATION or (
        p.device_type == DeviceType.TEMPORARY_SIGNAL and (p.label or "").upper().startswith("AFAD")
    )


def _build_advance_warning_table(
    placements: list[DevicePlacement],
    taper_start_station: float,
    station_max_visible: float,
    params: ScenarioParams,
) -> list[tuple[str, str, float]]:
    """Off-page ADVANCE WARNING SIGNS rows, read from the placement list.

    Replaces the prior static 3-entry shoulder-default table that
    pre-dated W5-1 (G2), the second W21-5aR + W16-2a / W7-3a (G1), and
    W3-5 (G5).  Those signs were emitted by the layout engine and
    counted in the audit / XLSX / UI panel, but invisible on the PDF
    because the table was hard-coded.

    Filters to signs upstream of the visible schematic, dedupes the
    left/right mirror pair (one row per code+station), and sorts
    ascending by distance upstream — closest-first, matching the prior
    static-list convention.  Plaques sort after their parent sign at
    the same station.  Parametric labels get their template
    placeholders substituted via the shared
    :func:`src.rules.sign_codes.substitute_sign_description` helper
    (one source for W20-2 / W3-5 / W16-2a / W7-3a / G20-1 / R2-1 values
    across PDF, XLSX, UI breakdown, and audit) so the rendered table
    never carries a literal "XX" / "XXX" through to the field crew.
    The PDF omits the "(under W21-5aR)" parenthetical that the
    text-only surfaces append to the plaque values because column-major
    sorting puts parent immediately before plaque at the same distance.

    Off-page flagger / AFAD stations (UX-09): the approach station
    sits at taper_start + 100 (Fig. 6P-10 band max) while the visible
    extent ends at taper_start + 50, so it is *always* off-page on
    flagger plans — and was silently dropped because this filter was
    signs-only while the off-page X had no table fallback.  Station
    placements now emit a row (CODE "—" — no MUTCD code; a flagger is
    a person, an AFAD a device) so the schematic + table union covers
    every placement.  The device predicate mirrors
    crew_narrative.py's flagger_stations comprehension
    (FLAGGER_STATION, or TEMPORARY_SIGNAL labeled AFAD_*) and the #N
    numbering mirrors its convention: #1 = highest station (approach
    side), #2 = opposing.  AFAD is reachable from the live UI
    (FlaggerForm "Use AFAD" toggle), so both forms are handled here.
    """
    upstream = [
        p
        for p in placements
        if (p.device_type == DeviceType.SIGN_GENERIC or _is_station_placement(p))
        and p.label
        and p.station_ft > station_max_visible
    ]
    seen: set[tuple[str, int]] = set()
    unique: list[tuple[DevicePlacement, str]] = []
    for p in upstream:
        # ``upstream`` filter requires p.label truthy; narrow here.
        label = p.label
        assert label is not None
        key = (label, round(p.station_ft))
        if key in seen:
            continue
        seen.add(key)
        unique.append((p, label))
    unique.sort(
        key=lambda item: (
            item[0].station_ft - taper_start_station,
            item[1].split("(", 1)[0] in _PLAQUE_CODES,
            item[1],
        )
    )
    rows: list[tuple[str, str, float]] = []
    for p, label in unique:
        dist = p.station_ft - taper_start_station
        if _is_station_placement(p):
            # Rank among ALL stations (on- and off-page) so the table's
            # #N matches the narrative: #1 = max station = approach.
            rank = 1 + sum(
                1 for q in placements if _is_station_placement(q) and q.station_ft > p.station_ft
            )
            kind = "AFAD" if p.device_type == DeviceType.TEMPORARY_SIGNAL else "FLAGGER STATION"
            # "(APPROACH)" not "(APPROACH SIDE)": the longer form is
            # 139.6 pt at Helvetica 7 vs the 134.5 pt description room
            # in the tier-2 two-column advance layout (col_w 182 −
            # desc_dx 30 − "100 ft" 17.9); the short form is 121.4 pt.
            rows.append(("—", f"{kind} #{rank} (APPROACH)", dist))
            continue
        bare, desc = substitute_sign_description(
            label, p.station_ft, params, taper_start_station=taper_start_station
        )
        rows.append((bare, desc, dist))
    return rows


@dataclass(frozen=True)
class _NotesLayout:
    """Pitch / padding / column-mode plan for the NOTES & SIGN SCHEDULE box.

    Picked by row count so dense tables (Cases 26/27 + future flagger /
    lane closure additions) stay inside the fixed-height footer box.
    Body fonts are deliberately held at 7 pt regardless of tier — going
    smaller hurts legibility on the printed field plan.  Tightening
    happens via row pitch, section-header padding, and footer-line
    spacing; for the densest tier, the advance table also flips to a
    2-column layout (column-major, closest-first within each column).
    """

    row_pitch: float
    section_header_pad: tuple[float, float]  # (before-rule, after-title)
    col_header_pad: tuple[float, float]  # (before-underline, after-underline)
    footer_pads: tuple[float, float]  # (first-line, between-lines)
    param_pitch: float  # between PARAMETERS row pairs
    two_col_advance: bool


def _notes_layout(schedule_rows: int, advance_rows: int) -> _NotesLayout:
    """Pick the layout tier for a notes box with the given row counts.

    Thresholds verified via cursor-budget simulation (see
    test_notes_layout_cursor_budget): tier 0 fits up to 8 rows; tier 1
    (tightened padding only — row_pitch held at 9 pt for legibility)
    fits 9-11 rows; tier 2 (tier 1 padding + 2-column advance) handles
    the densest stepped-W3-5 sequences and leaves headroom for future
    additions.

    Row pitch policy: 9 pt across tier 0 and tier 1 — at body font 7 pt
    (ascent ~6.5 + descent ~1.5 ≈ 8 pt occupied), a 9 pt baseline pitch
    leaves ~1 pt of breathing room between lines.  Earlier 52d51ad
    tightened tier 1 to 8 pt to fit 12 rows, but adjacent lines then
    touched at the descender/ascender boundary and read cramped.
    Restoring 9 pt costs 1 pt per row vs the previous tier 1; the
    Tier 2 ceiling drops to 12 rows in exchange so dense cases get
    the 2-column treatment instead of cramped 1-column.  Tier 2 keeps
    pitch 8 because space is genuinely constrained there.
    """
    total = schedule_rows + advance_rows
    if total <= 8:
        return _NotesLayout(
            row_pitch=9.0,
            section_header_pad=(4.0, 12.0),
            col_header_pad=(4.0, 8.0),
            footer_pads=(4.0, 8.0),
            param_pitch=10.0,
            two_col_advance=False,
        )
    if total <= 11:
        return _NotesLayout(
            row_pitch=9.0,
            section_header_pad=(3.0, 10.0),
            col_header_pad=(3.0, 7.0),
            footer_pads=(3.0, 6.0),
            param_pitch=9.0,
            two_col_advance=False,
        )
    return _NotesLayout(
        row_pitch=8.0,
        section_header_pad=(3.0, 10.0),
        col_header_pad=(3.0, 7.0),
        footer_pads=(3.0, 6.0),
        param_pitch=9.0,
        two_col_advance=True,
    )


def _draw_notes(
    c: canvas.Canvas,
    params: ScenarioParams,
    shoulder_width_ft: float,
    schedule_order: list[str] | None = None,
    placements: list[DevicePlacement] | None = None,
    *,
    taper_start_station: float,
    station_max_visible: float,
) -> None:
    """Draw the NOTES & SIGN SCHEDULE panel as three tabular sub-sections.

    Layout: bold sub-section headers (each preceded by a thin grey rule)
    over (1) a 2-column PARAMETERS grid, (2) a 3-column SIGN SCHEDULE
    table (#, CODE, DESCRIPTION), and (3) a 3-column ADVANCE WARNING
    SIGNS table with right-aligned distances.  MUTCD codes are bolded.

    ``taper_start_station`` / ``station_max_visible`` come from the
    ``_make_x_mapping`` result (D-02) — the same values the schematic's
    on-page sign filter uses, so the off-page table is the exact
    complement of the drawn glyphs by construction.
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
    # Single-source predicate (validators._is_flagger_scenario) so the
    # taper label / advance-table routing here cannot drift from the
    # taper length _required_taper_length computes.
    is_flagger = _is_flagger_scenario(params)

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
        buf_len = buffer_space(
            speed, jurisdiction=params.jurisdiction, work_zone_speed_mph=params.work_zone_speed_mph
        )
        if is_flagger:
            taper_label = "One-lane two-way taper"
        elif is_lane:
            taper_label = "Lane taper (L)"
        else:
            taper_label = "Shoulder taper (L/3)"

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
    elif is_lane and not is_flagger:
        advance = [
            ("W4-2R", "RIGHT LANE ENDS", sign_a_dist),
            ("W20-5R", "RIGHT LANE CLOSED AHEAD", sign_b_dist),
            ("W20-1", "ROAD WORK AHEAD", sign_c_dist),
        ]
    else:
        # Shoulder closure and flagger (D-05): drive the off-page table
        # from the actual placement list so post-V1-Wide additions
        # (W5-1, second W21-5aR + W16-2a / W7-3a, W3-5 stepped
        # sequence) and the corrected flagger series (W20-4 at B,
        # PR 2) surface on the PDF.  The flagger branch was a static
        # 3-row list that reproduced the B-11 inversion and dropped
        # W20-4 — audit finding D-05.  Opposing-direction negative
        # stations satisfy ``station <= station_max_visible`` and draw
        # on the schematic, so only far-upstream positive signs land
        # here.  taper_start_station / station_max_visible are the
        # threaded _make_x_mapping values (D-02) — the same threshold
        # the schematic's sign filter uses.
        advance = _build_advance_warning_table(
            placements or [],
            taper_start_station,
            station_max_visible,
            params,
        )

    x = x_box + 8
    x_right = x_box + width - 8
    y = [FOOTER_H - 24]

    layout = _notes_layout(len(schedule_order or []), len(advance))

    def section_header(title: str) -> None:
        y[0] -= layout.section_header_pad[0]
        c.setStrokeColor(colors.HexColor("#888888"))
        c.setLineWidth(0.4)
        c.line(x, y[0] + layout.section_header_pad[0], x_right, y[0] + layout.section_header_pad[0])
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(x, y[0] - 4, title)
        y[0] -= layout.section_header_pad[1]

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
        # UX-11: short display name (the full banner already sits in the
        # title block above; the half-width value column can't hold it).
        ("Closure", scenario_display_name_short(params)),
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
            y[0] -= layout.param_pitch
        c.setFont("Helvetica", 7)
        c.setFillColor(colors.black)
        c.drawString(col_x[col], y[0], f"{label}:")
        c.setFont("Helvetica-Bold", 7)
        c.drawString(val_x[col], y[0], val)
    y[0] -= layout.param_pitch

    # SIGN SCHEDULE — 3-column table (#, CODE, DESCRIPTION)
    if schedule_order:
        section_header("SIGN SCHEDULE")
        column_header("#", x)
        column_header("CODE", x + 18)
        column_header("DESCRIPTION", x + 80)
        y[0] -= layout.col_header_pad[0]
        c.setStrokeColor(colors.HexColor("#CCCCCC"))
        c.setLineWidth(0.3)
        c.line(x, y[0], x_right, y[0])
        y[0] -= layout.col_header_pad[1]
        # Representative station per schedule key so the shared
        # substitution helper can resolve station-dependent values for
        # on-page rows (the R2-1 split itself is already encoded in the
        # key; G20-1 needs only params).
        key_station: dict[str, float] = {}
        for p in placements or []:
            if p.device_type == DeviceType.SIGN_GENERIC and p.label:
                key_station.setdefault(_schedule_key(p), p.station_ft)
        for i, key in enumerate(schedule_order, start=1):
            # Schedule keys are bare MUTCD codes except R2-1, which splits
            # into entrance/restoration variants (see _schedule_key).  The
            # CODE column always shows the bare code; parametric
            # placeholders (G20-1 length, R2-1 entrance/restoration
            # limits) substitute via the shared sign_codes helper so the
            # XLSX / UI breakdown / crew narrative read the same values.
            code, desc = substitute_sign_description(key, key_station.get(key, 0.0), params)
            c.setFillColor(colors.black)
            c.setFont("Helvetica", 7)
            c.drawString(x, y[0], str(i))
            c.setFont("Helvetica-Bold", 7)
            c.drawString(x + 18, y[0], code)
            c.setFont("Helvetica", 7)
            c.drawString(x + 80, y[0], desc)
            y[0] -= layout.row_pitch

    # ADVANCE WARNING SIGNS — 3-column table (CODE, DESCRIPTION, DISTANCE).
    # Single-column for ≤12 total rows; 2-column (column-major fill,
    # closest-first within each column) once row count crosses the
    # tier-2 threshold so dense stepped-W3-5 and future flagger/lane
    # closure additions stay inside the box.
    #
    # Title gains "& FLAGGER STATIONS" only when a station placement
    # actually landed off-page (UX-09) — the same filter the table rows
    # use — so a flagger isn't mislabeled a sign and every non-flagger
    # plan keeps the existing string byte-for-byte.  AFAD rows keep the
    # same title: an AFAD staffs a flagger station (the narrative calls
    # them "AFAD station positions").
    has_offpage_station = any(
        _is_station_placement(p) and p.station_ft > station_max_visible for p in (placements or [])
    )
    if is_mobile or is_off_road:
        advance_section_title = "ADVANCE WARNING SIGNS (upstream of work area)"
    elif has_offpage_station:
        advance_section_title = (
            "ADVANCE WARNING SIGNS & FLAGGER STATIONS (off-page upstream of taper)"
        )
    else:
        advance_section_title = "ADVANCE WARNING SIGNS (off-page upstream of taper)"
    section_header(advance_section_title)
    if layout.two_col_advance:
        _draw_advance_table_two_column(c, advance, x, x_right, y, layout, column_header)
    else:
        _draw_advance_table_one_column(c, advance, x, x_right, y, layout, column_header)

    y[0] -= layout.footer_pads[0]
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
    y[0] -= layout.footer_pads[1]
    c.setFont("Helvetica-Bold", 6.5)
    c.setFillColor(colors.HexColor("#B05010"))
    c.drawString(
        x,
        y[0],
        "GENERATED BY CONESTRUCT — DRAFT FOR PE REVIEW. NOT A SEALED PLAN.",
    )
    y[0] -= layout.footer_pads[1]
    c.setFont("Helvetica-Oblique", 6.5)
    c.setFillColor(colors.HexColor("#666666"))
    c.drawString(x, y[0], "Verify all dimensions before use.")


def _draw_advance_table_one_column(
    c: canvas.Canvas,
    advance: list[tuple[str, str, float]],
    x: float,
    x_right: float,
    y: list[float],
    layout: _NotesLayout,
    column_header: Callable[..., None],
) -> None:
    """Single-column ADVANCE WARNING table — current default layout."""
    column_header("CODE", x)
    column_header("DESCRIPTION", x + 60)
    column_header("DISTANCE", x_right, align="right")
    y[0] -= layout.col_header_pad[0]
    c.setStrokeColor(colors.HexColor("#CCCCCC"))
    c.setLineWidth(0.3)
    c.line(x, y[0], x_right, y[0])
    y[0] -= layout.col_header_pad[1]
    for code, desc, dist in advance:
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(x, y[0], code)
        c.setFont("Helvetica", 7)
        c.drawString(x + 60, y[0], desc)
        c.drawRightString(x_right, y[0], f"{dist:.0f} ft")
        y[0] -= layout.row_pitch


def _draw_advance_table_two_column(
    c: canvas.Canvas,
    advance: list[tuple[str, str, float]],
    x: float,
    x_right: float,
    y: list[float],
    layout: _NotesLayout,
    column_header: Callable[..., None],
) -> None:
    """Two-column ADVANCE WARNING table — column-major fill.

    First ceil(N/2) rows in the left column, remainder in the right
    column, so a reader scans left top-to-bottom (closest-first) and
    then right top-to-bottom (continuing closest-first).  Both columns
    carry their own CODE/DESCRIPTION/DISTANCE header set so the
    structure reads at a glance.
    """
    total = len(advance)
    half = (total + 1) // 2
    left = advance[:half]
    right = advance[half:]

    col_gutter = 8.0
    col_w = (x_right - x - col_gutter) / 2.0
    left_x = x
    left_x_right = x + col_w
    right_x = left_x_right + col_gutter
    right_x_right = x_right
    # Per-column DESCRIPTION x-offset is narrower than 1-col mode (30
    # vs 60) since each column is half-width; advance descriptions
    # ("RIGHT SHOULDER CLOSED AHEAD" is the longest at ~94 pt) fit
    # comfortably in the remaining ~125 pt before DISTANCE.
    desc_dx = 30.0

    column_header("CODE", left_x)
    column_header("DESCRIPTION", left_x + desc_dx)
    column_header("DISTANCE", left_x_right, align="right")
    column_header("CODE", right_x)
    column_header("DESCRIPTION", right_x + desc_dx)
    column_header("DISTANCE", right_x_right, align="right")
    y[0] -= layout.col_header_pad[0]
    c.setStrokeColor(colors.HexColor("#CCCCCC"))
    c.setLineWidth(0.3)
    c.line(left_x, y[0], left_x_right, y[0])
    c.line(right_x, y[0], right_x_right, y[0])
    y[0] -= layout.col_header_pad[1]

    for i in range(half):
        l_row = left[i] if i < len(left) else None
        r_row = right[i] if i < len(right) else None
        if l_row is not None:
            code, desc, dist = l_row
            c.setFillColor(colors.black)
            c.setFont("Helvetica-Bold", 7)
            c.drawString(left_x, y[0], code)
            c.setFont("Helvetica", 7)
            c.drawString(left_x + desc_dx, y[0], desc)
            c.drawRightString(left_x_right, y[0], f"{dist:.0f} ft")
        if r_row is not None:
            code, desc, dist = r_row
            c.setFillColor(colors.black)
            c.setFont("Helvetica-Bold", 7)
            c.drawString(right_x, y[0], code)
            c.setFont("Helvetica", 7)
            c.drawString(right_x + desc_dx, y[0], desc)
            c.drawRightString(right_x_right, y[0], f"{dist:.0f} ft")
        y[0] -= layout.row_pitch


# ---------------------------------------------------------------------------
# Mapbox aerial embed (optional)
# ---------------------------------------------------------------------------


# Overlay styling for the work-zone polyline drawn on the aerial.
# Conestruct orange picked to contrast with satellite imagery while
# staying brand-consistent.  Stroke width and opacity are tuned to
# clearly mark the work zone extent without obscuring the underlying
# road geometry.
_AERIAL_OVERLAY_STROKE_W: int = 3
_AERIAL_OVERLAY_COLOR: str = "e8710a"
_AERIAL_OVERLAY_OPACITY: str = "0.7"

# Image dimensions for the Mapbox Static request.  Used both for the
# URL request size and for the per-pixel zoom calculation below.
#
# The page-2 bordered container is 979.2 × 410 pt (≈ 2.39:1).  Asking
# Mapbox for a matching-ratio tile means the image fills the container
# edge-to-edge instead of being letterboxed with whitespace strips on
# the sides.  1200 × 500 (2.40:1) matches within sub-pt tolerance and
# stays under the 1280 px Mapbox Static Images API cap.
_AERIAL_IMG_W_PX: int = 1200
_AERIAL_IMG_H_PX: int = 500

# Web Mercator constant: meters per pixel at zoom 0 at the equator.
# Used to back-solve the integer zoom level that places the work-zone
# polyline at roughly ``_AERIAL_TARGET_POLYLINE_FRACTION`` of the
# image width — gives the reviewer enough surrounding road context to
# locate the closure on the satellite.
#
# 0.20 (was 0.40) means the polyline occupies ~20% of the image width
# and the rest is surrounding context.  Short work zones (< 500 ft)
# need this wider view to surface interchange ramps, cross streets,
# and nearby landmarks; at 0.40 they zoomed in past those features.
# The integer clamp [13, 20] still prevents either extreme.
_AERIAL_METERS_PER_PIXEL_AT_ZOOM_0: float = 156543.03392
_AERIAL_TARGET_POLYLINE_FRACTION: float = 0.20


def _aerial_zoom_for_work_zone(corridor: WorkCorridor) -> int:
    """Pick a static-tile zoom that frames the work zone with context.

    Solves the Mercator pixel-size formula so the work-zone polyline
    spans ``_AERIAL_TARGET_POLYLINE_FRACTION`` of the image width.
    Clamped to [13, 20] — Mapbox satellite imagery has minimal detail
    below 13 and aliases above 20.
    """
    import math

    work_zone_m = corridor.work_zone_ft * M_PER_FT
    # We want target_fraction of the image width to equal work_zone_m,
    # so image_width_m = work_zone_m / target_fraction.
    image_width_m = max(1.0, work_zone_m / _AERIAL_TARGET_POLYLINE_FRACTION)
    meters_per_pixel = image_width_m / _AERIAL_IMG_W_PX
    midpoint = corridor.point_at_station_ft(
        corridor.downstream_taper_ft + corridor.work_zone_ft / 2.0
    )
    cos_lat = math.cos(math.radians(midpoint[0]))
    zoom_float = math.log2(_AERIAL_METERS_PER_PIXEL_AT_ZOOM_0 * cos_lat / meters_per_pixel)
    return max(13, min(20, math.floor(zoom_float)))


def _validate_corridor_bearing(corridor: WorkCorridor) -> None:
    """Soft-check the corridor against OSM and echo any warnings to stdout.

    Delegates to :func:`validate_corridor_against_osm` (which produces
    structured records consumed by the audit trail) and prints each
    warning to stdout so the render harness picks them up.  Never
    raises — the aerial render proceeds either way.
    """
    # Deferred import keeps the rendering module's import graph free
    # of httpx-driven Overpass code unless the aerial path runs.
    from src.rules.site_detection import validate_corridor_against_osm

    try:
        validation = validate_corridor_against_osm(
            corridor.anchor_lat, corridor.anchor_lng, corridor.bearing_deg
        )
    except Exception as exc:  # noqa: BLE001
        print(
            "[corridor-validation] OSM bearing lookup unavailable: "
            f"{type(exc).__name__}: {exc} — skipping check"
        )
        return

    if not validation["checked"]:
        return
    for warning in validation["warnings"]:
        print(f"[corridor-validation] {warning['level'].upper()}: {warning['message']}")


def _fetch_mapbox_aerial(
    lat: float,
    lng: float,
    token: str,
    corridor: WorkCorridor | None = None,
) -> Path | None:
    """Fetch a Mapbox satellite tile, optionally with a work-zone overlay.

    When ``corridor`` is supplied the URL carries a single overlay: a
    2-vertex polyline tracing **only** the work-zone segment (between
    ``corridor.work_zone_endpoints()``).  Advance warning, taper, and
    buffer are not depicted — the closure region is the actionable
    information for a reviewer.

    A best-effort OSM bearing-conflict check runs alongside: if the
    declared corridor bearing diverges from the road OSM reports at
    the anchor by more than 15°, a stdout warning is emitted.  The
    check is silent on success and never blocks rendering.

    The viewport is a fixed center + computed zoom (instead of
    ``auto``) so the polyline sits at roughly 40 % of the image width
    with surrounding road context still visible.  Without a corridor
    we fall back to the original fixed-zoom view centered on the pin
    location.

    Returns the path to a temporary PNG, or ``None`` if the call fails
    for any reason (network error, bad token, rate limit).  Errors are
    logged to stdout rather than raised — the aerial is an optional
    enhancement, not a required component of the plan sheet.
    """
    if corridor is not None:
        _validate_corridor_bearing(corridor)
        downstream_ll, upstream_ll = corridor.work_zone_endpoints()
        polyline = encode_polyline([downstream_ll, upstream_ll])
        # urllib.parse.quote with safe="" so backslashes etc. in the
        # polyline are percent-encoded; otherwise Mapbox will misparse
        # the path overlay.
        encoded_path = urllib_quote(polyline, safe="")
        path_overlay = (
            f"path-{_AERIAL_OVERLAY_STROKE_W}"
            f"+{_AERIAL_OVERLAY_COLOR}-{_AERIAL_OVERLAY_OPACITY}"
            f"({encoded_path})"
        )
        # Center the camera on the work-zone midpoint and pick a zoom
        # that frames the work zone with surrounding context.
        midpoint_lat, midpoint_lng = corridor.point_at_station_ft(
            corridor.downstream_taper_ft + corridor.work_zone_ft / 2.0
        )
        zoom = _aerial_zoom_for_work_zone(corridor)
        viewport = f"{midpoint_lng},{midpoint_lat},{zoom},0"
        overlays = f"{path_overlay}/"
    else:
        viewport = f"{lng},{lat},16,0"
        overlays = ""

    url = (
        f"https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/"
        f"{overlays}{viewport}/{_AERIAL_IMG_W_PX}x{_AERIAL_IMG_H_PX}@2x"
    )
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


# Page 2 (aerial context) layout constants.  The page reuses the same
# top banner as page 1 but otherwise has its own minimal chrome — the
# aerial image dominates, with caption + corridor-details box + footer
# stacked below.
AERIAL_PAGE_IMAGE_FRAC: float = 0.80  # image bounding box width = 80% of page width
AERIAL_PAGE_FOOTER_H: float = 36.0  # footer band height (above bottom margin)
AERIAL_PAGE_TOP_GAP: float = 24.0  # vertical gap between subtitle and image
AERIAL_PAGE_CAPTION_BLOCK_H: float = 50.0  # space reserved for caption + disclaimer
AERIAL_PAGE_BELOW_IMAGE_GAP: float = 14.0  # gap between image bottom and caption top
AERIAL_PAGE_DETAILS_BLOCK_H: float = 132.0  # corridor details panel height
AERIAL_PAGE_DETAILS_GAP: float = 14.0  # gap between caption block and details box
AERIAL_PAGE_DETAILS_FRAC: float = 0.50  # details box width = 50% of page width


def _draw_corridor_details_box(
    c: canvas.Canvas,
    corridor: WorkCorridor,
    box_x: float,
    box_y: float,
    box_w: float,
    box_h: float,
) -> None:
    """Bordered metadata panel summarizing the corridor geometry.

    Rows: anchor lat/lng, bearing (or "Not specified"), total length
    (with miles), advance warning, taper, buffer, work zone,
    downstream taper.  Styling mirrors page 1's structured title
    block — 8 pt bold labels, 9 pt monospace values, thin border, a
    horizontal divider beneath the title.
    """
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.rect(box_x, box_y, box_w, box_h, fill=0, stroke=1)

    pad = 8.0
    title_y = box_y + box_h - 14.0
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(box_x + pad, title_y, "CORRIDOR DETAILS")

    # Divider rule beneath the title.
    c.setStrokeColor(colors.HexColor("#BBBBBB"))
    c.setLineWidth(0.4)
    c.line(box_x + pad, title_y - 4.0, box_x + box_w - pad, title_y - 4.0)

    # Build the rows.  Bearing is expressed as a 3-digit compass
    # heading when known; falls back to "Not specified" so the panel
    # always carries the same row count.
    bearing_str = (
        f"{corridor.bearing_deg:.0f}°" if corridor.bearing_deg is not None else "Not specified"
    )
    total_ft = corridor.total_length_ft
    total_mi = total_ft / 5280.0
    rows: list[tuple[str, str]] = [
        ("Anchor", f"{corridor.anchor_lat:.4f}, {corridor.anchor_lng:.4f}"),
        ("Bearing", bearing_str),
        ("Total corridor", f"{total_ft:,.0f} ft ({total_mi:.2f} mi)"),
        ("Advance warning", f"{corridor.advance_warning_ft:,.0f} ft"),
        ("Taper", f"{corridor.taper_ft:,.0f} ft"),
        ("Buffer", f"{corridor.buffer_ft:,.0f} ft"),
        ("Work zone", f"{corridor.work_zone_ft:,.0f} ft"),
        ("Downstream", f"{corridor.downstream_taper_ft:,.0f} ft"),
    ]

    label_x = box_x + pad
    value_x = box_x + pad + 110.0  # leaves the value column ~150 pt wide in a 50 % box
    row_h = 12.0
    y = title_y - 18.0
    for label, value in rows:
        c.setFillColor(colors.HexColor("#666666"))
        c.setFont("Helvetica-Bold", 8)
        c.drawString(label_x, y, label + ":")
        c.setFillColor(colors.black)
        c.setFont("Courier", 9)
        c.drawString(value_x, y, value)
        y -= row_h


def _draw_aerial_page_footer(
    c: canvas.Canvas,
    sheet_number: str,
    total_sheets: str,
) -> None:
    """Minimal page-2 footer: attribution on the left, page number on the right.

    Mirrors page 1's footer text without rebuilding the three-box
    LEGEND/NOTES/TITLE BLOCK structure — page 2's content is the
    aerial alone.
    """
    y = MARGIN + 6.0
    c.setFillColor(colors.HexColor("#555555"))
    c.setFont("Helvetica-Oblique", 7.5)
    c.drawString(
        MARGIN + 4.0,
        y,
        "DRAFT FOR PE REVIEW — Generated by MHT Tool (Conestruct).  "
        "Not a sealed engineering document.",
    )
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#1A1A1A"))
    sheet_text = f"PAGE {sheet_number} OF {total_sheets}"
    text_w = c.stringWidth(sheet_text, "Helvetica-Bold", 8)
    c.drawString(PAGE_W - MARGIN - 4.0 - text_w, y, sheet_text)


def _render_aerial_page(
    c: canvas.Canvas,
    png_path: Path,
    params: ScenarioParams,
    project_name: str,
    location_description: str,
    lat: float,
    lng: float,
    sheet_number: str,
    total_sheets: str,
    title: str,
    scale_label: str,
    corridor: WorkCorridor | None = None,
) -> None:
    """Render the dedicated aerial-context page (page 2 of 2).

    Layout, top to bottom:

      - Reused project banner (METHOD OF HANDLING TRAFFIC — name —
        speed) so the page is identifiable on its own.
      - "AERIAL CONTEXT" subtitle, centered.
      - Mapbox satellite tile (with optional work-zone polyline
        overlay), horizontally centered.  Aspect ratio preserved.
      - Caption block: site coords, address, then the Mapbox
        attribution / "for context only" disclaimer.  Wording is
        upgraded to call out the orange overlay when a corridor is
        provided.
      - "CORRIDOR DETAILS" metadata panel (when a corridor is
        provided) — fills the otherwise-empty space below the caption.
      - Compact footer with the page number.
    """
    # 1. Top banner (reuse page 1's helper so the visual brand is
    #    consistent across the two pages).
    _draw_title_block(c, title, project_name, sheet_number, total_sheets, params, scale_label)

    # 2. Subtitle "AERIAL CONTEXT" in the band just below the banner.
    subtitle_y = PAGE_H - TITLE_H - 22.0
    c.setFillColor(colors.HexColor("#1A1A1A"))
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(PAGE_W / 2.0, subtitle_y, "AERIAL CONTEXT")

    # 3. Compute the vertical stack from the bottom up so we know how
    #    much room the image gets.  The corridor-details panel is
    #    optional — without a corridor, the image expands into the
    #    space the panel would otherwise occupy.
    has_details = corridor is not None
    details_band_h = AERIAL_PAGE_DETAILS_BLOCK_H + AERIAL_PAGE_DETAILS_GAP if has_details else 0.0
    caption_top = MARGIN + AERIAL_PAGE_FOOTER_H + details_band_h + AERIAL_PAGE_CAPTION_BLOCK_H
    img_top = subtitle_y - AERIAL_PAGE_TOP_GAP
    img_bottom = caption_top + AERIAL_PAGE_BELOW_IMAGE_GAP
    img_box_h = max(0.0, img_top - img_bottom)
    img_box_w = PAGE_W * AERIAL_PAGE_IMAGE_FRAC
    img_x = (PAGE_W - img_box_w) / 2.0
    img_y = img_bottom

    c.drawImage(
        str(png_path),
        img_x,
        img_y,
        width=img_box_w,
        height=img_box_h,
        preserveAspectRatio=True,
    )
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.rect(img_x, img_y, img_box_w, img_box_h, fill=0, stroke=1)

    # Page-2 north indicator — Mapbox always renders north-up, so the
    # arrow points page-up with no rotation logic.  Sits inside the
    # upper-right of the image bounds with a thin white backing plate
    # for legibility against the satellite imagery.
    _draw_aerial_north_arrow(
        c,
        x_center=img_x + img_box_w - 24.0,
        y_center=img_y + img_box_h - 27.0,
    )

    # 4. Caption block — site coords + address + disclaimer.  Anchored
    #    to the image's left edge for a clean visual column.  The
    #    disclaimer wording flips when an overlay is drawn so the
    #    orange line on the satellite is explained inline.
    caption_x = img_x
    cap_y = img_y - AERIAL_PAGE_BELOW_IMAGE_GAP
    c.setFillColor(colors.HexColor("#1A1A1A"))
    c.setFont("Helvetica-Bold", 10)
    c.drawString(caption_x, cap_y, f"SITE: {lat:.4f}, {lng:.4f}")
    if location_description:
        c.setFont("Helvetica", 9)
        c.setFillColor(colors.HexColor("#333333"))
        c.drawString(caption_x, cap_y - 14.0, location_description)
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColor(colors.HexColor("#555555"))
    if corridor is not None:
        disclaimer = (
            f"Work zone ({corridor.work_zone_ft:,.0f} ft) shown in orange.  "
            "Advance warning, taper, and buffer not depicted.  "
            "Mapbox satellite imagery — for context only.  "
            "Not a survey product.  Verify all field conditions on site."
        )
    else:
        disclaimer = (
            "Mapbox satellite imagery.  For context only.  Not a survey product.  "
            "Verify all field conditions on site."
        )
    c.drawString(caption_x, cap_y - 32.0, disclaimer)

    # 5. Corridor details box — optional.
    if corridor is not None:
        details_w = PAGE_W * AERIAL_PAGE_DETAILS_FRAC
        details_x = (PAGE_W - details_w) / 2.0
        details_y = MARGIN + AERIAL_PAGE_FOOTER_H
        _draw_corridor_details_box(
            c, corridor, details_x, details_y, details_w, AERIAL_PAGE_DETAILS_BLOCK_H
        )

    # 6. Footer.
    _draw_aerial_page_footer(c, sheet_number, total_sheets)


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
    shoulder_width_ft: float | None = None,
    site_lat: float | None = None,
    site_lng: float | None = None,
    site_address: str = "",
    site_flags: Mapping[str, bool] | None = None,
) -> str:
    """Render a one-sheet schematic MOT plan to ``output_path``.

    Returns the path written.  The horizontal scale is fitted to the
    work-zone-and-taper region so the merging taper is readable;
    advance warning signs are documented in the notes panel.

    Project metadata (``project_name``, location, bearing) is sourced
    from ``params`` when available; the kwarg ``project_name`` is kept
    as a fallback for callers that haven't migrated to passing the
    fields through ScenarioParams.

    ``shoulder_width_ft`` defaults to ``params.shoulder_width_ft`` (the
    single source of truth); the kwarg remains as an explicit override.

    ``site_flags`` is the structured site-condition dict (the same one
    ``apply_site_adjustments`` consumed) plus the flagger scenario's
    pedestrian-access flag folded in as ``pedestrian_facility``; it
    drives the drawn site context (sidewalk/bike/cross-street/school)
    and the off-road sign clamp threshold.  ``None`` means all-off — a
    deliberate tradeoff so flag-free callers stay untouched.  Any new
    call site rendering a scenario that can carry site conditions MUST
    pass the real flags, or the sheet silently drops its site context
    (Refs #121; replaced the retired label-scan inference).
    """
    # Invariant: the renderer never receives an empty device list.  The
    # API path rejects this with an honest 400 upstream (_placements_for);
    # this guard protects the Streamlit/dev path and any future caller,
    # replacing the cryptic ``min() arg is an empty sequence`` from
    # _make_x_mapping with a clear message.
    if not placements:
        raise ValueError("No devices generated for scenario")
    if shoulder_width_ft is None:
        shoulder_width_ft = params.shoulder_width_ft
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

    # Decide upfront whether we'll add an aerial-context page.  If the
    # fetch succeeds, the PDF becomes a 2-page document: page 1 is the
    # schematic (full plan area, unchanged from the no-aerial layout)
    # and page 2 is the dedicated aerial.  When coords are absent, no
    # token is configured, or the fetch fails, we render a single-page
    # PDF with the schematic alone.
    #
    # When the user supplies a bearing alongside the coords, we build
    # a WorkCorridor so the aerial gets a polyline overlay tracing
    # the work-zone segment plus a CORRIDOR DETAILS panel below the
    # caption.  Without a bearing the aerial still renders (with a
    # plain pin at the anchor) but loses the overlay and panel.
    aerial_png: Path | None = None
    aerial_corridor: WorkCorridor | None = None
    if site_lat is not None and site_lng is not None and (site_lat or site_lng):
        token = os.environ.get("MAPBOX_TOKEN", "")
        if not token:
            print("MAPBOX_TOKEN not set — skipping aerial page")
        else:
            if bearing_deg is not None:
                # PR 4: ``_resolve_taper_ft`` discriminates flagger by
                # closure-type STRING (``_FLAGGER_KINDS``), but
                # ``params.closure_type`` stays "lane" for flagger
                # scenarios — passing it verbatim routed the corridor
                # taper through the merging-taper L formula (540 ft @
                # 12 x 45) while every other surface showed the
                # one-lane two-way 100 ft.  Map to the discriminator
                # the resolver expects so PR 2's flagger branch
                # actually fires.
                corridor_closure_type = (
                    "flagger_alternating_2lane"
                    if _is_flagger_scenario(params)
                    else params.closure_type
                )
                try:
                    aerial_corridor = build_corridor(
                        lat=site_lat,
                        lng=site_lng,
                        bearing_deg=bearing_deg,
                        speed_mph=params.speed_mph,
                        work_zone_ft=params.work_zone_length_ft,
                        closure_type=corridor_closure_type,
                        road_type=params.road_type,
                        lane_width_ft=params.lane_width_ft,
                        shoulder_width_ft=params.shoulder_width_ft,
                        jurisdiction=params.jurisdiction,
                    )
                except Exception as exc:  # noqa: BLE001
                    print(
                        "[corridor] failed to build corridor for aerial overlay: "
                        f"{type(exc).__name__}: {exc}"
                    )
                    aerial_corridor = None
            aerial_png = _fetch_mapbox_aerial(site_lat, site_lng, token, corridor=aerial_corridor)

    page1_total = "2" if aerial_png is not None else "1"

    # ---- Page 1: schematic ------------------------------------------------
    effective_project_name = (
        getattr(params, "project_name", "") or project_name or "Untitled Project"
    )
    if effective_project_name == "Untitled Project" and project_name:
        effective_project_name = project_name
    location_description = getattr(params, "location_description", "") or site_address or ""

    _render_schematic_page(
        c,
        placements,
        params,
        project_name=effective_project_name,
        location_description=location_description,
        sheet_number="1",
        total_sheets=page1_total,
        shoulder_width_ft=shoulder_width_ft,
        title=title,
        aerial_page="2" if aerial_png is not None else None,
        site_flags=site_flags,
    )
    _draw_sheet_border(c)
    c.showPage()

    # ---- Page 2: aerial context (optional) --------------------------------
    if aerial_png is not None:
        # Scale label is informational on page 2 (the aerial isn't to
        # scale).  Reuse page 1's mapping just for the title-banner
        # speed segment that's part of _draw_title_block.
        scale_label = "N/A"
        _render_aerial_page(
            c,
            aerial_png,
            params,
            project_name=effective_project_name,
            location_description=location_description,
            lat=site_lat or 0.0,
            lng=site_lng or 0.0,
            sheet_number="2",
            total_sheets="2",
            title=title,
            scale_label=scale_label,
            corridor=aerial_corridor,
        )
        _draw_sheet_border(c)
        c.showPage()

    c.save()
    return output_path


def _render_schematic_page(
    c: canvas.Canvas,
    placements: list[DevicePlacement],
    params: ScenarioParams,
    project_name: str,
    location_description: str,
    sheet_number: str,
    total_sheets: str,
    shoulder_width_ft: float,
    title: str,
    aerial_page: str | None,
    site_flags: Mapping[str, bool] | None = None,
) -> None:
    """Render the schematic page (page 1)."""
    bearing_deg = getattr(params, "bearing_deg", None)

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
        num_lanes=params.num_lanes,
    )
    _draw_site_context(c, params, x_of, shoulder_width_ft, site_flags)
    _draw_landmarks(c, params, x_of, shoulder_width_ft)
    # Direction-of-travel indicators sit in the page margin just outside
    # the asphalt — below the work-side shoulder and (when divided) above
    # the opposing shoulder.  Keeps the arrow from fighting taper drums
    # or tangent cones for screen real estate, while staying close enough
    # to the carriageway it describes that the semantics are unambiguous.
    shoulder_outer_offset = params.num_lanes * params.lane_width_ft + shoulder_width_ft
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
        site_flags,
    )
    _draw_title_block(c, title, project_name, sheet_number, total_sheets, params, scale_short)
    _draw_legend(
        c,
        placements,
        params,
        shoulder_width_ft,
        speed_mph=params.speed_mph,
        is_divided=params.is_divided,
        scale_note=scale_long,
        site_flags=site_flags,
    )
    _draw_notes(
        c,
        params,
        shoulder_width_ft,
        schedule_order,
        placements,
        taper_start_station=mapping["taper_start_station"],
        station_max_visible=station_max_visible,
    )
    _draw_structured_title_block(
        c,
        params,
        project_name=project_name,
        location_description=location_description,
        sheet_number=sheet_number,
        total_sheets=total_sheets,
        scale_label=scale_short,
        bearing_deg=bearing_deg,
        aerial_page=aerial_page,
    )

    # No compass on page 1 — the schematic is a stylized layout where
    # devices are placed by station/offset, not by geographic
    # orientation, so a north arrow would imply a relationship that
    # doesn't exist.  Page 2's aerial keeps its north indicator
    # because that page IS geographic.


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
