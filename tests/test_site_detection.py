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

import asyncio
import copy
import json
import time
from collections.abc import Iterator
from typing import Any
from unittest.mock import patch

import pytest

from src.rules import site_detection


class _FakeResponse:
    """Minimal stand-in for ``httpx.Response`` — ``site_detection`` only
    reads ``status_code``, ``reason_phrase``, ``content``, ``headers`` and
    ``json()``."""

    def __init__(
        self,
        payload: dict[str, Any],
        status_code: int = 200,
        headers: dict[str, str] | None = None,
    ) -> None:
        self._payload = payload
        self.status_code = status_code
        self.reason_phrase = "OK" if status_code == 200 else "ERR"
        self.content = json.dumps(payload).encode()
        self.headers = headers or {}

    def json(self) -> dict[str, Any]:
        return self._payload


def _as_mirror_post(fake: Any) -> Any:
    """Wrap a synchronous ``fake(url, **kw)`` as the async
    ``_mirror_post`` seam the #292 race calls once per mirror."""

    async def mirror_post(_client: Any, url: str, query: str, timeout: Any) -> Any:
        return fake(url, data={"data": query}, timeout=timeout)

    return mirror_post


@pytest.fixture
def stub_overpass() -> Iterator[list[dict[str, Any]]]:
    """Replace the mirror post with a stub that returns elements from a list.

    Yields the ``elements`` list — tests append OSM-shaped dicts to it
    and call the public ``detect_site_conditions`` to exercise the
    classifier without hitting the network.
    """
    elements: list[dict[str, Any]] = []

    def fake_post(*_args: Any, **_kwargs: Any) -> _FakeResponse:
        return _FakeResponse({"elements": list(elements)})

    with patch.object(site_detection, "_mirror_post", _as_mirror_post(fake_post)):
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

    with patch.object(site_detection, "_mirror_post", _as_mirror_post(fake_post)):
        yield calls


@pytest.fixture
def stub_overpass_4xx() -> Iterator[list[Any]]:
    """Every mirror answers 400 — the query itself is rejected."""
    calls: list[Any] = []

    def fake_post(url: str, **_kwargs: Any) -> _FakeResponse:
        calls.append(url)
        return _FakeResponse({}, status_code=400)

    with patch.object(site_detection, "_mirror_post", _as_mirror_post(fake_post)):
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


def test_point_scan_4xx_from_every_mirror_is_an_honest_refusal(
    stub_overpass_4xx: list[Any],
) -> None:
    """#292 (R69): both mirrors are asked at once, so a 400 can no longer
    "hard-stop the rest of the list" -- there is no rest to stop.  Each
    mirror's 400 is that mirror's refusal, neither is retried (R73), and
    both refusing is the honest error naming the status (Rule 10).

    Before #292: the first mirror's 400 ended the chain after one request."""
    result = site_detection.detect_site_conditions(39.71466, -104.94071, radius_m=500.0)
    assert "error" in result
    assert "400" in result["error"]
    assert sorted(stub_overpass_4xx) == sorted(site_detection.OVERPASS_MIRRORS)


