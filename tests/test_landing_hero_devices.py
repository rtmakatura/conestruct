"""The landing page's drawings show the Oct 17 run's devices, where the run
puts them (validation-artifacts/committed/landing-source-run/README.md,
"Where each device sits in this run").

The desktop hero is design/landing-v2/hero-3d/hero-iso.svg.  This reads the
SVG itself and maps each device's drawn anchor back to feet along the road,
using the generator's projection (iso_hero.py's P, the only thing taken from
the generator: the device stations are measured from the drawing, not read
from its loops).  Position is feet from the taper start, upstream negative.

The flat step 1 / step 3 drawings (design/landing-v2/illus.py) are not to
scale, so only their counts are checked.
"""

from __future__ import annotations

import importlib.util
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT / "design" / "landing-v2"


def _load_generator():
    spec = importlib.util.spec_from_file_location("iso_hero", DESIGN / "hero-3d" / "iso_hero.py")
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ISO = _load_generator()


def _parse(path: Path) -> ET.Element:
    text = path.read_text(encoding="utf-8")
    # the C2PA block is opaque metadata; the drawing has no default xmlns
    text = re.sub(r"<metadata>[\s\S]*?</metadata>", "", text)
    return ET.fromstring(text)


def _tag(el: ET.Element) -> str:
    return el.tag.rsplit("}", 1)[-1]


def _all(el: ET.Element, tag: str) -> list[ET.Element]:
    return [e for e in el.iter() if _tag(e) == tag]


def _groups(root: ET.Element, cls: str) -> list[ET.Element]:
    """Top-level drawing groups whose class list is exactly 'z ' + cls (plus 'hv')."""
    want = set(cls.split())
    return [
        g for g in root if _tag(g) == "g" and set(g.get("class", "").split()) - {"z", "hv"} == want
    ]


def _world(sx: float, sy: float, z: float) -> tuple[float, float]:
    """Invert the projection at a known height: screen point -> world (x, y)."""
    o_x, o_y = ISO.P(0, 0, z)
    ex, ey = ISO.P(1, 0, z)
    nx, ny = ISO.P(0, 1, z)
    a, b, c, d = ex - o_x, nx - o_x, ey - o_y, ny - o_y
    rx, ry = sx - o_x, sy - o_y
    det = a * d - b * c
    return (rx * d - b * ry) / det, (a * ry - rx * c) / det


def _feet(world_x: float) -> float:
    """World x back to feet along the road, undoing the plan-style break."""
    if world_x <= ISO.BRK0_FT:
        return world_x
    return world_x + (ISO.BRK1_FT - ISO.BRK0_FT) - ISO.GAP


def _body(g: ET.Element) -> ET.Element:
    return next(p for p in _all(g, "path") if (p.get("fill") or "").startswith("url(#cg"))


def _is_drum(g: ET.Element) -> bool:
    # drum(): straight sides (L); cone(): curved (C)
    return re.match(r"M\S+ \S+ L", _body(g).get("d", "")) is not None


def _stations(groups: list[ET.Element]) -> list[float]:
    """Feet along the road of each cone or drum.  Its body path starts at the
    left base point, M(bx - r) by; bases sit at z 0 (drum) or 1.0 (cone)."""
    out = []
    for g in groups:
        m = re.match(r"M(-?[\d.]+) (-?[\d.]+) ", _body(g).get("d", ""))
        assert m
        drum = _is_drum(g)
        r = 3.0 * 1.25 if drum else 4.3  # drum() rs, cone() r
        x, _ = _world(float(m.group(1)) + r, float(m.group(2)), 0 if drum else 1.0)
        out.append(_feet(x))
    return sorted(out)


@pytest.fixture(scope="module")
def hero() -> ET.Element:
    return _parse(DESIGN / "hero-3d" / "hero-iso.svg")


def test_the_svg_is_the_generators_output(tmp_path):
    # hand edits are not allowed: the committed SVG is what `python iso_hero.py
    # hero-iso.svg` writes (run as-is, so a console code page that can't
    # encode the "▲" labels fails here too)
    out = tmp_path / "hero-iso.svg"
    subprocess.run(
        [sys.executable, str(DESIGN / "hero-3d" / "iso_hero.py"), str(out)],
        check=True,
        capture_output=True,
        env={"PATH": "", "SYSTEMROOT": os.environ.get("SYSTEMROOT", "")},
    )
    text = (DESIGN / "hero-3d" / "hero-iso.svg").read_text(encoding="utf-8")
    text = re.sub(r"<metadata>[\s\S]*?</metadata>", "", text)
    text = text.replace(' xmlns:c2pa="http://c2pa.org/manifest"', "")
    assert text.strip() == out.read_text(encoding="utf-8").strip()


def test_taper_three_drums_25_ft_apart(hero):
    taper = _groups(hero, "cn k-taper")
    assert len(taper) == 3
    assert all(_is_drum(g) for g in taper)
    assert _stations(taper) == pytest.approx([0, 25, 50], abs=0.5)


