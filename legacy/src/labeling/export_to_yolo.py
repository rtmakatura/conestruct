"""
Export Label Studio annotations to YOLO format.

Pulls completed annotations from a Label Studio project and writes
YOLO-format .txt label files into the directory structure expected
by the yolo-training-pipeline skill.

Output structure:
    data/labels/raw/{image_stem}.txt

Each line: <class_id> <x_center> <y_center> <width> <height>
All coordinates normalized to [0, 1].

Usage:
    python -m src.labeling.export_to_yolo \\
        --api-key YOUR_KEY \\
        --project-id 1 \\
        --output-dir data/labels/raw
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from label_studio_sdk.client import LabelStudio

logger = logging.getLogger(__name__)

DEFAULT_LS_URL = "http://localhost:8080"
DEFAULT_OUTPUT_DIR = Path("data/labels/raw")

# Must match configs/label_studio_config.xml and data.yaml
CLASS_MAP = {
    "CONE": 0,
    "DRUM": 1,
    "TUBULAR_MARKER": 2,
    "BARRICADE_TYPE_II": 3,
    "BARRICADE_TYPE_III": 4,
    "LONGITUDINAL_CHANNELIZER": 5,
    "ARROW_BOARD": 6,
    "PCMS": 7,
    "TRUCK_MOUNTED_ATTENUATOR": 8,
    "TEMPORARY_BARRIER": 9,
    "FLAGGER_STATION": 10,
    "TEMPORARY_SIGNAL": 11,
    "SIGN_GENERIC": 12,
    "DETOUR_MARKER": 13,
    "CHANNELIZER_OPTIONAL": 14,
}


def extract_image_stem(task_data: dict) -> str:
    """Get the image filename stem from task data."""
    image_url = task_data.get("image", "")
    # Handle file:// URIs, regular paths, and URLs
    name = image_url.split("/")[-1].split("\\")[-1]
    if name.lower().endswith(".png"):
        name = name[:-4]
    return name


def convert_annotation(annotation: dict, image_stem: str) -> list[str]:
    """Convert a Label Studio annotation to YOLO format lines.

    Label Studio RectangleLabels use percentage coordinates:
        x, y = top-left corner as % of image width/height
        width, height = box size as % of image width/height
        rotation = degrees (we ignore non-zero rotation)

    YOLO format uses center-based normalized coordinates:
        x_center, y_center, width, height in [0, 1]
    """
    lines = []
    results = annotation.get("result", [])

    for r in results:
        if r.get("type") != "rectanglelabels":
            continue

        value = r["value"]
        labels = value.get("rectanglelabels", [])
        if not labels:
            continue

        label = labels[0]
        if label not in CLASS_MAP:
            logger.warning("Unknown label '%s' in %s, skipping", label, image_stem)
            continue

        class_id = CLASS_MAP[label]

        # Label Studio gives percentages (0-100)
        x_pct = value["x"] / 100.0
        y_pct = value["y"] / 100.0
        w_pct = value["width"] / 100.0
        h_pct = value["height"] / 100.0

        # Convert top-left to center
        x_center = x_pct + w_pct / 2.0
        y_center = y_pct + h_pct / 2.0

        # Clamp to [0, 1]
        x_center = max(0.0, min(1.0, x_center))
        y_center = max(0.0, min(1.0, y_center))
        w_pct = max(0.0, min(1.0, w_pct))
        h_pct = max(0.0, min(1.0, h_pct))

        lines.append(f"{class_id} {x_center:.6f} {y_center:.6f} {w_pct:.6f} {h_pct:.6f}")

    return lines


def export_project(
    ls: LabelStudio,
    project_id: int,
    output_dir: Path,
    skip_ambiguous: bool,
) -> tuple[int, int, int]:
    """Export all completed annotations. Returns (tasks, labeled, skipped)."""
    output_dir.mkdir(parents=True, exist_ok=True)

    tasks_total = 0
    tasks_labeled = 0
    tasks_skipped = 0

    for task in ls.tasks.list(project=project_id):
        tasks_total += 1
        annotations = task.annotations
        if not annotations:
            continue

        # Use the most recent annotation
        anno = annotations[-1]

        # Check for ambiguous flag
        if skip_ambiguous:
            for r in anno.get("result", []):
                if r.get("type") == "choices":
                    choices = r.get("value", {}).get("choices", [])
                    if "ambiguous" in choices:
                        logger.debug("Skipping ambiguous task %d", task.id)
                        tasks_skipped += 1
                        continue

        image_stem = extract_image_stem(task.data)
        lines = convert_annotation(anno, image_stem)

        if not lines:
            continue

        label_path = output_dir / f"{image_stem}.txt"
        label_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        tasks_labeled += 1
        logger.info("Exported %d boxes for %s", len(lines), image_stem)

    return tasks_total, tasks_labeled, tasks_skipped


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export Label Studio annotations to YOLO format.",
    )
    parser.add_argument(
        "--api-key",
        required=True,
        help="Label Studio API key",
    )
    parser.add_argument(
        "--project-id",
        type=int,
        required=True,
        help="Label Studio project ID to export",
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_LS_URL,
        help=f"Label Studio URL (default: {DEFAULT_LS_URL})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory for YOLO label files (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--include-ambiguous",
        action="store_true",
        help="Include tasks flagged as ambiguous (default: skip them)",
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stderr)],
    )

    ls = LabelStudio(base_url=args.url, api_key=args.api_key)
    total, labeled, skipped = export_project(
        ls,
        args.project_id,
        args.output_dir,
        skip_ambiguous=not args.include_ambiguous,
    )

    print("\nExport complete:")
    print(f"  Tasks total:    {total}")
    print(f"  Tasks exported: {labeled}")
    print(f"  Tasks skipped:  {skipped} (ambiguous)")
    print(f"  Output dir:     {args.output_dir}")


if __name__ == "__main__":
    main()
