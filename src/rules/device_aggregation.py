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
    device_type: DeviceType
    label: str | None  # schedule key for signs; None for other devices
    quantity: int
    representative: DevicePlacement  # lowest-station member of the group


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

    return sorted(
        (
            AggregatedDeviceRow(dt, label, n, representatives[(dt, label)])
            for (dt, label), n in counts.items()
        ),
        key=lambda row: device_row_sort_key(row.device_type, row.label),
    )
