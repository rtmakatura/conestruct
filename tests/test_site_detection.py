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


# ---------------------------------------------------------------------------
# Corridor-aware detection: per-bucket relevance overrides
# ---------------------------------------------------------------------------
#
# These pin the relevance rules in ``_BUCKET_RELEVANCE_OVERRIDES``: schools
# parallel to the corridor are *not* relevant (the original I-25 false
# positive that motivated the corridor work); sidewalks at curbside lateral
# offsets *are* relevant; intersections just past either end of the corridor
# are relevant within their 250 ft tolerance.

from src.rules.corridor import WorkCorridor, _destination_point  # noqa: E402

# Anchor + corridor used for the corridor-mode tests below.  Bearing 0
# (due north) keeps the math intuitive: along-station maps to latitude
# change, lateral offset to longitude change.
_TEST_ANCHOR_LAT: float = 39.9714
_TEST_ANCHOR_LNG: float = -104.8205


def _test_corridor() -> WorkCorridor:
    """Stock corridor for the relevance-rule tests.

    Bearing 0 (north), 800 ft work zone with realistic surrounding zones —
    matches the I-25 hand-calc scenario from ``test_corridor.py``.  Total
    length ≈ 3078 ft.
    """
    return WorkCorridor(
        anchor_lat=_TEST_ANCHOR_LAT,
        anchor_lng=_TEST_ANCHOR_LNG,
        anchor_description="test anchor",
        bearing_deg=0.0,
        advance_warning_ft=1500.0,
        taper_ft=183.0,
        buffer_ft=495.0,
        work_zone_ft=800.0,
        downstream_taper_ft=100.0,
    )


def _point_at(
    anchor_lat: float,
    anchor_lng: float,
    bearing_deg: float,
    distance_m: float,
) -> tuple[float, float]:
    """Lat/lng ``distance_m`` from ``anchor`` along ``bearing_deg``."""
    return _destination_point(anchor_lat, anchor_lng, bearing_deg, distance_m)


