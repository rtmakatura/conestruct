"""#290 (k) commit 4 — the fixtures' work-start twins, and the single-leaf proof.

Ruling 10: pre-change fixtures are never silently re-read, so each keeps
its corridor_end meaning, byte for byte, and gains a TWIN written by a
stated conversion (validation-artifacts/committed/issue-290-pin-work/
convert/make_twins.py): the pin on the plan's own work start, the direction
the recorded bearing's reciprocal, side right.

The single-leaf proof, on ``scanned-ok`` first: the twin must be the same
plan.  What is identical and what moves is asserted exactly —

* the plan (the summary the device list, counts and quote are built from)
  and the scan's flags: identical;
* the page-1 sheet text: identical but for the one COORDINATES line (the
  pin is a different point by design);
* the scan's stations: every listed feature moves by exactly +50 ft, zone
  and relevance unchanged.  The old scan frame took the §6B.08 ceiling
  (100 ft) for the downstream taper at the PIN, so its work zone sat 50 ft
  away from the plan's (floor, 50 ft, #257); the work-start frame puts both
  on the work.  One crossing 256 ft past the old frame's end (outside the
  250 ft tolerance) sits 206 ft past the new one and now counts: the
  intersection count goes 26 -> 27 with the flag already set.

Lookout Mountain re-records on the centerline (ruling 10): its twin, walked
along the road, reproduces the recorded corridor.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium
import pytest
from fastapi.testclient import TestClient

from src.api import site_scan as ss
from src.rules import site_detection as sd
from src.rules.corridor import _haversine_m, build_corridor, travel_bearing_at

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
PDF_DIR = Path(__file__).parent / "fixtures" / "pdf_worst_case"
CENTERLINE_DIR = Path(__file__).parent / "fixtures" / "centerline"
PAYLOAD = json.loads(
    (Path(__file__).parent / "fixtures" / "site_scan" / "lakewood_overpass.json").read_text(
        encoding="utf-8"
    )
)
SCANNED = ("scanned-ok", "scanned-not-checked", "scanned-dismissed", "scanned-asserted")


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


def fixture(name: str) -> dict[str, Any]:
    return json.loads((PDF_DIR / f"{name}.json").read_text(encoding="utf-8"))


def stub(monkeypatch: pytest.MonkeyPatch, name: str) -> None:
    ss.clear_memo()
    if fixture(name)["_provenance"]["overpass"] == "recorded":
        monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda q, **_k: (PAYLOAD, None))
    else:
        monkeypatch.setattr(
            sd, "_overpass_request_with_fallback", lambda q, **_k: (None, "stub: mirrors down")
        )


def audit(client: TestClient, monkeypatch: pytest.MonkeyPatch, name: str) -> dict[str, Any]:
    stub(monkeypatch, name)
    res = client.post("/render/audit", headers=AUTH, json=fixture(name)["scenario"])
    assert res.status_code == 200, res.text[:300]
    return res.json()


# ---------------------------------------------------------------------------
# The twins are what the conversion says they are
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("name", SCANNED)
def test_the_twin_says_the_same_plan_in_the_new_model(name: str) -> None:
    src, twin = fixture(name), fixture(f"{name}-work-start")
    a, b = src["scenario"], twin["scenario"]
    assert "pinModel" not in a["meta"], "the original keeps its corridor_end meaning"
    assert b["meta"]["pinModel"] == "work_start"
    assert "bearingDeg" not in b["meta"]
    assert b["meta"]["work"] == {"side": "right", "heading": "N"}  # 180 + 180
    assert {k: v for k, v in a.items() if k != "meta"} == {
        k: v for k, v in b.items() if k != "meta"
    }
    # The pin moved to the plan's work start: D 50 (the placed floor) + W
    # along 180.
    moved_ft = _haversine_m(a["meta"]["lat"], a["meta"]["lng"], b["meta"]["lat"], b["meta"]["lng"])
    assert moved_ft / 0.3048 == pytest.approx(50.0 + a["workLen"], abs=0.01)
    assert b["meta"]["lat"] < a["meta"]["lat"]
    assert twin["_provenance"]["twin_of"] == f"{name}.json"


# ---------------------------------------------------------------------------
# The single-leaf proof: scanned-ok
# ---------------------------------------------------------------------------


def test_leaf_the_plan_and_the_flags_are_identical(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    v1 = audit(client, monkeypatch, "scanned-ok")
    v2 = audit(client, monkeypatch, "scanned-ok-work-start")
    assert v1["summary"] == v2["summary"]
    assert v1["plan_flags"] == v2["plan_flags"]
    assert v1["sections"]["site_scan"]["flags"] == v2["sections"]["site_scan"]["flags"]
    assert v1["pin"] == {"model": "corridor_end"}
    assert v2["pin"] == {"model": "work_start"}


def test_leaf_the_scan_frame_moves_exactly_the_ceiling_minus_the_floor(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    s1 = audit(client, monkeypatch, "scanned-ok")["sections"]["site_scan"]
    s2 = audit(client, monkeypatch, "scanned-ok-work-start")["sections"]["site_scan"]
    for bucket, b1 in s1["buckets"].items():
        b2 = s2["buckets"][bucket]
        assert len(b1["features"]) == len(b2["features"]), bucket
        for f1, f2 in zip(b1["features"], b2["features"], strict=True):
            assert (f1["label"], f1["zone"], f1["relevant"]) == (
                f2["label"],
                f2["zone"],
                f2["relevant"],
            ), bucket
            if f1["along_station_ft"] is not None:
                assert f2["along_station_ft"] - f1["along_station_ft"] == pytest.approx(
                    50.0, abs=0.2
                ), (bucket, f1["label"])
        if bucket != "intersections":
            assert b1["count"] == b2["count"], bucket
    assert (s1["buckets"]["intersections"]["count"], s2["buckets"]["intersections"]["count"]) == (
        26,
        27,
    )


def test_leaf_the_one_crossing_that_now_counts(client: TestClient) -> None:
    """Named, not waved at: 39.7120, -105.0817 — 256 ft past the old scan
    frame's downstream end, 206 ft past the new one; 250 ft is the bucket's
    CHOSEN tolerance (site_detection.py)."""
    kw = dict(
        speed_mph=45,
        work_zone_ft=1000.0,
        closure_type="shoulder",
        road_type="urban_high",
        lane_width_ft=12.0,
        shoulder_width_ft=10.0,
        downstream_taper_use_max=True,
    )
    twin = fixture("scanned-ok-work-start")["scenario"]["meta"]
    v1 = build_corridor(lat=39.7113, lng=-105.0815, bearing_deg=180.0, **kw)
    v2 = build_corridor(
        lat=twin["lat"], lng=twin["lng"], bearing_deg=0.0, pin_model="work_start", **kw
    )
    changed = []
    for el in PAYLOAD["elements"]:
        coord = sd._element_coord(el)
        if sd._categorize(el) != "intersections" or coord is None:
            continue
        a = sd._classified("intersections", v1, coord)
        b = sd._classified("intersections", v2, coord)
        if a["relevant"] != b["relevant"]:
            changed.append((sd._label_for(el), a["along_station_ft"], b["along_station_ft"]))
    assert changed == [("unnamed at 39.7120, -105.0817", -256.0, -206.0)]


def test_leaf_the_sheet_differs_only_in_the_pin(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    texts = []
    for name in ("scanned-ok", "scanned-ok-work-start"):
        stub(monkeypatch, name)
        res = client.post("/render/pdf", headers=AUTH, json=fixture(name)["scenario"])
        assert res.status_code == 200, res.text[:300]
        path = tmp_path / f"{name}.pdf"
        path.write_bytes(res.content)
        doc = pdfium.PdfDocument(str(path))
        texts.append(doc[0].get_textpage().get_text_range())
        doc.close()
    coords = re.compile(r"-?\d{2,3}\.\d{5}, -?\d{2,3}\.\d{5}")
    lines1 = texts[0].splitlines()
    lines2 = texts[1].splitlines()
    assert len(lines1) == len(lines2)
    differing = [(a, b) for a, b in zip(lines1, lines2, strict=True) if a != b]
    assert len(differing) == 1, differing
    a, b = differing[0]
    assert coords.sub("<pin>", a) == coords.sub("<pin>", b)


@pytest.mark.parametrize("name", SCANNED[1:])
def test_the_siblings_hold_the_same_plan(
    name: str, client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    v1 = audit(client, monkeypatch, name)
    v2 = audit(client, monkeypatch, f"{name}-work-start")
    assert v1["summary"] == v2["summary"]
    assert v1["plan_flags"] == v2["plan_flags"]
    s1, s2 = v1["sections"]["site_scan"], v2["sections"]["site_scan"]
    assert (s1["status"], s1.get("flags")) == (s2["status"], s2.get("flags"))


# ---------------------------------------------------------------------------
# Lookout Mountain, re-recorded on the centerline
# ---------------------------------------------------------------------------


def test_lookout_re_records_on_the_centerline() -> None:
    """The twin's work start, walked 850 ft along the road, with its travel
    choice, lays the same drawing-frame corridor as the recorded anchor —
    around the switchback, where a chord would leave the road."""
    rec = json.loads((CENTERLINE_DIR / "lookout_mountain_road.json").read_text())
    twin = json.loads((CENTERLINE_DIR / "lookout_mountain_road.work-start.json").read_text())
    centerline = tuple((p[0], p[1]) for p in rec["centerline"])
    params = twin["_provenance"]["params"]
    v1 = build_corridor(
        lat=rec["anchor"][0],
        lng=rec["anchor"][1],
        bearing_deg=rec["bearing_deg"],
        centerline=centerline,
        **params,
    )
    start = twin["work_start"]
    travel = travel_bearing_at(*start, centerline=centerline, travel=twin["travel"], heading=None)
    v2 = build_corridor(
        lat=start[0],
        lng=start[1],
        bearing_deg=travel,
        centerline=centerline,
        pin_model="work_start",
        **params,
    )
    assert _haversine_m(v1.anchor_lat, v1.anchor_lng, v2.anchor_lat, v2.anchor_lng) < 0.5
    for p1, p2 in zip(v1.work_zone_path_points(), v2.work_zone_path_points(), strict=False):
        assert _haversine_m(*p1, *p2) < 0.5
    assert len(v2.work_zone_path_points()) > 2
