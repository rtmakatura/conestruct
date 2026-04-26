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

from collections.abc import Callable
from datetime import date

from reportlab.lib import colors
from reportlab.pdfgen import canvas

from src.rules.devices import DeviceType
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    shoulder_taper_length,
    taper_length,
)
from src.rules.validators import DevicePlacement, ScenarioParams


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


# 11" x 17" tabloid landscape (long side horizontal)
PAGE_W: float = 17 * 72.0  # 1224 pt
PAGE_H: float = 11 * 72.0  # 792 pt

MARGIN: float = 18.0
TITLE_H: float = 72.0
FOOTER_H: float = 162.0

PLAN_LEFT: float = MARGIN
PLAN_RIGHT: float = PAGE_W - MARGIN
PLAN_TOP: float = PAGE_H - TITLE_H - 8.0
PLAN_BOTTOM: float = FOOTER_H + 8.0
PLAN_Y_CENTER: float = (PLAN_TOP + PLAN_BOTTOM) / 2.0

# Y exaggeration: 2.5 pt per offset-ft (a 12-ft lane = 30 pt tall on page).
# X scale is fitted per-layout to span the full plan view width.
PTS_PER_OFFSET_FT: float = 2.5

# Road palette
LANE_FILL = colors.HexColor("#B0B0B0")
SHOULDER_OPEN_FILL = colors.HexColor("#D0D0D0")
SHOULDER_CLOSED_FILL = colors.HexColor("#E8D0D0")
EDGE_LINE = colors.white
LANE_STRIPE = colors.white
MEDIAN_EDGE = colors.HexColor("#FFD700")
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

_TABLE_CATEGORIES: frozenset[str] = frozenset(
    {"urban_low", "urban_high", "rural", "expressway", "freeway"}
)


# ---------------------------------------------------------------------------
# Coordinate transforms
# ---------------------------------------------------------------------------


def _fit_horizontal_scale(
    placements: list[DevicePlacement],
    params: ScenarioParams,
    shoulder_width_ft: float,
) -> tuple[float, float, float]:
    """Fit the plan-view horizontal scale to the work-zone-and-taper area.

    Stations upstream of ``taper_start`` (i.e., the advance warning signs)
    are clipped from the plan view and surfaced in the notes table
    instead, so the merging taper, buffer, and work zone read clearly at
    the chosen scale (typically ~1" = 100 ft for a 55 mph layout).
    """
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft
    taper_len = _required_taper_length(params, shoulder_width_ft)
    buf_len = buffer_space(speed)
    taper_start = wz_len + buf_len + taper_len

    s_min = min(p.station_ft for p in placements) - 50.0
    s_max = taper_start + 100.0
    pts_per_ft = (PLAN_RIGHT - PLAN_LEFT) / (s_max - s_min)
    return pts_per_ft, s_min, s_max


def _x_of(station_ft: float, pts_per_ft: float, s_max: float) -> float:
    """Map station to page x (high station → left, low station → right)."""
    return PLAN_LEFT + (s_max - station_ft) * pts_per_ft


def _y_of(offset_ft: float) -> float:
    """Map road offset to page y.  Positive offset (work side) → BOTTOM of
    page; negative offset (opposing side) → TOP of page (CDOT S-630-1)."""
    return PLAN_Y_CENTER - offset_ft * PTS_PER_OFFSET_FT


# ---------------------------------------------------------------------------
# Road geometry
# ---------------------------------------------------------------------------


