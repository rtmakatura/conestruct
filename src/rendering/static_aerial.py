"""The laid-out corridor as a Mapbox Static Images overlay — one builder (#301).

PDF page 2 and the WHERE band's aerial both draw the corridor through THIS
module, so the two pictures are the same overlay, byte for byte (#301's
acceptance: "the band aerial, the picker and PDF page 2 draw from one
producer").  The corridor itself comes from
:func:`src.rules.corridor_layout.laid_out` (#302); this module only turns its
zones into path overlays and fetches the image.

The zone colours and width ranks MIRROR ``lib/corridor-zones.ts``
(``ZONE_COLOR``, ``ZONE_CHANNEL.widthRank``) — the picker's live map — so the
three surfaces show one corridor (P11).  #131's non-colour channel for a
surface whose paths cannot dash is the width rank, "the ONLY non-colour
channel the Static Images preview can carry".  Footage past the mapped road
(#211) takes the picker's own treatment — the zone's colour and width,
faded (the picker's line-opacity 0.35 against 0.9).

Known deviation (``issue-301-band-aerial/rulings.md``, ruling 3): #281 Part 2
rule 110's palette is not what any surface draws; these are.
"""

from __future__ import annotations

import math
from typing import Any
from urllib.parse import quote as urllib_quote

import httpx

from src.rules.corridor import WorkCorridor, encode_polyline
from src.rules.corridor_layout import zone_parts, zone_spans

STYLE: str = "satellite-streets-v12"

ZONE_COLOR: dict[str, str] = {
    "advance_warning": "FFD166",
    "transition": "F3722C",
    "buffer": "FF7A00",
    "work_zone": "1EC8A5",
    "downstream": "8A8A8A",
}
ZONE_RANK: dict[str, int] = {
    "downstream": 1,
    "work_zone": 2,
    "buffer": 3,
    "transition": 4,
    "advance_warning": 5,
}
ZONE_WORD: dict[str, str] = {
    "advance_warning": "Advance warning",
    "transition": "Taper",
    "buffer": "Buffer",
    "work_zone": "Work zone",
    "downstream": "Downstream",
}
# The picker's legend order (upstream first — the motorist's order).
LEGEND_ORDER: tuple[str, ...] = (
    "advance_warning",
    "transition",
    "buffer",
    "work_zone",
    "downstream",
)
OPACITY: str = "0.9"
EXT_OPACITY: str = "0.35"
# Mapbox Static Images URLs are capped at 8,192 characters.  The laid-out
# corridor carries up to ~12 paths; each path's points are thinned (never
# its endpoints) until the URL fits.  CHOSEN steps.
URL_MAX_CHARS: int = 8000
POINT_STEPS: tuple[int, ...] = (100, 40, 16, 2)
# Padding (px) around the auto-framed corridor, so the first sign is not
# drawn against the image edge.  Page 2's figure; CHOSEN.
PADDING_PX: int = 60
# The band at phone width (#301 checkpoint (f)): Mapbox refuses a padding
# that reaches the image's own size, and 60 px of a 250 px frame is a
# quarter of it.  CHOSEN — the figure probes/static_cost.py drew at 348 px.
NARROW_PADDING_PX: int = 30
NARROW_BELOW_PX: int = 480
# The pin, before the side is confirmed (the band's aerial only): the
# picker's PIN_COLOR (LocationPickerModal.tsx, === --dim-deep), and a zoom
# that shows the block around it.  CHOSEN.
PIN_COLOR: str = "E8710A"
PIN_ZOOM: int = 17

STAGES: tuple[str, ...] = ("pin", "work", "laid_out")

# The band's zoom (Ryan's hand-check ruling on #301, 2026-09-26): steps from
# the whole-corridor framing — one step OUT for context, up to ZOOM_IN_MAX
# steps in.  CHOSEN: 3.  A 1,400–2,700 ft corridor fits at about zoom 15–16
# in the band's frame; three steps in (8x linear) reach 18–19, where lane
# edges read on Mapbox satellite and before its imagery softens.
ZOOM_OUT_MAX: int = 1
ZOOM_IN_MAX: int = 3
# Mapbox Static Images tiles are 512 px at zoom 0.
_TILE_PX: int = 512
_ZOOM_CEILING: float = 22.0


