"""
Isolate traffic control plan (TCP) sheets from full plan PDFs.

Scans PDFs for pages whose title block text matches TCP-related patterns,
renders matching pages to 300 DPI PNGs, and writes sidecar metadata JSON.

⚠️ AGPL — uses PyMuPDF (fitz). Replace with pypdfium2 before commercial release.

Usage:
    python -m src.pdf_processing.isolate_tcp [--input-dir DIR] [--output-dir DIR]
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

# ⚠️ AGPL — replace with pypdfium2 before commercial release
import fitz

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# TCP detection patterns (from skills/civil-pdf-parsing/SKILL.md)
# ---------------------------------------------------------------------------

# HIGH confidence: sheet code that unambiguously identifies a TCP sheet
HIGH_PATTERNS = [
    re.compile(r"\bTCP-?\d+", re.IGNORECASE),  # TCP-01, TCP1
    re.compile(r"\bTC-?\d+", re.IGNORECASE),  # TC-1, TC01
    re.compile(r"\bWZ-?\d+", re.IGNORECASE),  # WZ-01
    re.compile(r"\bBC\s*\(?\d+\)?", re.IGNORECASE),  # BC-1, BC(1)
]

# MEDIUM confidence: title text that likely indicates a TCP sheet
MEDIUM_PATTERNS = [
    re.compile(r"TRAFFIC\s+CONTROL", re.IGNORECASE),
    re.compile(r"\bMOT\b"),  # Maintenance of Traffic
    re.compile(r"MAINTENANCE\s+OF\s+TRAFFIC", re.IGNORECASE),
    re.compile(r"\bTCP\b"),  # bare TCP without number
]

DPI = 300
DEFAULT_INPUT_DIR = Path("data/raw/txdot")
DEFAULT_OUTPUT_DIR = Path("data/processed/tcp_sheets")

# Title block region: bottom 15% of page height
TITLE_BLOCK_FRACTION = 0.15


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class TCPDetection:
    source_pdf: str
    page_number: int
    detected_title_text: str
    confidence: str  # "HIGH" or "MEDIUM"
    matched_pattern: str
    render_dpi: int
    render_timestamp: str
    output_image: str


# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------


def extract_title_block_text(page: fitz.Page) -> str:
    """Extract text from the title block region (bottom ~15% of page)."""
    rect = page.rect
    title_rect = fitz.Rect(
        rect.x0,
        rect.y1 - rect.height * TITLE_BLOCK_FRACTION,
        rect.x1,
        rect.y1,
    )
    return page.get_text(clip=title_rect)


def classify_tcp(title_text: str, full_text: str) -> tuple[str, str] | None:
    """Classify whether a page is a TCP sheet.

    Checks title block text first (primary), then full page text (fallback).
    Returns (confidence, matched_pattern) or None.
    """
    # Check HIGH patterns against title block first, then full page
    for text in [title_text, full_text]:
        for pattern in HIGH_PATTERNS:
            m = pattern.search(text)
            if m:
                return ("HIGH", m.group(0))

    # Check MEDIUM patterns against title block first, then full page
    for text in [title_text, full_text]:
        for pattern in MEDIUM_PATTERNS:
            m = pattern.search(text)
            if m:
                return ("MEDIUM", m.group(0))

    return None


def render_page_to_png(page: fitz.Page, output_path: Path, dpi: int = DPI) -> int:
    """Render a page to PNG. Returns file size in bytes."""
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    png_bytes = pix.tobytes("png")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(png_bytes)
    return len(png_bytes)


# ---------------------------------------------------------------------------
# Project ID extraction
# ---------------------------------------------------------------------------

_CSJ_PATTERN = re.compile(r"\d{4}-\d{2}-\d{3}")


def extract_project_id(pdf_path: Path) -> str:
    """Derive a project ID from the PDF path or filename."""
    # Try CSJ from path
    full = str(pdf_path)
    m = _CSJ_PATTERN.search(full)
    if m:
        return m.group(0)
    # Fall back to parent directory name
    return re.sub(r'[<>:"|?*]', "_", pdf_path.parent.name) or pdf_path.stem


# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------


@dataclass
class RunStats:
    total_pdfs: int = 0
    total_pages: int = 0
    high_confidence: int = 0
    medium_confidence: int = 0
    skipped_errors: int = 0
    total_png_bytes: int = 0


def process_pdf(pdf_path: Path, output_dir: Path, stats: RunStats) -> list[TCPDetection]:
    """Process a single PDF: detect TCP sheets, render, write metadata."""
    detections = []

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        logger.warning("Failed to open %s: %s", pdf_path, e)
        stats.skipped_errors += 1
        return detections

    project_id = extract_project_id(pdf_path)
    stats.total_pages += len(doc)

    for page_num in range(len(doc)):
        page = doc[page_num]

        try:
            title_text = extract_title_block_text(page)
            full_text = page.get_text()
        except Exception as e:
            logger.warning("Text extraction failed for %s p%d: %s", pdf_path, page_num, e)
            continue

        result = classify_tcp(title_text, full_text)
        if result is None:
            continue

        confidence, matched = result

        # Render to PNG — include PDF stem to avoid collisions within same project
        safe_project = re.sub(r'[<>:"|?*]', "_", project_id)
        safe_stem = re.sub(r'[<>:"|?*]', "_", pdf_path.stem)
        image_name = f"{safe_project}_{safe_stem}_{page_num:04d}.png"
        image_path = output_dir / image_name

        try:
            png_size = render_page_to_png(page, image_path, DPI)
        except Exception as e:
            logger.warning("Render failed for %s p%d: %s", pdf_path, page_num, e)
            continue

        stats.total_png_bytes += png_size

        if confidence == "HIGH":
            stats.high_confidence += 1
        else:
            stats.medium_confidence += 1

        detection = TCPDetection(
            source_pdf=str(pdf_path),
            page_number=page_num,
            detected_title_text=title_text.strip()[:500],
            confidence=confidence,
            matched_pattern=matched,
            render_dpi=DPI,
            render_timestamp=datetime.now(UTC).isoformat(),
            output_image=str(image_path),
        )
        detections.append(detection)

        # Write sidecar JSON
        json_path = image_path.with_suffix(".json")
        json_path.write_text(json.dumps(asdict(detection), indent=2))

        logger.info(
            "  [%s] %s p%d -> %s (matched: %s)",
            confidence,
            pdf_path.name,
            page_num,
            image_name,
            matched,
        )

    doc.close()
    return detections


def run(input_dir: Path, output_dir: Path) -> RunStats:
    """Process all PDFs in input_dir, output TCP sheets to output_dir."""
    output_dir.mkdir(parents=True, exist_ok=True)

    pdf_files = sorted(input_dir.rglob("*.pdf")) + sorted(input_dir.rglob("*.PDF"))
    # Deduplicate (case-insensitive filesystems)
    seen = set()
    unique_pdfs = []
    for p in pdf_files:
        key = str(p).lower()
        if key not in seen:
            seen.add(key)
            unique_pdfs.append(p)

    stats = RunStats(total_pdfs=len(unique_pdfs))
    logger.info("Found %d PDFs in %s", len(unique_pdfs), input_dir)

    for i, pdf_path in enumerate(unique_pdfs, 1):
        logger.info("[%d/%d] Processing %s", i, stats.total_pdfs, pdf_path.name)
        t0 = time.monotonic()
        process_pdf(pdf_path, output_dir, stats)
        elapsed = time.monotonic() - t0
        logger.debug("  processed in %.1fs", elapsed)

    return stats


def print_summary(stats: RunStats) -> None:
    """Print a human-readable summary."""
    total_tcp = stats.high_confidence + stats.medium_confidence
    png_mb = stats.total_png_bytes / 1_048_576

    print("\n" + "=" * 60)
    print("TCP Sheet Isolation — Summary")
    print("=" * 60)
    print(f"PDFs processed:        {stats.total_pdfs}")
    print(f"Total pages scanned:   {stats.total_pages}")
    print(f"Errors/skipped:        {stats.skipped_errors}")
    print("---")
    print(f"TCP sheets found:      {total_tcp}")
    print(f"  HIGH confidence:     {stats.high_confidence}")
    print(f"  MEDIUM confidence:   {stats.medium_confidence}")
    print(f"Output disk usage:     {png_mb:.1f} MB")
    print("=" * 60)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Isolate TCP sheets from plan PDFs and render to PNG.",
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=DEFAULT_INPUT_DIR,
        help=f"Directory of source PDFs (default: {DEFAULT_INPUT_DIR})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory for PNGs + JSON (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stderr)],
    )

    stats = run(args.input_dir, args.output_dir)
    print_summary(stats)


if __name__ == "__main__":
    main()
