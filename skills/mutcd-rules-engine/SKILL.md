# MUTCD Rules Engine

Core math and lookup tables from MUTCD 11th Edition Part 6 for computing
traffic control device placement. Implemented in `src/rules/`.

Reference: MUTCD 11th Edition, Part 6 — Temporary Traffic Control
Colorado Supplement effective 2026-01-18

---

## Taper Length Formulas

MUTCD Section 6C.08 — Tapers

### Merging Taper (L)

The standard taper length `L` depends on posted speed:

```
For speed >= 45 mph:   L = W * S² / 60
For speed <  45 mph:   L = W * S
```

Where:
- `L` = taper length in feet
- `W` = width of offset (lane width or lane shift distance) in feet
- `S` = posted speed limit or off-peak 85th-percentile speed in mph

### Taper Types and Their Lengths

| Taper Type | Length | When Used |
|-----------|--------|-----------|
| Merging | L | Lane closure — traffic merges into adjacent lane |
| Shifting | L/2 | Lane shift — both ends of a lateral transition |
| Shoulder | L/3 | Shoulder closure only |
| One-lane two-way | L (min 50', max 100') | Two-way traffic sharing one lane |
| Downstream | L/3 (min 50') | End of work zone, traffic returns to normal path |

### Worked Examples

**Example 1:** 2-lane highway, 55 mph, 12' lane width, merging taper
```
L = 12 * 55² / 60 = 12 * 3025 / 60 = 605 ft
```

**Example 2:** Urban arterial, 35 mph, 11' lane width, merging taper
```
L = 11 * 35 = 385 ft
```

**Example 3:** Same arterial, shifting taper
```
L/2 = 385 / 2 = 192.5 ft → round to 195 ft
```

---

## Buffer Space

MUTCD Section 6C.06 — Buffer Spaces

The longitudinal buffer space between the end of the transition area and the
start of the work space. Provides a recovery zone for errant vehicles.

### Minimum Buffer Distance

No formula — buffer space is a **minimum** based on speed:

| Posted Speed (mph) | Minimum Buffer (ft) |
|--------------------|--------------------|
| 25 | 115 |
| 30 | 155 |
| 35 | 200 |
| 40 | 250 |
| 45 | 305 |
| 50 | 365 |
| 55 | 430 |
| 60 | 500 |
| 65 | 575 |
| 70 | 645 |
| 75 | 720 |

These values are derived from stopping sight distance at each speed.

**Rule:** No work activity, workers, equipment, or material storage within
the buffer space. Only channelizing devices are permitted.

---

## Advance Warning Sign Spacing

MUTCD Table 6C-3 — Advance Warning Sign Spacing

Spacing between advance warning signs placed upstream of the work zone.

### Urban (Speed ≤ 45 mph)

| Sign Position | Distance from Transition |
|--------------|-------------------------|
| A (first sign) | 100 ft |
| B (second sign) | 100 ft before A |
| C (third sign, if used) | 100 ft before B |

### Rural (Speed > 45 mph)

| Sign Position | Distance from Transition |
|--------------|-------------------------|
| A (first sign) | 500 ft |
| B (second sign) | 500 ft before A |
| C (third sign, if used) | 500 ft before B |

### Expressway/Freeway

| Sign Position | Distance from Transition |
|--------------|-------------------------|
| A (first sign) | 500 ft |
| B (second sign) | 1,000 ft before A |
| C (third sign, if used) | 1,500 ft before B |

**Note:** Table 6C-3 values are minimums. For high-speed roads (≥55 mph),
additional spacing is recommended.

---

## Longitudinal Device Spacing

MUTCD Table 6C-4 — Channelizing Device Spacing

Spacing between channelizing devices (cones, drums, tubular markers) in
different zones.

### In Tapers

| Posted Speed (mph) | Max Spacing (ft) |
|--------------------|--------------------|
| 25 | 15 |
| 30 | 20 |
| 35 | 25 |
| 40 | 30 |
| 45 | 35 |
| 50 | 40 |
| 55 | 45 |
| 60 | 50 |
| 65 | 55 |
| 70 | 60 |
| 75 | 65 |

Simplified formula: **spacing in taper = posted speed (mph)** in feet.
(e.g., 55 mph → 55 ft max between devices, with some rounding)

### Tangent (Straight) Sections

Maximum spacing on tangent sections through the work zone:

| Condition | Max Spacing |
|-----------|-------------|
| Along work zone (tangent) | 2 × taper spacing (i.e., 2 × speed in ft) |
| Curves | Reduce to maintain clear sight line to next device |

### Worked Example

**55 mph highway, merging taper, 12' lane:**
- Taper length: L = 12 × 55² / 60 = 605 ft
- Device spacing in taper: 55 ft
- Devices in taper: 605 / 55 = 11 devices
- Tangent spacing: 110 ft
- Buffer distance: 430 ft minimum

---

## Shadow Vehicle / TMA Placement

MUTCD Section 6G.01

- Shadow vehicle placed upstream of the work space, within the buffer zone
- Minimum offset: 50 ft upstream of work space (some states require more)
- TMA must be NCHRP 350 or MASH rated
- Arrow board on TMA set to appropriate mode (flashing arrow, sequential
  chevron, or caution)

### CDOT-Specific

CDOT typically requires TMA on all closures where speed ≥ 45 mph. Verify
against CDOT S-630-1 case requirements.

---

## Flagger Spacing

MUTCD Section 6E.02 — Flagger Stations

- Flaggers must be positioned with adequate sight distance to approaching
  traffic
- Minimum sight distance: stopping sight distance for the posted speed
  (same values as buffer space table above)
- Flagger must be visible to approaching traffic for at least the stopping
  sight distance
- Flagger escape route: clear path away from traffic at a 45° angle

---

## Implementation Notes

All formulas and tables above are implemented in `src/rules/`:

| Module | Contents |
|--------|----------|
| `spacing.py` | `taper_length()`, `buffer_distance()`, `device_spacing_in_taper()`, `device_spacing_tangent()` |
| `tables.py` | `advance_warning_spacing()`, `buffer_distance_table`, `taper_spacing_table` |
| `validators.py` | `validate_layout()` — checks a proposed placement against all rules above |
| `devices.py` | Device enum and physical specs (see `skills/mutcd-symbols/`) |

---

## Colorado Overrides

The Colorado Supplement may override federal MUTCD values. Known overrides:

- TODO: Verify Colorado-specific buffer distances (if any)
- TODO: Verify Colorado-specific taper length modifications
- TODO: Check if CDOT Form 568 speed reduction zones affect spacing tables

When a Colorado override exists, `src/rules/tables.py` should use the
Colorado value and document the federal fallback.
