"""Device vocabulary — bridge between the MUTCD symbol taxonomy and the rules engine.

The 15-class taxonomy from ``skills/mutcd-symbols/SKILL.md`` is exposed here as
a string enum (``DeviceType``) and a catalog of immutable specifications
(``DeviceSpec``).  Downstream layers — the layout engine, the device-list
exporter, and the plan-sheet renderer — consume this module to ask
"how does device X behave?" without re-encoding taxonomy details.

Authoritative sources for the CDOT pay-item fields:
  - Pay item NAMES and units: CDOT 2023 Standard Specifications, Section 630
    (Construction Zone Traffic Control), subsection 630.18 (Basis of Payment).
  - Pay item NUMBERS: CDOT EEMA Master Item Code Book, Spec Year 05, dated
    2024-02-09.  CDOT keeps the numeric ``630-XXXXX`` bid-item codes current
    in EEMA independently of spec-book reissues; the codes apply to projects
    bid under the 2023 spec book.

See ``docs/cdot_pay_items.md`` for the full mapping reference, ambiguous
mappings, and subsidiary-item handling.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum, StrEnum

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
        cdot_pay_item: CDOT Section 630.18 pay item name (verbatim wording
            from the 2023 Spec Book), or None for subsidiary items.
        cdot_pay_item_number: CDOT bid-item number from the EEMA Item Code
            Book (e.g., "630-80380"), or the literal string "subsidiary"
            for devices that have no standalone pay item.
        is_channelizer: True for devices placed at computed taper/tangent
            spacing (cone, drum, tubular marker, optional channelizer).
        is_sign: True for sign devices placed at advance warning positions.
        is_drawn: True if the device has a sprite on the plan sheet PDF.
        sprite_filename: Filename of the device sprite under ``assets/sprites/``,
            or None until sprites are extracted.
        spec_reference: Section 630 subsection citation (e.g., "§630.18"),
            or None if not applicable.
        field_notes: Free-text notes about ambiguous mappings, subsidiary
            relationships, or V1 simplifications.  None for direct mappings
            with no caveats.
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
    spec_reference: str | None = None
    field_notes: str | None = None


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------


def cone_display_name(speed_mph: float) -> str:
    """Return the size-appropriate cone label per MUTCD §6F.65.

    36-inch cones are required at speeds ≥45 mph; 28-inch cones are
    acceptable below that threshold. The catalog description above is
    intentionally vague ("28- or 36-inch …") — rendering surfaces
    (plan-sheet legend, crew narrative, device-breakdown panel) call
    this helper to print the actual size for the posted speed.
    """
    return "Traffic Cone (36-inch)" if speed_mph >= 45 else "Traffic Cone (28-inch)"


# ---------------------------------------------------------------------------
# Device catalog
# ---------------------------------------------------------------------------

DEVICE_CATALOG: dict[DeviceType, DeviceSpec] = {
    DeviceType.CONE: DeviceSpec(
        device_type=DeviceType.CONE,
        description="28- or 36-inch traffic cone with retroreflective bands",
        unit="EACH",
        cdot_pay_item="Traffic Cone",
        cdot_pay_item_number="630-80380",
        is_channelizer=True,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.05, §630.18",
    ),
    DeviceType.DRUM: DeviceSpec(
        device_type=DeviceType.DRUM,
        description="36-inch channelizing drum with alternating orange/white stripes",
        unit="EACH",
        cdot_pay_item="Drum Channelizing Device",
        cdot_pay_item_number="630-80360",
        is_channelizer=True,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.17, §630.18",
    ),
    DeviceType.TUBULAR_MARKER: DeviceSpec(
        device_type=DeviceType.TUBULAR_MARKER,
        description="36-inch flexible tubular marker (delineator) on a weighted base",
        unit="EACH",
        cdot_pay_item="Tubular Marker",
        cdot_pay_item_number="630-80384",
        is_channelizer=True,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.05, §630.18",
    ),
    # Judgment call: CDOT does not separately enumerate Type I/II barricades —
    # only Type 3 (630-80331 to 80338).  Per Table 630-7 footnote, Type 1 and
    # Type 2 barricades are billed under "Construction Traffic Sign (Special)"
    # (SF).  Unit is therefore SF, not EACH; placement count is converted at
    # billing time once panel sizes are known.
    DeviceType.BARRICADE_TYPE_II: DeviceSpec(
        device_type=DeviceType.BARRICADE_TYPE_II,
        description="Type II barricade — two horizontal striped rails, 36–42 in tall",
        unit="SF",
        cdot_pay_item="Construction Traffic Sign (Special)",
        cdot_pay_item_number="630-80344",
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="Table 630-7 footnote, §630.18",
        field_notes=(
            "CDOT bills Type I/II barricades under Construction Traffic Sign "
            "(Special) by SF (Table 630-7 footnote).  V1 placement count is "
            "an integer count of barricades — convert to SF when panel "
            "dimensions are known."
        ),
    ),
    # Judgment call: CDOT splits Type 3 barricades by length+mount (F=fixed,
    # M=movable; A/B/C/D = 4/8/12/16-ft rail lengths) across 630-80331 to
    # 630-80338.  Defaulting to F-B (8 ft fixed) as the most common selection
    # for typical full-roadway closures.  Field engineer swaps to the correct
    # variant per the project's MHT.  See docs/cdot_pay_items.md for the
    # full list of alternatives.
    DeviceType.BARRICADE_TYPE_III: DeviceSpec(
        device_type=DeviceType.BARRICADE_TYPE_III,
        description="Type III barricade — three horizontal striped rails, full lane width",
        unit="EACH",
        cdot_pay_item="Barricade (Type 3 F-B) (Temporary)",
        cdot_pay_item_number="630-80332",
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.18",
        field_notes=(
            "Defaults to F-B (8 ft fixed).  Alternates: F-A/F-C/F-D "
            "(4/12/16 ft fixed, 630-80331/80333/80334), M-A/M-B/M-C/M-D "
            "(movable, 630-80335 to 80338)."
        ),
    ),
    DeviceType.LONGITUDINAL_CHANNELIZER: DeviceSpec(
        device_type=DeviceType.LONGITUDINAL_CHANNELIZER,
        description="Continuous longitudinal channelizing device (water-filled or plastic)",
        unit="LF",
        cdot_pay_item="Portable Water Filled Barrier (Temporary)",
        cdot_pay_item_number="630-80377",
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.18",
    ),
    # Judgment call: A/B/C are arrow-panel size tiers per Table 630-2
    # (24x48 / 30x60 / 48x96).  Defaulting to C Type (freeway, 1-mile
    # legibility) since V1's enabled scenarios are shoulder closures on
    # freeways and expressways.  Switch to B Type (630-80357) when urban
    # arterial scenarios are added.
    DeviceType.ARROW_BOARD: DeviceSpec(
        device_type=DeviceType.ARROW_BOARD,
        description="Trailer-mounted flashing arrow board (Type A, B, or C)",
        unit="EACH",
        cdot_pay_item="Advance Warning Flashing or Sequencing Arrow Panel (C Type)",
        cdot_pay_item_number="630-80358",
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.03 Table 630-2, §630.18",
        field_notes=(
            "C Type defaults for freeway/expressway scenarios.  B Type "
            "(630-80357) for urban arterials; A Type (630-80356) for "
            "low-speed work."
        ),
    ),
    DeviceType.PCMS: DeviceSpec(
        device_type=DeviceType.PCMS,
        description="Portable Changeable Message Sign (full-size or mPCMS)",
        unit="EACH",
        cdot_pay_item="Portable Message Sign Panel",
        cdot_pay_item_number="630-80355",
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.02, §630.18",
    ),
    DeviceType.TRUCK_MOUNTED_ATTENUATOR: DeviceSpec(
        device_type=DeviceType.TRUCK_MOUNTED_ATTENUATOR,
        description="Shadow vehicle with NCHRP 350 / MASH-rated truck-mounted attenuator",
        unit="EACH",
        cdot_pay_item="Impact Attenuator (Truck Mounted Attenuator) (Temporary)",
        cdot_pay_item_number="630-85040",
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.18",
    ),
    DeviceType.TEMPORARY_BARRIER: DeviceSpec(
        device_type=DeviceType.TEMPORARY_BARRIER,
        description="Temporary concrete or steel barrier (F-shape, Type 2, zipper, etc.)",
        unit="LF",
        cdot_pay_item="Barrier (Temporary)",
        cdot_pay_item_number="630-80370",
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.08, §630.18",
        field_notes=(
            "Generic LF item.  Operation-specific variants exist: "
            "630-80372 (Furnish and Install), 630-80373 (Remove), "
            "630-80375 (Install Only)."
        ),
    ),
    DeviceType.FLAGGER_STATION: DeviceSpec(
        device_type=DeviceType.FLAGGER_STATION,
        description="Flagger position with STOP/SLOW paddle and PPE",
        unit="HOUR",
        cdot_pay_item="Flagging",
        cdot_pay_item_number="630-00000",
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.14, §630.18",
    ),
    DeviceType.TEMPORARY_SIGNAL: DeviceSpec(
        device_type=DeviceType.TEMPORARY_SIGNAL,
        description="Portable traffic signal (standard, compact, AFAD, or RDTS)",
        unit="EACH",
        cdot_pay_item="Traffic Signal (Temporary)",
        cdot_pay_item_number="630-86810",
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.04, §630.18",
        field_notes=(
            "EACH variant.  LS (630-86801) and DAY (630-86802) variants "
            "also exist for lump-sum or duration-based contracts."
        ),
    ),
    DeviceType.SIGN_GENERIC: DeviceSpec(
        device_type=DeviceType.SIGN_GENERIC,
        description="Generic construction sign (W-, R-, or G-series); MUTCD code per scenario",
        unit="SF",
        cdot_pay_item="Construction Traffic Sign (Special)",
        cdot_pay_item_number="630-80344",
        is_channelizer=False,
        is_sign=True,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.02, §630.18",
        field_notes=(
            "Stocked panel sizes A/B/C (630-80341/80342/80343, EACH) "
            "available when panel size is known.  V1 export overrides "
            "unit to EACH at row-build time."
        ),
    ),
    # Judgment call: M4-9 series detour signs are typically <= 9 SF, which
    # fits CDOT's Panel Size A (Table 630-7) at 630-80341 (EACH).  Alternative:
    # 630-80344 (Special, SF) when an unusual layout is required.
    DeviceType.DETOUR_MARKER: DeviceSpec(
        device_type=DeviceType.DETOUR_MARKER,
        description="M4-9-series detour directional sign with arrow",
        unit="EACH",
        cdot_pay_item="Construction Traffic Sign (Panel Size A)",
        cdot_pay_item_number="630-80341",
        is_channelizer=False,
        is_sign=True,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="Table 630-7, §630.18",
    ),
    # Judgment call: "Optional channelizer" is a tool-internal semantic
    # (engineer's discretion); CDOT has no direct equivalent.  Mapping to
    # "Channelizing Device (Fixed)" (630-80391) because §630.06 formally
    # defines a 36-in fixed channelizing device that matches the typical
    # field deployment.  Alternative: 630-80390 "Channelizing Device
    # (Special)" when the contractor proposes a non-standard device.
    DeviceType.CHANNELIZER_OPTIONAL: DeviceSpec(
        device_type=DeviceType.CHANNELIZER_OPTIONAL,
        description="Generic optional-deployment channelizing device (contractor's choice)",
        unit="EACH",
        cdot_pay_item="Channelizing Device (Fixed)",
        cdot_pay_item_number="630-80391",
        is_channelizer=True,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.06, §630.18",
    ),
    # Subsidiary: §630.18 states "Cost of electrical power…for all temporary
    # lighting or warning devices shown on the TCP will not be paid for
    # separately but will be considered subsidiary to the item," and
    # barricade warning lights are explicitly furnished as part of the
    # barricade item.  No standalone Type C warning light pay item exists.
    # Bundled-light variants 630-80363/80364 (Drum with Flashing/Steady-Burn
    # Light) are separate items with the light packaged in.
    DeviceType.WARNING_LIGHT_TYPE_C: DeviceSpec(
        device_type=DeviceType.WARNING_LIGHT_TYPE_C,
        description="Type C steady-burn warning light, attached to channelizing device",
        unit="EACH",
        cdot_pay_item=None,
        cdot_pay_item_number="subsidiary",
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.18",
        field_notes=(
            "Subsidiary to the channelizing device or barricade it attaches "
            "to.  When a packaged item is preferred, use 630-80364 "
            "(Drum Channelizing Device (With Light) (Steady Burn))."
        ),
    ),
    # Subsidiary: no Section 630 standalone pay item exists for portable
    # light plants.  When separately compensated, billed under a project
    # special provision ("Revision of Section 630, Portable Light Plant").
    DeviceType.PORTABLE_LIGHT_PLANT: DeviceSpec(
        device_type=DeviceType.PORTABLE_LIGHT_PLANT,
        description="Portable light plant for work area illumination",
        unit="EACH",
        cdot_pay_item=None,
        cdot_pay_item_number="subsidiary",
        is_channelizer=False,
        is_sign=False,
        is_drawn=True,
        sprite_filename=None,
        spec_reference="§630.18",
        field_notes=(
            "No standalone CDOT Section 630 item.  When separately paid, "
            "billed via project special provision (Revision of Section 630, "
            "Portable Light Plant); otherwise subsidiary to the parent "
            "traffic control management item."
        ),
    ),
}


# ---------------------------------------------------------------------------
# Helper queries
# ---------------------------------------------------------------------------


def get_channelizers() -> list[DeviceType]:
    """Devices placed at computed taper/tangent spacing.

    Used by the layout engine to know which device types follow the
    in-taper / on-tangent spacing rules from MUTCD §6K.01.
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


