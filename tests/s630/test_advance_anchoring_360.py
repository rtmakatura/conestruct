"""#360 — a reduced-speed shoulder plan's speed signs sit upstream of the taper.

R2-10 used to sit at the work zone + 500 ft, inside the buffer or the taper
on every reduced-speed shoulder plan off Sheet 14, with W3-5 530 ft above it
(inside the taper at 75 mph).  Rulings (validation-artifacts/committed/
issue-360-advance-anchoring/rulings.md):

- Q1: Case 11 plans take Case 11's drawn stations (group 3,000 ft, R2-10
  3,500 ft from the taper start; S-630-1 Sheet 7, PDF p. 155).
- Q2 (d): every other plan keeps A and B, puts the group at the old W20-1
  station, R2-10 500 ft upstream (Sheet 12 Case 24, PDF p. 160), W3-5 530 ft
  beyond, and W20-1 one Table 6B-1 C spacing beyond the farthest W3-5.
- Q3: plaques fill the advance area until no gap is over 2,640 ft (Sheet 2
  Note 4), each at least 250 ft from every other sign (Sheet 12 Note 4); a
  gap left over gets the engineer note.

Rule 11: the station grid off both generators, plus the audit off
``/render/audit`` and the crew sheet off ``/render/markdown``.
"""

from __future__ import annotations

import itertools
from typing import Any

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient

from src.generation.layout import (
    fines_double_envelope,
    generate_shoulder_closure_divided,
    generate_shoulder_closure_undivided,
    shoulder_speed_group,
)
from src.rendering.plan_sheet import render_plan_sheet
from src.rules.devices import DeviceType
from src.rules.spacing import advance_warning_spacing, co_construction_plaques
from src.rules.validators import DevicePlacement, ScenarioParams

from ._harness import _common
from .test_cross_surface import _post, api  # noqa: F401  (``api`` is a fixture)

_GENERATORS = [generate_shoulder_closure_divided, generate_shoulder_closure_undivided]
_ROADS = ["urban_high", "rural", "expressway", "freeway"]
_SPEEDS = [(45, 35), (55, 45), (55, 30), (65, 55), (65, 45), (75, 70), (75, 55)]
_LENGTHS = [500.0, 2000.0, 10560.0]


def _params(road: str, speed: int, wz: int, length: float, divided: bool) -> ScenarioParams:
    return ScenarioParams(
        speed_mph=speed,
        num_lanes=2,
        closure_type="shoulder",
        road_type=road,
        work_zone_length_ft=length,
        is_divided=divided,
        work_zone_speed_mph=wz,
    )


def _taper_start(placements: list[DevicePlacement], length: float) -> float:
    return max(
        p.station_ft
        for p in placements
        if p.device_type != DeviceType.SIGN_GENERIC and p.station_ft > length
    )


def _stations(placements: list[DevicePlacement], prefix: str) -> list[float]:
    return sorted(
        {
            p.station_ft
            for p in placements
            if p.device_type == DeviceType.SIGN_GENERIC and (p.label or "").startswith(prefix)
        }
    )


_GRID = [
    pytest.param(
        gen,
        road,
        speed,
        wz,
        length,
        id=f"{gen.__name__.rsplit('_', 1)[1]}-{road}-{speed}-{wz}-{length:g}",
    )
    for gen, road, (speed, wz), length in itertools.product(_GENERATORS, _ROADS, _SPEEDS, _LENGTHS)
]


@pytest.mark.parametrize(("gen", "road", "speed", "wz", "length"), _GRID)
def test_speed_signs_sit_upstream_of_the_taper_in_case_11_order(
    gen: Any, road: str, speed: int, wz: int, length: float
) -> None:
    params = _params(road, speed, wz, length, gen is generate_shoulder_closure_divided)
    placements = gen(params)
    ts = _taper_start(placements, length)
    group = shoulder_speed_group(params, ts)
    assert group is not None
    (r2_10,) = _stations(placements, "R2-10")
    w3_5 = _stations(placements, "W3-5")
    (w20_1,) = _stations(placements, "W20-1")
    assert r2_10 == group.r2_10 and tuple(w3_5) == tuple(sorted(group.w3_5))
    assert group.entrance_r2_1 in _stations(placements, "R2-1")
    # The acceptance: nothing in the buffer or the taper; Case 11's order.
    assert ts < group.entrance_r2_1 < r2_10 < min(w3_5) and max(w3_5) < w20_1
    assert r2_10 - group.entrance_r2_1 == pytest.approx(500.0)
    assert all(b - a == pytest.approx(530.0) for a, b in zip([r2_10, *w3_5], w3_5, strict=False))
    abc = advance_warning_spacing(speed, road)
    if road == "freeway":
        # #368 (R1): W20-1 at 5,200 ft, or 1,000 ft past the last W3-5.
        assert (group.entrance_r2_1 - ts, r2_10 - ts, w20_1 - ts) == pytest.approx(
            (3000.0, 3500.0, max(5200.0, max(w3_5) - ts + 1000.0))
        )
    else:
        assert group.entrance_r2_1 - ts == pytest.approx(abc["A"] + abc["B"] + abc["C"])
        assert w20_1 == pytest.approx(max(w3_5) + abc["C"])
        # A and B keep their Table 6B-1 stations.
        assert any(st == pytest.approx(ts + abc["A"]) for st in _stations(placements, "W21-5"))
        assert _stations(placements, "W20-2") == [pytest.approx(ts + abc["A"] + abc["B"])]


