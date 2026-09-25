"""#290 / #298 — the corridor readers under the work-start model.

The scan and the plan sheet build their corridors with the pin model, so a
work-start pin lays the approach UPSTREAM of the work for the traffic the
side names (ruling 7, 8; #298 is the shipped mirror this removes).  The
flagger scans both approaches — one box each, one round trip (the
open-points ruling 4; ruling 9 fixes where each approach reaches the work).

Payload-level (Rule 11): the scan through ``/render/audit`` with Overpass
stubbed to return features at measured places, asserting what the plan
reads — which features count, in which zone, from which approach, and the
query that was sent.  The plan sheet through ``render_plan_sheet``, read
back as PDF text.
"""

from __future__ import annotations

import os
import re
from collections.abc import Iterator
from typing import Any

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient

from src.api import site_scan as ss
from src.generation.layout import generate_shoulder_closure_undivided
from src.rendering import plan_sheet as ps
from src.rules import site_detection as sd
from src.rules.corridor import _destination_point
from src.rules.validators import ScenarioParams

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
PIN = (39.7400, -104.9600)
M_PER_FT = 0.3048


def at(bearing: float, feet: float) -> tuple[float, float]:
    return _destination_point(*PIN, bearing, feet * M_PER_FT)


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


class Overpass:
    """Serves chosen crossing nodes; records every query sent."""

    def __init__(self) -> None:
        self.queries: list[str] = []
        self.nodes: list[tuple[float, float]] = []

    def __call__(self, query: str, *_a: Any, **_kw: Any) -> tuple[dict[str, Any], None]:
        self.queries.append(query)
        elements = [
            {"type": "node", "id": i + 1, "lat": la, "lon": lo, "tags": {"highway": "crossing"}}
            for i, (la, lo) in enumerate(self.nodes)
        ]
        return {"elements": elements}, None


@pytest.fixture()
def overpass(monkeypatch: pytest.MonkeyPatch) -> Iterator[Overpass]:
    stub = Overpass()
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", stub)
    ss.clear_memo()
    yield stub
    ss.clear_memo()


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


def shoulder(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "shoulder",
        "meta": {"project": "s290", "address": "", "lat": PIN[0], "lng": PIN[1], **meta},
        "roadType": "urban_arterial",
        "speed": 35,
        "lanes": 2,
        "laneWidth": 12,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
        "site_scan": {},
    }


def flagger(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "flagger_lane_closure",
        "meta": {"project": "s290", "address": "", "lat": PIN[0], "lng": PIN[1], **meta},
        "roadType": "rural_undivided",
        "speed": 45,
        "laneWidth": 11.0,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
        "pilotCar": False,
        "afad": False,
        "pedestrianAccess": False,
        "site_scan": {},
    }


NORTHBOUND = {"pinModel": "work_start", "work": {"side": "right", "heading": "N"}}


def scan(client: TestClient, body: dict[str, Any]) -> dict[str, Any]:
    res = client.post("/render/audit", headers=AUTH, json=body)
    assert res.status_code == 200, res.text[:400]
    return res.json()["sections"]["site_scan"]


# ---------------------------------------------------------------------------
# #298: the approach is upstream of the work
# ---------------------------------------------------------------------------


def test_work_start_counts_the_approach_upstream_of_the_work(
    client: TestClient, overpass: Overpass
) -> None:
    """Northbound traffic, pin at the work start.  A crossing 400 ft SOUTH
    of the pin is on the approach (advance warning); one 1,400 ft NORTH is
    past the work and its downstream taper.  The work-start scan counts the
    first and not the second."""
    overpass.nodes = [at(180.0, 400.0), at(0.0, 1400.0)]
    s = scan(client, shoulder(NORTHBOUND))
    assert s["status"] == "ok"
    features = s["buckets"]["intersections"]["features"]
    south, north = features
    assert south["relevant"] is True and south["zone"] == "advance_warning"
    assert north["relevant"] is False
    # Distance from the pin the operator marked, not from the moved anchor.
    assert south["distance_to_anchor_m"] == pytest.approx(400.0 * M_PER_FT, abs=0.2)
    assert s["inputs"]["pin_model"] == "work_start"
    assert s["inputs"]["lat"] == PIN[0] and s["inputs"]["lng"] == PIN[1]
    # The query's box reaches the approach south of the pin.
    south_edge = float(re.search(r"node\(([-\d.]+),", overpass.queries[0]).group(1))
    assert south_edge < at(180.0, 600.0)[0]


def test_the_same_pin_as_corridor_end_is_the_shipped_mirror(
    client: TestClient, overpass: Overpass
) -> None:
    """The contrast, pinned: the corridor_end reading of the same pin and
    the same compass value counts the opposite side — #298 as shipped."""
    overpass.nodes = [at(180.0, 400.0), at(0.0, 1400.0)]
    s = scan(client, shoulder({"bearingDeg": 0.0}))
    south, north = s["buckets"]["intersections"]["features"]
    assert south["relevant"] is False
    # 1,400 ft along the sent bearing: past downstream 100 + work 1,000 +
    # buffer 250 — inside the taper, the approach laid on the far side.
    assert north["relevant"] is True and north["zone"] == "transition"
    assert s["inputs"]["pin_model"] == "corridor_end"