def test_corridor_school_on_parallel_street_not_detected(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """The I-25 regression: a school 200 ft lateral to the corridor is on a
    parallel surface street, not part of the freeway work zone, and must
    not flip ``schools.detected``.  Schools have no ``lateral`` override —
    the default rule applies."""
    corridor = _test_corridor()
    # 200 ft = 60.96 m east of corridor midpoint.
    midpoint_lat, midpoint_lng = _point_at(
        corridor.anchor_lat, corridor.anchor_lng, 0.0, corridor.total_length_m / 2.0
    )
    school_lat, school_lng = _point_at(midpoint_lat, midpoint_lng, 90.0, 60.96)
    stub_overpass.append(
        {
            "type": "node",
            "lat": school_lat,
            "lon": school_lng,
            "tags": {"amenity": "school", "name": "Parallel St Elementary"},
        }
    )
    result = site_detection.detect_along_corridor(corridor)
    assert result["schools"]["detected"] is False
    assert result["schools"]["count"] == 0
    # The feature is still recorded in features[] for transparency.
    assert len(result["schools"]["features"]) == 1
    assert result["schools"]["features"][0]["zone"] == "lateral"
    assert result["schools"]["features"][0]["relevant"] is False


def test_corridor_curbside_sidewalk_is_detected(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """A sidewalk 80 ft lateral to centerline is curbside (just past the
    lane/shoulder edge) — the *target* of the pedestrian-closure rule.
    Sidewalks override the default and accept ``lateral`` features within
    150 ft of centerline."""
    corridor = _test_corridor()
    midpoint_lat, midpoint_lng = _point_at(
        corridor.anchor_lat, corridor.anchor_lng, 0.0, corridor.total_length_m / 2.0
    )
    # 80 ft = 24.38 m lateral.
    sidewalk_lat, sidewalk_lng = _point_at(midpoint_lat, midpoint_lng, 90.0, 24.38)
    stub_overpass.append(
        {
            "type": "way",
            "center": {"lat": sidewalk_lat, "lon": sidewalk_lng},
            "tags": {"footway": "sidewalk"},
        }
    )
    result = site_detection.detect_along_corridor(corridor)
    assert result["sidewalks"]["detected"] is True
    assert result["sidewalks"]["count"] == 1


def test_corridor_far_lateral_sidewalk_not_detected(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """A sidewalk 200 ft lateral exceeds the sidewalk override (150 ft) and
    must not flip the flag — this is the limit case that prevents the
    pre-corridor behavior from leaking back in for sidewalks specifically."""
    corridor = _test_corridor()
    midpoint_lat, midpoint_lng = _point_at(
        corridor.anchor_lat, corridor.anchor_lng, 0.0, corridor.total_length_m / 2.0
    )
    # 200 ft = 60.96 m lateral — past sidewalk's 150 ft override.
    sidewalk_lat, sidewalk_lng = _point_at(midpoint_lat, midpoint_lng, 90.0, 60.96)
    stub_overpass.append(
        {
            "type": "way",
            "center": {"lat": sidewalk_lat, "lon": sidewalk_lng},
            "tags": {"footway": "sidewalk"},
        }
    )
    result = site_detection.detect_along_corridor(corridor)
    assert result["sidewalks"]["detected"] is False


def test_corridor_intersection_just_past_upstream_end_is_detected(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """A traffic signal 100 ft past the most upstream end of the corridor
    (past the advance warning zone) is a real cross-street intersection
    that needs W20-1 facing the cross-traffic.  The intersections bucket
    overrides ``outside`` with a 250 ft tolerance — this case is inside
    the override."""
    corridor = _test_corridor()
    # 100 ft = 30.48 m past the upstream end in the bearing direction.
    upstream_lat, upstream_lng = corridor.upstream_point()
    sig_lat, sig_lng = _point_at(upstream_lat, upstream_lng, 0.0, 30.48)
    stub_overpass.append(
        {
            "type": "node",
            "lat": sig_lat,
            "lon": sig_lng,
            "tags": {"highway": "traffic_signals"},
        }
    )
    result = site_detection.detect_along_corridor(corridor)
    assert result["intersections"]["detected"] is True
    assert result["intersections"]["count"] == 1


def test_corridor_intersection_well_past_upstream_end_not_detected(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """A traffic signal 400 ft past the upstream end exceeds the 250 ft
    intersections tolerance and must not flip the flag — drivers on the
    project corridor will already be slowing to the work zone by the time
    they reach the work zone signing.  Tests the upper boundary of the
    override."""
    corridor = _test_corridor()
    upstream_lat, upstream_lng = corridor.upstream_point()
    # 400 ft = 121.92 m past upstream — past the 250 ft override.
    sig_lat, sig_lng = _point_at(upstream_lat, upstream_lng, 0.0, 121.92)
    stub_overpass.append(
        {
            "type": "node",
            "lat": sig_lat,
            "lon": sig_lng,
            "tags": {"highway": "traffic_signals"},
        }
    )
    result = site_detection.detect_along_corridor(corridor)
    assert result["intersections"]["detected"] is False


def test_corridor_school_outside_extent_not_detected(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """A school past the upstream end (outside) gets no tolerance override —
    the schools bucket only counts features inside the corridor extent.
    Complements the parallel-street test by pinning the upstream/downstream
    direction."""
    corridor = _test_corridor()
    upstream_lat, upstream_lng = corridor.upstream_point()
    # 100 ft past upstream — still outside the schools bucket (no override).
    school_lat, school_lng = _point_at(upstream_lat, upstream_lng, 0.0, 30.48)
    stub_overpass.append(
        {
            "type": "node",
            "lat": school_lat,
            "lon": school_lng,
            "tags": {"amenity": "school"},
        }
    )
    result = site_detection.detect_along_corridor(corridor)
    assert result["schools"]["detected"] is False


def test_user_agent_identifies_conestruct_not_claude_code() -> None:
    """#147 guard.  Overpass throttles and blocks by ``User-Agent``, so the
    string must identify Conestruct (with a contact) and must never revert to
    the ``anthropics/claude-code`` value that pooled our request budget with an
    unrelated repository and could import a block earned elsewhere."""
    ua = site_detection.USER_AGENT
    assert "conestruct.com" in ua
    assert "hello@conestruct.com" in ua
    assert "anthropics/claude-code" not in ua


# ---------------------------------------------------------------------------
# Bucket shape uniformity (#34): road_curvature must carry the standard shape
# ---------------------------------------------------------------------------
#
# Before the #34 fix, ``road_curvature`` was the one bucket with
# ``details: str`` (and no ``count``) in both constructors — invisible to
# mypy under ``dict[str, Any]``, and a landmine for any consumer iterating
# buckets generically.  These tests pin every bucket in both detectors to
# the standard shape, positively per key, and exercise the exact generic
# pattern that used to crash (``bucket["details"].append``).

_STANDARD_BUCKET_KEYS = (
    "intersections",
    "interchanges",
    "sidewalks",
    "bike_facilities",
    "schools",
    "railroad_crossings",
    "hospitals",
    "road_curvature",
)


def test_point_buckets_all_carry_standard_shape(
    stub_overpass: list[dict[str, Any]],
) -> None:
    result = site_detection.detect_site_conditions(38.886, -104.835, radius_m=500.0)
    for key in _STANDARD_BUCKET_KEYS:
        bucket = result[key]
        assert isinstance(bucket["detected"], bool), key
        assert isinstance(bucket["count"], int), key
        assert isinstance(bucket["details"], list), key
    # The placeholder message survives the shape change, as a list entry.
    assert result["road_curvature"]["details"] == [
        "Road curvature analysis not implemented; assume straight."
    ]
    assert result["road_curvature"]["count"] == 0


def test_corridor_buckets_all_carry_standard_shape(
    stub_overpass: list[dict[str, Any]],
) -> None:
    result = site_detection.detect_along_corridor(_test_corridor())
    for key in _STANDARD_BUCKET_KEYS:
        bucket = result[key]
        assert isinstance(bucket["detected"], bool), key
        assert isinstance(bucket["count"], int), key
        assert isinstance(bucket["details"], list), key
        # Corridor mode's extra per-bucket key applies to all eight alike.
        assert isinstance(bucket["features"], list), key
    assert result["road_curvature"]["details"] == [
        "Road curvature analysis not implemented; assume straight."
    ]


def test_generic_details_append_safe_on_every_bucket(
    stub_overpass: list[dict[str, Any]],
) -> None:
    """The filed landmine: ``bucket["details"].append`` across all buckets
    raised ``AttributeError: 'str' object has no attribute 'append'`` on
    ``road_curvature`` before the fix.  Must succeed on all eight now."""
    result = site_detection.detect_site_conditions(38.886, -104.835, radius_m=500.0)
    appended = 0
    for key in _STANDARD_BUCKET_KEYS:
        result[key]["details"].append("generic-consumer note")
        appended += 1
    assert appended == len(_STANDARD_BUCKET_KEYS)
    assert result["road_curvature"]["details"][-1] == "generic-consumer note"


# ---------------------------------------------------------------------------
# Failure taxonomy (#213, s2-arc12): the error branches, previously
# untested.  ``stub_overpass`` above can only express success — these
# fixtures express the mirror-failure classes so the honest-refusal
# contract ("all buckets empty + an ``error`` key, never a fabricated
# measurement") is pinned per distinguishable outcome.
# ---------------------------------------------------------------------------


@pytest.fixture
def stub_overpass_down() -> Iterator[list[Any]]:
    """Every mirror raises at the transport layer (outage / timeout class).

    Yields the call log so tests can assert how many mirrors were tried.
    """
    calls: list[Any] = []

    def fake_post(url: str, **_kwargs: Any) -> _FakeResponse:
        calls.append(url)
        raise site_detection.httpx.ConnectError("connection refused")

    with patch.object(site_detection.httpx, "post", side_effect=fake_post):
        yield calls


@pytest.fixture
def stub_overpass_4xx() -> Iterator[list[Any]]:
    """First mirror answers 400 — the query itself is rejected."""
    calls: list[Any] = []

    def fake_post(url: str, **_kwargs: Any) -> _FakeResponse:
        calls.append(url)
        return _FakeResponse({}, status_code=400)

    with patch.object(site_detection.httpx, "post", side_effect=fake_post):
        yield calls


def test_point_scan_failure_is_error_plus_empty_never_a_measurement(
    stub_overpass_down: list[Any],
) -> None:
    """Coverage pin (green at baseline — the branch was correct, just
    untested): a full outage returns every bucket empty PLUS ``error``.
    The empty buckets alone must never be mistaken for a completed scan."""
    result = site_detection.detect_site_conditions(39.71466, -104.94071, radius_m=500.0)
    assert "error" in result
    assert "ConnectError" in result["error"]
    for key in _STANDARD_BUCKET_KEYS:
        assert result[key]["detected"] is False, key
        assert result[key]["count"] == 0, key


def test_point_scan_failure_tries_every_mirror(
    stub_overpass_down: list[Any],
) -> None:
    """Transport errors fall through the whole mirror list before failing."""
    site_detection.detect_site_conditions(39.71466, -104.94071, radius_m=500.0)
    assert len(stub_overpass_down) == len(site_detection.OVERPASS_MIRRORS)


def test_point_scan_4xx_hard_stops_the_mirror_list(
    stub_overpass_4xx: list[Any],
) -> None:
    """A 4xx means the query is malformed — retrying another mirror would
    repeat it, so exactly one request fires and the error names the status."""
    result = site_detection.detect_site_conditions(39.71466, -104.94071, radius_m=500.0)
    assert "error" in result
    assert "400" in result["error"]
    assert len(stub_overpass_4xx) == 1


def test_corridor_scan_failure_is_error_plus_empty(
    stub_overpass_down: list[Any],
) -> None:
    """Coverage pin (green at baseline): the corridor detector's failure
    branch mirrors the point detector's — empty buckets + ``error``."""
    result = site_detection.detect_along_corridor(_test_corridor())
    assert "error" in result
    for key in _STANDARD_BUCKET_KEYS:
        assert result[key]["detected"] is False, key
        assert result[key]["count"] == 0, key
        assert result[key]["features"] == [], key


# ---------------------------------------------------------------------------
# validate_corridor_against_osm reason split (#213 V4): ``checked:False``
# conflated three causes — inputs insufficient, Overpass exception, and
# an Overpass error result — and the audit PDF asserted the first one
# ("no site coordinates supplied") for all three.  The ``reason`` key
# makes the causes distinguishable downstream.
# ---------------------------------------------------------------------------


def test_validate_reason_unavailable_on_error_result() -> None:
    with patch.object(
        site_detection,
        "detect_road_bearing",
        return_value={"error": "overpass-api.de: 504 Gateway Timeout", "bearing_deg": None},
    ):
        out = site_detection.validate_corridor_against_osm(39.71466, -104.94071, 85.0)
    assert out["checked"] is False
    assert out["reason"] == "check_unavailable"
    assert "504" in out["error"]


def test_validate_reason_unavailable_on_exception() -> None:
    with patch.object(
        site_detection,
        "detect_road_bearing",
        side_effect=RuntimeError("socket torn down"),
    ):
        out = site_detection.validate_corridor_against_osm(39.71466, -104.94071, 85.0)
    assert out["checked"] is False
    assert out["reason"] == "check_unavailable"


def test_validate_reason_not_run_without_bearing() -> None:
    out = site_detection.validate_corridor_against_osm(39.71466, -104.94071, None)
    assert out["checked"] is False
    assert out["reason"] == "not_run_no_coords"


def test_validate_success_carries_no_reason() -> None:
    with patch.object(
        site_detection,
        "detect_road_bearing",
        return_value={"highway": "primary", "bearing_deg": 85.0, "way_id": 39508704},
    ):
        out = site_detection.validate_corridor_against_osm(39.71466, -104.94071, 85.0)
    assert out["checked"] is True
    assert "reason" not in out
