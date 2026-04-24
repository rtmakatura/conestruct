"""
YOLOv11 training pipeline for traffic control symbol detection.

⚠️ AGPL — uses Ultralytics (YOLOv11). Replace with RF-DETR before commercial release.

Pipeline:
    1. Tile images from data/yolo/ into 1024x1024 tiles with 20% overlap
    2. Split tiled data into train/val sets
    3. Train YOLOv11-s
    4. Write a summary report with per-class metrics

Usage:
    python -m src.detection.train [--data-dir data/yolo] [--epochs 100]
"""

from __future__ import annotations

import argparse
import logging
import random
import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path

import yaml
from PIL import Image

# ⚠️ AGPL — replace with RF-DETR before commercial release
from ultralytics import YOLO

logger = logging.getLogger(__name__)

CLASS_NAMES = [
    "CONE",
    "DRUM",
    "TUBULAR_MARKER",
    "BARRICADE_TYPE_II",
    "BARRICADE_TYPE_III",
    "LONGITUDINAL_CHANNELIZER",
    "ARROW_BOARD",
    "PCMS",
    "TRUCK_MOUNTED_ATTENUATOR",
    "TEMPORARY_BARRIER",
    "FLAGGER_STATION",
    "TEMPORARY_SIGNAL",
    "SIGN_GENERIC",
    "DETOUR_MARKER",
    "CHANNELIZER_OPTIONAL",
]

DEFAULT_DATA_DIR = Path("data/yolo")
DEFAULT_TILED_DIR = Path("data/yolo_tiled")
DEFAULT_RUNS_DIR = Path("runs/detect")

TILE_SIZE = 1024
TILE_OVERLAP = 0.2
MIN_OBJECT_AREA = 16
VAL_FRACTION = 0.2


# ---------------------------------------------------------------------------
# Tiling (from skills/yolo-training-pipeline/SKILL.md)
# ---------------------------------------------------------------------------


def parse_yolo_labels(label_path: Path) -> list[tuple[int, float, float, float, float]]:
    """Read a YOLO label file. Returns [(class_id, xc, yc, w, h), ...]."""
    labels = []
    if not label_path.exists():
        return labels
    for line in label_path.read_text().strip().splitlines():
        parts = line.strip().split()
        if len(parts) != 5:
            continue
        cls = int(parts[0])
        xc, yc, w, h = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
        labels.append((cls, xc, yc, w, h))
    return labels


def tile_image(
    image_path: Path,
    output_dir: Path,
    tile_size: int = TILE_SIZE,
    overlap: float = TILE_OVERLAP,
) -> list[dict]:
    """Slice an image into overlapping tiles. Returns tile metadata."""
    img = Image.open(image_path)
    w, h = img.size
    stride = int(tile_size * (1 - overlap))
    tiles = []

    for y in range(0, h, stride):
        for x in range(0, w, stride):
            x2 = min(x + tile_size, w)
            y2 = min(y + tile_size, h)
            x1 = max(x2 - tile_size, 0)
            y1 = max(y2 - tile_size, 0)

            crop = img.crop((x1, y1, x2, y2))
            tile_name = f"{image_path.stem}_tile_{x1}_{y1}.png"
            crop.save(output_dir / tile_name)

            tiles.append(
                {
                    "tile_name": tile_name,
                    "source_image": str(image_path),
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                }
            )

    img.close()
    return tiles


def remap_labels_to_tile(
    labels: list[tuple[int, float, float, float, float]],
    img_w: int,
    img_h: int,
    tile_x1: int,
    tile_y1: int,
    tile_size: int,
    min_area: int = MIN_OBJECT_AREA,
) -> list[tuple[int, float, float, float, float]]:
    """Convert full-image YOLO labels to tile-local coordinates."""
    tile_labels = []
    for cls, xc, yc, bw, bh in labels:
        abs_xc = xc * img_w
        abs_yc = yc * img_h
        abs_w = bw * img_w
        abs_h = bh * img_h

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

        new_xc = ((left + right) / 2 - tile_x1) / tile_size
        new_yc = ((top + bottom) / 2 - tile_y1) / tile_size
        new_w = clipped_w / tile_size
        new_h = clipped_h / tile_size

        tile_labels.append((cls, new_xc, new_yc, new_w, new_h))

    return tile_labels


def write_yolo_labels(
    labels: list[tuple[int, float, float, float, float]],
    output_path: Path,
) -> None:
    """Write YOLO-format label file."""
    lines = [f"{cls} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}" for cls, xc, yc, w, h in labels]
    output_path.write_text("\n".join(lines) + "\n" if lines else "", encoding="utf-8")


# ---------------------------------------------------------------------------
# Preprocessing: tile + split
# ---------------------------------------------------------------------------


