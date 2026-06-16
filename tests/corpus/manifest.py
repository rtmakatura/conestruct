"""Declarative manifest of corpus cases + the shared plumbing tests consume.

A ``CorpusCase`` is one scenario plus its provenance:

* ``spec-verified`` — ``expected`` holds hand-authored ground-truth values
  (dotted paths into the ``/render/audit`` projection) and ``citation`` cites
  the spec. The case has NO snapshot file. ``test_anchors`` asserts the live
  computation equals ``expected``.
* ``current-behavior`` — ``expected`` is empty; a snapshot file under
  ``tests/snapshots/corpus/<id>.json`` locks today's full projection.
  ``test_grid`` asserts the live projection equals the snapshot.

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

Provenance = Literal["spec-verified", "current-behavior"]

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
# PR-1 (harness) shipped two trivially-checkable spacing anchors (MUTCD §6C.09:
# in-taper = S, on-tangent = 2S). PR-2 adds eight hand-verified shoulder-closure
# anchors pinning the four audit-resolvable quantities — taper length (L/3),
# buffer, in-taper spacing, on-tangent spacing — across the 25-75 mph envelope
# and the quadratic/linear taper boundary. Cone size (28/36 in) is computed for
# the device list/PDF but absent from the /render/audit projection, so the
# anchors cannot pin it yet (tracked as an audit-coverage enhancement).
# current-behavior grid + site-condition snapshots land in PR-3; boundary/
# invalid set in PR-4.
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
    "MUTCD 11th ed. §6C.09 / Table 6C-1: channelizing-device spacing in a taper "
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
)

ANCHOR_CASES: tuple[CorpusCase, ...] = tuple(c for c in CASES if c.provenance == "spec-verified")
GRID_CASES: tuple[CorpusCase, ...] = tuple(c for c in CASES if c.provenance == "current-behavior")