def _draw_road(
    c: canvas.Canvas,
    pts_per_ft: float,
    s_min: float,
    s_max: float,
    lane_width_ft: float,
    shoulder_width_ft: float,
    closure_type: str = "shoulder",
) -> None:
    x_left = _x_of(s_max, pts_per_ft, s_max)
    x_right = _x_of(s_min, pts_per_ft, s_max)
    width = x_right - x_left

    lane_h = lane_width_ft * PTS_PER_OFFSET_FT
    shoulder_h = shoulder_width_ft * PTS_PER_OFFSET_FT

    # After the Y-flip, positive offset_ft → lower page y.  The closed
    # (work-side) carriageway is therefore at the BOTTOM of the page; the
    # opposing carriageway is at the TOP.
    y_center = PLAN_Y_CENTER
    y_closed_lane_inner = y_center - 2 * lane_h  # top edge of closed-side lanes
    y_closed_shldr_outer = y_closed_lane_inner - shoulder_h  # bottom of page
    y_open_lane_inner = y_center + 2 * lane_h  # bottom edge of open-side lanes
    y_open_shldr_outer = y_open_lane_inner + shoulder_h  # top of page

    is_lane_closure = closure_type == "lane"

    # Outer shoulders — for a shoulder closure the work-side shoulder is
    # painted pink; for a lane closure both shoulders stay neutral gray.
    c.setFillColor(SHOULDER_CLOSED_FILL if not is_lane_closure else SHOULDER_OPEN_FILL)
    c.rect(x_left, y_closed_shldr_outer, width, shoulder_h, fill=1, stroke=0)
    c.setFillColor(SHOULDER_OPEN_FILL)
    c.rect(x_left, y_open_lane_inner, width, shoulder_h, fill=1, stroke=0)

    # Travel lanes (medium gray); leave a 4-pt white gap at the centerline
    # to suggest the median (V1 layout has zero-width median in the data
    # convention so this is purely visual).
    c.setFillColor(LANE_FILL)
    # Closed-side carriageway (lower half of road).  For a lane closure,
    # paint the right travel lane (the one closest to the work-side
    # shoulder, page-bottom) pink to flag it as closed and leave the
    # inner lane neutral gray.
    if is_lane_closure:
        right_lane_h = lane_h
        # Outer (closed) lane: from shoulder edge up by one lane height.
        c.setFillColor(SHOULDER_CLOSED_FILL)
        c.rect(x_left, y_closed_lane_inner, width, right_lane_h, fill=1, stroke=0)
        # Inner (open) lane on the closed-side carriageway: above the
        # closed lane, butting against the centerline.
        c.setFillColor(LANE_FILL)
        c.rect(
            x_left,
            y_closed_lane_inner + right_lane_h,
            width,
            lane_h - 2,
            fill=1,
            stroke=0,
        )
    else:
        c.rect(x_left, y_closed_lane_inner, width, 2 * lane_h - 2, fill=1, stroke=0)
    # Open-side carriageway (upper half of road)
    c.setFillColor(LANE_FILL)
    c.rect(x_left, y_center + 2, width, 2 * lane_h - 2, fill=1, stroke=0)

    # Median yellow edge lines bracketing the gap
    c.setStrokeColor(MEDIAN_EDGE)
    c.setLineWidth(2.0)
    c.line(x_left, y_center + 2, x_right, y_center + 2)
    c.line(x_left, y_center - 2, x_right, y_center - 2)

    # Outer travel-lane edges (white solid, 2 pt) at ±lane_width*2
    c.setStrokeColor(EDGE_LINE)
    c.setLineWidth(2.0)
    c.line(x_left, y_closed_lane_inner, x_right, y_closed_lane_inner)
    c.line(x_left, y_open_lane_inner, x_right, y_open_lane_inner)

    # Lane stripes between same-direction lanes (white dashed, 2 pt) at ±lane_width_ft
    c.setLineWidth(2.0)
    c.setDash(12, 8)
    c.line(x_left, _y_of(lane_width_ft), x_right, _y_of(lane_width_ft))
    c.line(x_left, _y_of(-lane_width_ft), x_right, _y_of(-lane_width_ft))
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


def _draw_sign(c: canvas.Canvas, x: float, y: float) -> None:
    """Diamond-orient sign (rotated square) — matches MUTCD warning convention."""
    s = 7.0  # half-diagonal → 14 pt diagonal
    c.setFillColor(SIGN_FILL)
    c.setStrokeColor(SIGN_BORDER)
    c.setLineWidth(0.8)
    p = c.beginPath()
    p.moveTo(x, y + s)
    p.lineTo(x + s, y)
    p.lineTo(x, y - s)
    p.lineTo(x - s, y)
    p.close()
    c.drawPath(p, stroke=1, fill=1)


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


