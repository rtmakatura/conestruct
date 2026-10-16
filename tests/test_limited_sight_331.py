"""#331: limited sight distance puts the nearest advance sign at the top of
MUTCD 11th Ed. §6B.04's range (p. 771: ¶04 urban 8 x speed, ¶06 rural
12 x speed) in place of Table 6B-1's A, and each approach's whole advance
series moves with it (R155, Ryan 2026-10-16, clarified at the checkpoint).

Before #331 every sign's station (measured from the work zone's far end)
was multiplied by an unsourced 1.5: on N Broadway at 30 mph with a 1,500 ft
zone the nearest sign sat 1,020 ft from the taper while the audit said "50%
farther".  The flagger chain lost its order (W20-4 never moved) and the
near-intersection R2-10 stayed behind.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient

from src.api import render_api
from src.generation.layout import (
    flagger_chain_stations,
    generate_flagger_alternating_2lane,
    generate_shoulder_closure_divided,
    generate_shoulder_closure_undivided,
)
from src.rules import site_detection as sd
from src.rules.sign_codes import _taper_start_station
from src.rules.site_adjustments import LIMITED_SIGHT_ENGINEER_NOTE, apply_site_adjustments
from src.rules.spacing import limited_sight_nearest_sign
from src.rules.validators import ScenarioParams
from tests.test_approach_speed_guess import body as ni_body
from tests.test_left_side_oneway import broadway

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
LSD = {"limited_sight_distance": True}
PAGE_NOTE_URBAN = (
    "LIMITED SIGHT: NEAREST SIGN 8 × SPEED (MUTCD §6B.04). SIGNS PER ENGINEER "
    "(S-630-1 NOTES 10, 25)."
)


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _no_overpass(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_kw: ({"elements": []}, None)
    )


def _shoulder(speed: int, road_type: str, wz: float, divided: bool = False) -> ScenarioParams:
    return ScenarioParams(
        speed_mph=speed,
        num_lanes=2 if divided else 1,
        closure_type="shoulder",
        road_type=road_type,
        work_zone_length_ft=wz,
        lane_width_ft=12.0,
        is_divided=divided,
        jurisdiction="CDOT",
    )


def _flagger(speed: int, road_type: str, wz_speed: int | None = None) -> ScenarioParams:
    return ScenarioParams(
        speed_mph=speed,
        work_zone_speed_mph=wz_speed,
        num_lanes=1,
        closure_type="lane",
        road_type=road_type,
        work_zone_length_ft=400.0,
        lane_width_ft=12.0,
        is_divided=False,
        jurisdiction="CDOT",
    )


def _moved(before, after) -> list[tuple[str, float, float]]:
    return [
        (b.label, b.station_ft, a.station_ft) for b, a in zip(before, after, strict=True) if b != a
    ]


def test_the_range_top_is_8_or_12_times_speed() -> None:
    assert limited_sight_nearest_sign(30, "urban_low") == (240.0, 8, "urban")
    assert limited_sight_nearest_sign(45, "urban_high") == (360.0, 8, "urban")
    assert limited_sight_nearest_sign(65, "rural") == (780.0, 12, "rural")
    assert limited_sight_nearest_sign(35, None) == (280.0, 8, "urban")
    assert limited_sight_nearest_sign(65, "expressway") is None
    assert limited_sight_nearest_sign(65, "freeway") is None


@pytest.mark.parametrize(
    "speed,road_type,divided,nearest",
    [(25, "urban_low", False, 200.0), (30, "urban_low", False, 240.0), (65, "rural", True, 780.0)],
)
@pytest.mark.parametrize("wz", [200.0, 1500.0, 5000.0])
def test_a_shoulder_plan_puts_the_nearest_sign_at_the_range_top(
    speed: int, road_type: str, divided: bool, nearest: float, wz: float
) -> None:
    params = _shoulder(speed, road_type, wz, divided)
    gen = generate_shoulder_closure_divided if divided else generate_shoulder_closure_undivided
    before = gen(params)
    after, (rec,) = apply_site_adjustments(before, params, LSD)
    taper = _taper_start_station(params)
    moved = _moved(before, after)
    shift = {round(a - b, 6) for _, b, a in moved}
    # One shift for the whole series, so every Table 6B-1 gap behind the
    # nearest sign is kept; the nearest sign lands at the range top from
    # the taper whatever the work zone's length.
    assert len(shift) == 1
    assert min(a for _, _, a in moved) - taper == pytest.approx(nearest)
    assert {label for label, _, _ in moved} == {"W21-5aR", "W20-2", "W20-1"}
    assert f"now sits {nearest:,.0f} ft from the taper" in rec["action"]
    assert rec["action"].endswith(LIMITED_SIGHT_ENGINEER_NOTE)
    assert rec["devices_modified"] == len(moved)
    assert "50%" not in rec["action"]


def test_the_flagger_moves_both_approaches_in_order_from_each_flagger() -> None:
    params = _flagger(35, "urban_low")
    st = flagger_chain_stations(params)
    before = generate_flagger_alternating_2lane(params)
    after, (rec,) = apply_site_adjustments(before, params, LSD)
    # 280 ft = 8 x 35 mph from each flagger station (Fig. 6P-10 measures A
    # from the flagger, not the taper), so the series moves 180 ft.
    w20_7 = sorted(p.station_ft for p in after if p.label == "W20-7")
    assert w20_7 == pytest.approx([st["flagger_2"] - 280.0, st["flagger_1"] + 280.0])
    for side in (1, -1):
        chain = sorted(
            (p.station_ft * side, p.label)
            for p in after
            if p.label in {"W20-7", "W3-4", "W20-4", "W20-1"} and p.station_ft * side > 0
        )
        assert [label for _, label in chain] == ["W20-7", "W3-4", "W20-4", "W20-1"]
        gaps = [b - a for (a, _), (b, _) in zip(chain, chain[1:], strict=False)]
        before_chain = sorted(
            (p.station_ft * side)
            for p in before
            if p.label in {"W20-7", "W3-4", "W20-4", "W20-1"} and p.station_ft * side > 0
        )
        assert gaps == pytest.approx(
            [b - a for a, b in zip(before_chain, before_chain[1:], strict=False)]
        )
    assert "280 ft from each flagger station" in rec["action"]


def test_the_reduced_speed_flagger_envelope_moves_with_its_chain() -> None:
    params = _flagger(45, "rural", wz_speed=35)
    before = generate_flagger_alternating_2lane(params)
    after, _ = apply_site_adjustments(before, params, LSD)
    shifts = {abs(round(a - b, 6)) for _, b, a in _moved(before, after)}
    assert shifts == {40.0}  # 12 x 45 = 540 against Table 6B-1's rural A = 500
    moved_labels = {label for label, _, _ in _moved(before, after)}
    assert {"R2-10", "W3-5(35)", "W20-4"} <= moved_labels


@pytest.mark.parametrize(
    "params,why",
    [
        (_shoulder(65, "freeway", 1500.0, divided=True), "placement ranges cover urban streets"),
        (_shoulder(65, "expressway", 1500.0, divided=True), "placement ranges cover urban streets"),
        # 12 x 35 = 420 ft, inside the rural row's Table 6B-1 A of 500 ft:
        # never closer than A.
        (_shoulder(35, "rural", 800.0), "already puts the nearest sign 500 ft"),
    ],
)
def test_no_sign_moves_closer_or_off_a_range(params: ScenarioParams, why: str) -> None:
    gen = (
        generate_shoulder_closure_divided
        if params.is_divided
        else generate_shoulder_closure_undivided
    )
    before = gen(params)
    after, (rec,) = apply_site_adjustments(before, params, LSD)
    assert after == before
    assert rec["devices_modified"] == 0
    assert why in rec["action"]
    assert rec["action"].endswith(LIMITED_SIGHT_ENGINEER_NOTE)


def test_a_plan_without_the_flag_is_unchanged() -> None:
    params = _shoulder(30, "urban_low", 1500.0)
    before = generate_shoulder_closure_undivided(params)
    after, records = apply_site_adjustments(before, params, {})
    assert after == before and records == []


# --- every surface, through the real API ----------------------------------


def _surfaces(body: dict[str, Any]) -> tuple[dict[str, Any], str, str]:
    c = TestClient(render_api.app)
    res = c.post("/render/audit", headers=AUTH, json=body)
    assert res.status_code == 200, res.text[:300]
    md = c.post("/render/markdown", headers=AUTH, json=body).text
    pdf = pdfium.PdfDocument(c.post("/render/pdf", headers=AUTH, json=body).content)
    return res.json(), md, pdf[0].get_textpage().get_text_range()


def test_broadway_reads_240_340_440_on_every_surface() -> None:
    """The issue's repro: N Broadway SB, left shoulder, 30 mph, 1,500 ft, night."""
    b = broadway("left", speed=30, workLen=1500, night=True)
    b["meta"]["siteConditions"] = dict(LSD)
    audit, md, page1 = _surfaces(b)
    rows = {r["Code"]: r for r in audit["sections"]["advance"]["sign_table"]}
    assert rows["W21-5aL"]["Distance from Taper (ft)"] == "240 upstream"
    assert rows["W21-5aL"]["Position"] == "A (nearest)"
    assert rows["W20-2"]["Distance from Taper (ft)"] == "340 upstream"
    assert rows["W20-1"]["Distance from Taper (ft)"] == "440 upstream"
    assert audit["sections"]["advance"]["spacing_text"].endswith(
        "limited sight distance moves every advance sign 140 ft farther upstream (MUTCD §6B.04)"
    )
    (rec,) = audit["sections"]["site_adjustments"]
    assert "now sits 240 ft from the taper (8 × 30 mph" in rec["action"]
    assert rec["citation"] == "MUTCD § 6B.04"

    assert "| W21-5aL | LEFT SHOULDER CLOSED AHEAD | 240 ft upstream |" in md
    assert "| W20-2 | ROAD WORK 340 FT | 340 ft upstream |" in md
    assert LIMITED_SIGHT_ENGINEER_NOTE in md

    flat = " ".join(page1.split())
    assert "W21-5aL LEFT SHOULDER CLOSED AHEAD 240 ft" in flat
    assert "W20-1 ROAD WORK AHEAD 440 ft" in flat
    assert PAGE_NOTE_URBAN in flat


