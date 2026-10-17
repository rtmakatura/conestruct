"""R116 item 3 / R117 Q3a-c -- page 1's NOTES & SIGN SCHEDULE box.

R116: "'Speed limit' collides with PARAMETERS, and the advance-warning
table prints its CODE/DESCRIPTION/DISTANCE headers twice on one line."
R117: "Q3a: The one line naming all 4 cut codes.  Q3b: Yes, fold into
'PLATE DEPARTURES: SEE AUDIT'.  Q3c: Yes, extra spacing only on one-column
tables; Case 27 keeps its 4 rows."

Measured on the rendered page (Rule 11): the glyph boxes of every text line
inside the box, read back with pypdfium2.  test_pdf_containment's collision
check only sees same-line overlaps, so it never caught lines touching
vertically; this checks the clearance between consecutive lines.
"""

from __future__ import annotations

import copy
import ctypes
import io
import os
import re
import tempfile
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium
import pypdfium2.raw as pr
import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.generation.layout import generate_shoulder_closure_divided
from src.rendering import plan_sheet as ps
from src.rules import site_detection as sd
from src.rules.validators import ScenarioParams

AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}
APPROACH = {
    "speed": 25,
    "roadType": "urban_arterial",
    "lanesPerDirection": 1,
    "laneWidth": 11.0,
    "signalized": True,
    "alongStationFt": -100.0,
}
BROADWAY = {
    "kind": "near_intersection",
    "meta": {
        "project": "r117",
        "address": "",
        "lat": 39.7337,
        "lng": -104.98753,
        "bearingDeg": 0.0,
    },
    "roadType": "urban_arterial",
    "speed": 30,
    "lanes": 4,
    "laneWidth": 10.5,
    "divided": False,
    "workType": "utility_cut",
    "duration": "short",
    "workLen": 500.0,
    "night": False,
    "approaches": [{"id": "e11_wb", **APPROACH}, {"id": "e11_eb", **APPROACH}],
}
ONE_WAY = {
    "oneway": "yes",
    "highwayClass": "primary",
    "twinDistanceM": None,
    "twinSearched": True,
    "confirmed": None,
}
SHOULDER = {
    **{k: v for k, v in BROADWAY.items() if k not in ("approaches",)},
    "kind": "shoulder",
    "workType": "utility_locate",
}
# The minimum gap between one line's glyph boxes and the next line's
# (pt).  Before: -0.3 (touching) on every near-intersection plan.
MIN_CLEARANCE_PT = 0.5


@pytest.fixture(scope="module", autouse=True)
def _env() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
    os.environ["MAPBOX_TOKEN"] = ""


@pytest.fixture(autouse=True)
def _no_overpass(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_kw: ({"elements": []}, None)
    )


client = TestClient(app)


def _pdf(body: dict[str, Any]) -> bytes:
    r = client.post("/render/pdf", headers=AUTH, json=copy.deepcopy(body))
    assert r.status_code == 200, r.text[:300]
    return r.content


def _case27_pdf() -> bytes:
    """S-630-1 Case 27 (stepped work-zone speed): the long advance table
    that genuinely needs two columns."""
    params = ScenarioParams(
        speed_mph=75,
        num_lanes=2,
        closure_type="shoulder",
        road_type="freeway",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        is_divided=True,
        jurisdiction="CDOT",
        work_zone_speed_mph=40,
    )
    placements = generate_shoulder_closure_divided(params)
    fd, path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    try:
        ps.render_plan_sheet(placements, params, output_path=path, shoulder_width_ft=10.0)
        return Path(path).read_bytes()
    finally:
        os.unlink(path)


def _notes_lines(pdf: bytes) -> list[dict[str, Any]]:
    """Every text line whose glyphs start inside the notes box, top down:
    baseline, glyph-box top and bottom, right edge, text."""
    geo = ps._footer_geometry(True)
    x0, x1 = geo.notes_x, geo.notes_x + geo.notes_w
    y0, y1 = ps.FOOTER_BOX_Y, ps.FOOTER_BOX_Y + ps.FOOTER_BOX_H
    tp = pdfium.PdfDocument(io.BytesIO(pdf))[0].get_textpage()
    groups: dict[float, list[tuple]] = {}
    for i in range(tp.count_chars()):
        ch = tp.get_text_range(i, 1)
        if not ch.strip():
            continue
        left, bottom, right, top = tp.get_charbox(i)
        ox, oy = ctypes.c_double(), ctypes.c_double()
        pr.FPDFText_GetCharOrigin(tp.raw, i, ctypes.byref(ox), ctypes.byref(oy))
        if x0 <= ox.value < x1 - 2 and y0 - 30 <= oy.value <= y1 + 5:
            groups.setdefault(round(oy.value * 4) / 4, []).append((left, bottom, right, top, ch))
    lines = []
    for base in sorted(groups, reverse=True):
        cs = sorted(groups[base], key=lambda c: c[0])
        text, prev = "", None
        for c in cs:
            if prev is not None and c[0] - prev > 1.2:
                text += " "
            text += c[4]
            prev = c[2]
        lines.append(
            {
                "base": base,
                "top": max(c[3] for c in cs),
                "bot": min(c[1] for c in cs),
                "right": max(c[2] for c in cs),
                "text": text,
            }
        )
    return lines


