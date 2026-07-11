"""Corpus tier for the (gated) near_intersection kind — Option C inc. 2 (Refs #117).

Same three-provenance taxonomy as ``tests/corpus/manifest.py``, adapted
for a gated kind:

* **spec-verified anchor** — the design spike's worked Case 18 example
  (``validation-artifacts/intersections-spike/make_sheet_mock.py``),
  hand-verified against S-630-1 Sheet 10's advance-signing key.  The
  HTTP path 400s gated kinds by design, so the anchor asserts on the
  INTERNAL call path (``scenario_to_call`` → generator), at the
  placement level — the layer where the increment's behavior lives.
* **current-behavior grid** — deliberately multi-factor cases (the
  manifest's own caveat: OFAT is insufficient here) locking the full
  placement list as snapshots under ``tests/snapshots/corpus/ni-*.json``.
* **boundary** — invalid inputs must 422 at the schema (pydantic runs
  before the gate), and a valid body must keep drawing the gated-kind
  400: any other status falsifies the increment.

Network-guarded by the shared corpus conftest (meta.lat = lng = 0).
"""

from __future__ import annotations

import json
from dataclasses import asdict
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from src.api.schemas import Scenario, scenario_to_call
from tests.corpus.manifest import snapshot_path

_ADAPTER: TypeAdapter[Scenario] = TypeAdapter(Scenario)

_ANCHOR_CITATION = (
    "CDOT S-630-1 Sheet 10, Case 18 + advance-signing key (URBAN >=45 -> "
    "350'; URBAN <=40 -> 100'); MUTCD 11th Ed. Table 6B-4 (L = W*S at 45 "
    "mph -> 540'), Table 6B-2 (buffer 360' at 45 mph); 1/2C R2-10 position "
    "per Case 18.  Worked example: validation-artifacts/intersections-spike/"
    "make_sheet_mock.py (design spike #117)."
)


def _approach(**overrides: Any) -> dict[str, Any]:
    base = {
        "id": "cross_n",
        "speed": 30,
        "roadType": "urban_arterial",
        "lanesPerDirection": 1,
        "laneWidth": 12.0,
        "signalized": False,
        "bearingDeg": None,
        "alongStationFt": -60.0,
    }
    return {**base, **overrides}


def _body(case_id: str, **overrides: Any) -> dict[str, Any]:
    base = {
        "kind": "near_intersection",
        "meta": {
            "project": case_id,
            "address": "",
            "lat": 0.0,
            "lng": 0.0,
            "siteConditions": {},
        },
        "roadType": "urban_arterial",
        "speed": 45,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 300.0,
        "night": False,
        "approaches": [_approach()],
    }
    return {**base, **overrides}


def _placements_payload(body: dict[str, Any]) -> list[dict[str, Any]]:
    """Internal call path (gate bypassed as the gated-kind tests do)."""
    scenario = _ADAPTER.validate_python(body)
    params, generator, kwargs = scenario_to_call(scenario)
    placements = generator(params, **kwargs)
    out = []
    for p in placements:
        d = asdict(p)
        d["device_type"] = p.device_type.value
        d["station_ft"] = round(d["station_ft"], 1)
        d["offset_ft"] = round(d["offset_ft"], 1)
        out.append(d)
    return out


def _station(payload: list[dict[str, Any]], label: str, approach: str) -> float:
    matches = [p for p in payload if p["label"] == label and p["approach_id"] == approach]
    assert len(matches) == 1, f"{label}@{approach}: {len(matches)} matches"
    return matches[0]["station_ft"]


# ---------------------------------------------------------------------------
# Spec-verified anchor (Case 18)
# ---------------------------------------------------------------------------


def test_case18_anchor_matches_spike() -> None:
    """The generator must reproduce the spike's computed stations exactly.

    Citation: see ``_ANCHOR_CITATION``.  If this test disagrees with the
    spike script, STOP — report which is wrong before re-pinning either
    (spec rule for this increment).
    """
    payload = _placements_payload(_body("ni-anchor-case18"))
    expected = {
        ("W4-2R", "mainline"): 1550.0,  # taper_start 1200 + A 350
        ("W20-5R", "mainline"): 1900.0,  # + B 350
        ("W20-1", "mainline"): 2250.0,  # + C 350
        ("R2-10", "mainline"): 2075.0,  # 1/2 C inside W20-1 (Case 18)
        ("R2-10", "cross_n"): 100.0,  # Sheet 10 key, URBAN <= 40
        ("W20-1", "cross_n"): 200.0,
        ("R2-11", "cross_n"): 100.0,  # departure side, 100' per Case 18
    }
    for (label, approach), station in expected.items():
        assert _station(payload, label, approach) == station, (label, approach)
    drums = sorted(
        p["station_ft"]
        for p in payload
        if p["device_type"] == "DRUM" and p["approach_id"] == "mainline"
    )
    assert len(drums) == 13  # L 540 / in-taper 45 -> 12 intervals
    assert drums[0] == 660.0 and drums[-1] == 1200.0
    assert _ANCHOR_CITATION  # provenance travels with the case