@pytest.mark.parametrize(("gen", "road", "speed", "wz", "length"), _GRID)
def test_plaques_fill_to_2640_ft_or_report_the_gap(
    gen: Any, road: str, speed: int, wz: int, length: float
) -> None:
    params = _params(road, speed, wz, length, gen is generate_shoulder_closure_divided)
    placements = gen(params)
    ts = _taper_start(placements, length)
    group = shoulder_speed_group(params, ts)
    assert group is not None
    env = fines_double_envelope(params, ts, 0.0)
    assert _stations(placements, "R2-6P") == sorted(env.assemblies)
    added = [a for a in env.assemblies if a > ts]
    others = {
        p.station_ft
        for p in placements
        if p.device_type == DeviceType.SIGN_GENERIC
        and p.label not in ("G20-5P", "R2-6P")
        and p.station_ft > ts
    } | {group.entrance_r2_1}
    for a in added:
        assert ts < a < group.entrance_r2_1
        assert min(abs(a - o) for o in others | (set(added) - {a})) >= 250.0
    chain = sorted([env.r2_10, *env.assemblies, env.r2_11], reverse=True)
    over = [(hi, lo) for hi, lo in zip(chain, chain[1:], strict=False) if hi - lo > 2640.0]
    assert list(env.long_gaps) == over


def test_case_11_first_plaque_takes_the_drawn_var_slot() -> None:
    params = _params("freeway", 55, 45, 1000.0, True)
    placements = generate_shoulder_closure_divided(params)
    ts = _taper_start(placements, 1000.0)
    added = [round(a - ts, 6) for a in _stations(placements, "R2-6P") if a > ts]
    # Between the group (3,000) and the first W21-5aR (2,000): Case 11's "VAR.".
    assert 2500.0 in added


@pytest.mark.parametrize(
    "params",
    [
        _params("freeway", 65, 60, 1000.0, True),  # Case 26 (Sheet 14 places its own)
        ScenarioParams(
            speed_mph=55,
            num_lanes=2,
            closure_type="shoulder",
            road_type="rural",
            work_zone_length_ft=1000.0,
            is_divided=True,
        ),  # posted speed
        ScenarioParams(
            speed_mph=55,
            num_lanes=2,
            closure_type="lane",
            road_type="rural",
            work_zone_length_ft=1000.0,
            is_divided=True,
            work_zone_speed_mph=45,
        ),  # lane closure (#361)
    ],
    ids=["case-26", "posted-speed", "lane-closure"],
)
def test_no_speed_group_where_another_rule_places_the_signs(params: ScenarioParams) -> None:
    assert shoulder_speed_group(params, 2000.0) is None


def _body(road_type: str, speed: int, wz: int, work_len: float, divided: bool) -> dict[str, Any]:
    return {**_common(speed, wz), "roadType": road_type, "divided": divided, "workLen": work_len}


def test_audit_lists_every_placed_advance_sign(api: TestClient) -> None:  # noqa: F811
    """The issue's repro: rural 75->70 with 2,000 ft of work listed no W3-5."""
    sec = _post(api, "/render/audit", _body("rural_divided", 75, 70, 2000.0, True)).json()[
        "sections"
    ]
    rows = sec["advance"]["sign_table"]
    codes = [r["Code"] for r in rows]
    for code in ("W20-1", "W3-5(70)", "R2-10", "R2-1", "W20-2", "W21-5aR"):
        assert code in codes, code
    by_code = {r["Code"]: r["Position"] for r in rows}
    assert by_code["R2-10"] == "R2-10"
    assert by_code["R2-1"] == "Speed limit group"
    env = sec["fines_double"]["envelope"]
    assert env["entrance_r2_1_station_ft"] == env["r2_10_station_ft"] - 500.0
    assert "plaque_long_gaps_ft" not in env


def test_audit_case_11_names_the_group_and_r2_10(api: TestClient) -> None:  # noqa: F811
    sec = _post(api, "/render/audit", _common(55, 45)).json()["sections"]
    assert (
        "speed limit group 3,000 ft, R2-10 3,500 ft, W20-1 5,200 ft"
        in (sec["advance"]["spacing_text"])
    )
    by_code = {r["Code"]: r["Position"] for r in sec["advance"]["sign_table"]}
    assert by_code["R2-10"] == "R2-10 (Case 11)"


