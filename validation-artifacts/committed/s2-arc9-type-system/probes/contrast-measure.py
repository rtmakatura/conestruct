# s2-arc9 (#226): WCAG contrast for the four type-role colors on both
# panel surfaces -- measured, not asserted (Rule 13).  Values are the
# workbench palette (conestruct/site/app/globals.css) + the role table
# (conestruct/site/lib/design/type-roles.ts).
#
#   python contrast-measure.py > ../contrast-measurements.txt
#
# The 0.35 column is the #222 pre-pin pending dim (step-pending-body).
# That body is `inert` + aria-hidden with the full-opacity pending
# summary as the accessible path, so the dim ratios are recorded for
# the record, not held to the AA floor (the standing s2-arc8 reading).

def lum(hexc: str) -> float:
    r, g, b = (int(hexc[i : i + 2], 16) / 255 for i in (0, 2, 4))

    def f(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a: str, b: str) -> float:
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def blend(fg: str, bg: str, alpha: float) -> str:
    fr = [int(fg[i : i + 2], 16) for i in (0, 2, 4)]
    br = [int(bg[i : i + 2], 16) for i in (0, 2, 4)]
    return "".join(f"{round(a * alpha + b * (1 - alpha)):02x}" for a, b in zip(fr, br))


SURFACES = {"--canvas #14202e": "14202e", "--canvas-tint #1b2838": "1b2838"}
ROLES = {
    "section        #ffffff (CHOSEN)": "ffffff",
    "step index     --ink-on-dark-faint #93a0b0 (CHOSEN)": "93a0b0",
    "field label    --ink-on-dark #c8d1dd (CHOSEN)": "c8d1dd",
    "provenance     --ink-on-dark-faint #93a0b0 (CHOSEN)": "93a0b0",
}

AA = 4.5
print("s2-arc9 type-role contrast (WCAG 2.x relative luminance)")
print("AA floor for text: 4.5:1.  dim0.35 = #222 pending body (inert +")
print("aria-hidden; recorded, not held to the floor -- see header).\n")
for sname, s in SURFACES.items():
    print(f"on {sname}:")
    for rname, r in ROLES.items():
        full = ratio(r, s)
        dim = ratio(blend(r, s, 0.35), s)
        verdict = "PASS" if full >= AA else "FAIL"
        print(f"  {rname:52s} {full:6.2f}:1  {verdict}   dim0.35 {dim:5.2f}:1")
    print()
