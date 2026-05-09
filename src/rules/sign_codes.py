"""Single source of truth for MUTCD sign-code → human description lookup.

Consolidates the parallel dictionaries that previously lived in
``src/rendering/plan_sheet.py``, ``src/export/device_list.py``,
``src/export/quote_generator.py``, and ``src/narrative/crew_narrative.py``.
The duplicated dicts had drifted out of sync, so codes added to the
generators (e.g. G20-1, W20-5R, W4-2R) showed up correctly in the
plan-sheet PDF but as bare codes in the device-list xlsx.

Placeholder substitution (``XXX`` -> actual distance for W20-2 and
G20-1) is the consumer's responsibility — the literal "XXX" template
is what lives here.

Authoritative source: MUTCD 11th Edition, Part 6 (Temporary Traffic
Control), supplemented by CDOT M&S Standard Plan S-630-1.
"""

from __future__ import annotations

SIGN_DESCRIPTIONS: dict[str, str] = {
    # Warning (W-series)
    "W20-1": "ROAD WORK AHEAD",
    "W20-2": "ROAD WORK XXX FT",
    "W20-4": "ONE LANE ROAD AHEAD",
    "W20-5R": "RIGHT LANE CLOSED AHEAD",
    "W20-7": "FLAGGER AHEAD",
    "W20-7a": "AFAD AHEAD",
    "W3-4": "BE PREPARED TO STOP",
    "W21-1a": "WORKERS",
    "W21-5": "SHOULDER WORK",
    "W21-5aR": "RIGHT SHOULDER CLOSED AHEAD",
    "W21-5aL": "LEFT SHOULDER CLOSED AHEAD",
    "W4-2R": "RIGHT LANE ENDS",
    # Guide (G-series)
    "G20-1": "ROAD CONSTRUCTION (NEXT XXX FT)",
    "G20-2": "END ROAD WORK",
    "G20-4": "PILOT CAR FOLLOW ME",
    "G20-5P": "CONSTRUCTION ZONE plaque",
    # Regulatory (R-series)
    "R9-9": "SIDEWALK CLOSED — USE OTHER SIDE",
    "R2-6P": "FINES DOUBLE plaque",
    # Route / school (M-series, S-series)
    "M4-9a": "BIKE DETOUR",
    "S1-1": "SCHOOL",
}


def description_for(code: str) -> str:
    """Return the human-readable description for ``code``.

    Falls back to the bare code when unknown so renderers and
    exporters still produce a non-empty cell rather than dropping the
    label entirely.  Placeholders (e.g. ``XXX`` in ``W20-2``) are
    returned literally; substitution lives at the call site that knows
    the actual distance.
    """
    return SIGN_DESCRIPTIONS.get(code, code)