_DEVICE_GLYPHS: dict[DeviceType, Callable[[canvas.Canvas, float, float], None]] = {
    DeviceType.CONE: _draw_cone,
    DeviceType.DRUM: _draw_drum,
    DeviceType.SIGN_GENERIC: _draw_sign,
    DeviceType.ARROW_BOARD: _draw_arrow_board,
    DeviceType.FLAGGER_STATION: _draw_flagger,
    DeviceType.TUBULAR_MARKER: _draw_cone,
    DeviceType.BARRICADE_TYPE_II: _draw_drum,
    DeviceType.BARRICADE_TYPE_III: _draw_drum,
    DeviceType.LONGITUDINAL_CHANNELIZER: _draw_drum,
    DeviceType.PCMS: _draw_arrow_board,
    DeviceType.TRUCK_MOUNTED_ATTENUATOR: _draw_arrow_board,
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


def _draw_devices(
    c: canvas.Canvas,
    placements: list[DevicePlacement],
    pts_per_ft: float,
    s_max: float,
) -> None:
    for p in placements:
        # Advance warning signs sit above s_max (further upstream).  They
        # are listed in the notes table rather than drawn on the plan view.
        if p.station_ft > s_max:
            continue
        x = _x_of(p.station_ft, pts_per_ft, s_max)
        y = _y_of(p.offset_ft)
        if p.device_type == DeviceType.ARROW_BOARD:
            direction = "left" if p.label == "LEFT_ARROW" else "right"
            _draw_arrow_board(c, x, y, direction=direction)
        else:
            glyph = _DEVICE_GLYPHS.get(p.device_type, _draw_sign)
            glyph(c, x, y)
        # Sign code label, placed on the OUTSIDE of the road (away from the
        # centerline) so it lands on the lighter shoulder fill rather than
        # the darker travel-lane fill.  After the Y-flip, "outside" for a
        # positive-offset sign is below the symbol on page; for a negative-
        # offset sign it is above.
        if p.device_type == DeviceType.SIGN_GENERIC and p.label:
            c.setFillColor(colors.black)
            c.setFont("Helvetica", 6)
            label_dy = -11 if p.offset_ft > 0 else 11
            c.drawCentredString(x, y + label_dy, p.label)


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
    c.setStrokeColor(DIM_LINE)
    c.setLineWidth(0.5)
    c.line(x1, y, x2, y)
    c.line(x1, y - 4, x1, y + 4)
    c.line(x2, y - 4, x2, y + 4)
    c.setFillColor(DIM_LINE)
    c.setFont("Helvetica", 7)
    c.drawCentredString((x1 + x2) / 2, y + 5, label)


def _draw_direction_arrow(c: canvas.Canvas) -> None:
    """Direction-of-travel arrow on the work-side carriageway (page bottom)."""
    y = PLAN_Y_CENTER - 34 * PTS_PER_OFFSET_FT - 28
    x1 = PLAN_LEFT + 60
    x2 = PLAN_LEFT + 200
    c.setStrokeColor(colors.black)
    c.setLineWidth(1.5)
    c.line(x1, y, x2, y)
    c.line(x2, y, x2 - 7, y + 4)
    c.line(x2, y, x2 - 7, y - 4)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x1, y + 6, "DIRECTION OF TRAVEL")


def _draw_opposing_arrow(c: canvas.Canvas) -> None:
    """Left-pointing arrow on the opposing carriageway (page top) so the
    direction of each carriageway is unambiguous on the plan view."""
    # Sit above the open shoulder and clear of the dimension callouts
    # (which live at PLAN_Y_CENTER + 46*PTS_PER_OFFSET_FT).
    y = PLAN_Y_CENTER + (34 + 24) * PTS_PER_OFFSET_FT
    x1 = PLAN_LEFT + 60
    x2 = PLAN_LEFT + 200
    c.setStrokeColor(colors.black)
    c.setLineWidth(1.0)
    c.line(x1, y, x2, y)
    # Arrow head pointing LEFT at x1
    c.line(x1, y, x1 + 7, y + 4)
    c.line(x1, y, x1 + 7, y - 4)
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 6)
    c.drawString(x1, y + 4, "OPPOSING TRAFFIC")


