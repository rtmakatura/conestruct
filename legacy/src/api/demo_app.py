"""
Gradio demo for traffic control symbol detection.

⚠️ AGPL — uses PyMuPDF (fitz) and Ultralytics (YOLOv11).
Replace both before commercial release.

Upload a PDF -> detect TCP sheets -> run YOLO -> display results.

Usage:
    python -m src.api.demo_app [--model weights/best.pt] [--port 7860]

Non-goals (v1 is read-only display):
    - No user accounts
    - No saving results server-side
    - No multi-file batch upload
    - No pricing or estimating logic
    - No editing of detections
"""

from __future__ import annotations

import csv
import io
import logging
import os
import tempfile
from collections import defaultdict
from dataclasses import dataclass

import cv2

# ⚠️ AGPL — replace with pypdfium2 before commercial release
import fitz
import gradio as gr
import numpy as np

# ⚠️ AGPL — replace with RF-DETR before commercial release
from ultralytics import YOLO

from src.pdf_processing.isolate_tcp import (
    classify_tcp,
    extract_title_block_text,
)

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

# Colors per class (BGR for cv2, matching label studio config)
CLASS_COLORS = {
    "CONE": (0, 107, 255),
    "DRUM": (0, 214, 255),
    "TUBULAR_MARKER": (137, 0, 123),
    "BARRICADE_TYPE_II": (54, 67, 244),
    "BARRICADE_TYPE_III": (53, 57, 229),
    "LONGITUDINAL_CHANNELIZER": (71, 160, 67),
    "ARROW_BOARD": (170, 36, 142),
    "PCMS": (229, 136, 30),
    "TRUCK_MOUNTED_ATTENUATOR": (88, 85, 121),
    "TEMPORARY_BARRIER": (122, 110, 84),
    "FLAGGER_STATION": (40, 40, 198),
    "TEMPORARY_SIGNAL": (0, 160, 255),
    "SIGN_GENERIC": (117, 117, 117),
    "DETOUR_MARKER": (189, 119, 2),
    "CHANNELIZER_OPTIONAL": (0, 193, 255),
}

RENDER_DPI = 300
CONF_THRESHOLD = 0.25


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------


@dataclass
class SheetDetection:
    sheet_id: str
    page_number: int
    image: np.ndarray  # BGR
    boxes: list[dict]  # [{class, confidence, x1, y1, x2, y2}, ...]


# ---------------------------------------------------------------------------
# Pipeline functions
# ---------------------------------------------------------------------------


def extract_tcp_sheets(pdf_path: str) -> list[tuple[int, str, np.ndarray]]:
    """Extract TCP sheets from a PDF. Returns [(page_num, sheet_id, image_bgr), ...]."""
    doc = fitz.open(pdf_path)
    sheets = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        title_text = extract_title_block_text(page)
        full_text = page.get_text()

        result = classify_tcp(title_text, full_text)
        if result is None:
            continue

        _confidence, matched = result

        # Render to image
        zoom = RENDER_DPI / 72
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)

        # Convert to numpy BGR
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
        if pix.n == 4:  # RGBA
            img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
        elif pix.n == 3:  # RGB
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

        sheet_id = matched or f"page_{page_num}"
        sheets.append((page_num, sheet_id, img))

    doc.close()
    return sheets


def run_detection(
    model: YOLO,
    image: np.ndarray,
    conf: float = CONF_THRESHOLD,
) -> list[dict]:
    """Run YOLO on an image. Returns list of detection dicts."""
    results = model.predict(image, conf=conf, verbose=False)
    detections = []

    if results and len(results) > 0:
        r = results[0]
        for box in r.boxes:
            cls_id = int(box.cls[0])
            cls_name = CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else f"class_{cls_id}"
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append(
                {
                    "class": cls_name,
                    "confidence": float(box.conf[0]),
                    "x1": int(x1),
                    "y1": int(y1),
                    "x2": int(x2),
                    "y2": int(y2),
                }
            )

    return detections


