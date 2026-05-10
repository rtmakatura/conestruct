"""Device vocabulary — bridge between the MUTCD symbol taxonomy and the rules engine.

The 15-class taxonomy from ``skills/mutcd-symbols/SKILL.md`` is exposed here as
a string enum (``DeviceType``) and a catalog of immutable specifications
(``DeviceSpec``).  Downstream layers — the layout engine, the device-list
exporter, and the plan-sheet renderer — consume this module to ask
"how does device X behave?" without re-encoding taxonomy details.

Authoritative sources:
  - ``skills/mutcd-symbols/SKILL.md`` (15-class taxonomy with physical specs)
  - CDOT Standard Specifications Section 630 (pay item names, numbers, units)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

# ---------------------------------------------------------------------------
# DeviceType enum
# ---------------------------------------------------------------------------


class DeviceType(StrEnum):
    """The 15 traffic control device classes used throughout the system."""

    CONE = "CONE"
    DRUM = "DRUM"
    TUBULAR_MARKER = "TUBULAR_MARKER"
    BARRICADE_TYPE_II = "BARRICADE_TYPE_II"
    BARRICADE_TYPE_III = "BARRICADE_TYPE_III"
    LONGITUDINAL_CHANNELIZER = "LONGITUDINAL_CHANNELIZER"
    ARROW_BOARD = "ARROW_BOARD"
    PCMS = "PCMS"
    TRUCK_MOUNTED_ATTENUATOR = "TRUCK_MOUNTED_ATTENUATOR"
    TEMPORARY_BARRIER = "TEMPORARY_BARRIER"
    FLAGGER_STATION = "FLAGGER_STATION"
    TEMPORARY_SIGNAL = "TEMPORARY_SIGNAL"
    SIGN_GENERIC = "SIGN_GENERIC"
    DETOUR_MARKER = "DETOUR_MARKER"
    CHANNELIZER_OPTIONAL = "CHANNELIZER_OPTIONAL"
    # Nighttime visibility devices — added by apply_night_adjustments when
    # params.is_night is True; never emitted by the layout generators.
    WARNING_LIGHT_TYPE_C = "WARNING_LIGHT_TYPE_C"
    PORTABLE_LIGHT_PLANT = "PORTABLE_LIGHT_PLANT"


# ---------------------------------------------------------------------------
# DeviceSpec dataclass
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class DeviceSpec:
    """Immutable specification for one device class.

    Fields:
        device_type: The enum member this spec describes.
        description: One-line plain-English description.
        unit: CDOT pay item unit (EACH, LF, SF, HOUR, ...).
        cdot_pay_item: CDOT Section 630 pay item name, or None if not yet
            verified against the Spec Book.
        cdot_pay_item_number: CDOT pay item number (e.g., "630-80220"), or
            None if not yet verified.
        is_channelizer: True for devices placed at computed taper/tangent
            spacing (cone, drum, tubular marker, optional channelizer).
        is_sign: True for sign devices placed at advance warning positions.
        is_drawn: True if the device has a sprite on the plan sheet PDF.
        sprite_filename: Filename of the device sprite under ``assets/sprites/``,
            or None until sprites are extracted.
    """

    device_type: DeviceType
    description: str
    unit: str
    cdot_pay_item: str | None
    cdot_pay_item_number: str | None
    is_channelizer: bool
    is_sign: bool
    is_drawn: bool
    sprite_filename: str | None


# ---------------------------------------------------------------------------
# Device catalog
# ---------------------------------------------------------------------------

# Source for unit assignments: CDOT Standard Specifications Section 630.
# Pay item names and numbers are TODO until verified against the 2023 Spec Book.
# Sprite filenames are None until sprites are extracted from the labeled
# WSDOT dataset.

DEVICE_CATALOG: dict[DeviceType, DeviceSpec] = {
    DeviceType.CONE: DeviceSpec(
        device_type=DeviceType.CONE,
        description="28- or 36-inch traffic cone with retroreflective bands",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=True,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.DRUM: DeviceSpec(
        device_type=DeviceType.DRUM,
        description="36-inch channelizing drum with alternating orange/white stripes",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=True,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.TUBULAR_MARKER: DeviceSpec(
        device_type=DeviceType.TUBULAR_MARKER,
        description="36-inch flexible tubular marker (delineator) on a weighted base",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=True,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.BARRICADE_TYPE_II: DeviceSpec(
        device_type=DeviceType.BARRICADE_TYPE_II,
        description="Type II barricade — two horizontal striped rails, 36–42 in tall",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.BARRICADE_TYPE_III: DeviceSpec(
        device_type=DeviceType.BARRICADE_TYPE_III,
        description="Type III barricade — three horizontal striped rails, full lane width",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.LONGITUDINAL_CHANNELIZER: DeviceSpec(
        device_type=DeviceType.LONGITUDINAL_CHANNELIZER,
        description="Continuous longitudinal channelizing device (water-filled or plastic)",
        unit="LF",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.ARROW_BOARD: DeviceSpec(
        device_type=DeviceType.ARROW_BOARD,
        description="Trailer-mounted flashing arrow board (Type A, B, or C)",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.PCMS: DeviceSpec(
        device_type=DeviceType.PCMS,
        description="Portable Changeable Message Sign (full-size or mPCMS)",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.TRUCK_MOUNTED_ATTENUATOR: DeviceSpec(
        device_type=DeviceType.TRUCK_MOUNTED_ATTENUATOR,
        description="Shadow vehicle with NCHRP 350 / MASH-rated truck-mounted attenuator",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.TEMPORARY_BARRIER: DeviceSpec(
        device_type=DeviceType.TEMPORARY_BARRIER,
        description="Temporary concrete or steel barrier (F-shape, Type 2, zipper, etc.)",
        unit="LF",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.FLAGGER_STATION: DeviceSpec(
        device_type=DeviceType.FLAGGER_STATION,
        description="Flagger position with STOP/SLOW paddle and PPE",
        unit="HOUR",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.TEMPORARY_SIGNAL: DeviceSpec(
        device_type=DeviceType.TEMPORARY_SIGNAL,
        description="Portable traffic signal (standard, compact, AFAD, or RDTS)",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.SIGN_GENERIC: DeviceSpec(
        device_type=DeviceType.SIGN_GENERIC,
        description="Generic construction sign (W-, R-, or G-series); MUTCD code per scenario",
        unit="SF",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=True,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.DETOUR_MARKER: DeviceSpec(
        device_type=DeviceType.DETOUR_MARKER,
        description="M4-9-series detour directional sign with arrow",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=True,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.CHANNELIZER_OPTIONAL: DeviceSpec(
        device_type=DeviceType.CHANNELIZER_OPTIONAL,
        description="Generic optional-deployment channelizing device (contractor's choice)",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=True,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.WARNING_LIGHT_TYPE_C: DeviceSpec(
        device_type=DeviceType.WARNING_LIGHT_TYPE_C,
        description="Type C steady-burn warning light, attached to channelizing device",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
    DeviceType.PORTABLE_LIGHT_PLANT: DeviceSpec(
        device_type=DeviceType.PORTABLE_LIGHT_PLANT,
        description="Portable light plant for work area illumination",
        unit="EACH",  # CDOT Sec 630 (TODO: confirm pay item name/number)
        cdot_pay_item=None,
        cdot_pay_item_number=None,
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
    ),
}


# ---------------------------------------------------------------------------
# Helper queries
# ---------------------------------------------------------------------------


def get_channelizers() -> list[DeviceType]:
    """Devices placed at computed taper/tangent spacing.

    Used by the layout engine to know which device types follow the
    in-taper / on-tangent spacing rules from MUTCD §6C.09.
    """
    return [device_type for device_type, spec in DEVICE_CATALOG.items() if spec.is_channelizer]


def get_sign_devices() -> list[DeviceType]:
    """Devices placed at advance warning sign positions (Table 6B-1)."""
    return [device_type for device_type, spec in DEVICE_CATALOG.items() if spec.is_sign]


def get_drawn_devices() -> list[DeviceType]:
    """Devices that appear on the plan sheet PDF (have a sprite)."""
    return [device_type for device_type, spec in DEVICE_CATALOG.items() if spec.is_drawn]


def get_field_only_devices() -> list[DeviceType]:
    """Devices that appear on the device list but not on the plan sheet.

    Reserved for forward compatibility — all 15 current taxonomy members
    are drawn, so this returns an empty list today.  Items genuinely
    field-only (work vehicles, pilot cars, PPE) are not in the 15-class
    taxonomy and are handled in the export module.
    """
    return [device_type for device_type, spec in DEVICE_CATALOG.items() if not spec.is_drawn]