# ---------------------------------------------------------------------------
# Current-behavior grid (multi-factor, snapshot-locked placements)
# ---------------------------------------------------------------------------

# Deliberately multi-factor (mainline speed x approach speed x side x
# approach count), not OFAT: the interaction under test is "each frame
# uses its own numbers."
GRID_BODIES: dict[str, dict[str, Any]] = {
    # Near side, corner termination; slow quadratic-taper mainline (35)
    # against a FASTER cross street (45 urban_high, A=350 > mainline's
    # 100) — the inversion case; two approaches.
    "ni-grid-near-35x45-2ap": _body(
        "ni-grid-near-35x45-2ap",
        speed=35,
        approaches=[
            _approach(id="cross_n", speed=45, alongStationFt=-80.0),
            _approach(id="cross_s", speed=45, alongStationFt=-80.0, lanesPerDirection=2),
        ],
    ),
    # Near side, midblock branch: intersection 2000 ft downstream — the
    # standard reopening fits, closure must NOT extend to the corner.
    "ni-grid-near-midblock-rural": _body(
        "ni-grid-near-midblock-rural",
        roadType="rural_undivided",
        speed=55,
        approaches=[_approach(roadType="rural_undivided", speed=40, alongStationFt=-2000.0)],
    ),
    # Far side, curb+100 anchoring dominates; max lanes (11-ft lanes to
    # stay inside the drawable half-road bound); 55-mph rural approach
    # (A=500) on a 45 urban mainline.
    "ni-grid-far-curb-anchor": _body(
        "ni-grid-far-curb-anchor",
        lanes=4,
        laneWidth=11.0,
        approaches=[
            _approach(roadType="rural_undivided", speed=55, alongStationFt=900.0),
            _approach(id="cross_s", roadType="rural_undivided", speed=55, alongStationFt=900.0),
        ],
    ),
    # Far side, midblock (buffer) anchoring dominates; 25-mph minimum
    # approach speed; long work zone.
    "ni-grid-far-buffer-anchor": _body(
        "ni-grid-far-buffer-anchor",
        speed=50,
        workLen=1000.0,
        approaches=[_approach(speed=25, alongStationFt=1150.0)],
    ),
}


@pytest.mark.parametrize("case_id", sorted(GRID_BODIES), ids=lambda c: c)
def test_grid_matches_snapshot(case_id: str) -> None:
    payload = _placements_payload(GRID_BODIES[case_id])
    path = snapshot_path(case_id)
    assert path.exists(), (
        f"missing snapshot for {case_id} at {path}. Regenerate with "
        f"tests._snapshot_helper.write_snapshot(path, payload)."
    )
    expected = json.loads(path.read_text(encoding="utf-8"))
    assert payload == expected, (
        f"{case_id}: placement list drifted from its locked snapshot. If the "
        f"change is intended, re-baseline via write_snapshot; otherwise a "
        f"computed value regressed."
    )


# ---------------------------------------------------------------------------
# Boundary — honest rejection (and the gate itself)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("case_id", "overrides"),
    [
        # Cross street inside the work zone -> in-intersection work.
        ("ni-bound-inzone", {"approaches": [_approach(alongStationFt=150.0)]}),
        # Divided mainline is out of Phase 1 scope.
        ("ni-bound-divided", {"divided": True}),
        # Approach speed above the 55 cap.
        ("ni-bound-speed60", {"approaches": [_approach(speed=60)]}),
        # Duplicate approach ids.
        (
            "ni-bound-dup-ids",
            {"approaches": [_approach(), _approach(speed=25)]},
        ),
    ],
)
def test_boundary_rejects_422(
    case_id: str,
    overrides: dict[str, Any],
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    res = client.post("/render/audit", headers=auth_headers, json=_body(case_id, **overrides))
    assert res.status_code == 422, res.text


def test_valid_body_still_gated_400(client: TestClient, auth_headers: dict[str, str]) -> None:
    # The increment must not move the gate: a schema-valid body keeps
    # drawing the standard gated-kind 400 over HTTP.
    res = client.post("/render/audit", headers=auth_headers, json=_body("ni-gate-pin"))
    assert res.status_code == 400, res.text
    assert "not yet available" in res.json()["detail"]