def test_a_400_from_one_mirror_leaves_the_others_answer_in_play(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    first, second = site_detection.OVERPASS_MIRRORS

    def fake_post(url: str, **_kw: Any) -> _FakeResponse:
        if url == first:
            return _FakeResponse({}, status_code=400)
        return _FakeResponse({"elements": []})

    monkeypatch.setattr(site_detection, "_mirror_post", _as_mirror_post(fake_post))
    meta: dict[str, Any] = {}
    payload, error = site_detection._overpass_request_with_fallback(
        "[out:json];", budget_s=20.0, meta=meta
    )
    assert (payload, error) == ({"elements": []}, None)
    assert meta["mirror"] == second


@pytest.fixture
def stub_overpass_429() -> Iterator[list[Any]]:
    """Every mirror rate-limits us — 429, not a malformed query."""
    calls: list[Any] = []

    def fake_post(url: str, **_kwargs: Any) -> _FakeResponse:
        calls.append(url)
        return _FakeResponse({}, status_code=429)

    with patch.object(site_detection, "_mirror_post", _as_mirror_post(fake_post)):
        yield calls


def test_point_scan_429_tries_every_mirror(
    stub_overpass_429: list[Any],
) -> None:
    """#256 ruling j: a 429 is that mirror's answer, not the chain's.

    Each mirror is independently rate-limited (this module's own comment on
    OVERPASS_MIRRORS), so a 429 from one says nothing about the next.  Before
    this ruling a single 429 ended the chain, which is why "mirror 3 reached
    in production" was unachievable: arc 31's first decomposition run
    rate-limited itself and invalidated its own L3/L4/L5 legs."""
    result = site_detection.detect_site_conditions(39.71466, -104.94071, radius_m=500.0)
    assert len(stub_overpass_429) == len(site_detection.OVERPASS_MIRRORS)
    # Still an honest refusal once every mirror has said no (Rule 10).
    assert "error" in result
    assert "429" in result["error"]
    for key in _STANDARD_BUCKET_KEYS:
        assert result[key]["detected"] is False, key
        assert result[key]["count"] == 0, key


def test_429_on_the_first_mirror_still_reaches_a_later_clean_one(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The point of ruling j, stated as the behaviour that pays for it: a
    rate-limited mirror must not cost the answer the other mirror has.
    #292: both are asked at once, one request each."""
    first = site_detection.OVERPASS_MIRRORS[0]
    calls: list[str] = []

    def fake_post(url: str, **_kw: Any) -> _FakeResponse:
        calls.append(url)
        if url == first:
            return _FakeResponse({}, status_code=429)
        return _FakeResponse({"elements": []})

    monkeypatch.setattr(site_detection, "_mirror_post", _as_mirror_post(fake_post))
    payload, error = site_detection._overpass_request_with_fallback("[out:json];")
    assert error is None
    assert payload == {"elements": []}
    assert sorted(calls) == sorted(site_detection.OVERPASS_MIRRORS)


# ---------------------------------------------------------------------------
# #292 -- the two live mirrors asked at once (R69, R70), a hard deadline
# (R71), and a good citizen of the free mirrors (R73).
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("stalled_index", [0, 1])
def test_a_stalled_mirror_never_costs_the_other_mirrors_answer(
    monkeypatch: pytest.MonkeyPatch, stalled_index: int
) -> None:
    """R69: the first valid answer wins whichever mirror it comes from, and
    the other request is cancelled at once.  Before #292 a stalled first
    mirror cost its 7 s cap before the next was asked."""
    stalled = site_detection.OVERPASS_MIRRORS[stalled_index]
    answering = site_detection.OVERPASS_MIRRORS[1 - stalled_index]
    cancelled: list[str] = []

    async def mirror_post(_client: Any, url: str, _query: str, _timeout: Any) -> Any:
        if url == stalled:
            try:
                await asyncio.sleep(30)
            except asyncio.CancelledError:
                cancelled.append(url)
                raise
        return _FakeResponse({"elements": []})

    monkeypatch.setattr(site_detection, "_mirror_post", mirror_post)
    meta: dict[str, Any] = {}
    started = time.monotonic()
    payload, error = site_detection._overpass_request_with_fallback(
        "[out:json];", budget_s=20.0, meta=meta
    )
    assert time.monotonic() - started < 2.0
    assert (payload, error) == ({"elements": []}, None)
    assert meta["mirror"] == answering
    assert cancelled == [stalled]  # the loser's request did not run on


def test_the_deadline_is_hard_a_trickling_read_cannot_run_past_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R71: the budget is a deadline for the whole ask.  Before #292 a read
    still trickling bytes could run past it (prod measured 21.4 s against
    20 s); now every request still open at the deadline is cancelled and
    the answer is the honest ``scan budget exceeded``."""
    cancelled: list[str] = []

    async def mirror_post(_client: Any, url: str, _query: str, _timeout: Any) -> Any:
        try:
            while True:  # a server sending a byte now and then, forever
                await asyncio.sleep(0.02)
        except asyncio.CancelledError:
            cancelled.append(url)
            raise

    monkeypatch.setattr(site_detection, "_mirror_post", mirror_post)
    started = time.monotonic()
    payload, error = site_detection._overpass_request_with_fallback("[out:json];", budget_s=1.0)
    elapsed = time.monotonic() - started
    assert payload is None
    assert error == "scan budget exceeded (1 s)"
    assert 0.9 <= elapsed < 2.5
    assert sorted(cancelled) == sorted(site_detection.OVERPASS_MIRRORS)


def test_the_deadline_refusal_still_names_a_mirror_that_failed_first(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    first, second = site_detection.OVERPASS_MIRRORS

    async def mirror_post(_client: Any, url: str, _query: str, _timeout: Any) -> Any:
        if url == first:
            return _FakeResponse({}, status_code=504)
        await asyncio.sleep(30)
        raise AssertionError("unreachable")

    monkeypatch.setattr(site_detection, "_mirror_post", mirror_post)
    payload, error = site_detection._overpass_request_with_fallback("[out:json];", budget_s=1.0)
    assert payload is None
    assert error == f"scan budget exceeded (1 s); {first}: 504 ERR"


def test_both_mirrors_failing_is_an_honest_refusal_naming_both(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    first, second = site_detection.OVERPASS_MIRRORS
    calls: list[str] = []

    def fake_post(url: str, **_kw: Any) -> _FakeResponse:
        calls.append(url)
        return _FakeResponse({}, status_code=504 if url == first else 502)

    monkeypatch.setattr(site_detection, "_mirror_post", _as_mirror_post(fake_post))
    payload, error = site_detection._overpass_request_with_fallback("[out:json];", budget_s=20.0)
    assert payload is None
    assert error == f"{first}: 504 ERR; {second}: 502 ERR"
    assert sorted(calls) == sorted([first, second])  # R73: one request each, no retry


def test_an_answer_with_null_points_still_wins_when_it_has_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R74 (correcting R69): #304's checks CLEAN an answer, they don't
    disqualify it.  The faster mirror's answer carries a way with a null
    point but also a usable one; it is valid and has content, so it wins."""
    fast = site_detection.OVERPASS_MIRRORS[1]
    lat, lng = 39.71466, -104.94071
    with_nulls = {
        "elements": [
            {
                "type": "way",
                "id": 1,
                "tags": {"highway": "primary"},
                "geometry": [
                    {"lat": lat, "lon": lng},
                    None,
                    {"lat": lat + 0.0005, "lon": lng},
                    {"lat": lat + 0.0010, "lon": lng},
                ],
            }
        ]
    }

    async def mirror_post(_client: Any, url: str, _query: str, _timeout: Any) -> Any:
        if url == fast:
            return _FakeResponse(with_nulls)
        await asyncio.sleep(0.2)
        return _FakeResponse({"elements": []})

    monkeypatch.setattr(site_detection, "_mirror_post", mirror_post)
    meta: dict[str, Any] = {}
    payload, error = site_detection._overpass_request_with_fallback(
        "[out:json];",
        budget_s=20.0,
        meta=meta,
        validate=lambda p: site_detection._emptied_by_cleaning(p, None, (lat, lng, 30.0)),
    )
    assert (payload, error) == (with_nulls, None)
    assert meta["mirror"] == fast


def test_an_answer_cleaned_to_nothing_loses_to_the_other_mirrors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R74: the first valid answer that STILL HAS CONTENT after cleaning
    wins.  The faster mirror's only road way lies a degree away from the
    search circle, so cleaning drops it and the slower mirror's answer wins."""
    fast, slow = site_detection.OVERPASS_MIRRORS[1], site_detection.OVERPASS_MIRRORS[0]
    lat, lng = 39.71466, -104.94071
    far_only = {
        "elements": [
            {
                "type": "way",
                "id": 7,
                "tags": {"highway": "primary"},
                "geometry": [{"lat": lat + 1.0, "lon": lng}, {"lat": lat + 1.001, "lon": lng}],
            }
        ]
    }
    clean = {
        "elements": [
            {
                "type": "way",
                "id": 1,
                "tags": {"highway": "primary"},
                "geometry": [{"lat": lat, "lon": lng}, {"lat": lat + 0.0005, "lon": lng}],
            }
        ]
    }

    async def mirror_post(_client: Any, url: str, _query: str, _timeout: Any) -> Any:
        if url == fast:
            return _FakeResponse(far_only)
        await asyncio.sleep(0.05)
        return _FakeResponse(clean)

    monkeypatch.setattr(site_detection, "_mirror_post", mirror_post)
    meta: dict[str, Any] = {}
    payload, error = site_detection._overpass_request_with_fallback(
        "[out:json];",
        budget_s=20.0,
        meta=meta,
        validate=lambda p: site_detection._emptied_by_cleaning(p, None, (lat, lng, 30.0)),
    )
    assert (payload, error) == (clean, None)
    assert meta["mirror"] == slow


def test_answers_cleaned_to_nothing_by_both_mirrors_are_an_honest_refusal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lat, lng = 39.71466, -104.94071
    far_way = {
        "elements": [
            {
                "type": "way",
                "id": 7,
                "tags": {"highway": "primary"},
                "geometry": [{"lat": lat + 1.0, "lon": lng}, {"lat": lat + 1.001, "lon": lng}],
            }
        ]
    }
    monkeypatch.setattr(
        site_detection, "_mirror_post", _as_mirror_post(lambda _u, **_k: _FakeResponse(far_way))
    )
    payload, error = site_detection._overpass_request_with_fallback(
        "[out:json];",
        budget_s=20.0,
        validate=lambda p: site_detection._emptied_by_cleaning(p, None, (lat, lng, 30.0)),
    )
    assert payload is None
    first, second = site_detection.OVERPASS_MIRRORS
    reason = "cleaned to nothing: all 1 elements dropped by #304's checks"
    assert error == f"{first}: {reason}; {second}: {reason}"


def test_emptied_by_cleaning_judges_what_the_cleaning_keeps() -> None:
    """R74: only an answer that had elements and keeps none loses; a
    genuinely empty answer is a measurement (Rule 10)."""
    lat, lng = 39.71466, -104.94071
    box = (lat - 0.01, lng - 0.01, lat + 0.01, lng + 0.01)
    circle = (lat, lng, 30.0)
    some_nulls = {
        "type": "way",
        "id": 3,
        "geometry": [{"lat": lat, "lon": lng}, None, {"lat": lat + 0.0001, "lon": lng}],
    }
    all_nulls = {"type": "way", "id": 6, "geometry": [None, {"lat": None, "lon": None}]}
    far_way = {
        "type": "way",
        "id": 8,
        "geometry": [{"lat": lat + 1.0, "lon": lng}, {"lat": lat + 1.001, "lon": lng}],
    }
    far_node = {"type": "node", "id": 4, "lat": lat + 1.0, "lon": lng, "tags": {}}
    near_node = {"type": "node", "id": 5, "lat": lat, "lon": lng, "tags": {}}
    emptied = site_detection._emptied_by_cleaning

    assert emptied({"elements": []}, [box], circle) is None  # empty is an answer
    assert emptied({"elements": [some_nulls]}, None, circle) is None  # points skipped, way kept
    assert emptied({"elements": [far_node, near_node]}, [box], None) is None  # one kept
    assert emptied({"elements": [some_nulls, far_way]}, None, circle) is None
    assert emptied({"elements": [all_nulls]}, None, circle) == (
        "cleaned to nothing: all 1 elements dropped by #304's checks"
    )
    assert emptied({"elements": [far_way]}, None, circle) is not None
    assert emptied({"elements": [far_node]}, [box], None) is not None


def test_a_corridor_scan_takes_an_answer_with_content_over_one_cleaned_to_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """End to end through the budgeted corridor scan: the first mirror's
    only element lies a degree outside the scan box, so cleaning empties
    it; the second mirror's genuinely empty corridor is a measurement and
    wins."""
    corridor = _test_corridor()
    lat, lng = corridor.anchor_lat, corridor.anchor_lng
    far = {"elements": [{"type": "node", "id": 9, "lat": lat + 1.0, "lon": lng, "tags": {}}]}
    first, second = site_detection.OVERPASS_MIRRORS

    async def mirror_post(_client: Any, url: str, _query: str, _timeout: Any) -> Any:
        if url == first:
            return _FakeResponse(far)
        await asyncio.sleep(0.05)
        return _FakeResponse({"elements": []})

    monkeypatch.setattr(site_detection, "_mirror_post", mirror_post)
    result = site_detection.detect_along_corridor(corridor, budget_s=20.0)
    assert "error" not in result
    assert result["overpass"]["mirror"] == second


def test_a_429_leaves_the_mirror_alone_for_its_retry_after(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R73: honour 429.  A mirror that answered 429 is not asked again until
    its Retry-After has passed (RATE_LIMIT_COOLDOWN_S when it sends none);
    the other mirror carries the scans meanwhile."""
    first, second = site_detection.OVERPASS_MIRRORS
    calls: list[str] = []

    def fake_post(url: str, **_kw: Any) -> _FakeResponse:
        calls.append(url)
        if url == first:
            return _FakeResponse({}, status_code=429, headers={"Retry-After": "120"})
        return _FakeResponse({"elements": []})

    monkeypatch.setattr(site_detection, "_mirror_post", _as_mirror_post(fake_post))
    site_detection._overpass_request_with_fallback("[out:json];", budget_s=20.0)
    left_alone = site_detection._RATE_LIMITED_UNTIL[first] - time.monotonic()
    assert 115.0 < left_alone <= 120.0
    calls.clear()
    payload, error = site_detection._overpass_request_with_fallback("[out:json];", budget_s=20.0)
    assert (payload, error) == ({"elements": []}, None)
    assert calls == [second]  # the rate-limited mirror was not asked


def test_a_429_without_retry_after_uses_the_chosen_cooldown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    first = site_detection.OVERPASS_MIRRORS[0]

    def fake_post(url: str, **_kw: Any) -> _FakeResponse:
        if url == first:
            return _FakeResponse({}, status_code=429)
        return _FakeResponse({"elements": []})

    monkeypatch.setattr(site_detection, "_mirror_post", _as_mirror_post(fake_post))
    site_detection._overpass_request_with_fallback("[out:json];", budget_s=20.0)
    left_alone = site_detection._RATE_LIMITED_UNTIL[first] - time.monotonic()
    assert left_alone > site_detection.RATE_LIMIT_COOLDOWN_S - 5
    assert left_alone <= site_detection.RATE_LIMIT_COOLDOWN_S


def test_every_mirror_cooling_down_is_an_honest_refusal_without_a_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    def fake_post(url: str, **_kw: Any) -> _FakeResponse:
        calls.append(url)
        return _FakeResponse({"elements": []})

    monkeypatch.setattr(site_detection, "_mirror_post", _as_mirror_post(fake_post))
    for url in site_detection.OVERPASS_MIRRORS:
        site_detection._RATE_LIMITED_UNTIL[url] = time.monotonic() + 30.0
    payload, error = site_detection._overpass_request_with_fallback("[out:json];", budget_s=20.0)
    assert payload is None
    assert error is not None and error.count("rate-limited") == 2
    assert calls == []


def test_every_mirror_request_names_conestruct_and_a_contact() -> None:
    """R73: the User-Agent names Conestruct with a contact address, on the
    one call that reaches the wire."""
    seen: dict[str, Any] = {}

    class _Client:
        async def post(self, url: str, **kw: Any) -> Any:
            seen.update(kw, url=url)
            return _FakeResponse({"elements": []})

    asyncio.run(
        site_detection._mirror_post(
            _Client(),  # type: ignore[arg-type]
            site_detection.OVERPASS_MIRRORS[0],
            "[out:json];",
            site_detection.httpx.Timeout(1.0),
        )
    )
    agent = seen["headers"]["User-Agent"]
    assert "conestruct" in agent.lower()
    assert "hello@conestruct.com" in agent
    assert seen["data"] == {"data": "[out:json];"}


def _folded_payload() -> dict[str, Any]:
    """A folded response: scan elements (no geometry) + road (geometry).

    The road way is a ``motorway_link`` ON PURPOSE — that is the class
    ``_categorize`` buckets into ``interchanges``, so if the fold ever
    stopped splitting before categorising, this payload would invent an
    interchange out of the bearing set.
    """
    return {
        "elements": [
            # scan set — out center tags, no geometry
            {
                "type": "node",
                "id": 1,
                "lat": 39.7269,
                "lon": -104.9873,
                "tags": {"highway": "traffic_signals"},
            },
            # road set — out geom tags
            {
                "type": "way",
                "id": 99,
                "tags": {"highway": "motorway_link", "oneway": "yes"},
                "geometry": [
                    {"lat": 39.7269, "lon": -104.9873},
                    {"lat": 39.7279, "lon": -104.9873},
                ],
            },
        ]
    }


def test_split_folded_elements_splits_on_geometry() -> None:
    """#256 ruling c: geometry is the discriminator, as s2-arc31 measured."""
    scan, road = site_detection.split_folded_elements(_folded_payload()["elements"])
    assert [el["id"] for el in scan] == [1]
    assert [el["id"] for el in road] == [99]


def test_folded_scan_buckets_are_identical_to_unfolded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """RULING g's INVARIANT, as a test: folding must not move a bucket.

    The scan set's selectors, bbox and output mode are byte-identical
    between _build_bbox_query and _build_folded_query, so the only way a
    bucket could move is the road set leaking into categorisation.  This
    runs the same corridor both ways against payloads whose scan halves
    are the same, and requires every bucket to match — including
    ``interchanges``, which is where a leaked motorway_link would land.
    """
    corridor = _test_corridor()
    scan_only = {"elements": [e for e in _folded_payload()["elements"] if not e.get("geometry")]}

    monkeypatch.setattr(
        site_detection,
        "_overpass_request_with_fallback",
        lambda *a, **k: (copy.deepcopy(scan_only), None),
    )
    unfolded = site_detection.detect_along_corridor(corridor)

    monkeypatch.setattr(
        site_detection,
        "_overpass_request_with_fallback",
        lambda *a, **k: (copy.deepcopy(_folded_payload()), None),
    )
    folded = site_detection.detect_along_corridor(
        corridor, bearing_anchor=(39.7269, -104.9873, 50.0)
    )

    bucket_names = [k for k in unfolded if k not in {"error", "overpass", "road_bearing"}]
    for name in bucket_names:
        assert folded[name] == unfolded[name], name
    # The leak this guards against, named explicitly.
    assert folded["interchanges"]["count"] == unfolded["interchanges"]["count"] == 0


def test_folded_call_returns_the_bearing_and_makes_one_round_trip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """#256 ruling c: ONE trip serves both.  The count is the claim."""
    calls: list[str] = []

    def stub(query: str, **_kw: Any) -> tuple[dict[str, Any], None]:
        calls.append(query)
        return copy.deepcopy(_folded_payload()), None

    monkeypatch.setattr(site_detection, "_overpass_request_with_fallback", stub)
    buckets = site_detection.detect_along_corridor(
        _test_corridor(), bearing_anchor=(39.7269, -104.9873, 50.0)
    )
    assert len(calls) == 1
    # Both sets are in the one query, with their own out statements.
    assert ")->.scan;" in calls[0] and ".scan out center tags;" in calls[0]
    assert ")->.road;" in calls[0] and ".road out geom tags;" in calls[0]
    assert "around:50" in calls[0]
    assert buckets["road_bearing"]["bearing_deg"] is not None
    assert buckets["road_bearing"]["highway"] == "motorway_link"


def test_unfolded_call_query_is_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    """No bearing_anchor ⇒ byte-identical to the pre-fold query."""
    seen: list[str] = []

    def stub(query: str, **_kw: Any) -> tuple[dict[str, Any], None]:
        seen.append(query)
        return {"elements": []}, None

    monkeypatch.setattr(site_detection, "_overpass_request_with_fallback", stub)
    corridor = _test_corridor()
    site_detection.detect_along_corridor(corridor)
    bbox = corridor.corridor_bbox(
        lateral_buffer_m=site_detection._CORRIDOR_LATERAL_BUFFER_M,
        longitudinal_buffer_m=site_detection._CORRIDOR_LONGITUDINAL_BUFFER_M,
    )
    assert seen == [site_detection._build_bbox_query(bbox)]


def test_derived_check_agrees_with_the_separate_query(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """RULING 2: a disagreement between the derived check and the retired
    separate query is a FINDING, not a re-baseline.  This pins agreement on
    the same road elements, so a future divergence fails loudly here."""
    road = [e for e in _folded_payload()["elements"] if e.get("geometry")]

    # The retired shape: its own trip, returning the road set.
    monkeypatch.setattr(
        site_detection,
        "_overpass_request_with_fallback",
        lambda *a, **k: ({"elements": copy.deepcopy(road)}, None),
    )
    separate = site_detection.validate_corridor_against_osm(39.7269, -104.9873, 10.0)

    # The folded shape: no transport at all, derived from what the scan got.
    derived_result = site_detection._bearing_from_elements(road, 39.7269, -104.9873)

    def explode(*_a: Any, **_k: Any) -> tuple[None, str]:
        raise AssertionError("the derived check must make NO round trip")

    monkeypatch.setattr(site_detection, "_overpass_request_with_fallback", explode)
    derived = site_detection.validate_corridor_against_osm(
        39.7269, -104.9873, 10.0, road_result=derived_result
    )
    assert derived == separate


def test_check_unavailable_string_is_byte_identical(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """#256 ruling c: the fold narrows WHEN check_unavailable fires; it does
    not change the word.  Refusal honesty is untouched (Rule 10)."""
    monkeypatch.setattr(
        site_detection,
        "_overpass_request_with_fallback",
        lambda *a, **k: (None, "every mirror failed"),
    )
    out = site_detection.validate_corridor_against_osm(39.7269, -104.9873, 10.0)
    assert out["checked"] is False
    assert out["reason"] == "check_unavailable"


def test_mirror_constants_are_the_ruled_values() -> None:
    """#292: R70 drops kumi (1 of 27 answers, at 20.7 s); R69 asks the two
    live mirrors at once, so the 7 s per-mirror read cap (#256 ruling a) is
    retired -- the deadline is the only clock (R71).  3 s connect stays
    CHOSEN; RATE_LIMIT_COOLDOWN_S is CHOSEN (R73).  HTTP_TIMEOUT_S still
    governs unbudgeted callers."""
    assert site_detection.OVERPASS_MIRRORS == (
        "https://overpass-api.de/api/interpreter",
        "https://overpass.openstreetmap.fr/api/interpreter",
    )
    assert not hasattr(site_detection, "PER_MIRROR_READ_S")
    assert site_detection.PER_MIRROR_CONNECT_S == 3.0
    assert site_detection.RATE_LIMIT_COOLDOWN_S == 60.0
    assert site_detection.HTTP_TIMEOUT_S == 25.0


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


# ---------------------------------------------------------------------------
# #241 (s2-arc16 rider): the corridor-validation Overpass trip carries the
# same wall-clock budget the #224 phase-1 scan does.  Past the budget the
# check reports its existing honest ``check_unavailable`` state instead
# of hanging the request into the proxy's 60 s limit (three 504s measured
# on prod 2026-09-03).  Fast path byte-identical.
# ---------------------------------------------------------------------------


def test_corridor_check_budget_is_the_chosen_value() -> None:
    # 20 + 20 (site scan) + layout < 60 s proxy limit — recorded on the
    # constant.
    assert site_detection.CORRIDOR_CHECK_BUDGET_S == 20.0


def test_validate_budget_exceeded_reports_check_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cancelled: list[str] = []

    async def mirror_post(_client: Any, url: str, _query: str, _timeout: Any) -> Any:
        try:
            await asyncio.sleep(30)  # both mirrors hang past the whole budget
        except asyncio.CancelledError:
            cancelled.append(url)
            raise
        raise AssertionError("unreachable")

    monkeypatch.setattr(site_detection, "_mirror_post", mirror_post)
    out = site_detection.validate_corridor_against_osm(39.71466, -104.94071, 85.0, budget_s=1.0)
    assert out["checked"] is False
    assert out["reason"] == "check_unavailable"
    assert out["error"] == "scan budget exceeded (1 s)"
    # #292 (R71): both requests were cut off at the deadline.
    assert sorted(cancelled) == sorted(site_detection.OVERPASS_MIRRORS)


def test_validate_fast_path_passes_budget_through_positionally_when_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Existing ``lambda q:`` stubs (one positional arg) must keep working:
    without a budget the fallback is called exactly as before."""
    seen: list[tuple[Any, ...]] = []

    def stub(query: str) -> tuple[dict[str, Any], None]:
        seen.append((query,))
        return {"elements": []}, None

    monkeypatch.setattr(site_detection, "_overpass_request_with_fallback", stub)
    out = site_detection.validate_corridor_against_osm(39.71466, -104.94071, 85.0)
    assert out["checked"] is True  # no road found → checked with a warning
    assert len(seen) == 1
