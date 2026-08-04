# Arc 11 smoke — text assertions over the SERVED near_intersection
# documents downloaded by arc11-live-checks.js (Refs #117).  Run from
# the repo root:  .venv\Scripts\python.exe validation-artifacts/committed/arc11-117-enablement/live-checks/verify-served-docs.py
#
# The run's plan is the NEAR-SIDE CORNER-EXTENSION variant (the closure
# runs to the corner; the crossing sits ~100 ft past the work zone), so
# the variant-appropriate citations are Fig. 6P-21 / Case 18 — the
# far-side §6N.12.12 companion and the §6B.08 reopening taper genuinely
# do not apply to this shape and are correctly absent (their rendering
# is pinned by tests/test_near_intersection_voice.py on the far-side
# and midblock-reopening variants).
import os
import re

import pypdfium2 as pdfium

# The run wrote into out11/ (uncommitted working dir); the committed
# pack carries the artifacts beside this script.
_here = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(_here, "out11") if os.path.isdir(os.path.join(_here, "out11")) else _here

doc = pdfium.PdfDocument(os.path.join(OUT, "served-ni-plan.pdf"))
txt = "\n".join(doc[i].get_textpage().get_text_range() for i in range(len(doc)))
md = open(os.path.join(OUT, "served-ni-crew.md"), encoding="utf-8").read()

checks = [
    # Served plan-sheet PDF
    ("P1 Cases 18/19 NOT-DRAWN sheet note", "CROSS-STREET CONTROL PER CDOT S-630-1 SHEET 10, CASES" in txt),
    ("P2 corner-quadrant departure fine print names #128", "corner" in txt.lower() and "#128" in txt),
    ("P3 rightmost-lane assumption note (#176)", "CLOSED LANE DRAWN AS THE RIGHTMOST LANE" in txt),
    ("P4 COORDINATES row printed (#157)", bool(re.search(r"COORDINATES", txt))),
    ("P5 urban block-based placement disclosure (Sheet 10 Note 1)", "block" in txt.lower()),
    # Served crew narrative
    ("M1 Cross-Street Signs per-leg section", "Cross-Street Signs" in md),
    ("M2 sequencing note (TCS determination, judgment not arithmetic)", "Sequencing" in md),
    ("M3 ped/bike accommodation section (#125)", "## Pedestrian and Bicycle Accommodation" in md),
    ("M4 emergency access section naming CDOT 630.10(a) (#124)", "## Emergency Access" in md and "630.10(a)" in md),
    ("M5 rightmost-lane safety note (#176)", "RIGHTMOST lane" in md),
    ("M6 corner-extension variant cites Fig. 6P-21 / Case 18", "Fig. 6P-21" in md and "Case 18" in md),
    ("M7 signalized approach flag-and-cite", "signal operation review" in md),
]
fails = 0
for name, ok in checks:
    print(("PASS" if ok else "FAIL"), "-", name)
    fails += 0 if ok else 1
print(f"{len(checks) - fails}/{len(checks)} PASS")
raise SystemExit(1 if fails else 0)
