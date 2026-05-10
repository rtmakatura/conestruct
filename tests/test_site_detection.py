"""Tests for ``src.rules.site_detection`` — Overpass-driven feature classification.

Bug Fix 3 split the legacy ``intersections`` bucket into:

* ``intersections`` — at-grade signal/stop/uncontrolled crossings (cross
  traffic enters via stop bar; W20-1 cross-street pair is correct).
* ``interchanges`` — highway on/off-ramps, motorway-junction nodes, and
  bridges (cross traffic merges via ramps; W20-3 + PCMS is correct).

These tests pin the classifier so the two buckets stay distinct.  All
tests stub the Overpass HTTP layer rather than hitting the network, so
they run offline and deterministically.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest.mock import patch

import pytest

from src.rules import site_detection


class _FakeResponse:
    """Minimal stand-in for ``httpx.Response`` — ``site_detection`` only
    reads ``status_code``, ``reason_phrase``, and ``json()``."""

    def __init__(self, payload: dict[str, Any], status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code
        self.reason_phrase = "OK" if status_code == 200 else "ERR"

    def json(self) -> dict[str, Any]:
        return self._payload


@pytest.fixture
def stub_overpass() -> Iterator[list[dict[str, Any]]]:
    """Replace ``httpx.post`` with a stub that returns elements from a list.

    Yields the ``elements`` list — tests append OSM-shaped dicts to it
    and call the public ``detect_site_conditions`` to exercise the
    classifier without hitting the network.
    """
    elements: list[dict[str, Any]] = []

    def fake_post(*_args: Any, **_kwargs: Any) -> _FakeResponse:
        return _FakeResponse({"elements": list(elements)})

    with patch.object(site_detection.httpx, "post", side_effect=fake_post):
        yield elements


# ---------------------------------------------------------------------------
# Classification: motorway_junction → interchanges
# ---------------------------------------------------------------------------


def test_motorway_junction_classified_as_interchange(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """A ``highway=motorway_junction`` node populates ``interchanges``, not
    the at-grade ``intersections`` bucket — and its ``ref`` (exit number)
    flows through to ``junction_refs``."""
    stub_overpass.append(
        {
            "type": "node",
            "lat": 38.886,
            "lon": -104.835,
            "tags": {
                "highway": "motorway_junction",
                "ref": "146",
                "name": "Garden of the Gods Rd",
            },
        }
    )
    result = site_detection.detect_site_conditions(38.886, -104.835, radius_m=500.0)
    assert result["interchanges"]["detected"] is True
    assert result["interchanges"]["count"] == 1
    assert "146" in result["interchanges"]["junction_refs"]
    # The node must NOT also leak into the at-grade bucket.
    assert result["intersections"]["detected"] is False
    assert result["intersections"]["count"] == 0


def test_bridge_way_classified_as_interchange(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """A ``bridge=yes`` way (overpass crossing the corridor) goes into
    ``interchanges``.  It's the third condition in the spec: a structure
    carrying or being carried over the highway."""
    stub_overpass.append(
        {
            "type": "way",
            "center": {"lat": 38.886, "lon": -104.835},
            "tags": {"bridge": "yes", "highway": "secondary"},
        }
    )
    result = site_detection.detect_site_conditions(38.886, -104.835, radius_m=500.0)
    assert result["interchanges"]["detected"] is True
    assert result["interchanges"]["count"] == 1
    assert result["intersections"]["detected"] is False


def test_motorway_link_classified_as_interchange(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """An on/off-ramp way (``highway=motorway_link``) is interchange
    geometry — must not bucket into the at-grade ``intersections`` bin."""
    stub_overpass.append(
        {
            "type": "way",
            "center": {"lat": 38.886, "lon": -104.836},
            "tags": {"highway": "motorway_link"},
        }
    )
    result = site_detection.detect_site_conditions(38.886, -104.835, radius_m=500.0)
    assert result["interchanges"]["detected"] is True
    assert result["intersections"]["detected"] is False


def test_traffic_signals_classified_as_intersection(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """A surface-street ``highway=traffic_signals`` node is at-grade and
    populates ``intersections``, not ``interchanges``.  This is the
    pre–Bug Fix 3 behavior we must preserve."""
    stub_overpass.append(
        {
            "type": "node",
            "lat": 38.886,
            "lon": -104.835,
            "tags": {"highway": "traffic_signals"},
        }
    )
    result = site_detection.detect_site_conditions(38.886, -104.835, radius_m=500.0)
    assert result["intersections"]["detected"] is True
    assert result["intersections"]["count"] == 1
    assert result["interchanges"]["detected"] is False
    assert result["interchanges"]["count"] == 0


def test_both_buckets_populate_independently(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """A motorway_junction AND a separate traffic_signals node in the same
    response populate both buckets without cross-talk.  This is the rare
    real-world case (frontage-road intersection near an interchange)."""
    stub_overpass.append(
        {
            "type": "node",
            "lat": 38.886,
            "lon": -104.835,
            "tags": {"highway": "motorway_junction", "ref": "146"},
        }
    )
    stub_overpass.append(
        {
            "type": "node",
            "lat": 38.890,
            "lon": -104.830,
            "tags": {"highway": "traffic_signals"},
        }
    )
    result = site_detection.detect_site_conditions(38.886, -104.835, radius_m=500.0)
    assert result["interchanges"]["detected"] is True
    assert result["interchanges"]["count"] == 1
    assert result["intersections"]["detected"] is True
    assert result["intersections"]["count"] == 1
    # junction_refs only carries refs from interchange-bucket nodes.
    assert result["interchanges"]["junction_refs"] == ["146"]


def test_interchange_bucket_present_when_no_features(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """Empty OSM response still returns the new ``interchanges`` bucket
    in the expected shape so callers can iterate without ``KeyError``."""
    # stub_overpass is empty by default
    result = site_detection.detect_site_conditions(38.886, -104.835, radius_m=500.0)
    assert "interchanges" in result
    assert result["interchanges"]["detected"] is False
    assert result["interchanges"]["count"] == 0
    assert result["interchanges"]["junction_refs"] == []