def test_arrow_board_in_caution_mode_at_the_taper_start(hero):
    (ab,) = _groups(hero, "k-taper ab")
    lamps = [c for c in _all(ab, "circle") if c.get("r") == "1.6"]
    # caution mode: a single bar of lamps, no arrow
    assert len(lamps) == 5
    xs = [_feet(_world(float(c.get("cx")), float(c.get("cy")), 23.5)[0]) for c in lamps]
    assert xs == pytest.approx([-20] * 5, abs=0.5)
    assert all(-25 <= x <= 0 for x in xs)


def test_buffer_three_cones_50_ft_apart(hero):
    buffer = _groups(hero, "cn k-buffer")
    assert len(buffer) == 3
    st = _stations(buffer)
    # the plan gives no exact stations, only "between +50 and +250, 50 ft apart"
    assert all(50 < x < 250 for x in st)
    assert [b - a for a, b in zip(st, st[1:], strict=False)] == pytest.approx([50, 50], abs=0.5)


def test_work_zone_shows_the_9_of_18_cones_outside_the_break(hero):
    work = _stations(_groups(hero, "cn k-work"))
    inside = [x for x in work if x <= 1250.5]
    # the run: 18 cones, +250 to +1,250, 58.8 ft apart; 600-1,100 ft is cut
    run = [250 + 58.8 * k for k in range(18)]
    shown = [x for x in run if x <= ISO.BRK0_FT or x >= ISO.BRK1_FT]
    assert len(shown) == 9
    assert inside == pytest.approx(shown, abs=0.5)
    assert not [x for x in work if ISO.BRK0_FT < x < ISO.BRK1_FT]
    texts = ["".join(t.itertext()) for t in _all(hero, "text")]
    assert "500 FT NOT SHOWN" in texts


def test_downstream_taper_two_cones(hero):
    work = _stations(_groups(hero, "cn k-work"))
    down = [x for x in work if x > 1250.5]
    assert len(down) == 2
    # "between +1,250 and +1,300, ~25 ft apart"; coordinates carry 0.1 px
    assert all(1250 < x <= 1300.5 for x in down)
    assert down[1] - down[0] == pytest.approx(25, abs=0.5)


def test_sidewalk_two_type_iii_barricades_each_with_an_r9_9(hero):
    (bar,) = _groups(hero, "k-walk")
    legs = [ln for ln in _all(bar, "line") if ln.get("stroke") == "#c8d1dd"]
    feet = sorted(
        round(_feet(_world(float(ln.get("x1")), float(ln.get("y1")), 1.6)[0])) for ln in legs
    )
    # two legs per barricade, at the work zone's two ends (+250 and +1,250)
    assert feet == [250, 250, 1250, 1250]
    polys = list(_all(bar, "polygon"))
    r99_front = [p for p in polys if p.get("fill") == "#f4f1ea" and p.get("stroke") == "#111820"]
    r99_back = [p for p in polys if p.get("fill") == "#7b8796"]
    assert len(r99_front) == 1 and len(r99_back) == 1


def test_signs_at_300_200_100_ft_and_g20_2_at_1400(hero):
    found = {}
    for g in _groups(hero, "sg k-adv"):
        labels = ["".join(t.itertext()) for t in _all(g, "text")]
        post = _all(g, "line")[0]
        x, y = _world(float(post.get("x1")), float(post.get("y1")), 1.6)
        found[labels[0]] = (round(_feet(x)), round(y))
    assert found == {
        "W20-1": (-300, 6),
        "W20-2": (-200, 6),
        "W21-5AR": (-100, 6),
        "G20-2": (1400, 6),
    }


KEYS = {"int", "walk", "taper", "buffer", "dev"}


def test_every_link_key_is_a_card_key_and_every_card_key_has_a_hit_zone(hero):
    linked = [e for e in hero.iter() if e.get("data-k") is not None]
    assert {e.get("data-k") for e in linked} <= KEYS
    # only the hit zones and the two pins carry a key
    for e in linked:
        cls = set((e.get("class") or "").split())
        assert cls == {"hit"} or "fl" in cls, e.attrib
    hits: dict[str, int] = {}
    for e in linked:
        if e.get("class") == "hit":
            hits[e.get("data-k")] = hits.get(e.get("data-k"), 0) + 1
    assert set(hits) == KEYS
    # signs, both halves of the work zone and G20-2 are "dev"; the closed
    # sidewalk is two halves across the break
    assert hits == {"dev": 4, "walk": 2, "int": 1, "taper": 1, "buffer": 1}


@pytest.mark.parametrize("name", ["step1-plan.svg", "step3-plan.svg", "step3-plan-narrow.svg"])
def test_flat_step_drawings_carry_the_runs_counts(name):
    root = _parse(DESIGN / name)
    counts = {k: len(_groups(root, f"cn {k}")) for k in ("k-taper", "k-buffer", "k-work")}
    # 3 drums, 3 buffer cones, 18 work-zone + 2 downstream cones
    assert counts == {"k-taper": 3, "k-buffer": 3, "k-work": 20}
