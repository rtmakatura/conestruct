"""#453 walk: rasterize the audit PDF pages that print the changed sentences.

    uv run --extra dev python pdf_pages.py <audit.pdf> <outdir> <tag>

Writes page 1 and every page that holds the taper, buffer, spacing or
advance-sign section as PNGs at 110 dpi (<tag>-pdf-page-N.png), and prints,
for each page, the lines of those sections plus whether an engine key
("road_type", "urban_low", "->") is anywhere in the PDF.
"""

import sys
from pathlib import Path

import pypdfium2 as pdfium

pdf, out, tag = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
out.mkdir(parents=True, exist_ok=True)
HEADS = ("Taper Length", "Buffer Space", "Channelizing Device Spacing", "Advance Warning Signs")
KEYS = ("road_type", "urban_low", "->", "threshold ->", "[work_zone")
doc = pdfium.PdfDocument(str(pdf))
try:
    texts = [page.get_textpage().get_text_bounded() for page in doc]
    flat = " ".join(" ".join(t.split()) for t in texts)
    print("pages", len(doc), "| engine keys:", {k: k in flat for k in KEYS})
    pages = sorted({0} | {i for i, t in enumerate(texts) if any(h in t for h in HEADS)})
    for i in pages:
        doc[i].render(scale=110 / 72).to_pil().save(out / f"{tag}-pdf-page-{i + 1}.png")
        lines = [" ".join(ln.split()) for ln in texts[i].splitlines()]
        for ln in lines:
            if any(
                w in ln
                for w in (
                    "taper length is",
                    "Table 6B-2",
                    "devices are spaced",
                    "Table 6B-1",
                    "spacing:",
                    "threshold",
                    "road_type",
                    "max spacing",
                )
            ):
                print(f"  p{i + 1}: {ln[:160]}")
finally:
    doc.close()
