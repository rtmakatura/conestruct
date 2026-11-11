"""#447: a NEEDS YOU question's map, through the real route.

Authority: validation-artifacts/committed/ux-site-map/rulings.md.  Mapbox and
Overpass are the only fakes; the frame, the overlays and the headers are the
route's own.
"""

from __future__ import annotations

import json
import math
import os
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from src.rendering import static_aerial as sa
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
FIXTURES = Path(__file__).parent / "fixtures" / "corridor"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 16


def fixture(name: str = "broadway-sb") -> dict[str, Any]:
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


def pin(scenario: dict[str, Any]) -> tuple[float, float]:
    return scenario["meta"]["lat"], scenario["meta"]["lng"]


def footway(lat: float, lng: float, *, span: float = 0.0004) -> dict[str, Any]:
    """A way beside the pin, as ``out geom tags`` answers it."""
    return {
        "type": "way",
        "tags": {"highway": "footway"},
        "bounds": {},
        "geometry": [
            {"lat": lat - span / 2, "lon": lng + 0.00005},
            {"lat": lat, "lon": lng + 0.00005},
            {"lat": lat + span / 2, "lon": lng + 0.00005},
        ],
    }


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _clean_memo() -> None:
    sd.clear_subject_memo()


@pytest.fixture()
def overpass(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    state: dict[str, Any] = {"answer": ({"elements": []}, None), "queries": [], "budgets": []}

    def request(query: str, budget_s: float | None = None, **_kw: Any) -> Any:
        state["queries"].append(query)
        state["budgets"].append(budget_s)
        return state["answer"]

    monkeypatch.setattr(sd, "_overpass_request_with_fallback", request)
    return state


class _Png:
    content = PNG

    def raise_for_status(self) -> None:
        return None


@pytest.fixture()
def mapbox(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    requests: list[dict[str, Any]] = []
    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")

    def get(url: str, params: dict[str, str] | None = None, **_kw: Any) -> _Png:
        requests.append({"url": url, "params": dict(params or {})})
        return _Png()

    monkeypatch.setattr(httpx, "get", get)
    return requests


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


def ask(client: TestClient, scenario: dict[str, Any], flag: str = "pedestrian_facility", **kw: Any):
    body = {"scenario": scenario, "flag": flag, "width": 800, "height": 400, **kw}
    return client.post("/render/needs-you-map", headers=AUTH, json=body)


def view(url: str) -> tuple[float, float, float]:
    m = re.search(r"/(-?[\d.]+),(-?[\d.]+),([\d.]+),0/800x400@2x$", url)
    assert m, url
    return float(m.group(2)), float(m.group(1)), float(m.group(3))


def test_the_work_is_solid_and_the_subject_dashed_and_framed_on_it(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    overpass["answer"] = ({"elements": [footway(lat, lng)]}, None)

    r = ask(client, scenario)

    assert r.status_code == 200
    assert r.headers["x-map-subject"] == "drawn"
    url = mapbox[0]["url"]
    assert url.count("+FF8A2E-") >= 1
    assert url.count("path-3+3FD3A8-1(") > 2, "a dash is its own path (X2)"
    assert "pin-s" not in url
    # Ruling 2: centred on the sidewalk, not on the corridor.
    c_lat, c_lng, _z = view(url)
    assert c_lat == pytest.approx(lat, abs=1e-4)
    assert c_lng == pytest.approx(lng + 0.00005, abs=1e-4)
    # Ruling 5: the question's point is on the subject.
    p_lat, p_lng = (float(v) for v in r.headers["x-map-point"].split(","))
    assert p_lat == pytest.approx(lat, abs=1e-5)
    assert p_lng == pytest.approx(lng + 0.00005, abs=1e-5)
    # X1: the map's own read, for the line the scan leaves out.
    assert "out geom tags" in overpass["queries"][0]
    assert overpass["budgets"] == [sd.SUBJECT_BUDGET_S]


def test_a_zoom_step_steps_the_frame_and_does_not_ask_overpass_again(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    overpass["answer"] = ({"elements": [footway(*pin(scenario))]}, None)
    ask(client, scenario)
    ask(client, scenario, zoom=1)
    z0 = view(mapbox[0]["url"])[2]
    z1 = view(mapbox[1]["url"])[2]
    assert z1 == pytest.approx(z0 + 1, abs=0.01)
    assert len(overpass["queries"]) == 1


def test_a_node_subject_is_a_ring_at_the_capped_zoom(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    """A school node still rings; #484 took the ring off the crossing only."""
    scenario = fixture()
    lat, lng = pin(scenario)
    node = {"type": "node", "lat": lat, "lon": lng, "tags": {"amenity": "school"}}
    overpass["answer"] = ({"elements": [node]}, None)

    r = ask(client, scenario, flag="school_zone")

    assert r.headers["x-map-subject"] == "drawn"
    url = mapbox[0]["url"]
    assert url.count("path-3+3FD3A8-1(") == sa.RING_DASHES
    assert view(url)[2] == pytest.approx(sa.SUBJECT_MAX_ZOOM)


# #484 ruling 2: the intersection question draws the cross street as a
# dashed line, named by a tag; never a ring.  rulings.md R145-1 to R145-8.


def signal(lat: float, lng: float) -> dict[str, Any]:
    return {"type": "node", "lat": lat, "lon": lng, "tags": {"highway": "traffic_signals"}}


def road(points: list[tuple[float, float]], **tags: str) -> dict[str, Any]:
    """A vehicular way, as the road lookup's ``out geom tags`` answers it."""
    return {
        "type": "way",
        "tags": {"highway": "residential", **tags},
        "geometry": [{"lat": a, "lon": b} for a, b in points],
    }


def east_west(lat: float, lng: float, *, half: float = 0.0006) -> list[tuple[float, float]]:
    return [(lat, lng - half), (lat, lng), (lat, lng + half)]


@pytest.fixture()
def routed(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """Overpass answering by query: the subject read the crossing, the
    cross-street read (``around:``) the ways; ``ways = None`` refuses it."""
    state: dict[str, Any] = {"node": None, "ways": None, "queries": []}

    def request(query: str, budget_s: float | None = None, **_kw: Any) -> Any:
        state["queries"].append(query)
        if "around:" in query:
            ways = state["ways"]
            return (None, "all mirrors failed") if ways is None else ({"elements": ways}, None)
        return {"elements": [state["node"]]}, None

    monkeypatch.setattr(sd, "_overpass_request_with_fallback", request)
    return state


def test_484_the_crossing_is_the_cross_streets_dashed_line_not_a_ring(
    client: TestClient, mapbox: list[dict[str, Any]], routed: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    routed["node"] = signal(lat + 0.0003, lng)
    # The mainline (Broadway runs north-south here) and the cross street,
    # split at the intersection as OSM splits it.
    mainline = road([(lat - 0.002, lng), (lat + 0.002, lng)], name="Broadway")
    west = road([(lat + 0.0003, lng - 0.0008), (lat + 0.0003, lng)], name="West 1st Avenue")
    east = road([(lat + 0.0003, lng), (lat + 0.0003, lng + 0.0008)], name="West 1st Avenue")
    routed["ways"] = [mainline, west, east]

    r = ask(client, scenario, flag="adjacent_intersection")

    assert r.status_code == 200
    assert r.headers["x-map-subject"] == "drawn"
    url = mapbox[0]["url"]
    assert url.count("path-3+3FD3A8-1(") > sa.RING_DASHES, "a line across the frame, not a ring"
    # Framed on the crossing, as before: the ring's frame and point.
    c_lat, c_lng, z = view(url)
    assert (c_lat, c_lng) == pytest.approx((lat + 0.0003, lng), abs=1e-6)
    assert z == pytest.approx(sa.SUBJECT_MAX_ZOOM)
    assert r.headers["x-map-point"] == f"{lat + 0.0003:.6f},{lng:.6f}"
    # The cross-street read: the crossing's own ways, within the radius.
    road_query = next(q for q in routed["queries"] if "around:" in q)
    assert f"around:{sd.CROSS_STREET_RADIUS_M:.0f},{lat + 0.0003}," in road_query
    assert r.headers["x-map-cross-street"] == "West%201st%20Avenue"
    left, top = (int(v) for v in r.headers["x-map-cross-tag"].split(","))
    width = sa.TAG_CHAR_PX * len("West 1st Avenue") + sa.TAG_CHROME_PX
    assert left >= sa.TAG_EDGE_PX and left + width <= 800 - sa.TAG_EDGE_PX
    assert sa.TAG_EDGE_PX <= top <= 400 - sa.TAG_EDGE_PX - sa.TAG_HEIGHT_PX


def test_484_only_the_mainline_near_the_crossing_draws_no_line(
    client: TestClient, mapbox: list[dict[str, Any]], routed: dict[str, Any]
) -> None:
    """A mid-block crosswalk: the road and a frontage road (R145-3, R145-6)."""
    scenario = fixture()
    lat, lng = pin(scenario)
    routed["node"] = signal(lat, lng)
    routed["ways"] = [
        road([(lat - 0.002, lng), (lat + 0.002, lng)], name="Broadway"),
        road([(lat - 0.002, lng + 0.0001), (lat + 0.002, lng + 0.00012)]),
    ]

    r = ask(client, scenario, flag="adjacent_intersection")

    assert r.headers["x-map-subject"] == "none"
    assert "3FD3A8" not in mapbox[0]["url"]
    assert "x-map-cross-street" not in r.headers and "x-map-cross-tag" not in r.headers


@pytest.mark.parametrize("ways", [None, []], ids=["refused", "nothing"])
def test_484_no_cross_street_geometry_draws_no_line_and_no_ring(
    client: TestClient,
    mapbox: list[dict[str, Any]],
    routed: dict[str, Any],
    ways: list[dict[str, Any]] | None,
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    routed["node"], routed["ways"] = signal(lat, lng), ways

    r = ask(client, scenario, flag="adjacent_intersection")

    assert r.status_code == 200
    assert r.headers["x-map-subject"] == "none"
    assert "3FD3A8" not in mapbox[0]["url"]
    assert "x-map-cross-tag" not in r.headers
    # Still framed on the crossing.
    assert view(mapbox[0]["url"])[:2] == pytest.approx((lat, lng), abs=1e-6)


def test_484_a_far_way_is_not_the_cross_street(
    client: TestClient, mapbox: list[dict[str, Any]], routed: dict[str, Any]
) -> None:
    """Overpass's ``around`` meets a way's bounds; the pick measures the line."""
    scenario = fixture()
    lat, lng = pin(scenario)
    routed["node"] = signal(lat, lng)
    routed["ways"] = [road(east_west(lat + 0.001, lng), name="Next Block Avenue")]
    assert ask(client, scenario, flag="adjacent_intersection").headers["x-map-subject"] == "none"


def test_484_a_refused_cross_street_read_is_not_remembered(
    client: TestClient, mapbox: list[dict[str, Any]], routed: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    routed["node"], routed["ways"] = signal(lat, lng), None
    ask(client, scenario, flag="adjacent_intersection")
    routed["ways"] = [road(east_west(lat, lng), name="Ellsworth Avenue")]
    assert ask(client, scenario, flag="adjacent_intersection").headers["x-map-subject"] == "drawn"


def test_484_a_cross_street_with_no_name_is_drawn_with_no_tag(
    client: TestClient, mapbox: list[dict[str, Any]], routed: dict[str, Any]
) -> None:
    """R145-7: OSM has the line and no name; the tag says nothing it can't."""
    scenario = fixture()
    lat, lng = pin(scenario)
    routed["node"], routed["ways"] = signal(lat, lng), [road(east_west(lat, lng))]

    r = ask(client, scenario, flag="adjacent_intersection")

    assert r.headers["x-map-subject"] == "drawn"
    assert "x-map-cross-street" not in r.headers and "x-map-cross-tag" not in r.headers


def test_484_a_ref_names_it_and_a_name_is_percent_encoded(
    client: TestClient, mapbox: list[dict[str, Any]], routed: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    routed["node"] = signal(lat, lng)
    routed["ways"] = [road(east_west(lat, lng), ref="CO 26")]
    r = ask(client, scenario, flag="adjacent_intersection")
    assert r.headers["x-map-cross-street"] == "CO%2026"
    sd.clear_subject_memo()
    routed["ways"] = [road(east_west(lat, lng), name="Calle Ñandú")]
    r = ask(client, scenario, flag="adjacent_intersection")
    assert r.headers["x-map-cross-street"] == "Calle%20%C3%91and%C3%BA"


def test_484_a_zoom_step_reads_the_cross_street_once(
    client: TestClient, mapbox: list[dict[str, Any]], routed: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    routed["node"] = signal(lat, lng)
    routed["ways"] = [road(east_west(lat, lng), name="Ellsworth Avenue")]
    ask(client, scenario, flag="adjacent_intersection")
    ask(client, scenario, flag="adjacent_intersection", zoom=1)
    assert sum("around:" in q for q in routed["queries"]) == 1


def test_484_the_other_questions_read_no_cross_street(
    client: TestClient, mapbox: list[dict[str, Any]], routed: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    routed["node"] = footway(lat, lng)
    routed["ways"] = [road(east_west(lat, lng), name="Ellsworth Avenue")]
    r = ask(client, scenario)
    assert r.headers["x-map-subject"] == "drawn"
    assert not any("around:" in q for q in routed["queries"])
    assert "x-map-cross-tag" not in r.headers


# #493: the intersection map draws the cross street the WHERE tap found
# (#440), carried on ``meta.intersection.geometry``, with no second Overpass
# read; #484's lookup runs only when no tap record stands at the crossing.
# rulings.md (missions/ux-columns-copy-maps/issue-493) R145-1 to R145-5.

_ROOT = Path(__file__).resolve().parents[1]
# The tap's record on E Colfax, written by the real producer
# (conestruct/site/lib/road-detection/cross-street-tap-record.test.ts).
TAP_RECORD = Path(__file__).parent / "fixtures" / "needs-you" / "colfax-franklin-tap.json"
# #484's own cross-street answer at the crossing, and the recorded ways it
# was derived from (#484 evidence.md, "The local walk").
LOOKUP_484 = (
    _ROOT / "validation-artifacts/committed/missions/ux-token-map-load-edit/issue-484"
    "/overpass-fixture/365beea785c9dba7.json"
)
WHERE_WAYS = (
    _ROOT / "validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture"
    "/c74c32bdc5114bff.json"
)
# Node 7402343541, the crossing #484's walk framed on.
CROSSING = (39.7399691, -104.968354)
# East Colfax Avenue west of Franklin (the permanent check's COLFAX_WEST).
COLFAX_WEST = [1547338997, 1547338998, 223788857, 600545918, 791808880]


def colfax() -> dict[str, Any]:
    """1600 E Colfax Ave, #484's walk, as a work-start scenario: the pin on
    East Colfax Avenue west of Franklin Street, its chain the centerline."""
    elements = json.loads(WHERE_WAYS.read_text(encoding="utf-8"))["elements"]
    chain: list[list[float]] = []
    for way_id in COLFAX_WEST:
        way = next(e for e in elements if e.get("type") == "way" and e["id"] == way_id)
        for p in way["geometry"]:
            point = [p["lat"], p["lon"]]
            if not chain or chain[-1] != point:
                chain.append(point)
    scenario = fixture()
    meta = scenario["meta"]
    meta.pop("confirmedRoad", None)
    # The chain's vertex nearest 60 m west of the crossing.
    want = (CROSSING[0], CROSSING[1] - 60 / 85_000)
    lat, lng = min(chain, key=lambda p: sd._haversine(p[0], p[1], *want))
    meta.update(
        lat=lat,
        lng=lng,
        centerline=chain,
        roadName="East Colfax Avenue",
        roadDirection={"osmBearingDeg": 90.0, "oneway": None},
        intersection=None,
    )
    return scenario


def tap_record() -> dict[str, Any]:
    record: dict[str, Any] = json.loads(TAP_RECORD.read_text(encoding="utf-8"))
    return record


@pytest.fixture()
def colfax_overpass(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """The subject read answers the crossing; #484's cross-street read
    (``around:``) answers its committed fixture."""
    state: dict[str, Any] = {"queries": []}
    lookup = json.loads(LOOKUP_484.read_text(encoding="utf-8"))

    def request(query: str, budget_s: float | None = None, **_kw: Any) -> Any:
        state["queries"].append(query)
        if "around:" in query:
            return lookup, None
        return {"elements": [signal(*CROSSING)]}, None

    monkeypatch.setattr(sd, "_overpass_request_with_fallback", request)
    return state


def cross_reads(state: dict[str, Any]) -> int:
    return sum("around:" in q for q in state["queries"])


def test_493_a_tap_record_draws_the_cross_street_with_no_overpass_read(
    client: TestClient, mapbox: list[dict[str, Any]], colfax_overpass: dict[str, Any]
) -> None:
    scenario = colfax()
    scenario["meta"]["intersection"] = tap_record()

    r = ask(client, scenario, flag="adjacent_intersection")

    assert r.status_code == 200
    assert cross_reads(colfax_overpass) == 0, "the tap's line, not a second lookup"
    assert r.headers["x-map-cross-source"] == "tap"
    assert r.headers["x-map-subject"] == "drawn"
    assert r.headers["x-map-cross-street"] == "Franklin%20Street"
    assert "x-map-cross-tag" in r.headers


# (width, height, #484's lookup tag, the tap's tag).  The lookup's 846x423
# tag is #484's own local walk's place at 1440 (#484 evidence.md); there the
# tap's line runs further along Franklin, so its tag sits 8 px lower.
COLFAX_SIZES = [
    (800, 400, "375,344", "375,344"),
    (846, 423, "397,360", "397,368"),
    (390, 292, "170,182", "170,182"),
]


@pytest.mark.parametrize(("width", "height", "lookup_tag", "tap_tag"), COLFAX_SIZES)
def test_493_the_tap_picture_matches_484s_lookup_on_e_colfax(
    client: TestClient,
    mapbox: list[dict[str, Any]],
    colfax_overpass: dict[str, Any],
    width: int,
    height: int,
    lookup_tag: str,
    tap_tag: str,
) -> None:
    """R145-5: the same frame, point and name, the tag where the table says,
    and every dash #484's lookup drew lies on the tap's line."""
    from src.rules.corridor import _project_onto_segment_m

    size = {"width": width, "height": height}
    lookup = ask(client, colfax(), flag="adjacent_intersection", **size)
    assert cross_reads(colfax_overpass) == 1
    assert lookup.headers["x-map-cross-source"] == "lookup"
    sd.clear_subject_memo()
    scenario = colfax()
    scenario["meta"]["intersection"] = tap_record()
    tap = ask(client, scenario, flag="adjacent_intersection", **size)
    assert cross_reads(colfax_overpass) == 1
    assert tap.headers["x-map-cross-source"] == "tap"

    for header in ("x-map-subject", "x-map-point", "x-map-frame", "x-map-cross-street"):
        assert tap.headers[header] == lookup.headers[header], header
    assert lookup.headers["x-map-cross-street"] == "Franklin%20Street"
    assert lookup.headers["x-map-cross-tag"] == lookup_tag
    assert tap.headers["x-map-cross-tag"] == tap_tag

    # #484's lines, as its pick made them from its fixture.
    elements = json.loads(LOOKUP_484.read_text(encoding="utf-8"))["elements"]
    found = sd.cross_street_from_elements(elements, CROSSING, 90.0, "East Colfax Avenue")
    assert found is not None and found.name == "Franklin Street"
    lat, lng, z = frame_of(tap)
    tap_line = [(p[0], p[1]) for p in tap_record()["geometry"]]
    ends = [
        q
        for line in found.lines
        for dash in sa._dashes(line, (lat, lng), z, width, height)
        for q in dash
    ]
    assert ends
    for q in ends:
        off = min(
            _project_onto_segment_m(q[0], q[1], a[0], a[1], b[0], b[1])[0]
            for a, b in zip(tap_line, tap_line[1:], strict=False)
            if a != b
        )
        assert off < 0.5, f"a #484 dash {off:.2f} m off the tap's line"
    # The tap draws at least #484's dashes: the same street, reaching further.
    drawn = [m["url"].count("path-3+3FD3A8-1(") for m in mapbox]
    assert drawn[1] >= drawn[0] > 0


def test_493_at_an_offset_crossing_the_tapped_street_is_drawn(
    client: TestClient, mapbox: list[dict[str, Any]], colfax_overpass: dict[str, Any]
) -> None:
    """Two cross streets within 30 m (Franklin, and a second street the
    operator tapped): the tapped one is drawn, not the lookup's nearest."""
    scenario = colfax()
    lat, lng = CROSSING
    tapped = {
        "lat": lat,
        "lng": lng + 0.0001,
        "name": "Offset Street",
        "geometry": [[lat - 0.0008, lng + 0.0002], [lat + 0.0008, lng + 0.0002]],
    }
    scenario["meta"]["intersection"] = tapped

    r = ask(client, scenario, flag="adjacent_intersection")

    assert cross_reads(colfax_overpass) == 0
    assert r.headers["x-map-cross-source"] == "tap"
    assert r.headers["x-map-cross-street"] == "Offset%20Street"


@pytest.mark.parametrize(
    "record",
    [
        None,
        "no line",
        "another crossing",
        "the mainline",
    ],
)
def test_493_with_no_tap_record_at_the_crossing_the_lookup_runs_and_says_so(
    client: TestClient,
    mapbox: list[dict[str, Any]],
    colfax_overpass: dict[str, Any],
    record: str | None,
) -> None:
    scenario = colfax()
    tapped = tap_record()
    if record == "no line":
        tapped.pop("geometry")
    elif record == "another crossing":
        # A tap one block east: its own line, not this crossing's.
        tapped["lng"] += 0.0012
        tapped["geometry"] = [[p[0], p[1] + 0.0012] for p in tapped["geometry"]]
    elif record == "the mainline":
        tapped["geometry"] = scenario["meta"]["centerline"]
    scenario["meta"]["intersection"] = None if record is None else tapped

    r = ask(client, scenario, flag="adjacent_intersection")

    assert r.status_code == 200
    assert cross_reads(colfax_overpass) == 1
    assert r.headers["x-map-cross-source"] == "lookup"
    assert r.headers["x-map-cross-street"] == "Franklin%20Street"


def test_493_the_soft_image_and_the_other_questions_say_no_source(
    client: TestClient, mapbox: list[dict[str, Any]], colfax_overpass: dict[str, Any]
) -> None:
    scenario = colfax()
    scenario["meta"]["intersection"] = tap_record()
    soft = ask(client, scenario, flag="adjacent_intersection", soft=True)
    other = ask(client, scenario)
    assert "x-map-cross-source" not in soft.headers
    assert "x-map-cross-source" not in other.headers
    assert cross_reads(colfax_overpass) == 0


def bad_lines() -> list[Any]:
    long = [[CROSSING[0] + i * 1e-6, CROSSING[1]] for i in range(301)]
    # A JSON integer past float range: float() would raise OverflowError.
    huge = [[10**400, 0], [0, 0]]
    return [
        long,
        [[CROSSING[0], 200.0], [CROSSING[0], CROSSING[1]]],
        [[1.0, 2.0, 3.0]],
        "line",
        huge,
    ]


BAD_LINE_IDS = ["301 points", "out of range", "triple", "text", "past float range"]


@pytest.mark.parametrize("line", bad_lines(), ids=BAD_LINE_IDS)
def test_493_an_unusable_line_is_dropped_and_the_lookup_runs_never_a_refusal(
    client: TestClient,
    mapbox: list[dict[str, Any]],
    colfax_overpass: dict[str, Any],
    line: Any,
) -> None:
    """R145-4: the optional line never refuses a plan."""
    scenario = colfax()
    tapped = tap_record()
    tapped["geometry"] = line
    scenario["meta"]["intersection"] = tapped

    r = ask(client, scenario, flag="adjacent_intersection")

    assert r.status_code == 200
    assert r.headers["x-map-cross-source"] == "lookup"
    assert cross_reads(colfax_overpass) == 1
    # The fixture's own 20-point line, sliced at the 300 cap, still draws from the tap.
    sd.clear_subject_memo()
    tapped["geometry"] = tap_record()["geometry"][:300]
    assert (
        ask(client, scenario, flag="adjacent_intersection").headers["x-map-cross-source"] == "tap"
    )


@pytest.mark.parametrize("bad", [0, 4], ids=["301 points", "past float range"])
def test_493_an_unusable_line_never_refuses_the_audit_or_the_plan(
    client: TestClient, mapbox: list[dict[str, Any]], colfax_overpass: dict[str, Any], bad: int
) -> None:
    """The line rides ``meta`` into every route: a saved plan with a 301-point
    line, or one past float range, still renders its audit and its plan, as
    with no line.  (The PDF's aerial needs real Mapbox bytes; /render/markdown and /render/xlsx read
    the same Scenario model.)"""
    from src.api.schemas import IntersectionPin

    scenario = colfax()
    tapped = tap_record()
    tapped["geometry"] = bad_lines()[bad]
    scenario["meta"]["intersection"] = tapped
    assert IntersectionPin.model_validate(tapped).geometry is None
    plain = colfax()
    plain["meta"]["intersection"] = {k: v for k, v in tapped.items() if k != "geometry"}
    for route in ("/render/audit", "/render/markdown", "/render/xlsx"):
        got = client.post(route, headers=AUTH, json=scenario)
        want = client.post(route, headers=AUTH, json=plain)
        assert got.status_code == want.status_code == 200, (route, got.text[:200])
    audit_got = client.post("/render/audit", headers=AUTH, json=scenario).json()
    audit_want = client.post("/render/audit", headers=AUTH, json=plain).json()
    assert audit_got == audit_want


@pytest.mark.parametrize(("width", "height"), [(800, 400), (757, 360), (390, 292)])
def test_484_the_tag_is_inside_the_frame_and_clear_of_the_work_and_the_controls(
    width: int, height: int
) -> None:
    """XB: beside the line, away from the work, clear of the zoom buttons
    (top right), the street-level link (bottom right) and the attribution."""
    from src.api.render_api import (
        _NEEDS_YOU_MAP_ADAPTER,
        _laid_out,
        _read_placements,
        _read_scenario,
    )
    from src.api.schemas import scenario_to_call

    scenario = fixture()
    lat, lng = pin(scenario)
    body = {"scenario": scenario, "flag": "adjacent_intersection", "width": 800, "height": 400}
    model, _refused = _read_scenario(_NEEDS_YOU_MAP_ADAPTER.validate_python(body).scenario)
    params, _g, _k = scenario_to_call(model, place_cross_street=False)
    _p, approaches = _laid_out(params, lat, lng, placements=_read_placements(model))
    _url, _q, _pt, _drawn, frame = sa.question_image_url(
        lat, lng, approaches, [[(lat, lng)]], width=width, height=height
    )
    name = "Ellsworth Avenue"
    line = [(lat, lng - 0.003), (lat, lng + 0.003)]
    box = sa.cross_tag_box([line], approaches, frame, name, width=width, height=height)
    assert box is not None
    left, top = box
    w, h = sa.TAG_CHAR_PX * len(name) + sa.TAG_CHROME_PX, sa.TAG_HEIGHT_PX
    assert left >= sa.TAG_EDGE_PX - 1 and left + w <= width - sa.TAG_EDGE_PX + 1
    assert top >= sa.TAG_EDGE_PX - 1 and top + h <= height - sa.TAG_EDGE_PX + 1
    assert not (left + w > width - 60 and top < 104), "under the zoom buttons"
    assert not (left + w > width - 256 and top + h > height - 80), "under the street link"
    # Beside the line (12 px off it), not on it.
    line_y = sa._frame_px(line[0], frame, width, height)[1]
    assert top <= line_y <= top + h


def test_484_no_clear_place_sends_no_tag() -> None:
    """A frame too small to hold the tag clear of everything: no tag (R145-8)."""
    from src.api.render_api import (
        _NEEDS_YOU_MAP_ADAPTER,
        _laid_out,
        _read_placements,
        _read_scenario,
    )
    from src.api.schemas import scenario_to_call

    scenario = fixture()
    lat, lng = pin(scenario)
    body = {"scenario": scenario, "flag": "adjacent_intersection", "width": 800, "height": 400}
    model, _refused = _read_scenario(_NEEDS_YOU_MAP_ADAPTER.validate_python(body).scenario)
    params, _g, _k = scenario_to_call(model, place_cross_street=False)
    _p, approaches = _laid_out(params, lat, lng, placements=_read_placements(model))
    _url, _q, _pt, _drawn, frame = sa.question_image_url(
        lat, lng, approaches, [[(lat, lng)]], width=120, height=80
    )
    line = [(lat, lng - 0.003), (lat, lng + 0.003)]
    assert sa.cross_tag_box([line], approaches, frame, "A" * 40, width=120, height=80) is None


# #487: the tag sits only beside dashes the image has, and the worked road
# is the worked road under any abbreviation.  rulings.md (#487) R145-1/2.


def _tag_beside(
    tag: tuple[int, int],
    line: list[tuple[float, float]],
    frame: tuple[float, float, float],
    name: str,
) -> bool:
    """The tag box is cross_tag_box's place beside some point of ``line``."""
    tag_w = sa.TAG_CHAR_PX * len(name) + sa.TAG_CHROME_PX
    px = sa._walk([sa._frame_px(p, frame, 800, 400) for p in line], sa._TAG_STEP_PX)
    return any(
        abs(tag[1] - (y - sa.TAG_HEIGHT_PX / 2)) <= 1
        and min(abs(tag[0] - (x + sa.TAG_GAP_PX)), abs(tag[0] - (x - sa.TAG_GAP_PX - tag_w))) <= 1
        for x, y in px
    )


def test_487_the_tag_is_never_beside_a_part_the_url_left_out(
    client: TestClient, mapbox: list[dict[str, Any]], routed: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    node = (lat + 0.0003, lng)
    routed["node"] = signal(*node)
    # The nearest part runs west; the other parts run east, so many and so
    # long that the URL budget leaves the farthest out.
    near = road([(node[0], lng - 0.0008), node], name="Park Avenue")
    far = [
        road(
            [(node[0] + i * 0.00001, lng + 0.00002), (node[0] + i * 0.00001, lng + 0.003)],
            name="Park Avenue",
        )
        for i in range(1, 25)
    ]
    mainline = road([(lat - 0.002, lng), (lat + 0.002, lng)], name="Broadway")
    routed["ways"] = [mainline, near, *far]

    r = ask(client, scenario, flag="adjacent_intersection")

    url = mapbox[0]["url"]
    c_lat, c_lng, z = (float(v) for v in r.headers["x-map-frame"].split(","))
    frame = (c_lat, c_lng, z)

    def in_url(way: dict[str, Any]) -> bool:
        line = [(p["lat"], p["lon"]) for p in way["geometry"]]
        dashes = sa._dashes(line, (c_lat, c_lng), z, 800, 400)
        return bool(dashes) and all(sa._dash_path(a, b) in url for a, b in dashes)

    left_out = [w for w in far if not in_url(w)]
    assert left_out, "the budget left at least one part out"
    assert in_url(near)
    assert r.headers["x-map-cross-street"] == "Park%20Avenue"
    left, top = (int(v) for v in r.headers["x-map-cross-tag"].split(","))
    drawn = [w for w in [near, *far] if in_url(w)]
    lines = [[(p["lat"], p["lon"]) for p in w["geometry"]] for w in drawn]
    assert any(_tag_beside((left, top), ln, frame, "Park Avenue") for ln in lines)


def test_487_an_abbreviated_mainline_on_a_curve_is_not_the_cross_street(
    client: TestClient, mapbox: list[dict[str, Any]], routed: dict[str, Any]
) -> None:
    """The plan says "S Broadway", OSM "South Broadway", and the road bends
    40° at the crossing: the bend is the road, not the cross street."""
    scenario = fixture()
    scenario["meta"]["roadName"] = "S Broadway"
    lat, lng = pin(scenario)
    bend = (lat + 0.0003, lng)
    # 40° east of north from the bend, past 25° (CROSS_STREET_PARALLEL_DEG).
    d_lat, d_lng = 0.0006 * math.cos(math.radians(40)), 0.0006 * math.sin(math.radians(40))
    d_lng /= math.cos(math.radians(lat))
    curve = road(
        [(lat - 0.002, lng), bend, (bend[0] + d_lat, bend[1] + d_lng)], name="South Broadway"
    )
    node = (bend[0] + d_lat / 20, bend[1] + d_lng / 20)
    routed["node"] = signal(*node)
    cross = road(
        [(node[0] + 0.00012, lng - 0.0008), (node[0] + 0.00012, lng + 0.0008)],
        name="West 1st Avenue",
    )
    routed["ways"] = [curve, cross]

    r = ask(client, scenario, flag="adjacent_intersection")

    assert r.headers["x-map-subject"] == "drawn"
    assert r.headers.get("x-map-cross-street") != "South%20Broadway"
    found = sd.cross_street_from_elements([curve, cross], node, 180.49, "S Broadway")
    assert found is not None and found.name == "West 1st Avenue"


@pytest.mark.parametrize(
    ("a", "b", "same"),
    [
        ("E Colfax Ave", "East Colfax Avenue", True),
        ("W. 1st St.", "West 1st Street", True),
        ("Martin Luther King Jr Blvd", "martin luther king jr boulevard", True),
        ("E 1st Ave", "W 1st Ave", False),
        ("Park Ave", "Park Place", False),
        ("Улица Ленина", "Проспект Мира", False),
        ("Calle José", "Calle Josè", False),
        ("Calle José", "calle josé", True),
        ("!!!", "???", False),
        # Decomposed accents (NFD) are letters, not punctuation; full-width
        # digits are digits.
        ("Calle José", "Calle Josè", False),
        ("Calle José", "Calle José", True),
        ("１st Ave", "1st Ave", True),
    ],
)
def test_487_the_street_key(a: str, b: str, same: bool) -> None:
    assert (sd._street_key(a) == sd._street_key(b)) is same


@pytest.mark.parametrize("blank", ["", "   ", None])
def test_487_a_blank_road_name_drops_no_way_and_groups_no_part(blank: str | None) -> None:
    """An empty key never matches: the bearing test alone drops the road."""
    assert sd._street_key(blank) == ""
    node = (39.7340, -104.9875)
    a = road([(node[0], node[1] - 0.0008), node], name="Улица Ленина")
    b = road([node, (node[0], node[1] + 0.0008)], name="Проспект Мира")
    found = sd.cross_street_from_elements([a, b], node, 0.0, blank)
    assert found is not None and len(found.lines) == 1, "one street, not two grouped"


def test_other_questions_still_draw_every_feature(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    overpass["answer"] = ({"elements": [footway(lat, lng), footway(lat, lng + 0.0001)]}, None)
    ask(client, scenario)
    one = mapbox[0]["url"].count("path-3+3FD3A8-1(")
    sd.clear_subject_memo()
    overpass["answer"] = ({"elements": [footway(lat, lng)]}, None)
    ask(client, scenario)
    assert one > mapbox[1]["url"].count("path-3+3FD3A8-1(")


@pytest.mark.parametrize(
    "answer", [({"elements": []}, None), (None, "all mirrors failed")], ids=["none", "down"]
)
def test_no_geometry_draws_no_line_and_shows_the_work_zone(
    client: TestClient,
    mapbox: list[dict[str, Any]],
    overpass: dict[str, Any],
    answer: tuple[Any, Any],
) -> None:
    overpass["answer"] = answer
    r = ask(client, fixture())
    assert r.status_code == 200
    assert r.headers["x-map-subject"] == "none"
    url = mapbox[0]["url"]
    assert "3FD3A8" not in url
    assert url.count("+FF8A2E-") >= 1


def test_a_failed_read_is_not_remembered(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    overpass["answer"] = (None, "down")
    ask(client, scenario)
    overpass["answer"] = ({"elements": [footway(*pin(scenario))]}, None)
    assert ask(client, scenario).headers["x-map-subject"] == "drawn"
    assert len(mapbox) == 2


def test_what_the_scan_would_not_count_is_not_drawn(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    far = footway(lat + 0.05, lng + 0.05)
    other_bucket = {
        "type": "way",
        "tags": {"highway": "cycleway"},
        "geometry": footway(lat, lng)["geometry"],
    }
    overpass["answer"] = ({"elements": [far, other_bucket]}, None)
    r = ask(client, scenario)
    assert r.headers["x-map-subject"] == "none"
    assert "3FD3A8" not in mapbox[0]["url"]


def test_a_malformed_answer_costs_the_line_not_the_picture(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    overpass["answer"] = ({"elements": ["not a dict"]}, None)
    r = ask(client, fixture())
    assert r.status_code == 200
    assert r.headers["x-map-subject"] == "none"


def test_the_url_stays_under_the_cap_and_the_nearest_stay(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    many = [footway(lat + i * 0.00002, lng, span=0.004) for i in range(30)]
    overpass["answer"] = ({"elements": many}, None)
    r = ask(client, scenario)
    assert r.headers["x-map-subject"] == "drawn"
    assert len(mapbox[0]["url"]) < sa.URL_MAX_CHARS


def test_an_unlaid_plan_gets_the_pin_picture_and_no_lines(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    scenario["meta"].pop("work")
    lat, lng = pin(scenario)
    r = ask(client, scenario)
    assert r.status_code == 200
    assert r.headers["x-map-subject"] == "none"
    assert r.headers["x-map-point"] == f"{lat:.6f},{lng:.6f}"
    assert "path-" not in mapbox[0]["url"]
    assert overpass["queries"] == []


def test_refusals_answer_json_like_the_band(
    client: TestClient,
    mapbox: list[dict[str, Any]],
    overpass: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    no_pin = fixture()
    no_pin["meta"]["lat"] = 0
    r = ask(client, no_pin)
    assert (r.status_code, r.json()["status"]) == (409, "no_pin")

    assert ask(client, fixture(), flag="not_a_question").status_code == 422
    assert ask(client, fixture(), zoom=4).status_code == 422

    def boom(*_a: Any, **_kw: Any) -> None:
        raise httpx.ConnectError("no route")

    monkeypatch.setattr(httpx, "get", boom)
    r = ask(client, fixture())
    assert (r.status_code, r.json()["status"]) == (502, "unavailable")

    monkeypatch.setenv("MAPBOX_TOKEN", "")
    r = ask(client, fixture())
    assert (r.status_code, r.json()["status"]) == (503, "unavailable")


@pytest.mark.parametrize(
    ("bucket", "tags"),
    [
        ("intersections", {"highway": "traffic_signals"}),
        ("intersections", {"highway": "crossing"}),
        ("sidewalks", {"highway": "footway"}),
        ("sidewalks", {"footway": "sidewalk"}),
        ("bike_facilities", {"highway": "cycleway"}),
        ("bike_facilities", {"cycleway": "lane"}),
        ("schools", {"amenity": "school"}),
        ("interchanges", {"highway": "motorway_junction"}),
        ("interchanges", {"highway": "motorway_link"}),
        ("interchanges", {"highway": "trunk_link"}),
        ("interchanges", {"bridge": "yes"}),
    ],
)
def test_each_questions_selectors_are_the_scans_own(bucket: str, tags: dict[str, str]) -> None:
    assert sd._categorize({"tags": tags}) == bucket
    key, value = next(iter(tags.items()))
    selectors = sd._SUBJECT_SELECTORS[bucket]
    assert set(selectors) <= set(sd._SCAN_SELECTORS)
    wanted = f'["{key}"="{value}"]'
    assert any(wanted in s or f'["{key}"];' in s for s in selectors)


def test_the_token_stays_on_the_backend(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    r = ask(client, fixture())
    assert "test-token" not in json.dumps(dict(r.headers))
    assert mapbox[0]["params"] == {"access_token": "test-token"}


# #483 ruling 1: the soft image is the full image's frame, from the same
# backend frame (Rule 3).  rulings.md R145-1, R145-2.


def soft_view(url: str) -> tuple[float, float, float]:
    """The soft image's centre and zoom: @1x, the same CSS size, nothing drawn."""
    m = re.search(r"/static/(-?[\d.]+),(-?[\d.]+),([\d.]+),0/800x400$", url)
    assert m, url
    return float(m.group(2)), float(m.group(1)), float(m.group(3))


def frame_of(r: Any) -> tuple[float, float, float]:
    lat, lng, z = (float(v) for v in r.headers["x-map-frame"].split(","))
    return lat, lng, z


@pytest.mark.parametrize("flag", ["pedestrian_facility", "adjacent_intersection"])
def test_483_the_soft_image_is_the_full_images_frame_with_nothing_drawn(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any], flag: str
) -> None:
    scenario = fixture()
    lat, lng = pin(scenario)
    node = {"type": "node", "lat": lat, "lon": lng, "tags": {"highway": "traffic_signals"}}
    subject = footway(lat, lng) if flag == "pedestrian_facility" else node
    overpass["answer"] = ({"elements": [subject]}, None)

    soft = ask(client, scenario, flag=flag, soft=True)
    full = ask(client, scenario, flag=flag)

    assert (soft.status_code, full.status_code) == (200, 200)
    assert soft.headers["x-map-frame"] == full.headers["x-map-frame"]
    soft_url, full_url = mapbox[0]["url"], mapbox[1]["url"]
    assert soft_view(soft_url) == pytest.approx(view(full_url), abs=1e-6)
    assert frame_of(full) == pytest.approx(view(full_url), abs=1e-6)
    assert "path-" not in soft_url and "pin-" not in soft_url and "@2x" not in soft_url
    # R145-3: one subject read for both, the full one reuses the memo.  #484:
    # the intersection's full image also asks its cross street; the soft
    # one asks nothing more.
    roads = [q for q in overpass["queries"] if "around:" in q]
    assert len(overpass["queries"]) - len(roads) == 1
    assert len(roads) == (flag == "adjacent_intersection")
    # The soft image says nothing about what was drawn on it.
    assert soft.headers["x-map-subject"] == "none"


def test_483_the_pin_picture_soft_is_the_pins_frame(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    scenario["meta"].pop("work")
    lat, lng = pin(scenario)
    soft = ask(client, scenario, soft=True)
    full = ask(client, scenario)
    assert soft.headers["x-map-frame"] == full.headers["x-map-frame"]
    assert frame_of(full) == pytest.approx((lat, lng, sa.PIN_ZOOM), abs=1e-6)
    assert soft_view(mapbox[0]["url"]) == pytest.approx((lat, lng, sa.PIN_ZOOM), abs=1e-6)
    assert "pin-" in mapbox[1]["url"] and "pin-" not in mapbox[0]["url"]


def test_483_the_full_image_is_unchanged_by_the_soft_one(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    scenario = fixture()
    overpass["answer"] = ({"elements": [footway(*pin(scenario))]}, None)
    ask(client, scenario)
    sd.clear_subject_memo()
    ask(client, scenario, soft=True)
    ask(client, scenario, soft=False)
    assert mapbox[2] == mapbox[0]


def test_483_soft_must_be_a_boolean(
    client: TestClient, mapbox: list[dict[str, Any]], overpass: dict[str, Any]
) -> None:
    assert ask(client, fixture(), soft="yes please").status_code == 422


# #493 gate round 1: the tap path tells the worked road the way #487's
# lookup path does (_street_key), so an abbreviation is still the road.
@pytest.mark.parametrize(
    ("tapped_name", "drawn"),
    [("E Colfax Ave", False), ("E. Colfax Ave.", False), ("North Franklin Street", True)],
)
def test_493_a_tapped_line_at_a_bend_named_as_the_road_is_not_the_cross_street(
    tapped_name: str, drawn: bool
) -> None:
    """The road is "East Colfax Avenue", bearing 90°; the tapped line bends
    40° off it (past 25°, CROSS_STREET_PARALLEL_DEG) and lies on the node."""
    node = (39.7400, -104.9660)
    d_lat = 0.0004 * math.cos(math.radians(130))
    d_lng = 0.0004 * math.sin(math.radians(130)) / math.cos(math.radians(node[0]))
    line = [(node[0] - d_lat, node[1] - d_lng), (node[0] + d_lat, node[1] + d_lng)]
    found = sd.tapped_cross_street(node, tapped_name, line, node, 90.0, "East Colfax Avenue")
    assert (found is not None) is drawn
    if drawn:
        assert found is not None and found.name == tapped_name
