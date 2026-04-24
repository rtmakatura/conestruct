# CDOT S-630-1 Cases

Reference for the 39 CDOT standard MHT cases from Standard Plan S-630-1.
Each case defines a road type, lane configuration, closure pattern, and
required device placement. The generation engine in `src/generation/scenarios.py`
implements these cases programmatically.

Source: CDOT S-630-1 (26-sheet set, 2019 edition)
URL: https://www.codot.gov/safety/traffic-safety/assets/s-standard-plans/2019/s-630-1/S-630-01%20(19-Page%20Set).pdf

---

## Case Index

Cases are grouped by road type and closure pattern. Case numbers follow
CDOT's naming convention from the S-630-1 sheet set.

### Two-Lane Two-Way Roads

| Case | Description | Key Features |
|------|------------|--------------|
| 1 | Lane closure — work in travel lane | Flagger-controlled, one-lane operation |
| 2 | Shoulder work — travel lane open | Minor encroachment into travel lane |
| 3 | Lane closure — pilot car operation | Long work zone requiring pilot car |
| 4 | Shoulder closure | Work on shoulder only, travel lane open |
| 5 | Road closure — detour | Full road closure with signed detour |
| 6 | Intermittent closure | Short-duration stops (e.g., utility work) |
| 7 | Mobile operation | Slow-moving work (e.g., striping, patching) |
| 8 | Lane closure — temporary signal | Signal-controlled one-lane operation |

### Multi-Lane Undivided Roads

| Case | Description | Key Features |
|------|------------|--------------|
| 9 | Right lane closure | One direction, right lane closed |
| 10 | Left lane closure | One direction, left lane closed |
| 11 | Center lane closure | 3+ lanes, center lane closed |
| 12 | Multiple lane closure | 2+ lanes closed in same direction |
| 13 | Shoulder closure | Shoulder work, all lanes open |
| 14 | Mobile operation | Slow-moving work on multi-lane undivided |

### Multi-Lane Divided Roads (Non-Freeway)

| Case | Description | Key Features |
|------|------------|--------------|
| 15 | Right lane closure | Divided road, right lane closed |
| 16 | Left lane closure | Divided road, left lane closed |
| 17 | Center lane closure | Divided road, center lane closed |
| 18 | Multiple lane closure | Divided road, 2+ lanes closed |
| 19 | Median crossover | Traffic shifted to opposing lanes |
| 20 | Shoulder closure | Divided road, shoulder work |
| 21 | Mobile operation | Slow-moving work on divided road |

### Freeway / Interstate

| Case | Description | Key Features |
|------|------------|--------------|
| 22 | Right lane closure | Freeway, right lane closed |
| 23 | Left lane closure | Freeway, left lane closed |
| 24 | Center lane closure | Freeway, center lane closed |
| 25 | Multiple lane closure | Freeway, 2+ lanes closed |
| 26 | Right shoulder closure | Freeway shoulder work |
| 27 | Left shoulder/median closure | Freeway median work |
| 28 | Ramp closure | On-ramp or off-ramp closed |
| 29 | Freeway-to-freeway connector closure | Connector ramp closed |
| 30 | Mobile operation | Slow-moving work on freeway |
| 31 | Median crossover | Freeway traffic shifted to opposing lanes |
| 32 | Lane shift | Freeway lanes shifted laterally |

### Intersection and Special Cases

| Case | Description | Key Features |
|------|------------|--------------|
| 33 | Intersection — lane closure approaching | Work near signalized intersection |
| 34 | Intersection — work within | Work inside intersection box |
| 35 | Roundabout work zone | Work in or near roundabout |
| 36 | Pedestrian/bicycle accommodation | Work affecting ped/bike facilities |
| 37 | Bridge work | Lane closure on bridge deck |
| 38 | Night work | Nighttime-specific lighting and device requirements |
| 39 | Temporary road | Temporary bypass road construction |

---

## Case Data Structure

Each case in `configs/cdot_cases.yaml` should contain:

```yaml
case_1:
  name: "Two-Lane Two-Way — Lane Closure (Flagger)"
  road_type: two_lane_two_way
  speed_range: [25, 55]           # applicable speed range (mph)
  lanes_total: 2
  lanes_open: 1                   # during work
  closure_type: lane_closure
  control_method: flagger         # flagger | signal | pilot_car | none
  duration: [short, long]         # applicable durations

  # Devices required (references device vocab from mutcd-symbols)
  devices:
    advance_warning:
      - {type: SIGN_GENERIC, code: "W20-1", text: "ROAD WORK AHEAD"}
      - {type: SIGN_GENERIC, code: "W20-1", text: "ONE LANE ROAD AHEAD"}
    transition:
      - {type: CONE, count: "computed"}       # from taper formula
      - {type: ARROW_BOARD, count: 1}
    buffer:
      - {type: TRUCK_MOUNTED_ATTENUATOR, count: 1, condition: "speed >= 45"}
    activity_area:
      - {type: DRUM, count: "computed"}       # from tangent spacing
    termination:
      - {type: SIGN_GENERIC, code: "G20-2", text: "END ROAD WORK"}
    flagger:
      - {type: FLAGGER_STATION, count: 2}     # one per approach

  # Layout geometry
  geometry:
    taper: merging                 # merging | shifting | shoulder
    work_zone_side: right          # right | left | center | both
    detour: false
```

---

## Implementation Notes

### Speed-Dependent Case Selection

Many cases have speed thresholds that change device requirements:
- `< 45 mph`: flaggers may be used, smaller signs acceptable
- `≥ 45 mph`: TMA typically required, larger signs, arrow board
- `≥ 55 mph`: additional advance warning distance, larger buffer

### Duration-Dependent Requirements

- **Short-term** (< 1 hour): may use cones instead of drums, reduced signage
- **Intermediate** (1 hour to 3 days): standard device set
- **Long-term** (> 3 days): drums required (not cones), temporary striping,
  raised pavement markers

### Nighttime Modifier (Case 38)

When work occurs at night, all cases gain additional requirements:
- Retroreflective devices required (all classes)
- Flashing warning lights on barricades
- Additional advance warning signs
- Temporary lighting at work space
- High-visibility apparel for all workers (ANSI Class 3)

---

## Verification Status

| Case Range | Verified Against S-630-1 PDF | Notes |
|-----------|------------------------------|-------|
| 1–8 | TODO | Two-lane two-way |
| 9–14 | TODO | Multi-lane undivided |
| 15–21 | TODO | Multi-lane divided |
| 22–32 | TODO | Freeway/interstate |
| 33–39 | TODO | Intersection/special |

Each case needs verification by reading the corresponding S-630-1 sheet and
confirming: device types, placement rules, speed thresholds, and special
conditions. Fill in as we build `configs/cdot_cases.yaml`.
