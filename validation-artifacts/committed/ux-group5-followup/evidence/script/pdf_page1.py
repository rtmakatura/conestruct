"""#450 walk: rasterize the walk's audit PDF for the crops.

    uv run --extra dev python pdf_page1.py <audit.pdf> <outdir>

Writes page 1 (the cover, with the ledger line) and the first page that
holds "See Not checked yet." as PNGs at 110 dpi, and prints the lines of
each that name the section, plus whether "pending" is anywhere in the PDF.
"""

import sys
from pathlib import Path

import pypdfium2 as pdfium

pdf, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
doc = pdfium.PdfDocument(str(pdf))
try:
    texts = [page.get_textpage().get_text_bounded() for page in doc]
    flat = [" ".join(t.split()) for t in texts]
    sentence_page = next((i for i, t in enumerate(flat) if "See Not checked yet." in t), None)
    print("pages", len(doc), "| sentence on page", None if sentence_page is None else sentence_page + 1)
    print("pending anywhere:", any("pending" in t.lower() for t in flat))
    for i in sorted({0, sentence_page if sentence_page is not None else 0}):
        name = out / f"pdf-page-{i + 1}.png"
        doc[i].render(scale=110 / 72).to_pil().save(name)
        for line in texts[i].splitlines():
            if "not checked yet" in line.lower():
                print(f"  p{i + 1}: {' '.join(line.split())}")
finally:
    doc.close()