# ---------------------------------------------------------------------------
# Aggregated device-list ordering (issue #88)
# ---------------------------------------------------------------------------
#
# Single source of truth for the row order on every aggregated device
# surface: the UI "Plan details" panel (``render_api._build_device_breakdown``),
# the XLSX Device List (``device_list._populate_device_list_sheet``), and the
# crew-narrative Required Equipment list (``crew_narrative._device_summary``).
#
# Before #88 each surface sorted independently on the raw ``DeviceType`` enum
# value, so the order was alphabetical-by-internal-name (``"CONE"`` landed near
# the top) AND the three surfaces did not even agree with each other — signs
# sorted last on the panel and crew list, but mid-list on the XLSX (where
# ``"SIGN_GENERIC"`` fell between ``"PORTABLE_LIGHT_PLANT"`` and
# ``"TEMPORARY_BARRIER"``).  All three now route through this helper, so they
# reorder identically by construction.
#
# Order: signs first, then channelizing devices, then equipment.  Signs keep
# their existing schedule-key / MUTCD-code order (resolved at the call site).
# Channelizing and equipment rows sort alphabetically by the canonical display
# name in ``_DEVICE_SORT_NAME``.


class DeviceCategory(IntEnum):
    """Grouping for the aggregated device-list surfaces, in display order.

    ``IntEnum`` so the member value doubles as the primary sort rank:
    ``SIGN`` (0) < ``CHANNELIZING`` (1) < ``EQUIPMENT`` (2).
    """

    SIGN = 0
    CHANNELIZING = 1
    EQUIPMENT = 2


