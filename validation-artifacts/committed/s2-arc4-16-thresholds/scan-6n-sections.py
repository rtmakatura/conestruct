"""s2-arc4 investigation scan: what do 6N.12 / 6N.16 actually say?

Subject-first: find the section headings, print their titles and the
text around them; then scan those sections for the distances the code
attributes to them (250 ft, 500 ft, A-spacing language).
Hygiene: case-insensitive, U+2011 normalized to ASCII hyphen.
"""

import re
import sys

from pypdf import PdfReader

sys.stdout.reconfigure(encoding="utf-8")

PDF = r"C:\Users\rtmak\Documents\traffic-control-tool\validation-artifacts\ta10_flagger\mutcd_part6.pdf"
reader = PdfReader(PDF)


def norm(s: str) -> str:
    return s.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-")


# Pass 1: locate pages mentioning 6N.12 / 6N.16 headings ("Section 6N.12" etc.)
hits = {"6N.12": [], "6N.16": []}
for i, page in enumerate(reader.pages):
    t = norm(page.extract_text() or "")
    for key in hits:
        if re.search(rf"Section\s+{re.escape(key)}\b", t, re.I):
            hits[key].append(i)

for key, pages in hits.items():
    print(f"=== 'Section {key}' heading found on 0-based PDF pages: {pages}")

# Pass 2: print the heading line + following ~40 lines from the first
# heading page of each, so the section title and opening text are visible.
for key, pages in hits.items():
    for pg in pages[:3]:
        t = norm(reader.pages[pg].extract_text() or "")
        lines = t.splitlines()
        for j, ln in enumerate(lines):
            if re.search(rf"Section\s+{re.escape(key)}\b", ln, re.I):
                print(f"\n----- page {pg} (0-based), heading context for {key} -----")
                print("\n".join(lines[max(0, j - 2) : j + 45]))
                break

# Pass 3: distance scan on those pages and the two following each
targets = [r"\b250\b", r"\b500\b", r"A[- ]?spacing", r"advance warning sign spacing", r"ramp"]
for key, pages in hits.items():
    scan_pages = sorted({p for pg in pages for p in (pg, pg + 1, pg + 2)})
    print(f"\n===== distance scan for {key} on pages {scan_pages} =====")
    for pg in scan_pages:
        if pg >= len(reader.pages):
            continue
        t = norm(reader.pages[pg].extract_text() or "")
        for pat in targets:
            for m in re.finditer(pat, t, re.I):
                s = max(0, m.start() - 90)
                snippet = t[s : m.end() + 90].replace("\n", " ")
                print(f"[p{pg}] /{pat}/: …{snippet}…")
