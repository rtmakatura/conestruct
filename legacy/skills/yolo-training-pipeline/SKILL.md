> **SHELVED 2026-04-24.** V1 of the generation product does not use object
> detection. Keep for reference if future versions add plan-sheet QA via
> symbol detection.

# YOLO Training Pipeline

## License Warning

> **YOLOv11 (Ultralytics) is AGPL-3.0.** Fine for development and
> research. **Must be swapped to RF-DETR-Nano (Apache 2.0) or another
> permissively licensed detector before commercial release.**
>
> Track RF-DETR: https://github.com/roboflow/RF-DETR

---

## Directory Layout

Ultralytics expects a specific structure. We maintain a superset that
includes raw and tiled intermediate stages.

```
data/
  raw/                        # original PDFs (gitignored)
  rendered/                   # full-resolution page PNGs + sidecar JSON
  images/
    raw/                      # full-sheet images before tiling
    tiled/                    # 1024x1024 tiles (working set)
    train/                    # symlinks or copies for training split
    val/                      # symlinks or copies for validation split
    test/                     # held-out test split
  labels/
    raw/                      # full-sheet YOLO labels before tiling
    tiled/                    # tile-adjusted labels
    train/                    # matches images/train/
    val/                      # matches images/val/
    test/                     # matches images/test/
```

### data.yaml

```yaml
path: data
train: images/train
val: images/val
test: images/test

names:
  0: CONE_28
  1: CONE_36
  2: DRUM_36
  3: BARRICADE_TYPE_III
  4: ARROW_BOARD
  5: PCMS
  6: CHANNELIZER
  7: SIGN_GENERIC
```

---

## Tiling

Traffic control symbols are small relative to full-sheet images (often
<20 px on a 10000+ px wide sheet). Small object detection requires
tiling.

### Default settings

| Parameter | Value |
|---|---|
| Tile size | 1024 × 1024 px |
| Overlap | 20% (204 px) |
| Min object area in tile | 16 px² (discard annotations smaller than this after clipping) |

### Tiling logic

```python
from pathlib import Path
from PIL import Image


def tile_image(
    image_path: Path,
    output_dir: Path,
    tile_size: int = 1024,
    overlap: float = 0.2,
) -> list[dict]:
    """Slice an image into overlapping tiles. Returns tile metadata."""
    img = Image.open(image_path)
    w, h = img.size
    stride = int(tile_size * (1 - overlap))
    tiles = []

    for y in range(0, h, stride):
        for x in range(0, w, stride):
            # Clamp to image bounds
            x2 = min(x + tile_size, w)
            y2 = min(y + tile_size, h)
            x1 = max(x2 - tile_size, 0)
            y1 = max(y2 - tile_size, 0)

            crop = img.crop((x1, y1, x2, y2))
            tile_name = f"{image_path.stem}_tile_{x1}_{y1}.png"
            crop.save(output_dir / tile_name)

            tiles.append({
                "tile_name": tile_name,
                "source_image": str(image_path),
                "x1": x1, "y1": y1,
                "x2": x2, "y2": y2,
            })

    return tiles
```

### Label remapping for tiles

When tiling, YOLO labels must be clipped and re-normalized to the tile
coordinate system:

```python
def remap_labels_to_tile(
    labels: list[tuple],  # [(class_id, x_center, y_center, w, h), ...]
    img_w: int,
    img_h: int,
    tile_x1: int,
    tile_y1: int,
    tile_size: int,
    min_area: int = 16,
) -> list[tuple]:
    """Convert full-image YOLO labels to tile-local coordinates.

    Discards objects that fall outside the tile or are clipped below
    min_area.
    """
    tile_labels = []
    for cls, xc, yc, bw, bh in labels:
        # Convert from normalized to absolute (full image)
        abs_xc = xc * img_w
        abs_yc = yc * img_h
        abs_w = bw * img_w
        abs_h = bh * img_h

        # Clip box to tile bounds
        left = max(abs_xc - abs_w / 2, tile_x1)
        right = min(abs_xc + abs_w / 2, tile_x1 + tile_size)
        top = max(abs_yc - abs_h / 2, tile_y1)
        bottom = min(abs_yc + abs_h / 2, tile_y1 + tile_size)

        clipped_w = right - left
        clipped_h = bottom - top

        if clipped_w <= 0 or clipped_h <= 0:
            continue
        if clipped_w * clipped_h < min_area:
            continue

        # Re-normalize to tile coordinates
        new_xc = ((left + right) / 2 - tile_x1) / tile_size
        new_yc = ((top + bottom) / 2 - tile_y1) / tile_size
        new_w = clipped_w / tile_size
        new_h = clipped_h / tile_size

        tile_labels.append((cls, new_xc, new_yc, new_w, new_h))

    return tile_labels
```

