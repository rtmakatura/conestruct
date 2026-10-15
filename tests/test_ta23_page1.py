"""#328: page 1 of a TA-23 plan draws the left-turn bay open.

Rendered-output tests (Rule 11): the page's own pixels and text.  The bay
and the opening carry no closed-lane shading; the taper and the work zone
do; the dimension line names the bay as entered by the operator, the
opening, the cross street and L; R3-7L is drawn, not listed off-page.
Containment stays 0/0/0 across bay lengths and cross-street distances.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium
import pytest

from src.api.schemas import scenario_to_call
from src.generation.layout import near_intersection_stations
from src.rendering import plan_sheet as ps
from src.rendering.plan_sheet import render_plan_sheet
from tests.test_left_lane_near_intersection import UPSTREAM, ni
from tests.test_left_side_oneway import parsed
from tests.test_pdf_containment import measure_containment

E_11TH = {"lat": 39.73385, "lng": -104.98753, "name": "E 11th Ave"}
SCALE = 2.0
PINK = tuple(round(v * 255) for v in ps.SHOULDER_CLOSED_FILL.rgb())


@pytest.fixture(autouse=True)
def _no_mapbox(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MAPBOX_TOKEN", raising=False)


def render(tmp_path: Path, cross: dict[str, Any], storage: float, work_len: float) -> dict:
    body = ni("left", cross)
    body["workLen"] = work_len
    body["turnBayStorageFt"] = storage
    params, gen, kwargs = scenario_to_call(parsed(body))
    placements = gen(params, **kwargs)
    out = tmp_path / "p.pdf"
    render_plan_sheet(placements, params, output_path=str(out), approaches=kwargs["approaches"])
    st = near_intersection_stations(params, kwargs["approaches"])
    frame = {
        "wz": params.work_zone_length_ft,
        "downstream_curb": st["downstream_curb"],
        "upstream_curb": st["upstream_curb"],
        "bay_start": st["turn_bay"]["bay_start"],
        "taper_end": st["taper_end"],
        "taper_start": st["taper_start"],
    }
    mainline = [p for p in placements if p.approach_id == "mainline"]
    x_of = ps._turn_bay_x_mapping(mainline, frame)["x_of"]
    doc = pdfium.PdfDocument(str(out))
    text = doc[0].get_textpage().get_text_range()
    image = doc[0].render(scale=SCALE).to_pil().convert("RGB")
    doc.close()
    counts = {k: len(v) for k, v in measure_containment(str(out)).items()}
    return {"frame": frame, "x_of": x_of, "text": text, "image": image, "counts": counts}


def pink_pixels(page: dict, station: float) -> int:
    """Closed-lane pink in the page column at ``station``, plan area only."""
    image = page["image"]
    x = round(page["x_of"](station) * SCALE)
    top = round((ps.PAGE_H - ps.PLAN_TOP) * SCALE)
    bottom = round((ps.PAGE_H - ps.PLAN_BOTTOM) * SCALE)
    return sum(
        1
        for y in range(top, bottom)
        if all(abs(a - b) <= 3 for a, b in zip(image.getpixel((x, y)), PINK, strict=True))
    )


@pytest.mark.parametrize(
    ("cross", "work_len"), [(E_11TH, 1000.0), (UPSTREAM, 2000.0)], ids=["e11th", "e14th"]
)
def test_the_bay_and_the_opening_are_drawn_open(
    tmp_path: Path, cross: dict, work_len: float
) -> None:
    page = render(tmp_path, cross, 300.0, work_len)
    f = page["frame"]
    bay_mid = (f["bay_start"] + f["upstream_curb"]) / 2.0
    opening_mid = (f["taper_end"] + f["bay_start"]) / 2.0
    taper_mid = (f["taper_start"] + f["taper_end"]) / 2.0
    assert pink_pixels(page, bay_mid) == 0
    assert pink_pixels(page, opening_mid) == 0
    assert pink_pixels(page, taper_mid) > 0
    assert pink_pixels(page, work_len / 2.0) > 0


@pytest.mark.parametrize(
    ("cross", "work_len"), [(E_11TH, 1000.0), (UPSTREAM, 2000.0)], ids=["e11th", "e14th"]
)
def test_the_dimension_line_names_ta_23s_spans(
    tmp_path: Path, cross: dict, work_len: float
) -> None:
    text = render(tmp_path, cross, 300.0, work_len)["text"]
    assert "LEFT-TURN BAY = 300 ft, ENTERED BY OPERATOR" in text
    assert "OPENING = 100 ft" in text
    assert "CROSS STREET" in text
    assert "L = 280 ft" in text
    assert "BUFFER =" not in text
    # R3-7L is on the drawing (sign schedule), not in the off-page list.
    assert "ADVANCE SIGNS OFF-PAGE (W4-2L, W20-5L, R2-10, W20-1)" in text


def test_a_long_stretch_to_the_work_zone_is_compressed_and_named(tmp_path: Path) -> None:
    text = render(tmp_path, UPSTREAM, 300.0, 2000.0)["text"]
    assert "CLOSED = 2,704 ft (NTS)" in text
    assert "Stretch from the work zone to the cross street compressed" in text


@pytest.mark.parametrize("storage", [50.0, 300.0, 1200.0])
@pytest.mark.parametrize(
    ("cross", "work_len"), [(E_11TH, 1000.0), (UPSTREAM, 2000.0)], ids=["e11th", "e14th"]
)
def test_containment_holds_across_bay_lengths(
    tmp_path: Path, cross: dict, work_len: float, storage: float
) -> None:
    counts = render(tmp_path, cross, storage, work_len)["counts"]
    assert counts == {k: 0 for k in counts}, counts


def test_no_frame_leaks_past_the_render() -> None:
    assert ps._TURN_BAY_FRAME.get() is None


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
