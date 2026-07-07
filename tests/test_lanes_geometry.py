"""Multi-lane wire-through: ``ShoulderScenario.lanes`` drives real geometry.

Before this, ``lanes`` accepted 1-6 but the shoulder generators and the
plan-sheet drawing hardcoded 2 lanes per direction (divided) / 1
(undivided): ``lanes=6`` rendered byte-identically to ``lanes=2``, while
the site-adjustment sign offsets DID scale with it — pedestrian/bicycle
signs plotted for the described road on top of a drawing of a different
one.  Contracts pinned here:

  * generator lane-edge offsets scale with ``num_lanes`` (lanes per
    direction — see ``ScenarioParams.num_lanes``);
  * the site-adjustment offsets stay consistent with that lane edge for
    every lane count (kills the class of drift, not one instance);
  * the rendered plan actually changes with ``lanes`` (content-stream
    hash), and every supported count renders a valid PDF;
  * the schema rejects what the sheet cannot draw: lanes > 4, and any
    lanes x laneWidth + shoulder combination beyond the empirically
    verified 52-ft drawable half-road (MAX_DRAWABLE_HALF_ROAD_FT).
"""

from __future__ import annotations

import hashlib
import re
import zlib

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter, ValidationError

from src.api.schemas import Scenario, scenario_to_call
from src.generation.layout import (
    generate_shoulder_closure_divided,
    generate_shoulder_closure_undivided,
)
from src.rules.site_adjustments import apply_site_adjustments
from src.rules.validators import ScenarioParams

_SECRET = "test-secret-do-not-deploy"

_ADAPTER: TypeAdapter[Scenario] = TypeAdapter(Scenario)


def _shoulder_body(lanes: int, *, divided: bool = True, lane_width: float = 12.0) -> dict:
    return {
        "kind": "shoulder",
        "meta": {
            "project": "lanes-geometry",
            "address": "",
            "lat": 0.0,
            "lng": 0.0,
            "siteConditions": {},
        },
        "roadType": "rural_divided" if divided else "rural_undivided",
        "speed": 55,
        "lanes": lanes,
        "laneWidth": lane_width,
        "divided": divided,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000.0,
        "night": False,
        "workZoneSpeed": None,
    }


def _params(lanes: int, *, divided: bool = True) -> ScenarioParams:
    # 4 lanes only fit the drawable half-road at narrow widths; the
    # geometry assertions below read the width back off the params.
    lane_width = 12.0 if lanes < 4 else 10.0
    scenario = _ADAPTER.validate_python(
        _shoulder_body(lanes, divided=divided, lane_width=lane_width)
    )
    params, _, _ = scenario_to_call(scenario)
    return params


# ---------------------------------------------------------------------------
# Generator lateral geometry scales with lanes per direction
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("lanes", [1, 2, 3, 4])
def test_divided_lane_edge_scales_with_lanes(lanes: int) -> None:
    params = _params(lanes, divided=True)
    placements = generate_shoulder_closure_divided(params)
    lane_edge = lanes * params.lane_width_ft
    shoulder_edge = lane_edge + params.shoulder_width_ft
    offsets = {round(p.offset_ft, 2) for p in placements}
    # The taper/tangent channelizers run between the lane edge and the
    # shoulder edge; right-side signs sit 4 ft past the lane edge.
    assert any(lane_edge <= o <= shoulder_edge for o in offsets), offsets
    assert round(lane_edge + 4.0, 2) in offsets
    # Nothing encroaches into the travel lanes.
    assert all(o >= lane_edge or o < 0 for o in offsets), offsets


@pytest.mark.parametrize("lanes", [1, 2, 3, 4])
def test_undivided_lane_edge_scales_with_lanes(lanes: int) -> None:
    params = _params(lanes, divided=False)
    placements = generate_shoulder_closure_undivided(params)
    lane_edge = lanes * params.lane_width_ft
    offsets = {round(p.offset_ft, 2) for p in placements}
    assert round(lane_edge + 4.0, 2) in offsets  # right-side signs
    assert all(o >= lane_edge for o in offsets), offsets


def test_lanes_1_undivided_matches_legacy_two_lane_geometry() -> None:
    """lanes=1 per direction IS the classic 2-lane road the generator
    hardcoded before the wire-through: lane edge one width out."""
    params = _params(1, divided=False)
    placements = generate_shoulder_closure_undivided(params)
    assert round(params.lane_width_ft + 4.0, 2) in {round(p.offset_ft, 2) for p in placements}


# ---------------------------------------------------------------------------
# Site-adjustment sign offsets stay consistent with the drawn lane edge
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("lanes", [1, 2, 3, 4])
@pytest.mark.parametrize("divided", [True, False], ids=["divided", "undivided"])
def test_pedestrian_signs_track_the_lane_edge(lanes: int, divided: bool) -> None:
    params = _params(lanes, divided=divided)
    gen = generate_shoulder_closure_divided if divided else generate_shoulder_closure_undivided
    adjusted, _ = apply_site_adjustments(gen(params), params, {"pedestrian_facility": True})
    expected = lanes * params.lane_width_ft + params.shoulder_width_ft + 2.0
    r9_offsets = {round(abs(p.offset_ft), 2) for p in adjusted if p.label == "R9-9"}
    assert r9_offsets == {round(expected, 2)}


# ---------------------------------------------------------------------------
# Site-feature detection scales with the road width
# ---------------------------------------------------------------------------


