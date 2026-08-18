"""Table 6B-2 A-spacing values + Chapter 6H title."""

import re
import sys

from pypdf import PdfReader

sys.stdout.reconfigure(encoding="utf-8")

PDF = r"C:\Users\rtmak\Documents\traffic-control-tool\validation-artifacts\ta10_flagger\mutcd_part6.pdf"
reader = PdfReader(PDF)


def norm(s: str) -> str:
    return s.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-")


for i, page in enumerate(reader.pages):
    t = norm(page.extract_text() or "")
    if re.search(r"Table\s+6B-2", t, re.I) and re.search(r"spacing", t, re.I):
        lines = t.splitlines()
        for j, ln in enumerate(lines):
            if re.search(r"Table\s+6B-2", ln, re.I):
                print(f"----- page {i} (0-based) Table 6B-2 context -----")
                print("\n".join(lines[max(0, j - 4) : j + 30]))
                print()
                break
    if re.search(r"Chapter\s+6H\b", t, re.I):
        for ln in t.splitlines():
            if re.search(r"Chapter\s+6H\b", ln, re.I):
                print(f"[p{i}] Chapter 6H line: {ln.strip()}")