def _mercator(lat: float, lng: float) -> tuple[float, float]:
    s = math.sin(math.radians(max(-85.0, min(85.0, lat))))
    return (lng + 180.0) / 360.0, 0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)


def _unmercator(x: float, y: float) -> tuple[float, float]:
    n = math.pi - 2 * math.pi * y
    return math.degrees(math.atan(math.sinh(n))), x * 360.0 - 180.0


def pin_frame_point(
    lat: float,
    lng: float,
    *,
    width: int,
    height: int,
    zoom: int,
    x: float,
    y: float,
) -> tuple[float, float]:
    """The ``(lat, lng)`` under pixel ``(x, y)`` of the ``pin`` picture (#440 X3).

    The ``pin`` stage is the one frame whose centre and zoom the backend
    fixes (:func:`band_image_url`: centred on the pin at :data:`PIN_ZOOM`
    plus the zoom step), so a tap on it has a coordinate.  ``x``/``y`` are
    CSS px from the picture's top-left inside a ``width`` x ``height`` frame;
    the ``@2x`` image doubles its pixels, not its geometry.  Web Mercator,
    512 px tiles (Mapbox Static Images).
    """
    if not -ZOOM_OUT_MAX <= zoom <= ZOOM_IN_MAX:
        raise ValueError(f"zoom step {zoom} outside -{ZOOM_OUT_MAX}..{ZOOM_IN_MAX}")
    if width <= 0 or height <= 0:
        raise ValueError(f"frame {width}x{height} is empty")
    if not (0 <= x <= width and 0 <= y <= height):
        raise ValueError(f"pixel ({x}, {y}) outside the {width}x{height} frame")
    world_px = _TILE_PX * 2.0 ** (PIN_ZOOM + zoom)
    cx, cy = _mercator(lat, lng)
    return _unmercator(cx + (x - width / 2) / world_px, cy + (y - height / 2) / world_px)


def drawn_points(
    approaches: list[tuple[str, WorkCorridor]], *, stage: str
) -> list[tuple[float, float]]:
    """Every point the overlay draws at ``stage`` (the work alone at "work")."""
    points: list[tuple[float, float]] = []
    if stage == "laid_out":
        for _approach_id, c in approaches:
            for zone, a, b in zone_spans(c):
                if zone != "work_zone":
                    for part in zone_parts(c, a, b):
                        points.extend(part.points)
    primary = approaches[0][1]
    work = next(span for span in zone_spans(primary) if span[0] == "work_zone")
    for part in zone_parts(primary, work[1], work[2]):
        points.extend(part.points)
    return points