def test_wide_road_does_not_phantom_detect_cross_street() -> None:
    """The intersection glyph is inferred from a W20-1 beyond the road
    edge.  The old fixed 40-ft threshold false-positived on wide roads
    (a 4x10 baseline advance sign sits at 44 ft), drawing a phantom
    CROSS ST. on plans with no site flags."""
    from src.rendering.plan_sheet import _detect_site_features

    params = _params(4, divided=True)
    placements = generate_shoulder_closure_divided(params)
    flags = _detect_site_features(placements, params, params.shoulder_width_ft)
    assert not any(flags.values()), flags


@pytest.mark.parametrize("lanes", [2, 4])
def test_cross_street_signs_detected_and_off_the_road(lanes: int) -> None:
    from src.rendering.plan_sheet import _detect_site_features

    params = _params(lanes, divided=True)
    adjusted, _ = apply_site_adjustments(
        generate_shoulder_closure_divided(params), params, {"adjacent_intersection": True}
    )
    road_edge = lanes * params.lane_width_ft + params.shoulder_width_ft
    xstreet = [p for p in adjusted if p.label == "W20-1" and abs(p.offset_ft) > road_edge]
    assert len(xstreet) == 2  # one facing each cross-street approach
    flags = _detect_site_features(adjusted, params, params.shoulder_width_ft)
    assert flags["adjacent_intersection"]


# ---------------------------------------------------------------------------
# The rendered plan reflects the lane count
# ---------------------------------------------------------------------------


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("RENDER_API_SECRET", _SECRET)
    from src.api.render_api import app

    return TestClient(app, raise_server_exceptions=False)


def _pdf_content_hash(client: TestClient, body: dict) -> str:
    res = client.post(
        "/render/pdf",
        headers={"Authorization": f"Bearer {_SECRET}"},
        json=body,
    )
    assert res.status_code == 200, res.text
    assert res.headers["content-type"] == "application/pdf"
    # Hash decompressed content streams only: drawn content, independent
    # of nondeterministic PDF metadata (creation date, doc id).
    h = hashlib.sha256()
    for m in re.finditer(rb"stream\r?\n(.*?)endstream", res.content, re.S):
        try:
            h.update(zlib.decompress(m.group(1)))
        except zlib.error:
            h.update(m.group(1))
    return h.hexdigest()


@pytest.mark.parametrize("divided", [True, False], ids=["divided", "undivided"])
def test_each_lane_count_renders_and_differs(client: TestClient, divided: bool) -> None:
    # lanes=4 at 12-ft lanes exceeds the drawable half-road; use 10 ft
    # there so every case is schema-valid.
    hashes = [
        _pdf_content_hash(
            client,
            _shoulder_body(lanes, divided=divided, lane_width=12.0 if lanes < 4 else 10.0),
        )
        for lanes in (1, 2, 3, 4)
    ]
    assert len(set(hashes)) == 4, "plans for different lane counts must draw differently"


def test_widest_drawable_carriageway_renders(client: TestClient) -> None:
    # Exactly at MAX_DRAWABLE_HALF_ROAD_FT: 3 lanes x 14 ft + 10 ft = 52.
    _pdf_content_hash(client, _shoulder_body(3, divided=True, lane_width=14.0))


# ---------------------------------------------------------------------------
# Schema rejects what the sheet cannot draw
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("lanes", [5, 6])
def test_lanes_above_four_rejected(lanes: int) -> None:
    with pytest.raises(ValidationError) as exc_info:
        _ADAPTER.validate_python(_shoulder_body(lanes))
    assert any(e["type"] == "less_than_equal" for e in exc_info.value.errors())


@pytest.mark.parametrize(
    ("lanes", "lane_width", "divided"),
    [
        (4, 12.0, True),  # 58 ft half-road
        (4, 11.0, True),  # 54 ft — verified colliding with the title block
        (3, 14.0, False),  # undivided: 42 + 8 = 50 ok, but see accept case below
    ],
    ids=["4x12-div", "4x11-div", "3x14-undiv-ok"],
)
def test_drawable_half_road_bound(lanes: int, lane_width: float, divided: bool) -> None:
    body = _shoulder_body(lanes, divided=divided, lane_width=lane_width)
    shoulder = 10.0 if divided else 8.0
    if lanes * lane_width + shoulder > 52.0:
        with pytest.raises(ValidationError) as exc_info:
            _ADAPTER.validate_python(body)
        assert any("drawable half-road" in str(e["msg"]) for e in exc_info.value.errors())
    else:
        assert _ADAPTER.validate_python(body).lanes == lanes


def test_widest_drawable_combination_accepted() -> None:
    # 3 x 14 + 10 = exactly 52 ft (divided); 4 x 11 + 8 = 52 (undivided).
    assert _ADAPTER.validate_python(_shoulder_body(3, lane_width=14.0)).lanes == 3
    assert _ADAPTER.validate_python(_shoulder_body(4, divided=False, lane_width=11.0)).lanes == 4


def test_render_pdf_lanes_5_is_clean_422(client: TestClient) -> None:
    res = client.post(
        "/render/pdf",
        headers={"Authorization": f"Bearer {_SECRET}"},
        json=_shoulder_body(5),
    )
    assert res.status_code == 422, res.text
    assert any(e["loc"][-1] == "lanes" for e in res.json()["detail"])
