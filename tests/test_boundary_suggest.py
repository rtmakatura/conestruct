"""Golden-pin suite for pin-based jurisdiction suggestion (Endeavor B §4).

Every pin is a hand-picked real-world coordinate, committed with its
rationale.  The pins run against the SHIPPED boundary layer in
``data/boundaries/`` — the same files the deployed endpoint reads — so a
bad vintage refresh or a simplification that eats an enclave hole fails
here before it ships.

The load-bearing one is the Glendale trap (spec §1.2): Glendale is an
incorporated city fully inside Denver's outline but is not Denver.  A
pin there must NEVER suggest Denver — a wrong silent guess poisons every
downstream number.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.rules.boundaries import NEAR_BOUNDARY_FT, suggest

_TEST_SECRET = "test-secret-do-not-deploy"
BOUNDARY_DIR = Path(__file__).resolve().parent.parent / "data" / "boundaries"


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


@pytest.fixture()
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_TEST_SECRET}"}


# ---------------------------------------------------------------------------
# Golden pins: comfortably inside each supported jurisdiction
# ---------------------------------------------------------------------------

# (key, lat, lng, rationale) — each pin is a recognizable civic landmark
# well clear of the 500 ft warning band.
INSIDE_PINS = [
    ("denver", 39.7392, -104.9903, "Colorado State Capitol / Civic Center — deep inside Denver"),
    ("lakewood", 39.7080, -105.0810, "Belmar district — central Lakewood"),
    ("englewood", 39.6478, -104.9878, "Englewood Civic Center, S Elati St"),
    ("littleton", 39.6133, -105.0166, "Downtown Littleton, Main St"),
    ("centennial", 39.5920, -104.8620, "Near Centennial Center Park"),
    ("parker", 39.5186, -104.7614, "Parker Mainstreet, downtown core"),
    # #155 reachability pins: both records shipped in data/jurisdictions/
    # while the boundary layer and picker never learned the keys.
    (
        "greeley",
        40.404292,
        -104.715863,
        "Central Greeley — was falsely 'unincorporated Weld County'",
    ),
    ("thornton", 39.8680, -104.9847, "Thornton Civic Center — was falsely 'not carried yet'"),
]


@pytest.mark.parametrize(
    ("key", "lat", "lng", "rationale"),
    INSIDE_PINS,
    ids=[p[0] for p in INSIDE_PINS],
)
def test_golden_pin_inside(key: str, lat: float, lng: float, rationale: str) -> None:
    r = suggest(lat, lng)
    assert r["suggestion"] == key, rationale
    assert r["confidence"] == "inside"
    assert r["warnings"] == []
    assert r["distance_to_boundary_ft"] > NEAR_BOUNDARY_FT
    # The reason is a sourced sentence (spec §2).
    assert "TIGER" in r["reason"]


# ---------------------------------------------------------------------------
# The Glendale enclave trap
# ---------------------------------------------------------------------------


def test_glendale_trap_never_suggests_denver() -> None:
    """Colorado Blvd & Kentucky Ave — inside the Glendale enclave.

    Glendale sits fully inside Denver's outline (Arapahoe County island
    in the consolidated city-county).  The enclave hole must survive
    simplification, and a pin here must NOT suggest Denver.
    """
    r = suggest(39.7047, -104.9350)
    assert r["suggestion"] != "denver"
    assert r["suggestion"] is None
    assert r["confidence"] == "outside_supported"
    kinds = [w["kind"] for w in r["warnings"]]
    assert "unsupported_area" in kinds
    unsupported = next(w for w in r["warnings"] if w["kind"] == "unsupported_area")
    assert "Glendale" in unsupported["message"]
    # The enclave edge is close — the jigsaw warning must name Denver.
    near = [w for w in r["warnings"] if w["kind"] == "near_boundary"]
    assert any("Denver" in w["message"] for w in near)


# ---------------------------------------------------------------------------
# Centennial / unincorporated-Arapahoe pocket pair
# ---------------------------------------------------------------------------


def test_centennial_pocket_pair() -> None:
    """Centennial is swiss-cheesed with unincorporated Arapahoe pockets.

    Pin A (E Arapahoe Rd corridor) is in Centennial proper; pin B
    (Centennial Airport area) is an unincorporated Arapahoe County
    pocket the city surrounds but does not contain.
    """
    a = suggest(39.5945, -104.8210)
    assert a["suggestion"] == "centennial"

    b = suggest(39.5790, -104.8600)
    assert b["suggestion"] is None
    assert b["confidence"] == "outside_supported"
    unsupported = next(w for w in b["warnings"] if w["kind"] == "unsupported_area")
    # #155 county-copy honesty: the layer cannot distinguish
    # unincorporated ground from an unmapped municipality, so the copy
    # names the county and says the pin is outside the MAPPED boundaries.
    assert "Arapahoe County" in unsupported["message"]
    assert "outside the mapped municipal boundaries" in unsupported["message"]
    assert "unincorporated" not in unsupported["message"]
    assert "baseline rules" in unsupported["message"]


# ---------------------------------------------------------------------------
# Near-boundary pair straddling Englewood / Littleton
# ---------------------------------------------------------------------------


def test_englewood_littleton_straddle_pair() -> None:
    """Two pins ~200 ft either side of the shared Englewood–Littleton
    seam (near W Belleview Ave).  Each must suggest its own side AND
    carry a near_boundary warning naming the neighbor."""
    littleton_side = suggest(39.6225, -105.0075)
    assert littleton_side["suggestion"] == "littleton"
    assert littleton_side["confidence"] == "near_boundary"
    assert any(
        w["kind"] == "near_boundary" and "Englewood" in w["message"]
        for w in littleton_side["warnings"]
    )

    englewood_side = suggest(39.6225, -105.0060)
    assert englewood_side["suggestion"] == "englewood"
    assert englewood_side["confidence"] == "near_boundary"
    assert any(
        w["kind"] == "near_boundary" and "Littleton" in w["message"]
        for w in englewood_side["warnings"]
    )


def test_northglenn_thornton_seam() -> None:
    """#155 near-boundary control: a pin in Northglenn ~292 ft from the
    Thornton line.  Northglenn stays unsupported (no back-suggestion of
    the neighbor), and the jigsaw warning still names Thornton now that
    Thornton is a SUPPORTED polygon rather than a warning-layer one."""
    r = suggest(39.886, -104.9811)
    assert r["suggestion"] is None
    assert r["confidence"] == "outside_supported"
    unsupported = next(w for w in r["warnings"] if w["kind"] == "unsupported_area")
    assert "Northglenn" in unsupported["message"]
    assert any(w["kind"] == "near_boundary" and "Thornton" in w["message"] for w in r["warnings"])


def test_near_boundary_500ft_threshold() -> None:
    """The warning band is 500 ft: a pin ~200 ft from the neighbor warns;
    a pin ~900 ft inside does not (both measured against the shipped
    layer, with ~2× margin on each side of the threshold)."""
    warn = suggest(39.6225, -105.0075)
    assert warn["distance_to_boundary_ft"] < NEAR_BOUNDARY_FT
    assert any(w["kind"] == "near_boundary" for w in warn["warnings"])

    quiet = suggest(39.6225, -105.0100)
    assert quiet["suggestion"] == "littleton"
    assert quiet["confidence"] == "inside"
    assert quiet["distance_to_boundary_ft"] > NEAR_BOUNDARY_FT
    assert quiet["warnings"] == []


# ---------------------------------------------------------------------------
# Endpoint contract (spec §2): advisory, sourced, schema-bounded
# ---------------------------------------------------------------------------


def test_endpoint_response_shape(client: TestClient, auth_headers: dict[str, str]) -> None:
    res = client.post(
        "/jurisdiction/suggest",
        headers=auth_headers,
        json={"lat": 39.7392, "lng": -104.9903},
    )
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {
        "suggestion",
        "reason",
        "confidence",
        "distance_to_boundary_ft",
        "warnings",
        "boundary_source",
    }
    assert body["suggestion"] == "denver"
    assert body["confidence"] in ("inside", "near_boundary", "outside_supported")
    # Honesty line inputs (spec §6): source + vintage ride every response.
    assert body["boundary_source"]["source"]
    assert body["boundary_source"]["vintage"]


def test_endpoint_never_accepts_a_scenario(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """Suggest-never-set, enforced at the wire: the request model has no
    scenario field, so the endpoint CANNOT read or write one — extra
    fields are not an alternate channel."""
    res = client.post(
        "/jurisdiction/suggest",
        headers=auth_headers,
        json={
            "lat": 39.7392,
            "lng": -104.9903,
            "scenario": {"jurisdiction_key": "denver"},
            "jurisdiction_key": "denver",
        },
    )
    # Unknown fields are ignored by the model; the response is identical
    # advice, never an applied state.
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {
        "suggestion",
        "reason",
        "confidence",
        "distance_to_boundary_ft",
        "warnings",
        "boundary_source",
    }


def test_endpoint_schema_bounds(client: TestClient, auth_headers: dict[str, str]) -> None:
    res = client.post("/jurisdiction/suggest", headers=auth_headers, json={"lat": 95.0, "lng": 0.0})
    assert res.status_code == 422


def test_endpoint_requires_auth(client: TestClient) -> None:
    res = client.post("/jurisdiction/suggest", json={"lat": 39.7, "lng": -105.0})
    assert res.status_code == 401


def test_suggest_is_deterministic() -> None:
    a = suggest(39.7047, -104.9350)
    b = suggest(39.7047, -104.9350)
    assert a == b


# ---------------------------------------------------------------------------
# Provenance: _meta required, same discipline as jurisdiction files
# ---------------------------------------------------------------------------


def test_meta_provenance_required() -> None:
    meta = json.loads((BOUNDARY_DIR / "_meta.json").read_text(encoding="utf-8"))
    for layer in ("places", "counties"):
        block = meta[layer]
        for key in ("source", "license", "vintage", "retrieved", "simplification_m"):
            assert block.get(key), f"_meta.{layer}.{key} missing or empty"
        assert block["simplification_m"] == 10
    # The rejected-source audit trail must survive: DOLA was evaluated
    # and rejected on coverage (Denver served without enclave holes).
    dola = meta["places"]["sources_evaluated"]["dola_municipal_boundaries"]
    assert dola["verdict"].startswith("REJECTED")


def test_boundary_file_per_supported_key() -> None:
    for key in (
        "denver",
        "lakewood",
        "englewood",
        "littleton",
        "centennial",
        "parker",
        "greeley",
        "thornton",
    ):
        path = BOUNDARY_DIR / f"{key}.geojson"
        assert path.is_file(), f"missing boundary file for supported key {key}"
        feat = json.loads(path.read_text(encoding="utf-8"))
        assert feat["properties"]["key"] == key
