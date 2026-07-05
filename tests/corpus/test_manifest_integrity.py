"""Structural provenance guard for the corpus manifest.

Provenance is enforced by shape, never by a comment, so a snapshot can never
masquerade as spec-verified ground truth:

* spec-verified ⟺ has ``expected`` values, has a ``citation``, has NO snapshot.
* current-behavior ⟺ has NO ``expected``, has a snapshot file on disk.
* boundary ⟺ has NO ``expected`` and NO snapshot; pins an ``expected_status``
  (and, for 400s, an ``expected_error`` rule_id).

Also pins the determinism invariants (no ``meta``/``lat``/``lng`` overrides; a
case may only set known scenario fields) and unique ids.
"""

from __future__ import annotations

import pytest

from tests.corpus.manifest import (
    CASES,
    CorpusCase,
    allowed_input_keys,
    scenario_body,
    snapshot_path,
)

_FORBIDDEN_INPUT_KEYS = frozenset({"kind", "meta", "lat", "lng"})


def test_case_ids_unique() -> None:
    ids = [c.id for c in CASES]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    assert not dupes, f"duplicate corpus case ids: {dupes}"


@pytest.mark.parametrize("case", CASES, ids=lambda c: c.id)
def test_provenance_is_known(case: CorpusCase) -> None:
    assert case.provenance in ("spec-verified", "current-behavior", "boundary"), (
        f"{case.id}: unknown provenance {case.provenance!r}"
    )


@pytest.mark.parametrize("case", CASES, ids=lambda c: c.id)
def test_kind_is_known(case: CorpusCase) -> None:
    assert case.kind in ("shoulder", "flagger_lane_closure"), (
        f"{case.id}: unknown scenario kind {case.kind!r}"
    )


@pytest.mark.parametrize("case", CASES, ids=lambda c: c.id)
def test_inputs_are_scenario_fields_only(case: CorpusCase) -> None:
    keys = set(case.inputs)
    forbidden = keys & _FORBIDDEN_INPUT_KEYS
    assert not forbidden, (
        f"{case.id}: inputs must not set {sorted(forbidden)} — meta/lat/lng are "
        f"pinned by scenario_body for determinism."
    )
    unknown = keys - allowed_input_keys(case.kind)
    assert not unknown, f"{case.id}: unknown input field(s) {sorted(unknown)}"


@pytest.mark.parametrize("case", CASES, ids=lambda c: c.id)
def test_determinism_pins_lat_lng_zero(case: CorpusCase) -> None:
    meta = scenario_body(case)["meta"]
    assert meta["lat"] == 0.0 and meta["lng"] == 0.0, (
        f"{case.id}: scenario_body must pin lat=lng=0 (no corridor-OSM lookup)"
    )


@pytest.mark.parametrize("case", CASES, ids=lambda c: c.id)
def test_provenance_shape_matches(case: CorpusCase) -> None:
    has_snapshot = snapshot_path(case.id).exists()
    if case.provenance == "spec-verified":
        assert case.expected, (
            f"{case.id}: spec-verified cases must carry hand-authored expected "
            f"values (ground truth), not rely on a snapshot."
        )
        assert case.citation.strip(), f"{case.id}: spec-verified cases must cite their spec source."
        assert not has_snapshot, (
            f"{case.id}: spec-verified cases must NOT have a snapshot file "
            f"({snapshot_path(case.id)}) — that would let a snapshot stand in "
            f"for verified truth."
        )
    elif case.provenance == "current-behavior":
        assert not case.expected, (
            f"{case.id}: current-behavior cases must NOT carry expected values "
            f"(a snapshot is not spec-verified ground truth)."
        )
        assert has_snapshot, (
            f"{case.id}: current-behavior cases must have a snapshot file at "
            f"{snapshot_path(case.id)}."
        )
    else:  # boundary
        assert not case.expected, (
            f"{case.id}: boundary cases assert an HTTP status, not expected values."
        )
        assert not has_snapshot, (
            f"{case.id}: boundary cases must NOT have a snapshot file "
            f"({snapshot_path(case.id)}) — they assert a rejection/accept status, "
            f"not a locked projection."
        )
        assert case.expected_status in (200, 400, 422), (
            f"{case.id}: boundary cases must pin expected_status to 200/400/422, "
            f"got {case.expected_status!r}."
        )
        if case.expected_status == 400:
            assert case.expected_error, (
                f"{case.id}: a 400 boundary case must name the "
                f"validate_corridor_geometry rule_id it expects."
            )
        else:
            assert not case.expected_error, (
                f"{case.id}: only 400 boundary cases carry an expected_error "
                f"rule_id (got {case.expected_error!r})."
            )