def preprocess(
    data_dir: Path,
    tiled_dir: Path,
    val_fraction: float = VAL_FRACTION,
    seed: int = 42,
) -> Path:
    """Tile images and labels, split into train/val, write data.yaml.

    Expected input layout in data_dir:
        images/*.png (or .jpg)
        labels/*.txt

    Output layout in tiled_dir:
        images/train/  images/val/
        labels/train/  labels/val/
        data.yaml
    """
    images_in = data_dir / "images"
    labels_in = data_dir / "labels"

    if not images_in.exists():
        logger.error("No images/ directory found in %s", data_dir)
        sys.exit(1)

    # Collect source images
    image_files = sorted(
        [f for f in images_in.iterdir() if f.suffix.lower() in (".png", ".jpg", ".jpeg")]
    )
    if not image_files:
        logger.error("No images found in %s", images_in)
        sys.exit(1)

    logger.info("Found %d source images to tile", len(image_files))

    # Create output directories
    tiled_images = tiled_dir / "images" / "all"
    tiled_labels = tiled_dir / "labels" / "all"
    tiled_images.mkdir(parents=True, exist_ok=True)
    tiled_labels.mkdir(parents=True, exist_ok=True)

    # Check if tiling is already cached
    existing_tiles = list(tiled_images.glob("*.png")) + list(tiled_images.glob("*.jpg"))
    if existing_tiles:
        logger.info("Found %d cached tiles in %s, skipping tiling", len(existing_tiles), tiled_dir)
    else:
        # Tile each image + remap its labels
        total_tiles = 0
        total_labels = 0
        for img_path in image_files:
            label_path = labels_in / f"{img_path.stem}.txt"
            labels = parse_yolo_labels(label_path)

            img = Image.open(img_path)
            img_w, img_h = img.size
            img.close()

            tiles = tile_image(img_path, tiled_images)

            for tile in tiles:
                tile_labels = remap_labels_to_tile(
                    labels, img_w, img_h, tile["x1"], tile["y1"], TILE_SIZE
                )
                tile_label_path = tiled_labels / f"{Path(tile['tile_name']).stem}.txt"
                write_yolo_labels(tile_labels, tile_label_path)
                total_labels += len(tile_labels)

            total_tiles += len(tiles)
            logger.info(
                "  %s -> %d tiles (%d labels)",
                img_path.name,
                len(tiles),
                sum(
                    len(remap_labels_to_tile(labels, img_w, img_h, t["x1"], t["y1"], TILE_SIZE))
                    for t in tiles
                ),
            )

        logger.info("Tiling complete: %d tiles, %d label instances", total_tiles, total_labels)

    # Split into train/val
    all_tiles = sorted([f for f in tiled_images.iterdir() if f.suffix.lower() in (".png", ".jpg")])
    random.seed(seed)
    random.shuffle(all_tiles)
    split_idx = max(1, int(len(all_tiles) * (1 - val_fraction)))
    train_tiles = all_tiles[:split_idx]
    val_tiles = all_tiles[split_idx:]

    logger.info("Split: %d train, %d val", len(train_tiles), len(val_tiles))

    for split_name, split_files in [("train", train_tiles), ("val", val_tiles)]:
        img_split_dir = tiled_dir / "images" / split_name
        lbl_split_dir = tiled_dir / "labels" / split_name
        img_split_dir.mkdir(parents=True, exist_ok=True)
        lbl_split_dir.mkdir(parents=True, exist_ok=True)

        for tile_path in split_files:
            dst_img = img_split_dir / tile_path.name
            if not dst_img.exists():
                shutil.copy2(tile_path, dst_img)

            label_src = tiled_labels / f"{tile_path.stem}.txt"
            dst_lbl = lbl_split_dir / label_src.name
            if label_src.exists() and not dst_lbl.exists():
                shutil.copy2(label_src, dst_lbl)

    # Write data.yaml
    data_yaml_path = tiled_dir / "data.yaml"
    data_config = {
        "path": str(tiled_dir.resolve()),
        "train": "images/train",
        "val": "images/val",
        "names": {i: name for i, name in enumerate(CLASS_NAMES)},
    }
    data_yaml_path.write_text(yaml.dump(data_config, default_flow_style=False), encoding="utf-8")
    logger.info("Wrote %s", data_yaml_path)

    return data_yaml_path


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


def train(
    data_yaml: Path,
    epochs: int,
    batch_size: int,
    imgsz: int,
    model_size: str,
    runs_dir: Path,
) -> Path:
    """Run YOLOv11 training. Returns the run directory."""
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    run_name = f"run_{timestamp}"

    model_name = f"yolo11{model_size}.pt"
    logger.info("Loading model: %s", model_name)
    model = YOLO(model_name)

    logger.info(
        "Starting training: epochs=%d, batch=%d, imgsz=%d, run=%s",
        epochs,
        batch_size,
        imgsz,
        run_name,
    )

    results = model.train(
        data=str(data_yaml.resolve()),
        epochs=epochs,
        batch=batch_size,
        imgsz=imgsz,
        project=str(runs_dir),
        name=run_name,
        patience=20,
        optimizer="AdamW",
        lr0=0.001,
        # Augmentation (from skills/yolo-training-pipeline/SKILL.md)
        fliplr=0.5,
        flipud=0.0,
        degrees=5.0,
        mosaic=1.0,
        mixup=0.0,
        hsv_h=0.0,
        hsv_s=0.1,
        hsv_v=0.1,
        scale=0.2,
    )

    run_dir = runs_dir / run_name
    write_summary(model, results, data_yaml, run_dir)
    return run_dir


