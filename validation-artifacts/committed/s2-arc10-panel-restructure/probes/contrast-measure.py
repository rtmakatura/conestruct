# s2-arc10 (#227): WCAG contrast for every ink the restructure puts on
# the two container surfaces -- measured, not asserted (Rule 13).  The
# new containers (.sys-event, .fact-strip, .dva, band cards) sit on
# --canvas-tint; the panel ground is --canvas.  Values from the
# workbench palette (conestruct/site/app/globals.css).
#
#   python contrast-measure.py > ../contrast-measurements.txt
#
# Every glyph is paired with a word or sentence (rule 13) -- the ratios
# here are for the text/glyph inks themselves at 11-13px, so the AA
# floor is the 4.5:1 normal-text line.

def lum(hexc: str) -> float:
    r, g, b = (int(hexc[i : i + 2], 16) / 255 for i in (0, 2, 4))

    def f(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a: str, b: str) -> float:
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


SURFACES = {
    "--canvas #14202e (panel ground)": "14202e",
    "--canvas-tint #1b2838 (containers)": "1b2838",
}
INKS = {
    "warn glyph/rule   --warn #f4c020": "f4c020",
    "confirmed / clear --pass #4fd787": "4fd787",
    "dismissed / unev. --none #93a0b0": "93a0b0",
    "sentences / prop. --ink-on-dark #c8d1dd": "c8d1dd",
    "applied values    #ffffff": "ffffff",
    "detected / labels --ink-on-dark-faint #93a0b0": "93a0b0",
}

AA = 4.5
print("s2-arc10 restructure contrast (WCAG 2.x relative luminance)")
print("AA floor for normal text: 4.5:1.\n")
for sname, s in SURFACES.items():
    print(f"on {sname}:")
    for iname, ink in INKS.items():
        r = ratio(ink, s)
        verdict = "PASS" if r >= AA else "FAIL"
        print(f"  {iname:46s} {r:6.2f}:1  {verdict}")
    print()
