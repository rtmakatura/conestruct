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
from collections.abc import Mapping
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

# ---------------------------------------------------------------------------
# #224 phase 4 (s2-arc18) — operator corrections of the scanned keys
# ---------------------------------------------------------------------------
#
# ``meta.siteConditionOverrides`` (schemas.SiteConditionOverride) is the
# operator's explicit disagreement with the scan: ``dismiss`` a detected
# condition with a reason, or ``assert`` one the scan did not find.  The
# corrections apply AFTER the scan's precedence and BEFORE
# ``effective_flags`` leave this module, so every consumer (the rules,
# the sheet, the narrative, the audit, both tier mirrors) sees the
# corrected plan and none re-derives it (Rule 3).  Each correction is
# disclosed on the provenance as a :class:`SiteScanCorrection` carrying
# what the scan said at apply time and ONE backend-composed sentence —
# the phase-2 pattern: every surface prints the same words.
#
# A correction the scan now agrees with is ``moot`` — disclosed, never
# dropped (Rule 10).  Without an ok scan (unavailable + proceeded,
# not_run) an assert still applies (the operator's word is the only
# word) and a dismiss is moot (nothing was detected to dismiss).

SITE_CONDITION_LABELS: dict[str, str] = {
    "adjacent_intersection": "adjacent at-grade intersection",
    "adjacent_interchange": "adjacent interchange",
    "pedestrian_facility": "pedestrian sidewalks",
    "bicycle_facility": "bike lane / cycleway",
    "school_zone": "school zone",
}
SCANNED_FLAGS: frozenset[str] = frozenset(DETECTION_TO_FLAG.values())
FLAG_TO_DETECTION: dict[str, str] = {flag: det for det, flag in DETECTION_TO_FLAG.items()}

DISMISS_REASON_TEXT: dict[str, str] = {
    "fenced": "fenced off",
    "removed": "removed",
    "not_in_work_zone": "not in the work zone",
    "other": "other",
}

SITE_CONDITION_OVERRIDE_ERROR = "site_condition_override_invalid"
_VERIFY = (
    " The plan is built to the correction — verify it in the field or on imagery before deploying."
)


def override_violation(overrides: list[Any]) -> str | None:
    """The honest 400's message for a malformed correction list, or None.

    Shape (types) is Pydantic's; these are the cross-field rules the
    ruling set: a dismiss needs a reason; ``note`` exactly when the
    reason is ``other``; an assert carries neither; one correction per
    condition.
    """
    seen: set[str] = set()
    for o in overrides:
        flag = str(getattr(o, "flag", ""))
        label = SITE_CONDITION_LABELS.get(flag, flag)
        if flag in seen:
            return f"Two corrections name {label}; keep one."
        seen.add(flag)
        action = getattr(o, "action", None)
        reason = getattr(o, "reason", None)
        note = (getattr(o, "note", None) or "").strip()
        if action == "dismiss":
            if reason is None:
                return (
                    f"Dismissing {label} needs a reason (fenced, removed, not in work zone, other)."
                )
            if reason == "other" and not note:
                return f"Dismissing {label} for another reason needs a note saying which."
            if reason != "other" and note:
                return f"Dismissing {label}: a note goes only with the reason 'other'."
        elif action == "assert":
            if reason is not None or note:
                return f"Asserting {label} takes no reason — the assertion is the fact."
    return None


def override_detail(message: str) -> dict[str, Any]:
    """Structured ``detail`` for the correction 400 (the #180 code idiom)."""
    return {
        "error": SITE_CONDITION_OVERRIDE_ERROR,
        "message": message,
        "recovery": {"field": "meta.siteConditionOverrides"},
    }


def _reason_text(o: Any) -> str:
    reason = str(getattr(o, "reason", "") or "")
    if reason == "other":
        return (getattr(o, "note", None) or "").strip() or "other"
    return DISMISS_REASON_TEXT.get(reason, reason)


