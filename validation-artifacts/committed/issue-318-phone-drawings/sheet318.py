"""#318 (R149): the plan sheet's smallest text at a phone viewer's fit-width zoom.

    python sheet318.py <plan.pdf>

A phone PDF viewer fits the page's width to the screen.  An 11x17
landscape page is 17 in = 1224 pt wide, so at a 360 px screen one point
is 360 / 1224 CSS px.  The smallest text on page 1 (each character's own
font size) is reported in points and as the CSS px it becomes at 360
and 320, against the smallest ruled UI type role (10 px,
lib/design/type-roles.ts).
"""

import sys
from collections import Counter

import pypdfium2 as pdfium
import pypdfium2.raw as raw

doc = pdfium.PdfDocument(sys.argv[1])
page = doc[0]
w_pt, h_pt = page.get_size()
tp = page.get_textpage()
sizes = Counter()
for i in range(tp.count_chars()):
    ch = raw.FPDFText_GetUnicode(tp.raw, i)
    if ch <= 32:
        continue
    sizes[round(raw.FPDFText_GetFontSize(tp.raw, i), 2)] += 1
smallest = min(sizes)
print(f"page 1: {w_pt:.0f} x {h_pt:.0f} pt; font sizes (pt: chars): {dict(sorted(sizes.items()))}")
for screen in (360, 320):
    scale = screen / w_pt
    print(
        f"at {screen} px fit-width: 1 pt = {scale:.3f} px; smallest text {smallest} pt = "
        f"{smallest * scale:.2f} px; the body sizes 7-9 pt = {7 * scale:.2f}-{9 * scale:.2f} px "
        f"(smallest ruled UI role: 10 px)"
    )
