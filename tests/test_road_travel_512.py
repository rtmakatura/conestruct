"""#512 — the road list's travel words come from the side choices' reading.

Ryan (2026-11-11): the "Traffic both ways" / one-way label comes from the
Python backend's one-way classification, the same one that decides the
sides.  ``travel_reading`` is built on ``legal_offset_deg``, which
``against_legal_direction`` (the side choices) uses too.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.rules.corridor import against_legal_direction, legal_offset_deg, travel_reading

AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.mark.parametrize(
    ("oneway", "highway_class", "expected"),
    [
        ("yes", "primary", "one_way"),
        ("-1", "residential", "one_way"),
        ("yes", "motorway", "one_way"),
        (None, "primary", "both_ways"),
        ("no", "trunk", "both_ways"),
        ("reversible", "motorway", "changes_by_time"),
        ("alternating", "secondary", "changes_by_time"),
        (None, "motorway", "unknown"),
        (None, "motorway_link", "unknown"),
        ("no", "motorway", "unknown"),
        ("1", "primary", "unknown"),
    ],
)
def test_travel_reading_each_tag(oneway: str | None, highway_class: str, expected: str) -> None:
    assert travel_reading(oneway, highway_class) == expected


def test_grouped_street_reads_both_ways() -> None:
    assert travel_reading("yes", "primary", twin_oneway="yes") == "both_ways"
    assert travel_reading("yes", "primary", twin_oneway="-1") == "both_ways"
    assert travel_reading("yes", "primary", twin_oneway="no") == "unknown"


@pytest.mark.parametrize("oneway", ["yes", "-1", None, "no", "reversible", "alternating", "1"])
def test_one_way_words_agree_with_the_side_choices(oneway: str | None) -> None:
    """A row reads one-way exactly when the side choices rule a direction out."""
    rules_out = any(against_legal_direction(b, 0.0, oneway) for b in (0.0, 180.0))
    assert rules_out == (legal_offset_deg(oneway) is not None)
    assert rules_out == (travel_reading(oneway, "primary") == "one_way")


def test_endpoint_reads_each_road() -> None:
    client = TestClient(app)
    body = {
        "roads": [
            {"oneway": "yes", "highway_class": "primary", "twin_searched": True},
            {
                "oneway": "yes",
                "highway_class": "primary",
                "twin_distance_m": 60.5,
                "twin_searched": True,
            },
            {"oneway": "yes", "highway_class": "primary", "twin_searched": False},
            {"oneway": None, "highway_class": "motorway"},
            {"oneway": "reversible", "highway_class": "motorway"},
            {"oneway": "yes", "highway_class": "primary", "twin_oneway": "yes"},
        ]
    }
    r = client.post("/render/road-travel", json=body, headers=AUTH)
    assert r.status_code == 200
    assert r.json()["roads"] == [
        {"travel": "one_way", "carriageway": "one_way_street"},
        {"travel": "one_way", "carriageway": "divided"},
        {"travel": "one_way", "carriageway": "undecided"},
        {"travel": "unknown", "carriageway": "not_applicable"},
        {"travel": "changes_by_time", "carriageway": "not_applicable"},
        {"travel": "both_ways", "carriageway": "undecided"},
    ]


def test_endpoint_needs_the_secret() -> None:
    r = TestClient(app).post("/render/road-travel", json={"roads": []})
    assert r.status_code in (401, 403)
