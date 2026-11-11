"""#507 (UX group 8): the side options for a grouped street, a fallback
direction, and a diagonal road (rulings 2, 3 and 5; rulings.md R145-2/3/8).

* A grouped street relays its other carriageway (``meta.twinRoad``); the
  backend offers that carriageway's outer edge as the street's other side
  and names the carriageway (``"carriageway": "twin"``).
* With no road and ``meta.roadAxis``, only that axis's two headings.
* Diagonal roads are named by their diagonal; cardinal ones read as before.
* No device count moves: the twin relay is read by the side options only,
  and a diagonal heading builds the same devices as a cardinal one.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from src.api.render_api import app
from src.api.schemas import Scenario, scenario_to_call
from src.rules import site_detection as sd
from src.rules.corridor_layout import side_label

AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}
BROADWAY = Path(__file__).parent / "fixtures" / "corridor" / "broadway-sb.json"
DIVIDED = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": 40.0, "twinSearched": True}


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(autouse=True)
def _no_overpass(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_kw: ({"elements": []}, None)
    )


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def carriageway(twin: bool, side: str | None = None) -> dict[str, Any]:
    """Broadway SB as one carriageway of a divided street, with or without
    its other carriageway relayed (the same line, run the other way)."""
    b = json.loads(BROADWAY.read_text(encoding="utf-8"))
    meta = b["meta"]
    cand = meta["confirmedRoad"]["candidate"]
    meta["centerline"] = cand["geometry"]
    meta["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": "yes"}
    meta.pop("work", None)
    if side is not None:
        meta["work"] = {"side": side, "travel": "with_geometry"}
    if twin:
        meta["twinRoad"] = {
            "centerline": list(reversed(cand["geometry"])),
            "osmBearingDeg": (cand["bearing"] + 180) % 360,
            "oneway": "yes",
        }
    b["carriageway"] = dict(DIVIDED)
    b["divided"] = True
    return b


def no_road(axis: str | None, heading: str | None = None) -> dict[str, Any]:
    b = json.loads(BROADWAY.read_text(encoding="utf-8"))
    meta = b["meta"]
    for k in ("centerline", "roadDirection", "confirmedRoad", "work"):
        meta.pop(k, None)
    if axis is not None:
        meta["roadAxis"] = axis
    if heading is not None:
        meta["work"] = {"side": "right", "heading": heading}
    b["carriageway"] = None
    return b


def options(client: TestClient, body: dict[str, Any]) -> list[dict[str, Any]]:
    r = client.post("/render/corridor-geometry", headers=AUTH, json=body)
    assert r.status_code == 200, r.text
    return r.json()["side_options"]


def devices(body: dict[str, Any]) -> list[tuple[str, str]]:
    """The device list by type and label: the counts every deliverable prints."""
    params, generator, kwargs = scenario_to_call(TypeAdapter(Scenario).validate_python(body))
    return sorted((p.device_type.name, str(p.label)) for p in generator(params, **kwargs))


def test_one_carriageway_alone_offers_its_one_outer_side(client: TestClient) -> None:
    opts = options(client, carriageway(twin=False))
    assert [(o["label"], o.get("carriageway")) for o in opts] == [
        ("West side · southbound traffic", None)
    ]


def test_a_grouped_street_offers_both_outer_sides_naming_the_carriageway(
    client: TestClient,
) -> None:
    opts = options(client, carriageway(twin=True))
    assert [(o["label"], o["work"], o.get("carriageway")) for o in opts] == [
        ("West side · southbound traffic", {"side": "right", "travel": "with_geometry"}, None),
        ("East side · northbound traffic", {"side": "right", "travel": "with_geometry"}, "twin"),
    ]


def test_the_twin_relay_moves_no_device(client: TestClient) -> None:
    assert devices(carriageway(twin=True, side="right")) == devices(
        carriageway(twin=False, side="right")
    )


@pytest.mark.parametrize(
    ("axis", "expected"),
    [
        ("east_west", ["South side · traffic heading east", "North side · traffic heading west"]),
        ("north_south", ["East side · traffic heading north", "West side · traffic heading south"]),
        (
            "northeast_southwest",
            [
                "Southeast side · traffic heading northeast",
                "Northwest side · traffic heading southwest",
            ],
        ),
        (
            "northwest_southeast",
            [
                "Southwest side · traffic heading southeast",
                "Northeast side · traffic heading northwest",
            ],
        ),
    ],
)
def test_a_said_direction_offers_only_its_two_sides(
    client: TestClient, axis: str, expected: list[str]
) -> None:
    assert [o["label"] for o in options(client, no_road(axis))] == expected


def test_no_direction_keeps_the_four_headings_byte_identical(client: TestClient) -> None:
    assert [o["label"] for o in options(client, no_road(None))] == [
        "East side · traffic heads north",
        "South side · traffic heads east",
        "West side · traffic heads south",
        "North side · traffic heads west",
    ]


def test_a_diagonal_heading_builds_the_same_devices_as_a_cardinal_one() -> None:
    assert devices(no_road("northeast_southwest", "NE")) == devices(no_road(None, "E"))


@pytest.mark.parametrize(
    ("edge", "travel", "label"),
    [
        (100.0, 10.0, "East side · northbound traffic"),
        (135.0, 45.0, "Southeast side · traffic heading northeast"),
        (292.0, 202.0, "West side · southbound traffic"),
        (338.0, 248.0, "North side · westbound traffic"),
        (225.0, 135.0, "Southwest side · traffic heading southeast"),
    ],
)
def test_side_words_name_a_diagonal_by_its_diagonal(edge: float, travel: float, label: str) -> None:
    assert side_label(edge, travel) == label