def _draw_landmarks(
    c: canvas.Canvas,
    params: ScenarioParams,
    pts_per_ft: float,
    s_max: float,
    shoulder_width_ft: float,
) -> None:
    """Dimension callouts for taper, buffer, and work zone (visible portion only)."""
    wz_len = params.work_zone_length_ft
    taper_len = _required_taper_length(params, shoulder_width_ft)
    buf_len = buffer_space(params.speed_mph)
    taper_label = "L" if params.closure_type == "lane" else "L/3"

    wz_end = 0.0
    wz_start = wz_len
    taper_end = wz_start + buf_len
    taper_start = taper_end + taper_len

    y_top = PLAN_Y_CENTER + (34 + 12) * PTS_PER_OFFSET_FT  # above the open shoulder (top of page)

    _draw_dim(
        c,
        _x_of(taper_start, pts_per_ft, s_max),
        _x_of(taper_end, pts_per_ft, s_max),
        y_top,
        f"{taper_label} = {taper_len:.0f} ft",
    )
    _draw_dim(
        c,
        _x_of(taper_end, pts_per_ft, s_max),
        _x_of(wz_start, pts_per_ft, s_max),
        y_top,
        f"BUFFER = {buf_len:.0f} ft",
    )
    _draw_dim(
        c,
        _x_of(wz_start, pts_per_ft, s_max),
        _x_of(wz_end, pts_per_ft, s_max),
        y_top,
        f"WORK ZONE = {wz_len:.0f} ft",
    )


# ---------------------------------------------------------------------------
# Title block, legend, notes
# ---------------------------------------------------------------------------


def _draw_title_block(
    c: canvas.Canvas,
    title: str,
    project_name: str,
    sheet_number: str,
    total_sheets: str,
    params: ScenarioParams,
    scale_label: str,
) -> None:
    y0 = PAGE_H - TITLE_H
    c.setStrokeColor(TITLE_BORDER)
    c.setLineWidth(1.0)
    c.line(MARGIN, y0, PAGE_W - MARGIN, y0)
    c.line(MARGIN, PAGE_H - MARGIN, PAGE_W - MARGIN, PAGE_H - MARGIN)

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN + 8, PAGE_H - 30, title)

    if project_name:
        project_label = project_name
    elif params.closure_type == "lane":
        project_label = "RIGHT-LANE CLOSURE — DIVIDED HIGHWAY"
    else:
        project_label = "SHOULDER CLOSURE — DIVIDED HIGHWAY"
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 30, project_label)

    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(PAGE_W - MARGIN - 8, PAGE_H - 30, f"SHEET {sheet_number} OF {total_sheets}")

    c.setFont("Helvetica", 9)
    c.drawString(MARGIN + 8, PAGE_H - 52, f"SCALE: {scale_label}")
    c.drawCentredString(PAGE_W / 2, PAGE_H - 52, f"DATE: {date.today().isoformat()}")
    c.drawRightString(PAGE_W - MARGIN - 8, PAGE_H - 52, f"SPEED: {params.speed_mph} MPH")


def _draw_legend(
    c: canvas.Canvas,
    placements: list[DevicePlacement],
) -> None:
    types_used = sorted({p.device_type for p in placements}, key=lambda dt: dt.value)

    width = (PAGE_W - 2 * MARGIN) / 2 - 16
    height = FOOTER_H - 16

    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.rect(MARGIN, MARGIN, width, height, fill=0, stroke=1)

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN + 8, FOOTER_H - 8, "LEGEND")

    c.setFont("Helvetica", 9)
    row_h = 20
    y = FOOTER_H - 28
    for dt in types_used:
        glyph = _DEVICE_GLYPHS.get(dt, _draw_sign)
        glyph(c, MARGIN + 18, y + 4)
        c.setFillColor(colors.black)
        c.drawString(MARGIN + 36, y, _DEVICE_DISPLAY_NAMES.get(dt, dt.value))
        y -= row_h
        if y < MARGIN + 12:
            break