def test_side_unset_is_named_not_scanned(client: TestClient, overpass: Overpass) -> None:
    s = scan(client, shoulder({"pinModel": "work_start"}))
    assert s["status"] == "not_run"
    assert s["reason"] == "side_not_confirmed"
    assert overpass.queries == []


# ---------------------------------------------------------------------------
# The flagger: two approaches, one box each, one round trip
# ---------------------------------------------------------------------------


def test_the_flagger_scans_both_approaches_in_one_round_trip(
    client: TestClient, overpass: Overpass
) -> None:
    """Pin = the closed lane's upstream end (ruling 9), northbound.  The
    work runs 500 ft north; the opposing (southbound) traffic reaches it at
    its north end.  A crossing 900 ft north of the pin — 400 ft past the
    work's far end — is on the OPPOSING approach, and is counted as such."""
    overpass.nodes = [at(0.0, 900.0)]
    s = scan(client, flagger(NORTHBOUND))
    assert len(overpass.queries) == 1
    assert overpass.queries[0].count('["highway"="traffic_signals"]') == 2
    assert s["inputs"]["opposing_bbox"] is not None
    (feature,) = s["buckets"]["intersections"]["features"]
    assert feature["relevant"] is True
    assert feature["approach"] == "opposing"
    assert any("opposing approach" in d for d in s["buckets"]["intersections"]["details"])


def test_corridor_end_flagger_is_one_box_as_before(client: TestClient, overpass: Overpass) -> None:
    scan(client, flagger({"bearingDeg": 180.0}))
    assert overpass.queries[0].count('["highway"="traffic_signals"]') == 1


def test_one_box_query_is_byte_identical_to_the_template() -> None:
    """The extra-box selectors are the template's own lines: a second box
    adds exactly what one box already sends, nothing reworded."""
    box = (39.7, -105.0, 39.8, -104.9)
    template = sd._build_bbox_query(box)
    inner = template.split("(\n", 1)[1].split("\n);", 1)[0] + "\n"
    assert sd._extra_box_selectors([box]) == inner


# ---------------------------------------------------------------------------
# The plan sheet, page 2
# ---------------------------------------------------------------------------


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
def offline_aerial(monkeypatch: pytest.MonkeyPatch) -> list[Any]:
    corridors: list[Any] = []
    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")
    monkeypatch.setattr(ps.httpx, "get", lambda *a, **k: _FakeResponse())
    monkeypatch.setattr(ps, "_validate_corridor_bearing", lambda corridor: None)
    real = ps._fetch_mapbox_aerial

    # #290 commit 7 (RULE 5, stated): the fetch also takes the laid-out
    # approaches now; the wrapper passes them through unchanged.
    def capture(
        lat: float, lng: float, token: str, corridor: Any = None, approaches: Any = None
    ) -> Any:
        corridors.append(corridor)
        return real(lat, lng, token, corridor=corridor, approaches=approaches)

    monkeypatch.setattr(ps, "_fetch_mapbox_aerial", capture)
    return corridors


def _page2(tmp_path, pin_model: str, bearing: float) -> str:
    params = ScenarioParams(
        closure_type="shoulder",
        road_type="urban_low",
        speed_mph=35,
        num_lanes=2,
        lane_width_ft=12.0,
        shoulder_width_ft=8.0,
        work_zone_length_ft=1000.0,
        bearing_deg=bearing,
        pin_model=pin_model,
    )
    out = str(tmp_path / f"{pin_model}.pdf")
    placements = generate_shoulder_closure_undivided(params)
    ps.render_plan_sheet(placements, params, output_path=out, site_lat=PIN[0], site_lng=PIN[1])
    doc = pdfium.PdfDocument(out)
    return doc[1].get_textpage().get_text_range()


def test_page_two_names_the_work_start_and_the_direction(tmp_path, offline_aerial) -> None:
    page2 = _page2(tmp_path, "work_start", 0.0)
    assert "Work starts" in page2
    assert "39.74000, -104.96000" in page2.split("Work starts")[1]
    assert "Direction of travel" in page2
    assert "Anchor" not in page2
    # The drawn work zone starts at the pin and runs north with traffic.
    (corridor,) = offline_aerial
    _down, up = corridor.work_zone_endpoints()
    assert abs(up[0] - PIN[0]) < 1e-6 and abs(up[1] - PIN[1]) < 1e-6


def test_page_two_corridor_end_is_unchanged(tmp_path, offline_aerial) -> None:
    page2 = _page2(tmp_path, "corridor_end", 180.0)
    assert "Anchor" in page2 and "Bearing" in page2
    assert "Work starts" not in page2
    (corridor,) = offline_aerial
    assert (corridor.anchor_lat, corridor.anchor_lng) == PIN
