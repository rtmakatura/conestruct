"""#301 / #302 — every surface that states the corridor agrees, on real pins.

#301's acceptance: "The band aerial, the picker and PDF page 2 draw from one
producer.  A test asserts they agree for the N Broadway SB and Lafayette
flagger fixtures."  #302: "one layout call used by every surface that draws
the corridor, plus an agreement test that fails on main today for the
65→60 case."

The fixtures (``tests/fixtures/corridor/``) are the bodies the picker sent
on prod after #290 shipped, relayed the way the site's proxy relays them
(``lib/scenarios/centerline-relay.ts``: ``meta.centerline`` and
``meta.roadDirection`` from the confirmed road).

Three consumers, asserted on what each would draw or print (Rule 11):

- the PICKER: ``POST /render/corridor-geometry`` — its work and zone points
  and its zone lengths;
- PAGE 2: the approaches ``render_plan_sheet`` hands the Static Images
  fetch (``plan_sheet._fetch_mapbox_aerial``), walked by the same
  ``corridor_layout`` functions the overlay builder walks;
- the BAND's rows: ``POST /render/audit`` → ``sections.corridor_spec``.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

import src.rendering.plan_sheet as ps
from src.rules import site_detection as sd
from src.rules.corridor_layout import zone_parts, zone_spans

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
FIXTURES = Path(__file__).parent / "fixtures" / "corridor"
SPEC_KEY = {
    "advance_warning": "advance_warning_ft",
    "transition": "taper_ft",
    "buffer": "buffer_ft",
    "downstream": "downstream_taper_ft",
}


def fixture(name: str, **overrides: Any) -> dict[str, Any]:
    scenario = json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))
    scenario.update(overrides)
    return scenario


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_kw: ({"elements": []}, None)
    )


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


@pytest.fixture()
def page_two(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """What page 2 is handed to draw: the corridor and the approaches."""
    seen: dict[str, Any] = {}
    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")

    def capture(lat: float, lng: float, token: str, corridor=None, approaches=None):  # noqa: ANN001
        seen["corridor"], seen["approaches"] = corridor, approaches
        return None

    monkeypatch.setattr(ps, "_fetch_mapbox_aerial", capture)
    return seen


def _answers(client: TestClient, page_two: dict[str, Any], scenario: dict[str, Any]):
    geometry = client.post("/render/corridor-geometry", headers=AUTH, json=scenario)
    audit = client.post("/render/audit", headers=AUTH, json=scenario)
    pdf = client.post("/render/pdf", headers=AUTH, json=scenario)
    assert (geometry.status_code, audit.status_code, pdf.status_code) == (200, 200, 200)
    g = geometry.json()
    assert g["status"] == "laid_out"
    return g, audit.json()["sections"]["corridor_spec"], dict(page_two["approaches"])


def _points(parts: list[dict[str, Any]]) -> list[list[float]]:
    return [pt for part in parts for pt in part["points"]]


def _page_two_points(c: Any, a: float, b: float) -> list[list[float]]:
    return [
        [round(lat, 7), round(lng, 7)] for part in zone_parts(c, a, b) for lat, lng in part.points
    ]


CASES = [
    pytest.param("broadway-sb", {}, 1, id="broadway-sb"),
    pytest.param("lafayette-flagger", {}, 2, id="lafayette-flagger"),
    # #302: the CDOT Cases 26/27 step-downs.  On main the picker and page 2
    # drew 645 / 820 ft here while the plan built 570 / 650.
    pytest.param("broadway-sb", {"speed": 65, "workZoneSpeed": 60}, 1, id="broadway-65-to-60"),
    pytest.param("broadway-sb", {"speed": 75, "workZoneSpeed": 65}, 1, id="broadway-75-to-65"),
]


@pytest.mark.parametrize(("name", "overrides", "n_approaches"), CASES)
def test_picker_page_two_and_band_agree(
    client: TestClient,
    page_two: dict[str, Any],
    name: str,
    overrides: dict[str, Any],
    n_approaches: int,
) -> None:
    g, spec, drawn = _answers(client, page_two, fixture(name, **overrides))

    assert [a["id"] for a in g["approaches"]] == list(drawn)
    assert len(drawn) == n_approaches

    # The work: the same points on the picker and page 2.
    primary = drawn["primary"]
    work = next(s for s in zone_spans(primary) if s[0] == "work_zone")
    assert _points(g["work"]["parts"]) == _page_two_points(primary, work[1], work[2])

    for approach in g["approaches"]:
        c = drawn[approach["id"]]
        spans = {zone: (a, b) for zone, a, b in zone_spans(c)}
        for zone in approach["zones"]:
            a, b = spans[zone["zone"]]
            # Where each zone lies: point for point.
            assert _points(zone["parts"]) == _page_two_points(c, a, b), zone["zone"]
            # How long it is: the picker's, page 2's, and — on the primary
            # approach — the band's row, which reads the audit.
            assert zone["length_ft"] == round(b - a, 1), zone["zone"]
            if approach["id"] == "primary":
                assert round(zone["length_ft"]) == spec[SPEC_KEY[zone["zone"]]], zone["zone"]


@pytest.mark.parametrize(
    ("speed", "wz_speed", "built_ft"),
    [(65, 60, 570), (75, 65, 650), (65, None, 645)],
)
def test_the_drawn_buffer_is_the_built_buffer(
    client: TestClient,
    page_two: dict[str, Any],
    speed: int,
    wz_speed: int | None,
    built_ft: int,
) -> None:
    """#302: the buffer every surface draws is the one the plan builds."""
    overrides: dict[str, Any] = {"speed": speed}
    if wz_speed is not None:
        overrides["workZoneSpeed"] = wz_speed
    g, spec, drawn = _answers(client, page_two, fixture("broadway-sb", **overrides))
    picker = next(z for z in g["approaches"][0]["zones"] if z["zone"] == "buffer")["length_ft"]
    assert picker == built_ft
    assert drawn["primary"].buffer_ft == built_ft
    assert page_two["corridor"].buffer_ft == built_ft
    assert spec["buffer_ft"] == built_ft


def test_the_fixtures_are_the_relayed_prod_bodies() -> None:
    """Provenance: each fixture carries the relay the site's proxy adds."""
    for name, travel in (("broadway-sb", "with_geometry"), ("lafayette-flagger", "with_geometry")):
        s = fixture(name)
        meta = s["meta"]
        assert meta["pinModel"] == "work_start"
        assert meta["work"] == {"side": "right", "travel": travel}
        assert meta["centerline"] == meta["confirmedRoad"]["candidate"]["geometry"]
        assert meta["roadDirection"]["osmBearingDeg"] == pytest.approx(
            meta["confirmedRoad"]["candidate"]["bearing"] % 360
        )
    assert fixture("broadway-sb")["kind"] == "shoulder"
    assert fixture("lafayette-flagger")["kind"] == "flagger_lane_closure"
