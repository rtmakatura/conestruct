"""Single source of truth for MUTCD sign-code → description lookup + substitution.

Consolidates the parallel dictionaries that previously lived in
``src/rendering/plan_sheet.py``, ``src/export/device_list.py``,
``src/export/quote_generator.py``, and ``src/narrative/crew_narrative.py``.
The duplicated dicts had drifted out of sync, so codes added to the
generators (e.g. G20-1, W20-5R, W4-2R) showed up correctly in the
plan-sheet PDF but as bare codes in the device-list xlsx.

Placeholder substitution (``XXX``/``XX`` → actual values) lives here
too — :func:`substitute_sign_description` is the one place that knows
how each parametric label resolves, so the PDF, XLSX, UI device
breakdown, and audit cannot drift on the substituted values.  (The
substitution logic used to be re-implemented per surface; the XLSX and
UI copies shipped literal templates — audit finding B-01.)

Authoritative source: MUTCD 11th Edition, Part 6 (Temporary Traffic
Control), supplemented by CDOT M&S Standard Plan S-630-1.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.rules.validators import ScenarioParams

SIGN_DESCRIPTIONS: dict[str, str] = {
    # Warning (W-series)
    "W20-1": "ROAD WORK AHEAD",
    "W20-2": "ROAD WORK XXX FT",
    "W20-4": "ONE LANE ROAD AHEAD",
    "W20-5R": "RIGHT LANE CLOSED AHEAD",
    "W20-7": "FLAGGER AHEAD",
    "W20-7a": "AFAD AHEAD",
    "W3-4": "BE PREPARED TO STOP",
    "W3-5": "ADVISORY SPEED XX",
    "W21-1a": "WORKERS",
    "W21-5": "SHOULDER WORK",
    "W21-5aR": "RIGHT SHOULDER CLOSED AHEAD",
    "W21-5aL": "LEFT SHOULDER CLOSED AHEAD",
    "W16-2a": "NEXT XXX FT plaque",
    "W7-3a": "NEXT XX MILES plaque",
    "W4-2R": "RIGHT LANE ENDS",
    "W5-1": "ROAD NARROWS",
    # Guide (G-series)
    "G20-1": "ROAD CONSTRUCTION (NEXT XXX FT)",
    "G20-2": "END ROAD WORK",
    "G20-4": "PILOT CAR FOLLOW ME",
    "G20-5P": "CONSTRUCTION ZONE plaque",
    # Regulatory (R-series)
    # Plain legend per §6G.10 — "USE OTHER SIDE" belongs to R9-10, which
    # asserts a walkable alternate side the tool cannot verify exists.
    "R9-9": "SIDEWALK CLOSED",
    "R2-1": "SPEED LIMIT XX",
    "R2-6P": "FINES DOUBLE plaque",
    "R2-10": "BEGIN DOUBLE FINES ZONE",
    "R2-11": "END DOUBLE FINES ZONE",
    # Route / school (M-series, S-series)
    "M4-9a": "BIKE DETOUR",
    "S1-1": "SCHOOL",
}


def description_for(code: str) -> str:
    """Return the human-readable description for ``code``.

    Falls back to the bare code when unknown so renderers and
    exporters still produce a non-empty cell rather than dropping the
    label entirely.  Placeholders (e.g. ``XXX`` in ``W20-2``) are
    returned literally; use :func:`substitute_sign_description` when a
    placement (station + params) is available to resolve them.
    """
    return SIGN_DESCRIPTIONS.get(code, code)


# ---------------------------------------------------------------------------
# Schedule keys + parametric substitution — shared by PDF, XLSX, UI
# device breakdown, and the audit projection so the surfaces cannot
# drift on what a sign face actually says.
# ---------------------------------------------------------------------------


# Plaque MUTCD codes — supplemental panels mounted under a parent sign.
# Sorted after their parent at the same station in the PDF off-page
# table and the audit sign_table so a reader scans the parent code
# first, then the plaque modifier.
PLAQUE_CODES: frozenset[str] = frozenset({"W16-2a", "W7-3a", "G20-5P", "R2-6P"})


def schedule_key(label: str | None, station_ft: float) -> str:
    """Schedule/aggregation key for a sign placement.

    Normally the bare placement label.  The exception is R2-1 SPEED
    LIMIT, which is emitted twice on a reduced-speed plan with the same
    bare label but two distinct regulatory faces: the work-zone
    entrance posting (inside the work zone, ``station_ft >= 0``)
    carries the reduced limit, while the downstream restoration sign
    (past the work-zone end, ``station_ft < 0``) carries the original
    posted limit.  Splitting the key by station sign gives each face
    its own schedule row / device-list row / callout number without
    changing the placement label (commit 46fabd7 convention).
    """
    if label == "R2-1":
        return "R2-1@entrance" if station_ft >= 0 else "R2-1@restoration"
    return label or ""


def display_code(key: str) -> str:
    """Bare MUTCD code for a schedule key or placement label.

    Strips the ``R2-1@`` split marker and the ``W3-5(NN)``
    advisory-speed suffix; everything else passes through unchanged.
    """
    if key.startswith("R2-1@"):
        return "R2-1"
    if key.startswith("W3-5("):
        return "W3-5"
    return key


def _taper_start_station(params: ScenarioParams) -> float:
    """Upstream end of the taper (station ft) for fixed-taper layouts.

    Mirrors the geometry used by the layout generators: shoulder
    closures use the L/3 shoulder taper on ``params.shoulder_width_ft``;
    flagger alternating-flow closures use the one-lane two-way taper
    (§6B.08 ¶14, PR 2 geometry correction); other lane closures use the
    full merging taper L on ``params.lane_width_ft``.  Byte-identity
    with ``plan_sheet._make_x_mapping``'s ``taper_start_station`` is
    pinned by the tss-equivalence check.
    """
    from src.rules.spacing import (
        buffer_space,
        one_lane_two_way_taper_length,
        shoulder_taper_length,
        taper_length,
    )
    from src.rules.validators import _is_flagger_scenario

    if _is_flagger_scenario(params):
        taper = one_lane_two_way_taper_length()
    elif params.closure_type == "lane":
        taper = taper_length(params.speed_mph, params.lane_width_ft)
    else:
        taper = shoulder_taper_length(params.speed_mph, params.shoulder_width_ft)
    buf = buffer_space(
        params.speed_mph,
        jurisdiction=params.jurisdiction,
        work_zone_speed_mph=params.work_zone_speed_mph,
    )
    return params.work_zone_length_ft + buf + taper


def substitute_sign_description(
    label: str,
    station_ft: float,
    params: ScenarioParams,
    taper_start_station: float | None = None,
) -> tuple[str, str]:
    """Resolve a sign placement to ``(display_code, substituted_description)``.

    Single source for every parametric label substitution:

      * ``W20-2``  ROAD WORK XXX FT → distance from the sign back to the
        taper start (``station_ft - taper_start_station``; the taper
        start is derived from ``params`` when not supplied).
      * ``W3-5(NN)`` → ``ADVISORY SPEED NN`` (suffix parsed from the label).
      * ``W16-2a`` NEXT XXX FT plaque → ``station_ft - work_zone_length``
        (distance from the host W21-5aR to the work-zone upstream edge).
      * ``W7-3a``  NEXT XX MILES plaque → ``max(1, round(wz_len / 5280))``.
      * ``G20-1``  ROAD CONSTRUCTION (NEXT XXX FT) → work-zone length.
      * ``R2-1``   splits by station sign (see :func:`schedule_key`):
        entrance face carries ``params.work_zone_speed_mph``, the
        downstream restoration face carries ``params.speed_mph``.

    ``label`` may be a raw placement label or an already-split schedule
    key (``R2-1@entrance`` / ``R2-1@restoration``).  Unknown codes fall
    back to :func:`description_for`'s bare-code behavior.
    """
    key = label if label.startswith("R2-1@") else schedule_key(label, station_ft)
    code = display_code(key)
    desc = description_for(code)

    if code == "W20-2":
        if taper_start_station is None:
            taper_start_station = _taper_start_station(params)
        dist = station_ft - taper_start_station
        desc = f"ROAD WORK {dist:.0f} FT"
    elif code == "W3-5" and "(" in label:
        suffix = label.split("(", 1)[1].rstrip(")")
        desc = f"ADVISORY SPEED {suffix}"
    elif code == "W16-2a":
        w16_2a_distance_ft = int(round(station_ft - params.work_zone_length_ft))
        desc = f"NEXT {w16_2a_distance_ft:,} FT"
    elif code == "W7-3a":
        w7_3a_miles = max(1, round(params.work_zone_length_ft / 5280.0))
        desc = f"NEXT {w7_3a_miles} {'MILE' if w7_3a_miles == 1 else 'MILES'}"
    elif code == "G20-1":
        desc = desc.replace("XXX", f"{params.work_zone_length_ft:.0f}")
    elif key == "R2-1@entrance" and params.work_zone_speed_mph is not None:
        desc = f"SPEED LIMIT {params.work_zone_speed_mph:.0f} (work-zone speed posting)"
    elif key == "R2-1@restoration":
        desc = f"SPEED LIMIT {params.speed_mph:.0f} (posted-speed restoration)"

    return code, desc
