"""#458 production check: the audit PDF's cover count and "Not checked yet" section.

    uv run --extra dev python pdf_section.py <audit.pdf> <outdir> <tag>

Writes <tag>-pdf-text.txt (every page's text), renders page 1 and the page
holding "Not checked yet" as PNGs at 150 dpi, and prints the cover's
"not checked yet" lines and the section's lines.
"""

import sys
from pathlib import Path

import pypdfium2 as pdfium

pdf, out, tag = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
out.mkdir(parents=True, exist_ok=True)
doc = pdfium.PdfDocument(str(pdf))
try:
    texts = [page.get_textpage().get_text_bounded() for page in doc]
    (out / f"{tag}-pdf-text.txt").write_text(
        "".join(f"=== page {i + 1}\n{t}\n" for i, t in enumerate(texts)), encoding="utf-8"
    )
    print("pages", len(doc))
    for ln in texts[0].splitlines():
        if "not checked" in ln.lower():
            print("cover:", " ".join(ln.split()))
    for i, t in enumerate(texts):
        lines = t.splitlines()
        hit = [k for k, ln in enumerate(lines) if ln.strip() == "Not checked yet"]
        if i == 0 or hit:
            doc[i].render(scale=150 / 72).to_pil().save(out / f"{tag}-pdf-page-{i + 1}.png")
        for k in hit:
            print(f"section on page {i + 1}:")
            for ln in lines[k : k + 14]:
                print("  |", ln.rstrip())
finally:
    doc.close()