def test_left_over_gap_gets_the_engineer_note(api: TestClient) -> None:  # noqa: F811
    """urban_high signs are 350 ft apart, so no plaque spot is 250 ft clear."""
    body = _body("urban_arterial", 55, 45, 1000.0, False)
    audit = _post(api, "/render/audit", body).json()
    gaps = audit["sections"]["fines_double"]["envelope"]["plaque_long_gaps_ft"]
    assert gaps and all(hi - lo > 2640.0 for hi, lo in gaps)
    items = [
        i for i in audit["pending_verification"]["items"] if i["kind"] == "fines_double_spacing"
    ]
    assert len(items) == 1
    assert "as directed by the Engineer" in items[0]["label"]
    assert items[0]["tracking_issue"] is None  # #363 R2: no tracking link


def test_crew_sheet_places_r2_10_upstream_of_the_taper(api: TestClient) -> None:  # noqa: F811
    crew = _post(api, "/render/markdown", _body("rural_divided", 75, 70, 2000.0, True)).text
    assert "500 ft upstream of work zone" not in crew
    assert "2,000 ft upstream of taper (500 ft before the speed limit group)" in crew
    assert "500 ft past R2-10, on its own G20-5P plaque" in crew


@pytest.mark.parametrize(("road", "speed", "wz"), [("rural", 75, 65), ("expressway", 65, 55)])
def test_in_zone_plaques_keep_their_stations(road: str, speed: int, wz: int) -> None:
    """Ruling Q3: the in-zone plaques keep today's stations, so the moved W20-1
    doesn't grow the in-zone G20-5P series (counted from the group's station,
    W20-1's station before #360)."""
    params = _params(road, speed, wz, 1000.0, True)
    placements = generate_shoulder_closure_divided(params)
    ts = _taper_start(placements, 1000.0)
    group = shoulder_speed_group(params, ts)
    assert group is not None
    n = co_construction_plaques(group.entrance_r2_1)
    series = [round((k + 0.5) * 1000.0 / n, 6) for k in range(n)]
    in_zone = {round(st, 6) for st in _stations(placements, "G20-5P") if st <= 1000.0}
    assert set(series) <= in_zone
    assert len(in_zone - set(series)) <= 2  # the envelope's in-zone assemblies


def _glyph_boxes(pdf_path: str) -> tuple[str, list[tuple[float, float, float, float]]]:
    """Page 1's text and each character's (left, bottom, right, top) box."""
    doc = pdfium.PdfDocument(pdf_path)
    try:
        tp = doc[0].get_textpage()
        n = tp.count_chars()
        return tp.get_text_range(0, n), [tp.get_charbox(i) for i in range(n)]
    finally:
        doc.close()


def _span(text: str, boxes: list, needle: str, start: int = 0) -> tuple[int, tuple[float, ...]]:
    """The first ``needle`` at or after ``start``: its index and union box,
    ignoring spaces (whose boxes are degenerate)."""
    i = text.index(needle, start)
    bs = [boxes[k] for k in range(i, i + len(needle)) if not text[k].isspace()]
    return i, (
        min(b[0] for b in bs),
        min(b[1] for b in bs),
        max(b[2] for b in bs),
        max(b[3] for b in bs),
    )


@pytest.mark.parametrize(
    "params",
    [
        _params("freeway", 55, 45, 1000.0, True),  # Case 11, 14 rows
        _params("freeway", 65, 60, 1000.0, True),  # Case 26 (the overlap shipped there)
    ],
    ids=["case-11-55-45", "case-26"],
)
def test_page1_two_column_table_text_never_touches(params: ScenarioParams, tmp_path: Any) -> None:
    """R4 + the title fix, read off the rendered glyphs (Rule 11): the code
    clears its description, the entrance R2-1's description clears its
    distance, and the advance title's descenders clear the column headers."""
    pdf = str(tmp_path / "p1.pdf")
    render_plan_sheet(generate_shoulder_closure_divided(params), params, output_path=pdf)
    text, boxes = _glyph_boxes(pdf)
    t0 = text.index("ADVANCE WARNING SIGNS")
    # Title "(off-page upstream of taper)" vs the header row under it.
    _, title = _span(text, boxes, "(off-page upstream of taper)", t0)
    h_at, header = _span(text, boxes, "DISTANCE", t0)
    assert title[1] - header[3] >= 1.0, (title, header)
    # Every "W21-5aR" row: the code ends before its description starts.
    at = h_at
    while (at := text.find("W21-5aR", at + 1)) != -1:
        _, code = _span(text, boxes, "W21-5aR", at)
        _, desc = _span(text, boxes, "RIGHT SHOULDER CLOSED AHEAD", at)
        assert desc[0] - code[2] >= 2.0, (code, desc)
    # The entrance R2-1's description ends before its distance starts.
    d_at, desc = _span(text, boxes, "(work-zone speed posting)", h_at)
    dist_left = min(boxes[k][0] for k in range(d_at, text.index(" ft", d_at)) if text[k].isdigit())
    assert dist_left - desc[2] >= 2.0, (desc, dist_left)
