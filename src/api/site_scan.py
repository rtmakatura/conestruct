"""#224 phase 1 — the in-generate corridor site scan (s2-arc15).

Generation performs the corridor site scan itself when the scenario
carries ``site_scan`` (a :class:`SiteScanRequest`).  The scan runs
``detect_along_corridor`` against the plan's FINAL geometry — a
:class:`~src.rules.corridor.WorkCorridor` built from the same
``ScenarioParams`` the generator got (speed, work-zone length, the
kind's closure type and shoulder width, the relayed centerline), never
from a button-time result — and its outcome becomes a plan fact: the
five detection-driven site-condition flags feed ``apply_site_adjustments``
and the plan sheet's context drawing, and :class:`SiteScanProvenance`
rides the audit as ``sections.site_scan``.

Three outcomes, all distinct on the wire (Rule 10):

* ``ok``          — the scan completed; an empty result is a measurement.
* ``unavailable`` — Overpass never answered (every mirror failed, a 4xx,
                    or the budget ran out).  Generation refuses with an
                    honest 400 unless ``proceed_if_unavailable`` is set,
                    in which case the plan builds from the manual flags
                    only and carries :data:`NOT_CHECKED_DISCLOSURE`.
* ``not_run``     — nothing was attempted; ``reason`` says why
                    (``not_requested`` is the always-present default).

The vocabulary reuses phase 0's ``scan_status`` (``ok`` | ``unavailable``,
the road-bearing wire) plus ``not_run``; the TS road-bearing type never
sees the new value.

Rulings (2026-09-02): precedence — the scan owns the five detection keys
(set or cleared, exactly what pressing the manual button does today),
manual-only keys pass through, discarded manual values are disclosed in
``manual_flags_discarded``; one scan per Generate — a per-container memo
keyed on the full corridor-input tuple, TTL :data:`MEMO_TTL_S`; the
budget :data:`SCAN_BUDGET_S` is a wall-clock deadline threaded into the
Overpass mirror fallback; no bearing ⇒ ``not_run`` / ``no_bearing`` (no
point-mode fallback in-generate); nothing renders this phase — the
disclosure STRING is authored here so phase 2's three surfaces print one
voice.

Nothing here writes the wire scenario: the result carries the effective
flags for the apply path and the sheet; ``meta.siteConditions`` on the
request is read, never mutated (suggest-never-set boundary).
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.rules.corridor import build_corridor
from src.rules.site_detection import detect_along_corridor

# CHOSEN (ruling 4, s2-arc15): wall-clock budget for one scan.  The
# Overpass query itself declares [timeout:10]; each mirror gets
# HTTP_TIMEOUT_S = 25 s; three mirrors would be 75 s — past the Vercel
# proxy's 60 s function limit.  20 s keeps scan + the audit's existing
# corridor-validation round trip under that limit in the common case, and
# the manual scan measured ≤ 16.3 s at the Lakewood control on prod
# (2026-09-02).  Revisit with the after-numbers.
SCAN_BUDGET_S = 20.0

# CHOSEN (ruling 2): one Modal request lifetime (modal_app.py timeout=120).
# A Generate fans out to the audit + device-breakdown (and downloads) for
# the same corridor within seconds; the memo collapses those to one
# Overpass call per container.  Only ``ok`` results are memoised — a retry
# after an outage must really retry.
MEMO_TTL_S = 120.0

# Detection buckets → site-condition flags (the button's DETECTION_TO_FLAG,
# SiteConditionsField.tsx, now owned here — Rule 3).  Buckets with no
# rule-engine action (railroad_crossings, hospitals, road_curvature) are
# deliberately absent; the two manual-only flags (limited_sight_distance,
# driveways_present) are never touched by the scan.
DETECTION_TO_FLAG: dict[str, str] = {
    "intersections": "adjacent_intersection",
    "interchanges": "adjacent_interchange",
    "sidewalks": "pedestrian_facility",
    "bike_facilities": "bicycle_facility",
    "schools": "school_zone",
}

# The one NOT-CHECKED sentence every surface will print in phase 2
# (sheet, narrative, audit).  Authored once, backend-side.
NOT_CHECKED_DISCLOSURE = "SITE CONDITIONS NOT CHECKED — service unavailable at generation."

# The honest 400's user-facing sentence (#224 ruling 2: refuse by default).
SITE_SCAN_UNAVAILABLE_MESSAGE = (
    "Site scan unavailable — the plan can't verify school zones, sidewalks, "
    "or signals right now. Retry, or generate anyway and the plan will carry "
    "a NOT-CHECKED disclosure."
)

SITE_SCAN_UNAVAILABLE_ERROR = "site_scan_unavailable"

SiteScanStatus = Literal["ok", "unavailable", "not_run"]
SiteScanReason = Literal["not_requested", "no_coords", "no_bearing", "corridor_unbuildable"]


class SiteScanRequest(BaseModel):
    """Ask generation to run the corridor site scan itself.

    Present (even empty) ⇒ the scan runs.  ``proceed_if_unavailable`` is
    the explicit proceed-anyway acknowledgement: without it a failed scan
    is an honest 400; with it the plan builds from the manual flags only
    and the provenance carries the NOT-CHECKED disclosure.
    """

    proceed_if_unavailable: bool = False


class SiteScanInputs(BaseModel):
    """What the corridor was built from — so a wrong scan is traceable to
    its inputs (the Glendale classification-provenance concern: a wrong
    ``road_type`` shows up here, next to the bbox it produced)."""

    lat: float
    lng: float
    bearing_deg: float
    speed_mph: int
    work_zone_ft: float
    closure_type: str
    road_type: str
    lane_width_ft: float
    shoulder_width_ft: float
    centerline_vertices: int
    bbox: tuple[float, float, float, float]


class SiteScanBucket(BaseModel):
    """One detection bucket, as ``detect_along_corridor`` reports it
    (``junction_refs`` on interchanges survives via ``extra="allow"``)."""

    model_config = ConfigDict(extra="allow")

    detected: bool
    count: int
    nearest_distance_m: float | None = None
    # #224 phase 3 (s2-arc17, ruling b): the feet twin of
    # ``nearest_distance_m`` — the panel's tier rows print feet only and
    # never convert (rule 3).  Derived here, once, from the metre value:
    # ft = m / 0.3048 (the international foot is 0.3048 m by definition),
    # rounded to 0.1 ft like the metre value it traces to (rule 12).
    # ``None`` exactly when the metre value is ``None`` (no relevant
    # feature — an absence stays an absence, rule 10).
    nearest_distance_ft: float | None = None
    details: list[str] = Field(default_factory=list)
    features: list[dict[str, Any]] = Field(default_factory=list)

    @model_validator(mode="after")
    def _derive_feet(self) -> SiteScanBucket:
        if self.nearest_distance_ft is None and self.nearest_distance_m is not None:
            self.nearest_distance_ft = round(self.nearest_distance_m / 0.3048, 1)
        return self


class SiteScanProvenance(BaseModel):
    """``sections.site_scan`` — always present on the audit."""

    status: SiteScanStatus
    reason: SiteScanReason | None = None  # not_run only
    error: str | None = None  # unavailable (and corridor_unbuildable) only
    mode: Literal["corridor"] | None = None
    measured_at: str | None = None  # ISO-8601 UTC, seconds
    duration_ms: int | None = None
    budget_s: float = SCAN_BUDGET_S
    memo_hit: bool = False
    proceeded_anyway: bool = False
    inputs: SiteScanInputs | None = None
    buckets: dict[str, SiteScanBucket] = Field(default_factory=dict)
    # The five detection-driven keys as APPLIED (plus the manual-only keys
    # that passed through) — the plan fact.
    flags: dict[str, bool] = Field(default_factory=dict)
    # Manual values the scan overrode (ruling 1 disclosure).
    manual_flags_discarded: dict[str, bool] = Field(default_factory=dict)
    disclosure: str | None = None


@dataclass(frozen=True)
class SiteScanResult:
    provenance: SiteScanProvenance
    # The flags ``apply_site_adjustments`` and the plan sheet consume.
    effective_flags: dict[str, bool]

    @property
    def refused(self) -> bool:
        """True when generation must answer with the honest 400."""
        return self.provenance.status == "unavailable" and not self.provenance.proceeded_anyway


def not_run_provenance(reason: SiteScanReason, error: str | None = None) -> SiteScanProvenance:
    return SiteScanProvenance(status="not_run", reason=reason, error=error)


def refusal_detail(provenance: SiteScanProvenance) -> dict[str, Any]:
    """The honest 400's structured ``detail`` — machine-readable code (the
    #180 note: a gate with no scenario predicate needs a code, not
    message sniffing), the provenance, and the recovery pointer."""
    return {
        "error": SITE_SCAN_UNAVAILABLE_ERROR,
        "message": SITE_SCAN_UNAVAILABLE_MESSAGE,
        "site_scan": provenance.model_dump(mode="json"),
        "recovery": {"retry": True, "proceed_field": "site_scan.proceed_if_unavailable"},
    }


# ---------------------------------------------------------------------------
# The memo (ruling 2)
# ---------------------------------------------------------------------------

_MEMO: dict[str, tuple[float, dict[str, Any], str, int]] = {}


def clear_memo() -> None:
    _MEMO.clear()


def _memo_key(inputs: SiteScanInputs, centerline: tuple[tuple[float, float], ...] | None) -> str:
    raw = json.dumps(
        {"inputs": inputs.model_dump(mode="json"), "centerline": centerline},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _memo_get(key: str) -> tuple[dict[str, Any], str, int] | None:
    hit = _MEMO.get(key)
    if hit is None:
        return None
    stored_at, buckets, measured_at, duration_ms = hit
    if time.monotonic() - stored_at > MEMO_TTL_S:
        del _MEMO[key]
        return None
    return buckets, measured_at, duration_ms


# ---------------------------------------------------------------------------
# The scan
# ---------------------------------------------------------------------------


def _apply_precedence(
    manual: dict[str, bool], buckets: dict[str, Any]
) -> tuple[dict[str, bool], dict[str, bool]]:
    """Ruling 1: the scan owns the five detection keys; manual-only keys
    pass through; return ``(effective, discarded)``."""
    effective = dict(manual)
    discarded: dict[str, bool] = {}
    for det, flag in DETECTION_TO_FLAG.items():
        bucket = buckets.get(det)
        detected = bool(isinstance(bucket, dict) and bucket.get("detected"))
        if detected:
            if flag in manual and manual[flag] is not True:
                discarded[flag] = manual[flag]
            effective[flag] = True
        else:
            if flag in manual and manual[flag]:
                discarded[flag] = manual[flag]
            effective.pop(flag, None)
    return effective, discarded


def run_site_scan(scenario: Any, params: Any) -> SiteScanResult:
    """Run (or memo-serve, or honestly skip) the corridor site scan.

    Never raises.  ``scenario`` is any Scenario kind; ``params`` the
    ScenarioParams ``scenario_to_call`` produced for it.
    """
    manual: dict[str, bool] = dict(getattr(scenario.meta, "siteConditions", None) or {})
    request: SiteScanRequest | None = getattr(scenario, "site_scan", None)
    if request is None:
        return SiteScanResult(not_run_provenance("not_requested"), manual)

    lat = scenario.meta.lat or None
    lng = scenario.meta.lng or None
    if lat is None or lng is None:
        return SiteScanResult(not_run_provenance("no_coords"), manual)
    bearing = getattr(params, "bearing_deg", None)
    if bearing is None:
        return SiteScanResult(not_run_provenance("no_bearing"), manual)

    centerline = getattr(params, "centerline", None)
    try:
        corridor = build_corridor(
            lat=lat,
            lng=lng,
            bearing_deg=float(bearing),
            speed_mph=int(params.speed_mph),
            work_zone_ft=float(params.work_zone_length_ft),
            closure_type=str(params.closure_type),
            road_type=str(params.road_type),
            lane_width_ft=float(params.lane_width_ft),
            shoulder_width_ft=float(params.shoulder_width_ft),
            jurisdiction=str(getattr(params, "jurisdiction", "CDOT")),
            centerline=centerline,
        )
    except ValueError as exc:
        # A kind whose closure type the corridor math does not know — not a
        # service failure, so not ``unavailable``; an honest not_run with
        # the cause.  Unreachable for the enabled kinds (shoulder / lane).
        return SiteScanResult(
            not_run_provenance("corridor_unbuildable", f"{type(exc).__name__}: {exc}"), manual
        )

    from src.rules.site_detection import (
        _CORRIDOR_LATERAL_BUFFER_M,
        _CORRIDOR_LONGITUDINAL_BUFFER_M,
    )

    bbox = corridor.corridor_bbox(
        lateral_buffer_m=_CORRIDOR_LATERAL_BUFFER_M,
        longitudinal_buffer_m=_CORRIDOR_LONGITUDINAL_BUFFER_M,
    )
    inputs = SiteScanInputs(
        lat=lat,
        lng=lng,
        bearing_deg=float(bearing),
        speed_mph=int(params.speed_mph),
        work_zone_ft=float(params.work_zone_length_ft),
        closure_type=str(params.closure_type),
        road_type=str(params.road_type),
        lane_width_ft=float(params.lane_width_ft),
        shoulder_width_ft=float(params.shoulder_width_ft),
        centerline_vertices=len(centerline) if centerline else 0,
        bbox=(bbox[0], bbox[1], bbox[2], bbox[3]),
    )

    key = _memo_key(inputs, centerline)
    hit = _memo_get(key)
    memo_hit = hit is not None
    if hit is not None:
        buckets, measured_at, duration_ms = hit
    else:
        t0 = time.monotonic()
        measured_at = datetime.now(UTC).isoformat(timespec="seconds")
        buckets = detect_along_corridor(corridor, budget_s=SCAN_BUDGET_S)
        duration_ms = int(round((time.monotonic() - t0) * 1000))

    error = buckets.get("error")
    if error:
        proceed = bool(request.proceed_if_unavailable)
        prov = SiteScanProvenance(
            status="unavailable",
            error=str(error),
            mode="corridor",
            measured_at=measured_at,
            duration_ms=duration_ms,
            memo_hit=False,
            proceeded_anyway=proceed,
            inputs=inputs,
            disclosure=NOT_CHECKED_DISCLOSURE if proceed else None,
        )
        # The plan (if it proceeds) builds from the manual flags only.
        return SiteScanResult(prov, manual)

    if not memo_hit:
        _MEMO[key] = (time.monotonic(), buckets, measured_at, duration_ms)

    effective, discarded = _apply_precedence(manual, buckets)
    prov = SiteScanProvenance(
        status="ok",
        mode="corridor",
        measured_at=measured_at,
        duration_ms=duration_ms,
        memo_hit=memo_hit,
        inputs=inputs,
        buckets={
            name: SiteScanBucket.model_validate(b)
            for name, b in buckets.items()
            if isinstance(b, dict)
        },
        flags=effective,
        manual_flags_discarded=discarded,
    )
    return SiteScanResult(prov, effective)
