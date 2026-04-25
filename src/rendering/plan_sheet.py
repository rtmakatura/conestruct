"""Plan-sheet renderer — compose a single MUTCD/CDOT MOT plan sheet.

Pure-reportlab implementation: road geometry, device symbols, dimension
callouts, title block, legend, and notes are all drawn directly on a
landscape 11×17 (tabloid) canvas using geometric primitives.  No SVG or
sprite assets in V1; sign and channelizer glyphs are simple shapes.

Convention: LEFT side of the plan view is upstream (high station, where
drivers first encounter the advance-warning signs); RIGHT side is
downstream (low/negative station, END ROAD WORK).  Traffic flows left
to right on the page.

Authoritative sources:
  - CDOT M&S Standard Plan S-630-1 (typical sheet layout)
  - MUTCD 11th Edition Part 6
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable
from datetime import date

from reportlab.lib import colors
from reportlab.pdfgen import canvas

from src.rules.devices import DeviceType
from src.rules.spacing import (
    advance_warning_spacing,
    buffer_space,
    shoulder_taper_length,
)
from src.rules.validators import DevicePlacement, ScenarioParams

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

# Visual palette
ROAD_FILL = colors.Color(0.32, 0.32, 0.34)
SHOULDER_FILL = colors.Color(0.58, 0.58, 0.58)
MEDIAN_FILL = colors.Color(0.65, 0.72, 0.55)
LANE_LINE = colors.white
DIM_LINE = colors.Color(0.20, 0.25, 0.55)
TITLE_BORDER = colors.black

CONE_ORANGE = colors.Color(1.00, 0.50, 0.00)
DRUM_ORANGE = colors.Color(0.95, 0.45, 0.00)
DRUM_STRIPE = colors.white
SIGN_FILL = colors.Color(0.00, 0.45, 0.20)
SIGN_BORDER = colors.white
ARROW_FILL = colors.Color(1.00, 0.85, 0.00)
ARROW_GLYPH = colors.black
FLAG_RED = colors.red


# ---------------------------------------------------------------------------
# Coordinate transforms
# ---------------------------------------------------------------------------


def _fit_horizontal_scale(
    placements: list[DevicePlacement],
    s_max_extra_ft: float = 100.0,
    s_min_extra_ft: float = 100.0,
) -> tuple[float, float, float]:
    """Return (pts_per_station_ft, station_min, station_max) with padding."""
    stations = [p.station_ft for p in placements]
    s_min = min(stations) - s_min_extra_ft
    s_max = max(stations) + s_max_extra_ft
    pts_per_ft = (PLAN_RIGHT - PLAN_LEFT) / (s_max - s_min)
    return pts_per_ft, s_min, s_max


def _x_of(station_ft: float, pts_per_ft: float, s_max: float) -> float:
    """Map station to page x (high station → left, low station → right)."""
    return PLAN_LEFT + (s_max - station_ft) * pts_per_ft


def _y_of(offset_ft: float) -> float:
    return PLAN_Y_CENTER + offset_ft * PTS_PER_OFFSET_FT


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
) -> None:
    x_left = _x_of(s_max, pts_per_ft, s_max)
    x_right = _x_of(s_min, pts_per_ft, s_max)
    width = x_right - x_left

    lane_h = lane_width_ft * PTS_PER_OFFSET_FT
    shoulder_h = shoulder_width_ft * PTS_PER_OFFSET_FT

    right_lane_top = PLAN_Y_CENTER + 2 * lane_h
    right_shldr_top = right_lane_top + shoulder_h
    left_lane_bot = PLAN_Y_CENTER - 2 * lane_h
    left_shldr_bot = left_lane_bot - shoulder_h

    # Shoulders
    c.setFillColor(SHOULDER_FILL)
    c.rect(x_left, right_lane_top, width, shoulder_h, fill=1, stroke=0)
    c.rect(x_left, left_shldr_bot, width, shoulder_h, fill=1, stroke=0)

    # Travel lanes
    c.setFillColor(ROAD_FILL)
    c.rect(x_left, PLAN_Y_CENTER, width, 2 * lane_h, fill=1, stroke=0)
    c.rect(x_left, left_lane_bot, width, 2 * lane_h, fill=1, stroke=0)

    # Median strip (V1 zero-width median; draw a thin visual band)
    median_h = 4.0
    c.setFillColor(MEDIAN_FILL)
    c.rect(x_left, PLAN_Y_CENTER - median_h / 2, width, median_h, fill=1, stroke=0)

    # Edge and shoulder lines
    c.setStrokeColor(LANE_LINE)
    c.setLineWidth(1.0)
    c.line(x_left, right_shldr_top, x_right, right_shldr_top)
    c.line(x_left, left_shldr_bot, x_right, left_shldr_bot)
    c.line(x_left, right_lane_top, x_right, right_lane_top)
    c.line(x_left, left_lane_bot, x_right, left_lane_bot)

    # Lane stripes (dashed) at ±12 ft
    c.setDash(6, 6)
    c.line(x_left, PLAN_Y_CENTER + lane_h, x_right, PLAN_Y_CENTER + lane_h)
    c.line(x_left, PLAN_Y_CENTER - lane_h, x_right, PLAN_Y_CENTER - lane_h)
    c.setDash()


# ---------------------------------------------------------------------------
# Device glyphs
# ---------------------------------------------------------------------------


def _draw_cone(c: canvas.Canvas, x: float, y: float) -> None:
    h, w = 6.0, 4.0
    c.setFillColor(CONE_ORANGE)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.4)
    p = c.beginPath()
    p.moveTo(x - w / 2, y - h / 2)
    p.lineTo(x + w / 2, y - h / 2)
    p.lineTo(x, y + h / 2)
    p.close()
    c.drawPath(p, stroke=1, fill=1)


def _draw_drum(c: canvas.Canvas, x: float, y: float) -> None:
    h, w = 8.0, 5.0
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.4)
    c.setFillColor(DRUM_ORANGE)
    c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
    c.setFillColor(DRUM_STRIPE)
    c.rect(x - w / 2, y - 1.0, w, 2.0, fill=1, stroke=0)


def _draw_sign(c: canvas.Canvas, x: float, y: float) -> None:
    s = 8.0
    c.setFillColor(SIGN_FILL)
    c.setStrokeColor(SIGN_BORDER)
    c.setLineWidth(0.6)
    c.rect(x - s / 2, y - s / 2, s, s, fill=1, stroke=1)


def _draw_arrow_board(c: canvas.Canvas, x: float, y: float) -> None:
    w, h = 14.0, 7.0
    c.setFillColor(ARROW_FILL)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.rect(x - w / 2, y - h / 2, w, h, fill=1, stroke=1)
    # right-pointing arrow glyph
    c.setStrokeColor(ARROW_GLYPH)
    c.setLineWidth(1.2)
    c.line(x - 4, y, x + 4, y)
    c.line(x + 4, y, x + 1, y + 2)
    c.line(x + 4, y, x + 1, y - 2)


def _draw_flagger(c: canvas.Canvas, x: float, y: float) -> None:
    s = 5.0
    c.setStrokeColor(FLAG_RED)
    c.setLineWidth(1.4)
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
    DeviceType.CONE: "Cone",
    DeviceType.DRUM: "Drum",
    DeviceType.SIGN_GENERIC: "Sign",
    DeviceType.ARROW_BOARD: "Arrow Board",
    DeviceType.FLAGGER_STATION: "Flagger Station",
    DeviceType.TUBULAR_MARKER: "Tubular Marker",
    DeviceType.BARRICADE_TYPE_II: "Type II Barricade",
    DeviceType.BARRICADE_TYPE_III: "Type III Barricade",
    DeviceType.LONGITUDINAL_CHANNELIZER: "Longitudinal Channelizer",
    DeviceType.PCMS: "PCMS",
    DeviceType.TRUCK_MOUNTED_ATTENUATOR: "TMA",
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
        x = _x_of(p.station_ft, pts_per_ft, s_max)
        y = _y_of(p.offset_ft)
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
    """Horizontal dimension line with tick marks at each end and a centred label."""
    c.setStrokeColor(DIM_LINE)
    c.setLineWidth(0.5)
    c.line(x1, y, x2, y)
    c.line(x1, y - 4, x1, y + 4)
    c.line(x2, y - 4, x2, y + 4)
    c.setFillColor(DIM_LINE)
    c.setFont("Helvetica", 7)
    c.drawCentredString((x1 + x2) / 2, y + 5, label)


def _draw_direction_arrow(c: canvas.Canvas) -> None:
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


def _draw_landmarks(
    c: canvas.Canvas,
    placements: list[DevicePlacement],
    params: ScenarioParams,
    pts_per_ft: float,
    s_max: float,
    shoulder_width_ft: float,
) -> None:
    """Draw dimension callouts for taper, buffer, work zone, and advance signs."""
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft
    taper_len = shoulder_taper_length(speed, shoulder_width_ft)
    buf_len = buffer_space(speed)

    wz_end = 0.0
    wz_start = wz_len
    taper_end = wz_start + buf_len
    taper_start = taper_end + taper_len

    table_categories = {"urban_low", "urban_high", "rural", "expressway", "freeway"}
    rt = params.road_type if params.road_type in table_categories else None
    abc = advance_warning_spacing(speed, rt)
    a = abc["A"]
    b = abc["B"]
    c_dist = abc["C"]
    sign_a = taper_start + a
    sign_b = sign_a + b
    sign_c = sign_b + c_dist

    y_top = PLAN_Y_CENTER + (34 + 18) * PTS_PER_OFFSET_FT  # above the road
    y_mid = PLAN_Y_CENTER + (34 + 8) * PTS_PER_OFFSET_FT  # just above shoulder

    # Advance warning sign distances (top row of dims)
    _draw_dim(
        c,
        _x_of(sign_c, pts_per_ft, s_max),
        _x_of(sign_b, pts_per_ft, s_max),
        y_top,
        f"C = {c_dist:.0f} ft",
    )
    _draw_dim(
        c,
        _x_of(sign_b, pts_per_ft, s_max),
        _x_of(sign_a, pts_per_ft, s_max),
        y_top,
        f"B = {b:.0f} ft",
    )
    _draw_dim(
        c,
        _x_of(sign_a, pts_per_ft, s_max),
        _x_of(taper_start, pts_per_ft, s_max),
        y_top,
        f"A = {a:.0f} ft",
    )

    # Taper / buffer / work-zone (mid row, just above the road)
    _draw_dim(
        c,
        _x_of(taper_start, pts_per_ft, s_max),
        _x_of(taper_end, pts_per_ft, s_max),
        y_mid,
        f"L/3 = {taper_len:.0f} ft",
    )
    _draw_dim(
        c,
        _x_of(taper_end, pts_per_ft, s_max),
        _x_of(wz_start, pts_per_ft, s_max),
        y_mid,
        f"BUFFER = {buf_len:.0f} ft",
    )
    _draw_dim(
        c,
        _x_of(wz_start, pts_per_ft, s_max),
        _x_of(wz_end, pts_per_ft, s_max),
        y_mid,
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

    project_label = project_name or "SHOULDER CLOSURE — DIVIDED HIGHWAY"
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
    types_used = sorted(
        {p.device_type for p in placements},
        key=lambda dt: dt.value,
    )

    x_start = MARGIN + 8
    y_top = FOOTER_H - 10
    width = (PAGE_W - 2 * MARGIN) / 2 - 16
    height = FOOTER_H - 16

    c.setStrokeColor(colors.black)
    c.setLineWidth(0.6)
    c.rect(MARGIN, MARGIN, width, height, fill=0, stroke=1)

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x_start, y_top, "LEGEND")

    c.setFont("Helvetica", 9)
    row_h = 14
    y = y_top - 18
    for dt in types_used:
        glyph = _DEVICE_GLYPHS.get(dt, _draw_sign)
        glyph(c, x_start + 8, y + 2)
        c.setFillColor(colors.black)
        c.drawString(x_start + 22, y, _DEVICE_DISPLAY_NAMES.get(dt, dt.value))
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
    c.drawString(x_box + 8, FOOTER_H - 10, "NOTES")

    taper_len = shoulder_taper_length(params.speed_mph, shoulder_width_ft)
    buf_len = buffer_space(params.speed_mph)

    notes = (
        f"Speed limit: {params.speed_mph} mph",
        f"Closure type: {params.closure_type}",
        f"Work zone length: {params.work_zone_length_ft:.0f} ft",
        f"Shoulder taper (L/3): {taper_len:.0f} ft",
        f"Buffer space: {buf_len:.0f} ft",
        "Reference: CDOT S-630-1, MUTCD 11th Ed. Part 6",
        "Generated by MHT Tool — verify before use.",
    )
    c.setFont("Helvetica", 9)
    y = FOOTER_H - 28
    for line in notes:
        c.drawString(x_box + 8, y, line)
        y -= 14


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

    Returns the path written.  The horizontal scale is auto-fitted so
    the entire layout — advance warning signs through downstream taper
    — appears on a single 11×17 sheet; vertical (offset) is exaggerated
    by ``PTS_PER_OFFSET_FT`` for readability.
    """
    c = canvas.Canvas(output_path, pagesize=(PAGE_W, PAGE_H))

    pts_per_ft, s_min, s_max = _fit_horizontal_scale(placements)
    inches_per_ft = pts_per_ft / 72.0
    ft_per_inch = 1.0 / inches_per_ft if inches_per_ft else 0.0
    scale_label = f'1" = {ft_per_inch:.0f} ft (horizontal); offset exaggerated'

    _draw_road(c, pts_per_ft, s_min, s_max, params.lane_width_ft, shoulder_width_ft)
    _draw_landmarks(c, placements, params, pts_per_ft, s_max, shoulder_width_ft)
    _draw_devices(c, placements, pts_per_ft, s_max)
    _draw_direction_arrow(c)
    _draw_title_block(c, title, project_name, sheet_number, total_sheets, params, scale_label)
    _draw_legend(c, placements)
    _draw_notes(c, params, shoulder_width_ft)

    c.showPage()
    c.save()
    return output_path


if __name__ == "__main__":
    import os

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
    out = render_plan_sheet(placements, params, "test_plan.pdf")

    size_bytes = os.path.getsize(out)
    print(f"Wrote {out} ({size_bytes} bytes)")
    print(f"Devices placed: {len(placements)}")
    counts = Counter(p.device_type for p in placements)
    for dt, n in sorted(counts.items(), key=lambda kv: kv[0].value):
        print(f"  {dt.value:25s} {n}")
    print()
    print("Open test_plan.pdf to visually inspect.")