# Every DeviceType's display-list category.  Completeness (one entry per enum
# member) is enforced by ``tests/test_device_ordering.py``.
#
# Judgment calls flagged for review (#88) — sensible defaults, easy to move:
#   * BARRICADE_TYPE_II / _III -> CHANNELIZING.  Barricades physically
#     delineate/close the travel way; a Type III can also carry a sign panel,
#     so "signs" is arguable.  Defaulted to channelizing.
#   * TEMPORARY_BARRIER        -> CHANNELIZING.  Longitudinal positive
#     separation; the panel function label calls it "Closure".  "Equipment"
#     (it is deployed, not hand-placed at spacing) is arguable.
#   * WARNING_LIGHT_TYPE_C     -> CHANNELIZING.  Night delineation mounted on
#     channelizers (panel function label "Channelizing (night)").
#   * DETOUR_MARKER            -> EQUIPMENT.  The catalog marks it
#     ``is_sign=True`` and bills it as a sign panel, but it is a discrete guide
#     marker, not a ``SIGN_GENERIC`` schedule entry, so it cannot share the
#     signs group's schedule-key order.  Grouped with deployed gear; move to a
#     dedicated "guide" rank if it should sit with signs.
#
# ``is_channelizer`` on ``DeviceSpec`` is deliberately NOT reused here: that
# flag means "placed at computed taper/tangent spacing" (cone/drum/tubular/
# optional only), which is narrower than the visual channelizing category.
_DEVICE_CATEGORY: dict[DeviceType, DeviceCategory] = {
    DeviceType.SIGN_GENERIC: DeviceCategory.SIGN,
    # Channelizing devices
    DeviceType.CONE: DeviceCategory.CHANNELIZING,
    DeviceType.DRUM: DeviceCategory.CHANNELIZING,
    DeviceType.TUBULAR_MARKER: DeviceCategory.CHANNELIZING,
    DeviceType.LONGITUDINAL_CHANNELIZER: DeviceCategory.CHANNELIZING,
    DeviceType.CHANNELIZER_OPTIONAL: DeviceCategory.CHANNELIZING,
    DeviceType.BARRICADE_TYPE_II: DeviceCategory.CHANNELIZING,
    DeviceType.BARRICADE_TYPE_III: DeviceCategory.CHANNELIZING,
    DeviceType.TEMPORARY_BARRIER: DeviceCategory.CHANNELIZING,
    DeviceType.WARNING_LIGHT_TYPE_C: DeviceCategory.CHANNELIZING,
    # Equipment
    DeviceType.ARROW_BOARD: DeviceCategory.EQUIPMENT,
    DeviceType.PCMS: DeviceCategory.EQUIPMENT,
    DeviceType.TRUCK_MOUNTED_ATTENUATOR: DeviceCategory.EQUIPMENT,
    DeviceType.FLAGGER_STATION: DeviceCategory.EQUIPMENT,
    DeviceType.TEMPORARY_SIGNAL: DeviceCategory.EQUIPMENT,
    DeviceType.PORTABLE_LIGHT_PLANT: DeviceCategory.EQUIPMENT,
    DeviceType.DETOUR_MARKER: DeviceCategory.EQUIPMENT,
}


