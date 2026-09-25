"""#290 checkpoint (k) commit 7 — PDF page 2 draws the work AND the approaches.

"The PDF's page 2 draws the work and the approaches from the backend
geometry, the same as the picker" (Ryan, 2026-09-25), and #298's
acceptance: "the advance warning renders upstream of the work for the
road's legal direction, on the picker and on PDF page 2".

Asserted on what page 2 actually asks Mapbox to draw (the Static Images
URL's path overlays, decoded) and on the page's text (the legend), against
the SAME producer the picker reads (``/render/corridor-geometry``) — Rule
11: the test sits where the drawing is made.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import unquote

import pypdfium2 as pdfium
import pytest

from src.generation.layout import (
    generate_flagger_alternating_2lane,
    generate_shoulder_closure_undivided,
)
from src.rendering import plan_sheet as ps
from src.rules.corridor import _destination_point
from src.rules.validators import ScenarioParams

PIN = (39.7337, -104.98753)  # the N Broadway hand-check pin
# A one-way southbound road beside the pin, like way 131232822: the
# vertices run north -> south (the legal direction), 11 m west of the pin.
ROAD = tuple(
    _destination_point(*_destination_point(*PIN, 270.0, 11.0), bearing, 1500.0)
    for bearing in (0.0, 180.0)
)


class _FakeResponse:
    @property
    def content(self) -> bytes:
        import io

        from PIL import Image

        buf = io.BytesIO()
        Image.new("RGB", (4, 4), (128, 128, 128)).save(buf, format="PNG")
        return buf.getvalue()

    def raise_for_status(self) -> None:
        return None


@pytest.fixture()
def mapbox(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    """Every Static Images request page 2 makes: its URL and its query."""
    requests: list[dict[str, Any]] = []
    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")

    def get(url: str, params: dict[str, str] | None = None, **_kw: Any) -> _FakeResponse:
        requests.append({"url": url, "params": dict(params or {})})
        return _FakeResponse()

    monkeypatch.setattr(ps.httpx, "get", get)
    monkeypatch.setattr(ps, "_validate_corridor_bearing", lambda corridor: None)
    return requests


def _decode(poly: str) -> list[tuple[float, float]]:
    """Google polyline (precision 5) -> [(lat, lng)]."""
    coords: list[tuple[float, float]] = []
    index = lat = lng = 0
    while index < len(poly):
        for is_lng in (False, True):
            shift = result = 0
            while True:
                b = ord(poly[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if is_lng:
                lng += delta
            else:
                lat += delta
        coords.append((lat / 1e5, lng / 1e5))
    return coords


def _paths(url: str) -> list[tuple[int, str, str, list[tuple[float, float]]]]:
    """(width, colour, opacity, points) for every path overlay in the URL."""
    out = []
    for width, color, opacity, poly in re.findall(
        r"path-(\d+)\+([0-9A-Fa-f]{6})-([\d.]+)\(([^)]*)\)", url
    ):
        out.append((int(width), color.upper(), opacity, _decode(unquote(poly))))
    return out


def _render(
    tmp_path: Any,
    *,
    flagger: bool,
    pin_model: str = "work_start",
    road: Any = ROAD,
    bearing: float | None = None,
) -> str:
    params = ScenarioParams(
        closure_type="lane" if flagger else "shoulder",
        road_type="urban_low",
        speed_mph=30,
        num_lanes=2,
        lane_width_ft=12.0,
        shoulder_width_ft=8.0,
        work_zone_length_ft=1000.0,
        # Southbound: the one-way's legal direction (work_start: the
        # derived direction of travel; corridor_end: the old reading).
        bearing_deg=bearing
        if bearing is not None
        else (180.0 if pin_model == "work_start" else 0.0),
        pin_model=pin_model,
        centerline=road,
    )
    out = str(tmp_path / f"{pin_model}-{'flagger' if flagger else 'shoulder'}.pdf")
    # A lane closure on an undivided two-lane road IS the flagger kind
    # (validators._is_flagger_scenario).
    placements = (
        generate_flagger_alternating_2lane(params)
        if flagger
        else generate_shoulder_closure_undivided(params)
    )
    ps.render_plan_sheet(placements, params, output_path=out, site_lat=PIN[0], site_lng=PIN[1])
    return out


def test_the_advance_warning_is_drawn_upstream_of_the_work(tmp_path, mapbox) -> None:
    """#298's acceptance on page 2: southbound traffic, so the advance
    warning lies NORTH of the pin, the work SOUTH of it."""
    _render(tmp_path, flagger=False)
    (req,) = mapbox
    paths = _paths(req["url"])
    advance = [p for p in paths if p[1] == "FFD166"]
    work = [p for p in paths if p[1] == "1EC8A5"]
    assert advance and work
    assert all(lat > PIN[0] for p in advance for lat, _ in p[3])
    assert all(lat <= PIN[0] + 1e-4 for p in work for lat, _ in p[3])
    # The work is drawn last (on top) and every zone is present, each at
    # its picker width rank (#131's non-colour channel).
    assert paths[-1][1] == "1EC8A5"
    widths = {color: width for width, color, _o, _pts in paths}
    assert widths == {"8A8A8A": 2, "1EC8A5": 3, "FF7A00": 4, "F3722C": 5, "FFD166": 6}


def test_the_corridor_is_framed_whole(tmp_path, mapbox) -> None:
    _render(tmp_path, flagger=False)
    (req,) = mapbox
    assert "/auto/1200x500@2x" in req["url"]
    assert req["params"]["padding"] == "60"
    assert len(req["url"]) < 8192


def test_the_flagger_draws_both_approaches(tmp_path, mapbox) -> None:
    """Two advance-warning runs: the primary's north of the pin (the
    southbound traffic's), the opposing one south of the work's far end."""
    _render(tmp_path, flagger=True)
    (req,) = mapbox
    advance = [p for p in _paths(req["url"]) if p[1] == "FFD166"]
    assert len(advance) == 2
    far_end_lat = _destination_point(*PIN, 180.0, 1000.0 * 0.3048)[0]
    north = [p for p in advance if min(lat for lat, _ in p[3]) > PIN[0]]
    south = [p for p in advance if max(lat for lat, _ in p[3]) < far_end_lat]
    assert len(north) == 1 and len(south) == 1


def test_page_two_carries_the_legend(tmp_path, mapbox) -> None:
    out = _render(tmp_path, flagger=True)
    page2 = pdfium.PdfDocument(out)[1].get_textpage().get_text_range()
    for word in ("Advance warning", "Taper", "Buffer", "Work zone", "Downstream"):
        assert word in page2
    assert "past the mapped road" in page2
    assert "Two approaches: southbound (the work's side) and northbound" in page2
    assert "not depicted" not in page2


def test_a_corridor_end_page_two_is_unchanged(tmp_path, mapbox) -> None:
    """A plan still on the old model keeps its pre-#290 page 2: the work
    zone alone, orange, centre + zoom framing, the old caption."""
    out = _render(tmp_path, flagger=False, pin_model="corridor_end")
    (req,) = mapbox
    assert "/auto/" not in req["url"]
    assert "padding" not in req["params"]
    colors = {color for _w, color, _o, _pts in _paths(req["url"])}
    assert colors == {ps._AERIAL_OVERLAY_COLOR.upper()}
    page2 = pdfium.PdfDocument(out)[1].get_textpage().get_text_range()
    assert "Advance warning, taper, and buffer not depicted" in page2


def test_an_approach_past_the_mapped_road_stays_readable(tmp_path, mapbox) -> None:
    """The Lafayette render: the way ended north of the work, so the
    opposing approach ran on the end tangent and page 2's old 1 px / 0.4
    stroke made it invisible.  Past the mapped road a zone keeps its colour
    AND its width rank, only faded — the picker's own 0.35."""
    # The road ends 100 m north of the pin.  Traffic is southbound, so the
    # approach lies north of the pin and most of it is past the road's end.
    short_north = (
        _destination_point(*_destination_point(*PIN, 270.0, 11.0), 0.0, 100.0),
        _destination_point(*_destination_point(*PIN, 270.0, 11.0), 180.0, 1500.0),
    )
    _render(tmp_path, flagger=False, road=short_north)
    (req,) = mapbox
    advance = [p for p in _paths(req["url"]) if p[1] == "FFD166"]
    faded = [p for p in advance if p[2] == "0.35"]
    assert faded, "some advance-warning footage lies past the mapped road"
    assert all(p[0] == 6 for p in advance), "the width rank survives the fade"
    out = pdfium.PdfDocument(str(tmp_path / "work_start-shoulder.pdf"))
    assert "faded: past the mapped road" in out[1].get_textpage().get_text_range()


def test_a_direction_just_short_of_north_reads_zero(tmp_path, mapbox) -> None:
    """Rendered at Lafayette St: 359.9° printed "360°"."""
    out = _render(tmp_path, flagger=False, bearing=359.9, road=None)
    page2 = pdfium.PdfDocument(out)[1].get_textpage().get_text_range()
    row = page2.split("Direction of travel:")[1].split("\n")[0].strip()
    assert row == "0°"