def draw_detections(image: np.ndarray, detections: list[dict]) -> np.ndarray:
    """Draw colored bounding boxes and labels on an image."""
    img = image.copy()

    for det in detections:
        color = CLASS_COLORS.get(det["class"], (200, 200, 200))
        x1, y1, x2, y2 = det["x1"], det["y1"], det["x2"], det["y2"]

        # Box
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

        # Label background
        label = f"{det['class']} {det['confidence']:.2f}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        thickness = 1
        (tw, th), _ = cv2.getTextSize(label, font, font_scale, thickness)
        cv2.rectangle(img, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(img, label, (x1 + 2, y1 - 4), font, font_scale, (255, 255, 255), thickness)

    return img


def build_counts_table(all_detections: list[SheetDetection]) -> list[list[str]]:
    """Build a counts-by-class table for display."""
    rows = []
    for sheet in all_detections:
        counts: dict[str, list[float]] = defaultdict(list)
        for det in sheet.boxes:
            counts[det["class"]].append(det["confidence"])

        for cls_name in CLASS_NAMES:
            if cls_name in counts:
                confs = counts[cls_name]
                rows.append(
                    [
                        sheet.sheet_id,
                        cls_name,
                        str(len(confs)),
                        f"{sum(confs) / len(confs):.2f}",
                    ]
                )

    if not rows:
        rows.append(["—", "—", "0", "—"])

    return rows


def build_csv_bytes(all_detections: list[SheetDetection]) -> bytes:
    """Build CSV content for download."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["sheet_id", "class", "count", "confidence_avg"])

    for sheet in all_detections:
        counts: dict[str, list[float]] = defaultdict(list)
        for det in sheet.boxes:
            counts[det["class"]].append(det["confidence"])

        for cls_name in CLASS_NAMES:
            if cls_name in counts:
                confs = counts[cls_name]
                writer.writerow(
                    [
                        sheet.sheet_id,
                        cls_name,
                        len(confs),
                        f"{sum(confs) / len(confs):.3f}",
                    ]
                )

    return buf.getvalue().encode("utf-8")


# ---------------------------------------------------------------------------
# Main processing function (called by Gradio)
# ---------------------------------------------------------------------------


def process_pdf(
    pdf_file: str,
    model: YOLO,
) -> tuple[list[tuple[str, str]], list[list[str]], str | None]:
    """Process a PDF end-to-end.

    Returns:
        - gallery: list of (image_path, caption) for marked-up sheets
        - table: rows for the counts table
        - csv_path: path to downloadable CSV, or None
    """
    if pdf_file is None:
        return [], [["—", "—", "0", "—"]], None

    # Extract TCP sheets
    sheets = extract_tcp_sheets(pdf_file)
    if not sheets:
        return [], [["No TCP sheets found", "—", "0", "—"]], None

    all_detections: list[SheetDetection] = []
    gallery_items: list[tuple[np.ndarray, str]] = []

    for page_num, sheet_id, image in sheets:
        # Run detection
        boxes = run_detection(model, image)

        detection = SheetDetection(
            sheet_id=sheet_id,
            page_number=page_num,
            image=image,
            boxes=boxes,
        )
        all_detections.append(detection)

        # Draw boxes and prepare for gallery
        marked = draw_detections(image, boxes)
        # Convert BGR to RGB for Gradio display
        marked_rgb = cv2.cvtColor(marked, cv2.COLOR_BGR2RGB)
        caption = f"Page {page_num} — {sheet_id} ({len(boxes)} detections)"
        gallery_items.append((marked_rgb, caption))

    # Build counts table
    table_rows = build_counts_table(all_detections)

    # Write CSV to temp file
    csv_bytes = build_csv_bytes(all_detections)
    csv_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv", prefix="tcp_detections_")
    csv_tmp.write(csv_bytes)
    csv_tmp.close()

    return gallery_items, table_rows, csv_tmp.name


# ---------------------------------------------------------------------------
# Gradio UI
# ---------------------------------------------------------------------------


def create_app(model_path: str = "weights/best.pt") -> gr.Blocks:
    """Build the Gradio Blocks app."""

    # Load model once at startup
    if os.path.exists(model_path):
        model = YOLO(model_path)
    else:
        logger.warning("Model not found at %s — using yolo11s.pt placeholder", model_path)
        model = YOLO("yolo11s.pt")

    with gr.Blocks(
        title="TCP Symbol Detector",
        theme=gr.themes.Soft(),
    ) as app:
        gr.Markdown(
            "# Traffic Control Symbol Detector\n"
            "Upload a DOT plan PDF. The tool identifies traffic control plan (TCP) "
            "sheets and detects symbols: cones, drums, barricades, signs, arrow boards, "
            "PCMS, and channelizers.\n\n"
            "*v1 — read-only display. No accounts, no batch upload, no editing.*"
        )

        with gr.Row():
            with gr.Column(scale=1):
                pdf_input = gr.File(
                    label="Upload PDF",
                    file_types=[".pdf"],
                    type="filepath",
                )
                run_btn = gr.Button("Detect Symbols", variant="primary")

            with gr.Column(scale=3):
                gallery = gr.Gallery(
                    label="Detected TCP Sheets",
                    columns=1,
                    height=600,
                    object_fit="contain",
                )

        with gr.Row():
            with gr.Column():
                counts_table = gr.Dataframe(
                    headers=["Sheet ID", "Class", "Count", "Avg Confidence"],
                    label="Detection Counts",
                    interactive=False,
                )
            with gr.Column():
                csv_download = gr.File(
                    label="Download CSV",
                    interactive=False,
                )

        def on_click(pdf_file):
            if pdf_file is None:
                return [], [["—", "—", "0", "—"]], None
            return process_pdf(pdf_file, model)

        run_btn.click(
            fn=on_click,
            inputs=[pdf_input],
            outputs=[gallery, counts_table, csv_download],
        )

    return app


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Launch TCP symbol detection demo.")
    parser.add_argument(
        "--model",
        default="weights/best.pt",
        help="Path to trained YOLO weights (default: weights/best.pt)",
    )
    parser.add_argument("--port", type=int, default=7860)
    parser.add_argument("--share", action="store_true", help="Create a public Gradio link")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    app = create_app(model_path=args.model)
    app.launch(server_port=args.port, share=args.share)


if __name__ == "__main__":
    main()