# Canonical name used ONLY to order rows within the channelizing and equipment
# groups — it is not a display string (each surface keeps its own rendered
# text: the panel's ``_NON_SIGN_DISPLAY``, the crew list's
# ``_DEVICE_HUMAN_NAMES``, the XLSX's catalog description).  These mirror the
# panel display names so the visible panel order reads alphabetically.  CONE
# uses a size-agnostic "Traffic Cone" so its rank does not shift with the
# speed-dependent display label.  ``SIGN_GENERIC`` is intentionally absent:
# signs order by schedule key at the call site, not by a static name.
_DEVICE_SORT_NAME: dict[DeviceType, str] = {
    DeviceType.CONE: "Traffic Cone",
    DeviceType.DRUM: "Channelizing Drum",
    DeviceType.TUBULAR_MARKER: "Tubular Marker",
    DeviceType.LONGITUDINAL_CHANNELIZER: "Longitudinal Channelizer",
    DeviceType.CHANNELIZER_OPTIONAL: "Optional Channelizer",
    DeviceType.BARRICADE_TYPE_II: "Type II Barricade",
    DeviceType.BARRICADE_TYPE_III: "Type III Barricade",
    DeviceType.TEMPORARY_BARRIER: "Temporary Barrier",
    DeviceType.WARNING_LIGHT_TYPE_C: "Type C Warning Light",
    DeviceType.ARROW_BOARD: "Arrow Board",
    DeviceType.PCMS: "Portable Changeable Message Sign",
    DeviceType.TRUCK_MOUNTED_ATTENUATOR: "Truck-Mounted Attenuator",
    DeviceType.FLAGGER_STATION: "Flagger Station",
    DeviceType.TEMPORARY_SIGNAL: "Temporary Signal",
    DeviceType.PORTABLE_LIGHT_PLANT: "Portable Light Plant",
    DeviceType.DETOUR_MARKER: "Detour Marker",
}


