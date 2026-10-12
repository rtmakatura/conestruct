"""#314 (R135, R136) — page 1's shoulder-edge channelizers, the arrow board,
the sidewalk band and the direction arrows.

S-630-1 (July 2026) Sheet 7, Case 11 ("Shoulder Work – Freeway/Expressway"):
the shoulder taper starts on the shoulder's outer edge line and the
downstream taper returns to it, so those devices stand ON the line.  Page 1
draws every channelizer glyph wholly inside the road outline (A step 1), moves
the arrow board's glyph upstream clear of the drums (A step 2), starts the
sidewalk band at the road edge (B), and keeps the two-way and divided
direction arrows off the band.  Render-only: no placement moves.
"""

from __future__ import annotations

import copy
import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

import src.rendering.plan_sheet as ps
from src.rules import site_detection as sd
from src.rules.validators import DevicePlacement, DeviceType

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
FX = Path(__file__).parent / "fixtures"
BOX = {
    DeviceType.CONE: (8.0, 10.0),
    DeviceType.DRUM: (10.0, 14.0),
    DeviceType.ARROW_BOARD: (20.0, 12.0),
}


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *a, **k: ({"elements": []}, None)
    )
    monkeypatch.delenv("MAPBOX_TOKEN", raising=False)


def _broadway(side: str) -> dict[str, Any]:
    b = json.loads((FX / "corridor" / "broadway-sb.json").read_text(encoding="utf-8"))
    m = b["meta"]
    cand = m["confirmedRoad"]["candidate"]
    m["centerline"] = cand["geometry"]
    m["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": cand["tags"]["oneway"]}
    m["work"] = {"side": side, "travel": "with_geometry"}
    b["carriageway"] = {
        "oneway": "yes",
        "highwayClass": "primary",
        "twinDistanceM": None,
        "twinSearched": True,
    }
    b["divided"] = False
    return b


def _worst(name: str) -> dict[str, Any]:
    return json.loads((FX / "pdf_worst_case" / name).read_text(encoding="utf-8"))["scenario"]


PLANS = {
    "one-way right": lambda: _broadway("right"),
    "one-way left": lambda: _broadway("left"),
    "two-way undivided": lambda: _worst("control-typical.json"),
    "divided": lambda: _worst("adv-shoulder.json"),
}


def _page1(monkeypatch: pytest.MonkeyPatch, body: dict[str, Any]) -> dict[str, Any]:
    """Render page 1 and record the renderer's own geometry."""
    rec: dict[str, Any] = {"bands": [], "arrows": []}
    layout, strip, arrow = ps._layout_device_positions, ps._draw_strip, ps._draw_lane_arrow

    def _layout(placements, x_of, station_max_visible, params, shoulder_width_ft, site_flags=None):
        items, lights = layout(
            placements, x_of, station_max_visible, params, shoulder_width_ft, site_flags
        )
        rec["items"], rec["road"] = items, ps._road_y_extent(params, shoulder_width_ft)
        return items, lights

    def _strip(c, x_left, x_right, y_low, y_high, fill, *a, **kw):
        if fill == ps.SIDEWALK_FILL:
            rec["bands"].append((y_low, y_high))
        return strip(c, x_left, x_right, y_low, y_high, fill, *a, **kw)

    def _arrow(c, x_left, x_right, y, pointing_right=True):
        rec["arrows"].append(y)
        return arrow(c, x_left, x_right, y, pointing_right)

    monkeypatch.setattr(ps, "_layout_device_positions", _layout)
    monkeypatch.setattr(ps, "_draw_strip", _strip)
    monkeypatch.setattr(ps, "_draw_lane_arrow", _arrow)
    from src.api.render_api import app

    r = TestClient(app).post("/render/pdf", headers=AUTH, json=body)
    assert r.status_code == 200, r.text[:300]
    return rec


def _box(dt: DeviceType, x: float, y: float) -> tuple[float, float, float, float]:
    w, h = BOX[dt]
    return (x - w / 2, x + w / 2, y - h / 2, y + h / 2)