def test_the_near_intersection_r2_10_reads_as_placed_on_the_crew_sheet() -> None:
    b = ni_body()
    b["meta"]["siteConditions"] = dict(LSD)
    audit, md, page1 = _surfaces(b)
    rows = {r["Code"]: r for r in audit["sections"]["advance"]["sign_table"]}
    # 25 mph urban: 200 ft = 8 x 25; R2-10 keeps its 1/2 C inside W20-1.
    assert rows["W4-2R"]["Distance from Taper (ft)"] == "200 upstream"
    assert rows["R2-10"]["Distance from Taper (ft)"] == "350 upstream"
    assert rows["R2-10"]["Position"] == "1/2 C inside the outermost sign (Case 18)"
    assert "| R2-10 | BEGIN DOUBLE FINES ZONE | 350 ft upstream" in md
    assert PAGE_NOTE_URBAN in " ".join(page1.split())


def test_the_flagger_surfaces_agree() -> None:
    b = {
        "kind": "flagger_lane_closure",
        "roadType": "rural_undivided",
        "speed": 45,
        "workZoneSpeed": 35,
        "laneWidth": 11.0,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
        "pilotCar": False,
        "afad": False,
        "pedestrianAccess": False,
        "meta": {"siteConditions": dict(LSD)},
    }
    audit, md, page1 = _surfaces(b)
    rows = {r["Code"]: r for r in audit["sections"]["advance"]["sign_table"]}
    # 540 ft from the flagger, which stands 100 ft before the taper.
    assert rows["W20-7"]["Distance from Taper (ft)"] == "640 upstream"
    assert rows["W20-7"]["Position"] == "A (nearest)"
    for code in ("W20-7", "W3-4", "W20-4", "W20-1"):
        dist = rows[code]["Distance from Taper (ft)"].replace(" upstream", "")
        assert f"| {code} |" in md and f"| {dist} ft upstream |" in md
    assert (
        "LIMITED SIGHT: NEAREST SIGN 12 × SPEED (MUTCD §6B.04). SIGNS PER ENGINEER "
        "(S-630-1 NOTES 10, 25)."
    ) in " ".join(page1.split())