def fit_view(
    points: list[tuple[float, float]], width: int, height: int, padding: int
) -> tuple[tuple[float, float], float]:
    """The centre and zoom that fit ``points`` inside the frame, less padding.

    Web Mercator, 512 px tiles — the framing Mapbox's own ``auto`` computes,
    done here so the band's zoom steps have a number to step from.
    """
    xs, ys = zip(*(_mercator(lat, lng) for lat, lng in points), strict=True)
    span_x = max(max(xs) - min(xs), 1e-9)
    span_y = max(max(ys) - min(ys), 1e-9)
    zoom = min(
        math.log2(max(width - 2 * padding, 1) / (_TILE_PX * span_x)),
        math.log2(max(height - 2 * padding, 1) / (_TILE_PX * span_y)),
        _ZOOM_CEILING,
    )
    centre = _unmercator((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2)
    return centre, zoom


def work_midpoint(approaches: list[tuple[str, WorkCorridor]]) -> tuple[float, float]:
    """The work segment's middle — where a zoomed-in view looks (P21)."""
    primary = approaches[0][1]
    work = next(span for span in zone_spans(primary) if span[0] == "work_zone")
    return primary.point_at_station_ft((work[1] + work[2]) / 2.0)


def laid_out_overlays(
    approaches: list[tuple[str, WorkCorridor]], max_points: int = 100, *, stage: str = "laid_out"
) -> str:
    """The static-URL path overlays for a work-start plan's corridor.

    ``stage="laid_out"``: every approach's non-work zones first, the work
    zone last (drawn on top).  ``stage="work"``: the work zone only — rule
    112, nothing upstream before the kind is confirmed.  Each zone in the
    picker's colour at its width rank; a part on the end tangent (past the
    mapped road) the same stroke, faded.
    """

    def path(zone: str, part: Any) -> str:
        width = 1 + ZONE_RANK[zone]
        opacity = EXT_OPACITY if part.extended else OPACITY
        return (
            f"path-{width}+{ZONE_COLOR[zone]}-{opacity}"
            f"({urllib_quote(encode_polyline(part.points), safe='')})"
        )

    overlays: list[str] = []
    if stage == "laid_out":
        for _approach_id, c in approaches:
            for zone, a, b in zone_spans(c):
                if zone == "work_zone":
                    continue
                overlays.extend(
                    path(zone, part)
                    for part in zone_parts(c, a, b, max_points)
                    if len(part.points) >= 2
                )
    primary = approaches[0][1]
    work = next(span for span in zone_spans(primary) if span[0] == "work_zone")
    overlays.extend(
        path("work_zone", part)
        for part in zone_parts(primary, work[1], work[2], max_points)
        if len(part.points) >= 2
    )
    return ",".join(overlays)


def fit_overlays(
    approaches: list[tuple[str, WorkCorridor]], *, stage: str = "laid_out", suffix: str = ""
) -> str:
    """The overlays, thinned step by step until the URL fits (with ``/``)."""
    overlays = ""
    for max_points in POINT_STEPS:
        overlays = f"{laid_out_overlays(approaches, max_points, stage=stage)}{suffix}/"
        if len(overlays) < URL_MAX_CHARS - 200:
            break
    return overlays


def pin_marker(lat: float, lng: float) -> str:
    return f"pin-s+{PIN_COLOR}({lng:.6f},{lat:.6f})"


def band_image_url(
    lat: float,
    lng: float,
    approaches: list[tuple[str, WorkCorridor]] | None,
    *,
    stage: str,
    width: int,
    height: int,
    zoom: int = 0,
) -> tuple[str, dict[str, str]]:
    """The band aerial's Static Images URL and query (token excluded).

    ``stage="pin"``: the pin alone at :data:`PIN_ZOOM` — nothing directional
    before the side is confirmed (#290's pre-side ruling, P16).  Otherwise
    the corridor's overlays (page 2's own, :func:`fit_overlays`) with the pin
    on top, framed ``auto`` with padding.

    ``zoom`` (−:data:`ZOOM_OUT_MAX` … +:data:`ZOOM_IN_MAX`) steps from that
    framing; 0 is the shipped whole-corridor ``auto`` view, unchanged.  A
    step in looks at the work's middle; the step out at the corridor's.
    The overlay and the pin are the same at every step.
    """
    if not -ZOOM_OUT_MAX <= zoom <= ZOOM_IN_MAX:
        raise ValueError(f"zoom step {zoom} outside -{ZOOM_OUT_MAX}..{ZOOM_IN_MAX}")
    pin = pin_marker(lat, lng)
    size = f"{width}x{height}@2x"
    base = f"https://api.mapbox.com/styles/v1/mapbox/{STYLE}/static/"
    if stage == "pin" or not approaches:
        return f"{base}{pin}/{lng:.6f},{lat:.6f},{PIN_ZOOM + zoom},0/{size}", {}
    overlays = fit_overlays(approaches, stage=stage, suffix=f",{pin}")
    padding = NARROW_PADDING_PX if width < NARROW_BELOW_PX else PADDING_PX
    if zoom == 0:
        return f"{base}{overlays}auto/{size}", {"padding": str(padding)}
    centre, fit = fit_view(drawn_points(approaches, stage=stage), width, height, padding)
    if zoom > 0:
        centre = work_midpoint(approaches)
    z = max(0.0, min(_ZOOM_CEILING, fit + zoom))
    return f"{base}{overlays}{centre[1]:.6f},{centre[0]:.6f},{z:.2f},0/{size}", {}


# A NEEDS YOU question's map (#447, ruling 3).  The work is a solid ``--dim``
# line; the subject is dashed ``#3fd3a8``.  Both MIRROR globals.css
# (``--dim``, ``--lv-work``), which the key under the map draws with.
WORK_COLOR: str = "FF8A2E"
SUBJECT_COLOR: str = "3FD3A8"
# #447 X10, CHOSEN: the pin picture's zoom plus one, since a single crossing
# has no span to fit; and the sidewalk "segment" is the nearest three features.
SUBJECT_MAX_ZOOM: float = 18.0
SUBJECT_FRAME_FEATURES: int = 3
# #447 X2, X3, CHOSEN: Static Images can't dash a path, so a dash is its own
# path.  A floor in metres, since the polyline's 5 decimals are about 1 m.
DASH_ON_PX: float = 12.0
DASH_OFF_PX: float = 8.0
DASH_ON_MIN_M: float = 3.0
DASH_OFF_MIN_M: float = 2.0
RING_RADIUS_PX: float = 14.0
RING_RADIUS_MIN_M: float = 4.0
RING_DASHES: int = 8
_EARTH_CIRCUMFERENCE_M: float = 40_075_016.7


def _px_per_m(lat: float, zoom: float) -> float:
    return _TILE_PX * 2.0**zoom / (_EARTH_CIRCUMFERENCE_M * math.cos(math.radians(lat)))


def _dash_path(a: tuple[float, float], b: tuple[float, float]) -> str:
    poly = urllib_quote(encode_polyline([a, b]), safe="")
    return f"path-3+{SUBJECT_COLOR}-1({poly})"


def _dashes(
    line: list[tuple[float, float]],
    centre: tuple[float, float],
    zoom: float,
    width: int,
    height: int,
) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    """One subject as dash ends, keeping only the dashes the frame shows."""
    world = _TILE_PX * 2.0**zoom
    cx, cy = _mercator(*centre)
    per_m = _px_per_m(centre[0], zoom)

    def latlng(px: tuple[float, float]) -> tuple[float, float]:
        return _unmercator(cx + px[0] / world, cy + px[1] / world)

    def shown(px: tuple[float, float]) -> bool:
        return abs(px[0]) <= width / 2 and abs(px[1]) <= height / 2

    def pixel(p: tuple[float, float]) -> tuple[float, float]:
        x, y = _mercator(*p)
        return (x - cx) * world, (y - cy) * world

    if len(line) == 1:
        # X3: a point has no line to dash; a ring of dashes around it.
        ox, oy = pixel(line[0])
        radius = max(RING_RADIUS_PX, RING_RADIUS_MIN_M * per_m)
        ring: list[tuple[tuple[float, float], tuple[float, float]]] = []
        for i in range(RING_DASHES):
            a1 = 2 * math.pi * i / RING_DASHES
            a2 = a1 + math.pi / RING_DASHES
            p1 = (ox + radius * math.cos(a1), oy + radius * math.sin(a1))
            p2 = (ox + radius * math.cos(a2), oy + radius * math.sin(a2))
            if shown(p1) or shown(p2):
                ring.append((latlng(p1), latlng(p2)))
        return ring

    on = max(DASH_ON_PX, DASH_ON_MIN_M * per_m)
    off = max(DASH_OFF_PX, DASH_OFF_MIN_M * per_m)
    period = on + off
    out: list[tuple[tuple[float, float], tuple[float, float]]] = []
    walked = 0.0
    px_line = [pixel(p) for p in line]
    for (x1, y1), (x2, y2) in zip(px_line, px_line[1:], strict=False):
        length = math.hypot(x2 - x1, y2 - y1)
        if length <= 0:
            continue
        ux, uy = (x2 - x1) / length, (y2 - y1) / length
        # The next dash's start along this segment.
        s = (-walked) % period
        while s < length:
            e = min(s + on, length)
            p1 = (x1 + ux * s, y1 + uy * s)
            p2 = (x1 + ux * e, y1 + uy * e)
            if shown(p1) or shown(p2):
                out.append((latlng(p1), latlng(p2)))
            s += period
        walked += length
    return out


def _work_overlays(approaches: list[tuple[str, WorkCorridor]], max_points: int) -> list[str]:
    primary = approaches[0][1]
    work = next(span for span in zone_spans(primary) if span[0] == "work_zone")
    return [
        f"path-5+{WORK_COLOR}-{EXT_OPACITY if part.extended else OPACITY}"
        f"({urllib_quote(encode_polyline(part.points), safe='')})"
        for part in zone_parts(primary, work[1], work[2], max_points)
        if len(part.points) >= 2
    ]


def question_image_url(
    lat: float,
    lng: float,
    approaches: list[tuple[str, WorkCorridor]] | None,
    subject: list[list[tuple[float, float]]] | None,
    *,
    width: int,
    height: int,
    zoom: int = 0,
) -> tuple[str, dict[str, str], tuple[float, float], bool]:
    """A NEEDS YOU map: its URL and query, the question's point, whether a line was drawn.

    Framed on the nearest features of ``subject`` (nearest first; the
    backend's own read, :func:`src.rules.site_detection.subject_geometry`).
    With no subject the frame is the work zone, and with no laid-out corridor
    the pin picture; neither draws a guessed line (Rule 10).
    """
    if not -ZOOM_OUT_MAX <= zoom <= ZOOM_IN_MAX:
        raise ValueError(f"zoom step {zoom} outside -{ZOOM_OUT_MAX}..{ZOOM_IN_MAX}")
    if not approaches:
        url, query = band_image_url(
            lat, lng, None, stage="pin", width=width, height=height, zoom=zoom
        )
        return url, query, (lat, lng), False
    padding = NARROW_PADDING_PX if width < NARROW_BELOW_PX else PADDING_PX
    subject = subject or []
    if subject:
        framed = [p for line in subject[:SUBJECT_FRAME_FEATURES] for p in line]
        nearest = subject[0]
        point = nearest[len(nearest) // 2]
    else:
        framed = drawn_points(approaches, stage="work")
        point = work_midpoint(approaches)
    centre, fit = fit_view(framed, width, height, padding)
    z = max(0.0, min(_ZOOM_CEILING, min(fit, SUBJECT_MAX_ZOOM) + zoom))
    size = f"{width}x{height}@2x"
    head = f"https://api.mapbox.com/styles/v1/mapbox/{STYLE}/static/"
    tail = f"/{centre[1]:.6f},{centre[0]:.6f},{z:.2f},0/{size}"
    work: list[str] = []
    for max_points in POINT_STEPS:
        work = _work_overlays(approaches, max_points)
        if sum(len(w) + 1 for w in work) < URL_MAX_CHARS // 4:
            break
    # The farthest features go first if the URL would pass the cap (X2): a
    # feature is drawn whole or not at all.
    used = len(head) + len(tail) + sum(len(w) + 1 for w in work)
    dashes: list[str] = []
    for line in subject:
        drawn = [_dash_path(a, b) for a, b in _dashes(line, centre, z, width, height)]
        cost = sum(len(d) + 1 for d in drawn)
        if used + cost > URL_MAX_CHARS - 200:
            break
        dashes.extend(drawn)
        used += cost
    overlays = ",".join([*work, *dashes])
    return f"{head}{overlays}{tail}", {}, point, bool(dashes)


# The formats the Static Images API answers, by their leading bytes (#369).
# satellite-streets-v12 comes back as JPEG, not PNG.
_SIGNATURES: tuple[tuple[bytes, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
)


def image_media_type(data: bytes) -> str | None:
    """The media type the bytes' signature names; None when neither."""
    for signature, media_type in _SIGNATURES:
        if data.startswith(signature):
            return media_type
    return None


def fetch_image(url: str, query: dict[str, str], token: str) -> bytes:
    """GET the image, as Mapbox encodes it (JPEG for :data:`STYLE`).

    Raises ``httpx.HTTPError`` on any failure.
    """
    r = httpx.get(url, params={**query, "access_token": token}, timeout=15.0)
    r.raise_for_status()
    return r.content
