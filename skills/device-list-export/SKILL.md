# Device List Export

Converts a device layout (from `src/generation/`) into an Excel spreadsheet
with CDOT Section 630 pay items, quantities, and units. Output is the second
of three deliverables per generation (alongside plan sheet PDF and crew
narrative).

Implemented in `src/export/`.

---

## Output Format

### Excel Workbook Structure

Single workbook (`.xlsx`) with two sheets:

**Sheet 1: Device List**

| Column | Type | Description |
|--------|------|-------------|
| Pay Item No. | string | CDOT Section 630 pay item number |
| Pay Item Name | string | Official CDOT pay item description |
| Unit | string | EACH, LF, SF, HOUR, etc. |
| Quantity | number | Computed from layout |
| Notes | string | Special conditions, optional-device flag, etc. |

**Sheet 2: Summary**

| Column | Type | Description |
|--------|------|-------------|
| Case | string | S-630-1 case number used |
| Road Type | string | Two-lane, multi-lane divided, freeway, etc. |
| Speed | number | Posted speed (mph) |
| Work Zone Length | number | Total work zone length (ft) |
| Generated | datetime | Generation timestamp |

---

## CDOT Section 630 Pay Item Reference

Pay items are defined in `src/export/cdot_pay_items.py` and reference the
CDOT 2023 Standard Specifications Book, Section 630.

### Device-to-Pay-Item Mapping

See `skills/mutcd-symbols/SKILL.md` § "Device-to-Pay-Item Mapping" for the
full 15-class mapping table. Key rules:

| Device Class | Unit | Measurement Rule |
|-------------|------|------------------|
| `CONE` | EACH | Count of individual cones placed |
| `DRUM` | EACH | Count of individual drums placed |
| `TUBULAR_MARKER` | EACH | Count of individual markers placed |
| `BARRICADE_TYPE_II` | EACH | Count of barricades |
| `BARRICADE_TYPE_III` | EACH | Count of barricades |
| `LONGITUDINAL_CHANNELIZER` | LF | Total linear feet of channelizer |
| `ARROW_BOARD` | EACH | Count of arrow boards |
| `PCMS` | EACH | Count of PCMS units |
| `TRUCK_MOUNTED_ATTENUATOR` | EACH | Count of TMAs |
| `TEMPORARY_BARRIER` | LF | Total linear feet of barrier |
| `FLAGGER_STATION` | HOUR | Estimated hours (user-provided or default) |
| `TEMPORARY_SIGNAL` | EACH | Count of signal units |
| `SIGN_GENERIC` | SF | Total square feet of sign face area |
| `DETOUR_MARKER` | EACH | Count of detour markers |
| `CHANNELIZER_OPTIONAL` | EACH | Probability-weighted count |

---

## Quantity Computation

### Channelizing Devices (Cones, Drums, Tubular Markers)

Quantity is computed from the layout engine's device placement:

```python
# In taper: count = taper_length / taper_spacing
# On tangent: count = tangent_length / tangent_spacing
# Total = taper_count + tangent_count (both sides if applicable)
```

### Linear Devices (Barrier, Longitudinal Channelizer)

Measured in linear feet from the layout:

```python
quantity_lf = sum(segment.length_ft for segment in layout.linear_devices)
```

### Signs (SIGN_GENERIC)

Measured in square feet of sign face area:

```python
# Standard sign sizes from MUTCD Table 6F-1
SIGN_SIZES = {
    "W20-1": (48, 48),    # Road Work Ahead — 48"×48" diamond
    "W20-4": (48, 48),    # One Lane Road Ahead
    "G20-2": (36, 18),    # End Road Work
    # ... more sign codes
}

quantity_sf = sum(
    (w_in * h_in) / 144  # convert sq inches to sq feet
    for sign in layout.signs
    for w_in, h_in in [SIGN_SIZES.get(sign.code, (48, 48))]
)
```

### Flaggers (FLAGGER_STATION)

Bid by the hour. Quantity depends on:
- Number of flagger stations (from layout)
- Duration of work (user input)
- Shifts per day (user input, default: 1)

```python
quantity_hours = num_flaggers * hours_per_shift * shifts_per_day * work_days
```

### CHANNELIZER_OPTIONAL — Probability Weighting

Optional channelizers are bid at a reduced quantity to reflect deployment
uncertainty:

```python
# Default probability weight: 50%
OPTIONAL_WEIGHT = 0.5

quantity = int(math.ceil(raw_count * OPTIONAL_WEIGHT))
```

The weight should be user-configurable in V2. For V1, use 50% as default
and note it in the "Notes" column.

---

## Excel Styling

### Header Row

- Bold, 11pt, white text on CDOT blue (#003366) background
- Freeze top row

### Data Rows

- 10pt regular
- Alternating row colors (#FFFFFF, #F2F2F2)
- Numbers right-aligned, text left-aligned
- Quantity column: 1 decimal place for LF/SF, integer for EACH/HOUR

### Column Widths

| Column | Width |
|--------|-------|
| Pay Item No. | 15 |
| Pay Item Name | 45 |
| Unit | 8 |
| Quantity | 12 |
| Notes | 40 |

---

## Implementation Notes

### File: `src/export/cdot_pay_items.py`

Contains the pay item registry — a dict mapping device class to pay item
metadata:

```python
@dataclass
class PayItem:
    number: str          # CDOT pay item number (e.g., "630-00012")
    name: str            # Official description
    unit: str            # EACH, LF, SF, HOUR
    device_class: str    # From 15-class taxonomy

PAY_ITEMS: dict[str, PayItem] = {
    "CONE": PayItem(number="TODO", name="Traffic Cone", unit="EACH", device_class="CONE"),
    # ... etc
}
```

### File: `src/export/device_list.py`

Orchestrates the export:
1. Accept a `Layout` object from the generation engine
2. Compute quantities using rules from `src/rules/`
3. Map devices to pay items using `cdot_pay_items.py`
4. Write Excel workbook using openpyxl
5. Return path to generated `.xlsx` file