def _apply_corrections(
    effective: dict[str, bool], buckets: dict[str, Any] | None, overrides: list[Any]
) -> tuple[dict[str, bool], list[SiteScanCorrection]]:
    """Apply the operator's corrections on top of the scan's verdict.

    ``buckets`` is the ok scan's result, or None when no scan result
    exists (unavailable + proceeded, not_run).  Returns the corrected
    flags and one disclosed record per correction, in wire order.
    """
    out = dict(effective)
    records: list[SiteScanCorrection] = []
    for o in overrides:
        flag = str(getattr(o, "flag", ""))
        action = str(getattr(o, "action", ""))
        label = SITE_CONDITION_LABELS.get(flag, flag)
        detected: bool | None = None
        if buckets is not None:
            b = buckets.get(FLAG_TO_DETECTION.get(flag, ""))
            detected = bool(isinstance(b, dict) and b.get("detected"))
        if action == "dismiss":
            if detected is True:
                out.pop(flag, None)
                status, text = (
                    "applied",
                    f"Operator dismissed the scan's {label}: {_reason_text(o)}.{_VERIFY}",
                )
            elif detected is False:
                status, text = (
                    "moot",
                    f"Operator dismissal of {label} is moot — the scan found none along "
                    "the corridor; nothing to dismiss.",
                )
            else:
                status, text = (
                    "moot",
                    f"Operator dismissal of {label} could not apply — the site scan did "
                    "not complete; nothing was detected to dismiss.",
                )
        else:  # assert
            if detected is True:
                status, text = (
                    "moot",
                    f"Operator assertion of {label} is moot — the scan detected it; the "
                    "assertion changes nothing.",
                )
            else:
                out[flag] = True
                found = (
                    "the scan found none along the corridor"
                    if detected is False
                    else "the site scan did not complete"
                )
                status, text = ("applied", f"Operator asserted {label} — {found}.{_VERIFY}")
        records.append(
            SiteScanCorrection(
                flag=flag,
                action=action,
                reason=getattr(o, "reason", None),
                note=getattr(o, "note", None),
                recorded_at=str(getattr(o, "recorded_at", "") or ""),
                status=status,
                scan_detected=detected,
                disclosure=text,
            )
        )
    return out, records


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


class SiteScanCorrection(BaseModel):
    """One applied-or-moot operator correction, disclosed (#224 phase 4)."""

    flag: str
    action: Literal["dismiss", "assert"]
    reason: str | None = None
    note: str | None = None
    recorded_at: str = ""
    status: Literal["applied", "moot"]
    # What the scan said for this flag at apply time; None = no scan result.
    scan_detected: bool | None = None
    # The one backend-composed sentence every surface prints.
    disclosure: str


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
    # #224 phase 4 — the operator's corrections, applied or moot, in wire
    # order.  Empty when the scenario carries none.
    corrections: list[SiteScanCorrection] = Field(default_factory=list)


@dataclass(frozen=True)
class SiteScanResult:
    provenance: SiteScanProvenance
    # The flags ``apply_site_adjustments`` and the plan sheet consume.
    effective_flags: dict[str, bool]

    @property
    def refused(self) -> bool:
        """True when generation must answer with the honest 400."""
        return self.provenance.status == "unavailable" and not self.provenance.proceeded_anyway


def not_run_provenance(
    reason: SiteScanReason,
    error: str | None = None,
    corrections: list[SiteScanCorrection] | None = None,
) -> SiteScanProvenance:
    return SiteScanProvenance(
        status="not_run", reason=reason, error=error, corrections=corrections or []
    )


def not_checked_disclosure(scan: Mapping[str, Any] | None) -> str | None:
    """The NOT-CHECKED sentence a surface must print, or ``None``.

    #224 phase 3 (s2-arc17, commit 2): the plan sheet and the crew
    narrative join the audit PDF and the panel as disclosure surfaces.
    One predicate — ``unavailable`` + ``proceeded_anyway`` + the string
    itself — so every surface prints the same backend-authored sentence
    for the same plan and nothing for any other scan state (an ok scan,
    ``not_run``, or a refusal that never reached a render).
    """
    if not scan or scan.get("status") != "unavailable" or not scan.get("proceeded_anyway"):
        return None
    disclosure = scan.get("disclosure")
    return str(disclosure) if disclosure else None