def device_category(device_type: DeviceType) -> DeviceCategory:
    """Return the display-list category for ``device_type``."""
    return _DEVICE_CATEGORY[device_type]


def device_row_sort_key(device_type: DeviceType, sign_key: str | None) -> tuple[int, int, str]:
    """Canonical ordering key for one aggregated device row.

    Shared by every aggregated device surface so they order an identical
    device set identically (issue #88).  Primary rank is the category —
    signs, then channelizing devices, then equipment.

    * Sign rows (``device_type is SIGN_GENERIC``) sort into the leading group
      by ``sign_key`` (the schedule key / MUTCD code), with unlabeled signs
      trailing — preserving the prior ``(label is None, label or "")`` tiebreak.
    * Non-sign rows sort after, alphabetically by the canonical display name in
      ``_DEVICE_SORT_NAME``.  ``sign_key`` is ignored for them (pass ``None``).

    The two surfaces that emit the signs group separately
    (``_build_device_breakdown``, ``_device_summary``) sort only their non-sign
    counts with ``device_row_sort_key(dt, None)`` and prepend the signs block;
    the XLSX, which aggregates signs and non-signs into one counter, sorts the
    whole set with this key.  Both routes yield the same signs→channelizing→
    equipment order.
    """
    category = _DEVICE_CATEGORY[device_type]
    if device_type is DeviceType.SIGN_GENERIC:
        return (category.value, 1 if sign_key is None else 0, sign_key or "")
    return (category.value, 0, _DEVICE_SORT_NAME[device_type])
