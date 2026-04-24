> **SHELVED 2026-04-24.** Labeling workflow is paused for the generation
> pivot. 1,038 labeled bounding boxes across 203 WSDOT typical TCP images
> remain in the local Label Studio database as reference data for sprite
> extraction.

# Label Studio Workflow

> **Skipping non-TCP pages:** Cover pages, title sheets, and notes-only
> pages can be skipped — click through them without labeling. Label Studio
> tracks which tasks are done; unlabeled ones stay in the queue.

## Setup

```bash
# Start Label Studio (runs on http://localhost:8080)
uv run label-studio start

# First run: create an account at http://localhost:8080
# Get your API key: Settings -> Account & API -> Access Token
```

## Import / Export Scripts

```bash
# Import TCP sheets into a new project
uv run python -m src.labeling.import_to_label_studio \
    --api-key YOUR_KEY \
    --project-title "WSDOT Typical TCPs v1" \
    --image-dir data/processed/wsdot_typicals

# Export completed annotations to YOLO format
uv run python -m src.labeling.export_to_yolo \
    --api-key YOUR_KEY \
    --project-id 1 \
    --output-dir data/labels/raw
```

## Labeling Config

Config file: `configs/label_studio_config.xml`

14 classes with keyboard shortcuts for speed:

| Key | Class | Color |
|-----|-------|-------|
| 1 | `CONE` | Orange |
| 2 | `DRUM` | Yellow |
| 3 | `TUBULAR_MARKER` | Teal |
| 4 | `BARRICADE_TYPE_II` | Red |
| 5 | `BARRICADE_TYPE_III` | Dark Red |
| 6 | `LONGITUDINAL_CHANNELIZER` | Green |
| 7 | `ARROW_BOARD` | Purple |
| 8 | `PCMS` | Blue |
| 9 | `TRUCK_MOUNTED_ATTENUATOR` | Brown |
| q | `TEMPORARY_BARRIER` | Blue Grey |
| w | `FLAGGER_STATION` | Crimson |
| e | `TEMPORARY_SIGNAL` | Amber |
| r | `SIGN_GENERIC` | Gray |
| t | `DETOUR_MARKER` | Dark Blue |
| y | `CHANNELIZER_OPTIONAL` | Amber |
| - | `ambiguous` flag | — |

---

## Labeling Rules

### Bounding boxes

- **Tight boxes.** The box edges should touch the symbol boundary with
  no padding. Don't include surrounding whitespace or adjacent symbols.

- **Occluded symbols.** Label the symbol if **>50% of it is visible.**
  Draw the box around the visible portion only — do not guess at the
  full extent behind the occlusion.

- **Edge-of-tile symbols.** If a symbol is cut off at the edge of the
  image, **label the entire visible portion** even though the box
  extends to the image boundary. These will be deduplicated during
  tile-merge NMS at inference time.

### Class assignment

- **When uncertain between two classes, use `SIGN_GENERIC` (key 8).**
  We can subdivide signs in v2. Mislabeling a sign as a drum is worse
  than under-specifying the sign type.

- Use the sheet legend (if present) to resolve ambiguity between
  `ARROW_BOARD` and `PCMS`, or between `BARRICADE_TYPE_II` and
  `BARRICADE_TYPE_III`.

- `DRUM` must show horizontal stripes. If no stripes are visible,
  it's more likely a `CONE`.

- `BARRICADE_TYPE_III` must show diagonal stripes and span most of a
  lane width. Narrower barricades with two rails are `BARRICADE_TYPE_II`.

### Ambiguous flag

Press **9** to flag an image as ambiguous. This marks the entire image
(not individual boxes) as contentious. Flagged images are **skipped by
default** during YOLO export (`export_to_yolo.py`).

Use this when:
- The sheet is too low-resolution to distinguish symbols
- The legend contradicts the visual appearance
- You genuinely can't tell if something is a traffic control device
  or part of the drawing's linework/text

Do NOT use this as a substitute for the `SIGN_GENERIC` fallback. If
you can tell it's a sign but not which kind, label it `SIGN_GENERIC`.
Only flag ambiguous when you can't tell if it's a sign at all.

---

## Quality Checks

After a labeling session, spot-check by running the export and
verifying:

1. **No empty label files.** Every exported `.txt` should have at
   least one line. If a task was submitted with no boxes, something
   went wrong.

2. **Class distribution.** `CONE` and `DRUM` should be the most
   common. If `SIGN_GENERIC` dominates, revisit — many may be
   resolvable with the legend.

3. **Box sizes.** Cones and channelizers should be tiny (< 2% of image
   area). Barricades and PCMS should be larger (2-10%). Flag outliers.
