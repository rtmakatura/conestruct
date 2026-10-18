# #349 ruling (Ryan, 2026-10-18): step 3's phone crop.  Derives
# step3-plan-narrow.svg from step3-plan.svg, the way hero-plan-narrow.svg
# crops the hero, but with labels sized to render at 11 px or more on a
# 390 px phone (the step 3 panel there is ~338 px wide).
#
#   python design/landing-v2/step3-narrow.py
#
# The crop is x 340-1100 (arrow board, taper, buffer, work zone,
# taper-out), y -62-280 (two label rows above the dimension line, down to
# the sidewalk).  At 338
# px across 760 units the scale is 0.445, so text is set at 26 units
# (11.6 px).  The drawing's own small text is removed inside the crop:
#   - the dimension labels (L/3 50 FT, BUFFER 200 FT, WORK ZONE 1,000 FT)
#     are re-set large, on two rows so they don't collide;
#   - the intersection and sidewalk flags, E COLFAX AVE and WILLIAMS ST are
#     dropped: none fits at 26 units, and the panel head already names the
#     road.  The facts row below states the same three lengths.
# Everything else (road, lanes, cones, arrow board, work and walk zones,
# dimension lines and ticks) is the designer's, unchanged.

import pathlib
import re

HERE = pathlib.Path(__file__).parent
FAINT, DIM = "#93a0b0", "#ff8a2e"
MONO = "'JetBrains Mono', ui-monospace, monospace"
F = 26


def label(x, y, name, value, anchor):
    return (
        f'<text x="{x}" y="{y}" font-family="{MONO}" font-size="{F}" text-anchor="{anchor}" '
        f'font-weight="500" letter-spacing="1"><tspan fill="{FAINT}">{name} </tspan>'
        f'<tspan fill="{DIM}">{value}</tspan></text>'
    )


s = (HERE / "step3-plan.svg").read_text(encoding="utf-8")
s = s.replace('viewBox="0 0 1200 430"', 'viewBox="340 -62 760 342"', 1)
s = re.sub(r"([gwh])step3\b", r"\1step3n", s)
# the ground and its grid reach up into the label rows
s = s.replace('<rect width="1200" height="430"', '<rect x="0" y="-62" width="1200" height="492"')
# drop the flags, and every small text inside the crop
s, n_fl = re.subn(r'<g class="z fl[^"]*"[^>]*>.*?</g>', "", s)
for t in (
    "L/3",
    "50 FT",
    "BUFFER",
    "200 FT",
    "WORK ZONE",
    "1,000 FT",
    "E COLFAX AVE",
    "WILLIAMS ST",
):
    s, n = re.subn(rf"<text [^>]*>{re.escape(t)}</text>", "", s, count=1)
    assert n == 1, t
assert n_fl == 2
# the rest of the small text (street names, sign codes, the compass N) sits
# outside the crop; drop it too, so nothing under 26 units is left
s = re.sub(r'<text [^>]*font-size="(?!26")[^"]*"[^>]*>[^<]*</text>', "", s)
rows = (
    label(400, -28, "L/3", "50 FT", "start")
    + label(810, -28, "WORK ZONE", "1,000 FT", "middle")
    + label(460, 8, "BUFFER", "200 FT", "start")
)
s = s.replace("</svg>", f'<g class="z dm">{rows}</g></svg>')
(HERE / "step3-plan-narrow.svg").write_text(s, encoding="utf-8")
print("step3-plan-narrow.svg", len(s))
