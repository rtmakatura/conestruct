"""Shared placement→row aggregation (spec §4.1/§4.3, issue #150).

One aggregation, two consumers: the XLSX device list (the bid-quantity
authority) and the plan sheet's on-sheet device summary.  A single
helper is what makes "the sheet shows the spreadsheet's numbers" true
by construction instead of by parallel arithmetic.

Jurisdiction count-deltas are NOT applied here yet — the breakdown
endpoint applies them downstream, the printed surfaces don't.  Issue
#151 (Ryan ruling, 2026-07-21) moves them into this helper so all three
surfaces shift in one change.
"""

from __future__ import annotations

from collections import Counter
from typing import NamedTuple

from src.rules.devices import DeviceType, device_row_sort_key
from src.rules.sign_codes import schedule_key
from src.rules.validators import DevicePlacement


class AggregatedDeviceRow(NamedTuple):
    device_type: DeviceType | None  # None: unmapped jurisdiction add, or field equipment (#373)
    label: str | None  # schedule key for signs; None for other devices
    quantity: int
    representative: DevicePlacement | None  # lowest-station member; None for a delta-only row
    # Jurisdiction count-delta provenance (issue #151).  A row is
    # jurisdiction_required when a fired ``add_device`` delta topped it up
    # or added it.  ``display_override`` carries the jurisdiction's device
    # name for a row with no backing placement (a delta-only add); a
    # topped-up real row leaves it None and keeps its catalog naming.
    jurisdiction_required: bool = False
    jurisdiction_source: dict | None = None
    display_override: str | None = None
    # R117 Q1b: how many of ``quantity`` the jurisdiction's rules added.
    # 0 on a row the layout already carried enough of (the rule is met,
    # nothing was raised).
    jurisdiction_added: int = 0
    # #379: a sentence every surface prints beside the row when the device
    # runs in one mode only (an arrow board on a flagger plan: caution).
    mode_note: str | None = None
    # #373: field equipment with no placement (the flagger plan's pilot
    # car).  The sentence every surface prints beside the row; such a row
    # has ``device_type=None``, ``display_override`` set and no
    # jurisdiction provenance.
    equipment_note: str | None = None


# #373: the pilot car is vehicle-mounted field equipment, not a placement
# (layout.py's flagger branch places no roadside G20-4), so it joins the
# rows here rather than the 15-class DeviceType taxonomy (devices.py's
# get_field_only_devices).  One name and one note for every surface.
PILOT_CAR_NAME: str = 'Pilot car with G20-4 "PILOT CAR/FOLLOW ME" sign'
PILOT_CAR_NOTE: str = (
    "G20-4 mounted on the rear of the vehicle (S-630-1 Sheet 26: "
    "vehicle-mounted, not a roadside placement)."
)


def pilot_car_row() -> AggregatedDeviceRow:
    """The one pilot-car row a flagger plan with ``pilotCar`` lists."""
    return AggregatedDeviceRow(
        device_type=None,
        label=None,
        quantity=1,
        representative=None,
        display_override=PILOT_CAR_NAME,
        equipment_note=PILOT_CAR_NOTE,
    )


def row_key(placement: DevicePlacement) -> tuple[DeviceType, str | None]:
    """Aggregation key for one placement.

    Signs are split out by schedule key (the bare label, except R2-1
    which splits into entrance/restoration faces — see
    :func:`src.rules.sign_codes.schedule_key`) so a W20-1 row and a
    G20-5P row are counted separately.  Non-sign devices are aggregated
    solely by type.  Unlabeled signs fall through to a single
    "(unlabeled)" group.
    """
    if placement.device_type == DeviceType.SIGN_GENERIC:
        if placement.label is None:
            return (DeviceType.SIGN_GENERIC, None)
        return (DeviceType.SIGN_GENERIC, schedule_key(placement.label, placement.station_ft))
    return (placement.device_type, None)


def aggregate_device_rows(placements: list[DevicePlacement]) -> list[AggregatedDeviceRow]:
    """Aggregate placements into sorted per-type/per-schedule-key rows.

    Sort order is the shared ``device_row_sort_key`` (issue #88) so the
    XLSX, the UI breakdown, the crew equipment list, and the on-sheet
    summary all agree.  Each row carries its lowest-station member as a
    deterministic representative for station-dependent substitutions.
    """
    counts: Counter[tuple[DeviceType, str | None]] = Counter()
    representatives: dict[tuple[DeviceType, str | None], DevicePlacement] = {}
    for p in placements:
        key = row_key(p)
        counts[key] += 1
        current = representatives.get(key)
        if current is None or p.station_ft < current.station_ft:
            representatives[key] = p

    # Sorted on the (type, label) key before the rows are built, where the
    # type is still the placement's non-optional DeviceType; same key, same
    # stable order as sorting the built rows.
    return [
        AggregatedDeviceRow(dt, label, n, representatives[(dt, label)])
        for (dt, label), n in sorted(
            counts.items(), key=lambda kv: device_row_sort_key(kv[0][0], kv[0][1])
        )
    ]
