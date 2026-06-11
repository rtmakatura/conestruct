"""Night-operation adjustments to a generated device layout.

When the scenario carries ``is_night=True`` the quote already applies a
1.5x labor multiplier, but the placement list itself doesn't change —
contractors following the day-shift plan would arrive on site at 02:00
without warning lights on the taper drums and without temporary
illumination over the work area.  This module closes that gap.

Three adjustments fire whenever ``params.is_night`` is True:

* **Type C steady-burn warning lights on every taper drum.** One
  ``WARNING_LIGHT_TYPE_C`` placement is co-located with each drum in
  the taper region (stations between the upstream taper start and the
  downstream buffer start).  Tangent drums and signs are unaffected.
  MUTCD §6F.83 calls for steady-burn lights on the channelizing devices
  forming a taper at night.

* **Portable light plant at the upstream end of the taper.** A single
  ``PORTABLE_LIGHT_PLANT`` placement at ``taper_start_station`` with
  the same lateral offset as the most-upstream taper drum (i.e., the
  closure-side edge).  CDOT M&S §630.05.1 requires illumination of
  nighttime work zones.

* **Retroreflectivity advisory record.** No device added — a flag is
  surfaced through the audit trail so the crew narrative reminds the
  field crew that every cone, drum, sign, and barricade must be
  retroreflective and inspected at shift start (MUTCD §6F.02).

This module is a no-op when ``params.is_night`` is False: the
placements list is returned unchanged (a copy) and an empty list of
adjustment records.

Authoritative sources:
  - MUTCD 11th Ed., §6F.02 (retroreflectivity), §6F.83 (warning lights)
  - CDOT M&S §630.05.1 (work-zone illumination)
"""

from __future__ import annotations

from typing import Any

from src.rules.devices import DeviceType
from src.rules.spacing import (
    buffer_space,
    one_lane_two_way_taper_length,
    shoulder_taper_length,
    taper_length,
)
from src.rules.validators import DevicePlacement, ScenarioParams, _is_flagger_scenario


def _taper_bounds(params: ScenarioParams) -> tuple[float, float]:
    """Compute (taper_end_station, taper_start_station) from params.

    Mirrors the geometry math in ``src.generation.layout`` so callers
    don't have to thread the bounds through.  The taper occupies stations
    between the downstream buffer end (``taper_end_station``) and the
    upstream advance-warning lead (``taper_start_station``).
    """
    buf_len = buffer_space(params.speed_mph, jurisdiction=params.jurisdiction)
    taper_end_station = params.work_zone_length_ft + buf_len
    if _is_flagger_scenario(params):
        # Flagger alternating-flow: one-lane two-way taper (§6B.08 ¶14,
        # PR 2 geometry correction).
        taper_len = one_lane_two_way_taper_length()
    elif params.closure_type == "shoulder":
        taper_len = shoulder_taper_length(params.speed_mph, params.shoulder_width_ft)
    else:
        # Lane closure / mobile use the full merging taper.
        taper_len = taper_length(params.speed_mph, params.lane_width_ft)
    taper_start_station = taper_end_station + taper_len
    return taper_end_station, taper_start_station


def _is_taper_drum(p: DevicePlacement, taper_end: float, taper_start: float) -> bool:
    """A drum sits in the taper iff its station is in the taper extent.

    Tolerance of 0.5 ft handles floating-point round-off from the
    ``taper_start_station - t * taper_len`` computation in the layout
    generator without picking up tangent drums (which sit at
    ``station <= work_zone_length_ft + buffer < taper_end_station``).
    """
    return p.device_type == DeviceType.DRUM and (taper_end - 0.5) <= p.station_ft <= (
        taper_start + 0.5
    )