def test_production_broadway_keeps_every_advance_row_on_page_1() -> None:
    """#331's prod check: the production plan (5 lanes drawn as 4, a scanned
    sidewalk's R9-9 in the sign schedule) cut W20-2 and W20-1 to "+2 MORE"
    under the three-line note.  The one-line note keeps all three rows."""
    b = broadway(
        "left",
        speed=30,
        workLen=1500,
        night=True,
        lanes=4,
        laneWidth=11.0,
        roadType="urban_arterial",
        roadLanesPerDirection=5,
        detectedLanesTotal=5,
    )
    b["meta"]["siteConditions"] = {**LSD, "pedestrian_facility": True}
    _, _, page1 = _surfaces(b)
    flat = " ".join(page1.split())
    assert "R9-9 SIDEWALK CLOSED" in flat
    assert "MORE ADVANCE SIGNS" not in flat
    for row in (
        "W21-5aL LEFT SHOULDER CLOSED AHEAD 240 ft",
        "W20-2 ROAD WORK 340 FT 340 ft",
        "W20-1 ROAD WORK AHEAD 440 ft",
    ):
        assert row in flat
    # One printed line: the note sits whole on a single text line.
    assert any(ln.strip() == PAGE_NOTE_URBAN for ln in page1.splitlines())


@pytest.mark.parametrize(
    "params",
    [
        _shoulder(30, "urban_low", 800.0),
        _shoulder(65, "rural", 800.0, divided=True),
        _shoulder(65, "freeway", 800.0, divided=True),
    ],
)
@pytest.mark.parametrize("with_summary", [True, False])
def test_the_page_note_fits_one_line_of_the_notes_box(
    params: ScenarioParams, with_summary: bool
) -> None:
    """Page 1's notes box cuts advance rows before notes, so the note must
    stay one line in the narrower (4-box) footer as well."""
    from reportlab.pdfbase.pdfmetrics import stringWidth

    from src.rendering.plan_sheet import _footer_geometry
    from src.rules.site_adjustments import limited_sight_page_note

    capacity = _footer_geometry(with_summary).notes_w - 16.0
    note = limited_sight_page_note(params)
    assert stringWidth(note, "Helvetica-Bold", 6.5) <= capacity, note