@pytest.mark.parametrize("sidewalk", [False, True], ids=["no-sidewalk", "sidewalk"])
@pytest.mark.parametrize("plan", list(PLANS))
def test_page_1_draws_channelizers_on_the_road_and_the_board_clear(
    monkeypatch: pytest.MonkeyPatch, plan: str, sidewalk: bool
) -> None:
    body = copy.deepcopy(PLANS[plan]())
    body["meta"]["siteConditions"] = {
        **(body["meta"].get("siteConditions") or {}),
        "pedestrian_facility": sidewalk,
    }
    rec = _page1(monkeypatch, body)
    lo, hi = min(rec["road"]), max(rec["road"])
    chans = [
        (p, x, y) for p, x, y in rec["items"] if p.device_type in (DeviceType.CONE, DeviceType.DRUM)
    ]
    assert chans
    for p, x, y in chans:
        b = _box(p.device_type, x, y)
        assert lo <= b[2] and b[3] <= hi, (p.label, p.station_ft, b, (lo, hi))
        for blo, bhi in rec["bands"]:
            assert min(b[3], bhi) - max(b[2], blo) <= 0, (p.label, p.station_ft, b, (blo, bhi))
    for pb, xb, yb in rec["items"]:
        if pb.device_type != DeviceType.ARROW_BOARD:
            continue
        bb = _box(DeviceType.ARROW_BOARD, xb, yb)
        # Clear of the drums AND still on the plan (a taper at the plan's
        # edge sends the board downstream, not off the page).
        assert bb[0] >= ps.PLAN_LEFT and bb[1] <= ps.PLAN_RIGHT, (bb, ps.PLAN_LEFT, ps.PLAN_RIGHT)
        for p, x, y in chans:
            c = _box(p.device_type, x, y)
            overlap = min(bb[1], c[1]) > max(bb[0], c[0]) and min(bb[3], c[3]) > max(bb[2], c[2])
            assert not overlap, (p.label, p.station_ft, bb, c)
    # The direction arrows stay off the band (two-way and divided; one-way
    # plans draw theirs in the lanes, #308 R94).
    for ay in rec["arrows"]:
        for blo, bhi in rec["bands"]:
            assert not (blo <= ay <= bhi), (ay, (blo, bhi))
    assert len(rec["bands"]) == (0 if not sidewalk else (2 if plan == "divided" else 1))


def test_the_sidewalk_band_starts_at_the_road_edge() -> None:
    from src.rules.validators import ScenarioParams

    params = ScenarioParams(
        speed_mph=30,
        num_lanes=2,
        closure_type="shoulder",
        road_type="urban_low",
        work_zone_length_ft=500,
        lane_width_ft=12.0,
    )
    assert ps._sidewalk_strip_ft(params, 8.0) == (32.0, 37.0)


def _placement(dt: DeviceType, station: float = 100.0) -> DevicePlacement:
    return DevicePlacement(device_type=dt, station_ft=station, offset_ft=10.0, label=dt.name)


def test_the_pull_moves_only_channelizers_that_cross_the_outline() -> None:
    items = [
        (_placement(DeviceType.DRUM), 50.0, 312.0),  # crosses the top line (310)
        (_placement(DeviceType.CONE), 60.0, 400.0),  # inside: untouched
        (_placement(DeviceType.SIGN_GENERIC), 70.0, 300.0),  # not a channelizer
    ]
    out = ps._pull_channelizers_inside_road(items, 310.0, 513.0)
    assert out[0][2] == pytest.approx(310.0 + 7.0 + 0.5)
    assert out[1][2] == 400.0
    assert out[2][2] == 300.0
    assert [p for p, _, _ in out] == [p for p, _, _ in items]


def test_the_board_moves_upstream_clear_of_the_drums() -> None:
    def x_of(station: float) -> float:
        return 1000.0 - station  # upstream (higher station) is to the left

    items = [
        (_placement(DeviceType.ARROW_BOARD, 1240), 100.0, 318.0),
        (_placement(DeviceType.DRUM, 1240), 100.0, 317.5),
        (_placement(DeviceType.DRUM, 1226), 112.0, 320.0),
    ]
    out = ps._clear_arrow_board_of_channelizers(items, x_of)
    xb, yb = out[0][1], out[0][2]
    assert yb == 318.0
    assert xb + 10.0 <= 100.0 - 5.0 - 0.5 + 1e-9  # left of the first drum's box
