"""#295 (A): the stale palette.

Each text token under `.results-stale` gets a paired stale value: the token
composited over its ground at the alpha that first reaches a TARGET ratio.
That is what `opacity` did (alpha .5 for every token), stopped at a measured
floor instead of a fixed alpha.  Computed against the lighter of the two
grounds the wrapper's text sits on (--canvas), so it clears on --da-ground too.

Targets keep the palette's order (ink > ink-on-dark > faint) and clear the
small-text floor (4.5:1) with a margin, because the 42/62 px numerals share
--dim with the 10 px `.qty > b` count.
"""


def lin(v):
    v /= 255
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def lum(c):
    r, g, b = c
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def rgb(s):
    return tuple(int(s[i : i + 2], 16) for i in (1, 3, 5))


def hexs(c):
    return "#%02x%02x%02x" % c


def over(t, g, a):
    return tuple(round(a * t[k] + (1 - a) * g[k]) for k in range(3))


GROUNDS = {"--da-ground": rgb("#101c29"), "--canvas": rgb("#14202e")}
TOKENS = {
    "--ink": ("#eaf0f7", 7.0),
    "--ink-on-dark": ("#c8d1dd", 5.6),
    "--ink-faint / --ink-on-dark-faint / --none": ("#93a0b0", 4.7),
    "--dim": ("#ff8a2e", 4.7),
}
G = GROUNDS["--canvas"]
print("| token | full | full on --canvas | opacity .5 gave | stale | alpha | on --canvas | on --da-ground |")
print("|---|---|---|---|---|---|---|---|")
for name, (tok, target) in TOKENS.items():
    t = rgb(tok)
    a = next(i / 1000 for i in range(1001) if ratio(over(t, G, i / 1000), G) >= target)
    m = over(t, G, a)
    print(
        f"| `{name}` | `{tok}` | {ratio(t, G):.2f} | {ratio(over(t, G, 0.5), G):.2f} | `{hexs(m)}` | {a:.3f} | "
        f"{ratio(m, G):.2f} | {ratio(m, GROUNDS['--da-ground']):.2f} |"
    )