def _add_warning_lights_on_taper_drums(
    placements: list[DevicePlacement],
    taper_end: float,
    taper_start: float,
) -> tuple[list[DevicePlacement], dict[str, Any]]:
    """One Type C warning light co-located with each taper drum."""
    new_lights: list[DevicePlacement] = []
    for p in placements:
        if _is_taper_drum(p, taper_end, taper_start):
            new_lights.append(
                DevicePlacement(
                    device_type=DeviceType.WARNING_LIGHT_TYPE_C,
                    station_ft=p.station_ft,
                    offset_ft=p.offset_ft,
                )
            )
    n = len(new_lights)
    record = {
        "flag": "night_taper_lighting",
        "action": (
            f"Added {n} Type C steady-burn warning lights on taper drums for nighttime visibility."
        ),
        "devices_added": n,
        "rule": ("MUTCD §6F.83 — warning lights on channelizing devices in nighttime work zones"),
    }
    return placements + new_lights, record


_LIGHT_PLANT_INTO_WORK_ZONE_FT: float = 25.0
_LIGHT_PLANT_LATERAL_OFFSET_FT: float = 5.0


def _add_portable_light_plant(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> tuple[list[DevicePlacement], dict[str, Any]]:
    """One portable light plant just past the buffer/work-zone boundary.

    Placed 25 ft downstream of the buffer end so the plant clearly
    reads as "at the start of the work area" — the actual work zone,
    not the taper (which has its own warning-light decoration on every
    drum).  Pushed 5 ft past the closure-side lateral edge so the
    plant glyph sits outside any tangent channelizer column.

    Stationing convention: ``wz_start_station = work_zone_length_ft``
    is the upstream edge of the work zone (where the buffer ends and
    work begins from the driver's perspective).  Subtracting 25 ft
    moves the station inward, just past the buffer.  Clamped to a
    minimum of 0 ft so very short work zones don't push the plant
    past the downstream end.
    """
    if params.closure_type == "shoulder":
        closure_lateral = 2.0 * params.lane_width_ft + params.shoulder_width_ft
    else:
        closure_lateral = 2.0 * params.lane_width_ft
    plant_offset = closure_lateral + _LIGHT_PLANT_LATERAL_OFFSET_FT
    plant_station = max(0.0, params.work_zone_length_ft - _LIGHT_PLANT_INTO_WORK_ZONE_FT)

    plant = DevicePlacement(
        device_type=DeviceType.PORTABLE_LIGHT_PLANT,
        station_ft=plant_station,
        offset_ft=plant_offset,
    )
    record = {
        "flag": "night_work_area_lighting",
        "action": (
            "Added 1 portable light plant at the start of the work zone "
            f"({_LIGHT_PLANT_INTO_WORK_ZONE_FT:.0f} ft past the buffer) "
            "to illuminate the work area."
        ),
        "devices_added": 1,
        "rule": ("CDOT M&S §630.05.1 — illumination requirement for nighttime work zones"),
    }
    return placements + [plant], record


def _retroreflective_advisory() -> dict[str, Any]:
    """Advisory-only record — surfaces in the audit trail and crew narrative."""
    return {
        "flag": "night_retroreflective",
        "action": (
            "All devices, signs, and barricades must be retroreflective. "
            "Verify warehouse inventory before deployment. Inspect "
            "retroreflectivity at shift start."
        ),
        "devices_added": 0,
        "rule": ("MUTCD §6F.02 — retroreflectivity requirements for nighttime visibility"),
    }


def apply_night_adjustments(
    placements: list[DevicePlacement],
    params: ScenarioParams,
) -> tuple[list[DevicePlacement], list[dict[str, Any]]]:
    """Apply night-operation adjustments to a baseline layout.

    Args:
        placements: Layout from the generator, optionally already passed
            through ``apply_site_adjustments``.
        params: Scenario parameters that drove the baseline.  Adjustments
            fire only when ``params.is_night`` is True.

    Returns:
        ``(adjusted_placements, audit_records)``.  When ``is_night`` is
        False, returns ``(list(placements), [])`` — a copy of the input
        and an empty record list — so the caller can unconditionally
        unpack the tuple.
    """
    if not params.is_night:
        return list(placements), []

    taper_end, taper_start = _taper_bounds(params)
    out = list(placements)
    records: list[dict[str, Any]] = []

    out, rec = _add_warning_lights_on_taper_drums(out, taper_end, taper_start)
    records.append(rec)

    out, rec = _add_portable_light_plant(out, params)
    records.append(rec)

    records.append(_retroreflective_advisory())

    return out, records
