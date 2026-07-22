"""aggregate_device_rows is the single placement->row aggregation (spec §4.3).

One aggregation, two consumers: the XLSX device list (bid-quantity
authority) and the plan sheet's on-sheet device summary (issue #150).
These tests pin the helper's contract: quantities sum to the placement
count, ordering follows the shared device_row_sort_key, representatives
are the lowest-station member of each group, and quantities scale with
the scenario — never constants.
"""

from __future__ import annotations

from dataclasses import replace

from src.generation.layout import generate_shoulder_closure_divided
from src.rules.device_aggregation import (
    AggregatedDeviceRow,
    aggregate_device_rows,
    row_key,
)
from src.rules.devices import DeviceType, device_row_sort_key
from src.rules.validators import ScenarioParams


def _params(**overrides) -> ScenarioParams:
    base = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=800.0,
        lane_width_ft=12.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    return replace(base, **overrides) if overrides else base


def test_quantities_sum_to_placement_count() -> None:
    placements = generate_shoulder_closure_divided(_params())
    rows = aggregate_device_rows(placements)
    assert placements  # generator invariant: never empty
    assert sum(r.quantity for r in rows) == len(placements)
    assert all(isinstance(r, AggregatedDeviceRow) for r in rows)


def test_rows_sorted_by_shared_sort_key() -> None:
    placements = generate_shoulder_closure_divided(_params())
    rows = aggregate_device_rows(placements)
    keys = [device_row_sort_key(r.device_type, r.label) for r in rows]
    assert keys == sorted(keys)


def test_representative_is_lowest_station_of_its_group() -> None:
    placements = generate_shoulder_closure_divided(_params())
    for r in aggregate_device_rows(placements):
        group_key = (r.device_type, r.label)
        group_stations = [p.station_ft for p in placements if row_key(p) == group_key]
        assert len(group_stations) == r.quantity
        assert r.representative.station_ft == min(group_stations)


def test_quantity_scales_with_work_zone_length() -> None:
    """No constants: a longer zone yields more channelizers (spec §4.3)."""

    def channelizers(rows: list[AggregatedDeviceRow]) -> int:
        return sum(r.quantity for r in rows if r.device_type in (DeviceType.CONE, DeviceType.DRUM))

    short = aggregate_device_rows(
        generate_shoulder_closure_divided(_params(work_zone_length_ft=500.0))
    )
    long = aggregate_device_rows(
        generate_shoulder_closure_divided(_params(work_zone_length_ft=5000.0))
    )
    assert channelizers(long) > channelizers(short)