---

## Augmentation Rules

| Augmentation | Allowed | Notes |
|---|---|---|
| Horizontal flip | Yes | Symmetric in plan view |
| Vertical flip | **No** | Signs are directional; text and symbols become inverted |
| Rotation | ±5° only | Plans are axis-aligned; larger rotations are unrealistic |
| Mosaic | Yes | Helpful for small object detection |
| Mixup | No | Overlapping plan sheets create confusing training signal |
| Color jitter | Mild | Plans vary in scan quality; brightness ±10%, contrast ±10% |
| Scale | 0.8–1.2× | Simulates DPI variation across sources |

### Ultralytics config snippet

```yaml
# In training call or hyp override
augment: true
fliplr: 0.5      # horizontal flip probability
flipud: 0.0      # vertical flip — disabled
degrees: 5.0     # rotation range
mosaic: 1.0      # mosaic probability
mixup: 0.0       # mixup — disabled
hsv_h: 0.0       # no hue shift (plans are grayscale/orange)
hsv_s: 0.1       # mild saturation jitter
hsv_v: 0.1       # mild brightness jitter
scale: 0.2       # scale jitter ±20%
```

---

## Training

### Basic training command

```bash
uv run yolo detect train \
    model=yolo11n.pt \
    data=data/data.yaml \
    epochs=100 \
    imgsz=1024 \
    batch=16 \
    project=runs/detect \
    name=v1_baseline
```

### Key hyperparameters for small objects

| Parameter | Value | Why |
|---|---|---|
| `imgsz` | 1024 | Match tile size |
| `batch` | 16 | Adjust to GPU memory |
| `patience` | 20 | Early stopping |
| `optimizer` | `AdamW` | Default, works well |
| `lr0` | 0.001 | Default for nano model |

---

## Evaluation

### Primary metric

> **Per-class recall at IoU 0.5** is what matters for this project, not
> mAP. Missing a cone in a traffic control plan is worse than a false
> positive (false positives are caught in human review; missed symbols
> are not).

### Validation script outline

```python
from ultralytics import YOLO  # ⚠️ AGPL

CLASS_NAMES = [
    "CONE_28", "CONE_36", "DRUM_36", "BARRICADE_TYPE_III",
    "ARROW_BOARD", "PCMS", "CHANNELIZER", "SIGN_GENERIC",
]


def evaluate(model_path: str, data_yaml: str):
    model = YOLO(model_path)
    results = model.val(data=data_yaml, iou=0.5)

    # Per-class recall at IoU 0.5
    per_class_recall = results.box.r  # shape: (num_classes,)
    for i, name in enumerate(CLASS_NAMES):
        print(f"{name}: recall={per_class_recall[i]:.3f}")

    # Flag any class below 0.7 recall
    weak_classes = [
        CLASS_NAMES[i]
        for i in range(len(CLASS_NAMES))
        if per_class_recall[i] < 0.7
    ]
    if weak_classes:
        print(f"\n⚠ Classes below 0.7 recall: {weak_classes}")
        print("Action: add more training examples for these classes")
```

### Evaluation checklist

1. Run validation on held-out test split (not val split).
2. Report per-class recall at IoU 0.5.
3. Flag any class below 0.7 recall — those need more training data.
4. Visualize failure cases: false negatives grouped by class and source
   DOT (VDOT vs. FDOT vs. TxDOT) to catch domain-specific gaps.
5. Compare results across DOT sources to ensure the model generalizes.

---

## NMS and Post-Processing

Because tiles overlap 20%, detections near tile edges will be
duplicated. After running inference on all tiles for a sheet, merge
results back to full-sheet coordinates and apply NMS:

```python
def merge_tile_detections(
    tile_results: list[dict],
    iou_threshold: float = 0.5,
) -> list[dict]:
    """Merge per-tile detections back to full-sheet coordinates and NMS.

    Each tile_result dict has keys:
      - tile_x1, tile_y1, tile_size: tile position in full sheet
      - detections: list of (class_id, x_center, y_center, w, h, conf)
        in tile-normalized coordinates
    """
    # TODO: implement — convert tile coords to sheet coords, then NMS
    raise NotImplementedError
```
