# s2-arc11 (#228): WCAG contrast for the rail vocabulary's new ink
# pairing -- measured, not asserted (Rule 13).  The rail sits on
# --canvas (the sticky strip's background).  Arc10's probe already
# measured --ink-on-dark-faint / --none / --warn / --pass on --canvas;
# the one NEW pairing this arc is the stale triangle + word in --dim.
# Re-measured alongside the info/step ink for the record.
#
#   python contrast-measure.py > ../contrast-measurements.txt

def lum(hexc):
    r, g, b = (int(hexc[i : i + 2], 16) / 255 for i in (0, 2, 4))

    def f(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


CANVAS = ("--canvas #14202e (rail ground)", "14202e")
INKS = {
    "stale glyph+word  --dim #ff8a2e": "ff8a2e",
    "step index / info --ink-on-dark-faint #93a0b0": "93a0b0",
    "entry labels      --ink-on-dark #c8d1dd": "c8d1dd",
}

print("s2-arc11 rail-vocabulary contrast (AA normal-text floor 4.5:1)")
print(f"surface: {CANVAS[0]}")
for name, ink in INKS.items():
    r = ratio(ink, CANVAS[1])
    verdict = "PASS" if r >= 4.5 else "FAIL"
    print(f"  {name}: {r:.2f}:1  {verdict}")