> **SHELVED 2026-04-24.** V1 of the generation product does not parse CAD
> drawings. Keep for reference if V3 introduces CAD ingestion.

# Civil PDF Parsing

## DPI Settings

| Context | DPI | Rationale |
|---|---|---|
| Training data | 300 | Balances detail vs. file size for large datasets |
| Inference display | 600 | Sharper output for human review of results |

---

## PDF Library

> **HARD RULE:** PyMuPDF (fitz) is AGPL-3.0. It is used for development
> only. **Before any commercial release, all PyMuPDF usage must be
> migrated to pypdfium2 (Apache-2.0).** Flag this in every file that
> imports `fitz`.

### Rendering with PyMuPDF (dev)

```python
# ⚠️ AGPL — replace with pypdfium2 before commercial release
import fitz

def render_page(pdf_path: str, page_num: int, dpi: int = 300) -> bytes:
    """Render a single PDF page to PNG bytes."""
    doc = fitz.open(pdf_path)
    page = doc[page_num]
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    return pix.tobytes("png")
```

### Rendering with pypdfium2 (commercial)

```python
import pypdfium2 as pdfium

def render_page(pdf_path: str, page_num: int, dpi: int = 300) -> bytes:
    """Render a single PDF page to PNG bytes."""
    pdf = pdfium.PdfDocument(pdf_path)
    page = pdf[page_num]
    scale = dpi / 72
    bitmap = page.render(scale=scale)
    pil_image = bitmap.to_pil()
    import io
    buf = io.BytesIO()
    pil_image.save(buf, format="PNG")
    return buf.getvalue()
```

---

## Detecting TCP Sheets

Traffic Control Plan sheets are identified by matching text in the sheet
title block. Extract text from each page and match against these patterns:

```python
import re

TCP_PATTERNS = [
    re.compile(r"\bTCP\b"),
    re.compile(r"TRAFFIC\s+CONTROL", re.IGNORECASE),
    re.compile(r"\bMOT\b"),                        # Maintenance of Traffic
    re.compile(r"WZ-\d+", re.IGNORECASE),           # Work Zone sheet numbering
    re.compile(r"BC(\(\d+\))?", re.IGNORECASE),     # Barricade Configuration
]


def is_tcp_sheet(page_text: str) -> bool:
    """Return True if page text matches any TCP pattern."""
    return any(p.search(page_text) for p in TCP_PATTERNS)
```

### Text extraction

```python
# ⚠️ AGPL — replace with pypdfium2 before commercial release
import fitz

def extract_page_text(pdf_path: str, page_num: int) -> str:
    doc = fitz.open(pdf_path)
    return doc[page_num].get_text()
```

```python
# pypdfium2 equivalent
import pypdfium2 as pdfium

def extract_page_text(pdf_path: str, page_num: int) -> str:
    pdf = pdfium.PdfDocument(pdf_path)
    page = pdf[page_num]
    textpage = page.get_textpage()
    return textpage.get_text_bounded()
```

### Filtering workflow

```python
def find_tcp_pages(pdf_path: str) -> list[dict]:
    """Return metadata for all TCP sheets in a PDF."""
    # ⚠️ AGPL — replace with pypdfium2 before commercial release
    doc = fitz.open(pdf_path)
    tcp_pages = []
    for i, page in enumerate(doc):
        text = page.get_text()
        if is_tcp_sheet(text):
            tcp_pages.append({
                "page_number": i,
                "sheet_id": _extract_sheet_id(text),
                "pdf_path": pdf_path,
            })
    return tcp_pages
```

---

## Metadata Requirements

Every rendered image must carry metadata that traces back to the source.
Always preserve:

| Field | Type | Example |
|---|---|---|
| `pdf_path` | `str` | `data/raw/VDOT_I66_2024.pdf` |
| `page_number` | `int` | `14` (0-indexed) |
| `sheet_id` | `str | None` | `"TCP-3"`, `"WZ-02"`, `None` if not found |
| `dpi` | `int` | `300` |
| `render_timestamp` | `str` (ISO 8601) | `"2026-04-18T22:30:00Z"` |

Store as a sidecar JSON file alongside each rendered image:

```
data/rendered/
  VDOT_I66_2024_p014.png
  VDOT_I66_2024_p014.json    # metadata
```

```json
{
  "pdf_path": "data/raw/VDOT_I66_2024.pdf",
  "page_number": 14,
  "sheet_id": "TCP-3",
  "dpi": 300,
  "render_timestamp": "2026-04-18T22:30:00Z"
}
```

---

## Scale Bar Extraction

> **Deferred to v2.** Not implemented in v1.

Planned approach for reference:

1. Locate the scale bar graphic on the sheet (typically bottom-right of
   the title block area).
2. OCR the label text (e.g., `1" = 20'`, `SCALE: 1:240`).
3. Measure the scale bar length in pixels.
4. Compute `pixels_per_foot = bar_length_px / bar_length_ft`.

This enables converting bounding box pixel coordinates to real-world
distances. Until v2, all spatial output is in pixel coordinates only.

---

## Common DOT Sheet Sizes

DOT plans use non-standard page sizes. Common dimensions:

| Size | Inches | At 300 DPI (px) |
|---|---|---|
| ANSI D | 22 × 34 | 6600 × 10200 |
| Arch D | 24 × 36 | 7200 × 10800 |
| ANSI E | 34 × 44 | 10200 × 13200 |

These are large images. At 300 DPI, a single Arch D sheet is ~75 MP.
Tiling is required for detection (see `yolo-training-pipeline` skill).
