"""Declarative manifest of corpus cases + the shared plumbing tests consume.

A ``CorpusCase`` is one scenario plus its provenance:

* ``spec-verified`` — ``expected`` holds hand-authored ground-truth values
  (dotted paths into the ``/render/audit`` projection) and ``citation`` cites
  the spec. The case has NO snapshot file. ``test_anchors`` asserts the live
  computation equals ``expected``.
* ``current-behavior`` — ``expected`` is empty; a snapshot file under
  ``tests/snapshots/corpus/<id>.json`` locks today's full projection.
  ``test_grid`` asserts the live projection equals the snapshot.
* ``boundary`` — neither ``expected`` nor a snapshot; the case pins an HTTP
  ``expected_status`` (422 schema reject / 400 geometry reject / 200 near-edge
  accept) and, for a 400, the ``expected_error`` rule_id. ``test_boundary``
  asserts the tool fails honestly instead of emitting a degraded plan.

The provenance ⟺ shape mapping is enforced by ``test_manifest_integrity`` so a
snapshot can never masquerade as spec-verified ground truth.

Determinism: ``scenario_body`` always pins ``meta.lat = meta.lng = 0.0`` so the
``/render/audit`` path takes no corridor-OSM lookup. The network guard in
``conftest`` fails loud if anything reaches for the wire anyway.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

Provenance = Literal["spec-verified", "current-behavior", "boundary"]

# Corpus snapshots live in their own subdirectory so the existing
# tests/snapshots/*.json drift guard (non-recursive) is untouched. A
# corpus-specific drift guard arrives with the grid tier (PR-3).
CORPUS_SNAPSHOT_DIR = Path("tests/snapshots/corpus")

# Scenario fields the corpus is allowed to vary. ``meta`` (incl. lat/lng/
# siteConditions) is assembled by ``scenario_body`` — a case may pass
# ``siteConditions`` as a convenience key, but never ``meta``/``lat``/``lng``
# directly (enforced by test_manifest_integrity).
_SCENARIO_FIELDS = frozenset(
    {
        "roadType",
        "speed",
        "lanes",
        "laneWidth",
        "divided",
        "workType",
        "duration",
        "workLen",
        "night",
        "workZoneSpeed",
        "siteConditions",
    }
)


@dataclass(frozen=True)
class CorpusCase:
    """One corpus scenario and how its output is locked.

    ``inputs`` are ShoulderScenario field overrides (no ``meta``/``kind``);
    ``scenario_body`` wraps them into the request body.
    """

    id: str
    provenance: Provenance
    inputs: Mapping[str, Any]
    # spec-verified only: dotted path into the projection -> expected value,
    # e.g. {"summary.device_spacing_taper_ft": 55.0}.
    expected: Mapping[str, Any] = field(default_factory=dict)
    # spec-verified only: where the expected values come from.
    citation: str = ""
    # boundary only: the HTTP status /render/audit must return (422 schema
    # reject / 400 geometry reject / 200 near-edge accept).
    expected_status: int | None = None
    # boundary only, 400 cases: the validate_corridor_geometry rule_id that must
    # appear in detail.violations[] of the 400 response.
    expected_error: str = ""


def scenario_body(case: CorpusCase) -> dict[str, Any]:
    """Build the ``/render/audit`` request body for a case.

    Pins ``meta.lat`` / ``meta.lng`` to ``0.0`` (no network) and folds a
    ``siteConditions`` convenience key into ``meta``.
    """
    fields = dict(case.inputs)
    site_conditions = fields.pop("siteConditions", {})
    return {
        "kind": "shoulder",
        "meta": {
            "project": case.id,
            "address": "",
            "lat": 0.0,
            "lng": 0.0,
            "siteConditions": dict(site_conditions),
        },
        **fields,
    }


def resolve_path(projection: Mapping[str, Any], dotted: str) -> Any:
    """Resolve a dotted path (e.g. ``summary.device_spacing_taper_ft``).

    Raises ``KeyError`` with the full path on a miss so an anchor that points
    at a renamed key fails loudly rather than comparing against ``None``.
    """
    node: Any = projection
    for part in dotted.split("."):
        if not isinstance(node, Mapping) or part not in node:
            raise KeyError(f"path {dotted!r} not found in projection (missing {part!r})")
        node = node[part]
    return node


def snapshot_path(case_id: str) -> Path:
    """Snapshot file for a current-behavior case."""
    return CORPUS_SNAPSHOT_DIR / f"{case_id}.json"


def allowed_input_keys() -> frozenset[str]:
    """Scenario field names a case may set in ``inputs``."""
    return _SCENARIO_FIELDS


# ---------------------------------------------------------------------------
# The corpus.
#
# PR-1 (harness) shipped two trivially-checkable spacing anchors (MUTCD §6K.01:
# in-taper = S, on-tangent = 2S). PR-2 adds eight hand-verified shoulder-closure
# anchors pinning the four audit-resolvable quantities — taper length (L/3),
# buffer, in-taper spacing, on-tangent spacing — across the 25-75 mph envelope
# and the quadratic/linear taper boundary. Cone size (28/36 in) is computed for
# the device list/PDF but absent from the /render/audit projection, so the
# anchors cannot pin it yet (tracked as an audit-coverage enhancement).
#
# PR-3 adds the current-behavior grid: a one-factor-at-a-time sweep around a
# fixed baseline (43 cases), each locking the FULL /render/audit projection as a
# snapshot. These make NO MUTCD-correctness claim — they freeze today's output so
# any future drift in any audit field fails a test. The seven site-condition
# cases live here (their spec mapping is unsettled, overlapping open #19), and
# the 40-mph cases capture the corrected post-taper-fix behavior.
#
# PR-4 adds the boundary/invalid tier (7 cases): inputs at or past a validation
# edge that the tool must REJECT honestly rather than emit a degraded plan, plus
# two near-edge ACCEPTS that guard the valid envelope from over-tightening. Two
# rejection layers, each asserted by status: 422 (pydantic schema refuses the
# input) and 400 (validate_corridor_geometry rejects an impossible corridor,
# with a named rule_id). These assert HTTP status/error codes — not snapshots,
# not expected dicts — so they are a third provenance kind ("boundary").
# ---------------------------------------------------------------------------

# Shared baseline for the bootstrap anchors: a divided rural shoulder closure,
# work zone long enough to clear every taper/buffer minimum (spacing values
# depend only on speed, so the length is just "comfortably valid").
_SPACING_ANCHOR_BASE: dict[str, Any] = {
    "roadType": "rural_divided",
    "lanes": 2,
    "laneWidth": 12.0,
    "divided": True,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 5000.0,
    "night": False,
}

_SPACING_CITATION = (
    "MUTCD 11th ed. §6K.01 / Table 6C-1: channelizing-device spacing in a taper "
    "equals the speed limit in mph read as feet (S); on the tangent it is twice "
    "that (2S). Trivially checkable, independent of taper/buffer math."
)

# Shared inputs for the eight full anchors: a rural shoulder closure, utility
# locate, short duration, work zone comfortably long enough to clear every
# taper/buffer minimum. Only roadType, speed, and divided vary per anchor.
_ANCHOR_BASE: dict[str, Any] = {
    "lanes": 2,
    "laneWidth": 12.0,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 2000,
    "night": False,
    "workZoneSpeed": None,
    "siteConditions": {},
}

# One citation covers all four pinned quantities. The confirmed MUTCD table
# numbers are cited here; the in-code section-number citations are the open #19
# cleanup, so anchors stand on the tables rather than the code's labels.
_ANCHOR_CITATION = (
    "MUTCD 11th Ed.: taper length L per Table 6B-4 (<=40 mph: L = W*S^2/60 "
    "quadratic; >=45 mph: L = W*S linear), shoulder taper = 0.33L per Table "
    "6B-3; buffer per Table 6B-2; channelizing-device spacing = S in the taper "
    "and 2S on the tangent. Confirmed table numbers (in-code section citations "
    "are the open #19 cleanup)."
)


def _anchor(
    case_id: str, road_type: str, speed: int, divided: bool, **expected: float
) -> CorpusCase:
    """A full spec-verified anchor pinning the four audit-resolvable quantities."""
    return CorpusCase(
        id=case_id,
        provenance="spec-verified",
        inputs={**_ANCHOR_BASE, "roadType": road_type, "speed": speed, "divided": divided},
        expected={
            "summary.taper_length_ft": expected["taper"],
            "summary.buffer_space_ft": expected["buffer"],
            "summary.device_spacing_taper_ft": expected["in_taper"],
            "summary.device_spacing_tangent_ft": expected["on_tangent"],
        },
        citation=_ANCHOR_CITATION,
    )


# Baseline for the current-behavior grid (PR-3): a divided rural shoulder
# closure. Each grid case overrides exactly ONE factor from this baseline (the
# reduced-speed pairs override speed + workZoneSpeed together). The bare
# baseline itself is not snapshotted — only its single-factor variants are.
_GRID_BASE: dict[str, Any] = {
    "roadType": "rural_divided",
    "speed": 55,
    "lanes": 2,
    "laneWidth": 12.0,
    "divided": True,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 2000,
    "night": False,
    "workZoneSpeed": None,
    "siteConditions": {},
}


def _grid(case_id: str, **overrides: Any) -> CorpusCase:
    """A current-behavior grid case: the snapshot IS the assertion.

    No ``expected`` and no ``citation`` — provenance is current-behavior, so the
    locked /render/audit projection (written by the PR-3 snapshot generator) is
    the regression baseline. test_manifest_integrity enforces that shape.
    """
    return CorpusCase(
        id=case_id,
        provenance="current-behavior",
        inputs={**_GRID_BASE, **overrides},
    )


# One factor varied at a time from the baseline (NOT cartesian). Each swept
# domain is written literally so the exact set is visible at a glance.
_GRID_SPEEDS = (20, 25, 30, 35, 40, 45, 50, 60, 65, 70, 75)  # 55 is the baseline
_GRID_LANE_WIDTHS = (8.0, 9.0, 10.0, 11.0, 13.0, 14.0)  # 12.0 is the baseline
_GRID_ROAD_TYPES = ("rural_undivided", "urban_arterial", "freeway")  # rural_divided baseline
_GRID_WORK_LENS = (500, 1000, 5000, 10560)  # 2000 is the baseline
# (posted speed, reduced work-zone speed) pairs — workZoneSpeed < speed.
_GRID_REDUCED = ((55, 50), (55, 45), (65, 60), (75, 65), (75, 70))
_GRID_WORK_TYPES = ("survey", "signal_cabinet", "guardrail", "other")  # utility_locate baseline
# Site-condition flags, one at a time. Keys match src.rules.site_adjustments.
_GRID_SITE_FLAGS = (
    "limited_sight_distance",
    "adjacent_intersection",
    "adjacent_interchange",
    "driveways_present",
    "pedestrian_facility",
    "bicycle_facility",
    "school_zone",
)

_GRID_CASES_BUILT: tuple[CorpusCase, ...] = (
    *(_grid(f"grid_speed_{s}", speed=s) for s in _GRID_SPEEDS),
    *(_grid(f"grid_lanewidth_{w:g}", laneWidth=w) for w in _GRID_LANE_WIDTHS),
    _grid("grid_undivided", divided=False),
    _grid("grid_night", night=True),
    _grid("grid_duration_long", duration="long"),
    *(_grid(f"grid_road_{rt}", roadType=rt) for rt in _GRID_ROAD_TYPES),
    *(_grid(f"grid_worklen_{wl:g}", workLen=wl) for wl in _GRID_WORK_LENS),
    *(_grid(f"grid_reduced_{s}_{wz}", speed=s, workZoneSpeed=wz) for s, wz in _GRID_REDUCED),
    *(_grid(f"grid_worktype_{wt}", workType=wt) for wt in _GRID_WORK_TYPES),
    *(_grid(f"grid_site_{flag}", siteConditions={flag: True}) for flag in _GRID_SITE_FLAGS),
)


# Baseline for the boundary/invalid tier (PR-4): the same valid divided shoulder
# closure as the grid. Each boundary case varies ONLY the field under test, so a
# rejection can be attributed to that one edge — everything else stays valid.
_BOUNDARY_BASE: dict[str, Any] = {
    "roadType": "rural_divided",
    "speed": 55,
    "lanes": 2,
    "laneWidth": 12.0,
    "divided": True,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 2000,
    "night": False,
    "workZoneSpeed": None,
    "siteConditions": {},
}


def _boundary(case_id: str, *, status: int, error: str = "", **overrides: Any) -> CorpusCase:
    """A boundary case: assert an HTTP status (and, for 400s, a rule_id).

    No expected/citation/snapshot — provenance is boundary, asserted by
    test_boundary. ``status`` is 422 (pydantic schema reject), 400 (geometry
    reject), or 200 (near-edge accept); ``error`` is the
    validate_corridor_geometry rule_id required to appear in a 400 response.
    """
    return CorpusCase(
        id=case_id,
        provenance="boundary",
        inputs={**_BOUNDARY_BASE, **overrides},
        expected_status=status,
        expected_error=error,
    )


_BOUNDARY_CASES_BUILT: tuple[CorpusCase, ...] = (
    # 422 — pydantic ShoulderScenario schema refuses malformed input.
    _boundary("boundary_speed_85", speed=85, status=422),  # outside 20-75
    _boundary("boundary_speed_52", speed=52, status=422),  # not a multiple of 5
    _boundary("boundary_wzs_exceeds_speed", speed=55, workZoneSpeed=60, status=422),
    # 400 — validate_corridor_geometry rejects an impossible corridor.
    _boundary(
        "boundary_workzone_shorter_than_taper",
        roadType="freeway",
        speed=70,
        workLen=10,  # < required shoulder taper L/3 at 70 mph
        status=400,
        error="WORK_ZONE_SHORTER_THAN_TAPER",
    ),
    _boundary(
        "boundary_lanewidth_below_freeway_min",
        roadType="freeway",
        speed=70,
        laneWidth=10.0,  # < FREEWAY_MIN_LANE_WIDTH_FT (11.0)
        status=400,
        error="LANE_WIDTH_BELOW_FREEWAY_MIN",
    ),
    # Near-edge ACCEPTS — must still pass (guard the valid envelope from the
    # other side, so a future over-tightening of validation gets caught).
    _boundary("boundary_speed_20_accepted", speed=20, status=200),
    _boundary("boundary_speed_75_accepted", speed=75, status=200),
)


CASES: tuple[CorpusCase, ...] = (
    CorpusCase(
        id="anchor_spacing_55mph_divided",
        provenance="spec-verified",
        inputs={**_SPACING_ANCHOR_BASE, "speed": 55},
        expected={
            "summary.device_spacing_taper_ft": 55.0,
            "summary.device_spacing_tangent_ft": 110.0,
        },
        citation=_SPACING_CITATION,
    ),
    CorpusCase(
        id="anchor_spacing_70mph_divided",
        provenance="spec-verified",
        inputs={**_SPACING_ANCHOR_BASE, "speed": 70},
        expected={
            "summary.device_spacing_taper_ft": 70.0,
            "summary.device_spacing_tangent_ft": 140.0,
        },
        citation=_SPACING_CITATION,
    ),
    # Eight hand-verified anchors. taper_length_ft is compared with abs=0.01
    # tolerance in test_anchors (repeating decimals); buffer and both spacings
    # are exact. Table values written verbatim.
    _anchor(
        "anchor_div_25",
        "rural_divided",
        25,
        True,
        taper=34.72,
        buffer=155.0,
        in_taper=25.0,
        on_tangent=50.0,
    ),
    _anchor(
        "anchor_div_35",
        "rural_divided",
        35,
        True,
        taper=68.06,
        buffer=250.0,
        in_taper=35.0,
        on_tangent=70.0,
    ),
    _anchor(
        "anchor_div_40",
        "rural_divided",
        40,
        True,
        taper=88.89,
        buffer=305.0,
        in_taper=40.0,
        on_tangent=80.0,
    ),
    _anchor(
        "anchor_undiv_40",
        "rural_undivided",
        40,
        False,
        taper=71.11,
        buffer=305.0,
        in_taper=40.0,
        on_tangent=80.0,
    ),
    _anchor(
        "anchor_div_45",
        "rural_divided",
        45,
        True,
        taper=150.00,
        buffer=360.0,
        in_taper=45.0,
        on_tangent=90.0,
    ),
    _anchor(
        "anchor_undiv_45",
        "rural_undivided",
        45,
        False,
        taper=120.00,
        buffer=360.0,
        in_taper=45.0,
        on_tangent=90.0,
    ),
    _anchor(
        "anchor_div_65",
        "rural_divided",
        65,
        True,
        taper=216.67,
        buffer=645.0,
        in_taper=65.0,
        on_tangent=130.0,
    ),
    _anchor(
        "anchor_div_75",
        "rural_divided",
        75,
        True,
        taper=250.00,
        buffer=820.0,
        in_taper=75.0,
        on_tangent=150.0,
    ),
    # PR-3 current-behavior grid (43 cases): one factor varied at a time around
    # _GRID_BASE, each locking the full /render/audit projection as a snapshot.
    *_GRID_CASES_BUILT,
    # PR-4 boundary/invalid tier (7 cases): 3x 422 schema rejects, 2x 400
    # geometry rejects (named rule_id), 2x near-edge 200 accepts.
    *_BOUNDARY_CASES_BUILT,
)

ANCHOR_CASES: tuple[CorpusCase, ...] = tuple(c for c in CASES if c.provenance == "spec-verified")
GRID_CASES: tuple[CorpusCase, ...] = tuple(c for c in CASES if c.provenance == "current-behavior")
BOUNDARY_CASES: tuple[CorpusCase, ...] = tuple(c for c in CASES if c.provenance == "boundary")