def _draw_notes(
    c: canvas.Canvas,
    params: ScenarioParams,
    shoulder_width_ft: float,
) -> None:
    width = (PAGE_W - 2 * MARGIN) / 2 - 16
    x_box = PAGE_W - MARGIN - width
    height = FOOTER_H - 16

    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.rect(x_box, MARGIN, width, height, fill=0, stroke=1)

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x_box + 8, FOOTER_H - 8, "NOTES")

    speed = params.speed_mph
    taper_len = _required_taper_length(params, shoulder_width_ft)
    buf_len = buffer_space(speed)

    rt = params.road_type if params.road_type in _TABLE_CATEGORIES else None
    abc = advance_warning_spacing(speed, rt)
    sign_a_dist = abc["A"]
    sign_b_dist = abc["A"] + abc["B"]
    sign_c_dist = abc["A"] + abc["B"] + abc["C"]

    is_lane = params.closure_type == "lane"
    taper_label = "Lane taper (L)" if is_lane else "Shoulder taper (L/3)"
    if is_lane:
        sign_a_line = f"  W4-2R RIGHT LANE ENDS at {sign_a_dist:.0f} ft"
        sign_b_line = f"  W20-5B RIGHT LANE CLOSED AHEAD at {sign_b_dist:.0f} ft"
    else:
        sign_a_line = f"  W21-5aR RIGHT SHOULDER CLOSED AHEAD at {sign_a_dist:.0f} ft"
        sign_b_line = f"  W20-2 ROAD WORK XXX FT at {sign_b_dist:.0f} ft"

    notes = [
        f"Speed limit: {speed} mph",
        f"Closure type: {params.closure_type}",
        f"Work zone length: {params.work_zone_length_ft:.0f} ft",
        f"{taper_label}: {taper_len:.0f} ft",
        f"Buffer space: {buf_len:.0f} ft",
        "",
        "Advance warning signs (upstream of taper):",
        f"  W20-1 ROAD WORK AHEAD at {sign_c_dist:.0f} ft",
        sign_b_line,
        sign_a_line,
        "",
        "Reference: CDOT S-630-1, MUTCD 11th Ed. Part 6.",
        "Generated by MHT Tool — verify before use.",
    ]
    c.setFont("Helvetica", 8)
    y = FOOTER_H - 22
    for line in notes:
        c.drawString(x_box + 8, y, line)
        y -= 10


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
) -> str:
    """Render a one-sheet schematic MOT plan to ``output_path``.

    Returns the path written.  The horizontal scale is fitted to the
    work-zone-and-taper region so the merging taper is readable;
    advance warning signs are documented in the notes panel.
    """
    c = canvas.Canvas(output_path, pagesize=(PAGE_W, PAGE_H))

    pts_per_ft, s_min, s_max = _fit_horizontal_scale(placements, params, shoulder_width_ft)
    ft_per_inch = 72.0 / pts_per_ft if pts_per_ft else 0.0
    scale_label = f'1" = {ft_per_inch:.0f} ft (horizontal); offset exaggerated'

    _draw_road(
        c,
        pts_per_ft,
        s_min,
        s_max,
        params.lane_width_ft,
        shoulder_width_ft,
        closure_type=params.closure_type,
    )
    _draw_landmarks(c, params, pts_per_ft, s_max, shoulder_width_ft)
    _draw_devices(c, placements, pts_per_ft, s_max)
    _draw_direction_arrow(c)
    _draw_opposing_arrow(c)
    _draw_title_block(c, title, project_name, sheet_number, total_sheets, params, scale_label)
    _draw_legend(c, placements)
    _draw_notes(c, params, shoulder_width_ft)

    c.showPage()
    c.save()
    return output_path


if __name__ == "__main__":
    import os
    from collections import Counter

    from src.generation.layout import generate_shoulder_closure_divided

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="divided_highway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    placements = generate_shoulder_closure_divided(params)
    out = render_plan_sheet(placements, params, "test_plan_v2.pdf")

    size_bytes = os.path.getsize(out)
    print(f"Wrote {out} ({size_bytes} bytes)")
    print(f"Devices placed: {len(placements)}")
    counts = Counter(p.device_type for p in placements)
    for dt, n in sorted(counts.items(), key=lambda kv: kv[0].value):
        print(f"  {dt.value:25s} {n}")
    print()
    print("Open test_plan_v2.pdf to visually inspect.")