def _page_text(pdf: bytes) -> str:
    page = pdfium.PdfDocument(io.BytesIO(pdf))[0]
    return " ".join(page.get_textpage().get_text_range().split())


def _clearance(lines: list[dict[str, Any]]) -> float:
    return min(a["bot"] - b["top"] for a, b in zip(lines, lines[1:], strict=False))


def _inside(lines: list[dict[str, Any]]) -> bool:
    geo = ps._footer_geometry(True)
    return all(
        ln["right"] <= geo.notes_x + geo.notes_w - 1 and ln["bot"] >= ps.FOOTER_BOX_Y + 1
        for ln in lines
    )


def _advance_rows(lines: list[dict[str, Any]]) -> int:
    texts = [ln["text"] for ln in lines]
    i0 = next(
        i for i, t in enumerate(texts) if t.startswith("ADVANCE WARNING") or "OFF-PAGE (" in t
    )
    # The table ends at its first line with no distance (the "+N MORE"
    # line, a disclosure, or the box's end; #235 moved the Reference line
    # to the title block).
    rows = 0
    for t in texts[i0 + 1 :]:
        if "DISTANCE" in t:
            continue
        n = len(re.findall(r"\d+ ft", t))
        if n == 0:
            break
        rows += n
    return rows


@pytest.mark.parametrize("carriageway", [ONE_WAY, None], ids=["one-way", "two-way"])
def test_the_near_intersection_box_reads_clean(carriageway: dict | None) -> None:
    body = {**BROADWAY, **({"carriageway": carriageway} if carriageway else {})}
    pdf = _pdf(body)
    lines = _notes_lines(pdf)
    # Text as the page reports it (the glyph-box lines above re-space words
    # at kerning gaps, e.g. "R2-1 0"); they're for geometry only.
    flat = _page_text(pdf)
    assert _clearance(lines) >= MIN_CLEARANCE_PT, [ln["text"][:40] for ln in lines]
    assert _inside(lines)
    # Q3a's all-cut line no longer fires here: #235 (R150 B) moved the legal
    # trailer to the title block, so the first advance row fits and the cut
    # names the rest.  The all-cut line keeps its coverage on the denser
    # speed-guessed sheets (test_approach_speed_guess).
    assert _advance_rows(lines) == 1
    # Ryan 2026-10-14: the cut line names the cut codes, in table order, so
    # the sheet names all 4 (W4-2R in its row) as it did before #235.
    assert "+3 MORE ADVANCE SIGNS (W20-5R, R2-10, W20-1). SEE CREW NARRATIVE & DEVICE LIST" in flat
    assert "W4-2R" in flat
    assert "ADVANCE SIGNS OFF-PAGE (" not in flat
    # No doubled column header.
    assert "DISTANCE CODE" not in flat
    # Q3b: the plate departures are pointed to, not printed.
    assert "PLATE DEPARTURES: SEE AUDIT" in flat
    assert "Plate typifies" not in flat
    assert "opposing mainline direction" not in flat.lower()
    # The rightmost-lane note stays.
    assert "CLOSED LANE DRAWN AS THE RIGHTMOST LANE" in flat


def test_a_shoulder_box_still_draws_its_advance_rows() -> None:
    lines = _notes_lines(_pdf(SHOULDER))
    assert _clearance(lines) >= MIN_CLEARANCE_PT
    assert _inside(lines)
    assert _advance_rows(lines) == 3


def test_case_27_keeps_its_four_two_column_rows() -> None:
    """Q3c: the extra spacing is for one-column tables; Case 27's long table
    stays two columns.  It drew 4 of its 8 entries before #235 (R150 B)
    moved the legal trailer to the title block; now all 8 fit.  #334: 75 to
    40 isn't Case 27's 75 to 65 step-down, so the plan cites Case 11 and
    places no W20-2 (Q1): 7 entries."""
    lines = _notes_lines(_case27_pdf())
    assert _advance_rows(lines) == 7
    assert not any("MORE ADVANCE SIGNS" in ln["text"] for ln in lines)
    assert any("DISTANCE CODE" in ln["text"] for ln in lines)  # still two columns
    assert _inside(lines)
