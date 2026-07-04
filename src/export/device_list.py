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

from src.rules.devices import DEVICE_CATALOG, DeviceType, cone_display_name, device_row_sort_key
from src.rules.sign_codes import schedule_key, substitute_sign_description
from src.rules.validators import DevicePlacement, ScenarioParams, scenario_display_name

# Light-gray header fill from the V1 spec.
_HEADER_FILL: PatternFill = PatternFill(
    fill_type="solid", start_color="FFD9D9D9", end_color="FFD9D9D9"
)
_HEADER_FONT: Font = Font(bold=True)
_LEFT_ALIGN: Alignment = Alignment(horizontal="left", vertical="center")


def _apply_left_align(sheet) -> None:
    """Left-align every populated cell on ``sheet``.

    Excel right-aligns numbers and left-aligns text by default; this
    forces a consistent visual alignment across columns.  Bold/fill
    on header cells is preserved (alignment is independent of font).
    """
    for row in sheet.iter_rows(
        min_row=1, max_row=sheet.max_row, min_col=1, max_col=sheet.max_column
    ):
        for cell in row:
            cell.alignment = _LEFT_ALIGN


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
    "CDOT Pay Item #",
    "Unit",
    "Quantity",
    "Notes",
)

_SIGN_GENERIC_NOTE: str = (
    "Unit is EACH for V1; CDOT Spec 630 bills by SF — convert when sign sizes are known."
)
_BARRICADE_TYPE_II_NOTE: str = (
    "Unit is EACH for V1; CDOT Spec 630 bills Type I/II under Construction "
    "Traffic Sign (Special) by SF — convert when panel dimensions are known."
)
_CHANNELIZER_OPTIONAL_NOTE: str = (
    "Optional — apply probability weight as appropriate per engineer discretion."
)


def _row_key(placement: DevicePlacement) -> tuple[DeviceType, str | None]:
    """Aggregation key for one placement.

    Signs are split out by schedule key (the bare label, except R2-1
    which splits into entrance/restoration faces — see
    :func:`src.rules.sign_codes.schedule_key`) so a W20-1 row and a
    G20-5P row are counted separately, and the two R2-1 faces on a
    reduced-speed plan each get their own row instead of one merged
    "SPEED LIMIT XX" line.  Non-sign devices are aggregated solely by
    type.  Unlabeled signs fall through to a single "(unlabeled)" group.
    """
    if placement.device_type == DeviceType.SIGN_GENERIC:
        if placement.label is None:
            return (DeviceType.SIGN_GENERIC, None)
        return (DeviceType.SIGN_GENERIC, schedule_key(placement.label, placement.station_ft))
    return (placement.device_type, None)


def _row_for(
    item_number: int,
    device_type: DeviceType,
    label: str | None,
    quantity: int,
    representative: DevicePlacement | None,
    params: ScenarioParams,
) -> tuple[int, str, str, str, str, int, str]:
    """Build a single Device-List row tuple in column order.

    ``label`` is the aggregation key (schedule key for signs);
    ``representative`` is one placement from the group (lowest station)
    so the shared substitution helper can resolve station-dependent
    parametric values — keeping the XLSX descriptions identical to the
    PDF schedule / off-page table.
    """
    spec = DEVICE_CATALOG[device_type]
    pay_item_number = spec.cdot_pay_item_number or "TODO"

    if device_type == DeviceType.SIGN_GENERIC:
        if label is None:
            description = "Generic construction sign (unlabeled)"
            type_label = "SIGN_GENERIC (unlabeled)"
        else:
            station_ft = representative.station_ft if representative is not None else 0.0
            code, human = substitute_sign_description(label, station_ft, params)
            description = f"{code} {human}".strip() if human != code else code
            type_label = "SIGN_GENERIC"
        unit = "EACH"  # V1 override; catalog says SF.
        notes = _SIGN_GENERIC_NOTE
    elif device_type == DeviceType.BARRICADE_TYPE_II:
        description = spec.description
        type_label = device_type.value
        unit = "EACH"  # V1 override; catalog says SF per Table 630-7 footnote.
        notes = _BARRICADE_TYPE_II_NOTE
    elif device_type == DeviceType.CONE:
        # Resolve the size for the posted speed (§6F.65) — same helper the
        # narrative, UI breakdown, and plan-sheet legend use (Refs #101).
        description = cone_display_name(params.speed_mph)
        type_label = device_type.value
        unit = spec.unit
        notes = ""
    else:
        description = spec.description
        type_label = device_type.value
        unit = spec.unit
        notes = _CHANNELIZER_OPTIONAL_NOTE if device_type == DeviceType.CHANNELIZER_OPTIONAL else ""

    return (item_number, type_label, description, pay_item_number, unit, quantity, notes)


def _populate_device_list_sheet(
    sheet,
    placements: list[DevicePlacement],
    params: ScenarioParams,
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

    counts: Counter[tuple[DeviceType, str | None]] = Counter()
    # Lowest-station member of each group — deterministic representative
    # for station-dependent substitutions in _row_for.
    representatives: dict[tuple[DeviceType, str | None], DevicePlacement] = {}
    for p in placements:
        key = _row_key(p)
        counts[key] += 1
        current = representatives.get(key)
        if current is None or p.station_ft < current.station_ft:
            representatives[key] = p

    # Sort via the shared device_row_sort_key helper (issue #88): signs
    # first (by schedule key, unlabeled last), then channelizing devices,
    # then equipment, each alphabetical by display name.  Same helper the
    # UI breakdown and crew equipment list use, so the three agree.
    aggregated: list[tuple[DeviceType, str | None, int]] = sorted(
        ((dt, label, n) for (dt, label), n in counts.items()),
        key=lambda row: device_row_sort_key(row[0], row[1]),
    )

    for item_number, (device_type, label, quantity) in enumerate(aggregated, start=1):
        representative = representatives.get((device_type, label))
        sheet.append(_row_for(item_number, device_type, label, quantity, representative, params))
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
        # UX-11: display name, not the raw "lane" / "shoulder" enum.
        ("Closure type", scenario_display_name(params)),
        ("Work zone length (ft)", params.work_zone_length_ft),
        ("Jurisdiction", params.jurisdiction),
        ("Generated", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )

    sheet.append(("Field", "Value"))
    header_row = sheet[1]
    for cell in header_row:
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL

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
    aggregated = _populate_device_list_sheet(device_sheet, placements, params)
    summary_sheet = workbook.create_sheet("Summary")
    _populate_summary_sheet(summary_sheet, placements, params, aggregated)
    for sheet in workbook.worksheets:
        _apply_left_align(sheet)
    workbook.save(output_path)
    return output_path


if __name__ == "__main__":
    import os

    from src.generation.layout import generate_shoulder_closure_divided

    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
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
        key=lambda r: device_row_sort_key(r[0], r[1]),
    )
    print(f"{'#':>3}  {'Device Type':25s}  {'Label':12s}  {'Qty':>4s}")
    print("-" * 52)
    for i, (device_type, label, n) in enumerate(aggregated, start=1):
        print(f"{i:>3}  {device_type.value:25s}  {(label or '-'):12s}  {n:>4d}")
    print("-" * 52)
    print(f"     {'TOTAL':25s}  {'':12s}  {len(placements):>4d}")
