# CDOT Pay Item Reference

Mapping between Conestruct device types and CDOT 2023 Standard Specifications,
Section 630 (Construction Zone Traffic Control).

**Last verified:** 2026-05-11

## Sources

This mapping is built from two authoritative CDOT documents:

1. **Pay item NAMES and units** — [CDOT 2023 Standard Specifications,
   Division 600](https://www.codot.gov/business/designsupport/cdot-construction-specifications/2023-construction-specifications/2023-specs-book/2023-division-600),
   Section 630, subsection 630.18 (Basis of Payment).  Pay item names below
   are verbatim from §630.18.
2. **Pay item NUMBERS** — [CDOT EEMA Master Item Code Book, Spec Year 05,
   dated 2024-02-09](https://www.codot.gov/business/eema/assets/2024-item-code-book-1.xlsx)
   ([index](https://www.codot.gov/business/eema/itemcodebook)).  CDOT
   maintains the numeric `630-XXXXX` bid-item codes in EEMA independently of
   spec-book reissues; these codes apply to projects bid under the 2023 spec
   book.

The two-source approach is necessary because the 2023 Spec Book lists pay
items by name only — it does not include the numeric codes used on bid
schedules.  Future maintainers should re-verify both sources together.

## Device Mappings

### CONE
- **CDOT Pay Item #:** 630-80380
- **Description:** Traffic Cone
- **Unit:** EACH
- **Spec Reference:** §630.05, §630.18

### DRUM
- **CDOT Pay Item #:** 630-80360
- **Description:** Drum Channelizing Device
- **Unit:** EACH
- **Spec Reference:** §630.17, §630.18

### TUBULAR_MARKER
- **CDOT Pay Item #:** 630-80384
- **Description:** Tubular Marker
- **Unit:** EACH
- **Spec Reference:** §630.05, §630.18

### BARRICADE_TYPE_II
- **CDOT Pay Item #:** 630-80344
- **Description:** Construction Traffic Sign (Special)
- **Unit:** SF
- **Spec Reference:** Table 630-7 footnote, §630.18
- **Notes:** CDOT bills Type I/II barricades under Construction Traffic Sign
  (Special) by SF (Table 630-7 footnote).  V1 placement count is an integer
  count of barricades — convert to SF when panel dimensions are known.
- See *Ambiguous Mappings* below for full reasoning.

### BARRICADE_TYPE_III
- **CDOT Pay Item #:** 630-80332
- **Description:** Barricade (Type 3 F-B) (Temporary)
- **Unit:** EACH
- **Spec Reference:** §630.18
- **Notes:** Defaults to F-B (8 ft fixed); alternates documented below.
- See *Ambiguous Mappings* for the full Type 3 variant list.

### LONGITUDINAL_CHANNELIZER
- **CDOT Pay Item #:** 630-80377
- **Description:** Portable Water Filled Barrier (Temporary)
- **Unit:** LF
- **Spec Reference:** §630.18

### ARROW_BOARD
- **CDOT Pay Item #:** 630-80358
- **Description:** Advance Warning Flashing or Sequencing Arrow Panel (C Type)
- **Unit:** EACH
- **Spec Reference:** §630.03 Table 630-2, §630.18
- **Notes:** C Type is the freeway/expressway default.  See *Ambiguous
  Mappings* for size-tier reasoning.

### PCMS
- **CDOT Pay Item #:** 630-80355
- **Description:** Portable Message Sign Panel
- **Unit:** EACH
- **Spec Reference:** §630.02, §630.18

### TRUCK_MOUNTED_ATTENUATOR
- **CDOT Pay Item #:** 630-85040
- **Description:** Impact Attenuator (Truck Mounted Attenuator) (Temporary)
- **Unit:** EACH
- **Spec Reference:** §630.18

### TEMPORARY_BARRIER
- **CDOT Pay Item #:** 630-80370
- **Description:** Barrier (Temporary)
- **Unit:** LF
- **Spec Reference:** §630.08, §630.18
- **Notes:** Generic LF item.  Operation-specific variants:
  - 630-80372 — Concrete Barrier (Temporary) (Furnish and Install) / LF
  - 630-80373 — Concrete Barrier (Temporary) (Remove) / LF
  - 630-80375 — Concrete Barrier (Temporary) (Install Only) / LF
  - 630-80371 — Reset Concrete Barrier (Temporary) / LF

### FLAGGER_STATION
- **CDOT Pay Item #:** 630-00000
- **Description:** Flagging
- **Unit:** HOUR
- **Spec Reference:** §630.14, §630.18

### TEMPORARY_SIGNAL
- **CDOT Pay Item #:** 630-86810
- **Description:** Traffic Signal (Temporary)
- **Unit:** EACH
- **Spec Reference:** §630.04, §630.18
- **Notes:** Alternates for different contract structures:
  - 630-86801 — Traffic Signal (Temporary) / Lump Sum
  - 630-86802 — Traffic Signal (Temporary) / Day

### SIGN_GENERIC
- **CDOT Pay Item #:** 630-80344
- **Description:** Construction Traffic Sign (Special)
- **Unit:** SF
- **Spec Reference:** §630.02, §630.18
- **Notes:** Stocked panel sizes are available when panel size is known:
  - 630-80341 — Construction Traffic Sign (Panel Size A, ≤9 SF) / EACH
  - 630-80342 — Construction Traffic Sign (Panel Size B, 9–16 SF) / EACH
  - 630-80343 — Construction Traffic Sign (Panel Size C, >16 SF) / EACH

  The V1 device-list export overrides unit to EACH at row-build time
  because placements are integer counts; see `src/export/device_list.py`.

### DETOUR_MARKER
- **CDOT Pay Item #:** 630-80341
- **Description:** Construction Traffic Sign (Panel Size A)
- **Unit:** EACH
- **Spec Reference:** Table 630-7, §630.18
- **Notes:** Standard M4-9-series detour signs fit Panel Size A (≤9 SF).
  See *Ambiguous Mappings* for alternative.

### CHANNELIZER_OPTIONAL
- **CDOT Pay Item #:** 630-80391
- **Description:** Channelizing Device (Fixed)
- **Unit:** EACH
- **Spec Reference:** §630.06, §630.18
- **Notes:** See *Ambiguous Mappings* for reasoning.

### WARNING_LIGHT_TYPE_C
- **CDOT Pay Item #:** subsidiary
- **Description:** (no standalone pay item — subsidiary to attached channelizer)
- **Unit:** EACH (count tracked for field deployment)
- **Spec Reference:** §630.18
- See *Subsidiary Items* below.

### PORTABLE_LIGHT_PLANT
- **CDOT Pay Item #:** subsidiary
- **Description:** (no standalone Section 630 item — project special provision when separately paid)
- **Unit:** EACH (count tracked for field deployment)
- **Spec Reference:** §630.18
- See *Subsidiary Items* below.

## Ambiguous Mappings

The four entries below required interpretation because CDOT's pay-item taxonomy
does not map 1:1 onto the Conestruct device taxonomy.  Each entry lists the
choice we made, the alternatives considered, and the reasoning behind the
default.

### BARRICADE_TYPE_II → 630-80344 (Construction Traffic Sign (Special))

CDOT's Section 630 pay-item list enumerates only **Type 3** barricades
(630-80331 through 630-80338).  Type I and Type II barricades have no
dedicated bid-item code.  The official routing per Table 630-7 footnote is
to bill them as "Construction Traffic Sign (Special)" by square foot.

**Choice:** 630-80344 / SF.

**Reasoning:** Following the spec book's explicit guidance is more
defensible than inventing a new code or appropriating an unrelated item.
The trade-off is that the unit becomes SF (not EACH as the catalog
originally had), so the V1 placement count needs an SF conversion at
billing time once panel sizes are known.  The same situation already
applies to SIGN_GENERIC; this is a known V1 metadata simplification.

**Alternatives considered:**
- 630-80341 Construction Traffic Sign (Panel Size A) / EACH — preserves the
  EACH unit but is technically a sign-stocking category, not a barricade
  category.  Less defensible against an auditor.

### BARRICADE_TYPE_III → 630-80332 (Barricade (Type 3 F-B) (Temporary))

CDOT splits Type 3 barricades by **rail length** (A=4 ft, B=8 ft, C=12 ft,
D=16 ft) and **mount type** (F=fixed/skid base, M=movable/wheeled) across
eight separate pay items (630-80331 to 630-80338).  The catalog has a
single BARRICADE_TYPE_III device type and needs to pick a default.

**Choice:** 630-80332 (Type 3 F-B, 8 ft fixed) / EACH.

**Reasoning:** F-B is the most common selection for typical full-roadway
closures in Colorado field practice — fixed-base barricades are preferred
for closures lasting more than a few hours, and 8 ft is the standard rail
length for two-lane closure widths.  The field engineer is expected to swap
to the correct variant as part of MHT review.

**Full alternative list:**
| Pay item # | Description |
| --- | --- |
| 630-80331 | Barricade (Type 3 F-A) (Temporary) — 4 ft fixed |
| **630-80332** | **Barricade (Type 3 F-B) (Temporary) — 8 ft fixed (default)** |
| 630-80333 | Barricade (Type 3 F-C) (Temporary) — 12 ft fixed |
| 630-80334 | Barricade (Type 3 F-D) (Temporary) — 16 ft fixed |
| 630-80335 | Barricade (Type 3 M-A) (Temporary) — 4 ft movable |
| 630-80336 | Barricade (Type 3 M-B) (Temporary) — 8 ft movable |
| 630-80337 | Barricade (Type 3 M-C) (Temporary) — 12 ft movable |
| 630-80338 | Barricade (Type 3 M-D) (Temporary) — 16 ft movable |
| 630-80339 | Directional Barricade |

### ARROW_BOARD → 630-80358 (C Type)

CDOT enumerates three arrow-panel size tiers per Table 630-2:
- **A Type** (24"×48", 12+ lamps, ½-mile legibility, 630-80356)
- **B Type** (30"×60", 13+ lamps, ¾-mile legibility, 630-80357)
- **C Type** (48"×96", 15+ lamps, 1-mile legibility, 630-80358)

**Choice:** 630-80358 (C Type) / EACH.

**Reasoning:** V1's enabled scenarios are shoulder closures and lane
closures on **freeways and expressways**, where the FHWA-recommended arrow
panel is C Type (1-mile legibility for 65+ mph approach speeds).  When the
tool expands to urban arterials, B Type (630-80357) is the appropriate
default.  A Type is for low-speed/short-duration work zones.

### DETOUR_MARKER → 630-80341 (Construction Traffic Sign (Panel Size A))

Per Table 630-7, sign panels are sized into three tiers:
- **Panel Size A** — ≤ 9 SF (630-80341)
- **Panel Size B** — 9–16 SF (630-80342)
- **Panel Size C** — > 16 SF (630-80343)
- **Special** — non-stocked layouts, billed by SF (630-80344)

The M4-9 / M4-10 detour-marker series (MUTCD §2D.43) at typical 24"×18" or
30"×24" dimensions is ≤ 9 SF.

**Choice:** 630-80341 (Panel Size A) / EACH.

**Reasoning:** Standard MUTCD detour markers fit cleanly into Panel Size A.

**Alternative:** 630-80344 (Special, SF) if the project uses an unusually
sized custom detour layout — but the M4-9 series is by definition the
standardized small-panel format.

### CHANNELIZER_OPTIONAL → 630-80391 (Channelizing Device (Fixed))

CHANNELIZER_OPTIONAL is a tool-internal semantic for devices the engineer
**may** deploy depending on conditions (an upstream optimization for our
"optional" sites).  CDOT has no equivalent "optional" pay-item category —
every placed device is billed.

**Choice:** 630-80391 (Channelizing Device (Fixed)) / EACH.

**Reasoning:** §630.06 formally defines a 36-in fixed channelizing device
with the alternating-stripe pattern, which matches the typical field
deployment for the spots the layout engine marks as optional.

**Alternatives considered:**
- 630-80390 Channelizing Device (Special) / EACH — appropriate when the
  contractor proposes a non-standard device for engineer approval.  More
  appropriate for unusual deployments; not the right default.

## Subsidiary Items

Two device types have no standalone Section 630 pay item.  Both carry
`cdot_pay_item_number = "subsidiary"` in the catalog and are not billed as
separate line items on the bid schedule.

### WARNING_LIGHT_TYPE_C

Type C steady-burn warning lights attach to a channelizing device or
barricade and are billed as part of that parent device.  Specifically,
§630.18 states:

> Cost of electrical power, including batteries, for all temporary lighting
> or warning devices shown on the TCP will not be paid for separately but
> will be considered subsidiary to the item.

The §630.18 pay-item list also explicitly notes that "Barricade warning
lights shall be furnished as a part of this item" (referring to the
barricade items themselves).

**When a packaged item is preferred** (e.g., a drum with a built-in
steady-burn light is bid as a distinct device), the alternates are:
- 630-80363 — Drum Channelizing Device (With Light) (Flashing) / EACH
- 630-80364 — Drum Channelizing Device (With Light) (Steady Burn) / EACH
- 630-80353 — Vertical Panel (With Light) (Flashing) / EACH
- 630-80354 — Vertical Panel (With Light) (Steady Burn) / EACH

The standalone Type C count is still tracked in the device list for field
deployment purposes (so the contractor knows how many lights to provision),
but it does not appear as a payable line item on the bid schedule.

### PORTABLE_LIGHT_PLANT

CDOT does not include a portable light plant pay item in Section 630.  When
separately compensated, it is added via a project-specific special
provision (commonly titled "Revision of Section 630, Portable Light
Plant").  Otherwise, light plants are subsidiary to the project's
Traffic Control Management (630-00012 / 630-00017) item.

The standalone count is still tracked in the device list for field
deployment purposes.

## Maintenance

When the CDOT spec book or EEMA Item Code Book is updated:
1. Re-fetch both source documents at the URLs above.
2. Diff the §630.18 pay-item list against the names in `DEVICE_CATALOG`.
3. Diff the EEMA `630-XXXXX` codes against the numbers in `DEVICE_CATALOG`.
4. Update the catalog, this document, and the "Last verified" date.
5. Run `pytest` to confirm the no-TODO regression guard still passes.