CORRECTIONS_SHEET_PREFIX = "SITE CONDITIONS CORRECTED BY OPERATOR — "


def correction_sentences(scan: Mapping[str, Any] | None) -> list[str]:
    """Every correction's backend-composed sentence, applied and moot, in
    wire order (#224 phase 4).  The narrative and the audit print all of
    them: a moot correction is disclosed, never dropped (rule 10)."""
    if not scan:
        return []
    out: list[str] = []
    for c in scan.get("corrections") or []:
        if isinstance(c, Mapping) and c.get("disclosure"):
            out.append(str(c["disclosure"]))
    return out


def corrections_disclosure(scan: Mapping[str, Any] | None) -> str | None:
    """The one fixed-obligation line the plan sheet prints for APPLIED
    corrections, or None (#224 phase 4, commit 2).

    The notes box has room for a line, not a paragraph: one clause per
    applied correction — "<label> dismissed (<reason>)" / "<label>
    asserted" — behind a prefix of the same class as
    :data:`NOT_CHECKED_DISCLOSURE`.  Moot corrections change nothing on
    the sheet and are disclosed on the surfaces with room (narrative,
    audit, panel).  Authored here so every sheet prints one voice.
    """
    if not scan:
        return None
    clauses: list[str] = []
    for c in scan.get("corrections") or []:
        if not isinstance(c, Mapping) or c.get("status") != "applied":
            continue
        label = SITE_CONDITION_LABELS.get(str(c.get("flag", "")), str(c.get("flag", "")))
        if c.get("action") == "dismiss":
            clauses.append(f"{label} dismissed ({_reason_text(_Obj(c))})")
        else:
            clauses.append(f"{label} asserted")
    if not clauses:
        return None
    return CORRECTIONS_SHEET_PREFIX + "; ".join(clauses) + "."


def correction_reason_text(correction: Mapping[str, Any]) -> str:
    """The dismiss reason as prose, from a provenance correction dict —
    the words the sheet line and the audit-PDF Result cell share."""
    return _reason_text(_Obj(correction))


class _Obj:
    """Attribute view over a wire dict so ``_reason_text`` serves both the
    request model (attributes) and the provenance dict (keys)."""

    def __init__(self, d: Mapping[str, Any]) -> None:
        self._d = d

    def __getattr__(self, name: str) -> Any:
        return self._d.get(name)


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
    overrides: list[Any] = list(getattr(scenario.meta, "siteConditionOverrides", None) or [])
    request: SiteScanRequest | None = getattr(scenario, "site_scan", None)

    def _unscanned(prov: SiteScanProvenance) -> SiteScanResult:
        # No scan result: asserts apply on the operator's word, dismisses
        # are moot — and every correction is still disclosed (phase 4).
        flags, corrections = _apply_corrections(manual, None, overrides)
        prov.corrections = corrections
        return SiteScanResult(prov, flags)

    if request is None:
        return _unscanned(not_run_provenance("not_requested"))

    lat = scenario.meta.lat or None
    lng = scenario.meta.lng or None
    if lat is None or lng is None:
        return _unscanned(not_run_provenance("no_coords"))
    bearing = getattr(params, "bearing_deg", None)
    if bearing is None:
        return _unscanned(not_run_provenance("no_bearing"))

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
        return _unscanned(
            not_run_provenance("corridor_unbuildable", f"{type(exc).__name__}: {exc}")
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
        # The plan (if it proceeds) builds from the manual flags only —
        # plus the operator's asserts (phase 4; dismisses are moot here).
        return _unscanned(prov)

    if not memo_hit:
        _MEMO[key] = (time.monotonic(), buckets, measured_at, duration_ms)

    effective, discarded = _apply_precedence(manual, buckets)
    # Phase 4: the operator's corrections, after the scan's precedence.
    effective, corrections = _apply_corrections(effective, buckets, overrides)
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
        corrections=corrections,
    )
    return SiteScanResult(prov, effective)