# ---------------------------------------------------------------------------
# Summary report
# ---------------------------------------------------------------------------


def write_summary(model: YOLO, results, data_yaml: Path, run_dir: Path) -> None:
    """Write a markdown summary of training results."""
    summary_path = run_dir / "summary.md"

    # Run validation to get per-class metrics
    logger.info("Running validation for summary...")
    val_results = model.val(data=str(data_yaml.resolve()), iou=0.5)

    lines = [
        "# Training Summary",
        "",
        f"- **Run:** `{run_dir.name}`",
        f"- **Timestamp:** {datetime.now(UTC).isoformat()}",
        "- **Model:** YOLOv11-s",
        f"- **Data:** `{data_yaml}`",
        "",
        "## Per-Class Metrics (IoU=0.5)",
        "",
        "| Class | Precision | Recall | mAP50 |",
        "|-------|-----------|--------|-------|",
    ]

    # Extract per-class metrics
    box = val_results.box
    n_classes = len(CLASS_NAMES)
    weak_classes = []

    for i in range(n_classes):
        p = box.p[i] if i < len(box.p) else 0.0
        r = box.r[i] if i < len(box.r) else 0.0
        ap = box.ap50[i] if i < len(box.ap50) else 0.0
        lines.append(f"| {CLASS_NAMES[i]} | {p:.3f} | {r:.3f} | {ap:.3f} |")
        if r < 0.7:
            weak_classes.append(CLASS_NAMES[i])

    lines.extend(
        [
            "",
            f"**Overall mAP50:** {box.map50:.3f}",
            f"**Overall mAP50-95:** {box.map:.3f}",
            "",
        ]
    )

    if weak_classes:
        lines.extend(
            [
                "## Classes Below 0.7 Recall",
                "",
                *[f"- {c}" for c in weak_classes],
                "",
                "**Action:** Add more training examples for these classes.",
                "",
            ]
        )

    # Confusion matrix location
    cm_path = run_dir / "confusion_matrix.png"
    if cm_path.exists():
        lines.extend(
            [
                "## Confusion Matrix",
                "",
                "![Confusion Matrix](confusion_matrix.png)",
                "",
            ]
        )

    # Best weights location
    best_pt = run_dir / "weights" / "best.pt"
    lines.extend(
        [
            "## Artifacts",
            "",
            f"- Best weights: `{best_pt}`",
            f"- Last weights: `{run_dir / 'weights' / 'last.pt'}`",
            f"- Training curves: `{run_dir / 'results.csv'}`",
            "",
        ]
    )

    summary_path.write_text("\n".join(lines), encoding="utf-8")
    logger.info("Summary written to %s", summary_path)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Tile images and train YOLOv11 for TCP symbol detection.",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help=f"Input directory with images/ and labels/ (default: {DEFAULT_DATA_DIR})",
    )
    parser.add_argument(
        "--tiled-dir",
        type=Path,
        default=DEFAULT_TILED_DIR,
        help=f"Output directory for tiled data (default: {DEFAULT_TILED_DIR})",
    )
    parser.add_argument(
        "--runs-dir",
        type=Path,
        default=DEFAULT_RUNS_DIR,
        help=f"Output directory for training runs (default: {DEFAULT_RUNS_DIR})",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=100,
        help="Number of training epochs (default: 100)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=16,
        help="Batch size (default: 16)",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=1024,
        help="Training image size (default: 1024)",
    )
    parser.add_argument(
        "--model-size",
        default="s",
        choices=["n", "s", "m", "l", "x"],
        help="YOLOv11 model size (default: s)",
    )
    parser.add_argument(
        "--val-fraction",
        type=float,
        default=VAL_FRACTION,
        help=f"Fraction of data for validation (default: {VAL_FRACTION})",
    )
    parser.add_argument(
        "--skip-tiling",
        action="store_true",
        help="Skip tiling step (use existing tiled data)",
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stderr)],
    )

    # Step 1: Tile + split
    if args.skip_tiling:
        data_yaml = args.tiled_dir / "data.yaml"
        if not data_yaml.exists():
            logger.error("--skip-tiling but %s not found", data_yaml)
            sys.exit(1)
    else:
        data_yaml = preprocess(args.data_dir, args.tiled_dir, args.val_fraction)

    # Step 2: Train
    run_dir = train(
        data_yaml=data_yaml,
        epochs=args.epochs,
        batch_size=args.batch_size,
        imgsz=args.imgsz,
        model_size=args.model_size,
        runs_dir=args.runs_dir,
    )

    print(f"\nTraining complete. Run directory: {run_dir}")
    print(f"Summary: {run_dir / 'summary.md'}")
    print(f"Best weights: {run_dir / 'weights' / 'best.pt'}")


if __name__ == "__main__":
    main()
