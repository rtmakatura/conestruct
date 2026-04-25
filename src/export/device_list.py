"""Build a CDOT Spec 630 device-list spreadsheet from a placement list.

Aggregates the per-device placements emitted by the layout engine into
the by-pay-item summary that appears on the engineer's plan set as the
"Tabulation of Quantities" page.

Authoritative sources:
  - CDOT Standard Specifications Section 630 (pay item names, units)
  - CDOT M&S Standard Plan S-630-1 (typical device-list format)
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from src.rules.devices import DEVICE_CATALOG, DeviceType
from src.rules.validators import DevicePlacement, ScenarioParams

# Light-gray header fill from the V1 spec.
_HEADER_FILL: PatternFill = PatternFill(
    fill_type="solid", start_color="FFD9D9D9", end_color="FFD9D9D9"
)
_HEADER_FONT: Font = Font(bold=True)

_COLUMN_WIDTHS: dict[str, int] = {
    "A": 8,  # Item #
    "B": 25,  # Device Type
    "C": 40,  # Description
    "D": 25,  # CDOT Pay Item
    "E": 8,  # Unit
    "F": 10,  # Quantity
    "G": 50,  # Notes
}

_DEVICE_LIST_HEADERS: tuple[str, ...] = (
    "Item #",
    "Device Type",
    "Description",
    "CDOT Pay Item",
    "Unit",
    "Quantity",
    "Notes",
)

# Minimal sign-code → human-readable name map for the sign labels emitted
# by the Phase 3 layout.  Lookup is best-effort; unknown labels fall back
# to the bare code.  A complete MUTCD sign dictionary is Phase 4b work.
_SIGN_LABEL_NAMES: dict[str, str] = {
    "W20-1": "ROAD WORK AHEAD",
    "W20-2": "ROAD WORK XXX FT",
    "W21-5aR": "RIGHT SHOULDER CLOSED AHEAD",
    "G20-2": "END ROAD WORK",
    "G20-5P": "WORK ZONE plaque",
    "R2-6P": "FINES DOUBLE plaque",
}

_SIGN_GENERIC_NOTE: str = (
    "Unit is EACH for V1; CDOT Spec 630 bills by SF — convert when sign sizes are known."
)
_CHANNELIZER_OPTIONAL_NOTE: str = (
    "Optional — apply probability weight as appropriate per engineer discretion."
)


def _row_key(placement: DevicePlacement) -> tuple[DeviceType, str | None]:
    """Aggregation key for one placement.

    Signs are split out by label so a W20-1 row and a G20-5P row are
    counted separately; non-sign devices are aggregated solely by type.
    Unlabeled signs fall through to a single "(unlabeled)" group.
    """
    if placement.device_type == DeviceType.SIGN_GENERIC:
        return (DeviceType.SIGN_GENERIC, placement.label)
    return (placement.device_type, None)


def _row_for(
    item_number: int,
    device_type: DeviceType,
    label: str | None,
    quantity: int,
) -> tuple[int, str, str, str, str, int, str]:
    """Build a single Device-List row tuple in column order."""
    spec = DEVICE_CATALOG[device_type]
    pay_item = spec.cdot_pay_item or "TODO"

    if device_type == DeviceType.SIGN_GENERIC:
        if label is None:
            description = "Generic construction sign (unlabeled)"
            type_label = "SIGN_GENERIC (unlabeled)"
        else:
            human = _SIGN_LABEL_NAMES.get(label, "")
            description = f"{label} {human}".strip()
            type_label = "SIGN_GENERIC"
        unit = "EACH"  # V1 override; catalog says SF.
        notes = _SIGN_GENERIC_NOTE
    else:
        description = spec.description
        type_label = device_type.value
        unit = spec.unit
        notes = _CHANNELIZER_OPTIONAL_NOTE if device_type == DeviceType.CHANNELIZER_OPTIONAL else ""

    return (item_number, type_label, description, pay_item, unit, quantity, notes)


def _populate_device_list_sheet(
    sheet,
    placements: list[DevicePlacement],
) -> list[tuple[DeviceType, str | None, int]]:
    """Write the Device-List sheet and return the aggregated rows."""
    sheet.title = "Device List"
    sheet.append(_DEVICE_LIST_HEADERS)
    for col_letter in _COLUMN_WIDTHS:
        sheet.column_dimensions[col_letter].width = _COLUMN_WIDTHS[col_letter]

    header_row = sheet[1]
    for cell in header_row:
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center")

    counts = Counter(_row_key(p) for p in placements)
    # Sort: device_type alphabetically by enum value, then label
    # (with None last so unlabeled signs trail the labeled ones).
    aggregated: list[tuple[DeviceType, str | None, int]] = sorted(
        ((dt, label, n) for (dt, label), n in counts.items()),
        key=lambda row: (row[0].value, row[1] is None, row[1] or ""),
    )

    for item_number, (device_type, label, quantity) in enumerate(aggregated, start=1):
        sheet.append(_row_for(item_number, device_type, label, quantity))
        sheet.cell(row=item_number + 1, column=6).number_format = "0"

    sheet.freeze_panes = "A2"
    return aggregated


def _populate_summary_sheet(
    sheet,
    placements: list[DevicePlacement],
    params: ScenarioParams,
    aggregated_rows: list[tuple[DeviceType, str | None, int]],
) -> None:
    """Write the Summary sheet."""
    sheet.title = "Summary"
    sheet.column_dimensions["A"].width = 28
    sheet.column_dimensions["B"].width = 30

    rows = (
        ("Total device count", len(placements)),
        ("Total unique device types", len(aggregated_rows)),
        ("Speed (mph)", params.speed_mph),
        ("Closure type", params.closure_type),
        ("Work zone length (ft)", params.work_zone_length_ft),
        ("Jurisdiction", params.jurisdiction),
        ("Generated", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )

    sheet.append(("Field", "Value"))
    header_row = sheet[1]
    for cell in header_row:
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for label, value in rows:
        sheet.append((label, value))


def export_device_list(
    placements: list[DevicePlacement],
    params: ScenarioParams,
    output_path: str = "device_list.xlsx",
) -> str:
    """Write a CDOT-format device-list workbook for ``placements``.

    Returns the absolute or relative path written, matching ``output_path``.
    """
    workbook = Workbook()
    device_sheet = workbook.active
    aggregated = _populate_device_list_sheet(device_sheet, placements)
    summary_sheet = workbook.create_sheet("Summary")
    _populate_summary_sheet(summary_sheet, placements, params, aggregated)
    workbook.save(output_path)
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
    output = export_device_list(placements, params, "device_list.xlsx")

    size_bytes = os.path.getsize(output)
    print(f"Wrote {output} ({size_bytes} bytes)")
    print()

    counts = Counter(_row_key(p) for p in placements)
    aggregated = sorted(
        ((dt, label, n) for (dt, label), n in counts.items()),
        key=lambda r: (r[0].value, r[1] is None, r[1] or ""),
    )
    print(f"{'#':>3}  {'Device Type':25s}  {'Label':12s}  {'Qty':>4s}")
    print("-" * 52)
    for i, (device_type, label, n) in enumerate(aggregated, start=1):
        print(f"{i:>3}  {device_type.value:25s}  {(label or '-'):12s}  {n:>4d}")
    print("-" * 52)
    print(f"     {'TOTAL':25s}  {'':12s}  {len(placements):>4d}")
